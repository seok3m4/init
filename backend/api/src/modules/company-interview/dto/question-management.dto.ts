import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  AiProcessStatus,
  QUESTION_TYPES,
  QuestionType,
} from '../company-interview.types';

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

export class GenerateInterviewQuestionsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  postingId!: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  criterionIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsIn(QUESTION_TYPES, { each: true })
  questionTypes?: QuestionType[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  requestedCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  jdText?: string;
}

export class QuestionGenerationProcessResponseDto {
  processLogId!: number;
  status!: AiProcessStatus;
}

export class CreateQuestionSetDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  postingId!: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  questionIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsIn(QUESTION_TYPES, { each: true })
  questionTypes?: QuestionType[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  questionCount!: number;
}

export class QuestionSetResponseDto {
  postingId!: number;
  questionSet!: {
    questionIds: number[];
    questionCount: number;
    readyForSession: boolean;
  };
}
