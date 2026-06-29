import { Inject, Injectable } from "@nestjs/common";
import { CandidateJobListQueryDto } from "./dto/candidate-job-list-query.dto";
import { CreatePortfolioLinkDto } from "./dto/create-portfolio-link.dto";
import { SubmitApplicationDto } from "./dto/submit-application.dto";
import { UploadResumeDto } from "./dto/upload-resume.dto";
import {
  ApiListResponse,
  ApiResponse,
  Application,
  ApplicationDocument,
  ApplicationSubmissionResult,
  CandidateApplyView,
  CandidateJob,
  CandidateJobDetail,
  CandidateJobSummary,
  CandidateRepository,
  ConsentRecord,
  CurrentCandidateUser,
  FileAsset,
  PageMeta,
  PortfolioLink,
  PortfolioLinkType,
} from "./candidate.types";

const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;
const REQUIRED_APPLICATION_CONSENTS = ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"] as const;
const APPLICATION_CONSENT_TYPES = ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS", "AI_INTERVIEW_RECORDING"] as const;
const FORBIDDEN_FILE_PAYLOAD_FIELDS = ["file", "buffer", "content", "base64", "binary", "stream"] as const;
const CANDIDATE_LIST_POSTING_STATUSES = ["OPEN", "CLOSING_SOON"] as const;
const CANDIDATE_LIST_SORT_FIELDS = ["createdAt", "endsOn", "title"] as const;
const SORT_ORDERS = ["asc", "desc"] as const;

type CandidateListPostingStatus = (typeof CANDIDATE_LIST_POSTING_STATUSES)[number];
type CandidateListSortField = (typeof CANDIDATE_LIST_SORT_FIELDS)[number];
type CandidateListSortOrder = (typeof SORT_ORDERS)[number];

interface ValidatedSubmitApplication {
  candidateName: string;
  email: string;
  phone: string;
  resumeFileId: number;
  portfolioFileId?: number;
  portfolioUrl?: string;
  consentTypes: ConsentRecord["consentType"][];
}

interface NormalizedCandidateJobListQuery {
  page: number;
  limit: number;
  q?: string;
  jobRole?: string;
  jobGroup?: string;
  location?: string;
  careerLevel?: string;
  postingStatus?: CandidateListPostingStatus;
  sort: CandidateListSortField;
  order: CandidateListSortOrder;
}

export const DEV_CANDIDATE_USER: CurrentCandidateUser = {
  userId: 2,
  candidateId: 1,
  userType: "CANDIDATE",
};

export const CANDIDATE_REPOSITORY = Symbol("CANDIDATE_REPOSITORY");

export class CandidateDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
    readonly details: unknown[] = [],
  ) {
    super(message);
  }
}

@Injectable()
export class CandidateService {
  constructor(@Inject(CANDIDATE_REPOSITORY) private readonly repository: CandidateRepository) {}

  async listJobs(query: CandidateJobListQueryDto): Promise<ApiListResponse<CandidateJobSummary>> {
    const normalizedQuery = this.normalizeListQuery(query);
    const { page, limit } = normalizedQuery;
    const jobs = await this.repository.listJobs();
    const filtered = jobs
      .filter((job) => this.isApplyAvailable(job))
      .filter((job) => this.matchesListQuery(job, normalizedQuery))
      .sort((left, right) => this.compareJobs(left, right, normalizedQuery.sort, normalizedQuery.order));

    const pageMeta = this.createPageMeta(page, limit, filtered.length);
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit).map((job) => this.toJobSummary(job));

    return this.listEnvelope(items, pageMeta);
  }

  async getJobDetail(jobId: number, currentUser: CurrentCandidateUser): Promise<ApiResponse<CandidateJobDetail>> {
    const job = await this.getApplyAvailableJob(jobId);
    const alreadyApplied = await this.repository.hasApplication(currentUser.candidateId, job.jobId);

    return this.envelope({
      ...job,
      canApply: !alreadyApplied,
      alreadyApplied,
    });
  }

  async getApplyView(jobId: number, currentUser: CurrentCandidateUser): Promise<ApiResponse<CandidateApplyView>> {
    const jobDetail = await this.getJobDetail(jobId, currentUser);
    return this.envelope({
      job: jobDetail.data,
      documentPolicy: {
        storageProvider: "S3",
        allowedMimeTypes: this.allowedDocumentMimeTypes(),
        maxSizeBytes: MAX_DOCUMENT_SIZE_BYTES,
        storageKeyPrefix: `candidate/${currentUser.candidateId}/`,
        metadataOnly: true,
      },
      requiredConsentTypes: [...REQUIRED_APPLICATION_CONSENTS],
      portfolioRequired: true,
    });
  }

  async submitApplication(
    jobId: number,
    dto: SubmitApplicationDto,
    currentUser: CurrentCandidateUser,
  ): Promise<ApiResponse<ApplicationSubmissionResult>> {
    await this.getApplyAvailableJob(jobId);
    const applicationFields = this.assertRequiredApplicationFields(dto);
    const resumeFileAsset = await this.assertFileAssetForCurrentUser(
      applicationFields.resumeFileId,
      currentUser.userId,
      "resumeFileId",
    );
    this.assertDocumentFile(resumeFileAsset.mimeType, resumeFileAsset.sizeBytes);
    this.assertObjectStorageKey(resumeFileAsset.storageKey, currentUser.candidateId);
    if (applicationFields.portfolioFileId) {
      const portfolioFileAsset = await this.assertFileAssetForCurrentUser(
        applicationFields.portfolioFileId,
        currentUser.userId,
        "portfolioFileId",
      );
      this.assertDocumentFile(portfolioFileAsset.mimeType, portfolioFileAsset.sizeBytes);
      this.assertObjectStorageKey(portfolioFileAsset.storageKey, currentUser.candidateId);
    }
    if (applicationFields.portfolioUrl) {
      this.assertUrl(applicationFields.portfolioUrl, "portfolioUrl");
    }

    if (await this.repository.hasApplication(currentUser.candidateId, jobId)) {
      throw new CandidateDomainError("APPLICATION_ALREADY_SUBMITTED", "이미 지원한 채용공고입니다.", 409);
    }

    const result = await this.repository.createApplication({
      postingId: jobId,
      candidateId: currentUser.candidateId,
      resumeFileId: applicationFields.resumeFileId,
      portfolioFileId: applicationFields.portfolioFileId,
      portfolioUrl: applicationFields.portfolioUrl,
      consentTypes: applicationFields.consentTypes,
    });

    return this.envelope(result);
  }

  async uploadResume(dto: UploadResumeDto, currentUser: CurrentCandidateUser): Promise<ApiResponse<FileAsset>> {
    this.assertUploadResumeRequest(dto);
    this.assertFileAssetMetadataOnly(dto);
    this.assertDocumentFile(dto.mimeType, dto.sizeBytes);
    this.assertObjectStorageKey(dto.storageKey, currentUser.candidateId);
    const fileAsset = await this.repository.createFileAsset({
      ownerUserId: currentUser.userId,
      storageKey: dto.storageKey,
      originalName: dto.originalName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    });

    return this.envelope(fileAsset);
  }

  async createPortfolioLink(
    dto: CreatePortfolioLinkDto,
    currentUser: CurrentCandidateUser,
  ): Promise<ApiResponse<PortfolioLink>> {
    this.assertPortfolioLinkRequest(dto);
    const linkType = dto.linkType ?? this.inferPortfolioLinkType(dto.url);
    this.assertUrl(dto.url, "url");
    this.assertPortfolioLinkType(dto.url, linkType);
    if (dto.fileId !== undefined) {
      const fileAsset = await this.assertFileAssetForCurrentUser(dto.fileId, currentUser.userId, "fileId");
      this.assertDocumentFile(fileAsset.mimeType, fileAsset.sizeBytes);
      this.assertObjectStorageKey(fileAsset.storageKey, currentUser.candidateId);
    }

    const portfolioLink = await this.repository.createPortfolioLink({
      candidateId: currentUser.candidateId,
      linkType,
      url: dto.url,
      description: dto.description,
      fileId: dto.fileId,
    });

    return this.envelope(portfolioLink);
  }

  private async getApplyAvailableJob(jobId: number): Promise<CandidateJob> {
    this.assertPositiveIntegerId(jobId, "jobId");
    const job = await this.repository.findJob(jobId);
    if (!job || !this.isApplyAvailable(job)) {
      throw new CandidateDomainError("COMMON_NOT_FOUND", "지원 가능한 채용공고가 아닙니다.", 404);
    }
    return job;
  }

  private assertPositiveIntegerId(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 1) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "경로 파라미터를 확인해주세요.", 400, [
        { field, reason: `${field} must be a positive integer` },
      ]);
    }
  }

  private isApplyAvailable(job: CandidateJob): boolean {
    return job.isPublic && (job.postingStatus === "OPEN" || job.postingStatus === "CLOSING_SOON");
  }

  private normalizeListQuery(query: CandidateJobListQueryDto): NormalizedCandidateJobListQuery {
    const requestBody = this.toRequestBody(query, "query");
    const page = requestBody.page ?? 1;
    const limit = requestBody.limit ?? 20;
    const sort = requestBody.sort ?? "createdAt";
    const order = requestBody.order ?? "desc";

    if (!this.isPositiveInteger(page)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "페이지 번호를 확인해주세요.", 400, [
        { field: "page", reason: "page must be a positive integer" },
      ]);
    }

    if (!this.isPositiveInteger(limit) || limit > 100) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "페이지 크기를 확인해주세요.", 400, [
        { field: "limit", reason: "limit must be a positive integer up to 100" },
      ]);
    }

    if (!this.isOptionalString(requestBody.q)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "검색어를 확인해주세요.", 400, [
        { field: "q", reason: "q must be a string" },
      ]);
    }

    if (!this.isOptionalString(requestBody.jobRole)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "직무 필터를 확인해주세요.", 400, [
        { field: "jobRole", reason: "jobRole must be a string" },
      ]);
    }

    if (!this.isOptionalString(requestBody.jobGroup)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "직군 필터를 확인해주세요.", 400, [
        { field: "jobGroup", reason: "jobGroup must be a string" },
      ]);
    }

    if (!this.isOptionalString(requestBody.location)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "지역 필터를 확인해주세요.", 400, [
        { field: "location", reason: "location must be a string" },
      ]);
    }

    if (!this.isOptionalString(requestBody.careerLevel)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "경력 필터를 확인해주세요.", 400, [
        { field: "careerLevel", reason: "careerLevel must be a string" },
      ]);
    }

    if (!this.isOptionalListPostingStatus(requestBody.postingStatus)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "채용 상태 필터를 확인해주세요.", 400, [
        { field: "postingStatus", reason: "postingStatus must be OPEN or CLOSING_SOON" },
      ]);
    }

    if (!this.isListSortField(sort)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "정렬 기준을 확인해주세요.", 400, [
        { field: "sort", reason: "sort must be createdAt, endsOn, or title" },
      ]);
    }

    if (!this.isSortOrder(order)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "정렬 방향을 확인해주세요.", 400, [
        { field: "order", reason: "order must be asc or desc" },
      ]);
    }

    return {
      page,
      limit,
      q: this.toOptionalQueryString(requestBody.q),
      jobRole: this.toOptionalQueryString(requestBody.jobRole),
      jobGroup: this.toOptionalQueryString(requestBody.jobGroup),
      location: this.toOptionalQueryString(requestBody.location),
      careerLevel: this.toOptionalQueryString(requestBody.careerLevel),
      postingStatus: requestBody.postingStatus ?? undefined,
      sort,
      order,
    };
  }

  private matchesListQuery(job: CandidateJob, query: NormalizedCandidateJobListQuery): boolean {
    const q = query.q?.trim().toLowerCase();
    if (q) {
      const searchable = [
        job.title,
        job.companyName,
        job.companyIndustry,
        job.companyProfile,
        job.jobGroup,
        job.jobRole,
        job.jobDescription,
        ...job.techStacks,
      ]
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(q)) {
        return false;
      }
    }

    return (
      this.matchesOptional(job.jobRole, query.jobRole) &&
      this.matchesOptional(job.jobGroup, query.jobGroup) &&
      this.matchesOptional(job.location, query.location) &&
      this.matchesOptional(job.careerLevel, query.careerLevel) &&
      (!query.postingStatus || job.postingStatus === query.postingStatus)
    );
  }

  private matchesOptional(value: string, queryValue?: string): boolean {
    return !queryValue || value.toLowerCase() === queryValue.toLowerCase();
  }

  private compareJobs(
    left: CandidateJob,
    right: CandidateJob,
    sort: CandidateListSortField,
    order: CandidateListSortOrder,
  ): number {
    const direction = order === "asc" ? 1 : -1;
    const leftValue = left[sort];
    const rightValue = right[sort];
    return leftValue.localeCompare(rightValue) * direction;
  }

  private assertRequiredApplicationFields(dto: SubmitApplicationDto): ValidatedSubmitApplication {
    const requestBody = this.toRequestBody(dto, "application");
    const candidateName = requestBody.candidateName;
    const email = requestBody.email;
    const phone = requestBody.phone;
    const resumeFileId = requestBody.resumeFileId;
    const portfolioFileId = requestBody.portfolioFileId;
    const portfolioUrl = requestBody.portfolioUrl;
    const consentTypes = requestBody.consentTypes;

    if (
      !this.isNonEmptyString(candidateName) ||
      !this.isNonEmptyString(email) ||
      !this.isNonEmptyString(phone)
    ) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "기본 정보를 확인해주세요.", 400, [
        { field: "basicInfo", reason: "candidateName, email, and phone are required" },
      ]);
    }

    const normalizedEmail = email.trim();
    if (!this.isEmail(normalizedEmail)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "기본 정보를 확인해주세요.", 400, [
        { field: "email", reason: "email must be a valid email address" },
      ]);
    }

    if (!this.isPositiveInteger(resumeFileId)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "이력서 파일을 확인해주세요.", 400, [
        { field: "resumeFileId", reason: "resumeFileId must be a positive integer" },
      ]);
    }

    if (
      portfolioFileId !== undefined &&
      portfolioFileId !== null &&
      !this.isPositiveInteger(portfolioFileId)
    ) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "포트폴리오 파일을 확인해주세요.", 400, [
        { field: "portfolioFileId", reason: "portfolioFileId must be a positive integer" },
      ]);
    }

    const normalizedPortfolioFileId = this.isPositiveInteger(portfolioFileId) ? portfolioFileId : undefined;

    if (
      portfolioUrl !== undefined &&
      portfolioUrl !== null &&
      typeof portfolioUrl !== "string"
    ) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "포트폴리오 URL을 확인해주세요.", 400, [
        { field: "portfolioUrl", reason: "portfolioUrl must be a string" },
      ]);
    }

    const normalizedPortfolioUrl = typeof portfolioUrl === "string" ? this.toOptionalQueryString(portfolioUrl) : undefined;

    if (!normalizedPortfolioFileId && !normalizedPortfolioUrl) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "포트폴리오를 확인해주세요.", 400, [
        { field: "portfolio", reason: "portfolioFileId or portfolioUrl is required" },
      ]);
    }

    if (!Array.isArray(consentTypes)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "필수 동의 항목을 확인해주세요.", 400, [
        { field: "consentTypes", reason: "consentTypes must be an array" },
      ]);
    }

    if (!consentTypes.every((consentType) => this.isApplicationConsentType(consentType))) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "필수 동의 항목을 확인해주세요.", 400, [
        { field: "consentTypes", reason: "consentTypes contains an unsupported consent type" },
      ]);
    }

    for (const consentType of REQUIRED_APPLICATION_CONSENTS) {
      if (!consentTypes.includes(consentType)) {
        throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "필수 동의 항목을 확인해주세요.", 400, [
          { field: "consentTypes", reason: `${consentType} is required` },
        ]);
      }
    }
    const validatedConsentTypes = consentTypes as ConsentRecord["consentType"][];
    return {
      candidateName: candidateName.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      resumeFileId,
      portfolioFileId: normalizedPortfolioFileId,
      portfolioUrl: normalizedPortfolioUrl,
      consentTypes: validatedConsentTypes,
    };
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }

  private isPositiveInteger(value: unknown): value is number {
    return Number.isInteger(value) && typeof value === "number" && value > 0;
  }

  private isOptionalString(value: unknown): value is string | undefined | null {
    return value === undefined || value === null || typeof value === "string";
  }

  private toOptionalQueryString(value: string | undefined | null): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private isOptionalListPostingStatus(value: unknown): value is CandidateListPostingStatus | undefined | null {
    return value === undefined || value === null || CANDIDATE_LIST_POSTING_STATUSES.includes(value as CandidateListPostingStatus);
  }

  private isApplicationConsentType(value: unknown): value is ConsentRecord["consentType"] {
    return APPLICATION_CONSENT_TYPES.includes(value as ConsentRecord["consentType"]);
  }

  private isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private isListSortField(value: unknown): value is CandidateListSortField {
    return CANDIDATE_LIST_SORT_FIELDS.includes(value as CandidateListSortField);
  }

  private isSortOrder(value: unknown): value is CandidateListSortOrder {
    return SORT_ORDERS.includes(value as CandidateListSortOrder);
  }

  private toRequestBody(value: unknown, field: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "요청 본문을 확인해주세요.", 400, [
        { field, reason: `${field} must be an object` },
      ]);
    }

    return value as Record<string, unknown>;
  }

  private assertUploadResumeRequest(dto: UploadResumeDto): void {
    const requestBody = this.toRequestBody(dto, "resume");

    if (!this.isNonEmptyString(requestBody.storageKey)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "Object storage key is invalid.", 400, [
        { field: "storageKey", reason: "storageKey is required" },
      ]);
    }

    if (!this.isNonEmptyString(requestBody.originalName)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "원본 파일명을 확인해주세요.", 400, [
        { field: "originalName", reason: "originalName is required" },
      ]);
    }

    if (!this.isPositiveInteger(requestBody.sizeBytes)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "파일 용량을 확인해주세요.", 400, [
        { field: "sizeBytes", reason: "sizeBytes must be a positive integer" },
      ]);
    }
  }

  private assertPortfolioLinkRequest(dto: CreatePortfolioLinkDto): void {
    const requestBody = this.toRequestBody(dto, "portfolioLink");

    if (!this.isNonEmptyString(requestBody.url)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "포트폴리오 URL을 확인해주세요.", 400, [
        { field: "url", reason: "url is required" },
      ]);
    }

    if (
      requestBody.linkType !== undefined &&
      requestBody.linkType !== null &&
      requestBody.linkType !== "PORTFOLIO" &&
      requestBody.linkType !== "GITHUB"
    ) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "포트폴리오 링크 유형을 확인해주세요.", 400, [
        { field: "linkType", reason: "linkType must be PORTFOLIO or GITHUB" },
      ]);
    }

    if (
      requestBody.fileId !== undefined &&
      requestBody.fileId !== null &&
      !this.isPositiveInteger(requestBody.fileId)
    ) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "포트폴리오 파일을 확인해주세요.", 400, [
        { field: "fileId", reason: "fileId must be a positive integer" },
      ]);
    }

    if (
      requestBody.description !== undefined &&
      requestBody.description !== null &&
      typeof requestBody.description !== "string"
    ) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "포트폴리오 설명을 확인해주세요.", 400, [
        { field: "description", reason: "description must be a string" },
      ]);
    }
  }

  private assertDocumentFile(mimeType: string, sizeBytes: number): void {
    if (!this.allowedDocumentMimeTypes().includes(mimeType)) {
      throw new CandidateDomainError("FILE_INVALID_TYPE", "지원하지 않는 파일 형식입니다.", 400);
    }

    if (!Number.isInteger(sizeBytes) || sizeBytes < 1) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "File size is invalid.", 400, [
        { field: "sizeBytes", reason: "sizeBytes must be a positive integer" },
      ]);
    }

    if (sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      throw new CandidateDomainError("FILE_SIZE_EXCEEDED", "파일 용량이 허용 범위를 초과했습니다.", 400);
    }
  }

  private allowedDocumentMimeTypes(): string[] {
    return [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
  }

  private assertFileAssetMetadataOnly(dto: UploadResumeDto): void {
    const requestBody = this.toRequestBody(dto, "resume");
    const forbiddenField = FORBIDDEN_FILE_PAYLOAD_FIELDS.find((field) => Object.hasOwn(requestBody, field));

    if (forbiddenField) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "file_assets only stores metadata.", 400, [
        { field: forbiddenField, reason: "raw file payload must be uploaded to object storage first" },
      ]);
    }
  }

  private assertObjectStorageKey(storageKey: string, candidateId: number): void {
    const expectedPrefix = `candidate/${candidateId}/`;
    if (
      !storageKey.startsWith(expectedPrefix) ||
      storageKey.includes("..") ||
      storageKey.startsWith("/") ||
      storageKey.includes("://") ||
      storageKey.length <= expectedPrefix.length
    ) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "Object storage key is invalid.", 400, [
        { field: "storageKey", reason: `storageKey must be an object key under ${expectedPrefix}` },
      ]);
    }
  }

  private async assertFileAssetForCurrentUser(fileId: number, ownerUserId: number, field: string): Promise<FileAsset> {
    const fileAsset = await this.repository.findFileAsset(fileId);
    if (!fileAsset) {
      throw new CandidateDomainError("COMMON_NOT_FOUND", "업로드 파일 정보를 찾을 수 없습니다.", 404, [
        { field, reason: "file asset not found" },
      ]);
    }

    if (fileAsset.ownerUserId !== ownerUserId) {
      throw new CandidateDomainError("COMMON_FORBIDDEN", "파일 접근 권한이 없습니다.", 403, [
        { field, reason: "file owner mismatch" },
      ]);
    }

    return fileAsset;
  }

  private assertUrl(url: string, field: "portfolioUrl" | "url"): void {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("invalid protocol");
      }
    } catch {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "포트폴리오 URL을 확인해주세요.", 400, [
        { field, reason: "url must be http or https" },
      ]);
    }
  }

  private inferPortfolioLinkType(url: string): PortfolioLinkType {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname === "github.com" || hostname.endsWith(".github.com") ? "GITHUB" : "PORTFOLIO";
    } catch {
      return "PORTFOLIO";
    }
  }

  private assertPortfolioLinkType(url: string, linkType: PortfolioLinkType): void {
    if (linkType !== "GITHUB") {
      return;
    }

    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname !== "github.com" && !hostname.endsWith(".github.com")) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "GitHub link must use github.com.", 400, [
        { field: "url", reason: "github link must use github.com host" },
      ]);
    }
  }

  private toJobSummary(job: CandidateJob): CandidateJobSummary {
    return {
      jobId: job.jobId,
      companyName: job.companyName,
      title: job.title,
      jobGroup: job.jobGroup,
      jobRole: job.jobRole,
      location: job.location,
      careerLevel: job.careerLevel,
      employmentType: job.employmentType,
      postingStatus: job.postingStatus,
      startsOn: job.startsOn,
      endsOn: job.endsOn,
    };
  }

  private createPageMeta(page: number, limit: number, totalItems: number): PageMeta {
    const totalPages = Math.ceil(totalItems / limit);
    return {
      page,
      limit,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
    };
  }

  private envelope<T>(data: T): ApiResponse<T> {
    return {
      data,
      meta: {
        traceId: "local-candidate-module",
        timestamp: new Date().toISOString(),
      },
    };
  }

  private listEnvelope<T>(items: T[], page: PageMeta): ApiListResponse<T> {
    return {
      data: { items },
      meta: {
        traceId: "local-candidate-module",
        timestamp: new Date().toISOString(),
        page,
      },
    };
  }
}

@Injectable()
export class InMemoryCandidateRepository implements CandidateRepository {
  private readonly jobs: CandidateJob[] = [
    {
      jobId: 1,
      companyId: 1,
      isPublic: true,
      companyName: "Init Labs",
      companyIndustry: "SaaS",
      companyProfile: "AI 기반 채용 워크플로우를 만드는 B2B SaaS 팀입니다.",
      title: "Backend Developer",
      jobGroup: "Engineering",
      jobRole: "Backend",
      jobDescription: "NestJS와 PostgreSQL 기반 API를 함께 만들 지원자를 찾습니다.",
      location: "Seoul",
      careerLevel: "Junior",
      employmentType: "Full-time",
      techStacks: ["Node.js", "NestJS", "PostgreSQL"],
      postingStatus: "OPEN",
      startsOn: "2026-06-01",
      endsOn: "2026-07-31",
      createdAt: "2026-06-01T00:00:00.000Z",
    },
    {
      jobId: 2,
      companyId: 2,
      isPublic: true,
      companyName: "Jungle Works",
      companyIndustry: "Mobile Platform",
      companyProfile: "지원자 경험을 모바일 중심으로 개선하는 프로덕트 팀입니다.",
      title: "Android Developer",
      jobGroup: "Engineering",
      jobRole: "Android",
      jobDescription: "지원자 경험을 깊게 이해하는 Android 개발자를 찾습니다.",
      location: "Pangyo",
      careerLevel: "Entry",
      employmentType: "Intern",
      techStacks: ["Kotlin", "Android", "REST"],
      postingStatus: "CLOSING_SOON",
      startsOn: "2026-06-15",
      endsOn: "2026-06-30",
      createdAt: "2026-06-15T00:00:00.000Z",
    },
    {
      jobId: 3,
      companyId: 3,
      isPublic: true,
      companyName: "Closed Company",
      companyIndustry: "Web Platform",
      companyProfile: "마감된 공고를 보유한 예시 회사입니다.",
      title: "Closed Frontend Developer",
      jobGroup: "Engineering",
      jobRole: "Frontend",
      jobDescription: "마감된 공고입니다.",
      location: "Seoul",
      careerLevel: "Junior",
      employmentType: "Full-time",
      techStacks: ["React", "TypeScript"],
      postingStatus: "CLOSED",
      startsOn: "2026-05-01",
      endsOn: "2026-05-31",
      createdAt: "2026-05-01T00:00:00.000Z",
    },
    {
      jobId: 4,
      companyId: 4,
      isPublic: false,
      companyName: "Private Company",
      companyIndustry: "Internal Platform",
      companyProfile: "초대 전용 공고를 보유한 예시 회사입니다.",
      title: "Private Backend Developer",
      jobGroup: "Engineering",
      jobRole: "Backend",
      jobDescription: "공개 목록에 노출되지 않는 초대 전용 공고입니다.",
      location: "Remote",
      careerLevel: "Senior",
      employmentType: "Full-time",
      techStacks: ["Node.js", "PostgreSQL"],
      postingStatus: "OPEN",
      startsOn: "2026-06-01",
      endsOn: "2026-07-31",
      createdAt: "2026-06-20T00:00:00.000Z",
    },
  ];

  private readonly applications: Application[] = [];
  private readonly documents: ApplicationDocument[] = [];
  private readonly consentRecords: ConsentRecord[] = [];
  private readonly fileAssets: FileAsset[] = [];
  private readonly portfolioLinks: PortfolioLink[] = [];

  async listJobs(): Promise<CandidateJob[]> {
    return [...this.jobs];
  }

  async findJob(jobId: number): Promise<CandidateJob | undefined> {
    return this.jobs.find((job) => job.jobId === jobId);
  }

  async findFileAsset(fileId: number): Promise<FileAsset | undefined> {
    return this.fileAssets.find((fileAsset) => fileAsset.fileId === fileId);
  }

  async hasApplication(candidateId: number, postingId: number): Promise<boolean> {
    return this.applications.some(
      (application) => application.candidateId === candidateId && application.postingId === postingId,
    );
  }

  async createApplication(input: {
    postingId: number;
    candidateId: number;
    resumeFileId: number;
    portfolioFileId?: number;
    portfolioUrl?: string;
    consentTypes: ConsentRecord["consentType"][];
  }): Promise<ApplicationSubmissionResult> {
    if (await this.hasApplication(input.candidateId, input.postingId)) {
      throw new CandidateDomainError("APPLICATION_ALREADY_SUBMITTED", "이미 지원한 채용공고입니다.", 409);
    }

    const now = new Date().toISOString();
    const application: Application = {
      applicationId: this.applications.length + 1,
      postingId: input.postingId,
      candidateId: input.candidateId,
      applicationStatus: "SUBMITTED",
      documentStatus: "SUBMITTED",
      interviewStatus: "NOT_READY",
      reportStatus: "PENDING",
      submittedAt: now,
      updatedAt: now,
    };
    this.applications.push(application);

    const documents = [this.createApplicationDocument(1, application.applicationId, input.resumeFileId, "RESUME", now)];
    if (input.portfolioFileId) {
      documents.push(
        this.createApplicationDocument(2, application.applicationId, input.portfolioFileId, "PORTFOLIO", now),
      );
    }
    this.documents.push(...documents);

    const consents = input.consentTypes.map((consentType, index) => ({
      consentId: this.consentRecords.length + index + 1,
      applicationId: application.applicationId,
      consentType,
      agreed: true as const,
      agreedAt: now,
    }));
    this.consentRecords.push(...consents);

    const portfolioLink = input.portfolioUrl
      ? await this.createPortfolioLink({
          candidateId: input.candidateId,
          applicationId: application.applicationId,
          linkType: input.portfolioUrl.includes("github.com") ? "GITHUB" : "PORTFOLIO",
          url: input.portfolioUrl,
          description: "Application portfolio link",
        })
      : undefined;

    return { application, documents, consents, portfolioLink };
  }

  async createFileAsset(input: Omit<FileAsset, "fileId" | "createdAt" | "status">): Promise<FileAsset> {
    const requestBody = input as unknown as Record<string, unknown>;
    const forbiddenField = FORBIDDEN_FILE_PAYLOAD_FIELDS.find((field) => Object.hasOwn(requestBody, field));
    if (forbiddenField) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "file_assets only stores metadata.", 400, [
        { field: forbiddenField, reason: "raw file payload must be uploaded to object storage first" },
      ]);
    }

    const fileAsset: FileAsset = {
      ownerUserId: input.ownerUserId,
      storageKey: input.storageKey,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      fileId: this.fileAssets.length + 1,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    };
    this.fileAssets.push(fileAsset);
    return fileAsset;
  }

  async createPortfolioLink(input: Omit<PortfolioLink, "portfolioLinkId" | "createdAt">): Promise<PortfolioLink> {
    const portfolioLink: PortfolioLink = {
      ...input,
      portfolioLinkId: this.portfolioLinks.length + 1,
      createdAt: new Date().toISOString(),
    };
    this.portfolioLinks.push(portfolioLink);
    return portfolioLink;
  }

  private createApplicationDocument(
    offset: number,
    applicationId: number,
    fileId: number,
    documentType: "RESUME" | "PORTFOLIO",
    uploadedAt: string,
  ): ApplicationDocument {
    return {
      documentId: this.documents.length + offset,
      applicationId,
      fileId,
      documentType,
      parseStatus: "SUBMITTED",
      uploadedAt,
    };
  }
}
