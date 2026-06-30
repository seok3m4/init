import type {
  ApplicationStatus,
  DocumentStatus,
  FileAsset,
  InterviewStatus,
  ReportStatus,
} from "../candidate";
import type { QuestionType } from "../interview";

export type CandidateReportType = "MOCK_INTERVIEW_REPORT" | "RECRUITING_REPORT";
export type TranscriptStatus = "PENDING" | "AVAILABLE";

export interface CandidateMockInterviewHistoryItem {
  sessionId: number;
  reportId: number;
  interviewType: "MOCK";
  status: InterviewStatus;
  reportStatus: ReportStatus;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  totalQuestions: number;
  answeredCount: number;
}

export interface CandidateMockReportSummary extends CandidateMockInterviewHistoryItem {
  reportType: "MOCK_INTERVIEW_REPORT";
  feedbackEndpoint: string;
  mediaEndpoint: string;
  generateEndpoint: string;
}

export interface CandidateMockReportFeedback {
  reportId: number;
  sessionId: number;
  reportType: "MOCK_INTERVIEW_REPORT";
  status: ReportStatus;
  generatedAt?: string;
  summary?: string;
  strengths: string[];
  improvements: string[];
  nextPractice: string[];
  visibilityPolicy: {
    candidateFacingOnly: true;
    excludesHiringDecision: true;
    excludesInternalScores: true;
    excludesCompanyMemo: true;
  };
}

export interface CandidateReportFileReference {
  fileId: number;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: FileAsset["status"];
  createdAt: string;
}

export interface CandidateMockReportMediaItem {
  answerId: number;
  questionId: number;
  questionType: QuestionType;
  sortOrder: number;
  questionContent?: string;
  videoFile?: CandidateReportFileReference;
  audioFile?: CandidateReportFileReference;
  durationSeconds: number;
  submittedAt: string;
  transcriptStatus: TranscriptStatus;
  transcript?: string;
}

export interface CandidateMockReportMedia {
  reportId: number;
  sessionId: number;
  reportType: "MOCK_INTERVIEW_REPORT";
  status: ReportStatus;
  media: CandidateMockReportMediaItem[];
}

export interface CandidateReportGenerationHandoff {
  accepted: true;
  processType: "REPORT_GENERATE";
  status: "PENDING";
  reportId: number;
  sessionId: number;
  reportType: "MOCK_INTERVIEW_REPORT";
  answerIds: number[];
  fileIds: number[];
  callbackTopic: "ai.report.generate.requested";
}

export interface CandidateApplicationStatusView {
  applicationId: number;
  postingId: number;
  companyName: string;
  jobTitle: string;
  jobRole: string;
  applicationStatus: ApplicationStatus;
  documentStatus: DocumentStatus;
  interviewStatus: InterviewStatus;
  reportStatus: ReportStatus;
  sessionId: number;
  interviewSessionStatus: InterviewStatus;
  submittedAt: string;
  updatedAt: string;
  reportAvailable: boolean;
}

export interface CandidateRecruitingReportView {
  applicationId: number;
  sessionId: number;
  reportType: "RECRUITING_REPORT";
  status: ReportStatus;
  applicationStatus: ApplicationStatus;
  interviewStatus: InterviewStatus;
  companyName: string;
  jobTitle: string;
  summary?: string;
  candidateMessage: string;
  nextStepLabel: string;
  visibilityPolicy: {
    candidateFacingOnly: true;
    excludesDetailedScores: true;
    excludesEvaluationEvidence: true;
    excludesInternalMemo: true;
    excludesManualEvaluation: true;
  };
}
