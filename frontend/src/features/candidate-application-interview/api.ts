export type PostingStatus = "DRAFT" | "OPEN" | "CLOSING_SOON" | "CLOSED" | "ARCHIVED";
export type CandidateJobListPostingStatus = Extract<PostingStatus, "OPEN" | "CLOSING_SOON">;
export type SortOrder = "asc" | "desc";
export type ConsentType = "PRIVACY_COLLECTION" | "AI_DOCUMENT_ANALYSIS" | "AI_INTERVIEW_RECORDING";
export type PortfolioLinkType = "PORTFOLIO" | "GITHUB";

export interface PageMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
}

export interface ApiMeta {
  traceId: string;
  timestamp: string;
  page?: PageMeta;
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiListResponse<T> {
  data: {
    items: T[];
  };
  meta: ApiMeta & {
    page: PageMeta;
  };
}

export interface ApiErrorDetail {
  field?: string;
  reason: string;
  message?: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: ApiErrorDetail[];
  };
  meta: ApiMeta;
}

export interface CandidateJobQuery {
  page?: number;
  limit?: number;
  q?: string;
  jobRole?: string;
  jobGroup?: string;
  location?: string;
  careerLevel?: string;
  postingStatus?: CandidateJobListPostingStatus;
  sort?: "createdAt" | "endsOn" | "title";
  order?: SortOrder;
}

export interface CandidateJobSummary {
  jobId: number;
  companyName: string;
  title: string;
  jobGroup: string;
  jobRole: string;
  location: string;
  careerLevel: string;
  employmentType: string;
  postingStatus: PostingStatus;
  startsOn: string;
  endsOn: string;
}

export interface CandidateJobDetail extends CandidateJobSummary {
  companyId: number;
  isPublic: boolean;
  companyIndustry: string;
  companyProfile: string;
  jobDescription: string;
  techStacks: string[];
  createdAt: string;
  canApply: boolean;
  alreadyApplied: boolean;
}

export interface CandidateDocumentPolicy {
  storageProvider: "S3";
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  storageKeyPrefix: string;
  metadataOnly: true;
}

export interface CandidateApplyView {
  job: CandidateJobDetail;
  documentPolicy: CandidateDocumentPolicy;
  requiredConsentTypes: ConsentType[];
  portfolioRequired: true;
}

export interface SubmitApplicationRequest {
  candidateName: string;
  email: string;
  phone: string;
  resumeFileId: number;
  portfolioFileId?: number;
  portfolioUrl?: string;
  coverLetter?: string;
  consentTypes: ConsentType[];
}

export interface UploadResumeRequest {
  storageKey: string;
  originalName: string;
  mimeType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  sizeBytes: number;
}

export interface CreatePortfolioLinkRequest {
  linkType?: PortfolioLinkType;
  url: string;
  description?: string;
  fileId?: number;
}

export interface CandidateFileAsset {
  fileId: number;
  ownerUserId: number;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: "ACTIVE";
  createdAt: string;
}

export interface CandidateApplication {
  applicationId: number;
  postingId: number;
  candidateId: number;
  applicationStatus: "SUBMITTED";
  documentStatus: "SUBMITTED";
  interviewStatus: "NOT_READY";
  reportStatus: "PENDING";
  submittedAt: string;
  updatedAt: string;
}

export interface CandidateApplicationDocument {
  documentId: number;
  applicationId: number;
  fileId: number;
  documentType: "RESUME" | "PORTFOLIO";
  parseStatus: "SUBMITTED";
  uploadedAt: string;
}

export interface CandidateConsentRecord {
  consentId: number;
  applicationId: number;
  consentType: ConsentType;
  agreed: true;
  agreedAt: string;
}

export interface CandidatePortfolioLink {
  portfolioLinkId: number;
  candidateId: number;
  applicationId?: number;
  linkType: PortfolioLinkType;
  url: string;
  description?: string;
  fileId?: number;
  createdAt: string;
}

export interface SubmitApplicationResponse {
  application: CandidateApplication;
  documents: CandidateApplicationDocument[];
  consents: CandidateConsentRecord[];
  portfolioLink?: CandidatePortfolioLink;
}

export const candidateApiPaths = {
  jobs: "/api/v1/candidate/jobs",
  jobDetail: (jobId: number) => `/api/v1/candidate/jobs/${jobId}`,
  applyView: (jobId: number) => `/api/v1/candidate/jobs/${jobId}/apply`,
  submitApplication: (jobId: number) => `/api/v1/candidate/jobs/${jobId}/applications`,
  resume: "/api/v1/candidate/resume",
  portfolioLinks: "/api/v1/candidate/portfolio-links",
} as const;

export class CandidateApiError extends Error {
  readonly status: number;
  readonly body?: ApiErrorBody;

  constructor(status: number, body?: ApiErrorBody) {
    super(body?.error.message ?? `Candidate API request failed with status ${status}`);
    this.name = "CandidateApiError";
    this.status = status;
    this.body = body;
  }
}

export interface CandidateApiClientOptions {
  baseUrl?: string;
  headers?: HeadersInit;
  fetcher?: typeof fetch;
}

export interface CandidateApiClient {
  listJobs(query?: CandidateJobQuery): Promise<ApiListResponse<CandidateJobSummary>>;
  getJobDetail(jobId: number): Promise<ApiResponse<CandidateJobDetail>>;
  getApplyView(jobId: number): Promise<ApiResponse<CandidateApplyView>>;
  submitApplication(jobId: number, body: SubmitApplicationRequest): Promise<ApiResponse<SubmitApplicationResponse>>;
  uploadResume(body: UploadResumeRequest): Promise<ApiResponse<CandidateFileAsset>>;
  createPortfolioLink(
    body: CreatePortfolioLinkRequest,
  ): Promise<ApiResponse<CandidatePortfolioLink>>;
}

export function createCandidateApiClient(options: CandidateApiClientOptions = {}): CandidateApiClient {
  const fetcher = options.fetcher ?? fetch;

  async function request<T>(
    path: string,
    init: RequestInit = {},
    query?: CandidateJobQueryParams,
  ): Promise<T> {
    const response = await fetcher(toUrl(options.baseUrl, path, query), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...options.headers,
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw new CandidateApiError(response.status, await readErrorBody(response));
    }

    return (await response.json()) as T;
  }

  return {
    listJobs: (query = {}) => request<ApiListResponse<CandidateJobSummary>>(candidateApiPaths.jobs, {}, query),
    getJobDetail: (jobId) => request<ApiResponse<CandidateJobDetail>>(candidateApiPaths.jobDetail(jobId)),
    getApplyView: (jobId) => request<ApiResponse<CandidateApplyView>>(candidateApiPaths.applyView(jobId)),
    submitApplication: (jobId, body) =>
      request<ApiResponse<SubmitApplicationResponse>>(candidateApiPaths.submitApplication(jobId), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    uploadResume: (body) =>
      request<ApiResponse<CandidateFileAsset>>(candidateApiPaths.resume, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    createPortfolioLink: (body) =>
      request<ApiResponse<CandidatePortfolioLink>>(candidateApiPaths.portfolioLinks, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  };
}

type CandidateJobQueryParams = Partial<Record<keyof CandidateJobQuery, string | number | undefined>>;

function toUrl(baseUrl: string | undefined, path: string, query?: CandidateJobQueryParams): string {
  const url = `${baseUrl ?? ""}${path}`;
  const params = new URLSearchParams();

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const suffix = params.toString();
  return suffix ? `${url}?${suffix}` : url;
}

async function readErrorBody(response: Response): Promise<ApiErrorBody | undefined> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return undefined;
  }
}
