import type { NcsEvaluationSnapshot } from '../interview/ncs-evaluation/ncs-evaluation-snapshot';

export type PostingStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'CLOSING_SOON'
  | 'CLOSED'
  | 'ARCHIVED';

export type QuestionType =
  | 'INTRO'
  | 'TECHNICAL'
  | 'EXPERIENCE'
  | 'SITUATION'
  | 'FOLLOW_UP'
  | 'CLOSING';

export const QUESTION_TYPES: QuestionType[] = [
  'INTRO',
  'TECHNICAL',
  'EXPERIENCE',
  'SITUATION',
  'FOLLOW_UP',
  'CLOSING',
];

export type AiProcessStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export const HIRING_DECISION_MODES = [
  'ABSOLUTE',
  'RELATIVE',
  'HYBRID',
] as const;
export type HiringDecisionMode = (typeof HIRING_DECISION_MODES)[number];

export const HIRING_QUESTION_SET_MODES = [
  'QUICK',
  'STANDARD',
  'DEEP',
  'CUSTOM',
] as const;
export type HiringQuestionSetMode = (typeof HIRING_QUESTION_SET_MODES)[number];

export type HiringCohortStatus = 'OPEN' | 'LOCKED' | 'EVALUATED' | 'FINALIZED';
export type HiringTieBreakMode = 'WEIGHT_ORDER';
export type HiringEvaluationTrack = 'JOB' | 'TALENT';

export type HiringTieBreakStep = {
  field:
    | 'WEIGHTED_TOTAL_SCORE'
    | 'PRIMARY_TRACK_SCORE'
    | 'PRIMARY_TRACK_DETAIL_WEIGHT_ORDER'
    | 'EVIDENCE_COVERAGE_PERCENT';
  direction: 'DESC';
  track?: HiringEvaluationTrack;
};

export type HiringPolicySnapshot = {
  schemaVersion: 'hiring-evaluation-policy.v1';
  administratorInput: {
    postingId: number;
    decisionMode: HiringDecisionMode;
    jobWeightPercent: number;
    talentWeightPercent: number;
    minimumJobScore: number;
    minimumTalentScore: number;
    minimumEvidenceCoveragePercent: number;
  };
  tieBreakOrder: HiringTieBreakStep[];
};

export type HiringQuestionSnapshotItem = {
  questionId: number;
  order: number;
  questionType: QuestionType;
  content: string;
  criterionId: number | null;
};

export type HiringQuestionSetSnapshotJson = {
  schemaVersion: 'hiring-question-set-configuration.v1';
  postingId: number;
  sourceQuestionSetId: number;
  jobRole: string;
  mode: HiringQuestionSetMode;
  questionCount: number;
  maxFollowUpCount: number;
  questions: HiringQuestionSnapshotItem[];
};

export type TalentRubricSnapshotJson = {
  contractVersion: 'talent-rubric-snapshot.v1';
  rubricVersion: string;
  sourceHash: string;
  criteria: Array<{
    id: string;
    name: string;
    definition: string;
    weight: number;
    behaviorIndicators: Array<{
      id: string;
      evidenceType: 'ACTION' | 'RATIONALE' | 'RESULT' | 'REFLECTION';
      observability: 'ANSWER_TRANSCRIPT';
      description: string;
    }>;
    requiredEvidence: Array<'ACTION' | 'RATIONALE' | 'RESULT' | 'REFLECTION'>;
    scoringAnchors: Array<{
      level: 1 | 2 | 3 | 4 | 5;
      evidenceStrength: 1 | 2 | 3 | 4 | 5;
      label: string;
      description: string;
    }>;
  }>;
  evidencePolicy: {
    source: 'ANSWER_TRANSCRIPT';
    requiredEvidenceRule: 'ALL_REQUIRED';
    missingRequiredEvidenceStatus: 'INSUFFICIENT_EVIDENCE';
    insufficientEvidenceScore: null;
  };
  prohibitedSignals: Array<{
    category: 'SENSITIVE_ATTRIBUTE' | 'NONVERBAL_SIGNAL';
    signals: string[];
    detectedInSource: string[];
    disposition: 'EXCLUDE_FROM_SCORING';
  }>;
};

export type HiringEvaluationContextSnapshotJson = {
  schemaVersion: 'hiring-evaluation-context.v1';
  contextVersion: string;
  contextHash: string;
  calculationContractVersion: 'hiring-evaluation.v1';
  cohort: {
    cohortId: number;
    companyId: number;
    postingId: number;
    configurationHash: string;
  };
  sourceConfiguration: {
    policyId: number;
    policyVersion: string;
    questionSetSnapshotId: number;
    questionSetSnapshotVersion: string;
  };
  policy: HiringPolicySnapshot;
  questionSet: {
    sourceQuestionSetId: number;
    jobRole: string;
    mode: HiringQuestionSetMode;
    questionCount: number;
    maxFollowUpCount: number;
    questions: Array<HiringQuestionSnapshotItem & {
      questionType: 'TECHNICAL' | 'EXPERIENCE' | 'SITUATION';
      ncsEvaluationSnapshot: NcsEvaluationSnapshot;
    }>;
  };
  talentRubric: TalentRubricSnapshotJson;
};

export type PostingRecord = {
  postingId: number;
  companyId: number;
  title: string;
  status: PostingStatus;
  jobRole: string;
  jobDescription: string | null;
};

export type CriterionTagRecord = {
  tagId: number;
  jobRole: string;
  name: string;
  description: string | null;
  category: string;
  isActive: boolean;
  sortOrder: number;
};

export type EvaluationCriterionRecord = {
  criterionId: number;
  postingId: number;
  tagId: number;
  weight: number;
  passScore: number | null;
  sortOrder: number;
};

export type QuestionRecord = {
  questionId: number;
  companyId: number;
  postingId: number | null;
  criterionId: number | null;
  questionType: QuestionType;
  content: string;
  isActive: boolean;
};

export type TimePolicyRecord = {
  postingId: number;
  preparationTimeSec: number;
  answerTimeSec: number;
  retryAllowed: boolean;
};

export type QuestionSetItemRecord = {
  questionSetItemId: number;
  questionId: number;
  criterionId: number | null;
  sortOrder: number;
  question?: QuestionRecord;
};

export type QuestionSetRecord = {
  questionSetId: number;
  postingId: number;
  title: string;
  status: string;
  createdByProcessLogId: number | null;
  items: QuestionSetItemRecord[];
};

export type HiringEvaluationPolicyRecord = {
  policyId: number;
  postingId: number;
  createdByUserId: number;
  policyVersion: string;
  decisionMode: HiringDecisionMode;
  jobWeightPercent: number;
  talentWeightPercent: number;
  minimumJobScore: number;
  minimumTalentScore: number;
  minimumEvidenceCoveragePercent: number;
  tieBreakMode: HiringTieBreakMode;
  snapshotJson: HiringPolicySnapshot;
  createdAt: Date;
};

export type HiringQuestionSetSnapshotRecord = {
  questionSetSnapshotId: number;
  postingId: number;
  sourceQuestionSetId: number;
  snapshotVersion: string;
  jobRole: string;
  mode: HiringQuestionSetMode;
  questionCount: number;
  maxFollowUpCount: number;
  snapshotJson:
    | HiringQuestionSetSnapshotJson
    | HiringEvaluationContextSnapshotJson;
  createdAt: Date;
};

export type HiringEvaluationCohortRecord = {
  cohortId: number;
  companyId: number;
  postingId: number;
  policyId: number;
  questionSetSnapshotId: number;
  createdByUserId: number;
  requestKey: string;
  configurationHash: string;
  title: string;
  jobRole: string;
  status: HiringCohortStatus;
  capacity: number;
  openedAt: Date;
  lockedAt?: Date | null;
  createdAt: Date;
};

export type HiringSimulationConfigurationRecord = {
  cohort: HiringEvaluationCohortRecord;
  policy: HiringEvaluationPolicyRecord;
  questionSetSnapshot: HiringQuestionSetSnapshotRecord;
};
