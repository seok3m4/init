import { Injectable } from '@nestjs/common';
import {
  CriterionTagRecord,
  EvaluationCriterionRecord,
  PostingRecord,
  QuestionRecord,
  TimePolicyRecord,
} from '../company-interview.types';
import {
  CompanyInterviewRepository,
  CreateQuestionInput,
  UpdateCriterionInput,
} from './company-interview.repository';

@Injectable()
export class InMemoryCompanyInterviewRepository
  implements CompanyInterviewRepository
{
  private readonly postings: PostingRecord[] = [
    {
      postingId: 1,
      companyId: 1,
      title: '2026 신입 백엔드 채용',
      status: 'OPEN',
      jobRole: 'Backend Developer',
      jobDescription: 'NestJS와 PostgreSQL 기반 서비스 개발',
    },
  ];

  private readonly criterionTags: CriterionTagRecord[] = [
    {
      tagId: 1,
      jobRole: 'Backend Developer',
      name: 'API 설계',
      description: 'REST API 계약과 모듈 경계를 이해하고 설계하는 역량',
      category: '기술역량',
      isActive: true,
      sortOrder: 1,
    },
    {
      tagId: 2,
      jobRole: 'Backend Developer',
      name: 'DB 모델링',
      description: '데이터 모델과 트랜잭션 경계를 설계하는 역량',
      category: '기술역량',
      isActive: true,
      sortOrder: 2,
    },
    {
      tagId: 3,
      jobRole: 'Common',
      name: '협업 커뮤니케이션',
      description: '요구사항과 제약을 명확하게 공유하는 역량',
      category: '협업',
      isActive: true,
      sortOrder: 3,
    },
  ];

  private evaluationCriteria: EvaluationCriterionRecord[] = [
    {
      criterionId: 1,
      postingId: 1,
      tagId: 1,
      weight: 40,
      passScore: 70,
      sortOrder: 1,
    },
    {
      criterionId: 2,
      postingId: 1,
      tagId: 2,
      weight: 35,
      passScore: 65,
      sortOrder: 2,
    },
    {
      criterionId: 3,
      postingId: 1,
      tagId: 3,
      weight: 25,
      passScore: null,
      sortOrder: 3,
    },
  ];

  private questions: QuestionRecord[] = [
    {
      questionId: 1,
      companyId: 1,
      postingId: 1,
      criterionId: 1,
      questionType: 'TECHNICAL',
      content: 'REST API 계약을 먼저 문서화해야 하는 이유를 설명해주세요.',
      isActive: true,
    },
    {
      questionId: 2,
      companyId: 1,
      postingId: 1,
      criterionId: 2,
      questionType: 'TECHNICAL',
      content: '평가 기준과 질문 뱅크의 관계를 어떻게 모델링하시겠습니까?',
      isActive: true,
    },
    {
      questionId: 3,
      companyId: 1,
      postingId: 1,
      criterionId: 3,
      questionType: 'EXPERIENCE',
      content: '다른 담당자와 API 계약 충돌을 조정했던 경험을 말해주세요.',
      isActive: true,
    },
  ];

  private readonly timePolicies: TimePolicyRecord[] = [
    {
      postingId: 1,
      preparationTimeSec: 60,
      answerTimeSec: 180,
      retryAllowed: false,
    },
  ];

  private nextCriterionId = 4;
  private nextQuestionId = 4;
  private nextProcessLogId = 1_000;

  async findPosting(postingId: number): Promise<PostingRecord | undefined> {
    return this.postings.find((posting) => posting.postingId === postingId);
  }

  async findDefaultPosting(companyId: number): Promise<PostingRecord | undefined> {
    return this.postings.find((posting) => posting.companyId === companyId);
  }

  async listCriteria(postingId: number): Promise<EvaluationCriterionRecord[]> {
    return this.evaluationCriteria
      .filter((criterion) => criterion.postingId === postingId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async findCriterion(
    criterionId: number,
  ): Promise<EvaluationCriterionRecord | undefined> {
    return this.evaluationCriteria.find(
      (criterion) => criterion.criterionId === criterionId,
    );
  }

  async listQuestions(postingId: number): Promise<QuestionRecord[]> {
    return this.questions
      .filter((question) => question.postingId === postingId)
      .sort((a, b) => a.questionId - b.questionId);
  }

  async findQuestion(questionId: number): Promise<QuestionRecord | undefined> {
    return this.questions.find((question) => question.questionId === questionId);
  }

  async findDuplicateQuestion(
    postingId: number,
    content: string,
  ): Promise<QuestionRecord | undefined> {
    const normalized = content.trim().replace(/\s+/g, ' ').toLowerCase();
    return this.questions.find(
      (question) =>
        question.postingId === postingId &&
        question.isActive &&
        question.content.trim().replace(/\s+/g, ' ').toLowerCase() ===
          normalized,
    );
  }

  async findTag(tagId: number): Promise<CriterionTagRecord | undefined> {
    return this.criterionTags.find(
      (tag) => tag.tagId === tagId && tag.isActive,
    );
  }

  async getTimePolicy(postingId: number): Promise<TimePolicyRecord> {
    return (
      this.timePolicies.find((policy) => policy.postingId === postingId) ?? {
        postingId,
        preparationTimeSec: 60,
        answerTimeSec: 180,
        retryAllowed: false,
      }
    );
  }

  async replaceCriteria(
    postingId: number,
    criteria: UpdateCriterionInput[],
  ): Promise<EvaluationCriterionRecord[]> {
    const nextCriteria = criteria.map((criterion) => ({
      criterionId: criterion.criterionId ?? this.nextCriterionId++,
      postingId,
      tagId: criterion.tagId,
      weight: criterion.weight,
      passScore: criterion.passScore ?? null,
      sortOrder: criterion.sortOrder,
    }));

    this.evaluationCriteria = [
      ...this.evaluationCriteria.filter(
        (criterion) => criterion.postingId !== postingId,
      ),
      ...nextCriteria,
    ];

    return this.listCriteria(postingId);
  }

  async createQuestion(input: CreateQuestionInput): Promise<QuestionRecord> {
    const question: QuestionRecord = {
      questionId: this.nextQuestionId++,
      companyId: input.companyId,
      postingId: input.postingId,
      criterionId: input.criterionId,
      questionType: input.questionType,
      content: input.content.trim(),
      isActive: true,
    };

    this.questions = [...this.questions, question];
    return question;
  }

  async createPendingProcessLog(): Promise<{ processLogId: number; status: 'PENDING' }> {
    return {
      processLogId: this.nextProcessLogId++,
      status: 'PENDING',
    };
  }
}
