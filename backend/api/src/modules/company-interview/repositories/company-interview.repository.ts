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
  findPosting(postingId: number): PostingRecord | undefined;
  findDefaultPosting(companyId: number): PostingRecord | undefined;
  listCriteria(postingId: number): EvaluationCriterionRecord[];
  findCriterion(criterionId: number): EvaluationCriterionRecord | undefined;
  listQuestions(postingId: number): QuestionRecord[];
  findTag(tagId: number): CriterionTagRecord | undefined;
  getTimePolicy(postingId: number): TimePolicyRecord;
  replaceCriteria(
    postingId: number,
    criteria: UpdateCriterionInput[],
  ): EvaluationCriterionRecord[];
  createPendingProcessLog(): PendingProcessLog;
}
