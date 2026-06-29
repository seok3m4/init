import { strict as assert } from 'node:assert';
import type { CurrentUser } from '@init/common';
import { ApiException } from '../../shared/api-exception';
import { CompanyInterviewService } from './company-interview.service';
import { InMemoryCompanyInterviewRepository } from './repositories/in-memory-company-interview.repository';

const companyUser: CurrentUser = {
  userId: 1,
  userType: 'COMPANY',
  companyId: 1,
  candidateId: null,
};

function createService() {
  return new CompanyInterviewService(new InMemoryCompanyInterviewRepository());
}

async function assertBadRequest(action: () => Promise<unknown>) {
  await assert.rejects(action, ApiException);
}

async function assertConflict(action: () => Promise<unknown>) {
  await assert.rejects(action, ApiException);
}

describe('CompanyInterviewService', () => {
  it('returns interview settings for a company posting', async () => {
    const settings = await createService().getSettings(companyUser, { postingId: 1 });

    assert.equal(settings.posting.postingId, 1);
    assert.equal(settings.criteria.length, 3);
    assert.equal(settings.questions.length, 3);
  });

  it('updates evaluation criteria and validates duplicate sort order', async () => {
    const criteriaResult = await createService().updateEvaluationCriteria(companyUser, {
      postingId: 1,
      criteria: [
        { criterionId: 1, tagId: 1, weight: 50, passScore: 70, sortOrder: 1 },
        { criterionId: 2, tagId: 2, weight: 50, passScore: null, sortOrder: 2 },
      ],
    });

    assert.equal(criteriaResult.totalWeight, 100);
    assert.equal(criteriaResult.criteria.length, 2);

    await assertBadRequest(() =>
      createService().updateEvaluationCriteria(companyUser, {
        postingId: 1,
        criteria: [
          { criterionId: 1, tagId: 1, weight: 50, sortOrder: 1 },
          { criterionId: 2, tagId: 2, weight: 50, sortOrder: 1 },
        ],
      }),
    );
  });

  it('returns pending process status for criteria suggestions', async () => {
    const suggest = await createService().suggestEvaluationCriteria(companyUser, {
      postingId: 1,
    });

    assert.equal(suggest.status, 'PENDING');
  });

  it('returns the default time policy', async () => {
    const timePolicy = (await createService().getSettings(companyUser, {})).timePolicy;
 
    assert.equal(timePolicy.preparationTimeSec, 60);
    assert.equal(timePolicy.answerTimeSec, 180);
  });

  it('creates an interview question and rejects duplicate content', async () => {
    const service = createService();
    const question = await service.createQuestion(companyUser, {
      postingId: 1,
      criterionId: 1,
      questionType: 'TECHNICAL',
      content: 'NestJS 모듈 경계를 어떤 기준으로 나누는지 설명해주세요.',
    });

    assert.equal(question.postingId, 1);
    assert.equal(question.question.questionType, 'TECHNICAL');
    assert.equal(question.question.criterionId, 1);

    await assertConflict(() =>
      service.createQuestion(companyUser, {
        postingId: 1,
        criterionId: 1,
        questionType: 'TECHNICAL',
        content: 'NestJS 모듈 경계를 어떤 기준으로 나누는지 설명해주세요.',
      }),
    );
  });

  it('returns pending process status for question generation', async () => {
    const result = await createService().generateQuestions(companyUser, {
      postingId: 1,
      criterionIds: [1, 2],
      questionTypes: ['TECHNICAL'],
      requestedCount: 3,
    });

    assert.equal(result.status, 'PENDING');
  });

  it('creates a question set from active posting questions', async () => {
    const questionSet = await createService().createQuestionSet(companyUser, {
      postingId: 1,
      questionTypes: ['TECHNICAL'],
      questionCount: 2,
    });

    assert.equal(questionSet.postingId, 1);
    assert.equal(questionSet.questionSet.questionCount, 2);
    assert.equal(questionSet.questionSet.readyForSession, true);
  });

  it('updates the interview time policy and validates runtime bounds', async () => {
    const service = createService();
    const result = await service.updateTimePolicy(companyUser, {
      postingId: 1,
      preparationTimeSec: 90,
      answerTimeSec: 300,
      retryAllowed: true,
    });

    assert.equal(result.timePolicy.preparationTimeSec, 90);
    assert.equal(result.timePolicy.answerTimeSec, 300);
    assert.equal(result.timePolicy.retryAllowed, true);
    assert.equal(
      (await service.getSettings(companyUser, { postingId: 1 })).timePolicy.answerTimeSec,
      300,
    );

    await assertBadRequest(() =>
      service.updateTimePolicy(companyUser, {
        postingId: 1,
        preparationTimeSec: 120,
        answerTimeSec: 120,
        retryAllowed: false,
      }),
    );
  });
});
