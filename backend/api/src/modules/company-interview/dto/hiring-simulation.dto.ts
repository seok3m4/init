import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import {
  HIRING_DECISION_MODES,
  HIRING_QUESTION_SET_MODES,
  HiringCohortStatus,
  HiringDecisionMode,
  HiringPolicySnapshot,
  HiringQuestionSetMode,
  HiringQuestionSetSnapshotJson,
  HiringTieBreakMode,
} from '../company-interview.types';

export class CreateHiringSimulationDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  requestKey!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  postingId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceQuestionSetId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsIn(HIRING_DECISION_MODES)
  decisionMode?: HiringDecisionMode;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  jobWeightPercent!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  talentWeightPercent!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minimumJobScore!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minimumTalentScore!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minimumEvidenceCoveragePercent!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  capacity!: number;

  @IsIn(HIRING_QUESTION_SET_MODES)
  questionSetMode!: HiringQuestionSetMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  questionCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  maxFollowUpCount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  orderedQuestionIds!: number[];
}

export class HiringSimulationCohortResponseDto {
  cohortId!: number;
  postingId!: number;
  policyId!: number;
  questionSetSnapshotId!: number;
  title!: string;
  jobRole!: string;
  status!: HiringCohortStatus;
  capacity!: number;
  openedAt!: string;
  createdAt!: string;
}

export class HiringSimulationPolicyResponseDto {
  policyId!: number;
  policyVersion!: string;
  decisionMode!: HiringDecisionMode;
  jobWeightPercent!: number;
  talentWeightPercent!: number;
  minimumJobScore!: number;
  minimumTalentScore!: number;
  minimumEvidenceCoveragePercent!: number;
  tieBreakMode!: HiringTieBreakMode;
  snapshotJson!: HiringPolicySnapshot;
  createdAt!: string;
}

export class HiringSimulationQuestionSetResponseDto {
  questionSetSnapshotId!: number;
  sourceQuestionSetId!: number;
  snapshotVersion!: string;
  jobRole!: string;
  mode!: HiringQuestionSetMode;
  questionCount!: number;
  maxFollowUpCount!: number;
  snapshotJson!: HiringQuestionSetSnapshotJson;
  createdAt!: string;
}

export class HiringSimulationResponseDto {
  cohort!: HiringSimulationCohortResponseDto;
  policy!: HiringSimulationPolicyResponseDto;
  questionSetSnapshot!: HiringSimulationQuestionSetResponseDto;
}
