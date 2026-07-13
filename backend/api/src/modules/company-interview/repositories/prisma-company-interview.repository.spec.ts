import assert from 'node:assert/strict';
import type { CreateHiringSimulationConfigurationInput } from './company-interview.repository';
import {
  HiringEvaluationContextLockError,
  HiringQuestionSetChangedError,
} from './company-interview.repository';
import { PrismaCompanyInterviewRepository } from './prisma-company-interview.repository';

test('revalidates the active question set inside the creation transaction', async () => {
  let policyCreateCalled = false;
  const transaction = {
    interviewQuestionSet: {
      findFirst: async () => undefined,
    },
    hiringEvaluationPolicy: {
      create: async () => {
        policyCreateCalled = true;
        throw new Error('must not create policy after a changed question set');
      },
    },
  };
  const repository = new PrismaCompanyInterviewRepository({
    hiringEvaluationCohort: {
      findUnique: async () => undefined,
    },
    $transaction: async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
  } as never);

  await assert.rejects(
    repository.createHiringSimulationConfiguration(configurationInput()),
    HiringQuestionSetChangedError,
  );
  assert.equal(policyCreateCalled, false);
});

test('assembles a hiring evaluation source only from persisted session answers and question snapshots', async () => {
  let answerQueryCount = 0;
  const prisma = {
    interviewAnswer: {
      async findFirst() {
        answerQueryCount += 1;
        if (answerQueryCount === 1) {
          return {
            answerId: 701n,
            questionId: 101n,
            transcript: ' 본질문 발화 ',
            session: {
              sessionId: 401n,
              applicationId: 77n,
              candidateId: 301n,
              interviewType: 'RECRUITING',
              status: 'COMPLETED',
              application: { postingId: 1n },
            },
          };
        }
        return {
          answerId: 702n,
          questionId: 901n,
          transcript: '꼬리질문 발화',
        };
      },
    },
    interviewSessionQuestion: {
      async findMany() {
        return [
          {
            questionId: 101n,
            runtimeQuestionId: null,
            questionType: 'TECHNICAL',
            content: '고정 본질문',
            sortOrder: 0,
            question: {
              questionId: 101n,
              questionType: 'TECHNICAL',
              content: '현재 본질문',
            },
          },
          {
            questionId: 901n,
            runtimeQuestionId: null,
            questionType: 'FOLLOW_UP',
            content: '고정 꼬리질문',
            sortOrder: 1,
            question: {
              questionId: 901n,
              questionType: 'FOLLOW_UP',
              content: '현재 꼬리질문',
            },
          },
        ];
      },
    },
    followUpQuestion: {
      async findUnique() {
        return {
          content: '고정 꼬리질문',
          generationStatus: 'GENERATED',
        };
      },
    },
  };
  const repository = new PrismaCompanyInterviewRepository(prisma as never);

  const source = await repository.findHiringAnswerEvaluationSource(
    401,
    101,
    701,
  );

  assert.equal(source?.postingId, 1);
  assert.equal(source?.candidateId, 301);
  assert.deepEqual(source?.assignedQuestions, [
    {
      questionId: 101,
      questionType: 'TECHNICAL',
      content: '고정 본질문',
      sortOrder: 0,
    },
  ]);
  assert.equal(source?.primaryAnswer.transcript, ' 본질문 발화 ');
  assert.equal(source?.followUpAnswer?.answerId, 702);
  assert.equal(source?.followUpsUsed, 1);
});

test('locks a context only while the cohort still references the expected open configuration', async () => {
  const configurationHash = `sha256:${'a'.repeat(64)}`;
  let updateWhere: Record<string, unknown> | undefined;
  const transaction = {
    hiringEvaluationCohort: {
      async findUnique() {
        return {
          cohortId: 51n,
          companyId: 1n,
          status: 'OPEN',
          configurationHash,
          questionSetSnapshotId: 61n,
          questionSetSnapshot: {
            postingId: 1n,
            sourceQuestionSetId: 10n,
            jobRole: '백엔드 개발자',
            mode: 'QUICK',
            questionCount: 3,
            maxFollowUpCount: 2,
          },
        };
      },
      async updateMany(input: { where: Record<string, unknown> }) {
        updateWhere = input.where;
        return { count: 0 };
      },
    },
    hiringQuestionSetSnapshot: {
      async create() {
        return { questionSetSnapshotId: 62n };
      },
    },
  };
  const repository = new PrismaCompanyInterviewRepository({
    hiringEvaluationCohort: {
      findUnique: async () => undefined,
    },
    $transaction: async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
  } as never);

  await assert.rejects(
    repository.lockHiringEvaluationContext({
      cohortId: 51,
      companyId: 1,
      expectedConfigurationHash: configurationHash,
      expectedQuestionSetSnapshotId: 61,
      contextSnapshotVersion: 'hiring-evaluation-context-v1-test',
      contextHash: `sha256:${'b'.repeat(64)}`,
      snapshotJson: {} as never,
    }),
    (error: unknown) =>
      error instanceof HiringEvaluationContextLockError &&
      error.reason === 'COHORT_NOT_OPEN',
  );
  assert.deepEqual(updateWhere, {
    cohortId: 51n,
    companyId: 1n,
    status: 'OPEN',
    configurationHash,
    questionSetSnapshotId: 61n,
  });
});

function configurationInput(): CreateHiringSimulationConfigurationInput {
  return {
    policy: {
      postingId: 1,
      createdByUserId: 1,
      policyVersion: 'hiring-policy-v1-test',
      decisionMode: 'HYBRID',
      jobWeightPercent: 60,
      talentWeightPercent: 40,
      minimumJobScore: 65,
      minimumTalentScore: 60,
      minimumEvidenceCoveragePercent: 80,
      snapshotJson: {
        schemaVersion: 'hiring-evaluation-policy.v1',
        administratorInput: {
          postingId: 1,
          decisionMode: 'HYBRID',
          jobWeightPercent: 60,
          talentWeightPercent: 40,
          minimumJobScore: 65,
          minimumTalentScore: 60,
          minimumEvidenceCoveragePercent: 80,
        },
        tieBreakOrder: [
          { field: 'WEIGHTED_TOTAL_SCORE', direction: 'DESC' },
          { field: 'EVIDENCE_COVERAGE_PERCENT', direction: 'DESC' },
        ],
      },
    },
    questionSetSnapshot: {
      companyId: 1,
      postingId: 1,
      sourceQuestionSetId: 10,
      expectedQuestionIds: [101, 102, 103],
      snapshotVersion: 'hiring-question-set-configuration-v1-test',
      jobRole: '백엔드 개발자',
      mode: 'QUICK',
      questionCount: 3,
      maxFollowUpCount: 2,
      snapshotJson: {
        schemaVersion: 'hiring-question-set-configuration.v1',
        postingId: 1,
        sourceQuestionSetId: 10,
        jobRole: '백엔드 개발자',
        mode: 'QUICK',
        questionCount: 3,
        maxFollowUpCount: 2,
        questions: [101, 102, 103].map((questionId, index) => ({
          questionId,
          order: index + 1,
          questionType: 'TECHNICAL',
          content: `질문 ${index + 1}`,
          criterionId: index + 1,
        })),
      },
    },
    cohort: {
      companyId: 1,
      postingId: 1,
      createdByUserId: 1,
      requestKey: 'hiring-simulation:repository-test',
      configurationHash: `sha256:${'a'.repeat(64)}`,
      title: '저장 경쟁 조건 검증',
      jobRole: '백엔드 개발자',
      capacity: 2,
    },
  };
}
