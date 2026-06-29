import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post
} from "@nestjs/common";
import { DevAuthAdapter } from "../../common/dev-auth/dev-auth.adapter";
import { CurrentUser } from "../../common/dev-auth/current-user";
import { AiJobDispatcherService } from "../report/ai-job-dispatcher.service";
import { AiProcessNotFoundError, REPORT_REPOSITORY, ReportRepository } from "../report/report.repository";
import { AiProcessType } from "../report/report.types";

type HeaderMap = Record<string, string | string[] | undefined>;
type JobBody = Record<string, unknown>;

@Controller("candidate")
export class CandidateAiJobsController {
  constructor(
    @Inject(DevAuthAdapter) private readonly devAuthAdapter: DevAuthAdapter,
    @Inject(AiJobDispatcherService) private readonly dispatcher: AiJobDispatcherService
  ) {}

  @Post("documents/extract")
  @HttpCode(HttpStatus.ACCEPTED)
  async extractDocument(@Headers() headers: HeaderMap, @Body() body: JobBody) {
    const currentUser = this.candidate(headers);
    this.requirePositive(body.applicationId, "applicationId");
    this.requirePositive(body.documentId, "documentId");
    this.requirePositive(body.fileId, "fileId");
    this.requireText(body.s3Key, "s3Key");
    this.forbidRawPayload(body, ["fileContent", "rawContent", "base64", "fileBytes"]);

    return this.dispatcher.dispatch({
      processType: "DOCUMENT_EXTRACT",
      input: this.input("DOCUMENT_EXTRACT", body, currentUser),
      refs: { applicationId: Number(body.applicationId) }
    });
  }

  @Post("mock-interviews/:sessionId/stt")
  @HttpCode(HttpStatus.ACCEPTED)
  async transcribeMockInterview(@Param("sessionId") sessionIdParam: string, @Headers() headers: HeaderMap, @Body() body: JobBody) {
    return this.transcribe("MOCK_INTERVIEW_STT", sessionIdParam, headers, body);
  }

  @Post("interviews/:sessionId/stt")
  @HttpCode(HttpStatus.ACCEPTED)
  async transcribeRecruitingInterview(
    @Param("sessionId") sessionIdParam: string,
    @Headers() headers: HeaderMap,
    @Body() body: JobBody
  ) {
    return this.transcribe("RECRUITING_INTERVIEW_STT", sessionIdParam, headers, body);
  }

  @Post("mock-interviews/:sessionId/follow-up-question")
  @HttpCode(HttpStatus.ACCEPTED)
  async mockFollowUp(@Param("sessionId") sessionIdParam: string, @Headers() headers: HeaderMap, @Body() body: JobBody) {
    return this.followUp("MOCK_FOLLOW_UP", sessionIdParam, headers, body);
  }

  @Post("interviews/:sessionId/follow-up-question")
  @HttpCode(HttpStatus.ACCEPTED)
  async recruitingFollowUp(@Param("sessionId") sessionIdParam: string, @Headers() headers: HeaderMap, @Body() body: JobBody) {
    return this.followUp("RECRUITING_FOLLOW_UP", sessionIdParam, headers, body);
  }

  @Post("mock-interviews/questions/generate")
  @HttpCode(HttpStatus.ACCEPTED)
  async generateMockQuestions(@Headers() headers: HeaderMap, @Body() body: JobBody) {
    const currentUser = this.candidate(headers);
    this.requirePositive(body.questionCount, "questionCount");

    return this.dispatcher.dispatch({
      processType: "QUESTION_GENERATE",
      input: this.input("MOCK_QUESTION_GENERATE", body, currentUser)
    });
  }

  private async transcribe(kind: string, sessionIdParam: string, headers: HeaderMap, body: JobBody) {
    const currentUser = this.candidate(headers);
    const sessionId = this.parseId(sessionIdParam, "sessionId");
    this.requirePositive(body.answerId, "answerId");
    this.requirePositive(body.audioFileId, "audioFileId");
    this.requireText(body.audioS3Key, "audioS3Key");
    this.forbidRawPayload(body, ["audioContent", "audioBase64", "fileContent", "rawContent", "base64", "fileBytes"]);

    return this.dispatcher.dispatch({
      processType: "STT",
      input: this.input(kind, { ...body, sessionId }, currentUser),
      refs: { sessionId }
    });
  }

  private async followUp(kind: string, sessionIdParam: string, headers: HeaderMap, body: JobBody) {
    const currentUser = this.candidate(headers);
    const sessionId = this.parseId(sessionIdParam, "sessionId");
    this.requirePositive(body.answerId, "answerId");
    this.requireText(body.previousQuestion, "previousQuestion");
    this.requireText(body.transcript, "transcript");
    if (kind === "RECRUITING_FOLLOW_UP") {
      this.requireAnyText(body, ["jobDescription", "documentSummary"]);
    }

    return this.dispatcher.dispatch({
      processType: "FOLLOW_UP",
      input: this.input(kind, { ...body, sessionId }, currentUser),
      refs: { sessionId }
    });
  }

  private candidate(headers: HeaderMap): CurrentUser {
    const currentUser = this.devAuthAdapter.parse(headers);
    this.devAuthAdapter.assertCandidate(currentUser);
    return currentUser;
  }

  private input(kind: string, body: JobBody, currentUser: CurrentUser) {
    return {
      kind,
      requestedBy: {
        userId: currentUser.userId,
        userType: currentUser.userType,
        candidateId: currentUser.candidateId
      },
      payload: body
    };
  }

  private parseId(value: string, name: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw this.validation(`${name} must be a positive integer.`);
    }
    return parsed;
  }

  private requirePositive(value: unknown, name: string): void {
    if (!Number.isInteger(Number(value)) || Number(value) <= 0) {
      throw this.validation(`${name} must be a positive integer.`);
    }
  }

  private requireText(value: unknown, name: string): void {
    if (typeof value !== "string" || !value.trim()) {
      throw this.validation(`${name} is required.`);
    }
  }

  private requireAnyText(body: JobBody, names: string[]): void {
    if (!names.some((name) => typeof body[name] === "string" && String(body[name]).trim())) {
      throw this.validation(`${names.join(" or ")} is required.`);
    }
  }

  private forbidRawPayload(body: JobBody, names: string[]): void {
    const providedName = names.find((name) => body[name] !== undefined && body[name] !== null);
    if (providedName) {
      throw this.validation(`${providedName} must not be sent. Use fileId and S3 object key references.`);
    }
  }

  private validation(message: string): BadRequestException {
    return new BadRequestException({
      code: "COMMON_VALIDATION_FAILED",
      message
    });
  }
}

@Controller("company/interviews")
export class CompanyAiJobsController {
  constructor(
    @Inject(DevAuthAdapter) private readonly devAuthAdapter: DevAuthAdapter,
    @Inject(AiJobDispatcherService) private readonly dispatcher: AiJobDispatcherService
  ) {}

  @Post("evaluation-criteria/suggest")
  @HttpCode(HttpStatus.ACCEPTED)
  async suggestCriteria(@Headers() headers: HeaderMap, @Body() body: JobBody) {
    this.requirePositive(body.postingId, "postingId");
    this.requireText(body.jobDescription, "jobDescription");
    this.requireText(body.talentProfile, "talentProfile");
    this.requireText(body.evaluationPolicy, "evaluationPolicy");

    return this.dispatchCompanyJob("CRITERIA_SUGGEST", "CRITERIA_SUGGEST", headers, body);
  }

  @Post("questions/generate")
  @HttpCode(HttpStatus.ACCEPTED)
  async generateQuestions(@Headers() headers: HeaderMap, @Body() body: JobBody) {
    this.requirePositive(body.postingId, "postingId");
    this.requireText(body.jobDescription, "jobDescription");
    this.requirePositive(body.questionCount, "questionCount");

    return this.dispatchCompanyJob("QUESTION_GENERATE", "RECRUITING_QUESTION_GENERATE", headers, body);
  }

  @Post("question-sets")
  @HttpCode(HttpStatus.ACCEPTED)
  async generateQuestionSet(@Headers() headers: HeaderMap, @Body() body: JobBody) {
    this.requirePositive(body.postingId, "postingId");
    this.requirePositive(body.questionCount, "questionCount");
    this.requireNonEmptyArray(body.criteria, "criteria");
    this.requireNonEmptyArray(body.questionTypes, "questionTypes");

    return this.dispatchCompanyJob("QUESTION_SET_GENERATE", "QUESTION_SET_GENERATE", headers, body);
  }

  private async dispatchCompanyJob(processType: AiProcessType, kind: string, headers: HeaderMap, body: JobBody) {
    const currentUser = this.company(headers);

    return this.dispatcher.dispatch({
      processType,
      input: {
        kind,
        requestedBy: {
          userId: currentUser.userId,
          userType: currentUser.userType,
          companyId: currentUser.companyId
        },
        payload: body
      }
    });
  }

  private company(headers: HeaderMap): CurrentUser {
    const currentUser = this.devAuthAdapter.parse(headers);
    this.devAuthAdapter.assertCompany(currentUser);
    return currentUser;
  }

  private requirePositive(value: unknown, name: string): void {
    if (!Number.isInteger(Number(value)) || Number(value) <= 0) {
      throw this.validation(`${name} must be a positive integer.`);
    }
  }

  private requireText(value: unknown, name: string): void {
    if (typeof value !== "string" || !value.trim()) {
      throw this.validation(`${name} is required.`);
    }
  }

  private requireNonEmptyArray(value: unknown, name: string): void {
    if (!Array.isArray(value) || value.length === 0) {
      throw this.validation(`${name} is required.`);
    }
  }

  private validation(message: string): BadRequestException {
    return new BadRequestException({
      code: "COMMON_VALIDATION_FAILED",
      message
    });
  }
}

@Controller("ai/jobs")
export class AiJobsStatusController {
  constructor(
    @Inject(DevAuthAdapter) private readonly devAuthAdapter: DevAuthAdapter,
    @Inject(REPORT_REPOSITORY) private readonly repository: ReportRepository
  ) {}

  @Get(":processLogId/status")
  async getStatus(@Param("processLogId") processLogIdParam: string, @Headers() headers: HeaderMap) {
    this.devAuthAdapter.parse(headers);
    const processLogId = this.parseId(processLogIdParam, "processLogId");

    try {
      return await this.repository.getProcess(processLogId);
    } catch (error) {
      if (error instanceof AiProcessNotFoundError) {
        throw new NotFoundException({
          code: "AI_PROCESS_NOT_FOUND",
          message: error.message
        });
      }
      throw error;
    }
  }

  private parseId(value: string, name: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({
        code: "COMMON_VALIDATION_FAILED",
        message: `${name} must be a positive integer.`
      });
    }
    return parsed;
  }
}
