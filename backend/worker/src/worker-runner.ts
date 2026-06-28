import { AiJobQueue } from "./queue";
import { AiProcessLogRepository } from "./process-log.repository";
import { toFailureReason } from "./worker-errors";
import { AiQueueMessage, AiTaskHandler, AiWorkerJob, FailureReason } from "./worker.types";

export interface AiWorkerRunnerOptions {
  maxMessages?: number;
  guardrailPolicyName?: string;
  onStart?: (job: AiWorkerJob) => Promise<void>;
  onFailure?: (job: AiWorkerJob, failure: FailureReason) => Promise<void>;
}

export class AiWorkerRunner {
  private readonly options: Required<Pick<AiWorkerRunnerOptions, "maxMessages" | "guardrailPolicyName">> &
    Pick<AiWorkerRunnerOptions, "onStart" | "onFailure">;

  constructor(
    private readonly queue: AiJobQueue,
    private readonly repository: AiProcessLogRepository,
    private readonly handler: AiTaskHandler,
    options: AiWorkerRunnerOptions = {}
  ) {
    this.options = {
      maxMessages: 1,
      guardrailPolicyName: "AI_WORKER_OUTPUT_VALIDATE",
      ...options
    };
  }

  async processBatch(): Promise<number> {
    const messages = await this.queue.receive(this.options.maxMessages);
    for (const message of messages) {
      await this.processMessage(message);
    }
    return messages.length;
  }

  private async processMessage(message: AiQueueMessage): Promise<void> {
    await this.repository.ensurePending(message.job);
    await this.repository.markRunning(message.job.processLogId);

    try {
      await this.options.onStart?.(message.job);
      const result = await this.handler.handle(message.job);

      if (result.guardrail) {
        await this.repository.saveGuardrailLog(
          message.job.processLogId,
          this.options.guardrailPolicyName,
          result.guardrail
        );

        if (result.guardrail.result === "BLOCKED") {
          await this.failAndAck(message, {
            category: result.guardrail.failureCategory ?? "NON_RETRYABLE",
            reason: result.guardrail.reason ?? "guardrail blocked output",
            retryable: result.guardrail.failureCategory === "RETRYABLE"
          });
          return;
        }
      }

      if (result.finalSave) {
        await result.finalSave();
      }

      await this.repository.markCompleted(message.job.processLogId, result.outputRef);
      await this.queue.delete(message);
    } catch (error) {
      const failure = toFailureReason(error);
      if (failure.category === "RETRYABLE") {
        await this.markFailed(message, failure);
        return;
      }

      await this.failAndAck(message, failure);
    }
  }

  private async failAndAck(message: AiQueueMessage, failure: FailureReason): Promise<void> {
    await this.markFailed(message, failure);
    await this.queue.delete(message);
  }

  private async markFailed(message: AiQueueMessage, failure: FailureReason): Promise<void> {
    await this.options.onFailure?.(message.job, failure);
    await this.repository.markFailed(message.job.processLogId, failure);
  }
}
