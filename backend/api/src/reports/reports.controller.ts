import { BadRequestException, Body, Controller, Headers, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { DevAuthAdapter } from "../common/dev-auth/dev-auth.adapter";
import { ok } from "../common/response/api-response";
import { AiReportPipelineService } from "./ai-report-pipeline.service";
import { GenerateReportRequest } from "./report.types";

@Controller("reports")
export class ReportsController {
  constructor(
    private readonly devAuthAdapter: DevAuthAdapter,
    private readonly aiReportPipelineService: AiReportPipelineService
  ) {}

  @Post(":reportId/generate")
  @HttpCode(HttpStatus.ACCEPTED)
  generate(
    @Param("reportId") reportIdParam: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
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

    const reportId = Number(reportIdParam);
    if (!Number.isInteger(reportId) || reportId <= 0) {
      throw new BadRequestException({
        code: "COMMON_VALIDATION_FAILED",
        message: "reportId must be a positive integer."
      });
    }

    const result = this.aiReportPipelineService.generate({
      currentUser,
      reportId,
      body
    });

    return ok(result);
  }
}
