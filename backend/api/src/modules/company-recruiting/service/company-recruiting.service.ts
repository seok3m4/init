import { Injectable } from "@nestjs/common";
import { ERROR_CODES, type CurrentUser, type ErrorCode } from "@init/common";
import { PostingStatus, ScreeningDecision } from "@prisma/client";

import { ApiException as SharedApiException } from "../../../shared/api-exception";
import {
  InMemoryCompanyRecruitingInvitationAdapter,
  type CompanyRecruitingInvitationAdapterPort,
} from "./company-recruiting-invitation.adapter";
import {
  InMemoryPublicApplicationAuthAdapter,
  type PublicApplicationAuthAdapterPort,
} from "./public-application-auth.adapter";
import type { BulkCreateApplicantsDto, BulkCreateApplicantRowDto } from "../dto/bulk-create-applicants.dto";
import type { CreateApplicantDto } from "../dto/create-applicant.dto";
import type { CreateRecruitmentDto } from "../dto/create-recruitment.dto";
import type { InviteApplicantDto } from "../dto/invite-applicant.dto";
import type { ListQueryDto } from "../dto/list-query.dto";
import type { RequestPublicApplicationAccessLinkDto } from "../dto/request-public-application-access-link.dto";
import type { SubmitPublicApplicationDto } from "../dto/submit-public-application.dto";
import type { UpdateRecruitmentDto } from "../dto/update-recruitment.dto";
import type { UpdateScreeningStatusDto } from "../dto/update-screening-status.dto";
import type { CompanyRecruitingRepositoryPort } from "../repository/company-recruiting.repository";
import type {
  ApplicantRecord,
  NormalizedListQuery,
  PublicRecruitmentRecord,
  RecruitmentRecord,
} from "../company-recruiting.types";

class CompanyRecruitingException extends SharedApiException {
  constructor(status: number, code: ErrorCode, message: string, details: Array<Record<string, unknown>> = []) {
    super(code, message, status, details);
  }
}

type BulkFailureReason =
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_NAME"
  | "INVALID_EMAIL"
  | "DUPLICATED_IN_CSV"
  | "DUPLICATED_IN_RECRUITMENT"
  | "ROW_CREATE_FAILED";

type BulkApplicantFailure = {
  rowNumber: number;
  email?: string;
  field?: string;
  reason: BulkFailureReason;
  message: string;
};

@Injectable()
export class CompanyRecruitingService {
  constructor(
    private readonly repository: CompanyRecruitingRepositoryPort,
    private readonly invitationAdapter: CompanyRecruitingInvitationAdapterPort = new InMemoryCompanyRecruitingInvitationAdapter(),
    private readonly publicApplicationAuthAdapter: PublicApplicationAuthAdapterPort = new InMemoryPublicApplicationAuthAdapter(),
  ) {}

  async createRecruitment(user: CurrentUser, dto: CreateRecruitmentDto) {
    const companyId = requireCompanyId(user);
    const startsOn = parseOptionalDate(dto.startsOn, "startsOn");
    const endsOn = parseOptionalDate(dto.endsOn, "endsOn");
    if (startsOn && endsOn && startsOn > endsOn) {
      throw new CompanyRecruitingException(400, ERROR_CODES.COMMON_VALIDATION_FAILED, "채용 시작일은 마감일보다 늦을 수 없습니다.", [
        { field: "startsOn", reason: "AFTER_ENDS_ON" },
      ]);
    }

    const posting = await this.repository.createPosting({
      companyId,
      title: dto.title.trim(),
      jobRole: dto.jobRole.trim(),
      jobDescription: dto.jobDescription?.trim() || null,
      ...buildPostingExtraInfoInput(dto),
      startsOn,
      endsOn,
      status: (dto.status ?? PostingStatus.DRAFT) as PostingStatus,
    });
    return toRecruitmentResponse(posting);
  }

  async updateRecruitment(user: CurrentUser, recruitmentId: number, dto: UpdateRecruitmentDto) {
    const companyId = requireCompanyId(user);
    const posting = await this.repository.findPostingForCompany(recruitmentId, companyId);
    if (!posting) {
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "공고를 찾을 수 없습니다.");
    }

    const startsOn = parseOptionalDate(dto.startsOn, "startsOn");
    const endsOn = parseOptionalDate(dto.endsOn, "endsOn");
    if (startsOn && endsOn && startsOn > endsOn) {
      throw new CompanyRecruitingException(400, ERROR_CODES.COMMON_VALIDATION_FAILED, "채용 시작일은 마감일보다 늦을 수 없습니다.", [
        { field: "startsOn", reason: "AFTER_ENDS_ON" },
      ]);
    }

    const updated = await this.repository.updatePosting(recruitmentId, companyId, {
      title: dto.title.trim(),
      jobRole: dto.jobRole.trim(),
      jobDescription: dto.jobDescription?.trim() || null,
      ...buildPostingExtraInfoInput(dto),
      startsOn,
      endsOn,
      status: dto.status ? parseEditablePostingStatus(dto.status) : (posting.status as PostingStatus),
    });

    if (!updated) {
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "공고를 찾을 수 없습니다.");
    }
    return toRecruitmentResponse(updated);
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
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "공고를 찾을 수 없습니다.");
    }
    return toRecruitmentResponse(posting);
  }

  async getPublicRecruitment(recruitmentId: number) {
    const posting = await this.repository.findOpenPostingForPublic(recruitmentId);
    if (!posting) {
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "공개 지원 가능한 공고를 찾을 수 없습니다.");
    }
    return toPublicRecruitmentResponse(posting);
  }

  async submitPublicApplication(recruitmentId: number, dto: SubmitPublicApplicationDto) {
    const posting = await this.repository.findOpenPostingForPublic(recruitmentId);
    if (!posting) {
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "공개 지원 가능한 공고를 찾을 수 없습니다.");
    }
    if (!dto.consentAgreed) {
      throw new CompanyRecruitingException(400, ERROR_CODES.COMMON_VALIDATION_FAILED, "개인정보 수집 및 채용 절차 이용 동의가 필요합니다.", [
        { field: "consentAgreed", reason: "REQUIRED" },
      ]);
    }

    validateApplicantName(dto.name);
    const email = normalizeEmail(dto.email);
    if (!isValidEmail(email)) {
      throw new CompanyRecruitingException(400, ERROR_CODES.COMMON_VALIDATION_FAILED, "이메일 형식이 올바르지 않습니다.", [
        { field: "email", reason: "INVALID_EMAIL" },
      ]);
    }

    const duplicate = await this.repository.findApplicationByPostingAndEmail(recruitmentId, email);
    if (duplicate) {
      throw new CompanyRecruitingException(409, ERROR_CODES.COMMON_CONFLICT, "이미 이 공고에 지원한 이메일입니다.", [
        { field: "email", reason: "DUPLICATED_IN_RECRUITMENT" },
      ]);
    }

    const candidate = await this.repository.findOrCreatePublicCandidate({
      name: dto.name.trim(),
      email,
      phone: normalizeNullableString(dto.phone),
      portfolioUrl: normalizeNullableString(dto.portfolioUrl),
      summary: normalizeNullableString(dto.resumeText),
    });
    const application = await this.repository.createApplication({
      postingId: recruitmentId,
      candidateId: candidate.candidateId,
      screeningMemo: null,
    });
    const verification = await this.publicApplicationAuthAdapter.requestEmailVerification({
      applicationId: application.applicationId,
      recruitmentId: application.postingId,
      email,
    });

    return {
      applicationId: application.applicationId,
      recruitmentId: application.postingId,
      email,
      applicationStatus: application.applicationStatus,
      ...verification,
    };
  }

  async requestPublicApplicationAccessLink(recruitmentId: number, dto: RequestPublicApplicationAccessLinkDto) {
    const posting = await this.repository.findOpenPostingForPublic(recruitmentId);
    if (!posting) {
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "공개 지원 가능한 공고를 찾을 수 없습니다.");
    }

    const email = normalizeEmail(dto.email);
    if (!isValidEmail(email)) {
      throw new CompanyRecruitingException(400, ERROR_CODES.COMMON_VALIDATION_FAILED, "이메일 형식이 올바르지 않습니다.", [
        { field: "email", reason: "INVALID_EMAIL" },
      ]);
    }

    const application = await this.repository.findApplicationByPostingAndEmail(recruitmentId, email);
    if (!application) {
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "해당 이메일로 제출된 지원서를 찾을 수 없습니다.");
    }

    const verification = await this.publicApplicationAuthAdapter.requestEmailVerification({
      applicationId: application.applicationId,
      recruitmentId,
      email,
    });

    return {
      recruitmentId,
      email,
      emailVerificationStatus: verification.emailVerificationStatus,
      nextAction: verification.nextAction,
      magicLinkDeliveryStatus: verification.magicLinkDeliveryStatus,
      magicLinkExpiresInSeconds: verification.magicLinkExpiresInSeconds,
    };
  }

  async getPublicApplicationStatusByMagicLink(token: string) {
    const payload = await this.publicApplicationAuthAdapter.verifyApplicationStatusToken(token);
    if (!payload) {
      throw new CompanyRecruitingException(401, ERROR_CODES.COMMON_UNAUTHORIZED, "매직링크가 만료되었거나 유효하지 않습니다.");
    }

    const application = await this.repository.findPublicApplicationStatusById(payload.applicationId);
    if (!application) {
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "지원서를 찾을 수 없습니다.");
    }
    if (application.postingId !== payload.recruitmentId || normalizeEmail(application.candidate.user.email) !== normalizeEmail(payload.email)) {
      throw new CompanyRecruitingException(401, ERROR_CODES.COMMON_UNAUTHORIZED, "매직링크가 지원서 정보와 일치하지 않습니다.");
    }

    return toPublicApplicationStatusResponse(application);
  }

  async deleteRecruitment(user: CurrentUser, recruitmentId: number) {
    const companyId = requireCompanyId(user);
    const posting = await this.repository.findPostingForCompany(recruitmentId, companyId);
    if (!posting) {
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "공고를 찾을 수 없습니다.");
    }
    if (posting.status !== PostingStatus.DRAFT && posting.status !== PostingStatus.CLOSED) {
      throw new CompanyRecruitingException(400, ERROR_CODES.COMMON_VALIDATION_FAILED, "임시저장 또는 마감 공고만 삭제할 수 있습니다.", [
        { field: "status", reason: "INVALID_ARCHIVE_TRANSITION" },
      ]);
    }

    const archived = await this.repository.archivePosting(recruitmentId, companyId);
    if (!archived) {
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "공고를 찾을 수 없습니다.");
    }
    return toRecruitmentResponse(archived);
  }

  async copyRecruitment(user: CurrentUser, recruitmentId: number) {
    const companyId = requireCompanyId(user);
    const posting = await this.repository.findPostingForCompany(recruitmentId, companyId);
    if (!posting) {
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "공고를 찾을 수 없습니다.");
    }
    if (posting.status !== PostingStatus.CLOSED) {
      throw new CompanyRecruitingException(400, ERROR_CODES.COMMON_VALIDATION_FAILED, "마감된 공고만 복사할 수 있습니다.", [
        { field: "status", reason: "NOT_CLOSED" },
      ]);
    }

    const copied = await this.repository.createPosting({
      companyId,
      title: buildCopyTitle(posting.title),
      jobRole: posting.jobRole,
      jobDescription: posting.jobDescription,
      careerRequirement: posting.careerRequirement,
      educationRequirement: posting.educationRequirement,
      salaryInfo: posting.salaryInfo,
      workLocation: posting.workLocation,
      employmentType: posting.employmentType,
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
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "공고를 찾을 수 없습니다.");
    }

    validateApplicantName(dto.name);
    const email = normalizeEmail(dto.email);
    const duplicate = await this.repository.findApplicationByPostingAndEmail(dto.recruitmentId, email);
    if (duplicate) {
      throw new CompanyRecruitingException(409, ERROR_CODES.COMMON_CONFLICT, "같은 공고에 이미 등록된 이메일입니다.", [
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
      screeningMemo: null,
    });
    return toApplicantResponse(application);
  }

  async bulkRegisterApplicants(user: CurrentUser, dto: BulkCreateApplicantsDto) {
    const companyId = requireCompanyId(user);
    const posting = await this.repository.findPostingForCompany(dto.recruitmentId, companyId);
    if (!posting) {
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "공고를 찾을 수 없습니다.");
    }
    if (!dto.applicants?.length || dto.applicants.length > 200) {
      throw new CompanyRecruitingException(400, ERROR_CODES.COMMON_VALIDATION_FAILED, "CSV 업로드는 1행 이상 200행 이하만 가능합니다.", [
        { field: "applicants", reason: "INVALID_BULK_ROW_COUNT" },
      ]);
    }

    const seenEmails = new Set<string>();
    const successes: Array<{ rowNumber: number; applicant: ReturnType<typeof toApplicantResponse> }> = [];
    const failures: BulkApplicantFailure[] = [];

    for (const [index, row] of dto.applicants.entries()) {
      const prepared = prepareBulkApplicantRow(row, index);
      const rowFailure = validatePreparedBulkRow(prepared, seenEmails);
      if (rowFailure) {
        failures.push(rowFailure);
        continue;
      }

      seenEmails.add(prepared.email);
      const duplicate = await this.repository.findApplicationByPostingAndEmail(dto.recruitmentId, prepared.email);
      if (duplicate) {
        failures.push({
          rowNumber: prepared.rowNumber,
          email: prepared.email,
          field: "email",
          reason: "DUPLICATED_IN_RECRUITMENT",
          message: "같은 공고에 이미 등록된 이메일입니다.",
        });
        continue;
      }

      try {
        const candidate = await this.repository.findOrCreateCandidate({
          name: prepared.name,
          email: prepared.email,
          phone: prepared.phone,
        });
        const application = await this.repository.createApplication({
          postingId: dto.recruitmentId,
          candidateId: candidate.candidateId,
          screeningMemo: null,
        });
        successes.push({ rowNumber: prepared.rowNumber, applicant: toApplicantResponse(application) });
      } catch {
        failures.push({
          rowNumber: prepared.rowNumber,
          email: prepared.email,
          reason: "ROW_CREATE_FAILED",
          message: "지원자 등록 중 오류가 발생했습니다.",
        });
      }
    }

    return {
      summary: {
        totalRows: dto.applicants.length,
        successCount: successes.length,
        failedCount: failures.length,
      },
      successes,
      failures,
    };
  }

  async listRecruitmentApplicants(user: CurrentUser, recruitmentId: number, query: ListQueryDto) {
    const companyId = requireCompanyId(user);
    const posting = await this.repository.findPostingForCompany(recruitmentId, companyId);
    if (!posting) {
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "공고를 찾을 수 없습니다.");
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
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "지원자를 찾을 수 없습니다.");
    }

    const availableFrom = parseDateTime(dto.availableFrom, "availableFrom");
    const availableUntil = parseDateTime(dto.availableUntil, "availableUntil");
    if (availableFrom > availableUntil) {
      throw new CompanyRecruitingException(400, ERROR_CODES.COMMON_VALIDATION_FAILED, "응시 시작일시는 종료일시보다 늦을 수 없습니다.", [
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
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "지원자를 찾을 수 없습니다.");
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
      throw new CompanyRecruitingException(404, ERROR_CODES.COMMON_NOT_FOUND, "지원자를 찾을 수 없습니다.");
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
    throw new CompanyRecruitingException(403, ERROR_CODES.COMMON_FORBIDDEN, "기업 사용자만 접근할 수 있습니다.");
  }
  return user.companyId;
}

function parseOptionalDate(value: string | undefined, field: string) {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new CompanyRecruitingException(400, ERROR_CODES.COMMON_VALIDATION_FAILED, "날짜 형식을 확인해주세요.", [
      { field, reason: "INVALID_DATE" },
    ]);
  }
  return date;
}

function parseDateTime(value: string, field: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CompanyRecruitingException(400, ERROR_CODES.COMMON_VALIDATION_FAILED, "날짜 형식을 확인해주세요.", [
      { field, reason: "INVALID_DATE_TIME" },
    ]);
  }
  return date;
}

function parseScreeningDecision(value: UpdateScreeningStatusDto["screeningDecision"]): ScreeningDecision {
  if (!["UNDECIDED", "PASS", "HOLD", "FAIL"].includes(value)) {
    throw new CompanyRecruitingException(400, ERROR_CODES.COMMON_VALIDATION_FAILED, "허용되지 않은 전형 상태입니다.", [
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
    throw new CompanyRecruitingException(400, ERROR_CODES.COMMON_VALIDATION_FAILED, "허용되지 않은 공고 상태입니다.", [
      { field: "status", reason: "INVALID_POSTING_STATUS" },
    ]);
  }
  return value as PostingStatus;
}

function parseEditablePostingStatus(value: string): PostingStatus {
  if (!["DRAFT", "OPEN"].includes(value)) {
    throw new CompanyRecruitingException(400, ERROR_CODES.COMMON_VALIDATION_FAILED, "설정 화면에서는 DRAFT 또는 OPEN만 저장할 수 있습니다.", [
      { field: "status", reason: "INVALID_EDITABLE_POSTING_STATUS" },
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

function prepareBulkApplicantRow(row: BulkCreateApplicantRowDto, index: number) {
  return {
    rowNumber: Number.isInteger(row.rowNumber) && Number(row.rowNumber) > 0 ? Number(row.rowNumber) : index + 2,
    name: normalizeOptionalString(row.name),
    email: normalizeEmail(normalizeOptionalString(row.email)),
    jobRole: normalizeOptionalString(row.jobRole),
    phone: normalizeOptionalString(row.phone) || null,
  };
}

function validatePreparedBulkRow(
  row: ReturnType<typeof prepareBulkApplicantRow>,
  seenEmails: Set<string>,
): BulkApplicantFailure | null {
  if (!row.name) {
    return buildBulkFailure(row.rowNumber, row.email, "name", "MISSING_REQUIRED_FIELD", "이름은 필수입니다.");
  }
  if (!isValidApplicantName(row.name)) {
    return buildBulkFailure(row.rowNumber, row.email, "name", "INVALID_NAME", "이름에는 숫자나 쉼표 등 특수문자를 사용할 수 없습니다.");
  }
  if (!row.email) {
    return buildBulkFailure(row.rowNumber, undefined, "email", "MISSING_REQUIRED_FIELD", "이메일은 필수입니다.");
  }
  if (!row.jobRole) {
    return buildBulkFailure(row.rowNumber, row.email, "jobRole", "MISSING_REQUIRED_FIELD", "지원 직무는 필수입니다.");
  }
  if (!isValidEmail(row.email)) {
    return buildBulkFailure(row.rowNumber, row.email, "email", "INVALID_EMAIL", "이메일 형식이 올바르지 않습니다.");
  }
  if (seenEmails.has(row.email)) {
    return buildBulkFailure(row.rowNumber, row.email, "email", "DUPLICATED_IN_CSV", "CSV 안에 중복된 이메일이 있습니다.");
  }
  return null;
}

function buildBulkFailure(
  rowNumber: number,
  email: string | undefined,
  field: string,
  reason: BulkFailureReason,
  message: string,
): BulkApplicantFailure {
  return {
    rowNumber,
    ...(email ? { email } : {}),
    field,
    reason,
    message,
  };
}

function normalizeOptionalString(value: string | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function buildPostingExtraInfoInput(dto: CreateRecruitmentDto | UpdateRecruitmentDto) {
  return {
    careerRequirement: normalizeNullableString(dto.careerRequirement),
    educationRequirement: normalizeNullableString(dto.educationRequirement),
    salaryInfo: normalizeNullableString(dto.salaryInfo),
    workLocation: normalizeNullableString(dto.workLocation),
    employmentType: normalizeNullableString(dto.employmentType),
  };
}

function normalizeNullableString(value: string | undefined) {
  const normalized = normalizeOptionalString(value);
  return normalized || null;
}

function validateApplicantName(name: string) {
  if (!isValidApplicantName(name.trim())) {
    throw new CompanyRecruitingException(400, ERROR_CODES.COMMON_VALIDATION_FAILED, "이름 형식을 확인해주세요.", [
      { field: "name", reason: "INVALID_NAME" },
    ]);
  }
}

function isValidApplicantName(name: string) {
  return /^[\p{L}\p{M}][\p{L}\p{M}\s.'’\-·]{0,99}$/u.test(name);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
    careerRequirement: posting.careerRequirement,
    educationRequirement: posting.educationRequirement,
    salaryInfo: posting.salaryInfo,
    workLocation: posting.workLocation,
    employmentType: posting.employmentType,
    startsOn: posting.startsOn ? formatDate(posting.startsOn) : null,
    endsOn: posting.endsOn ? formatDate(posting.endsOn) : null,
    status: posting.status,
    applicantCount: posting.applicantCount,
    createdAt: posting.createdAt.toISOString(),
    updatedAt: posting.updatedAt.toISOString(),
  };
}

function toPublicRecruitmentResponse(posting: PublicRecruitmentRecord) {
  return {
    recruitmentId: posting.postingId,
    postingId: posting.postingId,
    companyName: posting.companyName,
    title: posting.title,
    jobRole: posting.jobRole,
    jobDescription: posting.jobDescription,
    careerRequirement: posting.careerRequirement,
    educationRequirement: posting.educationRequirement,
    salaryInfo: posting.salaryInfo,
    workLocation: posting.workLocation,
    employmentType: posting.employmentType,
    startsOn: posting.startsOn ? formatDate(posting.startsOn) : null,
    endsOn: posting.endsOn ? formatDate(posting.endsOn) : null,
    status: posting.status,
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

function toPublicApplicationStatusResponse(application: ApplicantRecord) {
  return {
    applicationId: application.applicationId,
    recruitmentId: application.postingId,
    email: application.candidate.user.email,
    name: application.candidate.user.name,
    jobRole: application.posting.jobRole,
    applicationStatus: application.applicationStatus,
    documentStatus: application.documentStatus,
    interviewStatus: application.interviewStatus,
    reportStatus: application.reportStatus,
    submittedAt: application.submittedAt?.toISOString() ?? null,
    updatedAt: application.updatedAt.toISOString(),
  };
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
