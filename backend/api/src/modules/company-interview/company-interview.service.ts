import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CurrentUser } from '@init/common';
import { AiJobDispatcherService } from '../report/service/ai-job-dispatcher.service';
import { BuiltInNcsEvaluationSnapshotResolver } from '../interview/ncs-evaluation/built-in-ncs-evaluation-snapshot.resolver';
import {
  NCS_EVALUATION_SNAPSHOT_RESOLVER,
  type NcsEvaluationSnapshotResolver,
} from '../interview/ncs-evaluation/ncs-evaluation-snapshot';
import {
  EvaluationCriterionResponseDto,
  UpdateEvaluationCriterionDto,
} from './dto/evaluation-criterion.dto';
import {
  InterviewSettingsQueryDto,
  InterviewSettingsResponseDto,
} from './dto/interview-settings.dto';
import {
  CreateInterviewQuestionDto,
  CreateInterviewQuestionResponseDto,
  UpdateInterviewQuestionDto,
} from './dto/question-management.dto';
import {
  ActiveQuestionSetResponseDto,
  ConfirmQuestionSetDto,
  QuestionSetResponseDto,
} from './dto/question-set.dto';
import {
  UpdateInterviewTimePolicyDto,
  UpdateInterviewTimePolicyResponseDto,
} from './dto/time-policy.dto';
import {
  conflict,
  forbidden,
  notFound,
  validationFailed,
} from './company-interview.errors';
import {
  EvaluationCriterionRecord,
  HIRING_DECISION_MODES,
  HIRING_QUESTION_SET_MODES,
  HiringDecisionMode,
  HiringEvaluationContextSnapshotJson,
  HiringPolicySnapshot,
  HiringQuestionSetMode,
  HiringQuestionSetSnapshotJson,
  HiringSimulationConfigurationRecord,
  HiringTieBreakStep,
  PostingRecord,
  QuestionRecord,
  QuestionSetRecord,
} from './company-interview.types';
import {
  CreateHiringSimulationDto,
  EvaluateHiringAnswerDto,
  HiringAnswerEvaluationJobResponseDto,
  HiringSimulationResponseDto,
  LockHiringSimulationDto,
} from './dto/hiring-simulation.dto';
import {
  bindNcsSnapshotToHiringQuestion,
  createHiringEvaluationContextHash,
  HiringEvaluationContextValidationError,
  parseHiringEvaluationContextSnapshot,
  sameCanonicalValue,
  validateTalentRubricSnapshotJson,
} from './hiring-evaluation-context';
import {
  COMPANY_INTERVIEW_REPOSITORY,
  CompanyInterviewRepository,
  HiringEvaluationContextLockError,
  HiringQuestionSetChangedError,
  HiringSimulationRequestKeyConflictError,
} from './repositories/company-interview.repository';

const POSTGRES_INTEGER_MAX = 2_147_483_647;

@Injectable()
export class CompanyInterviewService {
  constructor(
    @Inject(COMPANY_INTERVIEW_REPOSITORY)
    private readonly repository: CompanyInterviewRepository,
    @Inject(NCS_EVALUATION_SNAPSHOT_RESOLVER)
    private readonly ncsEvaluationSnapshotResolver: NcsEvaluationSnapshotResolver =
      new BuiltInNcsEvaluationSnapshotResolver(),
    @Optional()
    private readonly aiJobDispatcher?: AiJobDispatcherService,
  ) {}

  async getSettings(
    currentUser: CurrentUser,
    query: InterviewSettingsQueryDto,
  ): Promise<InterviewSettingsResponseDto> {
    const posting = await this.getOwnedPosting(currentUser, query.postingId);
    const availableTags = await this.repository.listTags();
    const criteria = await this.repository.listCriteria(posting.postingId);
    const questions = await this.repository.listQuestions(posting.postingId);

    return {
      posting: {
        postingId: posting.postingId,
        title: posting.title,
        status: posting.status,
      },
      availableTags: availableTags.map((tag) => ({
        tagId: tag.tagId,
        jobRole: tag.jobRole,
        tagName: tag.name,
        category: tag.category,
        description: tag.description,
        sortOrder: tag.sortOrder,
      })),
      criteria: await this.mapCriteria(criteria),
      questions: questions.map((question) => ({
        questionId: question.questionId,
        criterionId: question.criterionId,
        questionType: question.questionType,
        content: question.content,
        isActive: question.isActive,
      })),
      timePolicy: await this.toTimePolicyDto(posting.postingId),
    };
  }

  async updateEvaluationCriteria(
    currentUser: CurrentUser,
    dto: UpdateEvaluationCriterionDto,
  ): Promise<EvaluationCriterionResponseDto> {
    const posting = await this.getOwnedPosting(currentUser, dto.postingId);
    const existingCriteria = await this.repository.listCriteria(posting.postingId);
    const seenSortOrders = new Set<number>();
    const seenTagIds = new Set<number>();

    for (const criterion of dto.criteria) {
      if (seenSortOrders.has(criterion.sortOrder)) {
        validationFailed('평가 기준 순서를 확인해주세요.', [
          { field: 'criteria[].sortOrder', reason: 'DUPLICATED' },
        ]);
      }
      seenSortOrders.add(criterion.sortOrder);
      if (seenTagIds.has(criterion.tagId)) {
        validationFailed('평가 태그가 중복되었습니다.', [
          { field: 'criteria[].tagId', reason: 'DUPLICATED' },
        ]);
      }
      seenTagIds.add(criterion.tagId);

      if (!(await this.repository.findTag(criterion.tagId))) {
        notFound('평가 태그를 찾을 수 없습니다.');
      }

      if (criterion.criterionId !== undefined) {
        const exists = existingCriteria.some(
          (item) => item.criterionId === criterion.criterionId,
        );
        if (!exists) {
          notFound('평가 기준을 찾을 수 없습니다.');
        }
      }
    }

    const totalWeight = dto.criteria.reduce(
      (sum, criterion) => sum + criterion.weight,
      0,
    );

    // Contract keeps the exact total-weight policy pending. For now the C
    // module accepts 1..100 and reports the total without changing DB rules.
    if (dto.criteria.length > 0 && (totalWeight <= 0 || totalWeight > 100)) {
      validationFailed('평가 기준 배점 합계를 확인해주세요.', [
        { field: 'criteria[].weight', reason: 'TOTAL_OUT_OF_RANGE' },
      ]);
    }

    const saved = await this.repository.replaceCriteria(
      posting.postingId,
      dto.criteria,
    );
    return {
      postingId: posting.postingId,
      criteria: await this.mapCriteria(saved),
      totalWeight,
    };
  }

  async createQuestion(
    currentUser: CurrentUser,
    dto: CreateInterviewQuestionDto,
  ): Promise<CreateInterviewQuestionResponseDto> {
    const posting = await this.getOwnedPosting(currentUser, dto.postingId);
    const criterion = await this.findPostingCriterion(
      posting.postingId,
      dto.criterionId,
    );

    if (await this.repository.findDuplicateQuestion(posting.postingId, dto.content)) {
      conflict('이미 등록된 질문입니다.');
    }

    const question = await this.repository.createQuestion({
      companyId: posting.companyId,
      postingId: posting.postingId,
      criterionId: criterion.criterionId,
      questionType: dto.questionType,
      content: dto.content,
    });

    return {
      postingId: posting.postingId,
      question: this.mapQuestion(question),
    };
  }

  async updateQuestion(
    currentUser: CurrentUser,
    questionId: number,
    dto: UpdateInterviewQuestionDto,
  ): Promise<CreateInterviewQuestionResponseDto> {
    this.assertCompanyUser(currentUser);
    const question = await this.findOwnedQuestion(currentUser, questionId);
    if (question.postingId === null) {
      validationFailed('공고에 연결된 질문만 수정할 수 있습니다.', [
        { field: 'questionId', reason: 'POSTING_REQUIRED' },
      ]);
    }
    const criterion = await this.findPostingCriterion(
      question.postingId,
      dto.criterionId,
    );
    const duplicate = await this.repository.findDuplicateQuestion(
      question.postingId,
      dto.content,
    );
    if (duplicate && duplicate.questionId !== questionId) {
      conflict('이미 등록된 질문입니다.');
    }

    const saved = await this.repository.updateQuestion(questionId, {
      criterionId: criterion.criterionId,
      questionType: dto.questionType,
      content: dto.content,
    });

    return {
      postingId: question.postingId,
      question: this.mapQuestion(saved),
    };
  }

  async deleteQuestion(
    currentUser: CurrentUser,
    questionId: number,
  ): Promise<CreateInterviewQuestionResponseDto> {
    this.assertCompanyUser(currentUser);
    const question = await this.findOwnedQuestion(currentUser, questionId);
    if (question.postingId === null) {
      validationFailed('공고에 연결된 질문만 삭제할 수 있습니다.', [
        { field: 'questionId', reason: 'POSTING_REQUIRED' },
      ]);
    }
    const saved = await this.repository.deactivateQuestion(questionId);

    return {
      postingId: question.postingId,
      question: this.mapQuestion(saved),
    };
  }

  async updateTimePolicy(
    currentUser: CurrentUser,
    dto: UpdateInterviewTimePolicyDto,
  ): Promise<UpdateInterviewTimePolicyResponseDto> {
    const posting = await this.getOwnedPosting(currentUser, dto.postingId);

    if (dto.answerTimeSec <= dto.preparationTimeSec) {
      validationFailed('답변 시간은 준비 시간보다 길어야 합니다.', [
        { field: 'answerTimeSec', reason: 'MUST_BE_GREATER_THAN_PREPARATION' },
      ]);
    }

    const timePolicy = await this.repository.updateTimePolicy(posting.postingId, {
      preparationTimeSec: dto.preparationTimeSec,
      answerTimeSec: dto.answerTimeSec,
      retryAllowed: dto.retryAllowed,
    });

    return {
      postingId: posting.postingId,
      timePolicy: {
        preparationTimeSec: timePolicy.preparationTimeSec,
        answerTimeSec: timePolicy.answerTimeSec,
        retryAllowed: timePolicy.retryAllowed,
      },
    };
  }

  async confirmQuestionSet(
    currentUser: CurrentUser,
    dto: ConfirmQuestionSetDto,
  ): Promise<QuestionSetResponseDto> {
    this.assertCompanyUser(currentUser);
    const posting = await this.getOwnedPosting(currentUser, dto.postingId);
    const seenSortOrders = new Set<number>();
    const seenQuestionIds = new Set<number>();

    for (const item of dto.items) {
      if (seenSortOrders.has(item.sortOrder)) {
        validationFailed('질문 세트 순서를 확인해주세요.', [
          { field: 'items[].sortOrder', reason: 'DUPLICATED' },
        ]);
      }
      seenSortOrders.add(item.sortOrder);

      if (seenQuestionIds.has(item.questionId)) {
        validationFailed('질문 세트에 중복 질문이 있습니다.', [
          { field: 'items[].questionId', reason: 'DUPLICATED' },
        ]);
      }
      seenQuestionIds.add(item.questionId);

      const question = await this.findOwnedQuestion(currentUser, item.questionId);
      if (question.postingId !== posting.postingId) {
        validationFailed('공고에 연결된 질문만 질문 세트에 포함할 수 있습니다.', [
          { field: 'items[].questionId', reason: 'POSTING_MISMATCH' },
        ]);
      }

      if (item.criterionId !== undefined && item.criterionId !== null) {
        await this.findPostingCriterion(posting.postingId, item.criterionId);
      }
    }

    const saved = await this.repository.confirmQuestionSet({
      postingId: posting.postingId,
      title: dto.title.trim() || '면접 질문 세트',
      sourceProcessLogId: dto.sourceProcessLogId,
      items: dto.items,
    });

    return this.mapQuestionSet(saved);
  }

  async getActiveQuestionSet(
    currentUser: CurrentUser,
    postingId?: number,
  ): Promise<ActiveQuestionSetResponseDto> {
    const posting = await this.getOwnedPosting(currentUser, postingId);
    const questionSet = await this.repository.findActiveQuestionSet(
      posting.postingId,
    );

    return {
      postingId: posting.postingId,
      questionSet: questionSet ? this.mapQuestionSet(questionSet) : null,
      fallbackPolicy: 'USE_ACTIVE_POSTING_QUESTIONS',
    };
  }

  async createHiringSimulation(
    currentUser: CurrentUser,
    dto: CreateHiringSimulationDto,
  ): Promise<HiringSimulationResponseDto> {
    this.assertCompanyUser(currentUser);
    const decisionMode = dto.decisionMode ?? 'HYBRID';
    this.validateHiringSimulationInput(dto, decisionMode);

    const posting = await this.getOwnedPosting(currentUser, dto.postingId);
    const sourceQuestionSet = await this.getOwnedActiveQuestionSet(
      currentUser,
      posting,
      dto.sourceQuestionSetId,
    );
    const { questionCount, maxFollowUpCount } =
      this.resolveQuestionModeLimits(dto);
    const questions = this.snapshotSelectedQuestions(
      currentUser,
      posting,
      sourceQuestionSet,
      dto.orderedQuestionIds,
      questionCount,
    );
    const policySnapshot: HiringPolicySnapshot = {
      schemaVersion: 'hiring-evaluation-policy.v1',
      administratorInput: {
        postingId: posting.postingId,
        decisionMode,
        jobWeightPercent: dto.jobWeightPercent,
        talentWeightPercent: dto.talentWeightPercent,
        minimumJobScore: dto.minimumJobScore,
        minimumTalentScore: dto.minimumTalentScore,
        minimumEvidenceCoveragePercent:
          dto.minimumEvidenceCoveragePercent,
      },
      tieBreakOrder: this.buildTieBreakOrder(
        dto.jobWeightPercent,
        dto.talentWeightPercent,
      ),
    };
    const questionSnapshot: HiringQuestionSetSnapshotJson = {
      schemaVersion: 'hiring-question-set-configuration.v1',
      postingId: posting.postingId,
      sourceQuestionSetId: sourceQuestionSet.questionSetId,
      jobRole: posting.jobRole,
      mode: dto.questionSetMode,
      questionCount,
      maxFollowUpCount,
      questions,
    };
    const configurationHash = this.createHiringConfigurationHash({
      title: dto.title.trim(),
      capacity: dto.capacity,
      policy: policySnapshot,
      questionSet: questionSnapshot,
    });
    const existing =
      await this.repository.findHiringSimulationConfigurationByRequestKey(
        currentUser.userId,
        dto.requestKey,
      );
    if (existing) {
      if (existing.cohort.configurationHash !== configurationHash) {
        conflict('이미 다른 설정에 사용한 요청 키입니다.', [
          { field: 'requestKey', reason: 'REQUEST_KEY_REUSED' },
        ]);
      }
      return this.mapHiringSimulation(existing);
    }

    let configuration: HiringSimulationConfigurationRecord;
    try {
      configuration = await this.repository.createHiringSimulationConfiguration({
        policy: {
          postingId: posting.postingId,
          createdByUserId: currentUser.userId,
          policyVersion: `hiring-policy-v1-${randomUUID()}`,
          decisionMode,
          jobWeightPercent: dto.jobWeightPercent,
          talentWeightPercent: dto.talentWeightPercent,
          minimumJobScore: dto.minimumJobScore,
          minimumTalentScore: dto.minimumTalentScore,
          minimumEvidenceCoveragePercent:
            dto.minimumEvidenceCoveragePercent,
          snapshotJson: policySnapshot,
        },
        questionSetSnapshot: {
          companyId: currentUser.companyId,
          postingId: posting.postingId,
          sourceQuestionSetId: sourceQuestionSet.questionSetId,
          expectedQuestionIds: questions.map((question) => question.questionId),
          snapshotVersion: `hiring-question-set-configuration-v1-${randomUUID()}`,
          jobRole: posting.jobRole,
          mode: dto.questionSetMode,
          questionCount,
          maxFollowUpCount,
          snapshotJson: questionSnapshot,
        },
        cohort: {
          companyId: currentUser.companyId,
          postingId: posting.postingId,
          createdByUserId: currentUser.userId,
          requestKey: dto.requestKey,
          configurationHash,
          title: dto.title.trim(),
          jobRole: posting.jobRole,
          capacity: dto.capacity,
        },
      });
    } catch (error) {
      if (error instanceof HiringQuestionSetChangedError) {
        conflict('저장 중 질문 세트가 변경되었습니다. 다시 확인해주세요.', [
          { field: 'sourceQuestionSetId', reason: 'QUESTION_SET_CHANGED' },
        ]);
      }
      if (error instanceof HiringSimulationRequestKeyConflictError) {
        conflict('이미 다른 설정에 사용한 요청 키입니다.', [
          { field: 'requestKey', reason: 'REQUEST_KEY_REUSED' },
        ]);
      }
      throw error;
    }

    return this.mapHiringSimulation(configuration);
  }

  async getHiringSimulation(
    currentUser: CurrentUser,
    cohortId: number,
  ): Promise<HiringSimulationResponseDto> {
    this.assertCompanyUser(currentUser);
    this.assertIntegerInRange('cohortId', cohortId, 1, Number.MAX_SAFE_INTEGER);

    const configuration =
      await this.repository.findHiringSimulationConfiguration(cohortId);
    if (!configuration) {
      notFound('채용 판정 시뮬레이션을 찾을 수 없습니다.', [
        { field: 'cohortId', reason: 'RESOURCE_NOT_FOUND' },
      ]);
    }
    if (configuration.cohort.companyId !== currentUser.companyId) {
      forbidden('채용 판정 시뮬레이션 접근 권한이 없습니다.', [
        { field: 'cohortId', reason: 'COMPANY_OWNERSHIP_MISMATCH' },
      ]);
    }

    return this.mapHiringSimulation(configuration);
  }

  async lockHiringSimulation(
    currentUser: CurrentUser,
    cohortId: number,
    dto: LockHiringSimulationDto,
  ): Promise<HiringSimulationResponseDto> {
    this.assertCompanyUser(currentUser);
    this.assertIntegerInRange('cohortId', cohortId, 1, Number.MAX_SAFE_INTEGER);
    if (!/^sha256:[0-9a-f]{64}$/u.test(dto.expectedConfigurationHash)) {
      validationFailed('설정 해시를 확인해주세요.', [
        { field: 'expectedConfigurationHash', reason: 'INVALID_HASH' },
      ]);
    }

    let talentRubric;
    try {
      talentRubric = validateTalentRubricSnapshotJson(dto.talentRubric);
    } catch (error) {
      if (error instanceof HiringEvaluationContextValidationError) {
        validationFailed('인재상 루브릭 계약을 확인해주세요.', [
          { field: error.field, reason: error.reason },
        ]);
      }
      throw error;
    }

    const configuration =
      await this.repository.findHiringSimulationConfiguration(cohortId);
    if (!configuration) {
      notFound('채용 판정 시뮬레이션을 찾을 수 없습니다.', [
        { field: 'cohortId', reason: 'RESOURCE_NOT_FOUND' },
      ]);
    }
    if (configuration.cohort.companyId !== currentUser.companyId) {
      forbidden('채용 판정 시뮬레이션 접근 권한이 없습니다.', [
        { field: 'cohortId', reason: 'COMPANY_OWNERSHIP_MISMATCH' },
      ]);
    }
    if (
      configuration.cohort.configurationHash !==
      dto.expectedConfigurationHash
    ) {
      conflict('시뮬레이션 설정이 변경되었습니다.', [
        {
          field: 'expectedConfigurationHash',
          reason: 'CONFIGURATION_CHANGED',
        },
      ]);
    }

    if (configuration.cohort.status === 'LOCKED') {
      const context = parseHiringEvaluationContextSnapshot(
        configuration.questionSetSnapshot.snapshotJson,
      );
      if (
        context &&
        sameCanonicalValue(context.talentRubric, talentRubric)
      ) {
        return this.mapHiringSimulation(configuration);
      }
      conflict('이미 다른 평가 컨텍스트로 잠긴 시뮬레이션입니다.', [
        { field: 'talentRubric', reason: 'CONTEXT_MISMATCH' },
      ]);
    }
    if (configuration.cohort.status !== 'OPEN') {
      conflict('열린 시뮬레이션만 평가 컨텍스트를 잠글 수 있습니다.', [
        { field: 'cohortId', reason: 'COHORT_NOT_OPEN' },
      ]);
    }

    const sourceSnapshot = configuration.questionSetSnapshot.snapshotJson;
    if (
      sourceSnapshot.schemaVersion !==
      'hiring-question-set-configuration.v1'
    ) {
      conflict('질문 설정 스냅샷이 변경되었습니다.', [
        { field: 'questionSetSnapshot', reason: 'CONFIGURATION_CHANGED' },
      ]);
    }

    const questions = sourceSnapshot.questions.map((question) => {
      if (
        question.questionType !== 'TECHNICAL' &&
        question.questionType !== 'EXPERIENCE' &&
        question.questionType !== 'SITUATION'
      ) {
        validationFailed('NCS 평가 가능한 질문 유형을 선택해주세요.', [
          {
            field: `questionSetSnapshot.questions[${question.order - 1}].questionType`,
            reason: 'NCS_SNAPSHOT_UNAVAILABLE',
          },
        ]);
      }
      const resolved = this.ncsEvaluationSnapshotResolver.resolve({
        questionId: question.questionId,
        questionType: question.questionType,
        content: question.content,
        sortOrder: question.order,
        interviewType: 'RECRUITING',
        jobRole: sourceSnapshot.jobRole,
        postingId: configuration.cohort.postingId,
        ...(question.criterionId === null
          ? {}
          : { criterionId: question.criterionId }),
        isActive: true,
      });
      if (!resolved) {
        validationFailed('질문의 NCS 평가 기준을 생성할 수 없습니다.', [
          {
            field: `questionSetSnapshot.questions[${question.order - 1}]`,
            reason: 'NCS_SNAPSHOT_UNAVAILABLE',
          },
        ]);
      }
      return {
        ...question,
        questionType: question.questionType,
        ncsEvaluationSnapshot: bindNcsSnapshotToHiringQuestion(
          resolved,
          question,
          sourceSnapshot.jobRole,
        ),
      };
    });

    const contextVersion = `hiring-evaluation-context-v1-${randomUUID()}`;
    const hashInput = {
      schemaVersion: 'hiring-evaluation-context.v1' as const,
      calculationContractVersion: 'hiring-evaluation.v1' as const,
      cohort: {
        cohortId: configuration.cohort.cohortId,
        companyId: configuration.cohort.companyId,
        postingId: configuration.cohort.postingId,
        configurationHash: configuration.cohort.configurationHash,
      },
      sourceConfiguration: {
        policyId: configuration.policy.policyId,
        policyVersion: configuration.policy.policyVersion,
        questionSetSnapshotId:
          configuration.questionSetSnapshot.questionSetSnapshotId,
        questionSetSnapshotVersion:
          configuration.questionSetSnapshot.snapshotVersion,
      },
      policy: configuration.policy.snapshotJson,
      questionSet: {
        sourceQuestionSetId: sourceSnapshot.sourceQuestionSetId,
        jobRole: sourceSnapshot.jobRole,
        mode: sourceSnapshot.mode,
        questionCount: sourceSnapshot.questionCount,
        maxFollowUpCount: sourceSnapshot.maxFollowUpCount,
        questions,
      },
      talentRubric,
    };
    const contextSnapshot: HiringEvaluationContextSnapshotJson = {
      ...hashInput,
      contextVersion,
      contextHash: createHiringEvaluationContextHash(hashInput),
    };

    try {
      const locked = await this.repository.lockHiringEvaluationContext({
        cohortId,
        companyId: currentUser.companyId,
        expectedConfigurationHash: dto.expectedConfigurationHash,
        expectedQuestionSetSnapshotId:
          configuration.questionSetSnapshot.questionSetSnapshotId,
        contextSnapshotVersion: contextVersion,
        contextHash: contextSnapshot.contextHash,
        snapshotJson: contextSnapshot,
      });
      return this.mapHiringSimulation(locked);
    } catch (error) {
      if (error instanceof HiringEvaluationContextLockError) {
        conflict('평가 컨텍스트 잠금 상태가 변경되었습니다.', [
          { field: 'cohortId', reason: error.reason },
        ]);
      }
      throw error;
    }
  }

  async evaluateHiringAnswer(
    currentUser: CurrentUser,
    cohortId: number,
    dto: EvaluateHiringAnswerDto,
  ): Promise<HiringAnswerEvaluationJobResponseDto> {
    this.assertCompanyUser(currentUser);
    this.assertIntegerInRange('cohortId', cohortId, 1, Number.MAX_SAFE_INTEGER);
    this.assertIntegerInRange(
      'sessionId',
      dto.sessionId,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    this.assertIntegerInRange(
      'questionId',
      dto.questionId,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    this.assertIntegerInRange(
      'primaryAnswerId',
      dto.primaryAnswerId,
      1,
      Number.MAX_SAFE_INTEGER,
    );

    const configuration =
      await this.repository.findHiringSimulationConfiguration(cohortId);
    if (!configuration) {
      notFound('채용 판정 시뮬레이션을 찾을 수 없습니다.', [
        { field: 'cohortId', reason: 'RESOURCE_NOT_FOUND' },
      ]);
    }
    if (configuration.cohort.companyId !== currentUser.companyId) {
      forbidden('채용 판정 시뮬레이션 접근 권한이 없습니다.', [
        { field: 'cohortId', reason: 'COMPANY_OWNERSHIP_MISMATCH' },
      ]);
    }
    const context = parseHiringEvaluationContextSnapshot(
      configuration.questionSetSnapshot.snapshotJson,
    );
    if (configuration.cohort.status !== 'LOCKED' || !context) {
      conflict('잠긴 평가 컨텍스트가 필요합니다.', [
        { field: 'cohortId', reason: 'EVALUATION_CONTEXT_NOT_LOCKED' },
      ]);
    }

    const source = await this.repository.findHiringAnswerEvaluationSource(
      dto.sessionId,
      dto.questionId,
      dto.primaryAnswerId,
    );
    if (!source) {
      notFound('평가할 저장 답변을 찾을 수 없습니다.', [
        { field: 'primaryAnswerId', reason: 'RESOURCE_NOT_FOUND' },
      ]);
    }
    if (
      source.interviewType !== 'RECRUITING' ||
      source.postingId !== context.cohort.postingId ||
      source.primaryAnswer.questionId !== dto.questionId
    ) {
      conflict('답변이 잠긴 평가 대상과 일치하지 않습니다.', [
        { field: 'sessionId', reason: 'EVALUATION_CONTEXT_MISMATCH' },
      ]);
    }
    if (!['IN_PROGRESS', 'COMPLETED'].includes(source.sessionStatus)) {
      conflict('답변 평가가 가능한 면접 세션 상태가 아닙니다.', [
        { field: 'sessionId', reason: 'SESSION_NOT_EVALUABLE' },
      ]);
    }

    const sameQuestionSet =
      source.assignedQuestions.length === context.questionSet.questions.length &&
      source.assignedQuestions.every((question, index) => {
        const expected = context.questionSet.questions[index];
        return (
          expected?.questionId === question.questionId &&
          expected.questionType === question.questionType &&
          expected.content === question.content &&
          expected.order - 1 === question.sortOrder
        );
      });
    if (!sameQuestionSet) {
      conflict('면접 세션의 질문 세트가 잠긴 설정과 다릅니다.', [
        { field: 'sessionId', reason: 'SESSION_QUESTION_SET_MISMATCH' },
      ]);
    }
    if (
      !context.questionSet.questions.some(
        (question) => question.questionId === dto.questionId,
      )
    ) {
      conflict('질문이 잠긴 평가 컨텍스트에 포함되지 않았습니다.', [
        { field: 'questionId', reason: 'QUESTION_NOT_IN_CONTEXT' },
      ]);
    }
    if (source.followUpsUsed > context.questionSet.maxFollowUpCount) {
      conflict('면접 세션의 꼬리질문 수가 잠긴 한도를 초과했습니다.', [
        { field: 'sessionId', reason: 'FOLLOW_UP_LIMIT_EXCEEDED' },
      ]);
    }

    const turns: Array<{
      turnId: string;
      answerId: number;
      kind: 'PRIMARY' | 'FOLLOW_UP';
      transcript: string;
    }> = [
      {
        turnId: `answer:${source.primaryAnswer.answerId}`,
        answerId: source.primaryAnswer.answerId,
        kind: 'PRIMARY',
        transcript: this.canonicalEvaluationTranscript(
          source.primaryAnswer.transcript,
          'primaryAnswerId',
        ),
      },
    ];
    if (source.followUpAnswer) {
      turns.push({
        turnId: `answer:${source.followUpAnswer.answerId}`,
        answerId: source.followUpAnswer.answerId,
        kind: 'FOLLOW_UP',
        transcript: this.canonicalEvaluationTranscript(
          source.followUpAnswer.transcript,
          'followUpAnswer',
        ),
      });
    }
    if (!this.aiJobDispatcher) {
      conflict('AI 평가 작업 큐를 사용할 수 없습니다.', [
        { field: 'cohortId', reason: 'AI_DISPATCH_UNAVAILABLE' },
      ]);
    }

    const evaluationInput = {
      contractVersion: 'hiring-answer-evaluation.v1' as const,
      context,
      candidateId: source.candidateId,
      sessionId: source.sessionId,
      questionId: dto.questionId,
      followUpsUsed: source.followUpsUsed,
      turns,
    };
    const inputHash = createHash('sha256')
      .update(JSON.stringify(evaluationInput), 'utf8')
      .digest('hex');
    const process = await this.aiJobDispatcher.dispatch({
      processType: 'REPORT_GENERATE',
      input: {
        kind: 'HIRING_ANSWER_EVALUATION',
        requestedBy: {
          userId: currentUser.userId,
          userType: currentUser.userType,
          companyId: currentUser.companyId,
        },
        payload: {
          step: 'HIRING_ANSWER_EVALUATION',
          ...evaluationInput,
        },
      },
      refs: {
        sessionId: source.sessionId,
        ...(source.applicationId === null
          ? {}
          : { applicationId: source.applicationId }),
      },
      idempotencyKey: `hiring-answer-eval:${cohortId}:${inputHash}`,
    });
    return {
      accepted: true,
      processLogId: process.processLogId,
      status: process.status,
      queued: process.queued,
      deduplicated: process.deduplicated,
      contextVersion: context.contextVersion,
      cohortId,
      candidateId: source.candidateId,
      sessionId: source.sessionId,
      questionId: dto.questionId,
      primaryAnswerId: source.primaryAnswer.answerId,
    };
  }

  private async getOwnedPosting(currentUser: CurrentUser, postingId?: number) {
    this.assertCompanyUser(currentUser);

    const posting =
      postingId === undefined
        ? await this.repository.findDefaultPosting(currentUser.companyId)
        : await this.repository.findPosting(postingId);

    if (!posting) {
      notFound('공고를 찾을 수 없습니다.', [
        { field: 'postingId', reason: 'RESOURCE_NOT_FOUND' },
      ]);
    }

    if (posting.companyId !== currentUser.companyId) {
      forbidden('공고 접근 권한이 없습니다.', [
        { field: 'postingId', reason: 'COMPANY_OWNERSHIP_MISMATCH' },
      ]);
    }

    return posting;
  }

  private assertCompanyUser(
    currentUser: CurrentUser,
  ): asserts currentUser is CurrentUser & { companyId: number } {
    if (currentUser.userType !== 'COMPANY' || currentUser.companyId === null) {
      forbidden('기업 사용자만 접근할 수 있습니다.');
    }
  }

  private validateHiringSimulationInput(
    dto: CreateHiringSimulationDto,
    decisionMode: HiringDecisionMode,
  ): void {
    if (
      typeof dto.requestKey !== 'string' ||
      dto.requestKey.length < 8 ||
      dto.requestKey.length > 128 ||
      !/^[A-Za-z0-9._:-]+$/.test(dto.requestKey)
    ) {
      validationFailed('요청 키를 확인해주세요.', [
        { field: 'requestKey', reason: 'OUT_OF_RANGE' },
      ]);
    }
    this.assertIntegerInRange(
      'postingId',
      dto.postingId,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    this.assertIntegerInRange(
      'sourceQuestionSetId',
      dto.sourceQuestionSetId,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    this.assertIntegerInRange(
      'capacity',
      dto.capacity,
      1,
      POSTGRES_INTEGER_MAX,
    );
    this.assertIntegerInRange('jobWeightPercent', dto.jobWeightPercent, 0, 100);
    this.assertIntegerInRange(
      'talentWeightPercent',
      dto.talentWeightPercent,
      0,
      100,
    );
    this.assertIntegerInRange('minimumJobScore', dto.minimumJobScore, 0, 100);
    this.assertIntegerInRange(
      'minimumTalentScore',
      dto.minimumTalentScore,
      0,
      100,
    );
    this.assertIntegerInRange(
      'minimumEvidenceCoveragePercent',
      dto.minimumEvidenceCoveragePercent,
      0,
      100,
    );

    if (!HIRING_DECISION_MODES.some((mode) => mode === decisionMode)) {
      validationFailed('판정 방식을 확인해주세요.', [
        { field: 'decisionMode', reason: 'OUT_OF_RANGE' },
      ]);
    }
    if (
      !HIRING_QUESTION_SET_MODES.some(
        (mode) => mode === dto.questionSetMode,
      )
    ) {
      validationFailed('질문 모드를 확인해주세요.', [
        { field: 'questionSetMode', reason: 'OUT_OF_RANGE' },
      ]);
    }
    if (dto.jobWeightPercent + dto.talentWeightPercent !== 100) {
      validationFailed('직무와 인재상 비중 합은 100이어야 합니다.', [
        {
          field: 'jobWeightPercent,talentWeightPercent',
          reason: 'WEIGHT_SUM_MUST_EQUAL_100',
        },
      ]);
    }

    const title = typeof dto.title === 'string' ? dto.title.trim() : '';
    if (title.length === 0 || title.length > 200) {
      validationFailed('코호트 이름을 확인해주세요.', [
        { field: 'title', reason: 'OUT_OF_RANGE' },
      ]);
    }
    if (
      !Array.isArray(dto.orderedQuestionIds) ||
      dto.orderedQuestionIds.some(
        (questionId) => !Number.isInteger(questionId) || questionId < 1,
      )
    ) {
      validationFailed('질문 ID를 확인해주세요.', [
        { field: 'orderedQuestionIds', reason: 'OUT_OF_RANGE' },
      ]);
    }
  }

  private resolveQuestionModeLimits(dto: CreateHiringSimulationDto): {
    questionCount: number;
    maxFollowUpCount: number;
  } {
    const fixedLimits: Partial<
      Record<
        HiringQuestionSetMode,
        { questionCount: number; maxFollowUpCount: number }
      >
    > = {
      QUICK: { questionCount: 3, maxFollowUpCount: 2 },
      STANDARD: { questionCount: 5, maxFollowUpCount: 3 },
      DEEP: { questionCount: 7, maxFollowUpCount: 4 },
    };
    const fixed = fixedLimits[dto.questionSetMode];
    if (fixed) {
      if (
        dto.questionCount !== undefined ||
        dto.maxFollowUpCount !== undefined
      ) {
        validationFailed('고정 질문 모드의 개수는 변경할 수 없습니다.', [
          {
            field: 'questionCount,maxFollowUpCount',
            reason: 'FIXED_MODE_COUNTS_NOT_ALLOWED',
          },
        ]);
      }
      return fixed;
    }

    if (
      dto.questionCount === undefined ||
      dto.maxFollowUpCount === undefined
    ) {
      validationFailed('CUSTOM 질문 모드의 개수와 한도를 입력해주세요.', [
        {
          field: 'questionCount,maxFollowUpCount',
          reason: 'CUSTOM_COUNTS_REQUIRED',
        },
      ]);
    }
    this.assertIntegerInRange(
      'questionCount',
      dto.questionCount,
      1,
      POSTGRES_INTEGER_MAX,
    );
    this.assertIntegerInRange(
      'maxFollowUpCount',
      dto.maxFollowUpCount,
      0,
      POSTGRES_INTEGER_MAX,
    );

    return {
      questionCount: dto.questionCount,
      maxFollowUpCount: dto.maxFollowUpCount,
    };
  }

  private async getOwnedActiveQuestionSet(
    currentUser: CurrentUser & { companyId: number },
    posting: PostingRecord,
    questionSetId: number,
  ): Promise<QuestionSetRecord> {
    const questionSet = await this.repository.findQuestionSet(questionSetId);
    if (!questionSet) {
      notFound('질문 세트를 찾을 수 없습니다.', [
        { field: 'sourceQuestionSetId', reason: 'RESOURCE_NOT_FOUND' },
      ]);
    }

    const questionSetPosting = await this.repository.findPosting(
      questionSet.postingId,
    );
    if (!questionSetPosting) {
      notFound('질문 세트의 공고를 찾을 수 없습니다.', [
        { field: 'sourceQuestionSetId', reason: 'RESOURCE_NOT_FOUND' },
      ]);
    }
    if (questionSetPosting.companyId !== currentUser.companyId) {
      forbidden('질문 세트 접근 권한이 없습니다.', [
        {
          field: 'sourceQuestionSetId',
          reason: 'COMPANY_OWNERSHIP_MISMATCH',
        },
      ]);
    }
    if (questionSet.postingId !== posting.postingId) {
      validationFailed('공고의 질문 세트를 선택해주세요.', [
        { field: 'sourceQuestionSetId', reason: 'POSTING_MISMATCH' },
      ]);
    }

    const activeQuestionSet = await this.repository.findActiveQuestionSet(
      posting.postingId,
    );
    if (
      questionSet.status !== 'ACTIVE' ||
      activeQuestionSet?.questionSetId !== questionSet.questionSetId
    ) {
      conflict('현재 활성 질문 세트를 선택해주세요.', [
        { field: 'sourceQuestionSetId', reason: 'QUESTION_SET_NOT_ACTIVE' },
      ]);
    }

    return questionSet;
  }

  private snapshotSelectedQuestions(
    currentUser: CurrentUser & { companyId: number },
    posting: PostingRecord,
    questionSet: QuestionSetRecord,
    orderedQuestionIds: number[],
    questionCount: number,
  ) {
    if (orderedQuestionIds.length !== questionCount) {
      validationFailed('질문 수가 선택한 모드와 일치하지 않습니다.', [
        { field: 'orderedQuestionIds', reason: 'QUESTION_COUNT_MISMATCH' },
      ]);
    }
    if (new Set(orderedQuestionIds).size !== orderedQuestionIds.length) {
      validationFailed('질문 ID가 중복되었습니다.', [
        { field: 'orderedQuestionIds', reason: 'DUPLICATED' },
      ]);
    }

    const itemsByQuestionId = new Map(
      questionSet.items.map((item) => [item.questionId, item]),
    );
    return orderedQuestionIds.map((questionId, index) => {
      const item = itemsByQuestionId.get(questionId);
      if (!item) {
        validationFailed('활성 질문 세트에 포함된 질문을 선택해주세요.', [
          {
            field: 'orderedQuestionIds',
            reason: 'QUESTION_NOT_IN_ACTIVE_SET',
          },
        ]);
      }
      if (!item.question) {
        notFound('질문 세트의 질문을 찾을 수 없습니다.', [
          { field: 'orderedQuestionIds', reason: 'RESOURCE_NOT_FOUND' },
        ]);
      }
      if (!item.question.isActive) {
        conflict('활성 질문만 채용 시뮬레이션에 사용할 수 있습니다.', [
          { field: 'orderedQuestionIds', reason: 'QUESTION_NOT_ACTIVE' },
        ]);
      }
      if (item.question.companyId !== currentUser.companyId) {
        forbidden('질문 접근 권한이 없습니다.', [
          {
            field: 'orderedQuestionIds',
            reason: 'COMPANY_OWNERSHIP_MISMATCH',
          },
        ]);
      }
      if (item.question.postingId !== posting.postingId) {
        validationFailed('공고의 질문을 선택해주세요.', [
          { field: 'orderedQuestionIds', reason: 'POSTING_MISMATCH' },
        ]);
      }

      return {
        questionId,
        order: index + 1,
        questionType: item.question.questionType,
        content: item.question.content,
        criterionId: item.criterionId ?? item.question.criterionId,
      };
    });
  }

  private buildTieBreakOrder(
    jobWeightPercent: number,
    talentWeightPercent: number,
  ): HiringTieBreakStep[] {
    const order: HiringTieBreakStep[] = [
      { field: 'WEIGHTED_TOTAL_SCORE', direction: 'DESC' },
    ];
    if (jobWeightPercent !== talentWeightPercent) {
      const track = jobWeightPercent > talentWeightPercent ? 'JOB' : 'TALENT';
      order.push(
        { field: 'PRIMARY_TRACK_SCORE', direction: 'DESC', track },
        {
          field: 'PRIMARY_TRACK_DETAIL_WEIGHT_ORDER',
          direction: 'DESC',
          track,
        },
      );
    }
    order.push({ field: 'EVIDENCE_COVERAGE_PERCENT', direction: 'DESC' });
    return order;
  }

  private createHiringConfigurationHash(value: {
    title: string;
    capacity: number;
    policy: HiringPolicySnapshot;
    questionSet: HiringQuestionSetSnapshotJson;
  }): string {
    return `sha256:${createHash('sha256')
      .update(JSON.stringify(value), 'utf8')
      .digest('hex')}`;
  }

  private assertIntegerInRange(
    field: string,
    value: number,
    minimum: number,
    maximum: number,
  ): void {
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      validationFailed('입력값의 범위를 확인해주세요.', [
        { field, reason: 'OUT_OF_RANGE' },
      ]);
    }
  }

  private canonicalEvaluationTranscript(
    value: string | null,
    field: string,
  ): string {
    const transcript = value?.trim();
    if (!transcript || transcript.length > 20_000) {
      conflict('STT 발화가 준비된 답변만 평가할 수 있습니다.', [
        { field, reason: 'TRANSCRIPT_NOT_READY' },
      ]);
    }
    return transcript;
  }

  private async findCriterion(criterionId: number): Promise<EvaluationCriterionRecord> {
    const criterion = await this.repository.findCriterion(criterionId);

    if (!criterion) {
      notFound('평가 기준을 찾을 수 없습니다.');
    }

    return criterion;
  }

  private async findPostingCriterion(
    postingId: number,
    criterionId: number,
  ): Promise<EvaluationCriterionRecord> {
    const criterion = await this.findCriterion(criterionId);

    if (criterion.postingId !== postingId) {
      validationFailed('공고에 연결된 평가 기준을 선택해주세요.', [
        { field: 'criterionId', reason: 'POSTING_MISMATCH' },
      ]);
    }

    return criterion;
  }

  private async findOwnedQuestion(
    currentUser: CurrentUser & { companyId: number },
    questionId: number,
  ): Promise<QuestionRecord> {
    const question = await this.repository.findQuestion(questionId);

    if (!question || !question.isActive) {
      notFound('질문을 찾을 수 없습니다.');
    }

    if (question.companyId !== currentUser.companyId) {
      forbidden('질문 접근 권한이 없습니다.');
    }

    return question;
  }

  private async mapCriteria(criteria: EvaluationCriterionRecord[]) {
    return Promise.all(
      criteria.map(async (criterion) => {
        const tag = await this.repository.findTag(criterion.tagId);
        if (!tag) {
          notFound('평가 태그를 찾을 수 없습니다.');
        }

        return {
          criterionId: criterion.criterionId,
          tagId: criterion.tagId,
          tagName: tag.name,
          category: tag.category,
          description: tag.description,
          weight: criterion.weight,
          passScore: criterion.passScore,
          sortOrder: criterion.sortOrder,
        };
      }),
    );
  }

  private async toTimePolicyDto(postingId: number) {
    const timePolicy = await this.repository.getTimePolicy(postingId);
    return {
      preparationTimeSec: timePolicy.preparationTimeSec,
      answerTimeSec: timePolicy.answerTimeSec,
      retryAllowed: timePolicy.retryAllowed,
    };
  }

  private mapQuestion(question: QuestionRecord) {
    return {
      questionId: question.questionId,
      postingId: question.postingId,
      criterionId: question.criterionId,
      questionType: question.questionType,
      content: question.content,
      isActive: question.isActive,
    };
  }

  private mapQuestionSet(questionSet: QuestionSetRecord): QuestionSetResponseDto {
    return {
      questionSetId: questionSet.questionSetId,
      postingId: questionSet.postingId,
      title: questionSet.title,
      status: questionSet.status,
      createdByProcessLogId: questionSet.createdByProcessLogId,
      items: questionSet.items.map((item) => ({
        questionSetItemId: item.questionSetItemId,
        questionId: item.questionId,
        criterionId: item.criterionId,
        sortOrder: item.sortOrder,
        questionType: item.question?.questionType,
        content: item.question?.content,
        isActive: item.question?.isActive,
      })),
    };
  }

  private mapHiringSimulation(
    configuration: HiringSimulationConfigurationRecord,
  ): HiringSimulationResponseDto {
    return {
      cohort: {
        cohortId: configuration.cohort.cohortId,
        postingId: configuration.cohort.postingId,
        policyId: configuration.cohort.policyId,
        questionSetSnapshotId:
          configuration.cohort.questionSetSnapshotId,
        configurationHash: configuration.cohort.configurationHash,
        title: configuration.cohort.title,
        jobRole: configuration.cohort.jobRole,
        status: configuration.cohort.status,
        capacity: configuration.cohort.capacity,
        openedAt: configuration.cohort.openedAt.toISOString(),
        lockedAt: configuration.cohort.lockedAt?.toISOString() ?? null,
        createdAt: configuration.cohort.createdAt.toISOString(),
      },
      policy: {
        policyId: configuration.policy.policyId,
        policyVersion: configuration.policy.policyVersion,
        decisionMode: configuration.policy.decisionMode,
        jobWeightPercent: configuration.policy.jobWeightPercent,
        talentWeightPercent: configuration.policy.talentWeightPercent,
        minimumJobScore: configuration.policy.minimumJobScore,
        minimumTalentScore: configuration.policy.minimumTalentScore,
        minimumEvidenceCoveragePercent:
          configuration.policy.minimumEvidenceCoveragePercent,
        tieBreakMode: configuration.policy.tieBreakMode,
        snapshotJson: configuration.policy.snapshotJson,
        createdAt: configuration.policy.createdAt.toISOString(),
      },
      questionSetSnapshot: {
        questionSetSnapshotId:
          configuration.questionSetSnapshot.questionSetSnapshotId,
        sourceQuestionSetId:
          configuration.questionSetSnapshot.sourceQuestionSetId,
        snapshotVersion: configuration.questionSetSnapshot.snapshotVersion,
        jobRole: configuration.questionSetSnapshot.jobRole,
        mode: configuration.questionSetSnapshot.mode,
        questionCount: configuration.questionSetSnapshot.questionCount,
        maxFollowUpCount:
          configuration.questionSetSnapshot.maxFollowUpCount,
        snapshotJson: configuration.questionSetSnapshot.snapshotJson,
        createdAt:
          configuration.questionSetSnapshot.createdAt.toISOString(),
      },
    };
  }
}
