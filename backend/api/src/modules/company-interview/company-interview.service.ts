import { Inject, Injectable } from '@nestjs/common';
import type { CurrentUser } from '@init/common';
import {
  EvaluationCriterionResponseDto,
  SuggestEvaluationCriterionDto,
  UpdateEvaluationCriterionDto,
} from './dto/evaluation-criterion.dto';
import {
  InterviewSettingsQueryDto,
  InterviewSettingsResponseDto,
} from './dto/interview-settings.dto';
import {
  CreateInterviewQuestionDto,
  CreateInterviewQuestionResponseDto,
  CreateQuestionSetDto,
  GenerateInterviewQuestionsDto,
  QuestionGenerationProcessResponseDto,
  QuestionSetResponseDto,
} from './dto/question-management.dto';
import {
  conflict,
  forbidden,
  notFound,
  validationFailed,
} from './company-interview.errors';
import {
  EvaluationCriterionRecord,
  QuestionRecord,
} from './company-interview.types';
import {
  COMPANY_INTERVIEW_REPOSITORY,
  CompanyInterviewRepository,
} from './repositories/company-interview.repository';

@Injectable()
export class CompanyInterviewService {
  constructor(
    @Inject(COMPANY_INTERVIEW_REPOSITORY)
    private readonly repository: CompanyInterviewRepository,
  ) {}

  async getSettings(
    currentUser: CurrentUser,
    query: InterviewSettingsQueryDto,
  ): Promise<InterviewSettingsResponseDto> {
    const posting = await this.getOwnedPosting(currentUser, query.postingId);
    const criteria = await this.repository.listCriteria(posting.postingId);
    const questions = await this.repository.listQuestions(posting.postingId);

    return {
      posting: {
        postingId: posting.postingId,
        title: posting.title,
        status: posting.status,
      },
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

  async suggestEvaluationCriteria(
    currentUser: CurrentUser,
    dto: SuggestEvaluationCriterionDto,
  ) {
    await this.getOwnedPosting(currentUser, dto.postingId);

    return this.repository.createPendingProcessLog({
      postingId: dto.postingId,
      inputRef: JSON.stringify({
        postingId: dto.postingId,
        jobRole: dto.jobRole,
        jdText: dto.jdText,
        companyFitText: dto.companyFitText,
        requestedCount: dto.requestedCount,
      }),
    });
  }

  async updateEvaluationCriteria(
    currentUser: CurrentUser,
    dto: UpdateEvaluationCriterionDto,
  ): Promise<EvaluationCriterionResponseDto> {
    const posting = await this.getOwnedPosting(currentUser, dto.postingId);
    const existingCriteria = await this.repository.listCriteria(posting.postingId);
    const seenSortOrders = new Set<number>();

    for (const criterion of dto.criteria) {
      if (seenSortOrders.has(criterion.sortOrder)) {
        validationFailed('평가 기준 순서를 확인해주세요.', [
          { field: 'criteria[].sortOrder', reason: 'DUPLICATED' },
        ]);
      }
      seenSortOrders.add(criterion.sortOrder);

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
    if (totalWeight <= 0 || totalWeight > 100) {
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

  async generateQuestions(
    currentUser: CurrentUser,
    dto: GenerateInterviewQuestionsDto,
  ): Promise<QuestionGenerationProcessResponseDto> {
    const posting = await this.getOwnedPosting(currentUser, dto.postingId);
    const criteria = await this.repository.listCriteria(posting.postingId);

    if (criteria.length === 0) {
      validationFailed('질문 생성을 위한 평가 기준이 필요합니다.', [
        { field: 'criteria', reason: 'EMPTY' },
      ]);
    }

    for (const criterionId of dto.criterionIds ?? []) {
      await this.findPostingCriterion(posting.postingId, criterionId);
    }

    return this.repository.createPendingProcessLog({
      postingId: posting.postingId,
      inputRef: JSON.stringify({
        postingId: dto.postingId,
        criterionIds: dto.criterionIds,
        questionTypes: dto.questionTypes,
        requestedCount: dto.requestedCount,
        jdText: dto.jdText,
      }),
    });
  }

  async createQuestionSet(
    currentUser: CurrentUser,
    dto: CreateQuestionSetDto,
  ): Promise<QuestionSetResponseDto> {
    const posting = await this.getOwnedPosting(currentUser, dto.postingId);
    const criteria = await this.repository.listCriteria(posting.postingId);

    if (criteria.length === 0) {
      validationFailed('질문 세트 구성을 위한 평가 기준이 필요합니다.', [
        { field: 'criteria', reason: 'EMPTY' },
      ]);
    }

    const availableQuestions = await this.resolveQuestionSetCandidates(
      posting.postingId,
      dto,
    );

    if (availableQuestions.length < dto.questionCount) {
      validationFailed('요청한 질문 수보다 사용 가능한 질문이 부족합니다.', [
        { field: 'questionCount', reason: 'NOT_ENOUGH_QUESTIONS' },
      ]);
    }

    const selectedQuestionIds = availableQuestions
      .slice(0, dto.questionCount)
      .map((question) => question.questionId);

    return {
      postingId: posting.postingId,
      questionSet: {
        questionIds: selectedQuestionIds,
        questionCount: selectedQuestionIds.length,
        readyForSession: selectedQuestionIds.length === dto.questionCount,
      },
    };
  }

  private async getOwnedPosting(currentUser: CurrentUser, postingId?: number) {
    this.assertCompanyUser(currentUser);

    const posting =
      postingId === undefined
        ? await this.repository.findDefaultPosting(currentUser.companyId)
        : await this.repository.findPosting(postingId);

    if (!posting) {
      notFound('공고를 찾을 수 없습니다.');
    }

    if (posting.companyId !== currentUser.companyId) {
      forbidden('공고 접근 권한이 없습니다.');
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

  private async resolveQuestionSetCandidates(
    postingId: number,
    dto: CreateQuestionSetDto,
  ): Promise<QuestionRecord[]> {
    if (dto.questionIds !== undefined) {
      const questions: QuestionRecord[] = [];
      for (const questionId of dto.questionIds) {
        const question = await this.repository.findQuestion(questionId);

        if (
          !question ||
          question.postingId !== postingId ||
          question.isActive !== true
        ) {
          notFound('질문을 찾을 수 없습니다.');
        }

        questions.push(question);
      }
      return questions;
    }

    return (await this.repository.listQuestions(postingId))
      .filter((question) => question.isActive)
      .filter(
        (question) =>
          dto.questionTypes === undefined ||
          dto.questionTypes.includes(question.questionType),
      );
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
}
