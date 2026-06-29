import { Inject, Injectable } from '@nestjs/common';
import {
  EvaluationCriterionResponseDto,
  SuggestEvaluationCriterionDto,
  UpdateEvaluationCriterionDto,
} from './dto/evaluation-criterion.dto';
import {
  InterviewSettingsQueryDto,
  InterviewSettingsResponseDto,
} from './dto/interview-settings.dto';
import { forbidden, notFound, validationFailed } from './company-interview.errors';
import { CurrentUser, EvaluationCriterionRecord } from './company-interview.types';
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

  getSettings(
    currentUser: CurrentUser,
    query: InterviewSettingsQueryDto,
  ): InterviewSettingsResponseDto {
    const posting = this.getOwnedPosting(currentUser, query.postingId);
    const criteria = this.repository.listCriteria(posting.postingId);

    return {
      posting: {
        postingId: posting.postingId,
        title: posting.title,
        status: posting.status,
      },
      criteria: this.mapCriteria(criteria),
      questions: this.repository.listQuestions(posting.postingId).map((question) => ({
        questionId: question.questionId,
        criterionId: question.criterionId,
        questionType: question.questionType,
        content: question.content,
        isActive: question.isActive,
      })),
      timePolicy: this.toTimePolicyDto(posting.postingId),
    };
  }

  suggestEvaluationCriteria(
    currentUser: CurrentUser,
    dto: SuggestEvaluationCriterionDto,
  ) {
    this.getOwnedPosting(currentUser, dto.postingId);

    // Temporary adapter boundary: this creates only an in-memory tracking id.
    // AI execution, queue payload, and candidate persistence remain E/A owned.
    return this.repository.createPendingProcessLog();
  }

  updateEvaluationCriteria(
    currentUser: CurrentUser,
    dto: UpdateEvaluationCriterionDto,
  ): EvaluationCriterionResponseDto {
    const posting = this.getOwnedPosting(currentUser, dto.postingId);
    const seenSortOrders = new Set<number>();

    for (const criterion of dto.criteria) {
      if (seenSortOrders.has(criterion.sortOrder)) {
        validationFailed('평가 기준 순서를 확인해주세요.', [
          { field: 'criteria[].sortOrder', reason: 'DUPLICATED' },
        ]);
      }
      seenSortOrders.add(criterion.sortOrder);

      if (!this.repository.findTag(criterion.tagId)) {
        notFound('평가 태그를 찾을 수 없습니다.');
      }

      if (criterion.criterionId !== undefined) {
        const exists = this.repository
          .listCriteria(posting.postingId)
          .some((item) => item.criterionId === criterion.criterionId);
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

    const saved = this.repository.replaceCriteria(posting.postingId, dto.criteria);
    return {
      postingId: posting.postingId,
      criteria: this.mapCriteria(saved),
      totalWeight,
    };
  }

  private getOwnedPosting(currentUser: CurrentUser, postingId?: number) {
    this.assertCompanyUser(currentUser);

    const posting =
      postingId === undefined
        ? this.repository.findDefaultPosting(currentUser.companyId)
        : this.repository.findPosting(postingId);

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

  private findCriterion(criterionId: number): EvaluationCriterionRecord {
    const criterion = this.repository.findCriterion(criterionId);

    if (!criterion) {
      notFound('평가 기준을 찾을 수 없습니다.');
    }

    return criterion;
  }

  private mapCriteria(criteria: EvaluationCriterionRecord[]) {
    return criteria.map((criterion) => {
      const tag = this.repository.findTag(criterion.tagId);
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
    });
  }

  private toTimePolicyDto(postingId: number) {
    const timePolicy = this.repository.getTimePolicy(postingId);
    return {
      preparationTimeSec: timePolicy.preparationTimeSec,
      answerTimeSec: timePolicy.answerTimeSec,
      retryAllowed: timePolicy.retryAllowed,
    };
  }
}
