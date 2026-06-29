import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AiProcessStatus } from '../company-interview.types';

export class SuggestEvaluationCriterionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  postingId!: number;

  @IsOptional()
  jobRole?: string;

  @IsOptional()
  jdText?: string;

  @IsOptional()
  companyFitText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  requestedCount?: number;
}

export class EvaluationCriterionSuggestionProcessResponseDto {
  processLogId!: number;
  status!: AiProcessStatus;
}

export class EvaluationCriterionItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  criterionId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  tagId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  weight!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  passScore?: number | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sortOrder!: number;
}

export class UpdateEvaluationCriterionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  postingId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EvaluationCriterionItemDto)
  criteria!: EvaluationCriterionItemDto[];
}

export class EvaluationCriterionResponseItemDto {
  criterionId!: number;
  tagId!: number;
  tagName!: string;
  category!: string;
  description!: string | null;
  weight!: number;
  passScore!: number | null;
  sortOrder!: number;
}

export class EvaluationCriterionResponseDto {
  postingId!: number;
  criteria!: EvaluationCriterionResponseItemDto[];
  totalWeight!: number;
}
