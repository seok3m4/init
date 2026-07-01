import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConfirmQuestionSetItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  questionId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  criterionId?: number | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sortOrder!: number;
}

export class ConfirmQuestionSetDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  postingId!: number;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceProcessLogId?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmQuestionSetItemDto)
  items!: ConfirmQuestionSetItemDto[];
}

export class QuestionSetResponseItemDto {
  questionSetItemId!: number;
  questionId!: number;
  criterionId!: number | null;
  sortOrder!: number;
}

export class QuestionSetResponseDto {
  questionSetId!: number;
  postingId!: number;
  title!: string;
  status!: string;
  createdByProcessLogId!: number | null;
  items!: QuestionSetResponseItemDto[];
}
