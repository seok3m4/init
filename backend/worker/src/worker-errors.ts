import { FailureCategory, FailureReason } from "./worker.types";

export class AiWorkerFailure extends Error {
  constructor(
    readonly category: FailureCategory,
    message: string
  ) {
    super(message);
    this.name = "AiWorkerFailure";
  }
}

export class RetryableAiWorkerFailure extends AiWorkerFailure {
  constructor(message: string) {
    super("RETRYABLE", message);
    this.name = "RetryableAiWorkerFailure";
  }
}

export class NonRetryableAiWorkerFailure extends AiWorkerFailure {
  constructor(message: string) {
    super("NON_RETRYABLE", message);
    this.name = "NonRetryableAiWorkerFailure";
  }
}

export function toFailureReason(error: unknown): FailureReason {
  if (error instanceof AiWorkerFailure) {
    return {
      category: error.category,
      reason: error.message
    };
  }

  return {
    category: "RETRYABLE",
    reason: error instanceof Error ? error.message : "unknown worker failure"
  };
}
