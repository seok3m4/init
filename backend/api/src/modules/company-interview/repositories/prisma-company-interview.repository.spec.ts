import assert from 'node:assert/strict';
import type { CreateHiringSimulationConfigurationInput } from './company-interview.repository';
import { HiringQuestionSetChangedError } from './company-interview.repository';
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
