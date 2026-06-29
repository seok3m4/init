import {
  CriterionTagRecord,
  EvaluationCriterionRecord,
  PostingRecord,
  QuestionRecord,
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

export interface CompanyInterviewRepository {
  findPosting(postingId: number): Promise<PostingRecord | undefined>;
  findDefaultPosting(companyId: number): Promise<PostingRecord | undefined>;
  listCriteria(postingId: number): Promise<EvaluationCriterionRecord[]>;
  findCriterion(criterionId: number): Promise<EvaluationCriterionRecord | undefined>;
  listQuestions(postingId: number): Promise<QuestionRecord[]>;
  findTag(tagId: number): Promise<CriterionTagRecord | undefined>;
  getTimePolicy(postingId: number): Promise<TimePolicyRecord>;
  replaceCriteria(
    postingId: number,
    criteria: UpdateCriterionInput[],
  ): Promise<EvaluationCriterionRecord[]>;
  createPendingProcessLog(input?: {
    postingId?: number;
    inputRef?: string;
  }): Promise<PendingProcessLog>;
}
