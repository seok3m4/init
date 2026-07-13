import { createHash } from "node:crypto";
import {
  EvidenceStateNcsEvaluator,
  isJobRoleDomainRelevant,
} from "../experiments/ncs-evaluation/evidence-state/evaluator";
import {
  NCS_EVALUATION_CONTRACT_VERSION,
  NCS_SCORE_MAP,
  type NcsBehaviorPoint,
  type NcsEvaluationContext,
  type NcsEvaluationInput,
  type NcsEvaluationOutput,
  type NcsEvidence,
  type NcsEvidenceType,
  type NcsQuestionInput,
} from "../experiments/ncs-evaluation/shared/contract";
import { NonRetryableAiWorkerFailure } from "../worker-errors";
import type { GuardrailDecision } from "../worker.types";

export const NCS_EVALUATION_PRODUCT_CONTRACT_VERSION = "ncs-evaluation-product.v1" as const;

interface NcsEvaluationProductSnapshot {
  contractVersion: typeof NCS_EVALUATION_PRODUCT_CONTRACT_VERSION;
  snapshotVersion: string;
  locale: "ko-KR";
  jobRole: string | null;
  question: NcsQuestionInput;
  ncsContext: NcsEvaluationContext;
  behaviorPoints: NcsBehaviorPoint[];
  evaluationPolicy: NcsEvaluationInput["evaluationPolicy"];
}

interface ParsedNcsEvaluationPayload {
  sessionId: number;
  questionId: number;
  answerId?: number;
  transcript: string;
  evaluationSnapshot: NcsEvaluationProductSnapshot;
}

export interface NcsEvaluationProductOutput {
  contractVersion: typeof NCS_EVALUATION_PRODUCT_CONTRACT_VERSION;
  evaluationSnapshotVersion: string;
  sessionId: number;
  questionId: number;
  answerId?: number;
  evaluationBasis: NcsEvaluationBasis;
  evidences: Array<Omit<NcsEvidence, "source">>;
  behaviorEvaluations: NcsEvaluationOutput["behaviorEvaluations"];
  coverage: NcsEvaluationOutput["coverage"];
  followUp: NcsEvaluationOutput["followUp"];
  guardrail: NcsEvaluationOutput["guardrail"];
  metadata: {
    strategyId: string;
    strategyVersion: string;
    model: string;
  };
}

export interface NcsEvaluationBasis {
  sourceKind: NcsEvaluationContext["sourceKind"];
  sourceVersion: string;
  categoryType: NcsEvaluationContext["categoryType"];
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

const EVIDENCE_TYPES: readonly NcsEvidenceType[] = [
  "SITUATION",
  "TASK",
  "ACTION",
  "RATIONALE",
  "RESULT",
  "REFLECTION",
  "KNOWLEDGE",
  "CONSTRAINT",
  "TRADEOFF",
];

const JOB_ROLE_INTERVIEW_CONTEXTS: Array<{ role: RegExp; context: string }> = [
  { role: /백엔드|backend/iu, context: "API, 데이터 처리 또는 서버 운영" },
  { role: /프론트엔드|frontend/iu, context: "사용자 경험, 접근성 또는 브라우저 성능" },
  { role: /풀스택|full\s*stack|fullstack/iu, context: "클라이언트와 서버의 경계 또는 데이터 흐름" },
  { role: /AI\s*\/\s*ML|AI\s*엔지니어|ML\s*엔지니어/iu, context: "데이터 품질, 모델 성능 또는 실험 재현성" },
  { role: /데이터\s*엔지니어|data\s*engineer/iu, context: "데이터 파이프라인, 정합성 또는 처리 신뢰성" },
  { role: /DevOps|SRE/iu, context: "배포 안정성, 관측 가능성 또는 장애 복구" },
  { role: /QA\s*엔지니어|quality\s*assurance/iu, context: "재현 조건, 테스트 전략 또는 품질 위험" },
  { role: /보안\s*엔지니어|security\s*engineer/iu, context: "위협, 보안 통제 또는 잔여 위험" },
];

const SENSITIVE_ATTRIBUTE_PATTERN =
  /(?:제\s*이름은|저는\s*(?:여성|남성)|나이는?\s*\d+\s*살|대학교\s*출신|출신\s*학교|출신지는?|장애인|신체\s*장애|건강\s*상태)/iu;
const NONVERBAL_SIGNAL_PATTERN = /(?:표정|시선|눈\s*맞춤|아이\s*컨택|억양|말\s*속도|목소리\s*톤)/iu;
const HIRING_DECISION_PATTERN = /(?:합격|불합격|탈락|채용\s*적합|채용\s*부적합|선별|hiring decision|pass\/fail)/iu;

export class ProductEvidenceStateNcsEvaluationAdapter {
  private readonly evaluator = new EvidenceStateNcsEvaluator();

  evaluate(payload: Record<string, unknown>): NcsEvaluationProductOutput {
    const parsed = parsePayload(payload);
    const input = toEvaluationInput(parsed);
    const evaluated = this.evaluator.evaluate(input);
    const output = toProductOutput(parsed, evaluated);
    assertProductOutputInvariants(output, parsed.transcript, parsed.evaluationSnapshot);
    return output;
  }
}

export function ncsEvaluationGuardrailDecision(output: NcsEvaluationProductOutput): GuardrailDecision {
  const violations = [
    output.guardrail.unsupportedFactDetected ? "unsupported fact" : undefined,
    output.guardrail.sensitiveAttributeUsed ? "sensitive attribute" : undefined,
    output.guardrail.nonverbalSignalUsed ? "nonverbal signal" : undefined,
    output.guardrail.hiringDecisionLanguageDetected ? "hiring decision language" : undefined,
  ].filter((value): value is string => Boolean(value));

  return violations.length === 0
    ? { result: "PASS", reason: null }
    : {
        result: "BLOCKED",
        reason: "NCS evaluation output used prohibited signals: " + violations.join(", "),
        failureCategory: "NON_RETRYABLE",
      };
}

function parsePayload(payload: Record<string, unknown>): ParsedNcsEvaluationPayload {
  if (payload.step !== "NCS_ANSWER_EVALUATION") {
    throw invalid("payload.step", "NCS_ANSWER_EVALUATION is required");
  }

  const sessionId = positiveInteger(payload.sessionId, "payload.sessionId");
  const questionId = positiveInteger(payload.questionId, "payload.questionId");
  const answerId = optionalPositiveInteger(payload.answerId, "payload.answerId");
  const transcript = canonicalTranscript(payload.transcript);
  const evaluationSnapshot = parseSnapshot(payload.evaluationSnapshot);

  if (evaluationSnapshot.question.questionId !== String(questionId)) {
    throw invalid("payload.evaluationSnapshot.question.questionId", "must match payload.questionId");
  }

  return {
    sessionId,
    questionId,
    ...(answerId !== undefined ? { answerId } : {}),
    transcript,
    evaluationSnapshot,
  };
}

function parseSnapshot(value: unknown): NcsEvaluationProductSnapshot {
  const snapshot = requiredObject(value, "payload.evaluationSnapshot");
  if (snapshot.contractVersion !== NCS_EVALUATION_PRODUCT_CONTRACT_VERSION) {
    throw invalid("payload.evaluationSnapshot.contractVersion", "unsupported product contract version");
  }
  if (snapshot.locale !== "ko-KR") {
    throw invalid("payload.evaluationSnapshot.locale", "ko-KR is required");
  }

  const ncsContext = parseNcsContext(snapshot.ncsContext);
  const sourceElementCodes = new Set(ncsContext.unit.elements.map((element) => element.elementCode));
  const behaviorPoints = parseBehaviorPoints(snapshot.behaviorPoints, sourceElementCodes);

  return {
    contractVersion: NCS_EVALUATION_PRODUCT_CONTRACT_VERSION,
    snapshotVersion: requiredText(snapshot.snapshotVersion, "payload.evaluationSnapshot.snapshotVersion"),
    locale: "ko-KR",
    jobRole: optionalJobRole(snapshot.jobRole, "payload.evaluationSnapshot.jobRole"),
    question: parseQuestion(snapshot.question),
    ncsContext,
    behaviorPoints,
    evaluationPolicy: parseEvaluationPolicy(snapshot.evaluationPolicy),
  };
}

function parseQuestion(value: unknown): NcsQuestionInput {
  const question = requiredObject(value, "payload.evaluationSnapshot.question");
  return {
    questionId: requiredText(question.questionId, "payload.evaluationSnapshot.question.questionId"),
    questionType: oneOf(
      question.questionType,
      ["EXPERIENCE", "SITUATION", "FOLLOW_UP"] as const,
      "payload.evaluationSnapshot.question.questionType",
    ),
    content: requiredText(question.content, "payload.evaluationSnapshot.question.content"),
  };
}

function parseNcsContext(value: unknown): NcsEvaluationContext {
  const context = requiredObject(value, "payload.evaluationSnapshot.ncsContext");
  const unit = requiredObject(context.unit, "payload.evaluationSnapshot.ncsContext.unit");
  const elements = requiredNonEmptyArray(unit.elements, "payload.evaluationSnapshot.ncsContext.unit.elements").map(
    (element, index) => {
      const item = requiredObject(element, "payload.evaluationSnapshot.ncsContext.unit.elements[" + index + "]");
      return {
        elementCode: requiredText(
          item.elementCode,
          "payload.evaluationSnapshot.ncsContext.unit.elements[" + index + "].elementCode",
        ),
        name: requiredText(item.name, "payload.evaluationSnapshot.ncsContext.unit.elements[" + index + "].name"),
      };
    },
  );
  const elementCodes = elements.map((element) => element.elementCode);
  if (new Set(elementCodes).size !== elementCodes.length) {
    throw invalid("payload.evaluationSnapshot.ncsContext.unit.elements", "elementCode must be unique");
  }

  const level = unit.level;
  if (level !== null && (!Number.isInteger(level) || Number(level) < 1)) {
    throw invalid("payload.evaluationSnapshot.ncsContext.unit.level", "must be null or a positive integer");
  }

  return {
    sourceKind: oneOf(
      context.sourceKind,
      ["OFFICIAL_NCS", "SYNTHETIC_NCS_LIKE"] as const,
      "payload.evaluationSnapshot.ncsContext.sourceKind",
    ),
    version: requiredText(context.version, "payload.evaluationSnapshot.ncsContext.version"),
    categoryType: oneOf(
      context.categoryType,
      ["OCCUPATIONAL_BASIC", "JOB_PERFORMANCE"] as const,
      "payload.evaluationSnapshot.ncsContext.categoryType",
    ),
    unit: {
      code: requiredText(unit.code, "payload.evaluationSnapshot.ncsContext.unit.code"),
      name: requiredText(unit.name, "payload.evaluationSnapshot.ncsContext.unit.name"),
      level: level as number | null,
      definition: requiredText(unit.definition, "payload.evaluationSnapshot.ncsContext.unit.definition"),
      elements,
    },
  };
}

function parseBehaviorPoints(value: unknown, sourceElementCodes: Set<string>): NcsBehaviorPoint[] {
  const points = requiredNonEmptyArray(value, "payload.evaluationSnapshot.behaviorPoints").map((point, index) => {
    const item = requiredObject(point, "payload.evaluationSnapshot.behaviorPoints[" + index + "]");
    const sourceCodes = requiredStringArray(
      item.sourceElementCodes,
      "payload.evaluationSnapshot.behaviorPoints[" + index + "].sourceElementCodes",
    );
    const unknownSourceCode = sourceCodes.find((code) => !sourceElementCodes.has(code));
    if (unknownSourceCode) {
      throw invalid(
        "payload.evaluationSnapshot.behaviorPoints[" + index + "].sourceElementCodes",
        "unknown source element code " + unknownSourceCode,
      );
    }
    const requiredEvidence = requiredNonEmptyArray(
      item.requiredEvidence,
      "payload.evaluationSnapshot.behaviorPoints[" + index + "].requiredEvidence",
    ).map((evidence, evidenceIndex) =>
      oneOf(
        evidence,
        EVIDENCE_TYPES,
        "payload.evaluationSnapshot.behaviorPoints[" + index + "].requiredEvidence[" + evidenceIndex + "]",
      ),
    );
    if (new Set(requiredEvidence).size !== requiredEvidence.length) {
      throw invalid(
        "payload.evaluationSnapshot.behaviorPoints[" + index + "].requiredEvidence",
        "evidence types must be unique",
      );
    }
    if (item.observability !== "INTERVIEW") {
      throw invalid(
        "payload.evaluationSnapshot.behaviorPoints[" + index + "].observability",
        "INTERVIEW is required",
      );
    }
    return {
      behaviorPointId: requiredText(
        item.behaviorPointId,
        "payload.evaluationSnapshot.behaviorPoints[" + index + "].behaviorPointId",
      ),
      description: requiredText(
        item.description,
        "payload.evaluationSnapshot.behaviorPoints[" + index + "].description",
      ),
      sourceElementCodes: sourceCodes,
      observability: "INTERVIEW" as const,
      requiredEvidence,
    };
  });

  const ids = points.map((point) => point.behaviorPointId);
  if (new Set(ids).size !== ids.length) {
    throw invalid("payload.evaluationSnapshot.behaviorPoints", "behaviorPointId must be unique");
  }
  return points;
}

function parseEvaluationPolicy(value: unknown): NcsEvaluationInput["evaluationPolicy"] {
  const policy = requiredObject(value, "payload.evaluationSnapshot.evaluationPolicy");
  const scoreMap = requiredObject(policy.scoreMap, "payload.evaluationSnapshot.evaluationPolicy.scoreMap");
  for (const [level, expected] of Object.entries(NCS_SCORE_MAP)) {
    if (scoreMap[level] !== expected) {
      throw invalid("payload.evaluationSnapshot.evaluationPolicy.scoreMap." + level, "must equal " + expected);
    }
  }
  if (policy.insufficientEvidenceScore !== null) {
    throw invalid("payload.evaluationSnapshot.evaluationPolicy.insufficientEvidenceScore", "null is required");
  }
  if (policy.allowSensitiveAttributes !== false || policy.allowNonverbalScore !== false) {
    throw invalid(
      "payload.evaluationSnapshot.evaluationPolicy",
      "sensitive attributes and nonverbal scoring must remain disabled",
    );
  }

  return {
    scoreMap: {
      "1": 25,
      "2": 50,
      "3": 70,
      "4": 85,
      "5": 100,
    },
    minimumSupportingEvidence: positiveInteger(
      policy.minimumSupportingEvidence,
      "payload.evaluationSnapshot.evaluationPolicy.minimumSupportingEvidence",
    ),
    insufficientEvidenceScore: null,
    allowSensitiveAttributes: false,
    allowNonverbalScore: false,
  };
}

function toEvaluationInput(parsed: ParsedNcsEvaluationPayload): NcsEvaluationInput {
  const snapshot = parsed.evaluationSnapshot;
  const transcriptHash = createHash("sha256").update(parsed.transcript).digest("hex").slice(0, 16);
  const answerIdentity = parsed.answerId === undefined ? "text-" + transcriptHash : String(parsed.answerId);
  const followUpsUsed = snapshot.question.questionType === "FOLLOW_UP" ? 1 : 0;

  return {
    contractVersion: NCS_EVALUATION_CONTRACT_VERSION,
    caseId: ["product", parsed.sessionId, parsed.questionId, answerIdentity, snapshot.snapshotVersion].join(":"),
    locale: snapshot.locale,
    question: snapshot.question,
    answer: {
      answerId: answerIdentity,
      transcript: parsed.transcript,
    },
    ncsContext: snapshot.ncsContext,
    behaviorPoints: snapshot.behaviorPoints,
    interviewContext: {
      attemptNumber: followUpsUsed + 1,
      maxFollowUps: 1,
      followUpsUsed,
    },
    evaluationPolicy: snapshot.evaluationPolicy,
  };
}

function toProductOutput(
  parsed: ParsedNcsEvaluationPayload,
  evaluated: NcsEvaluationOutput,
): NcsEvaluationProductOutput {
  const evidences = evaluated.evidences.map(({ source: _source, ...evidence }) => evidence);
  const followUp = toProductFollowUp(parsed, evaluated);
  const evidenceText = evidences.map((evidence) => evidence.quote).join("\n");
  const decisionText = JSON.stringify({
    behaviorEvaluations: evaluated.behaviorEvaluations,
    followUp,
  });

  return {
    contractVersion: NCS_EVALUATION_PRODUCT_CONTRACT_VERSION,
    evaluationSnapshotVersion: parsed.evaluationSnapshot.snapshotVersion,
    sessionId: parsed.sessionId,
    questionId: parsed.questionId,
    ...(parsed.answerId !== undefined ? { answerId: parsed.answerId } : {}),
    evaluationBasis: toEvaluationBasis(parsed.evaluationSnapshot),
    evidences,
    behaviorEvaluations: evaluated.behaviorEvaluations,
    coverage: evaluated.coverage,
    followUp,
    guardrail: {
      unsupportedFactDetected: evaluated.guardrail.unsupportedFactDetected,
      sensitiveAttributeUsed: evaluated.guardrail.sensitiveAttributeUsed || SENSITIVE_ATTRIBUTE_PATTERN.test(evidenceText),
      nonverbalSignalUsed: evaluated.guardrail.nonverbalSignalUsed || NONVERBAL_SIGNAL_PATTERN.test(evidenceText),
      hiringDecisionLanguageDetected:
        evaluated.guardrail.hiringDecisionLanguageDetected || HIRING_DECISION_PATTERN.test(decisionText),
    },
    metadata: {
      strategyId: evaluated.metadata.strategyId,
      strategyVersion: evaluated.metadata.promptVersion,
      model: evaluated.metadata.model,
    },
  };
}

function toProductFollowUp(
  parsed: ParsedNcsEvaluationPayload,
  evaluated: NcsEvaluationOutput,
): NcsEvaluationOutput["followUp"] {
  const missingEvidence = EVIDENCE_TYPES.filter((type) =>
    evaluated.behaviorEvaluations.some((evaluation) => evaluation.missingEvidence.includes(type)),
  );
  const required = missingEvidence.length > 0 && parsed.evaluationSnapshot.question.questionType !== "FOLLOW_UP";
  const roleOrUnitName = parsed.evaluationSnapshot.jobRole ?? parsed.evaluationSnapshot.ncsContext.unit.name;
  const roleDomainRelevant = isJobRoleDomainRelevant(roleOrUnitName, parsed.transcript);

  return {
    required,
    reason: required ? "필수 행동 근거가 부족해 한 차례 추가 확인이 필요합니다." : null,
    missingEvidence,
    suggestedQuestion: required
      ? productFollowUpQuestion(parsed.evaluationSnapshot.jobRole, missingEvidence, roleDomainRelevant)
      : null,
  };
}

function productFollowUpQuestion(
  jobRole: string | null,
  missingEvidence: NcsEvidenceType[],
  roleDomainRelevant: boolean,
): string {
  if (!roleDomainRelevant && jobRole) {
    const context = JOB_ROLE_INTERVIEW_CONTEXTS.find((candidate) => candidate.role.test(jobRole))?.context
      ?? "선택한 직무의 실제 업무";
    return `${jobRole}로서 직접 해결한 ${context} 문제를 하나 말씀해 주세요. 당시 어떤 대안을 비교해 무엇을 직접 적용했고, 결과를 어떤 지표나 현상으로 확인했나요?`;
  }

  const missing = new Set(missingEvidence);
  const questions: string[] = [];
  if (hasAnyMissing(missing, ["SITUATION", "TASK", "ACTION"])) {
    questions.push("당시 어떤 문제가 있었고, 그 과정에서 맡아 직접 수행한 일은 무엇이었나요?");
  }
  if (hasAnyMissing(missing, ["RATIONALE", "TRADEOFF", "CONSTRAINT"])) {
    questions.push("함께 검토한 다른 대안과 제약은 무엇이었고, 어떤 기준으로 최종 방식을 선택했나요?");
  }
  if (missing.has("RESULT")) {
    questions.push("적용 전후 어떤 지표나 현상으로 효과를 확인했나요?");
  }
  if (missing.has("REFLECTION")) {
    questions.push("이 경험 이후 다음 업무 방식이나 재발 방지 조치가 어떻게 달라졌나요?");
  }
  if (missing.has("KNOWLEDGE") && questions.length === 0) {
    questions.push("그 판단에 활용한 기술 지식이나 원리를 실제 결정과 연결해 설명해 주시겠어요?");
  }
  return questions.join(" ") || "당시 본인이 내린 판단과 직접 수행한 행동을 구체적인 결과와 함께 설명해 주시겠어요?";
}

function hasAnyMissing(missing: Set<NcsEvidenceType>, targets: NcsEvidenceType[]): boolean {
  return targets.some((target) => missing.has(target));
}

function assertProductOutputInvariants(
  output: NcsEvaluationProductOutput,
  transcript: string,
  snapshot: NcsEvaluationProductSnapshot,
): void {
  const expectedBehaviorPointIds = new Set(snapshot.behaviorPoints.map((point) => point.behaviorPointId));
  const evidenceIds = new Set<string>();

  if (JSON.stringify(output.evaluationBasis) !== JSON.stringify(toEvaluationBasis(snapshot))) {
    throw invalid("output.evaluationBasis", "must be copied from the immutable evaluation snapshot");
  }

  for (const evidence of output.evidences) {
    if (evidenceIds.has(evidence.evidenceId)) {
      throw invalid("output.evidences", "evidenceId must be unique");
    }
    evidenceIds.add(evidence.evidenceId);
    if (evidence.quote !== transcript.slice(evidence.startChar, evidence.endChar)) {
      throw invalid("output.evidences." + evidence.evidenceId, "quote must match transcript offsets");
    }
    if (evidence.behaviorPointIds.some((id) => !expectedBehaviorPointIds.has(id))) {
      throw invalid("output.evidences." + evidence.evidenceId, "unknown behaviorPointId");
    }
  }

  if (output.behaviorEvaluations.length !== expectedBehaviorPointIds.size) {
    throw invalid("output.behaviorEvaluations", "must contain one result per behavior point");
  }
  for (const evaluation of output.behaviorEvaluations) {
    if (!expectedBehaviorPointIds.has(evaluation.behaviorPointId)) {
      throw invalid("output.behaviorEvaluations", "unknown behaviorPointId " + evaluation.behaviorPointId);
    }
    const referencedEvidenceIds = [
      ...evaluation.supportingEvidenceIds,
      ...evaluation.contradictingEvidenceIds,
    ];
    if (referencedEvidenceIds.some((id) => !evidenceIds.has(id))) {
      throw invalid("output.behaviorEvaluations." + evaluation.behaviorPointId, "unknown evidence reference");
    }
    if (evaluation.status === "INSUFFICIENT_EVIDENCE") {
      if (evaluation.level !== null || evaluation.score !== null) {
        throw invalid(
          "output.behaviorEvaluations." + evaluation.behaviorPointId,
          "insufficient evidence must have null level and score",
        );
      }
      continue;
    }
    if (evaluation.level === null || evaluation.score !== NCS_SCORE_MAP[evaluation.level]) {
      throw invalid("output.behaviorEvaluations." + evaluation.behaviorPointId, "score must match the fixed level map");
    }
  }

  if (
    output.coverage.assessableBehaviorPointCount !== expectedBehaviorPointIds.size ||
    output.coverage.evaluatedBehaviorPointCount > output.coverage.assessableBehaviorPointCount ||
    !Number.isFinite(output.coverage.ratio)
  ) {
    throw invalid("output.coverage", "coverage counts are inconsistent");
  }

  if (new Set(output.followUp.missingEvidence).size !== output.followUp.missingEvidence.length) {
    throw invalid("output.followUp.missingEvidence", "values must be unique");
  }
  if (output.followUp.required && (!output.followUp.reason || !output.followUp.suggestedQuestion)) {
    throw invalid("output.followUp", "required follow-up must include a reason and suggested question");
  }
}

function toEvaluationBasis(snapshot: NcsEvaluationProductSnapshot): NcsEvaluationBasis {
  return {
    sourceKind: snapshot.ncsContext.sourceKind,
    sourceVersion: snapshot.ncsContext.version,
    categoryType: snapshot.ncsContext.categoryType,
    jobRole: snapshot.jobRole,
    unit: {
      code: snapshot.ncsContext.unit.code,
      name: snapshot.ncsContext.unit.name,
      level: snapshot.ncsContext.unit.level,
      definition: snapshot.ncsContext.unit.definition,
    },
    behaviorPoints: snapshot.behaviorPoints.map((point) => ({
      behaviorPointId: point.behaviorPointId,
      description: point.description,
      sourceElementCodes: [...point.sourceElementCodes],
      requiredEvidence: [...point.requiredEvidence],
    })),
  };
}

function canonicalTranscript(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalid("payload.transcript", "non-empty transcript is required");
  }
  if (value !== value.trim()) {
    throw invalid("payload.transcript", "canonical transcript must be trimmed by the API");
  }
  return value;
}

function requiredObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalid(field, "object is required");
  }
  return value as Record<string, unknown>;
}

function requiredNonEmptyArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw invalid(field, "non-empty array is required");
  }
  return value;
}

function requiredStringArray(value: unknown, field: string): string[] {
  const values = requiredNonEmptyArray(value, field).map((item, index) => requiredText(item, field + "[" + index + "]"));
  if (new Set(values).size !== values.length) {
    throw invalid(field, "values must be unique");
  }
  return values;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalid(field, "non-empty string is required");
  }
  return value;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw invalid(field, "positive integer is required");
  }
  return Number(value);
}

function optionalPositiveInteger(value: unknown, field: string): number | undefined {
  return value === undefined ? undefined : positiveInteger(value, field);
}

function optionalJobRole(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  const jobRole = requiredText(value, field).trim();
  if (jobRole.length > 80) throw invalid(field, "must contain at most 80 characters");
  return jobRole;
}

function oneOf<T extends string>(value: unknown, choices: readonly T[], field: string): T {
  if (typeof value !== "string" || !choices.includes(value as T)) {
    throw invalid(field, "must be one of " + choices.join(", "));
  }
  return value as T;
}

function invalid(field: string, reason: string): NonRetryableAiWorkerFailure {
  return new NonRetryableAiWorkerFailure(field + ": " + reason);
}
