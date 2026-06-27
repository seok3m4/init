export type AiProcessType =
  | "DOCUMENT_EXTRACT"
  | "STT"
  | "FOLLOW_UP"
  | "REPORT_GENERATE"
  | "EMBEDDING"
  | "GUARDRAIL_VALIDATE";

export type AiProcessStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type FailureCategory = "RETRYABLE" | "NON_RETRYABLE";
export type GuardrailResult = "PASS" | "BLOCKED" | "REGENERATED";

export interface AiWorkerJob {
  processLogId: number;
  processType: AiProcessType;
  inputRef: string;
  attempt: number;
}

export interface AiQueueMessage {
  messageId: string;
  receiptHandle: string;
  job: AiWorkerJob;
}

export interface GuardrailDecision {
  result: GuardrailResult;
  reason: string | null;
}

export interface FailureReason {
  category: FailureCategory;
  reason: string;
}

export interface AiTaskResult {
  outputRef?: string;
  guardrail?: GuardrailDecision;
  finalSave?: () => Promise<void>;
}

export interface AiTaskHandler {
  handle(job: AiWorkerJob): Promise<AiTaskResult>;
}

export interface AiProcessLogSnapshot {
  processLogId: number;
  processType: AiProcessType;
  status: AiProcessStatus;
  inputRef: string;
  outputRef?: string;
  failure?: FailureReason;
}
