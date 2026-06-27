import { AiQueueMessage } from "./worker.types";

export interface AiJobQueue {
  receive(maxMessages: number): Promise<AiQueueMessage[]>;
  delete(message: AiQueueMessage): Promise<void>;
}

export class InMemoryAiJobQueue implements AiJobQueue {
  readonly deletedMessageIds: string[] = [];

  constructor(private readonly messages: AiQueueMessage[]) {}

  async receive(maxMessages: number): Promise<AiQueueMessage[]> {
    return this.messages.slice(0, maxMessages);
  }

  async delete(message: AiQueueMessage): Promise<void> {
    this.deletedMessageIds.push(message.messageId);
    const index = this.messages.findIndex((item) => item.messageId === message.messageId);
    if (index >= 0) {
      this.messages.splice(index, 1);
    }
  }
}
