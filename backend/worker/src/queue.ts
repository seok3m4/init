import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
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

export class SqsAiJobQueue implements AiJobQueue {
  constructor(
    private readonly client: SQSClient,
    private readonly queueUrl: string
  ) {}

  async receive(maxMessages: number): Promise<AiQueueMessage[]> {
    const result = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: Math.min(Math.max(maxMessages, 1), 10),
        WaitTimeSeconds: 10
      })
    );

    return (result.Messages ?? []).map((message) => {
      if (!message.MessageId || !message.ReceiptHandle || !message.Body) {
        throw new Error("SQS message is missing MessageId, ReceiptHandle, or Body.");
      }

      return {
        messageId: message.MessageId,
        receiptHandle: message.ReceiptHandle,
        job: JSON.parse(message.Body)
      };
    });
  }

  async delete(message: AiQueueMessage): Promise<void> {
    await this.client.send(
      new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: message.receiptHandle
      })
    );
  }
}

export function createAiJobQueue(env: NodeJS.ProcessEnv = process.env): AiJobQueue {
  if (env.AI_SQS_QUEUE_URL) {
    return new SqsAiJobQueue(
      new SQSClient({
        region: env.AWS_REGION ?? "ap-northeast-2"
      }),
      env.AI_SQS_QUEUE_URL
    );
  }

  return new InMemoryAiJobQueue([]);
}
