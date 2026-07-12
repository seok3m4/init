export type NcsEvaluationAnswerSource = "STORED_ANSWER" | "TEXT_INPUT";
export type NcsEvidenceType =
  | "SITUATION"
  | "TASK"
  | "ACTION"
  | "RATIONALE"
  | "RESULT"
  | "REFLECTION"
  | "KNOWLEDGE"
  | "CONSTRAINT"
  | "TRADEOFF";
export type NcsEvaluationStatus =
  | "INSUFFICIENT_EVIDENCE"
  | "NOT_DEMONSTRATED"
  | "LIMITED"
  | "DEVELOPING"
  | "DEMONSTRATED"
  | "STRONGLY_DEMONSTRATED";

export interface NcsEvaluationRequest {
  questionId: number;
  answerSource: NcsEvaluationAnswerSource;
  answerId?: number;
  transcript?: string;
}

export interface NcsEvaluationHandoffResponse {
  accepted: true;
  processType: "REPORT_GENERATE";
  step: "NCS_ANSWER_EVALUATION";
  status: NcsAiJobStatus["status"];
  queued: boolean;
  processLogId: number;
  sessionId: number;
  questionId: number;
  answerId?: number;
  inputRef: string;
  callbackTopic: "ai.interview.ncs-answer-evaluation.requested";
}

export interface NcsEvaluationEvidence {
  evidenceId: string;
  quote: string;
  startChar: number;
  endChar: number;
  claimType: NcsEvidenceType | "CONTRADICTION";
  behaviorPointIds: string[];
}

export interface NcsBehaviorEvaluation {
  behaviorPointId: string;
  status: NcsEvaluationStatus;
  level: 1 | 2 | 3 | 4 | 5 | null;
  score: 25 | 50 | 70 | 85 | 100 | null;
  rationale: string;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  missingEvidence: NcsEvidenceType[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface NcsEvaluationProductOutput {
  contractVersion: "ncs-evaluation-product.v1";
  evaluationSnapshotVersion: string;
  sessionId: number;
  questionId: number;
  answerId?: number;
  evidences: NcsEvaluationEvidence[];
  behaviorEvaluations: NcsBehaviorEvaluation[];
  coverage: {
    assessableBehaviorPointCount: number;
    evaluatedBehaviorPointCount: number;
    ratio: number;
    status: "SUFFICIENT" | "LOW" | "INSUFFICIENT";
  };
  followUp: {
    required: boolean;
    reason: string | null;
    missingEvidence: NcsEvidenceType[];
    suggestedQuestion: string | null;
  };
  guardrail: {
    unsupportedFactDetected: false;
    sensitiveAttributeUsed: false;
    nonverbalSignalUsed: false;
    hiringDecisionLanguageDetected: false;
  };
  metadata: {
    strategyId: "evidence-state";
    strategyVersion: string;
    model: string;
  };
}

export interface NcsAiJobStatus {
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  output?: unknown;
  failure?: {
    reason: string;
  };
}

export interface PollNcsEvaluationOptions {
  processLogId: number;
  getStatus: (processLogId: number) => Promise<{ data: NcsAiJobStatus }>;
  attempts?: number;
  intervalMs?: number;
  maxIntervalMs?: number;
  backoffFactor?: number;
  signal?: AbortSignal;
  onStatus?: (status: NcsAiJobStatus["status"]) => void;
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}

export class NcsEvaluationPollingTimeoutError extends Error {
  constructor(readonly processLogId: number) {
    super("평가가 지연되고 있습니다. 기존 평가 작업을 다시 확인해 주세요.");
    this.name = "NcsEvaluationPollingTimeoutError";
  }
}

export type StoredAnswerNcsEvaluationSkipReason = "UNSUPPORTED_MODE" | "QUESTION_NOT_ASSESSABLE";

export interface QueueStoredAnswerNcsEvaluationOptions {
  mode: "mock" | "recruiting";
  sessionId: number;
  questionId: number;
  questionType: string;
  answerId: number;
  requestEvaluation: (
    sessionId: number,
    body: NcsEvaluationRequest,
  ) => Promise<{ data: NcsEvaluationHandoffResponse }>;
}

export type QueueStoredAnswerNcsEvaluationResult =
  | {
      status: "SKIPPED";
      reason: StoredAnswerNcsEvaluationSkipReason;
    }
  | {
      status: "QUEUED";
      handoff: NcsEvaluationHandoffResponse;
    };

const NCS_ASSESSABLE_QUESTION_TYPES = new Set(["TECHNICAL", "EXPERIENCE", "SITUATION", "FOLLOW_UP"]);

const SCORE_BY_LEVEL: Record<number, number> = {
  1: 25,
  2: 50,
  3: 70,
  4: 85,
  5: 100,
};

export function shouldQueueStoredAnswerNcsEvaluation(mode: string, questionType: string): boolean {
  return mode === "mock" && NCS_ASSESSABLE_QUESTION_TYPES.has(questionType);
}

export async function queueStoredAnswerNcsEvaluation(
  options: QueueStoredAnswerNcsEvaluationOptions,
): Promise<QueueStoredAnswerNcsEvaluationResult> {
  if (options.mode !== "mock") {
    return { status: "SKIPPED", reason: "UNSUPPORTED_MODE" };
  }
  if (!NCS_ASSESSABLE_QUESTION_TYPES.has(options.questionType)) {
    return { status: "SKIPPED", reason: "QUESTION_NOT_ASSESSABLE" };
  }

  const response = await options.requestEvaluation(options.sessionId, {
    questionId: options.questionId,
    answerSource: "STORED_ANSWER",
    answerId: options.answerId,
  });
  return { status: "QUEUED", handoff: response.data };
}

export function parseNcsEvaluationProductOutput(value: unknown): NcsEvaluationProductOutput | undefined {
  if (!isRecord(value) || value.contractVersion !== "ncs-evaluation-product.v1") {
    return undefined;
  }
  if (
    !isPositiveInteger(value.sessionId) ||
    !isPositiveInteger(value.questionId) ||
    !isNonEmptyText(value.evaluationSnapshotVersion) ||
    !Array.isArray(value.evidences) ||
    !Array.isArray(value.behaviorEvaluations) ||
    !validCoverage(value.coverage) ||
    !validFollowUp(value.followUp) ||
    !validGuardrail(value.guardrail) ||
    !validMetadata(value.metadata)
  ) {
    return undefined;
  }
  if (Object.hasOwn(value, "answerId") && !isPositiveInteger(value.answerId)) {
    return undefined;
  }
  if (!value.evidences.every(validEvidence) || !value.behaviorEvaluations.every(validBehaviorEvaluation)) {
    return undefined;
  }
  return value as unknown as NcsEvaluationProductOutput;
}

export async function pollNcsEvaluation(
  options: PollNcsEvaluationOptions,
): Promise<NcsEvaluationProductOutput> {
  const attempts = options.attempts ?? 45;
  const intervalMs = options.intervalMs ?? 700;
  const maxIntervalMs = options.maxIntervalMs ?? 3_000;
  const backoffFactor = options.backoffFactor ?? 1.15;
  const wait = options.wait ?? waitFor;
  let nextIntervalMs = intervalMs;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    throwIfAborted(options.signal);
    const status = (await options.getStatus(options.processLogId)).data;
    options.onStatus?.(status.status);

    if (status.status === "COMPLETED") {
      const output = parseNcsEvaluationProductOutput(status.output);
      if (!output) {
        throw new Error("평가 결과 형식을 확인할 수 없습니다.");
      }
      return output;
    }
    if (status.status === "FAILED") {
      throw new Error(status.failure?.reason || "답변 평가에 실패했습니다.");
    }
    if (attempt < attempts - 1) {
      await wait(nextIntervalMs, options.signal);
      nextIntervalMs = Math.min(maxIntervalMs, Math.ceil(nextIntervalMs * backoffFactor));
    }
  }

  throw new NcsEvaluationPollingTimeoutError(options.processLogId);
}

function validEvidence(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isNonEmptyText(value.evidenceId) &&
    isNonEmptyText(value.quote) &&
    isNonNegativeInteger(value.startChar) &&
    isNonNegativeInteger(value.endChar) &&
    Number(value.endChar) > Number(value.startChar) &&
    isNonEmptyText(value.claimType) &&
    isStringArray(value.behaviorPointIds)
  );
}

function validBehaviorEvaluation(value: unknown): boolean {
  if (!isRecord(value) || !isNonEmptyText(value.behaviorPointId) || !isNonEmptyText(value.rationale)) {
    return false;
  }
  if (
    !isStringArray(value.supportingEvidenceIds, true) ||
    !isStringArray(value.contradictingEvidenceIds, true) ||
    !isStringArray(value.missingEvidence, true) ||
    !["HIGH", "MEDIUM", "LOW"].includes(String(value.confidence))
  ) {
    return false;
  }
  if (value.status === "INSUFFICIENT_EVIDENCE") {
    return value.level === null && value.score === null;
  }
  return isPositiveInteger(value.level) && Number(value.level) <= 5 && value.score === SCORE_BY_LEVEL[Number(value.level)];
}

function validCoverage(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.assessableBehaviorPointCount) &&
    isNonNegativeInteger(value.evaluatedBehaviorPointCount) &&
    typeof value.ratio === "number" &&
    value.ratio >= 0 &&
    value.ratio <= 1 &&
    ["SUFFICIENT", "LOW", "INSUFFICIENT"].includes(String(value.status))
  );
}

function validFollowUp(value: unknown): boolean {
  if (!isRecord(value) || typeof value.required !== "boolean" || !isStringArray(value.missingEvidence, true)) {
    return false;
  }
  if (value.required) {
    return isNonEmptyText(value.reason) && isNonEmptyText(value.suggestedQuestion);
  }
  return value.reason === null && value.suggestedQuestion === null;
}

function validGuardrail(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.unsupportedFactDetected === false &&
    value.sensitiveAttributeUsed === false &&
    value.nonverbalSignalUsed === false &&
    value.hiringDecisionLanguageDetected === false
  );
}

function validMetadata(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.strategyId === "evidence-state" &&
    isNonEmptyText(value.strategyVersion) &&
    isNonEmptyText(value.model)
  );
}

function isStringArray(value: unknown, allowEmpty = false): boolean {
  return Array.isArray(value) && (allowEmpty || value.length > 0) && value.every(isNonEmptyText);
}

function isPositiveInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) > 0;
}

function isNonNegativeInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error("평가 요청이 취소되었습니다.");
    error.name = "AbortError";
    throw error;
  }
}

function waitFor(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId);
        const error = new Error("평가 요청이 취소되었습니다.");
        error.name = "AbortError";
        reject(error);
      },
      { once: true },
    );
  });
}
