import { AiProcessType } from "./report.types";

export const AI_JOB_QUEUE_PUBLISHER = Symbol("AI_JOB_QUEUE_PUBLISHER");

export interface AiJobQueueMessage {
  processLogId: number;
  processType: AiProcessType;
  inputRef: string;
  attempt: number;
}

export interface AiJobQueuePublisher {
  publish(message: AiJobQueueMessage): Promise<void>;
}

export class InMemoryAiJobQueuePublisher implements AiJobQueuePublisher {
  readonly messages: AiJobQueueMessage[] = [];

  async publish(message: AiJobQueueMessage): Promise<void> {
    this.messages.push(message);
  }
}
