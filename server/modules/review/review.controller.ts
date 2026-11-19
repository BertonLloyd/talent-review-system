import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { ReviewService } from './review.service';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewQueryDto,
} from './dto/review.dto';
import type {
  UnifiedReviewRecordV2,
  UnifiedReviewListResponseV2,
  UnifiedReviewSummaryResponse,
} from '@shared/api.interface';

@Controller('api/review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // ==================== 登录 ====================

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body('reviewerKey') reviewerKey: string,
    @Body('password') password: string,
  ) {
    return this.reviewService.login(reviewerKey, password);
  }

  // ==================== 修改密码 ====================

  @UseGuards(AuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body('oldPassword') oldPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.reviewService.changePassword(user, oldPassword, newPassword);
  }

  // ==================== 评价人列表 ====================

  @Get('reviewers')
  @HttpCode(HttpStatus.OK)
  async getReviewers() {
    return this.reviewService.getReviewers();
  }

  // ==================== 被盘人列表 ====================

  @UseGuards(AuthGuard)
  @Get('reviewees')
  async getReviewees(
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    reviewerName: string;
    reviewees: Array<{
      name: string;
      department: string | null;
      positionType: string | null;
      employeeNo: string | null;
      hasSubmitted: boolean;
    }>;
  }> {
    return this.reviewService.getRevieweesByReviewer(user.reviewerKey);
  }

  // ==================== 我的评分列表 ====================

  @UseGuards(AuthGuard)
  @Get('mine')
  async getMyReviews(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ items: UnifiedReviewRecordV2[] }> {
    const items = await this.reviewService.getMyReviews(user.reviewerKey);
    return { items };
  }

  // ==================== 评分详情 ====================

  @UseGuards(AuthGuard)
  @Get('records/:id')
  async getReviewDetail(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<UnifiedReviewRecordV2> {
    // 管理员可以看所有？这里简单传 reviewerKey，admin 角色由 service 放宽
    return this.reviewService.getReviewById(id, user.role === 'admin' ? undefined : user.reviewerKey);
  }

  // ==================== 提交评分 ====================

  @UseGuards(AuthGuard)
  @Post('records')
  async createReview(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReviewDto,
  ): Promise<UnifiedReviewRecordV2> {
    return this.reviewService.createReview({
      ...dto,
      reviewerKey: user.reviewerKey,
      reviewerName: user.reviewerName,
    });
  }

  // ==================== 更新评分 ====================

  @UseGuards(AuthGuard)
  @Patch('records/:id')
  async updateReview(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<UnifiedReviewRecordV2> {
    return this.reviewService.updateReview(id, user.reviewerKey, dto);
  }

  // ==================== 删除评分（软删） ====================

  @UseGuards(AuthGuard)
  @Delete('records/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReview(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.reviewService.deleteReview(id, user.reviewerKey);
  }

  // ==================== 管理员：全量列表 ====================

  @UseGuards(AuthGuard)
  @Get('summary')
  async getSummary(
    @CurrentUser() user: JwtPayload,
    @Query() query: ReviewQueryDto,
  ): Promise<UnifiedReviewSummaryResponse> {
    if (user.role !== 'admin') {
      throw new ForbiddenException('仅管理员可访问汇总数据');
    }
    return this.reviewService.getSummary(query);
  }

  @UseGuards(AuthGuard)
  @Get('records')
  async listReviews(
    @CurrentUser() user: JwtPayload,
    @Query() query: ReviewQueryDto,
  ): Promise<UnifiedReviewListResponseV2> {
    // 非管理员只能看自己的
    const effectiveQuery = user.role === 'admin'
      ? query
      : { ...query, reviewerKey: user.reviewerKey };
    return this.reviewService.listReviews(effectiveQuery);
  }
}
