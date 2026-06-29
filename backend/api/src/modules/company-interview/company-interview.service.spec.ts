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
});
