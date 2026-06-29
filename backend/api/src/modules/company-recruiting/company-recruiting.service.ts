import { Injectable } from "@nestjs/common";
import { PostingStatus, ScreeningDecision } from "@prisma/client";

import { ApiException } from "../../common/api.exception";
import type { CurrentUser } from "../../common/current-user.type";
import {
  InMemoryCompanyRecruitingInvitationAdapter,
  type CompanyRecruitingInvitationAdapterPort,
} from "./company-recruiting-invitation.adapter";
import type { CreateApplicantDto } from "./dto/create-applicant.dto";
import type { CreateRecruitmentDto } from "./dto/create-recruitment.dto";
import type { InviteApplicantDto } from "./dto/invite-applicant.dto";
import type { ListQueryDto } from "./dto/list-query.dto";
import type { UpdateScreeningStatusDto } from "./dto/update-screening-status.dto";
import type { CompanyRecruitingRepositoryPort } from "./company-recruiting.repository";
import type { ApplicantRecord, NormalizedListQuery, RecruitmentRecord } from "./company-recruiting.types";

@Injectable()
export class CompanyRecruitingService {
  constructor(
    private readonly repository: CompanyRecruitingRepositoryPort,
    private readonly invitationAdapter: CompanyRecruitingInvitationAdapterPort = new InMemoryCompanyRecruitingInvitationAdapter(),
  ) {}

  async createRecruitment(user: CurrentUser, dto: CreateRecruitmentDto) {
    const companyId = requireCompanyId(user);
    const startsOn = parseOptionalDate(dto.startsOn, "startsOn");
    const endsOn = parseOptionalDate(dto.endsOn, "endsOn");
    if (startsOn && endsOn && startsOn > endsOn) {
      throw new ApiException(400, "COMMON_VALIDATION_FAILED", "채용 시작일은 마감일보다 늦을 수 없습니다.", [
        { field: "startsOn", reason: "AFTER_ENDS_ON" },
      ]);
    }

    const posting = await this.repository.createPosting({
      companyId,
      title: dto.title.trim(),
      jobRole: dto.jobRole.trim(),
      jobDescription: dto.jobDescription?.trim() || null,
      startsOn,
      endsOn,
      status: (dto.status ?? PostingStatus.DRAFT) as PostingStatus,
    });
    return toRecruitmentResponse(posting);
  }

  async listRecruitments(user: CurrentUser, query: ListQueryDto) {
    const companyId = requireCompanyId(user);
    const normalized = normalizeListQuery(query, "createdAt");
    const [items, totalItems] = await Promise.all([
      this.repository.listPostings(companyId, normalized),
      this.repository.countPostings(companyId, normalized),
    ]);
    return {
      items: items.map(toRecruitmentResponse),
      page: buildPageMeta(normalized.page, normalized.limit, totalItems),
    };
  }

  async getRecruitment(user: CurrentUser, recruitmentId: number) {
    const companyId = requireCompanyId(user);
    const posting = await this.repository.findPostingForCompany(recruitmentId, companyId);
    if (!posting) {
      throw new ApiException(404, "COMMON_NOT_FOUND", "공고를 찾을 수 없습니다.");
    }
    return toRecruitmentResponse(posting);
  }

  async copyRecruitment(user: CurrentUser, recruitmentId: number) {
    const companyId = requireCompanyId(user);
    const posting = await this.repository.findPostingForCompany(recruitmentId, companyId);
    if (!posting) {
      throw new ApiException(404, "COMMON_NOT_FOUND", "공고를 찾을 수 없습니다.");
    }
    if (posting.status !== PostingStatus.CLOSED) {
      throw new ApiException(400, "COMMON_VALIDATION_FAILED", "마감된 공고만 복사할 수 있습니다.", [
        { field: "status", reason: "NOT_CLOSED" },
      ]);
    }

    const copied = await this.repository.createPosting({
      companyId,
      title: buildCopyTitle(posting.title),
      jobRole: posting.jobRole,
      jobDescription: posting.jobDescription,
      startsOn: null,
      endsOn: null,
      status: PostingStatus.DRAFT,
    });
    return toRecruitmentResponse(copied);
  }

  async registerApplicant(user: CurrentUser, dto: CreateApplicantDto) {
    const companyId = requireCompanyId(user);
    const posting = await this.repository.findPostingForCompany(dto.recruitmentId, companyId);
    if (!posting) {
      throw new ApiException(404, "COMMON_NOT_FOUND", "공고를 찾을 수 없습니다.");
    }

    const email = normalizeEmail(dto.email);
    const duplicate = await this.repository.findApplicationByPostingAndEmail(dto.recruitmentId, email);
    if (duplicate) {
      throw new ApiException(409, "COMMON_CONFLICT", "같은 공고에 이미 등록된 이메일입니다.", [
        { field: "email", reason: "DUPLICATED_IN_RECRUITMENT" },
      ]);
    }

    const candidate = await this.repository.findOrCreateCandidate({
      name: dto.name.trim(),
      email,
      phone: dto.phone?.trim() || null,
    });
    const application = await this.repository.createApplication({
      postingId: dto.recruitmentId,
      candidateId: candidate.candidateId,
    });
    return toApplicantResponse(application);
  }

  async listRecruitmentApplicants(user: CurrentUser, recruitmentId: number, query: ListQueryDto) {
    const companyId = requireCompanyId(user);
    const posting = await this.repository.findPostingForCompany(recruitmentId, companyId);
    if (!posting) {
      throw new ApiException(404, "COMMON_NOT_FOUND", "공고를 찾을 수 없습니다.");
    }
    const normalized = normalizeListQuery(query, "updatedAt");
    const [items, totalItems] = await Promise.all([
      this.repository.listApplicationsForPosting(recruitmentId, companyId, normalized),
      this.repository.countApplicationsForPosting(recruitmentId, companyId, normalized),
    ]);
    return {
      items: items.map(toApplicantResponse),
      page: buildPageMeta(normalized.page, normalized.limit, totalItems),
    };
  }

  async inviteApplicant(user: CurrentUser, dto: InviteApplicantDto) {
    const companyId = requireCompanyId(user);
    const application = await this.repository.findApplicationForCompany(dto.applicantId, companyId);
    if (!application) {
      throw new ApiException(404, "COMMON_NOT_FOUND", "지원자를 찾을 수 없습니다.");
    }

    const availableFrom = parseDateTime(dto.availableFrom, "availableFrom");
    const availableUntil = parseDateTime(dto.availableUntil, "availableUntil");
    if (availableFrom > availableUntil) {
      throw new ApiException(400, "COMMON_VALIDATION_FAILED", "응시 시작일시는 종료일시보다 늦을 수 없습니다.", [
        { field: "availableFrom", reason: "AFTER_AVAILABLE_UNTIL" },
      ]);
    }

    const invitation = await this.invitationAdapter.requestInvitation({
      application,
      availableFrom,
      availableUntil,
      message: dto.message.trim(),
    });

    return {
      invitationId: invitation.invitationId,
      applicantId: application.applicationId,
      applicationId: application.applicationId,
      recruitmentId: application.postingId,
      candidateId: application.candidateId,
      email: application.candidate.user.email,
      availableFrom: invitation.availableFrom.toISOString(),
      availableUntil: invitation.availableUntil.toISOString(),
      message: invitation.message,
      deliveryStatus: invitation.deliveryStatus,
      temporary: invitation.temporary,
      temporaryBoundary: invitation.temporaryBoundary,
      sessionConnection: invitation.sessionConnection,
    };
  }

  async getApplicantEvaluation(user: CurrentUser, applicantId: number) {
    const companyId = requireCompanyId(user);
    const application = await this.repository.findApplicationForCompany(applicantId, companyId);
    if (!application) {
      throw new ApiException(404, "COMMON_NOT_FOUND", "지원자를 찾을 수 없습니다.");
    }

    return toApplicantEvaluationResponse(application);
  }

  async updateScreeningStatus(user: CurrentUser, applicantId: number, dto: UpdateScreeningStatusDto) {
    const companyId = requireCompanyId(user);
    const screeningDecision = parseScreeningDecision(dto.screeningDecision);
    const application = await this.repository.updateApplicationScreening(applicantId, companyId, {
      screeningDecision,
      screeningMemo: dto.screeningMemo?.trim() || null,
    });

    if (!application) {
      throw new ApiException(404, "COMMON_NOT_FOUND", "지원자를 찾을 수 없습니다.");
    }

    return toApplicantResponse(application);
  }
}

export function normalizeListQuery(query: ListQueryDto, defaultSort: string): NormalizedListQuery {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 20, 100);
  const q = query.q?.trim() || query.keyword?.trim() || undefined;
  const status = parseOptionalPostingStatus(query.status);
  return {
    page,
    limit,
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    sort: query.sort?.trim() || defaultSort,
    order: query.order ?? "desc",
    skip: (page - 1) * limit,
    take: limit,
  };
}

function requireCompanyId(user: CurrentUser): number {
  if (user.userType !== "COMPANY" || !user.companyId) {
    throw new ApiException(403, "COMMON_FORBIDDEN", "기업 사용자만 접근할 수 있습니다.");
  }
  return user.companyId;
}

function parseOptionalDate(value: string | undefined, field: string) {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ApiException(400, "COMMON_VALIDATION_FAILED", "날짜 형식을 확인해주세요.", [
      { field, reason: "INVALID_DATE" },
    ]);
  }
  return date;
}

function parseDateTime(value: string, field: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiException(400, "COMMON_VALIDATION_FAILED", "날짜 형식을 확인해주세요.", [
      { field, reason: "INVALID_DATE_TIME" },
    ]);
  }
  return date;
}

function parseScreeningDecision(value: UpdateScreeningStatusDto["screeningDecision"]): ScreeningDecision {
  if (!["UNDECIDED", "PASS", "HOLD", "FAIL"].includes(value)) {
    throw new ApiException(400, "COMMON_VALIDATION_FAILED", "허용되지 않은 전형 상태입니다.", [
      { field: "screeningDecision", reason: "INVALID_SCREENING_DECISION" },
    ]);
  }
  return value as ScreeningDecision;
}

function parseOptionalPostingStatus(value: string | undefined): PostingStatus | undefined {
  if (!value) {
    return undefined;
  }
  if (!["DRAFT", "OPEN", "CLOSING_SOON", "CLOSED", "ARCHIVED"].includes(value)) {
    throw new ApiException(400, "COMMON_VALIDATION_FAILED", "허용되지 않은 공고 상태입니다.", [
      { field: "status", reason: "INVALID_POSTING_STATUS" },
    ]);
  }
  return value as PostingStatus;
}

function buildCopyTitle(title: string) {
  const suffix = " (복사본)";
  return `${title.slice(0, 200 - suffix.length)}${suffix}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildPageMeta(page: number, limit: number, totalItems: number) {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNext: page < totalPages,
  };
}

function toRecruitmentResponse(posting: RecruitmentRecord) {
  return {
    recruitmentId: posting.postingId,
    postingId: posting.postingId,
    companyId: posting.companyId,
    title: posting.title,
    jobRole: posting.jobRole,
    jobDescription: posting.jobDescription,
    startsOn: posting.startsOn ? formatDate(posting.startsOn) : null,
    endsOn: posting.endsOn ? formatDate(posting.endsOn) : null,
    status: posting.status,
    applicantCount: posting.applicantCount,
    createdAt: posting.createdAt.toISOString(),
    updatedAt: posting.updatedAt.toISOString(),
  };
}

function toApplicantResponse(application: ApplicantRecord) {
  const latestReport = application.evaluationReports[0] ?? null;
  const latestSession = application.interviewSessions[0] ?? null;
  return {
    applicantId: application.applicationId,
    applicationId: application.applicationId,
    recruitmentId: application.postingId,
    candidateId: application.candidateId,
    name: application.candidate.user.name,
    email: application.candidate.user.email,
    phone: application.candidate.user.phone,
    jobRole: application.posting.jobRole,
    applicationStatus: application.applicationStatus,
    documentStatus: application.documentStatus,
    interviewStatus: application.interviewStatus,
    reportStatus: latestReport?.status ?? application.reportStatus,
    screeningDecision: application.screeningDecision ?? "UNDECIDED",
    screeningMemo: application.screeningMemo,
    interviewSession: latestSession
      ? {
          sessionId: latestSession.sessionId,
          status: latestSession.status,
          interviewType: latestSession.interviewType,
          startedAt: latestSession.startedAt?.toISOString() ?? null,
          completedAt: latestSession.completedAt?.toISOString() ?? null,
        }
      : null,
    report: latestReport
      ? {
          reportId: latestReport.reportId,
          status: latestReport.status,
          totalScore: latestReport.totalScore,
          summary: latestReport.summary,
          generatedAt: latestReport.generatedAt?.toISOString() ?? null,
        }
      : null,
    updatedAt: application.updatedAt.toISOString(),
  };
}

function toApplicantEvaluationResponse(application: ApplicantRecord) {
  const latestReport = application.evaluationReports[0] ?? null;
  const applicant = toApplicantResponse(application);

  return {
    applicant,
    recruitment: {
      recruitmentId: application.postingId,
      postingId: application.postingId,
      title: application.posting.title,
      jobRole: application.posting.jobRole,
    },
    statuses: {
      applicationStatus: application.applicationStatus,
      documentStatus: application.documentStatus,
      interviewStatus: application.interviewStatus,
      reportStatus: latestReport?.status ?? application.reportStatus,
    },
    screening: {
      decision: application.screeningDecision ?? "UNDECIDED",
      memo: application.screeningMemo,
    },
    reportAvailability: latestReport ? "AVAILABLE" : "NONE_OR_GENERATING",
    report: latestReport
      ? {
          reportId: latestReport.reportId,
          status: latestReport.status,
          totalScore: latestReport.totalScore,
          summary: latestReport.summary,
          generatedAt: latestReport.generatedAt?.toISOString() ?? null,
          scores: (latestReport.scores ?? []).map((score) => ({
            scoreId: score.scoreId,
            criterionId: score.criterion?.criterionId ?? null,
            criterionName: score.criterion?.tagName ?? null,
            score: score.score,
            rationale: score.rationale,
            evidences: score.evidences.map((evidence) => ({
              evidenceId: evidence.evidenceId,
              evidenceText: evidence.evidenceText,
            })),
          })),
        }
      : null,
  };
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
