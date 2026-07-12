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

export interface NcsEvaluationBasis {
  sourceKind: "OFFICIAL_NCS" | "SYNTHETIC_NCS_LIKE";
  sourceVersion: string;
  categoryType: "OCCUPATIONAL_BASIC" | "JOB_PERFORMANCE";
  jobRole: string | null;
  unit: {
    code: string;
    name: string;
    level: number | null;
    definition: string;
  };
  behaviorPoints: Array<{
    behaviorPointId: string;
    description: string;
    sourceElementCodes: string[];
    requiredEvidence: NcsEvidenceType[];
  }>;
}

export interface NcsEvaluationProductOutput {
  contractVersion: "ncs-evaluation-product.v1";
  evaluationSnapshotVersion: string;
  sessionId: number;
  questionId: number;
  answerId?: number;
  evaluationBasis?: NcsEvaluationBasis;
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

export interface QueueTextInputNcsEvaluationOptions {
  sessionId: number;
  questionId: number;
  transcript: string;
  requestEvaluation: (
    sessionId: number,
    body: NcsEvaluationRequest,
  ) => Promise<{ data: NcsEvaluationHandoffResponse }>;
}

export interface SaveTextInputPracticeAnswerOptions {
  sessionId: number;
  questionId: number;
  transcript: string;
  saveAnswer: (
    sessionId: number,
    body: {
      questionId: number;
      answerSource: "TEXT_INPUT";
      transcript: string;
      durationSeconds: number;
    },
  ) => Promise<{ data: { answer: { answerId: number } } }>;
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
const STATUS_BY_LEVEL: Record<number, NcsEvaluationStatus> = {
  1: "NOT_DEMONSTRATED",
  2: "LIMITED",
  3: "DEVELOPING",
  4: "DEMONSTRATED",
  5: "STRONGLY_DEMONSTRATED",
};
const EVIDENCE_TYPES = new Set<NcsEvidenceType>([
  "SITUATION",
  "TASK",
  "ACTION",
  "RATIONALE",
  "RESULT",
  "REFLECTION",
  "KNOWLEDGE",
  "CONSTRAINT",
  "TRADEOFF",
]);
const CLAIM_TYPES = new Set([...EVIDENCE_TYPES, "CONTRADICTION"]);

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

export async function queueTextInputNcsEvaluation(
  options: QueueTextInputNcsEvaluationOptions,
): Promise<NcsEvaluationHandoffResponse> {
  const response = await options.requestEvaluation(options.sessionId, {
    questionId: options.questionId,
    answerSource: "TEXT_INPUT",
    transcript: options.transcript.trim(),
  });
  return response.data;
}

export async function saveTextInputPracticeAnswer(
  options: SaveTextInputPracticeAnswerOptions,
): Promise<{ answerId: number; transcript: string }> {
  const transcript = options.transcript.trim();
  if (!transcript || transcript.length > 20_000) {
    throw new Error("텍스트 연습 답변은 1자 이상 20,000자 이하여야 합니다.");
  }
  const response = await options.saveAnswer(options.sessionId, {
    questionId: options.questionId,
    answerSource: "TEXT_INPUT",
    transcript,
    durationSeconds: Math.max(1, Math.ceil(transcript.replace(/\s+/g, "").length / 5)),
  });
  return { answerId: response.data.answer.answerId, transcript };
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
    !validMetadata(value.metadata) ||
    (Object.hasOwn(value, "evaluationBasis") && !validEvaluationBasis(value.evaluationBasis))
  ) {
    return undefined;
  }
  if (Object.hasOwn(value, "answerId") && !isPositiveInteger(value.answerId)) {
    return undefined;
  }
  if (!value.evidences.every(validEvidence) || !value.behaviorEvaluations.every(validBehaviorEvaluation)) {
    return undefined;
  }
  if (!validOutputRelations(value)) return undefined;
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
    typeof value.claimType === "string" &&
    CLAIM_TYPES.has(value.claimType) &&
    isUniqueStringArray(value.behaviorPointIds)
  );
}

function validBehaviorEvaluation(value: unknown): boolean {
  if (!isRecord(value) || !isNonEmptyText(value.behaviorPointId) || !isNonEmptyText(value.rationale)) {
    return false;
  }
  if (
    !isUniqueStringArray(value.supportingEvidenceIds, true) ||
    !isUniqueStringArray(value.contradictingEvidenceIds, true) ||
    !isUniqueStringArray(value.missingEvidence, true) ||
    value.missingEvidence.some((type) => !EVIDENCE_TYPES.has(type as NcsEvidenceType)) ||
    !["HIGH", "MEDIUM", "LOW"].includes(String(value.confidence))
  ) {
    return false;
  }
  if (value.status === "INSUFFICIENT_EVIDENCE") {
    return value.level === null && value.score === null;
  }
  return isPositiveInteger(value.level) &&
    Number(value.level) <= 5 &&
    value.score === SCORE_BY_LEVEL[Number(value.level)] &&
    value.status === STATUS_BY_LEVEL[Number(value.level)];
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
  if (
    !isRecord(value) ||
    typeof value.required !== "boolean" ||
    !isUniqueStringArray(value.missingEvidence, true) ||
    value.missingEvidence.some((type) => !EVIDENCE_TYPES.has(type as NcsEvidenceType))
  ) {
    return false;
  }
  if (value.required) {
    return isNonEmptyText(value.reason) && isNonEmptyText(value.suggestedQuestion);
  }
  return value.reason === null && value.suggestedQuestion === null;
}

function validEvaluationBasis(value: unknown): value is NcsEvaluationBasis {
  if (!isRecord(value) || !isRecord(value.unit) || !Array.isArray(value.behaviorPoints) || value.behaviorPoints.length === 0) {
    return false;
  }
  if (
    !["OFFICIAL_NCS", "SYNTHETIC_NCS_LIKE"].includes(String(value.sourceKind)) ||
    !["OCCUPATIONAL_BASIC", "JOB_PERFORMANCE"].includes(String(value.categoryType)) ||
    !isNonEmptyText(value.sourceVersion) ||
    !(value.jobRole === null || (isNonEmptyText(value.jobRole) && value.jobRole.length <= 80)) ||
    !isNonEmptyText(value.unit.code) ||
    !isNonEmptyText(value.unit.name) ||
    !isNonEmptyText(value.unit.definition) ||
    !(value.unit.level === null || isPositiveInteger(value.unit.level))
  ) {
    return false;
  }
  const ids = new Set<string>();
  for (const point of value.behaviorPoints) {
    if (!isRecord(point)) return false;
    if (
      !isNonEmptyText(point.behaviorPointId) ||
      ids.has(point.behaviorPointId) ||
      !isNonEmptyText(point.description) ||
      !isUniqueStringArray(point.sourceElementCodes) ||
      !isUniqueStringArray(point.requiredEvidence) ||
      point.requiredEvidence.some((type) => !EVIDENCE_TYPES.has(type as NcsEvidenceType))
    ) {
      return false;
    }
    ids.add(point.behaviorPointId);
  }
  return true;
}

function validOutputRelations(value: Record<string, unknown>): boolean {
  const evidences = value.evidences as Array<Record<string, unknown>>;
  const evaluations = value.behaviorEvaluations as Array<Record<string, unknown>>;
  const evidenceIds = new Set<string>();
  for (const evidence of evidences) {
    const evidenceId = evidence.evidenceId as string;
    if (evidenceIds.has(evidenceId)) return false;
    evidenceIds.add(evidenceId);
  }

  const behaviorIds = new Set<string>();
  let evaluatedCount = 0;
  for (const evaluation of evaluations) {
    const behaviorPointId = evaluation.behaviorPointId as string;
    if (behaviorIds.has(behaviorPointId)) return false;
    behaviorIds.add(behaviorPointId);
    if (evaluation.status !== "INSUFFICIENT_EVIDENCE") evaluatedCount += 1;
    const supporting = evaluation.supportingEvidenceIds as string[];
    const contradicting = evaluation.contradictingEvidenceIds as string[];
    if (
      supporting.some((id) => !evidenceIds.has(id)) ||
      contradicting.some((id) => !evidenceIds.has(id)) ||
      supporting.some((id) => contradicting.includes(id))
    ) {
      return false;
    }
  }
  for (const evidence of evidences) {
    if ((evidence.behaviorPointIds as string[]).some((id) => !behaviorIds.has(id))) return false;
  }

  const basis = value.evaluationBasis as NcsEvaluationBasis | undefined;
  if (basis) {
    const basisIds = new Set(basis.behaviorPoints.map((point) => point.behaviorPointId));
    if (basisIds.size !== behaviorIds.size || [...behaviorIds].some((id) => !basisIds.has(id))) return false;
  }

  const coverage = value.coverage as NcsEvaluationProductOutput["coverage"];
  const expectedRatio = evaluations.length === 0 ? 0 : evaluatedCount / evaluations.length;
  return coverage.assessableBehaviorPointCount === evaluations.length &&
    coverage.evaluatedBehaviorPointCount === evaluatedCount &&
    Math.abs(coverage.ratio - expectedRatio) < 0.000001;
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

function isUniqueStringArray(value: unknown, allowEmpty = false): value is string[] {
  return isStringArray(value, allowEmpty) && new Set(value as string[]).size === (value as string[]).length;
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
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const onTimeout = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onAbort = () => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      cleanup();
      const error = new Error("평가 요청이 취소되었습니다.");
      error.name = "AbortError";
      reject(error);
    };
    timeoutId = setTimeout(onTimeout, milliseconds);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}
