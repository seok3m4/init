import { BadRequestException, Body, Controller, Headers, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { DevAuthAdapter } from "../common/dev-auth/dev-auth.adapter";
import { CurrentUser } from "../common/dev-auth/current-user";
import { ok } from "../common/response/api-response";
import { AiJobDispatcherService } from "./ai-job-dispatcher.service";
import {
  AnswerEvaluationRequest,
  CommunicationAnalysisRequest,
  EvaluationContextRequest,
  GenerateReportRequest,
  ReportPipelineStep,
  ReportType
} from "./report.types";

type HeaderMap = Record<string, string | string[] | undefined>;

@Controller("reports")
export class ReportsController {
  constructor(
    private readonly devAuthAdapter: DevAuthAdapter,
    private readonly dispatcher: AiJobDispatcherService
  ) {}

  @Post(":reportId/evaluation-context")
  @HttpCode(HttpStatus.ACCEPTED)
  async buildEvaluationContext(
    @Param("reportId") reportIdParam: string,
    @Headers() headers: HeaderMap,
    @Body() body: EvaluationContextRequest
  ) {
    const currentUser = this.devAuthAdapter.parse(headers);
    this.devAuthAdapter.assertCompany(currentUser);
    this.validateEvaluationContextPayload(body);

    const reportId = this.parseReportId(reportIdParam);
    const result = await this.dispatcher.dispatchReportGeneration({
      reportId,
      reportType: body.reportType,
      input: this.reportStepInput("EVALUATION_CONTEXT", reportId, body, currentUser)
    });

    return ok(result);
  }

  @Post(":reportId/answer-evaluation")
  @HttpCode(HttpStatus.ACCEPTED)
  async evaluateAnswers(
    @Param("reportId") reportIdParam: string,
    @Headers() headers: HeaderMap,
    @Body() body: AnswerEvaluationRequest
  ) {
    const currentUser = this.devAuthAdapter.parse(headers);
    this.devAuthAdapter.assertCompany(currentUser);
    this.validateAnswerEvaluationPayload(body);

    const reportId = this.parseReportId(reportIdParam);
    const result = await this.dispatcher.dispatchReportGeneration({
      reportId,
      reportType: body.reportType,
      input: this.reportStepInput("ANSWER_EVALUATION", reportId, body, currentUser)
    });

    return ok(result);
  }

  @Post(":reportId/communication-analysis")
  @HttpCode(HttpStatus.ACCEPTED)
  async analyzeCommunication(
    @Param("reportId") reportIdParam: string,
    @Headers() headers: HeaderMap,
    @Body() body: CommunicationAnalysisRequest
  ) {
    const currentUser = this.devAuthAdapter.parse(headers);
    this.devAuthAdapter.assertCompany(currentUser);
    this.validateCommunicationAnalysisPayload(body);

    const reportId = this.parseReportId(reportIdParam);
    const result = await this.dispatcher.dispatchReportGeneration({
      reportId,
      reportType: body.reportType,
      input: this.reportStepInput("COMMUNICATION_ANALYSIS", reportId, body, currentUser)
    });

    return ok(result);
  }

  @Post(":reportId/generate")
  @HttpCode(HttpStatus.ACCEPTED)
  async generateRecruitingReport(
    @Param("reportId") reportIdParam: string,
    @Headers() headers: HeaderMap,
    @Body() body: GenerateReportRequest
  ) {
    const currentUser = this.devAuthAdapter.parse(headers);
    this.devAuthAdapter.assertCompany(currentUser);

    if (body.reportType !== "RECRUITING_REPORT") {
      throw new BadRequestException({
        code: "COMMON_VALIDATION_FAILED",
        message: "This endpoint only generates recruiting reports."
      });
    }

    const reportId = this.parseReportId(reportIdParam);
    this.validateGeneratePayload(body);

    const result = await this.dispatcher.dispatchReportGeneration({
      reportId,
      reportType: body.reportType,
      input: this.reportInput("RECRUITING_REPORT_GENERATE", reportId, body, currentUser)
    });

    return ok(result);
  }

  private reportInput(kind: string, reportId: number, body: GenerateReportRequest, currentUser: CurrentUser) {
    return {
      kind,
      requestedBy: {
        userId: currentUser.userId,
        userType: currentUser.userType,
        companyId: currentUser.companyId
      },
      payload: {
        ...body,
        reportId
      }
    };
  }

  private reportStepInput(
    step: ReportPipelineStep,
    reportId: number,
    body: EvaluationContextRequest | AnswerEvaluationRequest | CommunicationAnalysisRequest,
    currentUser: CurrentUser
  ) {
    return {
      kind: "REPORT_PIPELINE_STEP",
      requestedBy: {
        userId: currentUser.userId,
        userType: currentUser.userType,
        companyId: currentUser.companyId
      },
      payload: {
        ...body,
        reportId,
        step
      }
    };
  }

  private validateEvaluationContextPayload(body: EvaluationContextRequest): void {
    this.validateRecruitingReportType(body.reportType);
    if (!body.company?.companyId || !body.posting?.postingId || !body.application?.applicationId) {
      throw this.validation("company, posting, and application are required.");
    }
    if (!body.posting.jobDescription?.trim()) {
      throw this.validation("posting.jobDescription is required.");
    }
    this.validateCriteria(body.criteria);
    this.validateAnswers(body.answers);
  }

  private validateAnswerEvaluationPayload(body: AnswerEvaluationRequest): void {
    this.validateRecruitingReportType(body.reportType);
    this.validateCriteria(body.criteria);
    this.validateAnswers(body.answers);
  }

  private validateCommunicationAnalysisPayload(body: CommunicationAnalysisRequest): void {
    this.validateRecruitingReportType(body.reportType);
    if (!body.consentConfirmed) {
      throw this.validation("consentConfirmed is required for communication analysis.");
    }
    if (!body.mediaQuality) {
      throw this.validation("mediaQuality is required.");
    }
  }

  private validateGeneratePayload(body: GenerateReportRequest): void {
    this.validateReportType(body.reportType);
    if (!body.jobDescription?.trim()) {
      throw this.validation("jobDescription is required.");
    }
    this.validateCriteria(body.criteria);
    this.validateAnswers(body.answers);
  }

  private validateReportType(reportType: ReportType): void {
    if (!["RECRUITING_REPORT", "MOCK_INTERVIEW_REPORT"].includes(reportType)) {
      throw this.validation("reportType is invalid.");
    }
  }

  private validateRecruitingReportType(reportType: ReportType): void {
    if (reportType !== "RECRUITING_REPORT") {
      throw this.validation("This endpoint only processes recruiting reports.");
    }
  }

  private validateCriteria(criteria: GenerateReportRequest["criteria"]): void {
    if (!Array.isArray(criteria) || criteria.length === 0) {
      throw this.validation("criteria is required.");
    }
    for (const criterion of criteria) {
      if (!Number.isInteger(criterion.criterionId) || criterion.criterionId <= 0 || !criterion.name?.trim()) {
        throw this.validation("criterionId and criterion name are required.");
      }
    }
  }

  private validateAnswers(answers: GenerateReportRequest["answers"]): void {
    if (!Array.isArray(answers) || answers.length === 0) {
      throw this.validation("answers is required.");
    }
    for (const answer of answers) {
      if (!Number.isInteger(answer.answerId) || answer.answerId <= 0 || !answer.transcript?.trim()) {
        throw this.validation("answerId and transcript are required.");
      }
    }
  }

  private parseReportId(reportIdParam: string): number {
    const reportId = Number(reportIdParam);
    if (!Number.isInteger(reportId) || reportId <= 0) {
      throw new BadRequestException({
        code: "COMMON_VALIDATION_FAILED",
        message: "reportId must be a positive integer."
      });
    }
    return reportId;
  }

  private validation(message: string): BadRequestException {
    return new BadRequestException({
      code: "COMMON_VALIDATION_FAILED",
      message
    });
  }
}

@Controller("candidate/mock-interview/reports")
export class CandidateMockReportsController {
  constructor(
    private readonly devAuthAdapter: DevAuthAdapter,
    private readonly dispatcher: AiJobDispatcherService
  ) {}

  @Post(":reportId/generate")
  @HttpCode(HttpStatus.ACCEPTED)
  async generateMockInterviewReport(
    @Param("reportId") reportIdParam: string,
    @Headers() headers: HeaderMap,
    @Body() body: GenerateReportRequest
  ) {
    const currentUser = this.devAuthAdapter.parse(headers);
    this.devAuthAdapter.assertCandidate(currentUser);

    if (body.reportType !== "MOCK_INTERVIEW_REPORT") {
      throw new BadRequestException({
        code: "COMMON_VALIDATION_FAILED",
        message: "This endpoint only generates mock interview reports."
      });
    }

    const reportId = this.parseReportId(reportIdParam);
    this.validateGeneratePayload(body);

    const result = await this.dispatcher.dispatchReportGeneration({
      reportId,
      reportType: body.reportType,
      input: this.reportInput("MOCK_REPORT_GENERATE", reportId, body, currentUser)
    });

    return ok(result);
  }

  private reportInput(kind: string, reportId: number, body: GenerateReportRequest, currentUser: CurrentUser) {
    return {
      kind,
      requestedBy: {
        userId: currentUser.userId,
        userType: currentUser.userType,
        candidateId: currentUser.candidateId
      },
      payload: {
        ...body,
        reportId
      }
    };
  }

  private validateGeneratePayload(body: GenerateReportRequest): void {
    if (!body.jobDescription?.trim()) {
      throw this.validation("jobDescription is required.");
    }
    if (!Array.isArray(body.criteria) || body.criteria.length === 0) {
      throw this.validation("criteria is required.");
    }
    if (!Array.isArray(body.answers) || body.answers.length === 0) {
      throw this.validation("answers is required.");
    }
  }

  private parseReportId(reportIdParam: string): number {
    const reportId = Number(reportIdParam);
    if (!Number.isInteger(reportId) || reportId <= 0) {
      throw new BadRequestException({
        code: "COMMON_VALIDATION_FAILED",
        message: "reportId must be a positive integer."
      });
    }
    return reportId;
  }

  private validation(message: string): BadRequestException {
    return new BadRequestException({
      code: "COMMON_VALIDATION_FAILED",
      message
    });
  }
}
