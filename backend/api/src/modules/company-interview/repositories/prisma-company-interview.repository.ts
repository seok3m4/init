import { Injectable } from '@nestjs/common';
import { AiProcessType, type QuestionType } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma.service';
import {
  CriterionTagRecord,
  EvaluationCriterionRecord,
  PostingRecord,
  QuestionRecord,
  TimePolicyRecord,
} from '../company-interview.types';
import {
  CompanyInterviewRepository,
  UpdateTimePolicyInput,
  PendingProcessLog,
  UpdateCriterionInput,
} from './company-interview.repository';

@Injectable()
export class PrismaCompanyInterviewRepository
  implements CompanyInterviewRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findPosting(postingId: number): Promise<PostingRecord | undefined> {
    const posting = await this.prisma.posting.findUnique({
      where: { postingId: BigInt(postingId) },
    });
    return posting ? mapPosting(posting) : undefined;
  }

  async findDefaultPosting(companyId: number): Promise<PostingRecord | undefined> {
    const posting = await this.prisma.posting.findFirst({
      where: { companyId: BigInt(companyId) },
      orderBy: { postingId: 'desc' },
    });
    return posting ? mapPosting(posting) : undefined;
  }

  async listCriteria(postingId: number): Promise<EvaluationCriterionRecord[]> {
    const criteria = await this.prisma.evaluationCriterion.findMany({
      where: { postingId: BigInt(postingId) },
      orderBy: { sortOrder: 'asc' },
    });
    return criteria.map(mapCriterion);
  }

  async findCriterion(
    criterionId: number,
  ): Promise<EvaluationCriterionRecord | undefined> {
    const criterion = await this.prisma.evaluationCriterion.findUnique({
      where: { criterionId: BigInt(criterionId) },
    });
    return criterion ? mapCriterion(criterion) : undefined;
  }

  async listQuestions(postingId: number): Promise<QuestionRecord[]> {
    const questions = await this.prisma.question.findMany({
      where: { postingId: BigInt(postingId) },
      orderBy: { questionId: 'asc' },
    });
    return questions.map(mapQuestion);
  }

  async findQuestion(questionId: number): Promise<QuestionRecord | undefined> {
    const question = await this.prisma.question.findUnique({
      where: { questionId: BigInt(questionId) },
    });
    return question ? mapQuestion(question) : undefined;
  }

  async findDuplicateQuestion(
    postingId: number,
    content: string,
  ): Promise<QuestionRecord | undefined> {
    const normalized = normalizeQuestionContent(content);
    const questions = await this.prisma.question.findMany({
      where: { postingId: BigInt(postingId), isActive: true },
    });
    const duplicate = questions.find(
      (question) => normalizeQuestionContent(question.content) === normalized,
    );
    return duplicate ? mapQuestion(duplicate) : undefined;
  }

  async listTags(): Promise<CriterionTagRecord[]> {
    const tags = await this.prisma.criterionTag.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { tagId: 'asc' }],
    });
    return tags.map(mapTag);
  }

  async findTag(tagId: number): Promise<CriterionTagRecord | undefined> {
    const tag = await this.prisma.criterionTag.findFirst({
      where: { tagId: BigInt(tagId), isActive: true },
    });
    return tag ? mapTag(tag) : undefined;
  }

  async getTimePolicy(postingId: number): Promise<TimePolicyRecord> {
    return {
      postingId,
      preparationTimeSec: 60,
      answerTimeSec: 180,
      retryAllowed: false,
    };
  }

  async replaceCriteria(
    postingId: number,
    criteria: UpdateCriterionInput[],
  ): Promise<EvaluationCriterionRecord[]> {
    const savedIds = await this.prisma.$transaction(async (tx) => {
      const nextIds: bigint[] = [];

      for (const criterion of criteria) {
        if (criterion.criterionId !== undefined) {
          const updated = await tx.evaluationCriterion.update({
            where: { criterionId: BigInt(criterion.criterionId) },
            data: {
              tagId: BigInt(criterion.tagId),
              weight: criterion.weight,
              passScore: criterion.passScore ?? null,
              sortOrder: criterion.sortOrder,
            },
          });
          nextIds.push(updated.criterionId);
          continue;
        }

        const created = await tx.evaluationCriterion.create({
          data: {
            postingId: BigInt(postingId),
            tagId: BigInt(criterion.tagId),
            weight: criterion.weight,
            passScore: criterion.passScore ?? null,
            sortOrder: criterion.sortOrder,
          },
        });
        nextIds.push(created.criterionId);
      }

      await tx.evaluationCriterion.deleteMany({
        where: {
          postingId: BigInt(postingId),
          criterionId: { notIn: nextIds },
        },
      });

      return nextIds;
    });

    const saved = await this.prisma.evaluationCriterion.findMany({
      where: { criterionId: { in: savedIds } },
      orderBy: { sortOrder: 'asc' },
    });
    return saved.map(mapCriterion);
  }

  async createQuestion(input: {
    companyId: number;
    postingId: number;
    criterionId: number;
    questionType: QuestionType;
    content: string;
  }): Promise<QuestionRecord> {
    const question = await this.prisma.question.create({
      data: {
        companyId: BigInt(input.companyId),
        postingId: BigInt(input.postingId),
        criterionId: BigInt(input.criterionId),
        questionType: input.questionType,
        content: input.content.trim(),
        isActive: true,
      },
    });
    return mapQuestion(question);
  }

  async updateTimePolicy(
    postingId: number,
    input: UpdateTimePolicyInput,
  ): Promise<TimePolicyRecord> {
    return {
      postingId,
      preparationTimeSec: input.preparationTimeSec,
      answerTimeSec: input.answerTimeSec,
      retryAllowed: input.retryAllowed,
    };
  }

  async createPendingProcessLog(input?: {
    postingId?: number;
    inputRef?: string;
  }): Promise<PendingProcessLog> {
    const log = await this.prisma.aiProcessLog.create({
      data: {
        processType: AiProcessType.CRITERIA_SUGGEST,
        status: 'PENDING',
        inputRef: input?.inputRef ?? null,
      },
    });
    return {
      processLogId: Number(log.processLogId),
      status: 'PENDING',
    };
  }
}

function normalizeQuestionContent(content: string): string {
  return content.trim().replace(/\s+/g, ' ').toLowerCase();
}

function mapPosting(posting: {
  postingId: bigint;
  companyId: bigint;
  title: string;
  status: string;
  jobRole: string;
  jobDescription: string | null;
}): PostingRecord {
  return {
    postingId: Number(posting.postingId),
    companyId: Number(posting.companyId),
    title: posting.title,
    status: posting.status as PostingRecord['status'],
    jobRole: posting.jobRole,
    jobDescription: posting.jobDescription,
  };
}

function mapTag(tag: {
  tagId: bigint;
  jobRole: string;
  name: string;
  description: string | null;
  category: string;
  isActive: boolean;
  sortOrder: number;
}): CriterionTagRecord {
  return {
    tagId: Number(tag.tagId),
    jobRole: tag.jobRole,
    name: tag.name,
    description: tag.description,
    category: tag.category,
    isActive: tag.isActive,
    sortOrder: tag.sortOrder,
  };
}

function mapCriterion(criterion: {
  criterionId: bigint;
  postingId: bigint;
  tagId: bigint;
  weight: number;
  passScore: number | null;
  sortOrder: number;
}): EvaluationCriterionRecord {
  return {
    criterionId: Number(criterion.criterionId),
    postingId: Number(criterion.postingId),
    tagId: Number(criterion.tagId),
    weight: criterion.weight,
    passScore: criterion.passScore,
    sortOrder: criterion.sortOrder,
  };
}

function mapQuestion(question: {
  questionId: bigint;
  companyId: bigint;
  postingId: bigint | null;
  criterionId: bigint | null;
  questionType: QuestionType;
  content: string;
  isActive: boolean;
}): QuestionRecord {
  return {
    questionId: Number(question.questionId),
    companyId: Number(question.companyId),
    postingId: question.postingId === null ? null : Number(question.postingId),
    criterionId:
      question.criterionId === null ? null : Number(question.criterionId),
    questionType: question.questionType,
    content: question.content,
    isActive: question.isActive,
  };
}
