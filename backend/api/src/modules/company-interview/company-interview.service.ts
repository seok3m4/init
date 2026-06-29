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
import { forbidden, notFound, validationFailed } from './company-interview.errors';
import { EvaluationCriterionRecord } from './company-interview.types';
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
}
