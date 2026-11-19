/* eslint-disable @darraghor/nestjs-typed/validated-non-primitive-property-needs-type-decorator */
import { Type } from 'class-transformer';
import {
  IsString,
  IsInt,
  Min,
  IsNotEmpty,
  ValidateNested,
  IsOptional,
  IsBoolean,
  IsArray,
  IsIn,
  IsNumber,
} from 'class-validator';
import {
  BATCH_STATUSES,
  RULE_SET_STATUSES,
} from '@shared/api.interface';
import type {
  BatchStatus,
  CreateBatchRequest,
  CreateDisplaySettingRequest,
  CreateParticipantRequest,
  CreateRuleSetRequest,
  RuleSetConfig,
  RuleSetStatus,
  UpdateBatchRequest,
  UpdateDisplaySettingRequest,
  UpdateParticipantRequest,
  UpdateRuleSetRequest,
  CreateReviewerAccountRequest,
} from '@shared/api.interface';

// ---------- Rule Set DTOs ----------

class RuleDimensionItemDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(1)
  maxScore!: number;

  @IsInt()
  sortOrder!: number;

  @IsOptional()
  @IsBoolean()
  evidenceRequired?: boolean;
}

class RuleDimensionDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  weight!: number;

  @IsBoolean()
  isRedLine!: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleDimensionItemDto)
  items!: RuleDimensionItemDto[];
}

class GridThresholdsDto {
  @IsNumber()
  high!: number;

  @IsNumber()
  low!: number;
}

class EvidenceLevelDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsNumber()
  minScore?: number;

  @IsOptional()
  @IsNumber()
  maxScore?: number;

  @IsString()
  description!: string;
}

class ScoreLevelDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  minScore!: number;

  @IsNumber()
  maxScore!: number;

  @IsString()
  description!: string;
}

class PositionTypeItemDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(1)
  maxScore!: number;

  @IsNumber()
  @Min(0)
  weight!: number;

  @IsOptional()
  @IsBoolean()
  evidenceRequired?: boolean;
}

class PositionTypeConfigDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionTypeItemDto)
  performanceItems!: PositionTypeItemDto[];
}

class RuleSetConfigDto implements RuleSetConfig {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleDimensionDto)
  dimensions!: RuleDimensionDto[];

  @ValidateNested()
  @Type(() => GridThresholdsDto)
  gridThresholds!: GridThresholdsDto;

  @IsString()
  @IsNotEmpty()
  xAxisDimension!: string;

  @IsString()
  @IsNotEmpty()
  yAxisDimension!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenceLevelDto)
  evidenceLevels!: EvidenceLevelDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScoreLevelDto)
  scoreLevels!: ScoreLevelDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionTypeConfigDto)
  positionTypes?: PositionTypeConfigDto[];
}

export class CreateRuleSetRequestDto implements CreateRuleSetRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateNested()
  @Type(() => RuleSetConfigDto)
  config!: RuleSetConfigDto;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateRuleSetRequestDto implements UpdateRuleSetRequest {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(RULE_SET_STATUSES)
  status?: RuleSetStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => RuleSetConfigDto)
  config?: RuleSetConfigDto;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  changeNote?: string;
}

// ---------- Batch DTOs ----------

export class CreateBatchRequestDto implements CreateBatchRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  ruleSetId!: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateBatchRequestDto implements UpdateBatchRequest {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(BATCH_STATUSES)
  status?: BatchStatus;

  @IsOptional()
  @IsString()
  ruleSetId?: string;

  @IsOptional()
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @IsString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  description?: string;
}

// ---------- Participant DTOs ----------

export class CreateParticipantRequestDto implements CreateParticipantRequest {
  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @IsString()
  @IsNotEmpty()
  reviewerKey!: string;

  @IsString()
  @IsNotEmpty()
  reviewerName!: string;

  @IsString()
  @IsNotEmpty()
  revieweeName!: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  positionType?: string;

  @IsOptional()
  @IsString()
  employeeNo?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class ParticipantImportItemDto {
  @IsString()
  @IsNotEmpty()
  reviewerKey!: string;

  @IsString()
  @IsNotEmpty()
  reviewerName!: string;

  @IsString()
  @IsNotEmpty()
  revieweeName!: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  positionType?: string;

  @IsOptional()
  @IsString()
  employeeNo?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class BatchImportParticipantsRequestDto {
  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantImportItemDto)
  items!: ParticipantImportItemDto[];
}

export class UpdateParticipantRequestDto implements UpdateParticipantRequest {
  @IsOptional()
  @IsString()
  reviewerKey?: string;

  @IsOptional()
  @IsString()
  reviewerName?: string;

  @IsOptional()
  @IsString()
  revieweeName?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  positionType?: string;

  @IsOptional()
  @IsString()
  employeeNo?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

// ---------- Display Setting DTOs ----------

export class CreateDisplaySettingRequestDto implements CreateDisplaySettingRequest {
  @IsString()
  @IsNotEmpty()
  settingKey!: string;

  @IsString()
  @IsNotEmpty()
  settingValue!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateDisplaySettingRequestDto implements UpdateDisplaySettingRequest {
  @IsOptional()
  @IsString()
  settingKey?: string;

  @IsOptional()
  @IsString()
  settingValue?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class ReplaceDisplaySettingItemDto {
  @IsString()
  @IsNotEmpty()
  settingKey!: string;

  @IsString()
  settingValue!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class ReplaceDisplaySettingsRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReplaceDisplaySettingItemDto)
  items!: ReplaceDisplaySettingItemDto[];
}

// ---------- OpenAPI Participant Sync DTOs ----------

export class OpenApiSyncItemDto {
  @IsString()
  @IsNotEmpty()
  reviewerName!: string;

  @IsString()
  @IsNotEmpty()
  revieweeName!: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  positionType?: string;

  @IsOptional()
  @IsString()
  employeeNo?: string;
}

export class OpenApiSyncParticipantsRequestDto {
  @IsOptional()
  @IsString()
  batchId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpenApiSyncItemDto)
  items!: OpenApiSyncItemDto[];

  @IsOptional()
  @IsString()
  mode?: string;
}

// ---------- Reviewer Account DTOs ----------

export class CreateReviewerAccountRequestDto implements CreateReviewerAccountRequest {
  @IsOptional()
  @IsString()
  reviewerKey?: string;

  @IsString()
  @IsNotEmpty()
  reviewerName!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  password?: string;
}
