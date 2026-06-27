import { BadRequestException, Body, Controller, Headers, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { DevAuthAdapter } from "../common/dev-auth/dev-auth.adapter";
import { ok } from "../common/response/api-response";
import { GuardrailService } from "./guardrail.service";
import { REPORT_REPOSITORY, ReportRepository } from "./report.repository";
import { GuardrailValidationRequest, GuardrailValidationResult } from "./report.types";

type HeaderMap = Record<string, string | string[] | undefined>;

@Controller("ai/guardrails")
export class AiGuardrailsController {
  constructor(
    private readonly devAuthAdapter: DevAuthAdapter,
    private readonly guardrailService: GuardrailService,
    @Inject(REPORT_REPOSITORY) private readonly repository: ReportRepository
  ) {}

  @Post("validate")
  @HttpCode(HttpStatus.OK)
  async validate(@Headers() headers: HeaderMap, @Body() body: GuardrailValidationRequest) {
    const currentUser = this.devAuthAdapter.parse(headers);
    this.devAuthAdapter.assertAdmin(currentUser);
    this.validateBody(body);

    const guardrail =
      body.target === "REPORT"
        ? this.guardrailService.validateReport(body.reportType, {
            summary: body.summary ?? "",
            totalScore: body.totalScore ?? 0,
            scores: body.scores
          })
        : this.guardrailService.validateScores(body.reportType, body.scores);

    const result: GuardrailValidationResult = {
      target: body.target,
      guardrail
    };

    if (body.processLogId) {
      result.guardrailLogId = await this.repository.saveGuardrailLog(
        body.processLogId,
        body.policyName ?? "AI_GUARDRAIL_VALIDATE",
        guardrail
      );
    }

    return ok(result);
  }

  private validateBody(body: GuardrailValidationRequest): void {
    if (!body || !["RECRUITING_REPORT", "MOCK_INTERVIEW_REPORT"].includes(body.reportType)) {
      throw this.validation("reportType is invalid.");
    }
    if (!["REPORT", "SCORES"].includes(body.target)) {
      throw this.validation("target is invalid.");
    }
    if (!Array.isArray(body.scores)) {
      throw this.validation("scores is required.");
    }
    if (body.target === "REPORT" && !body.summary?.trim()) {
      throw this.validation("summary is required for report guardrail validation.");
    }
    if (body.processLogId && (!Number.isInteger(body.processLogId) || body.processLogId <= 0)) {
      throw this.validation("processLogId must be a positive integer.");
    }
  }

  private validation(message: string): BadRequestException {
    return new BadRequestException({
      code: "COMMON_VALIDATION_FAILED",
      message
    });
  }
}
