import { Inject, Injectable } from "@nestjs/common";
import {
  CandidateDomainError,
  CandidateService,
  type ApiListResponse,
  type ApiResponse,
  type CurrentCandidateUser,
  type FileAsset,
  type ReportStatus,
} from "../candidate";
import { InterviewService, type InterviewAnswer, type RuntimeInterviewSession } from "../interview";
import {
  CandidateApplicationStatusView,
  CandidateMockInterviewHistoryItem,
  CandidateMockReportFeedback,
  CandidateMockReportMedia,
  CandidateMockReportMediaItem,
  CandidateMockReportSummary,
  CandidateRecruitingReportView,
  CandidateReportFileReference,
  CandidateReportGenerationHandoff,
} from "./report.types";

@Injectable()
export class ReportService {
  private readonly mockReportStatuses = new Map<number, ReportStatus>();

  constructor(
    @Inject(CandidateService) private readonly candidateService: CandidateService,
    @Inject(InterviewService) private readonly interviewService: InterviewService,
  ) {}

  listMockReports(currentUser: CurrentCandidateUser): ApiListResponse<CandidateMockReportSummary> {
    const items = this.interviewService
      .listOwnedMockInterviewSessions(currentUser)
      .map((session) => this.toMockReportSummary(session));

    return this.listEnvelope(items);
  }

  listMockInterviewHistory(currentUser: CurrentCandidateUser): ApiListResponse<CandidateMockInterviewHistoryItem> {
    const items = this.interviewService
      .listOwnedMockInterviewSessions(currentUser)
      .map((session) => this.toMockHistoryItem(session));

    return this.listEnvelope(items);
  }

  getMockReportFeedback(
    reportId: number,
    currentUser: CurrentCandidateUser,
  ): ApiResponse<CandidateMockReportFeedback> {
    const session = this.getOwnedMockReportSession(reportId, currentUser);
    const status = this.getMockReportStatus(session);

    if (status === "GENERATING") {
      return this.envelope({
        reportId,
        sessionId: session.sessionId,
        reportType: "MOCK_INTERVIEW_REPORT",
        status,
        summary: "Practice feedback is being generated.",
        strengths: [],
        improvements: [],
        nextPractice: [],
        visibilityPolicy: this.mockFeedbackVisibilityPolicy(),
      });
    }

    if (status !== "COMPLETED") {
      this.throwReportNotReady(reportId);
    }

    const answeredCount = this.interviewService.listAnswersForSession(session.sessionId).length;
    return this.envelope({
      reportId,
      sessionId: session.sessionId,
      reportType: "MOCK_INTERVIEW_REPORT",
      status,
      generatedAt: session.completedAt,
      summary: `Practice feedback is ready for ${answeredCount} recorded answer${answeredCount === 1 ? "" : "s"}.`,
      strengths: [
        "Answers were submitted in the expected question order.",
        "Media references are connected through file asset metadata.",
      ],
      improvements: [
        "Review answer length and keep the main point clear.",
        "Use the next practice session to tighten concrete examples.",
      ],
      nextPractice: [
        "Replay the recorded answers.",
        "Compare each answer with the original question intent.",
        "Request AI feedback generation again after E pipeline results arrive.",
      ],
      visibilityPolicy: this.mockFeedbackVisibilityPolicy(),
    });
  }

  async getMockReportMedia(
    reportId: number,
    currentUser: CurrentCandidateUser,
  ): Promise<ApiResponse<CandidateMockReportMedia>> {
    const session = this.getOwnedMockReportSession(reportId, currentUser);
    const status = this.getMockReportStatus(session);
    if (session.status !== "COMPLETED") {
      this.throwReportNotReady(reportId);
    }

    const answers = this.interviewService.listAnswersForSession(session.sessionId);
    const media = await Promise.all(answers.map((answer) => this.toMockReportMediaItem(answer, session, currentUser)));
    return this.envelope({
      reportId,
      sessionId: session.sessionId,
      reportType: "MOCK_INTERVIEW_REPORT",
      status,
      media,
    });
  }

  requestMockReportGeneration(
    reportId: number,
    currentUser: CurrentCandidateUser,
  ): ApiResponse<CandidateReportGenerationHandoff> {
    const session = this.getOwnedMockReportSession(reportId, currentUser);
    if (session.status !== "COMPLETED") {
      this.throwReportNotReady(reportId);
    }

    const answers = this.interviewService.listAnswersForSession(session.sessionId);
    if (answers.length === 0) {
      throw new CandidateDomainError("COMMON_CONFLICT", "Report generation requires interview answers.", 409, [
        { field: "answers", reason: "answers are missing" },
      ]);
    }

    this.mockReportStatuses.set(reportId, "GENERATING");
    return this.envelope({
      accepted: true,
      processType: "REPORT_GENERATE",
      status: "PENDING",
      reportId,
      sessionId: session.sessionId,
      reportType: "MOCK_INTERVIEW_REPORT",
      answerIds: answers.map((answer) => answer.answerId),
      fileIds: this.uniqueFileIds(answers),
      callbackTopic: "ai.report.generate.requested",
    });
  }

  async getApplicationStatus(
    applicationId: number,
    currentUser: CurrentCandidateUser,
  ): Promise<ApiResponse<CandidateApplicationStatusView>> {
    const { application, session, job } = await this.candidateService.getOwnedApplicationReportContext(
      applicationId,
      currentUser,
    );

    return this.envelope({
      applicationId: application.applicationId,
      postingId: application.postingId,
      companyName: job.companyName,
      jobTitle: job.title,
      jobRole: job.jobRole,
      applicationStatus: application.applicationStatus,
      documentStatus: application.documentStatus,
      interviewStatus: application.interviewStatus,
      reportStatus: application.reportStatus,
      sessionId: session.sessionId,
      interviewSessionStatus: session.status,
      submittedAt: application.submittedAt,
      updatedAt: application.updatedAt,
      reportAvailable: application.reportStatus === "COMPLETED",
    });
  }

  async getApplicationReport(
    applicationId: number,
    currentUser: CurrentCandidateUser,
  ): Promise<ApiResponse<CandidateRecruitingReportView>> {
    const { application, session, job } = await this.candidateService.getOwnedApplicationReportContext(
      applicationId,
      currentUser,
    );

    if (application.reportStatus === "PENDING" || session.status !== "COMPLETED") {
      this.throwReportNotReady(applicationId);
    }

    const base = {
      applicationId: application.applicationId,
      sessionId: session.sessionId,
      reportType: "RECRUITING_REPORT" as const,
      status: application.reportStatus,
      applicationStatus: application.applicationStatus,
      interviewStatus: application.interviewStatus,
      companyName: job.companyName,
      jobTitle: job.title,
      visibilityPolicy: {
        candidateFacingOnly: true as const,
        excludesDetailedScores: true as const,
        excludesEvaluationEvidence: true as const,
        excludesInternalMemo: true as const,
        excludesManualEvaluation: true as const,
      },
    };

    if (application.reportStatus === "GENERATING") {
      return this.envelope({
        ...base,
        candidateMessage: "Interview analysis is in progress.",
        nextStepLabel: "Analysis in progress",
      });
    }

    if (application.reportStatus === "FAILED") {
      return this.envelope({
        ...base,
        candidateMessage: "Interview analysis could not be completed. Please check again later.",
        nextStepLabel: "Analysis retry needed",
      });
    }

    return this.envelope({
      ...base,
      summary: "Your recruiting interview result is ready.",
      candidateMessage: "Only candidate-facing result information is shown here.",
      nextStepLabel: "Check application status",
    });
  }

  private getOwnedMockReportSession(
    reportId: number,
    currentUser: CurrentCandidateUser,
  ): RuntimeInterviewSession {
    this.assertPositiveIntegerId(reportId, "reportId");
    return this.interviewService.getOwnedMockInterviewSessionForReport(reportId, currentUser);
  }

  private toMockReportSummary(session: RuntimeInterviewSession): CandidateMockReportSummary {
    const reportId = session.sessionId;
    return {
      ...this.toMockHistoryItem(session),
      reportType: "MOCK_INTERVIEW_REPORT",
      feedbackEndpoint: `/api/v1/candidate/mock-interview/reports/${reportId}/feedback`,
      mediaEndpoint: `/api/v1/candidate/mock-interview/reports/${reportId}/media`,
      generateEndpoint: `/api/v1/candidate/mock-interview/reports/${reportId}/generate`,
    };
  }

  private toMockHistoryItem(session: RuntimeInterviewSession): CandidateMockInterviewHistoryItem {
    return {
      sessionId: session.sessionId,
      reportId: session.sessionId,
      interviewType: "MOCK",
      status: session.status,
      reportStatus: this.getMockReportStatus(session),
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      updatedAt: session.updatedAt,
      totalQuestions: session.questionIds.length,
      answeredCount: this.interviewService.listAnswersForSession(session.sessionId).length,
    };
  }

  private async toMockReportMediaItem(
    answer: InterviewAnswer,
    session: RuntimeInterviewSession,
    currentUser: CurrentCandidateUser,
  ): Promise<CandidateMockReportMediaItem> {
    const question = this.interviewService.getQuestionSnapshot(answer.questionId);
    return {
      answerId: answer.answerId,
      questionId: answer.questionId,
      questionType: question.questionType,
      sortOrder: question.sortOrder,
      questionContent: session.showQuestionText ? question.content : undefined,
      videoFile: answer.videoFileId
        ? this.toFileReference(await this.candidateService.getInterviewFileAsset(answer.videoFileId, currentUser, "videoFileId"))
        : undefined,
      audioFile: answer.audioFileId
        ? this.toFileReference(await this.candidateService.getInterviewFileAsset(answer.audioFileId, currentUser, "audioFileId"))
        : undefined,
      durationSeconds: answer.durationSeconds,
      submittedAt: answer.submittedAt,
      transcriptStatus: "PENDING",
    };
  }

  private toFileReference(fileAsset: FileAsset): CandidateReportFileReference {
    return {
      fileId: fileAsset.fileId,
      storageKey: fileAsset.storageKey,
      originalName: fileAsset.originalName,
      mimeType: fileAsset.mimeType,
      sizeBytes: fileAsset.sizeBytes,
      status: fileAsset.status,
      createdAt: fileAsset.createdAt,
    };
  }

  private getMockReportStatus(session: RuntimeInterviewSession): ReportStatus {
    const overriddenStatus = this.mockReportStatuses.get(session.sessionId);
    if (overriddenStatus) {
      return overriddenStatus;
    }
    return session.status === "COMPLETED" ? "COMPLETED" : "PENDING";
  }

  private uniqueFileIds(answers: InterviewAnswer[]): number[] {
    return [
      ...new Set(
        answers.flatMap((answer) => [answer.videoFileId, answer.audioFileId]).filter((fileId): fileId is number => Boolean(fileId)),
      ),
    ];
  }

  private mockFeedbackVisibilityPolicy(): CandidateMockReportFeedback["visibilityPolicy"] {
    return {
      candidateFacingOnly: true,
      excludesHiringDecision: true,
      excludesInternalScores: true,
      excludesCompanyMemo: true,
    };
  }

  private throwReportNotReady(id: number): never {
    throw new CandidateDomainError("REPORT_NOT_READY", "Report is not ready yet.", 409, [
      { field: "reportId", reason: `resource ${id} is pending or still being prepared` },
    ]);
  }

  private assertPositiveIntegerId(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 1) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "Path parameter is invalid.", 400, [
        { field, reason: `${field} must be a positive integer` },
      ]);
    }
  }

  private listEnvelope<T>(items: T[]): ApiListResponse<T> {
    return {
      data: { items },
      meta: {
        traceId: "local-candidate-module",
        timestamp: new Date().toISOString(),
        page: {
          page: 1,
          limit: Math.max(items.length, 1),
          totalItems: items.length,
          totalPages: items.length > 0 ? 1 : 0,
          hasNext: false,
        },
      },
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
}
