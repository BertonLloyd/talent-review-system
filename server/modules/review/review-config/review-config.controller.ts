import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReviewConfigService } from './review-config.service';
import { AuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { JwtPayload } from '../../auth/auth.service';
import {
  CreateRuleSetRequestDto,
  UpdateRuleSetRequestDto,
  CreateBatchRequestDto,
  UpdateBatchRequestDto,
  CreateParticipantRequestDto,
  BatchImportParticipantsRequestDto,
  UpdateParticipantRequestDto,
  CreateDisplaySettingRequestDto,
  UpdateDisplaySettingRequestDto,
  ReplaceDisplaySettingsRequestDto,
  CreateReviewerAccountRequestDto,
} from '../dto/review-config.dto';
import type {
  RuleSetStatus,
  BatchStatus,
  ScoreItemInput,
} from '@shared/api.interface';

@Controller('api/review/config')
export class ReviewConfigController {
  constructor(private readonly reviewConfigService: ReviewConfigService) {}

  // ---------- Rule Sets (public read default) ----------

  @Get('rule-sets/default')
  @HttpCode(HttpStatus.OK)
  async getDefaultRuleSet() {
    return this.reviewConfigService.getDefaultRuleSet();
  }

  // ---------- Rule Sets (admin) ----------

  @Get('rule-sets')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async listRuleSets(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: RuleSetStatus,
  ) {
    return this.reviewConfigService.listRuleSets(user, status);
  }

  @Get('rule-sets/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getRuleSet(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reviewConfigService.getRuleSet(user, id);
  }

  @Post('rule-sets')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createRuleSet(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRuleSetRequestDto,
  ) {
    return this.reviewConfigService.createRuleSet(user, dto);
  }

  @Put('rule-sets/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateRuleSet(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRuleSetRequestDto,
  ) {
    return this.reviewConfigService.updateRuleSet(user, id, dto);
  }

  @Delete('rule-sets/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRuleSet(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.reviewConfigService.deleteRuleSet(user, id);
  }

  @Post('rule-sets/:id/copy')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async copyRuleSet(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reviewConfigService.copyRuleSet(user, id);
  }

  @Post('rule-sets/:id/activate')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async activateRuleSet(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reviewConfigService.activateRuleSet(user, id);
  }

  @Post('rule-sets/:id/try-calculate')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async tryCalculate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('items') items: ScoreItemInput[],
  ) {
    return this.reviewConfigService.tryCalculate(user, id, items);
  }

  // ---------- Rule Set Versions ----------

  @Get('rule-sets/:id/versions')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getRuleSetVersions(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.reviewConfigService.getVersions(user, id);
  }

  @Get('rule-sets/:id/versions/:versionNo')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getRuleSetVersion(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('versionNo') versionNo: string,
  ) {
    return this.reviewConfigService.getVersion(user, id, Number(versionNo));
  }

  @Post('rule-sets/:id/versions/:versionNo/rollback')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async rollbackToVersion(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('versionNo') versionNo: string,
  ) {
    return this.reviewConfigService.rollbackToVersion(user, id, Number(versionNo));
  }

  @Post('seed-default-rule-set')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async seedDefaultUnifiedRuleSet(@CurrentUser() user: JwtPayload) {
    return this.reviewConfigService.seedDefaultUnifiedRuleSet(user);
  }

  // ---------- Batches ----------

  @Get('batches')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async listBatches(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: BatchStatus,
  ) {
    return this.reviewConfigService.listBatches(user, status);
  }

  @Get('batches/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getBatch(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reviewConfigService.getBatch(user, id);
  }

  @Post('batches')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createBatch(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBatchRequestDto,
  ) {
    return this.reviewConfigService.createBatch(user, dto);
  }

  @Put('batches/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateBatch(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBatchRequestDto,
  ) {
    return this.reviewConfigService.updateBatch(user, id, dto);
  }

  @Delete('batches/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBatch(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.reviewConfigService.deleteBatch(user, id);
  }

  // ---------- Participants ----------

  @Get('participants/template')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getParticipantTemplate(
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const buffer = await this.reviewConfigService.getParticipantTemplate(user);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="participant_template.xlsx"',
    );
    res.end(buffer);
  }

  @Get('batches/:batchId/participants')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async listParticipants(
    @CurrentUser() user: JwtPayload,
    @Param('batchId') batchId: string,
    @Query('reviewerKey') reviewerKey?: string,
  ) {
    return this.reviewConfigService.listParticipants(user, batchId, reviewerKey);
  }

  @Get('participants/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getParticipant(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reviewConfigService.getParticipant(user, id);
  }

  @Post('participants')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createParticipant(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateParticipantRequestDto,
  ) {
    return this.reviewConfigService.createParticipant(user, dto);
  }

  @Post('participants/batch-import')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async batchImportParticipants(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BatchImportParticipantsRequestDto,
  ) {
    return this.reviewConfigService.batchImportParticipants(
      user,
      dto.batchId,
      dto.items,
    );
  }

  @Put('participants/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateParticipant(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateParticipantRequestDto,
  ) {
    return this.reviewConfigService.updateParticipant(user, id, dto);
  }

  @Delete('participants/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteParticipant(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    await this.reviewConfigService.deleteParticipant(user, id);
  }

  @Delete('batches/:batchId/participants')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearBatchParticipants(
    @CurrentUser() user: JwtPayload,
    @Param('batchId') batchId: string,
  ) {
    await this.reviewConfigService.clearBatchParticipants(user, batchId);
  }

  // ---------- API Key ----------

  @Get('api-key')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getApiKey(@CurrentUser() user: JwtPayload) {
    return this.reviewConfigService.getOrCreateApiKey(user);
  }

  @Post('api-key/reset')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async resetApiKey(@CurrentUser() user: JwtPayload) {
    return this.reviewConfigService.resetApiKey(user);
  }

  // ---------- Display Settings ----------

  @Get('display-settings/public')
  @HttpCode(HttpStatus.OK)
  async getDisplaySettings() {
    return this.reviewConfigService.getDisplaySettings();
  }

  @Get('display-settings')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async listDisplaySettings(@CurrentUser() user: JwtPayload) {
    return this.reviewConfigService.listDisplaySettings(user);
  }

  @Get('display-settings/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getDisplaySetting(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.reviewConfigService.getDisplaySetting(user, id);
  }

  @Post('display-settings')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createDisplaySetting(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDisplaySettingRequestDto,
  ) {
    return this.reviewConfigService.createDisplaySetting(user, dto);
  }

  @Put('display-settings/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateDisplaySetting(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDisplaySettingRequestDto,
  ) {
    return this.reviewConfigService.updateDisplaySetting(user, id, dto);
  }

  @Patch('display-settings/key/:key')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async upsertDisplaySettingByKey(
    @CurrentUser() user: JwtPayload,
    @Param('key') key: string,
    @Body() dto: { settingValue: string; sortOrder?: number },
  ) {
    return this.reviewConfigService.upsertDisplaySettingByKey(
      user,
      key,
      dto.settingValue,
      dto.sortOrder,
    );
  }

  @Delete('display-settings/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDisplaySetting(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    await this.reviewConfigService.deleteDisplaySetting(user, id);
  }

  @Post('display-settings/replace')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async replaceDisplaySettings(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReplaceDisplaySettingsRequestDto,
  ) {
    return this.reviewConfigService.replaceDisplaySettings(user, dto.items);
  }

  // ---------- Reviewer Account Management ----------

  @Get('reviewer-accounts')
  @UseGuards(AuthGuard)
  async listReviewerAccounts(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? Math.max(1, parseInt(page, 10)) : 1;
    const ps = pageSize ? Math.min(100, Math.max(1, parseInt(pageSize, 10))) : 50;
    return this.reviewConfigService.listReviewerAccounts(user, p, ps);
  }

  @Post('reviewer-accounts')
  @UseGuards(AuthGuard)
  async createReviewerAccount(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReviewerAccountRequestDto,
  ) {
    return this.reviewConfigService.createReviewerAccount(user, dto);
  }

  @Post('reviewer-accounts/:key/reset-password')
  @UseGuards(AuthGuard)
  async resetReviewerPassword(
    @CurrentUser() user: JwtPayload,
    @Param('key') key: string,
  ) {
    return this.reviewConfigService.resetReviewerPassword(user, key);
  }

  @Post('reviewer-accounts/:key/disable')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async disableReviewerAccount(
    @CurrentUser() user: JwtPayload,
    @Param('key') key: string,
  ) {
    return this.reviewConfigService.disableReviewerAccount(user, key);
  }

  @Post('reviewer-accounts/:key/enable')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async enableReviewerAccount(
    @CurrentUser() user: JwtPayload,
    @Param('key') key: string,
  ) {
    return this.reviewConfigService.enableReviewerAccount(user, key);
  }
}
