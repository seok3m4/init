import { Inject, Injectable } from "@nestjs/common";
import { AI_JOB_QUEUE_PUBLISHER, AiJobQueuePublisher } from "./ai-job-queue.publisher";
import { REPORT_REPOSITORY, ReportRepository } from "./report.repository";
import {
  AiProcessRefs,
  AiProcessType,
  EvaluationReportSnapshot,
  QueuedAiProcessSnapshot,
  ReportType
} from "./report.types";

export interface DispatchAiJobCommand {
  processType: AiProcessType;
  input: unknown;
  refs?: AiProcessRefs;
}

export interface DispatchAiJobResult extends QueuedAiProcessSnapshot {
  queued: true;
}

export interface DispatchReportGenerationCommand {
  reportId: number;
  reportType: ReportType;
  input: unknown;
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
    const process = await this.repository.createQueuedProcess(command.processType, inputRef, command.refs);

    await this.queuePublisher.publish({
      processLogId: process.processLogId,
      processType: process.processType,
      inputRef: process.inputRef,
      attempt: 1
    });

    return {
      ...process,
      queued: true
    };
  }

  async dispatchReportGeneration(command: DispatchReportGenerationCommand): Promise<DispatchReportGenerationResult> {
    const report = await this.repository.markReportGenerating(command.reportId, command.reportType);
    const process = await this.dispatch({
      processType: "REPORT_GENERATE",
      input: command.input
    });

    return {
      ...process,
      report
    };
  }
}
