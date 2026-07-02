import { Inject, Injectable } from "@nestjs/common";
import {
  CandidateDomainError,
  CandidateService,
  type CurrentCandidateUser,
  type FileAsset,
  type InterviewSession,
} from "../../candidate";
import { DeviceCheckDto } from "../dto/interview.device-check.dto";
import {
  AiInterviewRequestDto,
  PromoteFollowUpQuestionDto,
  RuntimeFileAssetDto,
  SaveInterviewAnswerDto,
  StartMockInterviewDto,
} from "../dto/interview.runtime.dto";
import {
  AiHandoffResult,
  CompleteInterviewResult,
  InterviewAnswer,
  InterviewQuestion,
  InterviewQuestionListResult,
  InterviewQuestionView,
  InterviewRuntimeView,
  NextInterviewQuestionResult,
  PromoteFollowUpQuestionResult,
  RuntimeInterviewSession,
  SaveInterviewAnswerResult,
  StartMockInterviewResult,
} from "../interview.runtime.types";
import { INTERVIEW_REPOSITORY, type InterviewRepository } from "../repository/interview.repository";

const DEFAULT_MOCK_QUESTION_TYPES = ["INTRO", "TECHNICAL", "EXPERIENCE", "CLOSING"] as const;

@Injectable()
export class InterviewService {
  constructor(
    @Inject(CandidateService) private readonly candidateService: CandidateService,
    @Inject(INTERVIEW_REPOSITORY) private readonly interviewRepository: InterviewRepository,
  ) {}

  async listOwnedMockInterviewSessions(currentUser: CurrentCandidateUser): Promise<RuntimeInterviewSession[]> {
    return this.interviewRepository.listOwnedMockSessions(currentUser.candidateId);
  }

  saveDeviceCheck(sessionId: number, dto: DeviceCheckDto, currentUser: CurrentCandidateUser) {
    return this.candidateService.saveDeviceCheck(sessionId, dto, currentUser);
  }

  startInterview(applicationId: number, currentUser: CurrentCandidateUser) {
    return this.candidateService.startInterview(applicationId, currentUser);
  }

  getInterviewRuntime(applicationId: number, currentUser: CurrentCandidateUser) {
    return this.candidateService.getInterviewRuntime(applicationId, currentUser);
  }

  async startMockInterview(
    dto: StartMockInterviewDto,
    currentUser: CurrentCandidateUser,
  ): Promise<{ data: StartMockInterviewResult; meta: { traceId: string; timestamp: string } }> {
    const requestBody = this.toRequestBody(dto, "mockInterview");
    const showQuestionText = requestBody.showQuestionText === true;
    const questionIds = await this.selectMockQuestionIds(dto);
    const now = new Date().toISOString();
    const session = await this.interviewRepository.createMockSession({
      candidateId: currentUser.candidateId,
      showQuestionText,
      questionIds,
      startedAt: now,
      updatedAt: now,
    });

    return this.envelope({
      ...(await this.toRuntimeView(session, "mock")),
      startedAt: now,
    });
  }

  async listMockInterviewHistory(currentUser: CurrentCandidateUser) {
    const sessions = await this.listOwnedMockInterviewSessions(currentUser);
    const items = await Promise.all(
      sessions.map(async (session) => ({
        sessionId: session.sessionId,
        reportId: session.sessionId,
        interviewType: "MOCK" as const,
        status: session.status,
        reportStatus: session.status === "COMPLETED" ? ("COMPLETED" as const) : ("PENDING" as const),
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        updatedAt: session.updatedAt,
        totalQuestions: session.questionIds.length,
        answeredCount: await this.countAnswers(session.sessionId),
      })),
    );

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

  async getMockRuntime(sessionId: number, currentUser: CurrentCandidateUser) {
    const session = await this.getOwnedMockSession(sessionId, currentUser);
    this.assertInProgress(session);
    return this.envelope(await this.toRuntimeView(session, "mock"));
  }

  async listMockQuestions(sessionId: number, currentUser: CurrentCandidateUser) {
    const session = await this.syncCurrentQuestionToFirstUnanswered(await this.getOwnedMockSession(sessionId, currentUser));
    this.assertInProgress(session);
    return this.envelope(await this.toQuestionList(session));
  }

  async saveMockAnswer(sessionId: number, dto: SaveInterviewAnswerDto, currentUser: CurrentCandidateUser) {
    const session = await this.getOwnedMockSession(sessionId, currentUser);
    return this.saveAnswer(session, dto, currentUser);
  }

  async moveMockNextQuestion(sessionId: number, currentUser: CurrentCandidateUser) {
    const session = await this.getOwnedMockSession(sessionId, currentUser);
    return this.moveNextQuestion(session);
  }

  async completeMockInterview(sessionId: number, currentUser: CurrentCandidateUser) {
    const session = await this.getOwnedMockSession(sessionId, currentUser);
    return this.completeRuntimeSession(session);
  }

  async requestMockStt(sessionId: number, dto: AiInterviewRequestDto, currentUser: CurrentCandidateUser) {
    const session = await this.getOwnedMockSession(sessionId, currentUser);
    return this.createAiHandoff(session, dto, "STT");
  }

  async requestMockFollowUpQuestion(sessionId: number, dto: AiInterviewRequestDto, currentUser: CurrentCandidateUser) {
    const session = await this.getOwnedMockSession(sessionId, currentUser);
    return this.createAiHandoff(session, dto, "FOLLOW_UP");
  }

  async promoteMockFollowUpQuestion(
    sessionId: number,
    dto: PromoteFollowUpQuestionDto,
    currentUser: CurrentCandidateUser,
  ) {
    const session = await this.getOwnedMockSession(sessionId, currentUser);
    return this.promoteFollowUpQuestion(session, dto);
  }

  async listRecruitingQuestions(sessionId: number, currentUser: CurrentCandidateUser) {
    const session = await this.syncCurrentQuestionToFirstUnanswered(
      await this.getRecruitingRuntimeSession(sessionId, currentUser),
    );
    this.assertReadyOrInProgress(session);
    return this.envelope(await this.toQuestionList(session));
  }

  async saveRecruitingAnswer(sessionId: number, dto: SaveInterviewAnswerDto, currentUser: CurrentCandidateUser) {
    const session = await this.getRecruitingRuntimeSession(sessionId, currentUser);
    return this.saveAnswer(session, dto, currentUser);
  }

  async moveRecruitingNextQuestion(sessionId: number, currentUser: CurrentCandidateUser) {
    const session = await this.getRecruitingRuntimeSession(sessionId, currentUser);
    return this.moveNextQuestion(session);
  }

  async completeRecruitingInterview(sessionId: number, currentUser: CurrentCandidateUser) {
    const session = await this.getRecruitingRuntimeSession(sessionId, currentUser);
    if (session.status === "COMPLETED") {
      await this.candidateService.completeRecruitingInterviewSession(sessionId, currentUser);
      const answeredCount = await this.countAnswers(session.sessionId);
      return this.envelope({
        sessionId: session.sessionId,
        applicationId: session.applicationId,
        interviewType: session.interviewType,
        status: "COMPLETED",
        completedAt: session.completedAt ?? new Date().toISOString(),
        answeredCount,
        totalQuestions: session.questionIds.length,
      });
    }
    const result = await this.completeRuntimeSession(session);
    await this.candidateService.completeRecruitingInterviewSession(sessionId, currentUser);
    return result;
  }

  async requestRecruitingStt(sessionId: number, dto: AiInterviewRequestDto, currentUser: CurrentCandidateUser) {
    const session = await this.getRecruitingRuntimeSession(sessionId, currentUser);
    return this.createAiHandoff(session, dto, "STT");
  }

  async requestRecruitingFollowUpQuestion(sessionId: number, dto: AiInterviewRequestDto, currentUser: CurrentCandidateUser) {
    const session = await this.getRecruitingRuntimeSession(sessionId, currentUser);
    return this.createAiHandoff(session, dto, "FOLLOW_UP");
  }

  async promoteRecruitingFollowUpQuestion(
    sessionId: number,
    dto: PromoteFollowUpQuestionDto,
    currentUser: CurrentCandidateUser,
  ) {
    const session = await this.getRecruitingRuntimeSession(sessionId, currentUser);
    return this.promoteFollowUpQuestion(session, dto);
  }

  private async getRecruitingRuntimeSession(
    sessionId: number,
    currentUser: CurrentCandidateUser,
  ): Promise<RuntimeInterviewSession> {
    const { application, session } = await this.candidateService.getOwnedRecruitingInterviewSession(
      sessionId,
      currentUser,
    );
    let runtimeSession = await this.interviewRepository.findRecruitingRuntimeSession(session.sessionId);
    if (!runtimeSession) {
      runtimeSession = await this.createRecruitingRuntimeSession(application.applicationId, application.postingId, session);
    }

    runtimeSession.status = session.status;
    runtimeSession.showQuestionText = session.showQuestionText;
    runtimeSession.updatedAt = session.updatedAt;
    runtimeSession.completedAt = session.completedAt;
    return this.interviewRepository.saveRecruitingRuntimeSession(runtimeSession);
  }

  private async createRecruitingRuntimeSession(
    applicationId: number,
    postingId: number,
    session: InterviewSession,
  ): Promise<RuntimeInterviewSession> {
    return {
      sessionId: session.sessionId,
      applicationId,
      candidateId: session.candidateId,
      interviewType: "RECRUITING",
      status: session.status,
      showQuestionText: session.showQuestionText,
      currentQuestionIndex: 0,
      questionIds: await this.selectRecruitingQuestionIds(postingId),
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      updatedAt: session.updatedAt,
    };
  }

  private async getOwnedMockSession(sessionId: number, currentUser: CurrentCandidateUser): Promise<RuntimeInterviewSession> {
    this.assertPositiveIntegerId(sessionId, "sessionId");
    const session = await this.interviewRepository.findMockSession(sessionId);
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
    session = await this.syncCurrentQuestionToFirstUnanswered(session);
    this.assertInProgress(session);
    const requestBody = this.assertAnswerRequest(dto);
    const currentQuestionId = this.currentQuestionId(session);
    if (requestBody.questionId !== currentQuestionId) {
      throw new CandidateDomainError("COMMON_CONFLICT", "Answer must match the current question.", 409, [
        { field: "questionId", reason: `current question is ${currentQuestionId}` },
      ]);
    }
    if (await this.interviewRepository.findAnswer(session.sessionId, requestBody.questionId)) {
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
    const answer = await this.interviewRepository.createAnswer({
      sessionId: session.sessionId,
      questionId: requestBody.questionId,
      videoFileId: videoFile?.fileId,
      audioFileId: audioFile?.fileId,
      durationSeconds: requestBody.durationSeconds,
      submittedAt,
    });
    session.updatedAt = submittedAt;
    await this.interviewRepository.saveRuntimeSession(session);

    return this.envelope({
      sessionId: session.sessionId,
      answer,
      videoFile,
      audioFile,
      nextQuestionAvailable: session.currentQuestionIndex < session.questionIds.length - 1,
    });
  }

  private async moveNextQuestion(
    session: RuntimeInterviewSession,
  ): Promise<{ data: NextInterviewQuestionResult; meta: { traceId: string; timestamp: string } }> {
    this.assertInProgress(session);
    const previousQuestionId = this.currentQuestionId(session);
    if (!(await this.interviewRepository.findAnswer(session.sessionId, previousQuestionId))) {
      const answeredCount = await this.countAnswers(session.sessionId);
      if (session.currentQuestionIndex > 0 && answeredCount === session.currentQuestionIndex) {
        return this.envelope({
          sessionId: session.sessionId,
          previousQuestionId: session.questionIds[session.currentQuestionIndex - 1],
          currentQuestion: await this.toQuestionView(session, await this.currentQuestion(session), true),
          isLastQuestion: session.currentQuestionIndex === session.questionIds.length - 1,
        });
      }
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
    const updatedSession = await this.interviewRepository.saveRuntimeSession(session);
    return this.envelope({
      sessionId: updatedSession.sessionId,
      previousQuestionId,
      currentQuestion: await this.toQuestionView(updatedSession, await this.currentQuestion(updatedSession), true),
      isLastQuestion: updatedSession.currentQuestionIndex === updatedSession.questionIds.length - 1,
    });
  }

  private async completeRuntimeSession(
    session: RuntimeInterviewSession,
  ): Promise<{ data: CompleteInterviewResult; meta: { traceId: string; timestamp: string } }> {
    this.assertInProgress(session);
    const answeredCount = await this.countAnswers(session.sessionId);
    if (answeredCount !== session.questionIds.length) {
      throw new CandidateDomainError("COMMON_CONFLICT", "All required questions must be answered.", 409, [
        { field: "answers", reason: `${answeredCount}/${session.questionIds.length} questions answered` },
      ]);
    }

    const completedAt = new Date().toISOString();
    session.status = "COMPLETED";
    session.completedAt = completedAt;
    session.updatedAt = completedAt;
    const updatedSession = await this.interviewRepository.saveRuntimeSession(session);

    return this.envelope({
      sessionId: updatedSession.sessionId,
      applicationId: updatedSession.applicationId,
      interviewType: updatedSession.interviewType,
      status: "COMPLETED",
      completedAt,
      answeredCount,
      totalQuestions: updatedSession.questionIds.length,
    });
  }

  private async createAiHandoff(
    session: RuntimeInterviewSession,
    dto: AiInterviewRequestDto,
    processType: "STT" | "FOLLOW_UP",
  ): Promise<{ data: AiHandoffResult; meta: { traceId: string; timestamp: string } }> {
    this.assertNotCompleted(session);
    const answer = await this.resolveAnswerForAi(session, dto);
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
      fileAssetId: fileId,
      videoFileId: answer.videoFileId,
      audioFileId: answer.audioFileId,
      callbackTopic:
        processType === "STT"
          ? "ai.interview.stt.requested"
          : "ai.interview.follow-up-question.requested",
    });
  }

  private async promoteFollowUpQuestion(
    session: RuntimeInterviewSession,
    dto: PromoteFollowUpQuestionDto,
  ): Promise<{ data: PromoteFollowUpQuestionResult; meta: { traceId: string; timestamp: string } }> {
    this.assertInProgress(session);
    const processLogId = this.assertPromoteRequest(dto);
    const process = await this.interviewRepository.findCompletedFollowUpProcess(processLogId);
    if (!process) {
      throw new CandidateDomainError("COMMON_NOT_FOUND", "Completed follow-up process was not found.", 404, [
        { field: "processLogId", reason: "completed FOLLOW_UP process not found" },
      ]);
    }
    if (process.sessionId !== session.sessionId) {
      throw new CandidateDomainError("COMMON_FORBIDDEN", "Follow-up process does not belong to this interview session.", 403, [
        { field: "processLogId", reason: "session mismatch" },
      ]);
    }
    if (
      (session.interviewType === "MOCK" && process.policy !== "MOCK") ||
      (session.interviewType === "RECRUITING" && process.policy !== "RECRUITING")
    ) {
      throw new CandidateDomainError("COMMON_CONFLICT", "Follow-up policy does not match interview type.", 409, [
        { field: "policy", reason: `expected ${session.interviewType}` },
      ]);
    }

    const answer = await this.interviewRepository.findAnswerById(session.sessionId, process.answerId);
    if (!answer) {
      throw new CandidateDomainError("COMMON_NOT_FOUND", "Interview answer for follow-up was not found.", 404, [
        { field: "answerId", reason: "answer not found for session" },
      ]);
    }
    const sourceQuestionIndex = session.questionIds.indexOf(answer.questionId);
    const sourceIsCurrentQuestion = sourceQuestionIndex === session.currentQuestionIndex;
    const sourceIsPreviousQuestion = sourceQuestionIndex === session.currentQuestionIndex - 1;
    if (!sourceIsCurrentQuestion && !sourceIsPreviousQuestion) {
      throw new CandidateDomainError("COMMON_CONFLICT", "Follow-up must be added before answering another question.", 409, [
        { field: "questionId", reason: "source answer is not the current or previous question" },
      ]);
    }
    if (sourceIsPreviousQuestion) {
      const currentQuestionAnswer = await this.interviewRepository.findAnswer(
        session.sessionId,
        this.currentQuestionId(session),
      );
      if (currentQuestionAnswer) {
        throw new CandidateDomainError("COMMON_CONFLICT", "Follow-up must be added before answering another question.", 409, [
          { field: "questionId", reason: "current question is already answered" },
        ]);
      }
    }
    const sourceQuestion = await this.requiredQuestion(answer.questionId);
    if (sourceQuestion.questionType === "FOLLOW_UP") {
      throw new CandidateDomainError("COMMON_CONFLICT", "Follow-up questions cannot create another follow-up question.", 409, [
        { field: "questionType", reason: "source question is FOLLOW_UP" },
      ]);
    }

    const followUpCount = await this.countFollowUpQuestions(session);
    if (followUpCount >= 2) {
      throw new CandidateDomainError("COMMON_CONFLICT", "Follow-up question limit has been reached.", 409, [
        { field: "followUpQuestions", reason: "maximum 2 follow-up questions per session" },
      ]);
    }

    const question = await this.interviewRepository.createFollowUpQuestion({
      session,
      sourceQuestionId: answer.questionId,
      content: process.content,
    });
    const alreadyIncluded = session.questionIds.includes(question.questionId);
    if (!alreadyIncluded) {
      session.questionIds.splice(sourceQuestionIndex + 1, 0, question.questionId);
      session.updatedAt = new Date().toISOString();
      session = await this.interviewRepository.saveRuntimeSession(session);
    }

    return this.envelope({
      sessionId: session.sessionId,
      processLogId,
      sourceAnswerId: answer.answerId,
      sourceQuestionId: answer.questionId,
      question: await this.toQuestionView(session, question, false),
      inserted: !alreadyIncluded,
      totalQuestions: session.questionIds.length,
      nextQuestionAvailable: session.currentQuestionIndex < session.questionIds.length - 1,
    });
  }

  private async resolveAnswerForAi(session: RuntimeInterviewSession, dto: AiInterviewRequestDto): Promise<InterviewAnswer> {
    const requestBody = this.toRequestBody(dto ?? {}, "aiRequest");
    const rawAnswerId = requestBody.answerId;
    if (rawAnswerId !== undefined && !this.isPositiveInteger(rawAnswerId)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "answerId is invalid.", 400, [
        { field: "answerId", reason: "answerId must be a positive integer" },
      ]);
    }
    const rawFileAssetId = requestBody.fileAssetId;
    if (rawFileAssetId !== undefined && !this.isPositiveInteger(rawFileAssetId)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "fileAssetId is invalid.", 400, [
        { field: "fileAssetId", reason: "fileAssetId must be a positive integer" },
      ]);
    }
    const answerId = rawAnswerId as number | undefined;
    const fileAssetId = rawFileAssetId as number | undefined;

    const answer = answerId
      ? await this.interviewRepository.findAnswerById(session.sessionId, answerId)
      : await this.interviewRepository.findLatestAnswer(session.sessionId);
    if (!answer) {
      throw new CandidateDomainError("COMMON_NOT_FOUND", "Interview answer was not found.", 404, [
        { field: "answerId", reason: "answer not found for session" },
      ]);
    }
    if (fileAssetId && answer.audioFileId !== fileAssetId && answer.videoFileId !== fileAssetId) {
      throw new CandidateDomainError("COMMON_CONFLICT", "File asset does not belong to the selected interview answer.", 409, [
        { field: "fileAssetId", reason: "file asset id must match the answer audioFileId or videoFileId" },
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

  private async toRuntimeView(session: RuntimeInterviewSession, routeKind: "mock" | "recruiting"): Promise<InterviewRuntimeView> {
    return {
      sessionId: session.sessionId,
      applicationId: session.applicationId,
      interviewType: session.interviewType,
      status: session.status,
      showQuestionText: session.showQuestionText,
      currentQuestion:
        session.status === "IN_PROGRESS" ? await this.toQuestionView(session, await this.currentQuestion(session), true) : undefined,
      totalQuestions: session.questionIds.length,
      answeredCount: await this.countAnswers(session.sessionId),
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

  private async toQuestionList(session: RuntimeInterviewSession): Promise<InterviewQuestionListResult> {
    return {
      sessionId: session.sessionId,
      interviewType: session.interviewType,
      showQuestionText: session.showQuestionText,
      currentQuestionId: session.status === "IN_PROGRESS" ? this.currentQuestionId(session) : undefined,
      questions: await Promise.all(
        session.questionIds.map(async (questionId, index) =>
          this.toQuestionView(session, await this.requiredQuestion(questionId), index === session.currentQuestionIndex),
        ),
      ),
    };
  }

  private async toQuestionView(
    session: RuntimeInterviewSession,
    question: InterviewQuestion,
    current: boolean,
  ): Promise<InterviewQuestionView> {
    return {
      questionId: question.questionId,
      questionType: question.questionType,
      sortOrder: question.sortOrder,
      content: session.showQuestionText ? question.content : undefined,
      audioPrompt: `audio://interview-questions/${question.questionId}`,
      answered: Boolean(await this.interviewRepository.findAnswer(session.sessionId, question.questionId)),
      current,
    };
  }

  private async selectMockQuestionIds(dto: StartMockInterviewDto): Promise<number[]> {
    const requestBody = this.toRequestBody(dto, "mockInterview");
    const requestedTypes = Array.isArray(requestBody.questionTypes)
      ? requestBody.questionTypes
      : [...DEFAULT_MOCK_QUESTION_TYPES];
    if (!requestedTypes.every((questionType) => this.isQuestionType(questionType))) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "Question type is invalid.", 400, [
        { field: "questionTypes", reason: "unsupported question type" },
      ]);
    }

    const questions = await this.interviewRepository.listQuestions({
      interviewType: "MOCK",
      questionTypes: requestedTypes,
    });
    if (questions.length === 0) {
      return (await this.interviewRepository.listQuestions({ interviewType: "MOCK" })).map((question) => question.questionId);
    }
    return questions.map((question) => question.questionId);
  }

  private async selectRecruitingQuestionIds(postingId: number): Promise<number[]> {
    const questions = await this.interviewRepository.listQuestions({
      interviewType: "RECRUITING",
      postingId,
    });
    if (questions.length > 0) {
      return questions.map((question) => question.questionId);
    }

    const fallbackBySortOrder = new Map<number, InterviewQuestion>();
    (await this.interviewRepository.listQuestions({ interviewType: "RECRUITING" })).forEach((question) => {
      if (!fallbackBySortOrder.has(question.sortOrder)) {
        fallbackBySortOrder.set(question.sortOrder, question);
      }
    });
    return [...fallbackBySortOrder.values()].map((question) => question.questionId);
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

  private assertPromoteRequest(dto: PromoteFollowUpQuestionDto): number {
    const requestBody = this.toRequestBody(dto, "followUpPromotion");
    if (!this.isPositiveInteger(requestBody.processLogId)) {
      throw new CandidateDomainError("COMMON_VALIDATION_FAILED", "processLogId is invalid.", 400, [
        { field: "processLogId", reason: "processLogId must be a positive integer" },
      ]);
    }
    return requestBody.processLogId;
  }

  private async countFollowUpQuestions(session: RuntimeInterviewSession): Promise<number> {
    const questions = await Promise.all(session.questionIds.map((questionId) => this.interviewRepository.findQuestion(questionId)));
    return questions.filter((question) => question?.questionType === "FOLLOW_UP").length;
  }

  private assertInProgress(session: RuntimeInterviewSession): void {
    if (session.status !== "IN_PROGRESS") {
      throw new CandidateDomainError("COMMON_CONFLICT", "Interview is not in progress.", 409, [
        { field: "interviewStatus", reason: `current status is ${session.status}` },
      ]);
    }
  }

  private assertReadyOrInProgress(session: RuntimeInterviewSession): void {
    if (!["NOT_READY", "READY", "IN_PROGRESS"].includes(session.status)) {
      throw new CandidateDomainError("COMMON_CONFLICT", "Interview is not ready.", 409, [
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

  private async currentQuestion(session: RuntimeInterviewSession): Promise<InterviewQuestion> {
    return this.requiredQuestion(this.currentQuestionId(session));
  }

  private currentQuestionId(session: RuntimeInterviewSession): number {
    const questionId = session.questionIds[session.currentQuestionIndex];
    if (!questionId) {
      throw new CandidateDomainError("COMMON_NOT_FOUND", "Current question was not found.", 404);
    }
    return questionId;
  }

  private async syncCurrentQuestionToFirstUnanswered(session: RuntimeInterviewSession): Promise<RuntimeInterviewSession> {
    if (session.status !== "IN_PROGRESS") {
      return session;
    }

    const answers = await Promise.all(
      session.questionIds.map((questionId) => this.interviewRepository.findAnswer(session.sessionId, questionId)),
    );
    const firstUnansweredIndex = answers.findIndex((answer) => !answer);
    if (firstUnansweredIndex < 0 || firstUnansweredIndex === session.currentQuestionIndex) {
      return session;
    }

    session.currentQuestionIndex = firstUnansweredIndex;
    session.updatedAt = new Date().toISOString();
    return this.interviewRepository.saveRuntimeSession(session);
  }

  private async requiredQuestion(questionId: number): Promise<InterviewQuestion> {
    const question = await this.interviewRepository.findQuestion(questionId);
    if (!question) {
      throw new CandidateDomainError("COMMON_NOT_FOUND", "Interview question was not found.", 404, [
        { field: "questionId", reason: "question not found" },
      ]);
    }
    return question;
  }

  private async countAnswers(sessionId: number): Promise<number> {
    return this.interviewRepository.countAnswersBySession(sessionId);
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
