import type {
  CandidateApplicationSummary,
  CandidateJobDetail,
  CandidateJobQuery,
  CandidateJobSummary,
  ConsentType,
  CreatePortfolioLinkRequest,
  InterviewDeviceCheckRequest,
  PortfolioLinkType,
  SaveInterviewConsentRequest,
  SubmitApplicationRequest,
  UploadResumeRequest,
} from "./api";
import { candidateApplicationInterviewRoutes } from "./routes";

export interface CandidateApplicationFormState {
  candidateName: string;
  email: string;
  phone: string;
  resumeFileId?: number;
  portfolioFileId?: number;
  portfolioUrl?: string;
  coverLetter?: string;
  consentTypes: ConsentType[];
}

export interface CandidateResumeUploadState {
  candidateId: number;
  storageKey: string;
  originalName: string;
  mimeType: UploadResumeRequest["mimeType"] | "";
  sizeBytes: number;
}

export interface CandidatePortfolioLinkFormState {
  linkType: PortfolioLinkType;
  url: string;
  description: string;
  fileId?: number;
}

export interface CandidateInterviewConsentState {
  consentTypes: ConsentType[];
}

export interface CandidateDeviceCheckState {
  cameraGranted: boolean;
  microphoneGranted: boolean;
  networkStable: boolean;
}

export const requiredApplicationConsents: ConsentType[] = ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"];
export const requiredInterviewConsents: ConsentType[] = [
  "PRIVACY_COLLECTION",
  "AI_DOCUMENT_ANALYSIS",
  "AI_INTERVIEW_RECORDING",
];
export const maxCandidateDocumentSizeBytes = 20 * 1024 * 1024;
export const allowedCandidateDocumentMimeTypes: UploadResumeRequest["mimeType"][] = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const defaultCandidateJobQuery: CandidateJobQuery = {
  page: 1,
  limit: 20,
  sort: "createdAt",
  order: "desc",
};

export const defaultApplicationFormState: CandidateApplicationFormState = {
  candidateName: "",
  email: "",
  phone: "",
  consentTypes: [],
};

export const defaultPortfolioLinkFormState: CandidatePortfolioLinkFormState = {
  linkType: "PORTFOLIO",
  url: "",
  description: "",
};

export const defaultInterviewConsentState: CandidateInterviewConsentState = {
  consentTypes: [],
};

export const defaultDeviceCheckState: CandidateDeviceCheckState = {
  cameraGranted: false,
  microphoneGranted: false,
  networkStable: false,
};

export function toSubmitApplicationRequest(state: CandidateApplicationFormState): SubmitApplicationRequest {
  const candidateName = state.candidateName.trim();
  const email = state.email.trim();
  const phone = state.phone.trim();

  if (!candidateName || !email || !phone) {
    throw new Error("candidateName, email, and phone are required before submitting an application.");
  }

  if (!isEmail(email)) {
    throw new Error("email must be a valid email address before submitting an application.");
  }

  if (!state.resumeFileId) {
    throw new Error("resumeFileId is required before submitting an application.");
  }

  if (!hasPortfolioArtifact(state)) {
    throw new Error("portfolioFileId or portfolioUrl is required before submitting an application.");
  }

  if (!hasRequiredConsents(state.consentTypes)) {
    throw new Error("required consentTypes are missing before submitting an application.");
  }

  return {
    candidateName,
    email,
    phone,
    resumeFileId: state.resumeFileId,
    portfolioFileId: state.portfolioFileId,
    portfolioUrl: state.portfolioUrl?.trim() || undefined,
    coverLetter: state.coverLetter?.trim() || undefined,
    consentTypes: state.consentTypes,
  };
}

export function isJobApplyEnabled(job: Pick<CandidateJobSummary, "jobId" | "postingStatus">): boolean {
  return job.postingStatus === "OPEN" || job.postingStatus === "CLOSING_SOON";
}

export function getCandidateJobActionHref(job: Pick<CandidateJobSummary, "jobId" | "postingStatus">): string {
  return isJobApplyEnabled(job)
    ? candidateApplicationInterviewRoutes.apply(job.jobId)
    : candidateApplicationInterviewRoutes.jobDetail(job.jobId);
}

export function getCandidateJobDetailActionHref(
  job: Pick<CandidateJobDetail, "jobId" | "canApply" | "alreadyApplied">,
): string | undefined {
  if (job.alreadyApplied) {
    return candidateApplicationInterviewRoutes.applications;
  }

  return job.canApply ? candidateApplicationInterviewRoutes.apply(job.jobId) : undefined;
}

export function getCandidateApplicationInterviewActionHref(
  application: Pick<CandidateApplicationSummary, "applicationId" | "interviewStatus">,
): string {
  return application.interviewStatus === "IN_PROGRESS"
    ? candidateApplicationInterviewRoutes.interview(application.applicationId)
    : candidateApplicationInterviewRoutes.interviewGuide(application.applicationId);
}

export function hasRequiredConsents(consentTypes: ConsentType[]): boolean {
  return requiredApplicationConsents.every((consentType) => consentTypes.includes(consentType));
}

export function hasRequiredInterviewConsents(consentTypes: ConsentType[]): boolean {
  return requiredInterviewConsents.every((consentType) => consentTypes.includes(consentType));
}

export function isCandidateInterviewStartEnabled(
  state: Pick<CandidateApplicationSummary, "consentCompleted" | "deviceCheckCompleted" | "interviewStatus">,
): boolean {
  return state.consentCompleted && state.deviceCheckCompleted && state.interviewStatus === "READY";
}

export function hasPortfolioArtifact(state: Pick<CandidateApplicationFormState, "portfolioFileId" | "portfolioUrl">) {
  return Boolean(state.portfolioFileId) || Boolean(state.portfolioUrl?.trim());
}

export function toSaveInterviewConsentRequest(
  state: CandidateInterviewConsentState,
): SaveInterviewConsentRequest {
  if (!hasRequiredInterviewConsents(state.consentTypes)) {
    throw new Error("required interview consentTypes are missing before starting an interview.");
  }

  return {
    consentTypes: state.consentTypes,
  };
}

export function toDeviceCheckRequest(state: CandidateDeviceCheckState): InterviewDeviceCheckRequest {
  if (!state.cameraGranted || !state.microphoneGranted || !state.networkStable) {
    throw new Error("camera, microphone, and network checks must pass before starting an interview.");
  }

  return {
    cameraGranted: state.cameraGranted,
    microphoneGranted: state.microphoneGranted,
    networkStable: state.networkStable,
  };
}

export function toUploadResumeRequest(state: CandidateResumeUploadState): UploadResumeRequest {
  if (!state.storageKey.startsWith(`candidate/${state.candidateId}/`)) {
    throw new Error("resume storageKey must be under the current candidate prefix.");
  }

  if (!state.originalName.trim()) {
    throw new Error("resume originalName is required.");
  }

  if (!isAllowedCandidateDocumentMimeType(state.mimeType)) {
    throw new Error("resume mimeType must be PDF or DOCX.");
  }

  if (state.sizeBytes < 1 || state.sizeBytes > maxCandidateDocumentSizeBytes) {
    throw new Error("resume sizeBytes must be between 1 and 20MB.");
  }

  return {
    storageKey: state.storageKey,
    originalName: state.originalName.trim(),
    mimeType: state.mimeType,
    sizeBytes: state.sizeBytes,
  };
}

export function toCreatePortfolioLinkRequest(state: CandidatePortfolioLinkFormState): CreatePortfolioLinkRequest {
  const url = state.url.trim();
  const hostname = assertHttpUrl(url);
  if (state.linkType === "GITHUB" && hostname !== "github.com" && !hostname.endsWith(".github.com")) {
    throw new Error("github portfolio link must use github.com.");
  }

  return {
    linkType: state.linkType,
    url,
    description: state.description.trim() || undefined,
    fileId: state.fileId,
  };
}

export function createResumeUploadStateFromFile(
  candidateId: number,
  file: Pick<File, "name" | "type" | "size">,
): CandidateResumeUploadState {
  return {
    candidateId,
    storageKey: buildCandidateStorageKey(candidateId, file.name),
    originalName: file.name,
    mimeType: isAllowedCandidateDocumentMimeType(file.type) ? file.type : "",
    sizeBytes: file.size,
  };
}

export function buildCandidateStorageKey(candidateId: number, originalName: string): string {
  const safeName = originalName.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `candidate/${candidateId}/${Date.now()}-${safeName || "resume"}`;
}

export function isAllowedCandidateDocumentMimeType(mimeType: string): mimeType is UploadResumeRequest["mimeType"] {
  return allowedCandidateDocumentMimeTypes.includes(mimeType as UploadResumeRequest["mimeType"]);
}

export function inferPortfolioLinkType(url: string): PortfolioLinkType {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "github.com" || hostname.endsWith(".github.com") ? "GITHUB" : "PORTFOLIO";
  } catch {
    return "PORTFOLIO";
  }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function assertHttpUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
    return parsed.hostname.toLowerCase();
  } catch {
    throw new Error("portfolio url must be http or https.");
  }
}
