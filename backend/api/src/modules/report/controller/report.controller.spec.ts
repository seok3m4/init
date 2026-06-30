import "reflect-metadata";
import { strict as assert } from "node:assert";
import { HttpException, RequestMethod } from "@nestjs/common";
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import {
  CandidateService,
  DEV_CANDIDATE_USER,
  InMemoryCandidateRepository,
} from "../../candidate";
import { InterviewService } from "../../interview";
import { ReportController } from "./report.controller";
import { reportApiRoutePrefix, reportApiRoutes } from "../report.routes";
import { ReportService } from "../service/report.service";

type ReportControllerRoute =
  | "listMockReports"
  | "getMockReportFeedback"
  | "getMockReportMedia"
  | "requestMockReportGeneration"
  | "getApplicationReport"
  | "getApplicationStatus";

const validCandidateRequest = {
  headers: {},
  currentUser: { ...DEV_CANDIDATE_USER, companyId: null },
};

const otherCandidateRequest = {
  headers: {},
  currentUser: {
    userId: 99,
    userType: "CANDIDATE" as const,
    companyId: null,
    candidateId: 99,
  },
};

function assertRoute(
  methodName: ReportControllerRoute,
  expectedPath: string,
  expectedMethod: RequestMethod,
  expectedStatusCode?: number,
) {
  const handler = ReportController.prototype[methodName];

  assert.equal(Reflect.getMetadata(PATH_METADATA, handler), expectedPath);
  assert.equal(Reflect.getMetadata(METHOD_METADATA, handler), expectedMethod);
  if (expectedStatusCode) {
    assert.equal(Reflect.getMetadata(HTTP_CODE_METADATA, handler), expectedStatusCode);
  }
}

assert.equal(Reflect.getMetadata(PATH_METADATA, ReportController), reportApiRoutePrefix);
assertRoute("listMockReports", reportApiRoutes.mockReports, RequestMethod.GET);
assertRoute("getMockReportFeedback", reportApiRoutes.mockFeedback, RequestMethod.GET);
assertRoute("getMockReportMedia", reportApiRoutes.mockMedia, RequestMethod.GET);
assertRoute("requestMockReportGeneration", reportApiRoutes.mockGenerate, RequestMethod.POST, 202);
assertRoute("getApplicationReport", reportApiRoutes.applicationReport, RequestMethod.GET);
assertRoute("getApplicationStatus", reportApiRoutes.applicationStatus, RequestMethod.GET);

async function assertReportHttpError(
  action: () => Promise<unknown>,
  expectedStatus: number,
  expectedCode: string,
) {
  try {
    await action();
    assert.fail(`Expected ${expectedCode}`);
  } catch (error) {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), expectedStatus);

    const response = error.getResponse() as { code?: string; details?: unknown[] };
    assert.equal(response.code, expectedCode);
    assert.ok(Array.isArray(response.details));
  }
}

async function answerAllMockQuestions(interviewService: InterviewService, sessionId: number) {
  const questions = await interviewService.listMockQuestions(sessionId, DEV_CANDIDATE_USER);
  for (let index = 0; index < questions.data.questions.length; index += 1) {
    const question = questions.data.questions[index];
    assert.ok(question);
    await interviewService.saveMockAnswer(sessionId, {
      questionId: question.questionId,
      videoFile: {
        storageKey: `candidate/1/mock-report-answer-${index + 1}.webm`,
        originalName: `mock-report-answer-${index + 1}.webm`,
        mimeType: "video/webm",
        sizeBytes: 1024,
      },
      durationSeconds: 30 + index,
    }, DEV_CANDIDATE_USER);

    if (index < questions.data.questions.length - 1) {
      await interviewService.moveMockNextQuestion(sessionId, DEV_CANDIDATE_USER);
    }
  }
}

async function answerAllRecruitingQuestions(interviewService: InterviewService, sessionId: number) {
  const questions = await interviewService.listRecruitingQuestions(sessionId, DEV_CANDIDATE_USER);
  for (let index = 0; index < questions.data.questions.length; index += 1) {
    const question = questions.data.questions[index];
    assert.ok(question);
    await interviewService.saveRecruitingAnswer(sessionId, {
      questionId: question.questionId,
      audioFile: {
        storageKey: `candidate/1/recruiting-report-answer-${index + 1}.webm`,
        originalName: `recruiting-report-answer-${index + 1}.webm`,
        mimeType: "audio/webm",
        sizeBytes: 2048,
      },
      durationSeconds: 45 + index,
    }, DEV_CANDIDATE_USER);

    if (index < questions.data.questions.length - 1) {
      await interviewService.moveRecruitingNextQuestion(sessionId, DEV_CANDIDATE_USER);
    }
  }
}

function assertNoRecruitingInternalFields(data: Record<string, unknown>) {
  assert.equal("score" in data, false);
  assert.equal("scores" in data, false);
  assert.equal("evidence" in data, false);
  assert.equal("evidences" in data, false);
  assert.equal("internalMemo" in data, false);
  assert.equal("companyMemo" in data, false);
  assert.equal("manualEvaluation" in data, false);
  assert.equal("manualEvaluations" in data, false);
}

async function runReportControllerAssertions() {
  const repository = new InMemoryCandidateRepository();
  const candidateService = new CandidateService(repository);
  const interviewService = new InterviewService(candidateService);
  const controller = new ReportController(new ReportService(candidateService, interviewService));

  const startedMock = await interviewService.startMockInterview(
    { questionTypes: ["INTRO", "TECHNICAL"], showQuestionText: true },
    DEV_CANDIDATE_USER,
  );
  const mockReportId = startedMock.data.sessionId;

  await assertReportHttpError(
    () => controller.getMockReportFeedback(validCandidateRequest, String(mockReportId)),
    409,
    "REPORT_NOT_READY",
  );

  await answerAllMockQuestions(interviewService, mockReportId);
  await interviewService.completeMockInterview(mockReportId, DEV_CANDIDATE_USER);

  const reports = await controller.listMockReports(validCandidateRequest);
  assert.equal(reports.data.items.length, 1);
  assert.equal(reports.data.items[0]?.reportId, mockReportId);
  assert.equal(reports.data.items[0]?.reportStatus, "COMPLETED");

  const feedback = await controller.getMockReportFeedback(validCandidateRequest, String(mockReportId));
  assert.equal(feedback.data.reportType, "MOCK_INTERVIEW_REPORT");
  assert.equal(feedback.data.status, "COMPLETED");
  assert.equal(feedback.data.visibilityPolicy.excludesHiringDecision, true);
  assert.equal(/합격|탈락|pass|fail|hire|reject/i.test([
    feedback.data.summary,
    ...feedback.data.strengths,
    ...feedback.data.improvements,
    ...feedback.data.nextPractice,
  ].join(" ")), false);

  const media = await controller.getMockReportMedia(validCandidateRequest, String(mockReportId));
  assert.equal(media.data.media.length, 2);
  assert.equal(media.data.media[0]?.videoFile?.status, "ACTIVE");
  assert.equal(media.data.media[0]?.transcriptStatus, "PENDING");
  assert.ok(media.data.media[0]?.questionContent);

  const generation = await controller.requestMockReportGeneration(validCandidateRequest, String(mockReportId));
  assert.equal(generation.data.accepted, true);
  assert.equal(generation.data.processType, "REPORT_GENERATE");
  assert.equal(generation.data.reportId, mockReportId);
  assert.equal(generation.data.answerIds.length, 2);
  assert.equal(generation.data.callbackTopic, "ai.report.generate.requested");

  await assertReportHttpError(
    () => controller.getMockReportFeedback(otherCandidateRequest, String(mockReportId)),
    403,
    "COMMON_FORBIDDEN",
  );

  const submitted = await repository.createApplication({
    postingId: 1,
    candidateId: DEV_CANDIDATE_USER.candidateId,
    resumeFileId: 1,
    consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
  });
  const session = await repository.findInterviewSessionByApplication(submitted.application.applicationId);
  assert.ok(session);

  await assertReportHttpError(
    () => controller.getApplicationReport(validCandidateRequest, String(submitted.application.applicationId)),
    409,
    "REPORT_NOT_READY",
  );

  await candidateService.saveInterviewConsent(
    submitted.application.applicationId,
    { consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS", "AI_INTERVIEW_RECORDING"] },
    DEV_CANDIDATE_USER,
  );
  await candidateService.saveDeviceCheck(
    session.sessionId,
    { cameraGranted: true, microphoneGranted: true, networkStable: true },
    DEV_CANDIDATE_USER,
  );
  await candidateService.startInterview(submitted.application.applicationId, DEV_CANDIDATE_USER);
  await answerAllRecruitingQuestions(interviewService, session.sessionId);
  await interviewService.completeRecruitingInterview(session.sessionId, DEV_CANDIDATE_USER);

  const applicationStatus = await controller.getApplicationStatus(
    validCandidateRequest,
    String(submitted.application.applicationId),
  );
  assert.equal(applicationStatus.data.interviewStatus, "COMPLETED");
  assert.equal(applicationStatus.data.interviewSessionStatus, "COMPLETED");
  assert.equal(applicationStatus.data.reportStatus, "GENERATING");
  assert.equal(applicationStatus.data.reportAvailable, false);

  const applicationReport = await controller.getApplicationReport(
    validCandidateRequest,
    String(submitted.application.applicationId),
  );
  assert.equal(applicationReport.data.reportType, "RECRUITING_REPORT");
  assert.equal(applicationReport.data.status, "GENERATING");
  assert.equal(applicationReport.data.visibilityPolicy.excludesInternalMemo, true);
  assert.equal(applicationReport.data.visibilityPolicy.excludesManualEvaluation, true);
  assertNoRecruitingInternalFields(applicationReport.data as unknown as Record<string, unknown>);

  await assertReportHttpError(
    () => controller.getApplicationStatus(otherCandidateRequest, String(submitted.application.applicationId)),
    403,
    "COMMON_FORBIDDEN",
  );

  await assertReportHttpError(
    () => controller.getApplicationReport(validCandidateRequest, "99999"),
    404,
    "COMMON_NOT_FOUND",
  );
}

test("candidate report controller contract", async () => {
  await runReportControllerAssertions();
});
