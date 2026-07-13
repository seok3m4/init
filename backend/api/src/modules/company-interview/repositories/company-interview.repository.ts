import {
  CriterionTagRecord,
  EvaluationCriterionRecord,
  HiringDecisionMode,
  HiringPolicySnapshot,
  HiringQuestionSetMode,
  HiringQuestionSetSnapshotJson,
  HiringSimulationConfigurationRecord,
  PostingRecord,
  QuestionRecord,
  QuestionSetRecord,
  QuestionType,
  TimePolicyRecord,
} from '../company-interview.types';

export const COMPANY_INTERVIEW_REPOSITORY = Symbol(
  'COMPANY_INTERVIEW_REPOSITORY',
);

export class HiringQuestionSetChangedError extends Error {
  constructor() {
    super('The source question set changed before the simulation was saved.');
    this.name = 'HiringQuestionSetChangedError';
  }
}

export class HiringSimulationRequestKeyConflictError extends Error {
  constructor() {
    super('The request key is already associated with different input.');
    this.name = 'HiringSimulationRequestKeyConflictError';
  }
}

export type UpdateCriterionInput = {
  criterionId?: number;
  tagId: number;
  weight: number;
  passScore?: number | null;
  sortOrder: number;
};

export type CreateQuestionInput = {
  companyId: number;
  postingId: number;
  criterionId: number;
  questionType: QuestionType;
  content: string;
};

export type UpdateQuestionInput = {
  criterionId: number;
  questionType: QuestionType;
  content: string;
};

export type UpdateTimePolicyInput = {
  preparationTimeSec: number;
  answerTimeSec: number;
  retryAllowed: boolean;
};

export type ConfirmQuestionSetInput = {
  postingId: number;
  title: string;
  sourceProcessLogId?: number;
  items: Array<{
    questionId: number;
    criterionId?: number | null;
    sortOrder: number;
  }>;
};

export type CreateHiringSimulationConfigurationInput = {
  policy: {
    postingId: number;
    createdByUserId: number;
    policyVersion: string;
    decisionMode: HiringDecisionMode;
    jobWeightPercent: number;
    talentWeightPercent: number;
    minimumJobScore: number;
    minimumTalentScore: number;
    minimumEvidenceCoveragePercent: number;
    snapshotJson: HiringPolicySnapshot;
  };
  questionSetSnapshot: {
    companyId: number;
    postingId: number;
    sourceQuestionSetId: number;
    expectedQuestionIds: number[];
    snapshotVersion: string;
    jobRole: string;
    mode: HiringQuestionSetMode;
    questionCount: number;
    maxFollowUpCount: number;
    snapshotJson: HiringQuestionSetSnapshotJson;
  };
  cohort: {
    companyId: number;
    postingId: number;
    createdByUserId: number;
    requestKey: string;
    configurationHash: string;
    title: string;
    jobRole: string;
    capacity: number;
  };
};

export interface CompanyInterviewRepository {
  findPosting(postingId: number): Promise<PostingRecord | undefined>;
  findDefaultPosting(companyId: number): Promise<PostingRecord | undefined>;
  listCriteria(postingId: number): Promise<EvaluationCriterionRecord[]>;
  findCriterion(criterionId: number): Promise<EvaluationCriterionRecord | undefined>;
  listQuestions(postingId: number): Promise<QuestionRecord[]>;
  findQuestion(questionId: number): Promise<QuestionRecord | undefined>;
  findDuplicateQuestion(
    postingId: number,
    content: string,
  ): Promise<QuestionRecord | undefined>;
  listTags(): Promise<CriterionTagRecord[]>;
  findTag(tagId: number): Promise<CriterionTagRecord | undefined>;
  getTimePolicy(postingId: number): Promise<TimePolicyRecord>;
  replaceCriteria(
    postingId: number,
    criteria: UpdateCriterionInput[],
  ): Promise<EvaluationCriterionRecord[]>;
  createQuestion(input: CreateQuestionInput): Promise<QuestionRecord>;
  updateQuestion(questionId: number, input: UpdateQuestionInput): Promise<QuestionRecord>;
  deactivateQuestion(questionId: number): Promise<QuestionRecord>;
  updateTimePolicy(
    postingId: number,
    input: UpdateTimePolicyInput,
  ): Promise<TimePolicyRecord>;
  confirmQuestionSet(input: ConfirmQuestionSetInput): Promise<QuestionSetRecord>;
  findQuestionSet(questionSetId: number): Promise<QuestionSetRecord | undefined>;
  findActiveQuestionSet(postingId: number): Promise<QuestionSetRecord | undefined>;
  createHiringSimulationConfiguration(
    input: CreateHiringSimulationConfigurationInput,
  ): Promise<HiringSimulationConfigurationRecord>;
  findHiringSimulationConfiguration(
    cohortId: number,
  ): Promise<HiringSimulationConfigurationRecord | undefined>;
  findHiringSimulationConfigurationByRequestKey(
    createdByUserId: number,
    requestKey: string,
  ): Promise<HiringSimulationConfigurationRecord | undefined>;
}
