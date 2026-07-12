import { Inject, Injectable } from "@nestjs/common";
import { AI_JOB_QUEUE_PUBLISHER, AiJobQueuePublisher } from "./ai-job-queue.publisher";
import { REPORT_REPOSITORY, ReportRepository } from "../repository/report.repository";
import {
  AiProcessRefs,
  AiProcessType,
  EvaluationReportSnapshot,
  FailureReason,
  QueuedAiProcessSnapshot,
  ReportType
} from "../report.types";

export interface DispatchAiJobCommand {
  processType: AiProcessType;
  input: unknown;
  refs?: AiProcessRefs;
  idempotencyKey?: string;
}

export interface DispatchAiJobResult extends QueuedAiProcessSnapshot {
  queued: boolean;
  deduplicated: boolean;
}

export interface DispatchReportGenerationCommand {
  reportId: number;
  reportType: ReportType;
  input: unknown;
  refs?: AiProcessRefs;
}

export interface DispatchReportGenerationResult extends DispatchAiJobResult {
  report: EvaluationReportSnapshot;
}

@Injectable()
export class AiJobDispatcherService {
  constructor(
    @Inject(REPORT_REPOSITORY) private readonly repository: ReportRepository,
    @Inject(AI_JOB_QUEUE_PUBLISHER) private readonly queuePublisher: AiJobQueuePublisher
  ) {}

  async dispatch(command: DispatchAiJobCommand): Promise<DispatchAiJobResult> {
    const inputRef = JSON.stringify(command.input);
    const reservation = await this.repository.reserveQueuedProcess(
      command.processType,
      inputRef,
      command.refs,
      command.idempotencyKey
    );
    const process = reservation.process;
    if (reservation.action === "REUSE") {
      return {
        ...process,
        queued: process.status === "PENDING" || process.status === "RUNNING",
        deduplicated: true
      };
    }

    try {
      await this.queuePublisher.publish({
        processLogId: process.processLogId,
        processType: process.processType,
        inputRef: process.inputRef,
        attempt: 1
      });
    } catch (error) {
      const failed = await this.repository.markQueuedProcessFailed(process.processLogId, this.queuePublishFailure(error));
      return {
        ...failed,
        queued: false,
        deduplicated: reservation.action === "REQUEUE"
      };
    }

    return {
      ...process,
      queued: true,
      deduplicated: reservation.action === "REQUEUE"
    };
  }

  async dispatchReportGeneration(command: DispatchReportGenerationCommand): Promise<DispatchReportGenerationResult> {
    const report = await this.repository.markReportGenerating(command.reportId, command.reportType, command.refs);
    const process = await this.dispatch({
      processType: "REPORT_GENERATE",
      input: command.input,
      refs: command.refs
    });
    const finalReport =
      process.status === "FAILED" && process.failure
        ? await this.repository.markReportFailed(command.reportId, process.failure)
        : report;

    return {
      ...process,
      report: finalReport
    };
  }

  private queuePublishFailure(error: unknown): FailureReason {
    const reason = error instanceof Error ? error.message : "unknown queue publish failure";
    return {
      category: "RETRYABLE",
      reason: `AI queue publish failed: ${reason}`,
      retryable: true
    };
  }
}
