import { BadRequestException, Injectable } from "@nestjs/common";
import { GuardrailService } from "./guardrail.service";
import { MockAiReportProvider } from "./mock-ai-report.provider";
import {
  AiProcessStatus,
  GenerateReportCommand,
  GenerateReportRequest,
  GenerateReportResult,
  ProcessLogSnapshot
} from "./report.types";

@Injectable()
export class AiReportPipelineService {
  private nextProcessLogId = 1;

  constructor(
    private readonly mockProvider: MockAiReportProvider,
    private readonly guardrailService: GuardrailService
  ) {}

  generate(command: GenerateReportCommand): GenerateReportResult {
    this.validate(command.body);

    const processLog = this.createProcessLog();
    this.transition(processLog, "RUNNING");

    try {
      const generatedReport = this.mockProvider.generate(command.body);
      const guardrail = this.guardrailService.validate(command.body.reportType, generatedReport);

      if (guardrail.result !== "PASS") {
        this.transition(processLog, "FAILED");
        return {
          ...generatedReport,
          processLogId: processLog.processLogId,
          processType: processLog.processType,
          status: processLog.status,
          reportId: command.reportId,
          guardrail
        };
      }

      this.transition(processLog, "COMPLETED");

      return {
        ...generatedReport,
        processLogId: processLog.processLogId,
        processType: processLog.processType,
        status: processLog.status,
        reportId: command.reportId,
        guardrail
      };
    } catch (error) {
      this.transition(processLog, "FAILED");
      throw error;
    }
  }

  private createProcessLog(): ProcessLogSnapshot {
    return {
      processLogId: this.nextProcessLogId++,
      processType: "REPORT_GENERATE",
      status: "PENDING"
    };
  }

  private transition(processLog: ProcessLogSnapshot, status: AiProcessStatus): void {
    processLog.status = status;
  }

  private validate(input: GenerateReportRequest): void {
    if (!["RECRUITING_REPORT", "MOCK_INTERVIEW_REPORT"].includes(input.reportType)) {
      throw new BadRequestException({
        code: "COMMON_VALIDATION_FAILED",
        message: "reportType is invalid."
      });
    }

    if (!input.jobDescription?.trim()) {
      throw new BadRequestException({
        code: "COMMON_VALIDATION_FAILED",
        message: "jobDescription is required."
      });
    }

    if (!Array.isArray(input.criteria) || input.criteria.length === 0) {
      throw new BadRequestException({
        code: "COMMON_VALIDATION_FAILED",
        message: "criteria is required."
      });
    }

    if (!Array.isArray(input.answers) || input.answers.length === 0) {
      throw new BadRequestException({
        code: "COMMON_VALIDATION_FAILED",
        message: "answers is required."
      });
    }

    for (const criterion of input.criteria) {
      if (!Number.isInteger(criterion.criterionId) || criterion.criterionId <= 0 || !criterion.name?.trim()) {
        throw new BadRequestException({
          code: "COMMON_VALIDATION_FAILED",
          message: "criterionId and criterion name are required."
        });
      }
    }

    for (const answer of input.answers) {
      if (!Number.isInteger(answer.answerId) || answer.answerId <= 0 || !answer.transcript?.trim()) {
        throw new BadRequestException({
          code: "COMMON_VALIDATION_FAILED",
          message: "answerId and transcript are required."
        });
      }
    }
  }
}
