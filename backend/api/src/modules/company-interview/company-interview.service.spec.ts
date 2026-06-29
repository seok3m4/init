import { BadRequestException } from '@nestjs/common';
import { strict as assert } from 'node:assert';
import { CompanyInterviewService } from './company-interview.service';
import { InMemoryCompanyInterviewRepository } from './repositories/in-memory-company-interview.repository';
import { CurrentUser } from './company-interview.types';

const companyUser: CurrentUser = {
  userId: 1,
  userType: 'COMPANY',
  companyId: 1,
  candidateId: null,
};

function createService() {
  return new CompanyInterviewService(new InMemoryCompanyInterviewRepository());
}

function assertBadRequest(action: () => unknown) {
  assert.throws(action, BadRequestException);
}

function run() {
  const settings = createService().getSettings(companyUser, { postingId: 1 });
  assert.equal(settings.posting.postingId, 1);
  assert.equal(settings.criteria.length, 3);
  assert.equal(settings.questions.length, 3);

  const criteriaResult = createService().updateEvaluationCriteria(companyUser, {
    postingId: 1,
    criteria: [
      { criterionId: 1, tagId: 1, weight: 50, passScore: 70, sortOrder: 1 },
      { criterionId: 2, tagId: 2, weight: 50, passScore: null, sortOrder: 2 },
    ],
  });
  assert.equal(criteriaResult.totalWeight, 100);
  assert.equal(criteriaResult.criteria.length, 2);

  assertBadRequest(() =>
    createService().updateEvaluationCriteria(companyUser, {
      postingId: 1,
      criteria: [
        { criterionId: 1, tagId: 1, weight: 50, sortOrder: 1 },
        { criterionId: 2, tagId: 2, weight: 50, sortOrder: 1 },
      ],
    }),
  );

  const createQuestionService = createService();
  assert.equal(createQuestionService.getSettings(companyUser, {}).questions.length, 3);

  const suggest = createService().suggestEvaluationCriteria(companyUser, {
    postingId: 1,
  });
  assert.equal(suggest.status, 'PENDING');

  const timePolicy = createService().getSettings(companyUser, {}).timePolicy;
  assert.equal(timePolicy.preparationTimeSec, 60);
  assert.equal(timePolicy.answerTimeSec, 180);
}

run();
