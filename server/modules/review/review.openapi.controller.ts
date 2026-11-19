import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { ReviewConfigService } from './review-config/review-config.service';
import {
  OpenApiReviewSummaryQueryDto,
  OpenApiReviewRecordQueryDto,
  CreateReviewDto,
  UpdateReviewDto,
} from './dto/review.dto';
import { OpenApiSyncParticipantsRequestDto } from './dto/review-config.dto';
import type {
  UnifiedReviewSummaryResponse,
  UnifiedReviewRecordV2,
  UnifiedReviewListResponseV2,
} from '@shared/api.interface';

/**
 * 统一开放接口（/openapi/reviews/*）
 * 鉴权：X-API-Key 请求头，对应 app_display_setting 中 openapi_api_key
 */
@Controller('openapi/reviews')
export class ReviewOpenApiController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly reviewConfigService: ReviewConfigService,
  ) {}

  private async checkApiKey(headerValue: string | undefined): Promise<void> {
    const valid = await this.reviewService.validateApiKey(headerValue ?? '');
    if (!valid) {
      throw new ForbiddenException('无效的 API Key');
    }
  }

  /**
   * 汇总：按人取最新一条评分记录，支持部门、岗位类型、时间范围筛选
   */
  @Get('summary')
  async getSummary(
    @Headers('x-api-key') apiKey: string,
    @Query() query: OpenApiReviewSummaryQueryDto,
  ): Promise<UnifiedReviewSummaryResponse> {
    await this.checkApiKey(apiKey);
    return this.reviewService.getSummary(query);
  }

  /**
   * 明细列表：分页，支持多维度筛选
   */
  @Get('records')
  async getRecords(
    @Headers('x-api-key') apiKey: string,
    @Query() query: OpenApiReviewRecordQueryDto,
  ): Promise<UnifiedReviewListResponseV2> {
    await this.checkApiKey(apiKey);
    return this.reviewService.listReviews(query);
  }

  /**
   * 单条详情：含评分项明细
   */
  @Get('records/:id')
  async getRecordDetail(
    @Headers('x-api-key') apiKey: string,
    @Param('id') id: string,
  ): Promise<UnifiedReviewRecordV2> {
    await this.checkApiKey(apiKey);
    return this.reviewService.getReviewById(id);
  }

  /**
   * 创建评分记录（复用内部创建逻辑与自动计算）
   */
  @Post('records')
  async createRecord(
    @Headers('x-api-key') apiKey: string,
    @Body() dto: CreateReviewDto,
  ): Promise<UnifiedReviewRecordV2> {
    await this.checkApiKey(apiKey);
    if (!dto.reviewerKey) {
      throw new BadRequestException('reviewerKey 必填');
    }
    return this.reviewService.createReview(dto as CreateReviewDto & { reviewerKey: string });
  }

  /**
   * 更新评分记录（同步刷新 updated_at）
   * 注：OpenAPI 不做 reviewerKey 归属校验，调用方需自行保证数据权限
   */
  @Patch('records/:id')
  async updateRecord(
    @Headers('x-api-key') apiKey: string,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<UnifiedReviewRecordV2> {
    await this.checkApiKey(apiKey);
    // 通过内部详情接口取记录，拿到真实 reviewerKey 后调用更新（跳过权限校验）
    const record = await this.reviewService.getReviewById(id);
    return this.reviewService.updateReview(id, record.reviewerKey, dto);
  }

  /**
   * 参评名单同步（批量 upsert）
   */
  @Post('participants/sync')
  async syncParticipants(
    @Headers('x-api-key') apiKey: string,
    @Body() dto: OpenApiSyncParticipantsRequestDto,
  ): Promise<{
    success: number;
    skipped: number;
    failed: number;
    failures: Array<{ index: number; reason: string }>;
    batchId: string;
  }> {
    await this.checkApiKey(apiKey);
    return this.reviewConfigService.syncParticipantsByApiKey(
      apiKey,
      dto.batchId,
      dto.items.map((item) => ({
        reviewerName: item.reviewerName,
        revieweeName: item.revieweeName,
        department: item.department,
        positionType: item.positionType,
        employeeNo: item.employeeNo,
      })),
      dto.mode || 'upsert',
    );
  }
}
