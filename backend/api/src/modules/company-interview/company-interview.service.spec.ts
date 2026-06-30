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
    assert.equal(settings.availableTags.length, 3);
    assert.equal(settings.availableTags[0].tagName, 'API 설계');
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

    const addedCriteriaResult = await createService().updateEvaluationCriteria(companyUser, {
      postingId: 1,
      criteria: [
        { criterionId: 1, tagId: 1, weight: 50, passScore: 70, sortOrder: 1 },
        { tagId: 3, weight: 50, passScore: null, sortOrder: 2 },
      ],
    });

    assert.equal(addedCriteriaResult.criteria.length, 2);
    assert.equal(addedCriteriaResult.criteria[1].tagName, '협업 커뮤니케이션');

    await assertBadRequest(() =>
      createService().updateEvaluationCriteria(companyUser, {
        postingId: 1,
        criteria: [
          { criterionId: 1, tagId: 1, weight: 50, sortOrder: 1 },
          { criterionId: 2, tagId: 2, weight: 50, sortOrder: 1 },
        ],
      }),
    );

    await assertBadRequest(() =>
      createService().updateEvaluationCriteria(companyUser, {
        postingId: 1,
        criteria: [
          { criterionId: 1, tagId: 1, weight: 50, sortOrder: 1 },
          { criterionId: 2, tagId: 1, weight: 50, sortOrder: 2 },
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

  it('updates and deactivates interview questions', async () => {
    const service = createService();
    const updated = await service.updateQuestion(companyUser, 1, {
      criterionId: 2,
      questionType: 'EXPERIENCE',
      content: '데이터 모델 변경을 리뷰어에게 설명했던 경험을 말해주세요.',
    });

    assert.equal(updated.question.questionType, 'EXPERIENCE');
    assert.equal(updated.question.criterionId, 2);

    await assertConflict(() =>
      service.updateQuestion(companyUser, 1, {
        criterionId: 2,
        questionType: 'EXPERIENCE',
        content: '평가 기준과 질문 뱅크의 관계를 어떻게 모델링하시겠습니까?',
      }),
    );

    const deleted = await service.deleteQuestion(companyUser, 1);
    assert.equal(deleted.question.isActive, false);
    assert.equal((await service.getSettings(companyUser, { postingId: 1 })).questions.length, 2);
  });

  it('hides questions linked to removed evaluation criteria', async () => {
    const service = createService();

    await service.updateEvaluationCriteria(companyUser, {
      postingId: 1,
      criteria: [
        { criterionId: 1, tagId: 1, weight: 100, passScore: 70, sortOrder: 1 },
      ],
    });

    const settings = await service.getSettings(companyUser, { postingId: 1 });
    assert.equal(settings.criteria.length, 1);
    assert.equal(settings.questions.length, 1);
    assert.equal(settings.questions[0].criterionId, 1);
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
