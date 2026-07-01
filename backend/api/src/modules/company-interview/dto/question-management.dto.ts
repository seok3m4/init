import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { QUESTION_TYPES, QuestionType } from '../company-interview.types';

export class CreateInterviewQuestionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  postingId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  criterionId!: number;

  @IsIn(QUESTION_TYPES)
  questionType!: QuestionType;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  content!: string;
}

export class UpdateInterviewQuestionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  criterionId!: number;

  @IsIn(QUESTION_TYPES)
  questionType!: QuestionType;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  content!: string;
}

export class InterviewQuestionResponseItemDto {
  questionId!: number;
  postingId!: number | null;
  criterionId!: number | null;
  questionType!: QuestionType;
  content!: string;
  isActive!: boolean;
}

export class CreateInterviewQuestionResponseDto {
  postingId!: number;
  question!: InterviewQuestionResponseItemDto;
}
