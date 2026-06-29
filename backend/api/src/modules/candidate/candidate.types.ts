export type PostingStatus = "DRAFT" | "OPEN" | "CLOSING_SOON" | "CLOSED" | "ARCHIVED";
export type ApplicationStatus = "SUBMITTED";
export type DocumentStatus = "SUBMITTED";
export type InterviewStatus = "NOT_READY";
export type ReportStatus = "PENDING";
export type DocumentType = "RESUME" | "PORTFOLIO";
export type ConsentType = "PRIVACY_COLLECTION" | "AI_DOCUMENT_ANALYSIS" | "AI_INTERVIEW_RECORDING";
export type PortfolioLinkType = "PORTFOLIO" | "GITHUB";
export type SortOrder = "asc" | "desc";

export interface CurrentCandidateUser {
  userId: number;
  candidateId: number;
  userType: "CANDIDATE";
}

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

export interface CandidateJob {
  jobId: number;
  companyId: number;
  isPublic: boolean;
  companyName: string;
  companyIndustry: string;
  companyProfile: string;
  title: string;
  jobGroup: string;
  jobRole: string;
  jobDescription: string;
  location: string;
  careerLevel: string;
  employmentType: string;
  techStacks: string[];
  postingStatus: PostingStatus;
  startsOn: string;
  endsOn: string;
  createdAt: string;
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

export interface CandidateJobDetail extends CandidateJob {
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

export interface FileAsset {
  fileId: number;
  ownerUserId: number;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: "ACTIVE";
  createdAt: string;
}

export interface Application {
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

export interface ApplicationDocument {
  documentId: number;
  applicationId: number;
  fileId: number;
  documentType: DocumentType;
  parseStatus: DocumentStatus;
  uploadedAt: string;
}

export interface PortfolioLink {
  portfolioLinkId: number;
  candidateId: number;
  applicationId?: number;
  linkType: PortfolioLinkType;
  url: string;
  description?: string;
  fileId?: number;
  createdAt: string;
}

export interface ConsentRecord {
  consentId: number;
  applicationId: number;
  consentType: ConsentType;
  agreed: true;
  agreedAt: string;
}

export interface ApplicationSubmissionResult {
  application: Application;
  documents: ApplicationDocument[];
  consents: ConsentRecord[];
  portfolioLink?: PortfolioLink;
}

export interface CandidateRepository {
  listJobs(): Promise<CandidateJob[]>;
  findJob(jobId: number): Promise<CandidateJob | undefined>;
  findFileAsset(fileId: number): Promise<FileAsset | undefined>;
  hasApplication(candidateId: number, postingId: number): Promise<boolean>;
  createApplication(input: {
    postingId: number;
    candidateId: number;
    resumeFileId: number;
    portfolioFileId?: number;
    portfolioUrl?: string;
    consentTypes: ConsentType[];
  }): Promise<ApplicationSubmissionResult>;
  createFileAsset(input: Omit<FileAsset, "fileId" | "createdAt" | "status">): Promise<FileAsset>;
  createPortfolioLink(input: Omit<PortfolioLink, "portfolioLinkId" | "createdAt">): Promise<PortfolioLink>;
}
