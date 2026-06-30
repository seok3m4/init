import { Inject, Injectable } from "@nestjs/common";
import {
  CandidateDomainError,
  CandidateService,
  type ApiListResponse,
  type ApiResponse,
  type CurrentCandidateUser,
  type FileAsset,
  type ReportStatus,
} from "../../candidate";
import { InterviewService, type InterviewAnswer, type RuntimeInterviewSession } from "../../interview";
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
} from "../candidate-report.types";

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
        summary: "연습 피드백을 생성하는 중입니다.",
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
      summary: `녹화 답변 ${answeredCount}개에 대한 연습 피드백이 준비되었습니다.`,
      strengths: [
        "질문 순서에 맞춰 답변을 빠짐없이 제출했습니다.",
        "답변 영상/음성 파일이 file_assets 메타데이터와 정상적으로 연결되었습니다.",
      ],
      improvements: [
        "답변 길이를 점검하고 핵심 메시지를 더 선명하게 정리해보세요.",
        "다음 연습에서는 구체적인 사례를 더 짧고 명확하게 말하는 데 집중해보세요.",
      ],
      nextPractice: [
        "녹화된 답변을 다시 보며 말의 흐름과 속도를 확인하세요.",
        "각 답변이 원래 질문 의도에 직접 답하고 있는지 비교해보세요.",
        "AI 리포트 생성 파이프라인이 연결되면 피드백 생성을 다시 요청해보세요.",
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
        candidateMessage: "면접 분석이 진행 중입니다.",
        nextStepLabel: "분석 진행 중",
      });
    }

    if (application.reportStatus === "FAILED") {
      return this.envelope({
        ...base,
        candidateMessage: "면접 분석을 완료하지 못했습니다. 잠시 후 다시 확인해주세요.",
        nextStepLabel: "분석 재시도 필요",
      });
    }

    return this.envelope({
      ...base,
      summary: "채용 AI 면접 결과가 준비되었습니다.",
      candidateMessage: "지원자에게 공개 가능한 결과 정보만 표시됩니다.",
      nextStepLabel: "지원 상태 확인",
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
