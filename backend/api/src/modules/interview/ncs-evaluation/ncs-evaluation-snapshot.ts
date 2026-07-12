import type { InterviewQuestion } from "../interview.runtime.types";

export const NCS_EVALUATION_PRODUCT_CONTRACT_VERSION = "ncs-evaluation-product.v1" as const;

export const NCS_EVALUATION_SCORE_MAP = {
  1: 25,
  2: 50,
  3: 70,
  4: 85,
  5: 100,
} as const;

export type NcsEvaluationQuestionType = "EXPERIENCE" | "SITUATION" | "FOLLOW_UP";

export type NcsEvaluationEvidenceType =
  | "SITUATION"
  | "TASK"
  | "ACTION"
  | "RATIONALE"
  | "RESULT"
  | "REFLECTION"
  | "KNOWLEDGE"
  | "CONSTRAINT"
  | "TRADEOFF";

export interface NcsEvaluationSnapshot {
  contractVersion: typeof NCS_EVALUATION_PRODUCT_CONTRACT_VERSION;
  snapshotVersion: string;
  locale: "ko-KR";
  question: {
    questionId: string;
    questionType: NcsEvaluationQuestionType;
    content: string;
  };
  ncsContext: {
    sourceKind: "OFFICIAL_NCS" | "SYNTHETIC_NCS_LIKE";
    version: string;
    categoryType: "OCCUPATIONAL_BASIC" | "JOB_PERFORMANCE";
    unit: {
      code: string;
      name: string;
      level: number | null;
      definition: string;
      elements: Array<{
        elementCode: string;
        name: string;
      }>;
    };
  };
  behaviorPoints: Array<{
    behaviorPointId: string;
    description: string;
    sourceElementCodes: string[];
    observability: "INTERVIEW";
    requiredEvidence: NcsEvaluationEvidenceType[];
  }>;
  evaluationPolicy: {
    scoreMap: Record<"1" | "2" | "3" | "4" | "5", number>;
    minimumSupportingEvidence: number;
    insufficientEvidenceScore: null;
    allowSensitiveAttributes: false;
    allowNonverbalScore: false;
  };
}

export interface NcsEvaluationSnapshotResolver {
  resolve(question: InterviewQuestion): NcsEvaluationSnapshot | undefined;
}

export const NCS_EVALUATION_SNAPSHOT_RESOLVER = Symbol("NCS_EVALUATION_SNAPSHOT_RESOLVER");
