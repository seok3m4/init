import {
  CriterionTagRecord,
  EvaluationCriterionRecord,
  PostingRecord,
  QuestionRecord,
  QuestionType,
  TimePolicyRecord,
} from '../company-interview.types';

export const COMPANY_INTERVIEW_REPOSITORY = Symbol(
  'COMPANY_INTERVIEW_REPOSITORY',
);

export type UpdateCriterionInput = {
  criterionId?: number;
  tagId: number;
  weight: number;
  passScore?: number | null;
  sortOrder: number;
};

export type PendingProcessLog = {
  processLogId: number;
  status: 'PENDING';
};

export type CreateQuestionInput = {
  companyId: number;
  postingId: number;
  criterionId: number;
  questionType: QuestionType;
  content: string;
};

export type UpdateTimePolicyInput = {
  preparationTimeSec: number;
  answerTimeSec: number;
  retryAllowed: boolean;
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
  updateTimePolicy(
    postingId: number,
    input: UpdateTimePolicyInput,
  ): Promise<TimePolicyRecord>;
  createPendingProcessLog(input?: {
    postingId?: number;
    inputRef?: string;
  }): Promise<PendingProcessLog>;
}
