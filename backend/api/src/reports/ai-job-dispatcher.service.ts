import { Inject, Injectable } from "@nestjs/common";
import { AI_JOB_QUEUE_PUBLISHER, AiJobQueuePublisher } from "./ai-job-queue.publisher";
import { REPORT_REPOSITORY, ReportRepository } from "./report.repository";
import { AiProcessRefs, AiProcessType, QueuedAiProcessSnapshot } from "./report.types";

export interface DispatchAiJobCommand {
  processType: AiProcessType;
  input: unknown;
  refs?: AiProcessRefs;
}

export interface DispatchAiJobResult extends QueuedAiProcessSnapshot {
  queued: true;
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
}
