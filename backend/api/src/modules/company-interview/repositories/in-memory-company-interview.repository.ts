import { Injectable } from '@nestjs/common';
import {
  CriterionTagRecord,
  EvaluationCriterionRecord,
  PostingRecord,
  QuestionRecord,
  QuestionType,
  TimePolicyRecord,
} from '../company-interview.types';
import {
  CompanyInterviewRepository,
  UpdateCriterionInput,
} from './company-interview.repository';

@Injectable()
export class InMemoryCompanyInterviewRepository
  implements CompanyInterviewRepository
{
  // Temporary C-owned adapter until Prisma schema/migrations are agreed.
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
  private nextProcessLogId = 1_000;

  findPosting(postingId: number): PostingRecord | undefined {
    return this.postings.find((posting) => posting.postingId === postingId);
  }

  findDefaultPosting(companyId: number): PostingRecord | undefined {
    return this.postings.find((posting) => posting.companyId === companyId);
  }

  listCriteria(postingId: number): EvaluationCriterionRecord[] {
    return this.evaluationCriteria
      .filter((criterion) => criterion.postingId === postingId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  findCriterion(criterionId: number): EvaluationCriterionRecord | undefined {
    return this.evaluationCriteria.find(
      (criterion) => criterion.criterionId === criterionId,
    );
  }

  listQuestions(postingId: number): QuestionRecord[] {
    return this.questions
      .filter((question) => question.postingId === postingId)
      .sort((a, b) => a.questionId - b.questionId);
  }

  findTag(tagId: number): CriterionTagRecord | undefined {
    return this.criterionTags.find(
      (tag) => tag.tagId === tagId && tag.isActive,
    );
  }

  getTimePolicy(postingId: number): TimePolicyRecord {
    return (
      this.timePolicies.find((policy) => policy.postingId === postingId) ?? {
        postingId,
        preparationTimeSec: 60,
        answerTimeSec: 180,
        retryAllowed: false,
      }
    );
  }

  replaceCriteria(
    postingId: number,
    criteria: UpdateCriterionInput[],
  ): EvaluationCriterionRecord[] {
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

  createPendingProcessLog(): { processLogId: number; status: 'PENDING' } {
    return {
      processLogId: this.nextProcessLogId++,
      status: 'PENDING',
    };
  }
}
