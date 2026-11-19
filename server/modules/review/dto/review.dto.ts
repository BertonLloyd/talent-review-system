import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  GridCategory,
  UnifiedCreateReviewRequestV2,
  UnifiedReviewItemInput,
  UnifiedReviewQueryParamsV2,
  UnifiedUpdateReviewRequestV2,
} from '@shared/api.interface';

const GRID_CATEGORY_VALUES: readonly GridCategory[] = [
  'super_star',
  'performance_star',
  'skilled_employee',
  'potential_star',
  'backbone',
  'regular_employee',
  'to_develop',
  'gap_employee',
  'problem_employee',
  'red_line',
] as const;

// ---------- Score item input DTO ----------

class ReviewItemInputDto implements UnifiedReviewItemInput {
  @IsString()
  @IsNotEmpty()
  dimensionCode!: string;

  @IsString()
  @IsNotEmpty()
  itemCode!: string;

  @IsString()
  @IsNotEmpty()
  itemName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  score!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @IsString()
  evidenceText?: string;

  @IsOptional()
  @IsString()
  evidenceLevel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

// ---------- Create Review ----------

export class CreateReviewDto implements UnifiedCreateReviewRequestV2 {
  @IsOptional()
  @IsString()
  reviewerKey?: string;

  @IsOptional()
  @IsString()
  reviewerName?: string;

  @IsString()
  @IsNotEmpty()
  revieweeName!: string;

  @IsOptional()
  @IsString()
  employeeNo?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  positionType?: string;

  @IsOptional()
  @IsString()
  ruleSetId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewItemInputDto)
  items!: ReviewItemInputDto[];

  @IsOptional()
  // eslint-disable-next-line @darraghor/nestjs-typed/validated-non-primitive-property-needs-type-decorator
  @IsObject()
  performanceItems?: Record<string, { score: number; evidence?: string; evidenceLevel?: string }>;

  @IsOptional()
  @IsBoolean()
  isTest?: boolean;
}

// ---------- Update Review ----------

export class UpdateReviewDto implements UnifiedUpdateReviewRequestV2 {
  @IsOptional()
  @IsString()
  reviewerName?: string;

  @IsOptional()
  @IsString()
  revieweeName?: string;

  @IsOptional()
  @IsString()
  employeeNo?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  positionType?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewItemInputDto)
  items?: ReviewItemInputDto[];

  @IsOptional()
  // eslint-disable-next-line @darraghor/nestjs-typed/validated-non-primitive-property-needs-type-decorator
  @IsObject()
  performanceItems?: Record<string, { score: number; evidence?: string; evidenceLevel?: string }>;

  @IsOptional()
  @IsBoolean()
  isTest?: boolean;
}

// ---------- Query DTO ----------

export class ReviewQueryDto implements UnifiedReviewQueryParamsV2 {
  @IsOptional()
  @IsString()
  reviewerKey?: string;

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
  @Type(() => String)
  gridCategory?: GridCategory;

  @IsOptional()
  @Transform(({ obj, key, value }) => {
    const raw = obj[key];
    if (raw === '' || raw === undefined || raw === null) return undefined;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return value;
  })
  @IsBoolean()
  isRedLine?: boolean;

  @IsOptional()
  @IsString()
  ruleSetId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize?: number;

  @IsOptional()
  @Transform(({ obj, key, value }) => {
    const raw = obj[key];
    if (raw === '' || raw === undefined || raw === null) return undefined;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return value;
  })
  @IsBoolean()
  includeTest?: boolean;
}

// ---------- OpenAPI Query DTOs (same shape, no auth guard) ----------

export class OpenApiReviewSummaryQueryDto {
  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  positionType?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @Transform(({ obj, key, value }) => {
    const raw = obj[key];
    if (raw === '' || raw === undefined || raw === null) return undefined;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return value;
  })
  @IsBoolean()
  includeTest?: boolean;
}

export class OpenApiReviewRecordQueryDto extends ReviewQueryDto {}
