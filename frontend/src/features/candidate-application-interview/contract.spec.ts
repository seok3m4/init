import type {
  ApiErrorBody,
  CandidateApplicationSummary,
  CandidateJobListPostingStatus,
  CandidateJobQuery,
  CreatePortfolioLinkRequest,
  InterviewDeviceCheckRequest,
  SaveInterviewAnswerRequest,
  SaveInterviewConsentRequest,
  StartMockInterviewRequest,
  SubmitApplicationRequest,
  UploadResumeRequest,
} from "./api";
import { candidateApiPaths } from "./api";
import {
  getCandidateApplicationInterviewActionHref,
  getCandidateJobDetailActionHref,
  getMockInterviewHref,
  isCandidateInterviewStartEnabled,
  toDeviceCheckRequest,
  toCreatePortfolioLinkRequest,
  toSaveInterviewAnswerRequest,
  toSaveInterviewConsentRequest,
  toStartMockInterviewRequest,
  toSubmitApplicationRequest,
  toUploadResumeRequest,
} from "./view-model";

const listPostingStatus: CandidateJobListPostingStatus = "OPEN";
const query: CandidateJobQuery = {
  page: 1,
  limit: 20,
  q: "android",
  jobRole: "Android",
  jobGroup: "Engineering",
  location: "Pangyo",
  careerLevel: "Entry",
  postingStatus: listPostingStatus,
  sort: "endsOn",
  order: "asc",
};

// @ts-expect-error Closed postings are not a valid candidate list filter value.
const closedFilterQuery: CandidateJobQuery = { postingStatus: "CLOSED" };

const submitRequest: SubmitApplicationRequest = toSubmitApplicationRequest({
  candidateName: " Kim ",
  email: " kim@example.com ",
  phone: " 010-0000-0000 ",
  resumeFileId: 1,
  portfolioUrl: " https://portfolio.example.com/kim ",
  consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
});

const resumeRequest: UploadResumeRequest = toUploadResumeRequest({
  candidateId: 1,
  storageKey: "candidate/1/resume.pdf",
  originalName: " resume.pdf ",
  mimeType: "application/pdf",
  sizeBytes: 1024,
});

const portfolioRequest: CreatePortfolioLinkRequest = toCreatePortfolioLinkRequest({
  linkType: "GITHUB",
  url: "https://github.com/example",
  description: " GitHub ",
});

const interviewConsentRequest: SaveInterviewConsentRequest = toSaveInterviewConsentRequest({
  consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS", "AI_INTERVIEW_RECORDING"],
});

const deviceCheckRequest: InterviewDeviceCheckRequest = toDeviceCheckRequest({
  cameraGranted: true,
  microphoneGranted: true,
  networkStable: true,
});

const startMockRequest: StartMockInterviewRequest = toStartMockInterviewRequest({
  jobRole: " Android ",
  difficulty: "NORMAL",
  questionTypes: ["INTRO", "TECHNICAL"],
  showQuestionText: false,
});

const answerRequest: SaveInterviewAnswerRequest = toSaveInterviewAnswerRequest({
  questionId: 1,
  videoFile: {
    storageKey: "candidate/1/mock-answer.webm",
    originalName: "mock-answer.webm",
    mimeType: "video/webm",
    sizeBytes: 1024,
  },
  durationSeconds: 30,
});

const applicationSummary: CandidateApplicationSummary = {
  applicationId: 1,
  postingId: 1,
  candidateId: 1,
  companyName: "Init Labs",
  jobTitle: "Backend Developer",
  jobRole: "Backend",
  location: "Seoul",
  applicationStatus: "SUBMITTED",
  documentStatus: "SUBMITTED",
  interviewStatus: "READY",
  reportStatus: "PENDING",
  submittedAt: "2026-06-29T00:00:00.000Z",
  updatedAt: "2026-06-29T00:00:00.000Z",
  sessionId: 1,
  interviewType: "RECRUITING",
  interviewSessionStatus: "READY",
  interviewWindowStartsAt: "2026-06-29T00:00:00.000Z",
  interviewWindowEndsAt: "2026-07-06T00:00:00.000Z",
  consentCompleted: true,
  deviceCheckCompleted: true,
  canStartInterview: true,
};

const applicationInterviewHref = getCandidateApplicationInterviewActionHref(applicationSummary);
const applicationCanStart = isCandidateInterviewStartEnabled(applicationSummary);
const mockInterviewHref = getMockInterviewHref({ sessionId: 10001 });

const mockInterviewsPath = candidateApiPaths.mockInterviews;
const mockRuntimePath = candidateApiPaths.mockRuntime(10001);
const mockQuestionsPath = candidateApiPaths.mockQuestions(10001);
const mockAnswerPath = candidateApiPaths.mockAnswers(10001);
const mockNextQuestionPath = candidateApiPaths.mockNextQuestion(10001);
const mockCompletePath = candidateApiPaths.mockComplete(10001);
const mockSttPath = candidateApiPaths.mockStt(10001);
const mockFollowUpPath = candidateApiPaths.mockFollowUpQuestion(10001);
const applicationsPath = candidateApiPaths.applications;
const interviewGuidePath = candidateApiPaths.interviewGuide(1);
const deviceCheckPath = candidateApiPaths.deviceCheck(1);
const startInterviewPath = candidateApiPaths.startInterview(1);
const runtimePath = candidateApiPaths.interviewRuntime(1);
const recruitingQuestionsPath = candidateApiPaths.recruitingQuestions(1);
const recruitingAnswerPath = candidateApiPaths.recruitingAnswers(1);
const recruitingNextQuestionPath = candidateApiPaths.recruitingNextQuestion(1);
const recruitingCompletePath = candidateApiPaths.recruitingComplete(1);
const recruitingSttPath = candidateApiPaths.recruitingStt(1);
const recruitingFollowUpPath = candidateApiPaths.recruitingFollowUpQuestion(1);

const applyActionHref = getCandidateJobDetailActionHref({
  jobId: 1,
  canApply: true,
  alreadyApplied: false,
});

const appliedActionHref = getCandidateJobDetailActionHref({
  jobId: 1,
  canApply: false,
  alreadyApplied: true,
});

const disabledActionHref = getCandidateJobDetailActionHref({
  jobId: 1,
  canApply: false,
  alreadyApplied: false,
});

const errorBody: ApiErrorBody = {
  error: {
    code: "COMMON_VALIDATION_FAILED",
    message: "입력값을 확인해주세요.",
    details: [{ field: "email", reason: "INVALID_FORMAT" }],
  },
  meta: {
    traceId: "trace-test",
    timestamp: "2026-06-29T00:00:00.000Z",
  },
};

void query;
void closedFilterQuery;
void submitRequest;
void resumeRequest;
void portfolioRequest;
void interviewConsentRequest;
void deviceCheckRequest;
void startMockRequest;
void answerRequest;
void applicationSummary;
void applicationInterviewHref;
void applicationCanStart;
void mockInterviewHref;
void mockInterviewsPath;
void mockRuntimePath;
void mockQuestionsPath;
void mockAnswerPath;
void mockNextQuestionPath;
void mockCompletePath;
void mockSttPath;
void mockFollowUpPath;
void applicationsPath;
void interviewGuidePath;
void deviceCheckPath;
void startInterviewPath;
void runtimePath;
void recruitingQuestionsPath;
void recruitingAnswerPath;
void recruitingNextQuestionPath;
void recruitingCompletePath;
void recruitingSttPath;
void recruitingFollowUpPath;
void applyActionHref;
void appliedActionHref;
void disabledActionHref;
void errorBody;
