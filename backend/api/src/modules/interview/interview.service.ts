import { Injectable } from "@nestjs/common";
import {
  CandidateDomainError,
  CandidateService,
  resolveCurrentCandidate,
  type CandidateAuthHeaders,
  type CurrentCandidateUser,
  type FileAsset,
  type InterviewSession,
} from "../candidate";
import { DeviceCheckDto } from "./interview.device-check.dto";
import { AiInterviewRequestDto, RuntimeFileAssetDto, SaveInterviewAnswerDto, StartMockInterviewDto } from "./interview.runtime.dto";
import {
  AiHandoffResult,
  CompleteInterviewResult,
  InterviewAnswer,
  InterviewQuestion,
  InterviewQuestionListResult,
  InterviewQuestionView,
  InterviewRuntimeView,
  NextInterviewQuestionResult,
  RuntimeInterviewSession,
  SaveInterviewAnswerResult,
  StartMockInterviewResult,
} from "./interview.runtime.types";

const DEFAULT_MOCK_QUESTION_TYPES = ["INTRO", "TECHNICAL", "EXPERIENCE", "CLOSING"] as const;

@Injectable()
export class InterviewService {
  private readonly questions: InterviewQuestion[] = [
    {
      questionId: 1,
      questionType: "INTRO",
      content: "Please introduce yourself and the role you are preparing for.",
      sortOrder: 1,
      interviewType: "MOCK",
      isActive: true,
    },
    {
      questionId: 2,
      questionType: "TECHNICAL",
      content: "Explain one technical decision you made recently and the trade-offs you considered.",
      sortOrder: 2,
      interviewType: "MOCK",
      isActive: true,
    },
    {
      questionId: 3,
      questionType: "EXPERIENCE",
      content: "Describe a project where you had to learn a new tool quickly.",
      sortOrder: 3,
      interviewType: "MOCK",
      isActive: true,
    },
    {
      questionId: 4,
      questionType: "CLOSING",
      content: "What would you like the interviewer to remember about you?",
      sortOrder: 4,
      interviewType: "MOCK",
      isActive: true,
    },
    {
      questionId: 101,
      questionType: "INTRO",
      content: "Tell us briefly why you applied for this recruiting position.",
      sortOrder: 1,
      interviewType: "RECRUITING",
      postingId: 1,
      isActive: true,
    },
    {
      questionId: 102,
      questionType: "TECHNICAL",
      content: "How would you design a reliable API for a high-traffic hiring workflow?",
      sortOrder: 2,
      interviewType: "RECRUITING",
      postingId: 1,
      isActive: true,
    },
    {
      questionId: 103,
      questionType: "SITUATION",
      content: "Tell us about a time you debugged a production issue under time pressure.",
      sortOrder: 3,
      interviewType: "RECRUITING",
      postingId: 1,
      isActive: true,
    },
    {
      questionId: 104,
      questionType: "CLOSING",
      content: "Do you have anything else to add for the hiring team?",
      sortOrder: 4,
      interviewType: "RECRUITING",
      postingId: 1,
      isActive: true,
    },
    {
      questionId: 201,
      questionType: "INTRO",
      content: "Introduce yourself as an Android developer candidate.",
      sortOrder: 1,
      interviewType: "RECRUITING",
      postingId: 2,
      isActive: true,
    },
    {
      questionId: 202,
      questionType: "TECHNICAL",
      content: "Explain how you would structure state and networking in an Android app.",
      sortOrder: 2,
      interviewType: "RECRUITING",
      postingId: 2,
      isActive: true,
    },
    {
      questionId: 203,
      questionType: "EXPERIENCE",
      content: "Describe a mobile UX problem you improved through iteration.",
      sortOrder: 3,
      interviewType: "RECRUITING",
      postingId: 2,
      isActive: true,
    },
    {
      questionId: 204,
      questionType: "CLOSING",
      content: "What is one Android engineering strength you want to grow next?",
      sortOrder: 4,
      interviewType: "RECRUITING",
      postingId: 2,
      isActive: true,
    },
  ];

  private readonly mockSessions = new Map<number, RuntimeInterviewSession>();
  private readonly recruitingSessions = new Map<number, RuntimeInterviewSession>();
  private readonly answers: InterviewAnswer[] = [];

  constructor(private readonly candidateService: CandidateService) {}

  saveDeviceCheck(sessionId: number, dto: DeviceCheckDto, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    return this.candidateService.saveDeviceCheck(sessionId, dto, currentUser);
  }

  startInterview(applicationId: number, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    return this.candidateService.startInterview(applicationId, currentUser);
  }

  getInterviewRuntime(applicationId: number, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    return this.candidateService.getInterviewRuntime(applicationId, currentUser);
  }

  async startMockInterview(
    dto: StartMockInterviewDto,
    headers: CandidateAuthHeaders,
  ): Promise<{ data: StartMockInterviewResult; meta: { traceId: string; timestamp: string } }> {
    const currentUser = resolveCurrentCandidate(headers);
    const requestBody = this.toRequestBody(dto, "mockInterview");
    const showQuestionText = requestBody.showQuestionText === true;
    const questionIds = this.selectMockQuestionIds(dto);
    const now = new Date().toISOString();
    const session: RuntimeInterviewSession = {
      sessionId: 10000 + this.mockSessions.size + 1,
      candidateId: currentUser.candidateId,
      interviewType: "MOCK",
      status: "IN_PROGRESS",
      showQuestionText,
      currentQuestionIndex: 0,
      questionIds,
      startedAt: now,
      updatedAt: now,
    };

    this.mockSessions.set(session.sessionId, session);
    return this.envelope({
      ...this.toRuntimeView(session, "mock"),
      startedAt: now,
    });
  }

  async getMockRuntime(sessionId: number, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    const session = this.getOwnedMockSession(sessionId, currentUser);
    this.assertInProgress(session);
    return this.envelope(this.toRuntimeView(session, "mock"));
  }

  async listMockQuestions(sessionId: number, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    const session = this.getOwnedMockSession(sessionId, currentUser);
    this.assertInProgress(session);
    return this.envelope(this.toQuestionList(session));
  }

  async saveMockAnswer(sessionId: number, dto: SaveInterviewAnswerDto, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    const session = this.getOwnedMockSession(sessionId, currentUser);
    return this.saveAnswer(session, dto, currentUser);
  }

  async moveMockNextQuestion(sessionId: number, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    const session = this.getOwnedMockSession(sessionId, currentUser);
    return this.moveNextQuestion(session);
  }

  async completeMockInterview(sessionId: number, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    const session = this.getOwnedMockSession(sessionId, currentUser);
    return this.completeRuntimeSession(session);
  }

  async requestMockStt(sessionId: number, dto: AiInterviewRequestDto, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    const session = this.getOwnedMockSession(sessionId, currentUser);
    return this.createAiHandoff(session, dto, "STT");
  }

  async requestMockFollowUpQuestion(sessionId: number, dto: AiInterviewRequestDto, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    const session = this.getOwnedMockSession(sessionId, currentUser);
    return this.createAiHandoff(session, dto, "FOLLOW_UP");
  }

  async listRecruitingQuestions(sessionId: number, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    const session = await this.getRecruitingRuntimeSession(sessionId, currentUser);
    this.assertInProgress(session);
    return this.envelope(this.toQuestionList(session));
  }

  async saveRecruitingAnswer(sessionId: number, dto: SaveInterviewAnswerDto, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    const session = await this.getRecruitingRuntimeSession(sessionId, currentUser);
    return this.saveAnswer(session, dto, currentUser);
  }

  async moveRecruitingNextQuestion(sessionId: number, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    const session = await this.getRecruitingRuntimeSession(sessionId, currentUser);
    return this.moveNextQuestion(session);
  }

  async completeRecruitingInterview(sessionId: number, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    const session = await this.getRecruitingRuntimeSession(sessionId, currentUser);
    const result = await this.completeRuntimeSession(session);
    await this.candidateService.completeRecruitingInterviewSession(sessionId, currentUser);
    return result;
  }

  async requestRecruitingStt(sessionId: number, dto: AiInterviewRequestDto, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    const session = await this.getRecruitingRuntimeSession(sessionId, currentUser);
    return this.createAiHandoff(session, dto, "STT");
  }

  async requestRecruitingFollowUpQuestion(sessionId: number, dto: AiInterviewRequestDto, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    const session = await this.getRecruitingRuntimeSession(sessionId, currentUser);
    return this.createAiHandoff(session, dto, "FOLLOW_UP");
  }

  private async getRecruitingRuntimeSession(
    sessionId: number,
    currentUser: CurrentCandidateUser,
  ): Promise<RuntimeInterviewSession> {
    const { application, session } = await this.candidateService.getOwnedRecruitingInterviewSession(
      sessionId,
      currentUser,
    );
    let runtimeSession = this.recruitingSessions.get(session.sessionId);
    if (!runtimeSession) {
      runtimeSession = this.createRecruitingRuntimeSession(application.applicationId, application.postingId, session);
      this.recruitingSessions.set(session.sessionId, runtimeSession);
    }

    runtimeSession.status = session.status;
    runtimeSession.showQuestionText = session.showQuestionText;
    runtimeSession.updatedAt = session.updatedAt;
    runtimeSession.completedAt = session.completedAt;
    return runtimeSession;
  }

  private createRecruitingRuntimeSession(
    applicationId: number,
    postingId: number,
    session: InterviewSession,
  ): RuntimeInterviewSession {
    return {
      sessionId: session.sessionId,
      applicationId,
      candidateId: session.candidateId,
      interviewType: "RECRUITING",
      status: session.status,
      showQuestionText: session.showQuestionText,
      currentQuestionIndex: 0,
      questionIds: this.selectRecruitingQuestionIds(postingId),
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      updatedAt: session.updatedAt,
    };
  }

  private getOwnedMockSession(sessionId: number, currentUser: CurrentCandidateUser): RuntimeInterviewSession {
    this.assertPositiveIntegerId(sessionId, "sessionId");
    const session = this.mockSessions.get(sessionId);
    if (!session) {
      throw new CandidateDomainError("COMMON_NOT_FOUND", "Interview session was not found.", 404, [
        { field: "sessionId", reason: "mock interview session not found" },
      ]);
    }
    if (session.candidateId !== currentUser.candidateId) {
      throw new CandidateDomainError("COMMON_FORBIDDEN", "Interview session does not belong to current candidate.", 403, [
        { field: "sessionId", reason: "candidate owner mismatch" },
      ]);
    }
    return session;
  }

  private async saveAnswer(
    session: RuntimeInterviewSession,
    dto: SaveInterviewAnswerDto,
    currentUser: CurrentCandidateUser,
  ): Promise<{ data: SaveInterviewAnswerResult; meta: { traceId: string; timestamp: string } }> {
    this.assertInProgress(session);
    const requestBody = this.assertAnswerRequest(dto);
    const currentQuestionId = this.currentQuestionId(session);
    if (requestBody.questionId !== currentQuestionId) {
      throw new CandidateDomainError("COMMON_CONFLICT", "Answer must match the current question.", 409, [
        { field: "questionId", reason: `current question is ${currentQuestionId}` },
      ]);
    }
    if (this.findAnswer(session.sessionId, requestBody.questionId)) {
      throw new CandidateDomainError("COMMON_CONFLICT", "Current question has already been answered.", 409, [
        { field: "questionId", reason: "question already answered" },
      ]);
    }

    const videoFile = await this.resolveAnswerFile(
      requestBody.videoFileId,
      requestBody.videoFile,
      currentUser,
      "videoFileId",
    );
    const audioFile = await this.resolveAnswerFile(
      requestBody.audioFileId,
      requestBody.audioFile,
      currentUser,
      "audioFileId",
    );
    if (!videoFile && !audioFile) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "At least one media file is required.", 400, [
        { field: "file", reason: "videoFile/videoFileId or audioFile/audioFileId is required" },
      ]);
    }

    const submittedAt = new Date().toISOString();
    const answer: InterviewAnswer = {
      answerId: this.answers.length + 1,
      sessionId: session.sessionId,
      questionId: requestBody.questionId,
      videoFileId: videoFile?.fileId,
      audioFileId: audioFile?.fileId,
      durationSeconds: requestBody.durationSeconds,
      submittedAt,
    };
    this.answers.push(answer);
    session.updatedAt = submittedAt;

    return this.envelope({
      sessionId: session.sessionId,
      answer,
      videoFile,
      audioFile,
      nextQuestionAvailable: session.currentQuestionIndex < session.questionIds.length - 1,
    });
  }

  private moveNextQuestion(
    session: RuntimeInterviewSession,
  ): { data: NextInterviewQuestionResult; meta: { traceId: string; timestamp: string } } {
    this.assertInProgress(session);
    const previousQuestionId = this.currentQuestionId(session);
    if (!this.findAnswer(session.sessionId, previousQuestionId)) {
      throw new CandidateDomainError("COMMON_CONFLICT", "Current question must be answered before moving next.", 409, [
        { field: "questionId", reason: "current question answer is missing" },
      ]);
    }
    if (session.currentQuestionIndex >= session.questionIds.length - 1) {
      throw new CandidateDomainError("COMMON_CONFLICT", "Already at the last question.", 409, [
        { field: "questionId", reason: "last question reached" },
      ]);
    }

    session.currentQuestionIndex += 1;
    session.updatedAt = new Date().toISOString();
    return this.envelope({
      sessionId: session.sessionId,
      previousQuestionId,
      currentQuestion: this.toQuestionView(session, this.currentQuestion(session), true),
      isLastQuestion: session.currentQuestionIndex === session.questionIds.length - 1,
    });
  }

  private async completeRuntimeSession(
    session: RuntimeInterviewSession,
  ): Promise<{ data: CompleteInterviewResult; meta: { traceId: string; timestamp: string } }> {
    this.assertInProgress(session);
    const answeredCount = this.countAnswers(session.sessionId);
    if (answeredCount !== session.questionIds.length) {
      throw new CandidateDomainError("COMMON_CONFLICT", "All required questions must be answered.", 409, [
        { field: "answers", reason: `${answeredCount}/${session.questionIds.length} questions answered` },
      ]);
    }

    const completedAt = new Date().toISOString();
    session.status = "COMPLETED";
    session.completedAt = completedAt;
    session.updatedAt = completedAt;

    return this.envelope({
      sessionId: session.sessionId,
      applicationId: session.applicationId,
      interviewType: session.interviewType,
      status: "COMPLETED",
      completedAt,
      answeredCount,
      totalQuestions: session.questionIds.length,
    });
  }

  private createAiHandoff(
    session: RuntimeInterviewSession,
    dto: AiInterviewRequestDto,
    processType: "STT" | "FOLLOW_UP",
  ): { data: AiHandoffResult; meta: { traceId: string; timestamp: string } } {
    this.assertNotCompleted(session);
    const answer = this.resolveAnswerForAi(session, dto);
    const fileId = answer.audioFileId ?? answer.videoFileId;
    return this.envelope({
      accepted: true,
      processType,
      status: "PENDING",
      sessionId: session.sessionId,
      applicationId: session.applicationId,
      answerId: answer.answerId,
      questionId: answer.questionId,
      fileId,
      videoFileId: answer.videoFileId,
      audioFileId: answer.audioFileId,
      callbackTopic:
        processType === "STT"
          ? "ai.interview.stt.requested"
          : "ai.interview.follow-up-question.requested",
    });
  }

  private resolveAnswerForAi(session: RuntimeInterviewSession, dto: AiInterviewRequestDto): InterviewAnswer {
    const requestBody = this.toRequestBody(dto ?? {}, "aiRequest");
    const rawAnswerId = requestBody.answerId;
    if (rawAnswerId !== undefined && !this.isPositiveInteger(rawAnswerId)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "answerId is invalid.", 400, [
        { field: "answerId", reason: "answerId must be a positive integer" },
      ]);
    }
    const answerId = rawAnswerId as number | undefined;

    const answer = answerId
      ? this.answers.find((candidate) => candidate.sessionId === session.sessionId && candidate.answerId === answerId)
      : [...this.answers].reverse().find((candidate) => candidate.sessionId === session.sessionId);
    if (!answer) {
      throw new CandidateDomainError("COMMON_NOT_FOUND", "Interview answer was not found.", 404, [
        { field: "answerId", reason: "answer not found for session" },
      ]);
    }
    return answer;
  }

  private async resolveAnswerFile(
    fileId: number | undefined,
    file: RuntimeFileAssetDto | undefined,
    currentUser: CurrentCandidateUser,
    field: string,
  ): Promise<FileAsset | undefined> {
    if (fileId && file) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "Use either fileId or file metadata, not both.", 400, [
        { field, reason: "duplicate file reference" },
      ]);
    }
    if (fileId) {
      return this.candidateService.getInterviewFileAsset(fileId, currentUser, field);
    }
    if (file) {
      return this.candidateService.createInterviewFileAsset(file, currentUser);
    }
    return undefined;
  }

  private toRuntimeView(session: RuntimeInterviewSession, routeKind: "mock" | "recruiting"): InterviewRuntimeView {
    return {
      sessionId: session.sessionId,
      applicationId: session.applicationId,
      interviewType: session.interviewType,
      status: session.status,
      showQuestionText: session.showQuestionText,
      currentQuestion:
        session.status === "IN_PROGRESS" ? this.toQuestionView(session, this.currentQuestion(session), true) : undefined,
      totalQuestions: session.questionIds.length,
      answeredCount: this.countAnswers(session.sessionId),
      canRecord: session.status === "IN_PROGRESS",
      nextQuestionEndpoint:
        routeKind === "mock"
          ? `/api/v1/candidate/mock-interviews/${session.sessionId}/next-question`
          : `/api/v1/candidate/interviews/${session.sessionId}/next-question`,
      answerUploadEndpoint:
        routeKind === "mock"
          ? `/api/v1/candidate/mock-interviews/${session.sessionId}/answers`
          : `/api/v1/candidate/interviews/${session.sessionId}/answers`,
    };
  }

  private toQuestionList(session: RuntimeInterviewSession): InterviewQuestionListResult {
    return {
      sessionId: session.sessionId,
      interviewType: session.interviewType,
      showQuestionText: session.showQuestionText,
      currentQuestionId: session.status === "IN_PROGRESS" ? this.currentQuestionId(session) : undefined,
      questions: session.questionIds.map((questionId, index) =>
        this.toQuestionView(session, this.requiredQuestion(questionId), index === session.currentQuestionIndex),
      ),
    };
  }

  private toQuestionView(
    session: RuntimeInterviewSession,
    question: InterviewQuestion,
    current: boolean,
  ): InterviewQuestionView {
    return {
      questionId: question.questionId,
      questionType: question.questionType,
      sortOrder: question.sortOrder,
      content: session.showQuestionText ? question.content : undefined,
      audioPrompt: `audio://interview-questions/${question.questionId}`,
      answered: Boolean(this.findAnswer(session.sessionId, question.questionId)),
      current,
    };
  }

  private selectMockQuestionIds(dto: StartMockInterviewDto): number[] {
    const requestBody = this.toRequestBody(dto, "mockInterview");
    const requestedTypes = Array.isArray(requestBody.questionTypes)
      ? requestBody.questionTypes
      : [...DEFAULT_MOCK_QUESTION_TYPES];
    if (!requestedTypes.every((questionType) => this.isQuestionType(questionType))) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "Question type is invalid.", 400, [
        { field: "questionTypes", reason: "unsupported question type" },
      ]);
    }

    const questions = this.questions
      .filter((question) => question.isActive && question.interviewType === "MOCK")
      .filter((question) => requestedTypes.includes(question.questionType))
      .sort((left, right) => left.sortOrder - right.sortOrder);
    if (questions.length === 0) {
      return this.questions
        .filter((question) => question.isActive && question.interviewType === "MOCK")
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((question) => question.questionId);
    }
    return questions.map((question) => question.questionId);
  }

  private selectRecruitingQuestionIds(postingId: number): number[] {
    const questions = this.questions
      .filter((question) => question.isActive && question.interviewType === "RECRUITING")
      .filter((question) => question.postingId === postingId)
      .sort((left, right) => left.sortOrder - right.sortOrder);
    if (questions.length === 0) {
      throw new CandidateDomainError("COMMON_NOT_FOUND", "Interview questions were not found.", 404, [
        { field: "sessionId", reason: "question set is missing" },
      ]);
    }
    return questions.map((question) => question.questionId);
  }

  private assertAnswerRequest(dto: SaveInterviewAnswerDto): {
    questionId: number;
    videoFileId?: number;
    videoFile?: RuntimeFileAssetDto;
    audioFileId?: number;
    audioFile?: RuntimeFileAssetDto;
    durationSeconds: number;
  } {
    const requestBody = this.toRequestBody(dto, "answer");
    if (!this.isPositiveInteger(requestBody.questionId)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "questionId is invalid.", 400, [
        { field: "questionId", reason: "questionId must be a positive integer" },
      ]);
    }
    if (!this.isPositiveInteger(requestBody.durationSeconds)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "durationSeconds is invalid.", 400, [
        { field: "durationSeconds", reason: "durationSeconds must be a positive integer" },
      ]);
    }
    if (requestBody.videoFileId !== undefined && !this.isPositiveInteger(requestBody.videoFileId)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "videoFileId is invalid.", 400, [
        { field: "videoFileId", reason: "videoFileId must be a positive integer" },
      ]);
    }
    if (requestBody.audioFileId !== undefined && !this.isPositiveInteger(requestBody.audioFileId)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "audioFileId is invalid.", 400, [
        { field: "audioFileId", reason: "audioFileId must be a positive integer" },
      ]);
    }

    return requestBody as {
      questionId: number;
      videoFileId?: number;
      videoFile?: RuntimeFileAssetDto;
      audioFileId?: number;
      audioFile?: RuntimeFileAssetDto;
      durationSeconds: number;
    };
  }

  private assertInProgress(session: RuntimeInterviewSession): void {
    if (session.status !== "IN_PROGRESS") {
      throw new CandidateDomainError("COMMON_CONFLICT", "Interview is not in progress.", 409, [
        { field: "interviewStatus", reason: `current status is ${session.status}` },
      ]);
    }
  }

  private assertNotCompleted(session: RuntimeInterviewSession): void {
    if (session.status === "COMPLETED") {
      throw new CandidateDomainError("COMMON_CONFLICT", "Interview has already been completed.", 409, [
        { field: "interviewStatus", reason: "interview already completed" },
      ]);
    }
  }

  private currentQuestion(session: RuntimeInterviewSession): InterviewQuestion {
    return this.requiredQuestion(this.currentQuestionId(session));
  }

  private currentQuestionId(session: RuntimeInterviewSession): number {
    const questionId = session.questionIds[session.currentQuestionIndex];
    if (!questionId) {
      throw new CandidateDomainError("COMMON_NOT_FOUND", "Current question was not found.", 404);
    }
    return questionId;
  }

  private requiredQuestion(questionId: number): InterviewQuestion {
    const question = this.questions.find((candidate) => candidate.questionId === questionId && candidate.isActive);
    if (!question) {
      throw new CandidateDomainError("COMMON_NOT_FOUND", "Interview question was not found.", 404, [
        { field: "questionId", reason: "question not found" },
      ]);
    }
    return question;
  }

  private findAnswer(sessionId: number, questionId: number): InterviewAnswer | undefined {
    return this.answers.find((answer) => answer.sessionId === sessionId && answer.questionId === questionId);
  }

  private countAnswers(sessionId: number): number {
    return this.answers.filter((answer) => answer.sessionId === sessionId).length;
  }

  private assertPositiveIntegerId(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 1) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "Path parameter is invalid.", 400, [
        { field, reason: `${field} must be a positive integer` },
      ]);
    }
  }

  private isPositiveInteger(value: unknown): value is number {
    return Number.isInteger(value) && Number(value) > 0;
  }

  private isQuestionType(value: unknown): boolean {
    return ["INTRO", "TECHNICAL", "EXPERIENCE", "SITUATION", "FOLLOW_UP", "CLOSING"].includes(String(value));
  }

  private toRequestBody(value: unknown, field: string): Record<string, unknown> {
    if (value === undefined) {
      return {};
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "Request body is invalid.", 400, [
        { field, reason: `${field} must be an object` },
      ]);
    }
    return value as Record<string, unknown>;
  }

  private envelope<T>(data: T): { data: T; meta: { traceId: string; timestamp: string } } {
    return {
      data,
      meta: {
        traceId: "local-candidate-module",
        timestamp: new Date().toISOString(),
      },
    };
  }
}
