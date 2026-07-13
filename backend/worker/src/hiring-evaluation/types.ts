import type {
  NcsEvaluationProductOutput,
  NcsEvaluationProductSnapshot,
} from "../ncs-evaluation/product-evidence-state.adapter";
import type {
  TalentEvidenceType,
  TalentRubricAnchorLevel,
  TalentRubricSnapshot,
} from "../talent-rubric";

export const HIRING_EVALUATION_CONTEXT_VERSION = "hiring-evaluation-context.v1" as const;
export const HIRING_ANSWER_EVALUATION_CONTRACT_VERSION = "hiring-answer-evaluation.v1" as const;
export const HIRING_CALCULATION_CONTRACT_VERSION = "hiring-evaluation.v1" as const;

export type HiringDecisionMode = "ABSOLUTE" | "RELATIVE" | "HYBRID";
export type HiringQuestionSetMode = "QUICK" | "STANDARD" | "DEEP" | "CUSTOM";

export interface HiringPolicySnapshot {
  readonly schemaVersion: "hiring-evaluation-policy.v1";
  readonly administratorInput: {
    readonly postingId: number;
    readonly decisionMode: HiringDecisionMode;
    readonly jobWeightPercent: number;
    readonly talentWeightPercent: number;
    readonly minimumJobScore: number;
    readonly minimumTalentScore: number;
    readonly minimumEvidenceCoveragePercent: number;
  };
  readonly tieBreakOrder: readonly Record<string, unknown>[];
}

export interface HiringEvaluationContextQuestion {
  readonly questionId: number;
  readonly order: number;
  readonly questionType: "TECHNICAL" | "EXPERIENCE" | "SITUATION";
  readonly content: string;
  readonly criterionId: number | null;
  readonly ncsEvaluationSnapshot: NcsEvaluationProductSnapshot;
}

export interface HiringEvaluationContextSnapshot {
  readonly schemaVersion: typeof HIRING_EVALUATION_CONTEXT_VERSION;
  readonly contextVersion: string;
  readonly contextHash: string;
  readonly calculationContractVersion: typeof HIRING_CALCULATION_CONTRACT_VERSION;
  readonly cohort: {
    readonly cohortId: number;
    readonly companyId: number;
    readonly postingId: number;
    readonly configurationHash: string;
  };
  readonly sourceConfiguration: {
    readonly policyId: number;
    readonly policyVersion: string;
    readonly questionSetSnapshotId: number;
    readonly questionSetSnapshotVersion: string;
  };
  readonly policy: HiringPolicySnapshot;
  readonly questionSet: {
    readonly sourceQuestionSetId: number;
    readonly jobRole: string;
    readonly mode: HiringQuestionSetMode;
    readonly questionCount: number;
    readonly maxFollowUpCount: number;
    readonly questions: readonly HiringEvaluationContextQuestion[];
  };
  readonly talentRubric: TalentRubricSnapshot;
}

export interface HiringAnswerTurnInput {
  readonly turnId: string;
  readonly answerId: number;
  readonly kind: "PRIMARY" | "FOLLOW_UP";
  readonly transcript: string;
}

export interface HiringAnswerEvaluationInput {
  readonly contractVersion: typeof HIRING_ANSWER_EVALUATION_CONTRACT_VERSION;
  readonly context: HiringEvaluationContextSnapshot;
  readonly candidateId: number;
  readonly sessionId: number;
  readonly questionId: number;
  readonly followUpsUsed: number;
  readonly turns: readonly HiringAnswerTurnInput[];
}

export interface HiringTranscriptTurnRange {
  readonly turnId: string;
  readonly answerId: number;
  readonly kind: HiringAnswerTurnInput["kind"];
  readonly startChar: number;
  readonly endChar: number;
}

export interface HiringTalentEvidence {
  readonly evidenceId: string;
  readonly criterionId: string;
  readonly evidenceTypes: readonly TalentEvidenceType[];
  readonly disposition: "SUPPORTING" | "CONTRADICTING";
  readonly quote: string;
  readonly startChar: number;
  readonly endChar: number;
  readonly turnId: string;
  readonly turnKind: HiringAnswerTurnInput["kind"];
}

export type HiringTalentEvaluationStatus =
  | "INSUFFICIENT_EVIDENCE"
  | "NOT_DEMONSTRATED"
  | "LIMITED"
  | "DEVELOPING"
  | "DEMONSTRATED"
  | "STRONGLY_DEMONSTRATED";

export interface HiringTalentCriterionEvaluation {
  readonly criterionId: string;
  readonly criterionName: string;
  readonly weight: number;
  readonly relevance: "DIRECT" | "NOT_OBSERVED";
  readonly status: HiringTalentEvaluationStatus;
  readonly level: TalentRubricAnchorLevel | null;
  readonly score: 25 | 50 | 70 | 85 | 100 | null;
  readonly anchorLabel: string | null;
  readonly anchorDescription: string | null;
  readonly rationale: string;
  readonly supportingEvidenceIds: readonly string[];
  readonly contradictingEvidenceIds: readonly string[];
  readonly missingEvidence: readonly TalentEvidenceType[];
  readonly confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface HiringTalentEvaluationOutput {
  readonly rubricVersion: string;
  readonly sourceHash: string;
  readonly evidences: readonly HiringTalentEvidence[];
  readonly criterionEvaluations: readonly HiringTalentCriterionEvaluation[];
  readonly coverage: {
    readonly assessableCriterionCount: number;
    readonly evaluatedCriterionCount: number;
    readonly evaluatedWeight: number;
    readonly totalWeight: 100;
    readonly ratio: number;
  };
  readonly followUp: {
    readonly required: boolean;
    readonly criterionIds: readonly string[];
    readonly missingEvidence: readonly TalentEvidenceType[];
    readonly suggestedQuestion: string | null;
  };
}

export interface HiringAnswerEvaluationOutput {
  readonly contractVersion: typeof HIRING_ANSWER_EVALUATION_CONTRACT_VERSION;
  readonly contextVersion: string;
  readonly contextHash: string;
  readonly answerRevisionHash: string;
  readonly cohortId: number;
  readonly candidateId: number;
  readonly sessionId: number;
  readonly questionId: number;
  readonly primaryAnswerId: number;
  readonly transcriptHash: string;
  readonly transcriptTurns: readonly HiringTranscriptTurnRange[];
  readonly jobEvaluation: NcsEvaluationProductOutput;
  readonly talentEvaluation: HiringTalentEvaluationOutput;
  readonly guardrail: NcsEvaluationProductOutput["guardrail"];
  readonly metadata: {
    readonly evaluatorVersion: "hiring-dual-evaluator.v1";
    readonly jobStrategyVersion: string;
    readonly talentStrategyVersion: "talent-evidence-state.v1";
  };
}

export type HiringEvaluationContextHashInput = Omit<
  HiringEvaluationContextSnapshot,
  "contextVersion" | "contextHash"
>;
