import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
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
  HiringEvaluationContextSnapshotJson,
  HiringPolicySnapshot,
  HiringQuestionSetMode,
  HiringQuestionSetSnapshotJson,
  HiringTieBreakMode,
  TalentRubricSnapshotJson,
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

export class LockHiringSimulationDto {
  @IsString()
  @Matches(/^sha256:[0-9a-f]{64}$/)
  expectedConfigurationHash!: string;

  @IsObject()
  talentRubric!: TalentRubricSnapshotJson;
}

export class EvaluateHiringAnswerDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sessionId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  questionId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  primaryAnswerId!: number;
}

export class HiringAnswerEvaluationJobResponseDto {
  accepted!: true;
  processLogId!: number;
  status!: string;
  queued!: boolean;
  deduplicated!: boolean;
  contextVersion!: string;
  cohortId!: number;
  candidateId!: number;
  sessionId!: number;
  questionId!: number;
  primaryAnswerId!: number;
}

export class HiringSimulationCohortResponseDto {
  cohortId!: number;
  postingId!: number;
  policyId!: number;
  questionSetSnapshotId!: number;
  configurationHash!: string;
  title!: string;
  jobRole!: string;
  status!: HiringCohortStatus;
  capacity!: number;
  openedAt!: string;
  lockedAt!: string | null;
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
  snapshotJson!:
    | HiringQuestionSetSnapshotJson
    | HiringEvaluationContextSnapshotJson;
  createdAt!: string;
}

export class HiringSimulationResponseDto {
  cohort!: HiringSimulationCohortResponseDto;
  policy!: HiringSimulationPolicyResponseDto;
  questionSetSnapshot!: HiringSimulationQuestionSetResponseDto;
}
