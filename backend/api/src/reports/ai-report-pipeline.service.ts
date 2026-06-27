import { BadRequestException, Injectable } from "@nestjs/common";
import { GuardrailService } from "./guardrail.service";
import { InMemoryReportRepository } from "./in-memory-report.repository";
import { MockAiReportProvider } from "./mock-ai-report.provider";
import {
  AnswerEvaluationRequest,
  AnswerEvaluationResult,
  CommunicationAnalysisRequest,
  CommunicationAnalysisResult,
  EvaluationContextRequest,
  EvaluationContextResult,
  FailureReason,
  GenerateReportRequest,
  GenerateReportResult,
  ReportCommand,
  ReportPipelineStep,
  ReportType
} from "./report.types";

@Injectable()
export class AiReportPipelineService {
  constructor(
    private readonly mockProvider: MockAiReportProvider,
    private readonly guardrailService: GuardrailService,
    private readonly repository: InMemoryReportRepository
  ) {}

  buildEvaluationContext(command: ReportCommand<EvaluationContextRequest>): EvaluationContextResult {
    this.validateEvaluationContext(command.body);
    const processLog = this.start(command.reportId, command.body.reportType, "EVALUATION_CONTEXT");

    try {
      const context = this.mockProvider.buildEvaluationContext(command.body);
      this.repository.saveContext(command.reportId, context);
      const completedProcess = this.repository.markProcessCompleted(processLog.processLogId);

      return {
        ...this.baseResult(command.reportId, completedProcess),
        context
      };
    } catch (error) {
      return this.fail(command.reportId, processLog.processLogId, this.toFailure(error, "RETRYABLE")) as EvaluationContextResult;
    }
  }

  evaluateAnswers(command: ReportCommand<AnswerEvaluationRequest>): AnswerEvaluationResult {
    this.validateAnswerEvaluation(command.body);
    const processLog = this.start(command.reportId, command.body.reportType, "ANSWER_EVALUATION");

    try {
      const scores = this.mockProvider.evaluateAnswers(command.body);
      const guardrail = this.guardrailService.validateScores(command.body.reportType, scores);
      this.repository.saveGuardrailLog(processLog.processLogId, "ANSWER_EVIDENCE_REQUIRED", guardrail);

      if (guardrail.result !== "PASS") {
        const failure = this.failure("NON_RETRYABLE", guardrail.reason ?? "answer evaluation blocked by guardrail");
        const failed = this.fail(command.reportId, processLog.processLogId, failure);
        return {
          ...failed,
          scores,
          guardrail,
          stored: this.repository.countStored(command.reportId)
        };
      }

      const stored = this.repository.saveScoresAndEvidences(command.reportId, scores);
      const completedProcess = this.repository.markProcessCompleted(processLog.processLogId);

      return {
        ...this.baseResult(command.reportId, completedProcess),
        scores,
        guardrail,
        stored
      };
    } catch (error) {
      const failed = this.fail(command.reportId, processLog.processLogId, this.toFailure(error, "RETRYABLE"));
      return {
        ...failed,
        scores: [],
        guardrail: { result: "BLOCKED", reason: failed.failure?.reason ?? "answer evaluation failed" },
        stored: this.repository.countStored(command.reportId)
      };
    }
  }

  analyzeCommunication(command: ReportCommand<CommunicationAnalysisRequest>): CommunicationAnalysisResult {
    this.validateCommunicationAnalysis(command.body);
    const processLog = this.start(command.reportId, command.body.reportType, "COMMUNICATION_ANALYSIS");

    try {
      const communicationAnalysis = this.mockProvider.analyzeCommunication(command.body);
      this.repository.saveCommunicationAnalysis(command.reportId, communicationAnalysis);
      const completedProcess = this.repository.markProcessCompleted(processLog.processLogId);

      return {
        ...this.baseResult(command.reportId, completedProcess),
        communicationAnalysis
      };
    } catch (error) {
      return this.fail(command.reportId, processLog.processLogId, this.toFailure(error, "RETRYABLE")) as CommunicationAnalysisResult;
    }
  }

  generate(command: ReportCommand<GenerateReportRequest>): GenerateReportResult {
    this.validateGenerateReport(command.body);
    const processLog = this.start(command.reportId, command.body.reportType, "REPORT_GENERATE");

    try {
      const generatedReport = this.mockProvider.generate(command.body);
      const guardrail = this.guardrailService.validateReport(command.body.reportType, generatedReport);
      this.repository.saveGuardrailLog(processLog.processLogId, "REPORT_FINAL_SAVE", guardrail);

      if (guardrail.result !== "PASS") {
        const failure = this.failure("NON_RETRYABLE", guardrail.reason ?? "report blocked by guardrail");
        const failed = this.fail(command.reportId, processLog.processLogId, failure);
        return {
          ...failed,
          ...generatedReport,
          guardrail,
          stored: this.repository.countStored(command.reportId)
        };
      }

      const stored = this.repository.saveScoresAndEvidences(command.reportId, generatedReport.scores);
      this.repository.markReportCompleted(command.reportId, generatedReport.summary, generatedReport.totalScore);
      const completedProcess = this.repository.markProcessCompleted(processLog.processLogId);

      return {
        ...this.baseResult(command.reportId, completedProcess),
        ...generatedReport,
        guardrail,
        stored
      };
    } catch (error) {
      const failed = this.fail(command.reportId, processLog.processLogId, this.toFailure(error, "RETRYABLE"));
      return {
        ...failed,
        summary: "",
        totalScore: 0,
        scores: [],
        guardrail: { result: "BLOCKED", reason: failed.failure?.reason ?? "report generation failed" },
        stored: this.repository.countStored(command.reportId)
      };
    }
  }

  private start(reportId: number, reportType: ReportType, step: ReportPipelineStep) {
    const processLog = this.repository.startProcess(reportId, reportType, step);
    this.repository.markReportGenerating(reportId, reportType);
    return this.repository.markProcessRunning(processLog.processLogId);
  }

  private baseResult(reportId: number, processLog: ReturnType<InMemoryReportRepository["markProcessCompleted"]>) {
    return {
      processLogId: processLog.processLogId,
      processType: processLog.processType,
      step: processLog.step,
      status: processLog.status,
      report: this.repository.getReport(reportId),
      failure: processLog.failure
    };
  }

  private fail(reportId: number, processLogId: number, failure: FailureReason) {
    const failedProcess = this.repository.markProcessFailed(processLogId, failure);
    this.repository.markReportFailed(reportId, failure);
    return this.baseResult(reportId, failedProcess);
  }

  private validateEvaluationContext(input: EvaluationContextRequest): void {
    this.validateReportType(input.reportType);
    if (!input.company?.companyId || !input.posting?.postingId || !input.application?.applicationId) {
      throw this.validation("company, posting, and application are required.");
    }
    if (!input.posting.jobDescription?.trim()) {
      throw this.validation("posting.jobDescription is required.");
    }
    this.validateCriteria(input.criteria);
    this.validateAnswers(input.answers);
  }

  private validateAnswerEvaluation(input: AnswerEvaluationRequest): void {
    this.validateReportType(input.reportType);
    this.validateCriteria(input.criteria);
    this.validateAnswers(input.answers);
  }

  private validateCommunicationAnalysis(input: CommunicationAnalysisRequest): void {
    this.validateReportType(input.reportType);
    if (!input.consentConfirmed) {
      throw this.validation("consentConfirmed is required for communication analysis.");
    }
    if (!input.mediaQuality) {
      throw this.validation("mediaQuality is required.");
    }
  }

  private validateGenerateReport(input: GenerateReportRequest): void {
    this.validateReportType(input.reportType);
    if (!input.jobDescription?.trim()) {
      throw this.validation("jobDescription is required.");
    }
    this.validateCriteria(input.criteria);
    this.validateAnswers(input.answers);
  }

  private validateReportType(reportType: ReportType): void {
    if (!["RECRUITING_REPORT", "MOCK_INTERVIEW_REPORT"].includes(reportType)) {
      throw this.validation("reportType is invalid.");
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

  private validation(message: string): BadRequestException {
    return new BadRequestException({
      code: "COMMON_VALIDATION_FAILED",
      message
    });
  }

  private failure(category: FailureReason["category"], reason: string): FailureReason {
    return { category, reason };
  }

  private toFailure(error: unknown, fallbackCategory: FailureReason["category"]): FailureReason {
    if (error instanceof BadRequestException) {
      return this.failure("NON_RETRYABLE", error.message);
    }
    return this.failure(fallbackCategory, error instanceof Error ? error.message : "unknown AI report failure");
  }
}
