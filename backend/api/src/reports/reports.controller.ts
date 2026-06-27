import { BadRequestException, Body, Controller, Headers, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { DevAuthAdapter } from "../common/dev-auth/dev-auth.adapter";
import { CurrentUser } from "../common/dev-auth/current-user";
import { ok } from "../common/response/api-response";
import { AiJobDispatcherService } from "./ai-job-dispatcher.service";
import { AiReportPipelineService } from "./ai-report-pipeline.service";
import {
  AnswerEvaluationRequest,
  CommunicationAnalysisRequest,
  EvaluationContextRequest,
  GenerateReportRequest
} from "./report.types";

type HeaderMap = Record<string, string | string[] | undefined>;

@Controller("reports")
export class ReportsController {
  constructor(
    private readonly devAuthAdapter: DevAuthAdapter,
    private readonly dispatcher: AiJobDispatcherService,
    private readonly aiReportPipelineService: AiReportPipelineService
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

    const result = await this.aiReportPipelineService.buildEvaluationContext({
      currentUser,
      reportId: this.parseReportId(reportIdParam),
      body
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

    const result = await this.aiReportPipelineService.evaluateAnswers({
      currentUser,
      reportId: this.parseReportId(reportIdParam),
      body
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

    const result = await this.aiReportPipelineService.analyzeCommunication({
      currentUser,
      reportId: this.parseReportId(reportIdParam),
      body
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

@Controller("candidate/mock-interview/reports")
export class CandidateMockReportsController {
  constructor(
    private readonly devAuthAdapter: DevAuthAdapter,
    private readonly dispatcher: AiJobDispatcherService,
    private readonly aiReportPipelineService: AiReportPipelineService
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
