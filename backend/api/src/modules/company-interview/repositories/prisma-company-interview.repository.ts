import { Injectable } from '@nestjs/common';
import type { Prisma, QuestionType } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma.service';
import {
  CriterionTagRecord,
  EvaluationCriterionRecord,
  HiringEvaluationContextSnapshotJson,
  HiringPolicySnapshot,
  HiringQuestionSetSnapshotJson,
  HiringSimulationConfigurationRecord,
  PostingRecord,
  QuestionRecord,
  QuestionSetRecord,
  TimePolicyRecord,
} from '../company-interview.types';
import {
  CompanyInterviewRepository,
  ConfirmQuestionSetInput,
  CreateHiringSimulationConfigurationInput,
  HiringAnswerEvaluationSourceRecord,
  HiringEvaluationContextLockError,
  HiringQuestionSetChangedError,
  HiringSimulationRequestKeyConflictError,
  LockHiringEvaluationContextInput,
  UpdateTimePolicyInput,
  UpdateCriterionInput,
  UpdateQuestionInput,
} from './company-interview.repository';

const HIRING_SIMULATION_INCLUDE = {
  policy: true,
  questionSetSnapshot: true,
  posting: { select: { companyId: true } },
} satisfies Prisma.HiringEvaluationCohortInclude;

type HiringSimulationRow = Prisma.HiringEvaluationCohortGetPayload<{
  include: typeof HIRING_SIMULATION_INCLUDE;
}>;

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
      where: {
        postingId: BigInt(postingId),
        isActive: true,
        questionType: { not: 'FOLLOW_UP' },
      },
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
    const timePolicy = await this.prisma.interviewTimePolicy.findUnique({
      where: { postingId: BigInt(postingId) },
    });
    if (timePolicy) {
      return mapTimePolicy(timePolicy);
    }

    return {
      postingId,
      preparationTimeSec: 0,
      answerTimeSec: 90,
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

      const removed = await tx.evaluationCriterion.findMany({
        where: {
          postingId: BigInt(postingId),
          criterionId: { notIn: nextIds },
        },
        select: { criterionId: true },
      });
      const removedIds = removed.map((criterion) => criterion.criterionId);
      if (removedIds.length > 0) {
        await tx.question.updateMany({
          where: {
            postingId: BigInt(postingId),
            criterionId: { in: removedIds },
          },
          data: {
            isActive: false,
            criterionId: null,
          },
        });
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

  async updateQuestion(
    questionId: number,
    input: UpdateQuestionInput,
  ): Promise<QuestionRecord> {
    const question = await this.prisma.question.update({
      where: { questionId: BigInt(questionId) },
      data: {
        criterionId: BigInt(input.criterionId),
        questionType: input.questionType,
        content: input.content.trim(),
      },
    });
    return mapQuestion(question);
  }

  async deactivateQuestion(questionId: number): Promise<QuestionRecord> {
    const question = await this.prisma.question.update({
      where: { questionId: BigInt(questionId) },
      data: { isActive: false },
    });
    return mapQuestion(question);
  }

  async updateTimePolicy(
    postingId: number,
    input: UpdateTimePolicyInput,
  ): Promise<TimePolicyRecord> {
    const timePolicy = await this.prisma.interviewTimePolicy.upsert({
      where: { postingId: BigInt(postingId) },
      create: {
        postingId: BigInt(postingId),
        preparationTimeSec: input.preparationTimeSec,
        answerTimeSec: input.answerTimeSec,
        retryAllowed: input.retryAllowed,
      },
      update: {
        preparationTimeSec: input.preparationTimeSec,
        answerTimeSec: input.answerTimeSec,
        retryAllowed: input.retryAllowed,
      },
    });
    return mapTimePolicy(timePolicy);
  }

  async confirmQuestionSet(input: ConfirmQuestionSetInput): Promise<QuestionSetRecord> {
    const questionSet = await this.prisma.$transaction(async (tx) => {
      await tx.interviewQuestionSet.updateMany({
        where: { postingId: BigInt(input.postingId), status: 'ACTIVE' },
        data: { status: 'DRAFT' },
      });

      return tx.interviewQuestionSet.create({
        data: {
          postingId: BigInt(input.postingId),
          title: input.title.trim(),
          status: 'ACTIVE',
          createdByProcessLogId:
            input.sourceProcessLogId === undefined
              ? undefined
              : BigInt(input.sourceProcessLogId),
          items: {
            create: [...input.items]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((item) => ({
                questionId: BigInt(item.questionId),
                criterionId:
                  item.criterionId === undefined || item.criterionId === null
                    ? null
                    : BigInt(item.criterionId),
                sortOrder: item.sortOrder,
              })),
          },
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    return mapQuestionSet(questionSet);
  }

  async findQuestionSet(
    questionSetId: number,
  ): Promise<QuestionSetRecord | undefined> {
    const questionSet = await this.prisma.interviewQuestionSet.findUnique({
      where: { questionSetId: BigInt(questionSetId) },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { question: true },
        },
      },
    });
    return questionSet ? mapQuestionSet(questionSet) : undefined;
  }

  async findActiveQuestionSet(
    postingId: number,
  ): Promise<QuestionSetRecord | undefined> {
    const questionSet = await this.prisma.interviewQuestionSet.findFirst({
      where: { postingId: BigInt(postingId), status: 'ACTIVE' },
      orderBy: { questionSetId: 'desc' },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { question: true },
        },
      },
    });

    return questionSet ? mapQuestionSet(questionSet) : undefined;
  }

  async createHiringSimulationConfiguration(
    input: CreateHiringSimulationConfigurationInput,
  ): Promise<HiringSimulationConfigurationRecord> {
    const existing = await this.findHiringSimulationConfigurationByRequestKey(
      input.cohort.createdByUserId,
      input.cohort.requestKey,
    );
    if (existing) {
      if (existing.cohort.configurationHash === input.cohort.configurationHash) {
        return existing;
      }
      throw new HiringSimulationRequestKeyConflictError();
    }

    try {
      const cohort = await this.prisma.$transaction(async (tx) => {
        const expectedQuestionIds =
          input.questionSetSnapshot.expectedQuestionIds.map((questionId) =>
            BigInt(questionId),
          );
        const sourceQuestionSet = await tx.interviewQuestionSet.findFirst({
          where: {
            questionSetId: BigInt(
              input.questionSetSnapshot.sourceQuestionSetId,
            ),
            postingId: BigInt(input.questionSetSnapshot.postingId),
            status: 'ACTIVE',
          },
          select: {
            items: {
              where: { questionId: { in: expectedQuestionIds } },
              select: {
                questionId: true,
                question: {
                  select: {
                    companyId: true,
                    postingId: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        });
        if (
          !sourceQuestionSet ||
          sourceQuestionSet.items.length !== expectedQuestionIds.length ||
          sourceQuestionSet.items.some(
            (item) =>
              !item.question.isActive ||
              item.question.companyId !==
                BigInt(input.questionSetSnapshot.companyId) ||
              item.question.postingId !==
                BigInt(input.questionSetSnapshot.postingId),
          )
        ) {
          throw new HiringQuestionSetChangedError();
        }

        const policy = await tx.hiringEvaluationPolicy.create({
          data: {
            postingId: BigInt(input.policy.postingId),
            createdByUserId: BigInt(input.policy.createdByUserId),
            policyVersion: input.policy.policyVersion,
            decisionMode: input.policy.decisionMode,
            jobWeightPercent: input.policy.jobWeightPercent,
            talentWeightPercent: input.policy.talentWeightPercent,
            minimumJobScore: input.policy.minimumJobScore,
            minimumTalentScore: input.policy.minimumTalentScore,
            minimumEvidenceCoveragePercent:
              input.policy.minimumEvidenceCoveragePercent,
            tieBreakMode: 'WEIGHT_ORDER',
            snapshotJson: input.policy.snapshotJson as Prisma.InputJsonValue,
          },
        });
        const questionSetSnapshot = await tx.hiringQuestionSetSnapshot.create({
          data: {
            postingId: BigInt(input.questionSetSnapshot.postingId),
            sourceQuestionSetId: BigInt(
              input.questionSetSnapshot.sourceQuestionSetId,
            ),
            snapshotVersion: input.questionSetSnapshot.snapshotVersion,
            jobRole: input.questionSetSnapshot.jobRole,
            mode: input.questionSetSnapshot.mode,
            questionCount: input.questionSetSnapshot.questionCount,
            maxFollowUpCount: input.questionSetSnapshot.maxFollowUpCount,
            snapshotJson:
              input.questionSetSnapshot.snapshotJson as Prisma.InputJsonValue,
          },
        });

        return tx.hiringEvaluationCohort.create({
          data: {
            companyId: BigInt(input.cohort.companyId),
            postingId: BigInt(input.cohort.postingId),
            policyId: policy.policyId,
            questionSetSnapshotId: questionSetSnapshot.questionSetSnapshotId,
            createdByUserId: BigInt(input.cohort.createdByUserId),
            requestKey: input.cohort.requestKey,
            configurationHash: input.cohort.configurationHash,
            title: input.cohort.title,
            jobRole: input.cohort.jobRole,
            status: 'OPEN',
            capacity: input.cohort.capacity,
          },
          include: HIRING_SIMULATION_INCLUDE,
        });
      });

      return mapHiringSimulation(cohort);
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error)) {
        throw error;
      }
      const replay = await this.findHiringSimulationConfigurationByRequestKey(
        input.cohort.createdByUserId,
        input.cohort.requestKey,
      );
      if (replay?.cohort.configurationHash === input.cohort.configurationHash) {
        return replay;
      }
      throw new HiringSimulationRequestKeyConflictError();
    }
  }

  async findHiringSimulationConfiguration(
    cohortId: number,
  ): Promise<HiringSimulationConfigurationRecord | undefined> {
    const cohort = await this.prisma.hiringEvaluationCohort.findUnique({
      where: { cohortId: BigInt(cohortId) },
      include: HIRING_SIMULATION_INCLUDE,
    });
    return cohort ? mapHiringSimulation(cohort) : undefined;
  }

  async lockHiringEvaluationContext(
    input: LockHiringEvaluationContextInput,
  ): Promise<HiringSimulationConfigurationRecord> {
    try {
      const locked = await this.prisma.$transaction(async (tx) => {
        const current = await tx.hiringEvaluationCohort.findUnique({
          where: { cohortId: BigInt(input.cohortId) },
          include: HIRING_SIMULATION_INCLUDE,
        });
        if (!current || current.companyId !== BigInt(input.companyId)) {
          throw new HiringEvaluationContextLockError('CONFIGURATION_CHANGED');
        }

        if (current.status === 'LOCKED') {
          if (hasContextHash(current.questionSetSnapshot.snapshotJson, input.contextHash)) {
            return current;
          }
          throw new HiringEvaluationContextLockError('CONTEXT_MISMATCH');
        }
        if (current.status !== 'OPEN') {
          throw new HiringEvaluationContextLockError('COHORT_NOT_OPEN');
        }
        if (
          current.configurationHash !== input.expectedConfigurationHash ||
          current.questionSetSnapshotId !==
            BigInt(input.expectedQuestionSetSnapshotId)
        ) {
          throw new HiringEvaluationContextLockError('CONFIGURATION_CHANGED');
        }

        const contextSnapshot = await tx.hiringQuestionSetSnapshot.create({
          data: {
            postingId: current.questionSetSnapshot.postingId,
            sourceQuestionSetId:
              current.questionSetSnapshot.sourceQuestionSetId,
            snapshotVersion: input.contextSnapshotVersion,
            jobRole: current.questionSetSnapshot.jobRole,
            mode: current.questionSetSnapshot.mode,
            questionCount: current.questionSetSnapshot.questionCount,
            maxFollowUpCount:
              current.questionSetSnapshot.maxFollowUpCount,
            snapshotJson:
              input.snapshotJson as unknown as Prisma.InputJsonValue,
          },
        });
        const update = await tx.hiringEvaluationCohort.updateMany({
          where: {
            cohortId: current.cohortId,
            companyId: BigInt(input.companyId),
            status: 'OPEN',
            configurationHash: input.expectedConfigurationHash,
            questionSetSnapshotId: BigInt(
              input.expectedQuestionSetSnapshotId,
            ),
          },
          data: {
            questionSetSnapshotId: contextSnapshot.questionSetSnapshotId,
            status: 'LOCKED',
            lockedAt: new Date(),
          },
        });
        if (update.count !== 1) {
          throw new HiringEvaluationContextLockError('COHORT_NOT_OPEN');
        }

        const result = await tx.hiringEvaluationCohort.findUnique({
          where: { cohortId: current.cohortId },
          include: HIRING_SIMULATION_INCLUDE,
        });
        if (!result) {
          throw new HiringEvaluationContextLockError('CONFIGURATION_CHANGED');
        }
        return result;
      });
      return mapHiringSimulation(locked);
    } catch (error) {
      if (
        error instanceof HiringEvaluationContextLockError &&
        error.reason === 'COHORT_NOT_OPEN'
      ) {
        const replay = await this.findHiringSimulationConfiguration(
          input.cohortId,
        );
        if (
          replay?.cohort.status === 'LOCKED' &&
          hasContextHash(
            replay.questionSetSnapshot.snapshotJson,
            input.contextHash,
          )
        ) {
          return replay;
        }
      }
      throw error;
    }
  }

  async findHiringSimulationConfigurationByRequestKey(
    createdByUserId: number,
    requestKey: string,
  ): Promise<HiringSimulationConfigurationRecord | undefined> {
    const cohort = await this.prisma.hiringEvaluationCohort.findUnique({
      where: {
        createdByUserId_requestKey: {
          createdByUserId: BigInt(createdByUserId),
          requestKey,
        },
      },
      include: HIRING_SIMULATION_INCLUDE,
    });
    return cohort ? mapHiringSimulation(cohort) : undefined;
  }

  async findHiringAnswerEvaluationSource(
    sessionId: number,
    questionId: number,
    primaryAnswerId: number,
  ): Promise<HiringAnswerEvaluationSourceRecord | undefined> {
    const primaryAnswer = await this.prisma.interviewAnswer.findFirst({
      where: {
        answerId: BigInt(primaryAnswerId),
        sessionId: BigInt(sessionId),
        questionId: BigInt(questionId),
      },
      select: {
        answerId: true,
        questionId: true,
        transcript: true,
        session: {
          select: {
            sessionId: true,
            applicationId: true,
            candidateId: true,
            interviewType: true,
            status: true,
            application: {
              select: { postingId: true },
            },
          },
        },
      },
    });
    if (!primaryAnswer?.questionId) {
      return undefined;
    }

    const persistedQuestions =
      await this.prisma.interviewSessionQuestion.findMany({
        where: { sessionId: BigInt(sessionId) },
        orderBy: { sortOrder: 'asc' },
        select: {
          questionId: true,
          runtimeQuestionId: true,
          questionType: true,
          content: true,
          sortOrder: true,
          question: {
            select: {
              questionId: true,
              questionType: true,
              content: true,
            },
          },
        },
      });
    const sessionQuestions = persistedQuestions.flatMap((candidate) => {
      const persistedQuestionId =
        candidate.questionId ??
        candidate.runtimeQuestionId ??
        candidate.question?.questionId;
      const questionType =
        candidate.questionType ?? candidate.question?.questionType;
      const content = candidate.content ?? candidate.question?.content;
      if (!persistedQuestionId || !questionType || !content) {
        return [];
      }
      return [
        {
          questionId: Number(persistedQuestionId),
          questionType: questionType as QuestionRecord['questionType'],
          content,
          sortOrder: candidate.sortOrder,
        },
      ];
    });
    const primaryIndex = sessionQuestions.findIndex(
      (question) => question.questionId === questionId,
    );
    const generatedFollowUp = await this.prisma.followUpQuestion.findUnique({
      where: {
        answerIdPolicy: {
          answerId: BigInt(primaryAnswerId),
          policy: 'RECRUITING',
        },
      },
      select: { content: true, generationStatus: true },
    });
    const nextQuestion =
      primaryIndex < 0 ? undefined : sessionQuestions[primaryIndex + 1];
    let followUpAnswer:
      | HiringAnswerEvaluationSourceRecord['followUpAnswer']
      | undefined;
    if (
      generatedFollowUp?.generationStatus === 'GENERATED' &&
      nextQuestion?.questionType === 'FOLLOW_UP' &&
      nextQuestion.content.trim() === generatedFollowUp.content.trim()
    ) {
      const answer = await this.prisma.interviewAnswer.findFirst({
        where: {
          sessionId: BigInt(sessionId),
          questionId: BigInt(nextQuestion.questionId),
        },
        orderBy: { answerId: 'asc' },
        select: { answerId: true, questionId: true, transcript: true },
      });
      if (answer?.questionId) {
        followUpAnswer = {
          answerId: Number(answer.answerId),
          questionId: Number(answer.questionId),
          transcript: answer.transcript,
        };
      }
    }

    return {
      applicationId:
        primaryAnswer.session.applicationId === null
          ? null
          : Number(primaryAnswer.session.applicationId),
      postingId: primaryAnswer.session.application
        ? Number(primaryAnswer.session.application.postingId)
        : null,
      candidateId: Number(primaryAnswer.session.candidateId),
      sessionId: Number(primaryAnswer.session.sessionId),
      interviewType: primaryAnswer.session.interviewType,
      sessionStatus: primaryAnswer.session.status,
      assignedQuestions: sessionQuestions.filter(
        (question) => question.questionType !== 'FOLLOW_UP',
      ),
      primaryAnswer: {
        answerId: Number(primaryAnswer.answerId),
        questionId: Number(primaryAnswer.questionId),
        transcript: primaryAnswer.transcript,
      },
      ...(followUpAnswer ? { followUpAnswer } : {}),
      followUpsUsed: sessionQuestions.filter(
        (question) => question.questionType === 'FOLLOW_UP',
      ).length,
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

function mapTimePolicy(timePolicy: {
  postingId: bigint;
  preparationTimeSec: number;
  answerTimeSec: number;
  retryAllowed: boolean;
}): TimePolicyRecord {
  return {
    postingId: Number(timePolicy.postingId),
    preparationTimeSec: timePolicy.preparationTimeSec,
    answerTimeSec: timePolicy.answerTimeSec,
    retryAllowed: timePolicy.retryAllowed,
  };
}

function mapQuestionSet(questionSet: {
  questionSetId: bigint;
  postingId: bigint;
  title: string;
  status: string;
  createdByProcessLogId: bigint | null;
  items: Array<{
    questionSetItemId: bigint;
    questionId: bigint;
    criterionId: bigint | null;
    sortOrder: number;
    question?: {
      questionId: bigint;
      companyId: bigint;
      postingId: bigint | null;
      criterionId: bigint | null;
      questionType: QuestionType;
      content: string;
      isActive: boolean;
    };
  }>;
}): QuestionSetRecord {
  return {
    questionSetId: Number(questionSet.questionSetId),
    postingId: Number(questionSet.postingId),
    title: questionSet.title,
    status: questionSet.status,
    createdByProcessLogId:
      questionSet.createdByProcessLogId === null
        ? null
        : Number(questionSet.createdByProcessLogId),
    items: questionSet.items.map((item) => ({
      questionSetItemId: Number(item.questionSetItemId),
      questionId: Number(item.questionId),
      criterionId: item.criterionId === null ? null : Number(item.criterionId),
      sortOrder: item.sortOrder,
      question: item.question ? mapQuestion(item.question) : undefined,
    })),
  };
}

function mapHiringSimulation(
  cohort: HiringSimulationRow,
): HiringSimulationConfigurationRecord {
  const policySnapshot = cohort.policy.snapshotJson as unknown as HiringPolicySnapshot;
  const questionSnapshot = cohort.questionSetSnapshot.snapshotJson as unknown as
    | HiringQuestionSetSnapshotJson
    | HiringEvaluationContextSnapshotJson;
  const postingId =
    cohort.postingId === null
      ? policySnapshot.administratorInput.postingId
      : Number(cohort.postingId);

  return {
    cohort: {
      cohortId: Number(cohort.cohortId),
      companyId: Number(cohort.companyId),
      postingId,
      policyId: Number(cohort.policyId),
      questionSetSnapshotId: Number(cohort.questionSetSnapshotId),
      createdByUserId: Number(cohort.createdByUserId),
      requestKey: cohort.requestKey,
      configurationHash: cohort.configurationHash,
      title: cohort.title,
      jobRole: cohort.jobRole,
      status: cohort.status,
      capacity: cohort.capacity,
      openedAt: cohort.openedAt,
      lockedAt: cohort.lockedAt,
      createdAt: cohort.createdAt,
    },
    policy: {
      policyId: Number(cohort.policy.policyId),
      postingId:
        cohort.policy.postingId === null
          ? postingId
          : Number(cohort.policy.postingId),
      createdByUserId: Number(cohort.policy.createdByUserId),
      policyVersion: cohort.policy.policyVersion,
      decisionMode: cohort.policy.decisionMode,
      jobWeightPercent: cohort.policy.jobWeightPercent,
      talentWeightPercent: cohort.policy.talentWeightPercent,
      minimumJobScore: cohort.policy.minimumJobScore,
      minimumTalentScore: cohort.policy.minimumTalentScore,
      minimumEvidenceCoveragePercent:
        cohort.policy.minimumEvidenceCoveragePercent,
      tieBreakMode: cohort.policy.tieBreakMode,
      snapshotJson: policySnapshot,
      createdAt: cohort.policy.createdAt,
    },
    questionSetSnapshot: {
      questionSetSnapshotId: Number(
        cohort.questionSetSnapshot.questionSetSnapshotId,
      ),
      postingId:
        cohort.questionSetSnapshot.postingId === null
          ? postingId
          : Number(cohort.questionSetSnapshot.postingId),
      sourceQuestionSetId:
        cohort.questionSetSnapshot.sourceQuestionSetId === null
          ? questionSnapshot.schemaVersion ===
            'hiring-question-set-configuration.v1'
            ? questionSnapshot.sourceQuestionSetId
            : questionSnapshot.questionSet.sourceQuestionSetId
          : Number(cohort.questionSetSnapshot.sourceQuestionSetId),
      snapshotVersion: cohort.questionSetSnapshot.snapshotVersion,
      jobRole: cohort.questionSetSnapshot.jobRole,
      mode: cohort.questionSetSnapshot.mode,
      questionCount: cohort.questionSetSnapshot.questionCount,
      maxFollowUpCount: cohort.questionSetSnapshot.maxFollowUpCount,
      snapshotJson: questionSnapshot,
      createdAt: cohort.questionSetSnapshot.createdAt,
    },
  };
}

function hasContextHash(value: unknown, expectedHash: string): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Reflect.get(value, 'schemaVersion') === 'hiring-evaluation-context.v1' &&
    Reflect.get(value, 'contextHash') === expectedHash
  );
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
