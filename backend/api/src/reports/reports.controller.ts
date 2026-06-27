import { BadRequestException, Body, Controller, Headers, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { DevAuthAdapter } from "../common/dev-auth/dev-auth.adapter";
import { ok } from "../common/response/api-response";
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
    private readonly aiReportPipelineService: AiReportPipelineService
  ) {}

  @Post(":reportId/evaluation-context")
  @HttpCode(HttpStatus.ACCEPTED)
  buildEvaluationContext(
    @Param("reportId") reportIdParam: string,
    @Headers() headers: HeaderMap,
    @Body() body: EvaluationContextRequest
  ) {
    const currentUser = this.devAuthAdapter.parse(headers);
    this.devAuthAdapter.assertCompany(currentUser);

    const result = this.aiReportPipelineService.buildEvaluationContext({
      currentUser,
      reportId: this.parseReportId(reportIdParam),
      body
    });

    return ok(result);
  }

  @Post(":reportId/answer-evaluation")
  @HttpCode(HttpStatus.ACCEPTED)
  evaluateAnswers(
    @Param("reportId") reportIdParam: string,
    @Headers() headers: HeaderMap,
    @Body() body: AnswerEvaluationRequest
  ) {
    const currentUser = this.devAuthAdapter.parse(headers);
    this.devAuthAdapter.assertCompany(currentUser);

    const result = this.aiReportPipelineService.evaluateAnswers({
      currentUser,
      reportId: this.parseReportId(reportIdParam),
      body
    });

    return ok(result);
  }

  @Post(":reportId/communication-analysis")
  @HttpCode(HttpStatus.ACCEPTED)
  analyzeCommunication(
    @Param("reportId") reportIdParam: string,
    @Headers() headers: HeaderMap,
    @Body() body: CommunicationAnalysisRequest
  ) {
    const currentUser = this.devAuthAdapter.parse(headers);
    this.devAuthAdapter.assertCompany(currentUser);

    const result = this.aiReportPipelineService.analyzeCommunication({
      currentUser,
      reportId: this.parseReportId(reportIdParam),
      body
    });

    return ok(result);
  }

  @Post(":reportId/generate")
  @HttpCode(HttpStatus.ACCEPTED)
  generateRecruitingReport(
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

    const result = this.aiReportPipelineService.generate({
      currentUser,
      reportId: this.parseReportId(reportIdParam),
      body
    });

    return ok(result);
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
}

@Controller("candidate/mock-interview/reports")
export class CandidateMockReportsController {
  constructor(
    private readonly devAuthAdapter: DevAuthAdapter,
    private readonly aiReportPipelineService: AiReportPipelineService
  ) {}

  @Post(":reportId/generate")
  @HttpCode(HttpStatus.ACCEPTED)
  generateMockInterviewReport(
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

    const result = this.aiReportPipelineService.generate({
      currentUser,
      reportId: this.parseReportId(reportIdParam),
      body
    });

    return ok(result);
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
}
