import { strict as assert } from 'node:assert';
import type { CurrentUser } from '@init/common';
import { ApiException } from '../../shared/api-exception';
import { CompanyInterviewService } from './company-interview.service';
import type { CreateHiringSimulationDto } from './dto/hiring-simulation.dto';
import { InMemoryCompanyInterviewRepository } from './repositories/in-memory-company-interview.repository';

const companyUser: CurrentUser = {
  userId: 1,
  userType: 'COMPANY',
  companyId: 1,
  candidateId: null,
};

const otherCompanyUser: CurrentUser = {
  userId: 99,
  userType: 'COMPANY',
  companyId: 2,
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

async function assertApiError(
  action: () => Promise<unknown>,
  status: number,
  reason?: string,
) {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof ApiException);
    assert.equal(error.getStatus(), status);
    if (reason !== undefined) {
      assert.ok(error.details.some((detail) => detail.reason === reason));
    }
    return true;
  });
}

async function confirmQuickQuestionSet(service: CompanyInterviewService) {
  return service.confirmQuestionSet(companyUser, {
    postingId: 1,
    title: '채용 시뮬레이션 원본 질문 세트',
    items: [
      { questionId: 1, criterionId: 1, sortOrder: 1 },
      { questionId: 2, criterionId: 2, sortOrder: 2 },
      { questionId: 3, criterionId: 3, sortOrder: 3 },
    ],
  });
}

function hiringSimulationInput(
  sourceQuestionSetId: number,
  overrides: Partial<CreateHiringSimulationDto> = {},
): CreateHiringSimulationDto {
  return {
    requestKey: 'hiring-simulation:test-1',
    postingId: 1,
    sourceQuestionSetId,
    title: '2026 백엔드 채용 판정 시뮬레이션',
    jobWeightPercent: 60,
    talentWeightPercent: 40,
    minimumJobScore: 65,
    minimumTalentScore: 60,
    minimumEvidenceCoveragePercent: 80,
    capacity: 2,
    questionSetMode: 'QUICK',
    orderedQuestionIds: [3, 1, 2],
    ...overrides,
  };
}

describe('CompanyInterviewService', () => {
  it('returns interview settings for a company posting', async () => {
    const settings = await createService().getSettings(companyUser, { postingId: 1 });

    assert.equal(settings.posting.postingId, 1);
    assert.equal(settings.availableTags.length, 6);
    assert.equal(settings.availableTags[0].tagName, '직무/기술 역량');
    assert.equal(settings.criteria.length, 6);
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
        { tagId: 4, weight: 50, passScore: null, sortOrder: 2 },
      ],
    });

    assert.equal(addedCriteriaResult.criteria.length, 2);
    assert.equal(addedCriteriaResult.criteria[1].tagName, '협업/커뮤니케이션');

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

  it('allows removing every evaluation criterion from a posting', async () => {
    const service = createService();
    const criteriaResult = await service.updateEvaluationCriteria(companyUser, {
      postingId: 1,
      criteria: [],
    });

    assert.equal(criteriaResult.totalWeight, 0);
    assert.equal(criteriaResult.criteria.length, 0);

    const settings = await service.getSettings(companyUser, { postingId: 1 });
    assert.equal(settings.criteria.length, 0);
    assert.equal(settings.questions.length, 0);
  });

  it('returns the default time policy', async () => {
    const timePolicy = (await createService().getSettings(companyUser, {})).timePolicy;
 
    assert.equal(timePolicy.preparationTimeSec, 0);
    assert.equal(timePolicy.answerTimeSec, 90);
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

  it('hides runtime follow-up questions from interview management settings', async () => {
    const service = createService();
    await service.createQuestion(companyUser, {
      postingId: 1,
      criterionId: 1,
      questionType: 'FOLLOW_UP',
      content: 'Which tradeoff did you consider after that answer?',
    });

    const settings = await service.getSettings(companyUser, { postingId: 1 });

    assert.equal(settings.questions.length, 3);
    assert.ok(settings.questions.every((question) => question.questionType !== 'FOLLOW_UP'));
    assert.equal(
      settings.questions.some((question) => question.content === 'Which tradeoff did you consider after that answer?'),
      false,
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

  it('confirms an active interview question set from existing question bank items', async () => {
    const service = createService();
    const result = await service.confirmQuestionSet(companyUser, {
      postingId: 1,
      title: 'AI 추천 질문 세트',
      sourceProcessLogId: 123,
      items: [
        { questionId: 2, criterionId: 2, sortOrder: 2 },
        { questionId: 1, criterionId: 1, sortOrder: 1 },
      ],
    });

    assert.equal(result.postingId, 1);
    assert.equal(result.status, 'ACTIVE');
    assert.equal(result.createdByProcessLogId, 123);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].questionId, 1);
    assert.deepEqual(
      result.items.map((item) => item.sortOrder),
      [1, 2],
    );

    const active = await service.getActiveQuestionSet(companyUser, 1);
    assert.equal(active.postingId, 1);
    assert.equal(active.fallbackPolicy, 'USE_ACTIVE_POSTING_QUESTIONS');
    assert.equal(active.questionSet?.questionSetId, result.questionSetId);
    assert.equal(active.questionSet?.items.length, 2);
    assert.deepEqual(
      active.questionSet?.items.map((item) => item.questionId),
      [1, 2],
    );
    assert.deepEqual(
      active.questionSet?.items.map((item) => item.sortOrder),
      [1, 2],
    );
    assert.equal(active.questionSet?.items[0].questionType, 'TECHNICAL');
    assert.equal(
      active.questionSet?.items[0].content,
      'REST API 계약을 먼저 문서화해야 하는 이유를 설명해주세요.',
    );
    assert.equal(active.questionSet?.items[0].isActive, true);

    await service.deleteQuestion(companyUser, 2);

    const activeAfterDelete = await service.getActiveQuestionSet(companyUser, 1);
    assert.equal(activeAfterDelete.questionSet?.items.length, 2);
    assert.deepEqual(
      activeAfterDelete.questionSet?.items.map((item) => item.questionId),
      [1, 2],
    );
    assert.equal(activeAfterDelete.questionSet?.items[1].questionType, 'TECHNICAL');
    assert.equal(
      activeAfterDelete.questionSet?.items[1].content,
      '평가 기준과 질문 뱅크의 관계를 어떻게 모델링하시겠습니까?',
    );
    assert.equal(activeAfterDelete.questionSet?.items[1].isActive, false);
  });

  it('rejects duplicate questions in a confirmed question set', async () => {
    await assertBadRequest(() =>
      createService().confirmQuestionSet(companyUser, {
        postingId: 1,
        title: '중복 질문 세트',
        items: [
          { questionId: 1, criterionId: 1, sortOrder: 1 },
          { questionId: 1, criterionId: 1, sortOrder: 2 },
        ],
      }),
    );
  });

  it('keeps only one active interview question set per posting', async () => {
    const service = createService();
    const first = await service.confirmQuestionSet(companyUser, {
      postingId: 1,
      title: '첫 질문 세트',
      items: [
        { questionId: 1, criterionId: 1, sortOrder: 1 },
        { questionId: 2, criterionId: 2, sortOrder: 2 },
      ],
    });
    const second = await service.confirmQuestionSet(companyUser, {
      postingId: 1,
      title: '최종 질문 세트',
      items: [{ questionId: 3, criterionId: 3, sortOrder: 1 }],
    });

    const active = await service.getActiveQuestionSet(companyUser, 1);
    assert.notEqual(first.questionSetId, second.questionSetId);
    assert.equal(active.questionSet?.questionSetId, second.questionSetId);
    assert.equal(active.questionSet?.items.length, 1);
    assert.equal(active.questionSet?.items[0].questionId, 3);
  });

  it('rejects inactive or other-posting questions when confirming a question set', async () => {
    const service = createService();
    await service.deleteQuestion(companyUser, 1);

    await assertBadRequest(() =>
      service.confirmQuestionSet(companyUser, {
        postingId: 1,
        title: '비활성 질문 포함',
        items: [{ questionId: 1, criterionId: 1, sortOrder: 1 }],
      }),
    );

    await assertBadRequest(() =>
      service.confirmQuestionSet(companyUser, {
        postingId: 1,
        title: '다른 공고 질문 포함',
        items: [{ questionId: 4, criterionId: 7, sortOrder: 1 }],
      }),
    );
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
    assert.equal(
      (await service.getSettings(companyUser, { postingId: 2 })).timePolicy.answerTimeSec,
      90,
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

  it('creates immutable policy and question snapshots with an OPEN cohort', async () => {
    const service = createService();
    const sourceQuestionSet = await confirmQuickQuestionSet(service);

    const result = await service.createHiringSimulation(
      companyUser,
      hiringSimulationInput(sourceQuestionSet.questionSetId),
    );

    assert.equal(result.cohort.status, 'OPEN');
    assert.equal(result.cohort.capacity, 2);
    assert.equal(result.policy.decisionMode, 'HYBRID');
    assert.equal(result.policy.tieBreakMode, 'WEIGHT_ORDER');
    assert.match(result.policy.policyVersion, /^hiring-policy-v1-/);
    assert.deepEqual(
      result.policy.snapshotJson.tieBreakOrder.map((step) => step.field),
      [
        'WEIGHTED_TOTAL_SCORE',
        'PRIMARY_TRACK_SCORE',
        'PRIMARY_TRACK_DETAIL_WEIGHT_ORDER',
        'EVIDENCE_COVERAGE_PERCENT',
      ],
    );
    assert.equal(result.policy.snapshotJson.tieBreakOrder[1].track, 'JOB');
    assert.equal(
      result.questionSetSnapshot.sourceQuestionSetId,
      sourceQuestionSet.questionSetId,
    );
    assert.equal(result.questionSetSnapshot.mode, 'QUICK');
    assert.equal(result.questionSetSnapshot.questionCount, 3);
    assert.equal(result.questionSetSnapshot.maxFollowUpCount, 2);
    assert.deepEqual(
      result.questionSetSnapshot.snapshotJson.questions.map(
        (question) => question.questionId,
      ),
      [3, 1, 2],
    );
    assert.deepEqual(
      result.questionSetSnapshot.snapshotJson.questions.map(
        (question) => question.order,
      ),
      [1, 2, 3],
    );
    assert.equal(
      result.questionSetSnapshot.snapshotJson.questions[1].content,
      'REST API 계약을 먼저 문서화해야 하는 이유를 설명해주세요.',
    );
    assert.equal(
      result.questionSetSnapshot.snapshotJson.questions[1].criterionId,
      1,
    );
  });

  it('rejects hiring simulation weights whose sum is not 100', async () => {
    const service = createService();
    const sourceQuestionSet = await confirmQuickQuestionSet(service);

    await assertApiError(
      () =>
        service.createHiringSimulation(
          companyUser,
          hiringSimulationInput(sourceQuestionSet.questionSetId, {
            jobWeightPercent: 70,
            talentWeightPercent: 20,
          }),
        ),
      400,
      'WEIGHT_SUM_MUST_EQUAL_100',
    );
  });

  it('rejects values that exceed PostgreSQL INTEGER storage bounds', async () => {
    const service = createService();
    const sourceQuestionSet = await confirmQuickQuestionSet(service);

    await assertApiError(
      () =>
        service.createHiringSimulation(
          companyUser,
          hiringSimulationInput(sourceQuestionSet.questionSetId, {
            capacity: 2_147_483_648,
          }),
        ),
      400,
      'OUT_OF_RANGE',
    );
  });

  it('rejects wrong question counts, duplicate IDs, and IDs outside the active set', async () => {
    const service = createService();
    const sourceQuestionSet = await confirmQuickQuestionSet(service);

    await assertApiError(
      () =>
        service.createHiringSimulation(
          companyUser,
          hiringSimulationInput(sourceQuestionSet.questionSetId, {
            orderedQuestionIds: [1, 2],
          }),
        ),
      400,
      'QUESTION_COUNT_MISMATCH',
    );
    await assertApiError(
      () =>
        service.createHiringSimulation(
          companyUser,
          hiringSimulationInput(sourceQuestionSet.questionSetId, {
            orderedQuestionIds: [1, 1, 2],
          }),
        ),
      400,
      'DUPLICATED',
    );
    await assertApiError(
      () =>
        service.createHiringSimulation(
          companyUser,
          hiringSimulationInput(sourceQuestionSet.questionSetId, {
            orderedQuestionIds: [1, 2, 4],
          }),
        ),
      400,
      'QUESTION_NOT_IN_ACTIVE_SET',
    );

    await service.deleteQuestion(companyUser, 1);
    await assertApiError(
      () =>
        service.createHiringSimulation(
          companyUser,
          hiringSimulationInput(sourceQuestionSet.questionSetId),
        ),
      409,
      'QUESTION_NOT_ACTIVE',
    );
  });

  it('rejects another company accessing the posting during simulation creation', async () => {
    const service = createService();
    const sourceQuestionSet = await confirmQuickQuestionSet(service);

    await assertApiError(
      () =>
        service.createHiringSimulation(
          otherCompanyUser,
          hiringSimulationInput(sourceQuestionSet.questionSetId),
        ),
      403,
    );
  });

  it('reuses the same request key only when normalized input is unchanged', async () => {
    const service = createService();
    const sourceQuestionSet = await confirmQuickQuestionSet(service);
    const input = hiringSimulationInput(sourceQuestionSet.questionSetId, {
      requestKey: 'hiring-simulation:idempotent',
    });

    const first = await service.createHiringSimulation(companyUser, input);
    const replay = await service.createHiringSimulation(companyUser, {
      ...input,
      title: `  ${input.title}  `,
    });

    assert.equal(replay.cohort.cohortId, first.cohort.cohortId);
    assert.equal(replay.policy.policyVersion, first.policy.policyVersion);

    await assertApiError(
      () =>
        service.createHiringSimulation(companyUser, {
          ...input,
          capacity: input.capacity + 1,
        }),
      409,
      'REQUEST_KEY_REUSED',
    );
  });

  it('keeps prior versions and snapshots unchanged when another simulation is created', async () => {
    const service = createService();
    const sourceQuestionSet = await confirmQuickQuestionSet(service);
    const first = await service.createHiringSimulation(
      companyUser,
      hiringSimulationInput(sourceQuestionSet.questionSetId),
    );

    await service.updateQuestion(companyUser, 1, {
      criterionId: 1,
      questionType: 'TECHNICAL',
      content: '변경된 질문 내용은 기존 snapshot에 반영되면 안 됩니다.',
    });
    const second = await service.createHiringSimulation(
      companyUser,
      hiringSimulationInput(sourceQuestionSet.questionSetId, {
        requestKey: 'hiring-simulation:test-2',
        title: '두 번째 채용 판정 시뮬레이션',
        jobWeightPercent: 40,
        talentWeightPercent: 60,
      }),
    );
    const firstDetail = await service.getHiringSimulation(
      companyUser,
      first.cohort.cohortId,
    );

    assert.notEqual(first.cohort.cohortId, second.cohort.cohortId);
    assert.notEqual(first.policy.policyId, second.policy.policyId);
    assert.notEqual(first.policy.policyVersion, second.policy.policyVersion);
    assert.notEqual(
      first.questionSetSnapshot.snapshotVersion,
      second.questionSetSnapshot.snapshotVersion,
    );
    assert.equal(firstDetail.policy.policyVersion, first.policy.policyVersion);
    assert.equal(
      firstDetail.policy.snapshotJson.administratorInput.jobWeightPercent,
      60,
    );
    assert.equal(
      firstDetail.questionSetSnapshot.snapshotJson.questions.find(
        (question) => question.questionId === 1,
      )?.content,
      'REST API 계약을 먼저 문서화해야 하는 이유를 설명해주세요.',
    );
    assert.equal(
      second.questionSetSnapshot.snapshotJson.questions.find(
        (question) => question.questionId === 1,
      )?.content,
      '변경된 질문 내용은 기존 snapshot에 반영되면 안 됩니다.',
    );
  });
});
