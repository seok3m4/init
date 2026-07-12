export const NCS_EVALUATION_CONTRACT_VERSION = "ncs-evaluation-m0.v1" as const;

export const NCS_SCORE_MAP = {
  1: 25,
  2: 50,
  3: 70,
  4: 85,
  5: 100,
} as const;

export type NcsEvaluationStatus =
  | "INSUFFICIENT_EVIDENCE"
  | "NOT_DEMONSTRATED"
  | "LIMITED"
  | "DEVELOPING"
  | "DEMONSTRATED"
  | "STRONGLY_DEMONSTRATED";

export type NcsEvidenceType =
  | "SITUATION"
  | "TASK"
  | "ACTION"
  | "RATIONALE"
  | "RESULT"
  | "REFLECTION"
  | "KNOWLEDGE"
  | "CONSTRAINT"
  | "TRADEOFF";

export type NcsClaimType = NcsEvidenceType | "CONTRADICTION";
export type NcsEvaluationConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface NcsQuestionInput {
  questionId: string;
  questionType: "EXPERIENCE" | "SITUATION" | "FOLLOW_UP";
  content: string;
}

export interface NcsAnswerInput {
  answerId: string;
  transcript: string;
}

export interface NcsUnitElement {
  elementCode: string;
  name: string;
}

export interface NcsEvaluationContext {
  sourceKind: "OFFICIAL_NCS" | "SYNTHETIC_NCS_LIKE";
  version: string;
  categoryType: "OCCUPATIONAL_BASIC" | "JOB_PERFORMANCE";
  unit: {
    code: string;
    name: string;
    level: number | null;
    definition: string;
    elements: NcsUnitElement[];
  };
}

export interface NcsBehaviorPoint {
  behaviorPointId: string;
  description: string;
  sourceElementCodes: string[];
  observability: "INTERVIEW";
  requiredEvidence: NcsEvidenceType[];
}

export interface NcsEvaluationInput {
  contractVersion: typeof NCS_EVALUATION_CONTRACT_VERSION;
  caseId: string;
  locale: "ko-KR";
  question: NcsQuestionInput;
  answer: NcsAnswerInput;
  ncsContext: NcsEvaluationContext;
  behaviorPoints: NcsBehaviorPoint[];
  interviewContext: {
    attemptNumber: number;
    maxFollowUps: number;
    followUpsUsed: number;
  };
  evaluationPolicy: {
    scoreMap: Record<"1" | "2" | "3" | "4" | "5", number>;
    minimumSupportingEvidence: number;
    insufficientEvidenceScore: null;
    allowSensitiveAttributes: false;
    allowNonverbalScore: false;
  };
}

export interface NcsEvidence {
  evidenceId: string;
  source: "ANSWER_TRANSCRIPT";
  quote: string;
  startChar: number;
  endChar: number;
  claimType: NcsClaimType;
  behaviorPointIds: string[];
}

export interface NcsBehaviorEvaluation {
  behaviorPointId: string;
  status: NcsEvaluationStatus;
  level: 1 | 2 | 3 | 4 | 5 | null;
  score: 25 | 50 | 70 | 85 | 100 | null;
  rationale: string;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  missingEvidence: NcsEvidenceType[];
  confidence: NcsEvaluationConfidence;
}

export interface NcsEvaluationOutput {
  contractVersion: typeof NCS_EVALUATION_CONTRACT_VERSION;
  caseId: string;
  evidences: NcsEvidence[];
  behaviorEvaluations: NcsBehaviorEvaluation[];
  coverage: {
    assessableBehaviorPointCount: number;
    evaluatedBehaviorPointCount: number;
    ratio: number;
    status: "SUFFICIENT" | "LOW" | "INSUFFICIENT";
  };
  followUp: {
    required: boolean;
    reason: string | null;
    missingEvidence: NcsEvidenceType[];
    suggestedQuestion: string | null;
  };
  guardrail: {
    unsupportedFactDetected: boolean;
    sensitiveAttributeUsed: boolean;
    nonverbalSignalUsed: boolean;
    hiringDecisionLanguageDetected: boolean;
  };
  metadata: {
    strategyId: string;
    promptVersion: string;
    model: string;
  };
}

export interface NcsGoldenExpectedBehavior {
  behaviorPointId: string;
  status: NcsEvaluationStatus;
  level: 1 | 2 | 3 | 4 | 5 | null;
  score: 25 | 50 | 70 | 85 | 100 | null;
  mustQuote: string[];
  missingEvidence: NcsEvidenceType[];
}

export interface NcsGoldenContext {
  contextId: string;
  locale: "ko-KR";
  question: NcsQuestionInput;
  ncsContext: NcsEvaluationContext;
  behaviorPoints: NcsBehaviorPoint[];
}

export interface NcsGoldenCase {
  caseId: string;
  contextId: string;
  tags: string[];
  answer: NcsAnswerInput;
  interviewContext: NcsEvaluationInput["interviewContext"];
  expected: {
    behaviorPoints: NcsGoldenExpectedBehavior[];
    followUpRequired: boolean;
  };
}

export interface NcsGoldenRelation {
  relationId: string;
  type: "SAME_LEVEL" | "HIGHER_THAN";
  leftCaseId: string;
  rightCaseId: string;
  behaviorPointId: string;
  reason: string;
}

export interface NcsGoldenDataset {
  datasetVersion: "ncs-evaluation-golden.v1";
  contractVersion: typeof NCS_EVALUATION_CONTRACT_VERSION;
  description: string;
  scoreMap: NcsEvaluationInput["evaluationPolicy"]["scoreMap"];
  defaultEvaluationPolicy: NcsEvaluationInput["evaluationPolicy"];
  contexts: NcsGoldenContext[];
  cases: NcsGoldenCase[];
  relations: NcsGoldenRelation[];
}

export interface NcsEvaluationStrategy {
  strategyId: string;
  promptVersion: string;
  model: string;
  evaluate(input: NcsEvaluationInput): Promise<NcsEvaluationOutput> | NcsEvaluationOutput;
}

export interface NcsStrategyRun {
  caseId: string;
  runNumber: number;
  latencyMs: number;
  estimatedCostUsd: number;
  output: NcsEvaluationOutput;
}

export interface NcsStrategyResults {
  contractVersion: typeof NCS_EVALUATION_CONTRACT_VERSION;
  strategyId: string;
  runs: NcsStrategyRun[];
}
