import "reflect-metadata";
import { strict as assert } from "node:assert";
import { HttpException, RequestMethod } from "@nestjs/common";
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import {
  CandidateService,
  DEV_CANDIDATE_USER,
  InMemoryCandidateRepository,
} from "../../candidate";
import { InMemoryInterviewRepository, InterviewService } from "../../interview";
import { ReportController } from "./report.controller";
import { reportApiRoutePrefix, reportApiRoutes } from "../report.routes";
import { InMemoryCandidateReportRepository } from "../repository/in-memory-candidate-report.repository";
import { InMemoryReportRepository } from "../repository/in-memory-report.repository";
import { AiJobDispatcherService } from "../service/ai-job-dispatcher.service";
import { InMemoryAiJobQueuePublisher } from "../service/ai-job-queue.publisher";
import { ReportService } from "../service/report.service";

type ReportControllerRoute =
  | "listMockReports"
  | "getMockReportFeedback"
  | "getMockReportMedia"
  | "requestMockReportGeneration"
  | "getApplicationReport"
  | "requestApplicationReportGeneration"
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
assertRoute("requestApplicationReportGeneration", reportApiRoutes.applicationReportGenerate, RequestMethod.POST, 202);
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
  assert.equal("internalMemo" in data, false);
  assert.equal("companyMemo" in data, false);
  assert.equal("manualEvaluation" in data, false);
  assert.equal("manualEvaluations" in data, false);
}

async function runReportControllerAssertions() {
  const repository = new InMemoryCandidateRepository();
  const candidateService = new CandidateService(repository);
  const interviewRepository = new InMemoryInterviewRepository();
  const interviewService = new InterviewService(candidateService, interviewRepository);
  const candidateReportRepository = new InMemoryCandidateReportRepository();
  const reportRepository = new InMemoryReportRepository();
  const queuePublisher = new InMemoryAiJobQueuePublisher();
  const dispatcher = new AiJobDispatcherService(reportRepository, queuePublisher);
  const controller = new ReportController(
    new ReportService(candidateService, interviewRepository, candidateReportRepository, dispatcher),
  );

  const startedMock = await interviewService.startMockInterview(
    { questionTypes: ["INTRO", "TECHNICAL", "CLOSING"], showQuestionText: true },
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
  assert.equal(reports.data.items[0]?.reportStatus, "PENDING");

  await assertReportHttpError(
    () => controller.getMockReportFeedback(validCandidateRequest, String(mockReportId)),
    409,
    "REPORT_NOT_READY",
  );

  const mockAnswers = interviewRepository.listAnswersBySession(mockReportId);
  const firstMockAnswer = mockAnswers[0];
  assert.ok(firstMockAnswer);
  const mockQuestions = await Promise.all(mockAnswers.map((answer) => interviewRepository.findQuestion(answer.questionId)));
  const ncsAnswerIndex = mockQuestions.findIndex((question) => question?.questionType === "TECHNICAL");
  const ncsMockAnswer = mockAnswers[ncsAnswerIndex];
  assert.ok(ncsMockAnswer);
  mockAnswers.forEach((answer, index) => {
    if (index === 0) {
      interviewRepository.saveAnswerTranscript(
        answer.answerId,
        "I explained the project tradeoffs with concrete examples.",
      );
    }
  });
  interviewRepository.saveAnswerTranscript(
    ncsMockAnswer.answerId,
    "I compared query and cache alternatives, implemented the query change, and measured lower p95 latency.",
  );
  candidateReportRepository.saveFollowUpQuestion({
    followUpId: 1,
    answerId: firstMockAnswer.answerId,
    content: "Which tradeoff had the largest impact?",
    generationStatus: "GENERATED",
    policy: "MOCK",
    createdAt: "2026-07-02T00:00:00.000Z",
  });
  const ncsProcess = mockNcsEvaluationProcess({
    processLogId: 7001,
    sessionId: mockReportId,
    questionId: ncsMockAnswer.questionId,
    answerId: ncsMockAnswer.answerId,
    transcript: "I compared query and cache alternatives, implemented the query change, and measured lower p95 latency.",
  });
  candidateReportRepository.saveReportProcess(ncsProcess);

  const historyWithOnlyNcsProcess = await controller.listMockReports(validCandidateRequest);
  assert.equal(historyWithOnlyNcsProcess.data.items[0]?.reportStatus, "PENDING");

  candidateReportRepository.saveReport({
    reportId: mockReportId,
    sessionId: mockReportId,
    reportType: "MOCK_INTERVIEW_REPORT",
    status: "COMPLETED",
    totalScore: 82,
    summary: "Practice feedback is ready.",
    generatedAt: "2026-07-02T00:01:00.000Z",
    scores: [
      {
        scoreId: 1,
        criterionId: 1,
        criterionName: "Clarity",
        score: 82,
        rationale: "The answer was structured and evidence-backed.",
        evidences: [
          {
            evidenceId: 1,
            sourceType: "INTERVIEW_ANSWER",
            answerId: firstMockAnswer.answerId,
            evidenceText: "project tradeoffs with concrete examples",
          },
        ],
      },
    ],
  });

  const feedback = await controller.getMockReportFeedback(validCandidateRequest, String(mockReportId));
  assert.equal(feedback.data.reportType, "MOCK_INTERVIEW_REPORT");
  assert.equal(feedback.data.status, "COMPLETED");
  assert.equal(feedback.data.totalScore, 79);
  assert.equal(feedback.data.scores?.[0]?.evidences[0]?.evidenceText, "project tradeoffs with concrete examples");
  assert.equal(feedback.data.ncsEvaluations.length, 1);
  assert.equal(feedback.data.ncsEvaluations[0]?.answerId, ncsMockAnswer.answerId);
  assert.equal(feedback.data.ncsEvaluations[0]?.questionType, "TECHNICAL");
  assert.equal(feedback.data.ncsEvaluations[0]?.behaviorEvaluations[0]?.score, 85);
  assert.equal(
    feedback.data.ncsEvaluations[0]?.behaviorEvaluations[0]?.behaviorPointDescription,
    "선택 근거, 실행 행동, 검증 결과를 연결해 설명한다.",
  );
  assert.equal(feedback.data.visibilityPolicy.excludesHiringDecision, true);
  assert.equal(feedback.data.visibilityPolicy.ncsPracticeScoreExcludedFromTotal, true);
  assert.equal(/합격|탈락|pass|fail|hire|reject/i.test([
    feedback.data.summary,
    ...feedback.data.strengths,
    ...feedback.data.improvements,
    ...feedback.data.nextPractice,
  ].join(" ")), false);

  const media = await controller.getMockReportMedia(validCandidateRequest, String(mockReportId));
  assert.equal(media.data.media.length, 3);
  const firstMockMedia = media.data.media.find((item) => item.answerId === firstMockAnswer.answerId);
  const unavailableMedia = media.data.media.find((item) => item.transcriptStatus === "UNAVAILABLE");
  assert.equal(firstMockMedia?.videoFile?.status, "ACTIVE");
  assert.equal(firstMockMedia?.transcriptStatus, "AVAILABLE");
  assert.equal(firstMockMedia?.transcript, "I explained the project tradeoffs with concrete examples.");
  assert.equal(unavailableMedia?.evaluationStatus, "STT_UNAVAILABLE");
  assert.equal(unavailableMedia?.transcript, undefined);
  assert.match(unavailableMedia?.transcriptUnavailableReason ?? "", /STT 실패/);
  assert.equal(firstMockMedia?.followUpQuestions[0]?.content, "Which tradeoff had the largest impact?");
  assert.ok(firstMockMedia?.questionContent);

  const generation = await controller.requestMockReportGeneration(validCandidateRequest, String(mockReportId));
  assert.equal(generation.data.accepted, true);
  assert.equal(generation.data.queued, true);
  assert.equal(generation.data.processType, "REPORT_GENERATE");
  assert.equal(generation.data.status, "PENDING");
  assert.equal(generation.data.reportStatus, "GENERATING");
  assert.ok(generation.data.processLogId > 0);
  assert.equal(generation.data.reportId, mockReportId);
  assert.equal(generation.data.sessionId, mockReportId);
  assert.equal(generation.data.answerIds.length, mockAnswers.length);
  assert.equal(generation.data.callbackTopic, "ai.report.generate.requested");
  assert.equal(queuePublisher.messages.length, 1);

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
  assert.equal(applicationStatus.data.reportStatus, "PENDING");
  assert.equal(applicationStatus.data.reportAvailable, false);

  await repository.updateApplicationReportStatus(submitted.application.applicationId, "GENERATING");
  const generatingApplicationStatus = await controller.getApplicationStatus(
    validCandidateRequest,
    String(submitted.application.applicationId),
  );
  assert.equal(generatingApplicationStatus.data.reportStatus, "GENERATING");
  assert.equal(generatingApplicationStatus.data.reportAvailable, false);
  await repository.updateApplicationReportStatus(submitted.application.applicationId, "PENDING");

  const applicationReport = await controller.getApplicationReport(
    validCandidateRequest,
    String(submitted.application.applicationId),
  );
  assert.equal(applicationReport.data.reportType, "RECRUITING_REPORT");
  assert.equal(applicationReport.data.status, "PENDING");
  assert.deepEqual(applicationReport.data.scores, []);
  assert.equal(applicationReport.data.visibilityPolicy.excludesInternalMemo, true);
  assert.equal(applicationReport.data.visibilityPolicy.excludesManualEvaluation, true);
  assertNoRecruitingInternalFields(applicationReport.data as unknown as Record<string, unknown>);

  const recruitingAnswers = interviewRepository.listAnswersBySession(session.sessionId);
  const firstRecruitingAnswer = recruitingAnswers[0];
  assert.ok(firstRecruitingAnswer);
  recruitingAnswers.forEach((answer, index) => {
    interviewRepository.saveAnswerTranscript(
      answer.answerId,
      index === 0
        ? "I improved API latency with caching and queue isolation."
        : "I explained production incident handling with clear ownership.",
    );
  });
  candidateReportRepository.saveFollowUpQuestion({
    followUpId: 2,
    answerId: firstRecruitingAnswer.answerId,
    content: "How did you measure the latency improvement?",
    generationStatus: "GENERATED",
    policy: "RECRUITING",
    createdAt: "2026-07-02T00:02:00.000Z",
  });

  const applicationGeneration = await controller.requestApplicationReportGeneration(
    validCandidateRequest,
    String(submitted.application.applicationId),
  );
  assert.equal(applicationGeneration.data.accepted, true);
  assert.equal(applicationGeneration.data.queued, true);
  assert.equal(applicationGeneration.data.processType, "REPORT_GENERATE");
  assert.equal(applicationGeneration.data.reportType, "RECRUITING_REPORT");
  assert.equal(applicationGeneration.data.reportStatus, "GENERATING");
  assert.equal(applicationGeneration.data.applicationId, submitted.application.applicationId);
  assert.equal(applicationGeneration.data.sessionId, session.sessionId);
  assert.equal(applicationGeneration.data.reportId, session.sessionId);
  assert.equal(applicationGeneration.data.answerIds.length, recruitingAnswers.length);
  assert.equal(queuePublisher.messages.length, 2);

  candidateReportRepository.saveReport({
    reportId: submitted.application.applicationId,
    applicationId: submitted.application.applicationId,
    sessionId: session.sessionId,
    reportType: "RECRUITING_REPORT",
    status: "COMPLETED",
    totalScore: 88,
    summary: "Recruiting report is ready.",
    generatedAt: "2026-07-02T00:03:00.000Z",
    scores: [
      {
        scoreId: 2,
        criterionId: 1,
        criterionName: "Backend ownership",
        score: 88,
        rationale: "The answer connects implementation choices to measurable results.",
        evidences: [
          {
            evidenceId: 2,
            sourceType: "INTERVIEW_ANSWER",
            answerId: firstRecruitingAnswer.answerId,
            evidenceText: "improved API latency with caching and queue isolation",
          },
        ],
      },
    ],
  });

  const completedApplicationStatus = await controller.getApplicationStatus(
    validCandidateRequest,
    String(submitted.application.applicationId),
  );
  assert.equal(completedApplicationStatus.data.reportStatus, "COMPLETED");
  assert.equal(completedApplicationStatus.data.reportAvailable, true);

  const completedApplicationReport = await controller.getApplicationReport(
    validCandidateRequest,
    String(submitted.application.applicationId),
  );
  assert.equal(completedApplicationReport.data.status, "COMPLETED");
  assert.equal(completedApplicationReport.data.totalScore, undefined);
  assert.deepEqual(completedApplicationReport.data.scores, []);
  assert.deepEqual(completedApplicationReport.data.answers, []);
  assert.equal(completedApplicationReport.data.visibilityPolicy.excludesDetailedScores, true);
  assert.equal(completedApplicationReport.data.visibilityPolicy.excludesEvaluationEvidence, true);

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

function mockNcsEvaluationProcess(args: {
  processLogId: number;
  sessionId: number;
  questionId: number;
  answerId: number;
  transcript: string;
}) {
  const behaviorPointId = "technical-decision-bp-01";
  const input = {
    kind: "MOCK_NCS_ANSWER_EVALUATION",
    payload: {
      step: "NCS_ANSWER_EVALUATION",
      sessionId: args.sessionId,
      questionId: args.questionId,
      answerId: args.answerId,
      transcript: args.transcript,
      evaluationSnapshot: {
        contractVersion: "ncs-evaluation-product.v1",
        snapshotVersion: `report-test:${args.questionId}`,
        locale: "ko-KR",
        question: {
          questionId: String(args.questionId),
          questionType: "EXPERIENCE",
          content: "기술 대안을 비교하고 선택한 경험을 설명해 주세요.",
        },
        ncsContext: {
          sourceKind: "SYNTHETIC_NCS_LIKE",
          version: "service-ncs-starter-v1",
          categoryType: "JOB_PERFORMANCE",
          unit: {
            code: "SERVICE-JOB-TECHNICAL-DECISION",
            name: "기술 의사결정",
            level: null,
            definition: "기술 대안을 비교하고 결과를 검증하는 능력",
            elements: [
              {
                elementCode: "SERVICE-JOB-TECHNICAL-DECISION-01",
                name: "대안 비교와 결과 검증",
              },
            ],
          },
        },
        behaviorPoints: [
          {
            behaviorPointId,
            description: "선택 근거, 실행 행동, 검증 결과를 연결해 설명한다.",
            sourceElementCodes: ["SERVICE-JOB-TECHNICAL-DECISION-01"],
            observability: "INTERVIEW",
            requiredEvidence: ["ACTION", "RATIONALE", "RESULT", "TRADEOFF"],
          },
        ],
        evaluationPolicy: {
          scoreMap: { "1": 25, "2": 50, "3": 70, "4": 85, "5": 100 },
          minimumSupportingEvidence: 1,
          insufficientEvidenceScore: null,
          allowSensitiveAttributes: false,
          allowNonverbalScore: false,
        },
      },
    },
  };
  const output = {
    contractVersion: "ncs-evaluation-product.v1",
    evaluationSnapshotVersion: input.payload.evaluationSnapshot.snapshotVersion,
    sessionId: args.sessionId,
    questionId: args.questionId,
    answerId: args.answerId,
    evidences: [
      {
        evidenceId: "evidence-1",
        quote: args.transcript,
        startChar: 0,
        endChar: args.transcript.length,
        claimType: "ACTION",
        behaviorPointIds: [behaviorPointId],
      },
    ],
    behaviorEvaluations: [
      {
        behaviorPointId,
        status: "DEMONSTRATED",
        level: 4,
        score: 85,
        rationale: "행동, 선택 근거와 확인 결과가 연결됩니다.",
        supportingEvidenceIds: ["evidence-1"],
        contradictingEvidenceIds: [],
        missingEvidence: ["TRADEOFF"],
        confidence: "HIGH",
      },
    ],
    coverage: {
      assessableBehaviorPointCount: 1,
      evaluatedBehaviorPointCount: 1,
      ratio: 1,
      status: "SUFFICIENT",
    },
    followUp: {
      required: false,
      reason: null,
      missingEvidence: [],
      suggestedQuestion: null,
    },
    guardrail: {
      unsupportedFactDetected: false,
      sensitiveAttributeUsed: false,
      nonverbalSignalUsed: false,
      hiringDecisionLanguageDetected: false,
    },
    metadata: {
      strategyId: "evidence-state",
      strategyVersion: "evidence-state-rules-v1",
      model: "deterministic-evidence-state-v1",
    },
  };

  return {
    processLogId: args.processLogId,
    sessionId: args.sessionId,
    processType: "REPORT_GENERATE" as const,
    status: "COMPLETED" as const,
    inputRef: JSON.stringify(input),
    outputRef: JSON.stringify(output),
    createdAt: "2026-07-02T00:00:30.000Z",
  };
}

test("candidate report controller contract", async () => {
  await runReportControllerAssertions();
});
