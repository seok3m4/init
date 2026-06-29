export type PostingStatus = "DRAFT" | "OPEN" | "CLOSING_SOON" | "CLOSED" | "ARCHIVED";
export type CandidateJobListPostingStatus = Extract<PostingStatus, "OPEN" | "CLOSING_SOON">;
export type SortOrder = "asc" | "desc";
export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "INTERVIEW_WAITING"
  | "INTERVIEW_DONE"
  | "COMPLETED"
  | "CANCELED";
export type DocumentStatus = "NOT_SUBMITTED" | "SUBMITTED" | "EXTRACTING" | "EXTRACTED" | "FAILED";
export type DocumentType = "RESUME" | "PORTFOLIO";
export type InterviewStatus = "NOT_READY" | "READY" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
export type InterviewType = "MOCK" | "RECRUITING";
export type QuestionType = "INTRO" | "TECHNICAL" | "EXPERIENCE" | "SITUATION" | "FOLLOW_UP" | "CLOSING";
export type DeviceCheckStatus = "PENDING" | "PASSED" | "FAILED";
export type ReportStatus = "PENDING" | "GENERATING" | "COMPLETED" | "FAILED";
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
  applicationStatus: ApplicationStatus;
  documentStatus: DocumentStatus;
  interviewStatus: InterviewStatus;
  reportStatus: ReportStatus;
  submittedAt: string;
  updatedAt: string;
}

export interface CandidateApplicationDocument {
  documentId: number;
  applicationId: number;
  fileId: number;
  documentType: DocumentType;
  parseStatus: DocumentStatus;
  uploadedAt: string;
}

export interface CandidateConsentRecord {
  consentId: number;
  applicationId: number;
  consentType: ConsentType;
  agreed: true;
  agreedAt: string;
}

export interface CandidateInterviewDeviceCheck {
  cameraGranted: boolean;
  microphoneGranted: boolean;
  networkStable: boolean;
  status: DeviceCheckStatus;
  checkedAt?: string;
}

export interface CandidateApplicationSummary {
  applicationId: number;
  postingId: number;
  candidateId: number;
  companyName: string;
  jobTitle: string;
  jobRole: string;
  location: string;
  applicationStatus: ApplicationStatus;
  documentStatus: DocumentStatus;
  interviewStatus: InterviewStatus;
  reportStatus: ReportStatus;
  submittedAt: string;
  updatedAt: string;
  sessionId: number;
  interviewType: InterviewType;
  interviewSessionStatus: InterviewStatus;
  interviewWindowStartsAt: string;
  interviewWindowEndsAt: string;
  consentCompleted: boolean;
  deviceCheckCompleted: boolean;
  canStartInterview: boolean;
}

export interface CandidateInterviewGuide {
  applicationId: number;
  sessionId: number;
  interviewType: "RECRUITING";
  interviewWindowStartsAt: string;
  interviewWindowEndsAt: string;
  method: string[];
  requiredPreparations: string[];
  requiredConsentTypes: ConsentType[];
  consentCompleted: boolean;
  deviceCheckCompleted: boolean;
  canStart: boolean;
}

export interface SaveInterviewConsentRequest {
  consentTypes: ConsentType[];
}

export interface SaveInterviewConsentResponse {
  applicationId: number;
  sessionId: number;
  consentCompleted: boolean;
  deviceCheckCompleted: boolean;
  canStart: boolean;
  consents: CandidateConsentRecord[];
}

export interface InterviewDeviceCheckRequest {
  cameraGranted: boolean;
  microphoneGranted: boolean;
  networkStable: boolean;
}

export interface InterviewDeviceCheckResponse {
  applicationId: number;
  sessionId: number;
  consentCompleted: boolean;
  deviceCheckCompleted: boolean;
  canStart: boolean;
  deviceCheck: CandidateInterviewDeviceCheck;
}

export interface StartInterviewResponse {
  applicationId: number;
  sessionId: number;
  interviewStatus: "IN_PROGRESS";
  sessionStatus: "IN_PROGRESS";
  interviewUrl: string;
  startedAt: string;
}

export interface CandidateInterviewRuntimeView {
  applicationId: number;
  sessionId: number;
  interviewType: "RECRUITING";
  status: InterviewStatus;
  showQuestionText: boolean;
  canRecord: boolean;
  nextQuestionEndpoint: string;
  answerUploadEndpoint: string;
}

export interface RuntimeFileAssetRequest {
  storageKey: string;
  originalName: string;
  mimeType: "video/webm" | "video/mp4" | "audio/webm" | "audio/mpeg" | "audio/wav";
  sizeBytes: number;
}

export interface StartMockInterviewRequest {
  jobRole?: string;
  difficulty?: "EASY" | "NORMAL" | "HARD";
  questionTypes?: QuestionType[];
  showQuestionText?: boolean;
}

export interface RuntimeQuestionView {
  questionId: number;
  questionType: QuestionType;
  sortOrder: number;
  content?: string;
  audioPrompt: string;
  answered: boolean;
  current: boolean;
}

export interface InterviewRuntimeSessionView {
  sessionId: number;
  applicationId?: number;
  interviewType: InterviewType;
  status: InterviewStatus;
  showQuestionText: boolean;
  currentQuestion?: RuntimeQuestionView;
  totalQuestions: number;
  answeredCount: number;
  canRecord: boolean;
  nextQuestionEndpoint: string;
  answerUploadEndpoint: string;
}

export interface StartMockInterviewResponse extends InterviewRuntimeSessionView {
  startedAt: string;
}

export interface RuntimeQuestionListResponse {
  sessionId: number;
  interviewType: InterviewType;
  showQuestionText: boolean;
  currentQuestionId?: number;
  questions: RuntimeQuestionView[];
}

export interface SaveInterviewAnswerRequest {
  questionId: number;
  videoFileId?: number;
  videoFile?: RuntimeFileAssetRequest;
  audioFileId?: number;
  audioFile?: RuntimeFileAssetRequest;
  durationSeconds: number;
}

export interface InterviewAnswer {
  answerId: number;
  sessionId: number;
  questionId: number;
  videoFileId?: number;
  audioFileId?: number;
  durationSeconds: number;
  submittedAt: string;
}

export interface SaveInterviewAnswerResponse {
  sessionId: number;
  answer: InterviewAnswer;
  videoFile?: CandidateFileAsset;
  audioFile?: CandidateFileAsset;
  nextQuestionAvailable: boolean;
}

export interface NextInterviewQuestionResponse {
  sessionId: number;
  previousQuestionId: number;
  currentQuestion?: RuntimeQuestionView;
  isLastQuestion: boolean;
}

export interface CompleteInterviewResponse {
  sessionId: number;
  applicationId?: number;
  interviewType: InterviewType;
  status: "COMPLETED";
  completedAt: string;
  answeredCount: number;
  totalQuestions: number;
}

export interface AiInterviewRequest {
  answerId?: number;
}

export interface AiInterviewHandoffResponse {
  accepted: true;
  processType: "STT" | "FOLLOW_UP";
  status: "PENDING";
  sessionId: number;
  applicationId?: number;
  answerId: number;
  questionId: number;
  fileId?: number;
  videoFileId?: number;
  audioFileId?: number;
  callbackTopic: string;
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
  mockInterviews: "/api/v1/candidate/mock-interviews",
  mockRuntime: (sessionId: number) => `/api/v1/candidate/mock-interviews/${sessionId}`,
  mockQuestions: (sessionId: number) => `/api/v1/candidate/mock-interviews/${sessionId}/questions`,
  mockAnswers: (sessionId: number) => `/api/v1/candidate/mock-interviews/${sessionId}/answers`,
  mockNextQuestion: (sessionId: number) => `/api/v1/candidate/mock-interviews/${sessionId}/next-question`,
  mockComplete: (sessionId: number) => `/api/v1/candidate/mock-interviews/${sessionId}/complete`,
  mockStt: (sessionId: number) => `/api/v1/candidate/mock-interviews/${sessionId}/stt`,
  mockFollowUpQuestion: (sessionId: number) => `/api/v1/candidate/mock-interviews/${sessionId}/follow-up-question`,
  applications: "/api/v1/candidate/applications",
  interviewGuide: (applicationId: number) => `/api/v1/candidate/applications/${applicationId}/interview-guide`,
  interviewConsent: (applicationId: number) => `/api/v1/candidate/applications/${applicationId}/consent`,
  deviceCheck: (sessionId: number) => `/api/v1/candidate/interviews/${sessionId}/device-check`,
  startInterview: (applicationId: number) => `/api/v1/candidate/applications/${applicationId}/interview/start`,
  interviewRuntime: (applicationId: number) => `/api/v1/candidate/applications/${applicationId}/interview`,
  recruitingQuestions: (sessionId: number) => `/api/v1/candidate/interviews/${sessionId}/questions`,
  recruitingAnswers: (sessionId: number) => `/api/v1/candidate/interviews/${sessionId}/answers`,
  recruitingNextQuestion: (sessionId: number) => `/api/v1/candidate/interviews/${sessionId}/next-question`,
  recruitingComplete: (sessionId: number) => `/api/v1/candidate/interviews/${sessionId}/complete`,
  recruitingStt: (sessionId: number) => `/api/v1/candidate/interviews/${sessionId}/stt`,
  recruitingFollowUpQuestion: (sessionId: number) => `/api/v1/candidate/interviews/${sessionId}/follow-up-question`,
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
  startMockInterview(body: StartMockInterviewRequest): Promise<ApiResponse<StartMockInterviewResponse>>;
  getMockRuntime(sessionId: number): Promise<ApiResponse<InterviewRuntimeSessionView>>;
  listMockQuestions(sessionId: number): Promise<ApiResponse<RuntimeQuestionListResponse>>;
  saveMockAnswer(sessionId: number, body: SaveInterviewAnswerRequest): Promise<ApiResponse<SaveInterviewAnswerResponse>>;
  moveMockNextQuestion(sessionId: number): Promise<ApiResponse<NextInterviewQuestionResponse>>;
  completeMockInterview(sessionId: number): Promise<ApiResponse<CompleteInterviewResponse>>;
  requestMockStt(sessionId: number, body: AiInterviewRequest): Promise<ApiResponse<AiInterviewHandoffResponse>>;
  requestMockFollowUpQuestion(
    sessionId: number,
    body: AiInterviewRequest,
  ): Promise<ApiResponse<AiInterviewHandoffResponse>>;
  listApplications(): Promise<ApiListResponse<CandidateApplicationSummary>>;
  getInterviewGuide(applicationId: number): Promise<ApiResponse<CandidateInterviewGuide>>;
  saveInterviewConsent(
    applicationId: number,
    body: SaveInterviewConsentRequest,
  ): Promise<ApiResponse<SaveInterviewConsentResponse>>;
  saveDeviceCheck(
    sessionId: number,
    body: InterviewDeviceCheckRequest,
  ): Promise<ApiResponse<InterviewDeviceCheckResponse>>;
  startInterview(applicationId: number): Promise<ApiResponse<StartInterviewResponse>>;
  getInterviewRuntime(applicationId: number): Promise<ApiResponse<CandidateInterviewRuntimeView>>;
  listRecruitingQuestions(sessionId: number): Promise<ApiResponse<RuntimeQuestionListResponse>>;
  saveRecruitingAnswer(
    sessionId: number,
    body: SaveInterviewAnswerRequest,
  ): Promise<ApiResponse<SaveInterviewAnswerResponse>>;
  moveRecruitingNextQuestion(sessionId: number): Promise<ApiResponse<NextInterviewQuestionResponse>>;
  completeRecruitingInterview(sessionId: number): Promise<ApiResponse<CompleteInterviewResponse>>;
  requestRecruitingStt(sessionId: number, body: AiInterviewRequest): Promise<ApiResponse<AiInterviewHandoffResponse>>;
  requestRecruitingFollowUpQuestion(
    sessionId: number,
    body: AiInterviewRequest,
  ): Promise<ApiResponse<AiInterviewHandoffResponse>>;
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
    startMockInterview: (body) =>
      request<ApiResponse<StartMockInterviewResponse>>(candidateApiPaths.mockInterviews, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getMockRuntime: (sessionId) =>
      request<ApiResponse<InterviewRuntimeSessionView>>(candidateApiPaths.mockRuntime(sessionId)),
    listMockQuestions: (sessionId) =>
      request<ApiResponse<RuntimeQuestionListResponse>>(candidateApiPaths.mockQuestions(sessionId)),
    saveMockAnswer: (sessionId, body) =>
      request<ApiResponse<SaveInterviewAnswerResponse>>(candidateApiPaths.mockAnswers(sessionId), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    moveMockNextQuestion: (sessionId) =>
      request<ApiResponse<NextInterviewQuestionResponse>>(candidateApiPaths.mockNextQuestion(sessionId), {
        method: "POST",
      }),
    completeMockInterview: (sessionId) =>
      request<ApiResponse<CompleteInterviewResponse>>(candidateApiPaths.mockComplete(sessionId), {
        method: "PATCH",
      }),
    requestMockStt: (sessionId, body) =>
      request<ApiResponse<AiInterviewHandoffResponse>>(candidateApiPaths.mockStt(sessionId), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    requestMockFollowUpQuestion: (sessionId, body) =>
      request<ApiResponse<AiInterviewHandoffResponse>>(candidateApiPaths.mockFollowUpQuestion(sessionId), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listApplications: () =>
      request<ApiListResponse<CandidateApplicationSummary>>(candidateApiPaths.applications),
    getInterviewGuide: (applicationId) =>
      request<ApiResponse<CandidateInterviewGuide>>(candidateApiPaths.interviewGuide(applicationId)),
    saveInterviewConsent: (applicationId, body) =>
      request<ApiResponse<SaveInterviewConsentResponse>>(candidateApiPaths.interviewConsent(applicationId), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    saveDeviceCheck: (sessionId, body) =>
      request<ApiResponse<InterviewDeviceCheckResponse>>(candidateApiPaths.deviceCheck(sessionId), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    startInterview: (applicationId) =>
      request<ApiResponse<StartInterviewResponse>>(candidateApiPaths.startInterview(applicationId), {
        method: "POST",
      }),
    getInterviewRuntime: (applicationId) =>
      request<ApiResponse<CandidateInterviewRuntimeView>>(candidateApiPaths.interviewRuntime(applicationId)),
    listRecruitingQuestions: (sessionId) =>
      request<ApiResponse<RuntimeQuestionListResponse>>(candidateApiPaths.recruitingQuestions(sessionId)),
    saveRecruitingAnswer: (sessionId, body) =>
      request<ApiResponse<SaveInterviewAnswerResponse>>(candidateApiPaths.recruitingAnswers(sessionId), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    moveRecruitingNextQuestion: (sessionId) =>
      request<ApiResponse<NextInterviewQuestionResponse>>(candidateApiPaths.recruitingNextQuestion(sessionId), {
        method: "POST",
      }),
    completeRecruitingInterview: (sessionId) =>
      request<ApiResponse<CompleteInterviewResponse>>(candidateApiPaths.recruitingComplete(sessionId), {
        method: "PATCH",
      }),
    requestRecruitingStt: (sessionId, body) =>
      request<ApiResponse<AiInterviewHandoffResponse>>(candidateApiPaths.recruitingStt(sessionId), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    requestRecruitingFollowUpQuestion: (sessionId, body) =>
      request<ApiResponse<AiInterviewHandoffResponse>>(candidateApiPaths.recruitingFollowUpQuestion(sessionId), {
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
