const PRODUCT_CONTRACT_VERSION = "ncs-evaluation-product.v1";
const SCORE_BY_LEVEL: Record<number, number> = {
  1: 25,
  2: 50,
  3: 70,
  4: 85,
  5: 100,
};
const STATUS_BY_LEVEL: Record<number, string> = {
  1: "NOT_DEMONSTRATED",
  2: "LIMITED",
  3: "DEVELOPING",
  4: "DEMONSTRATED",
  5: "STRONGLY_DEMONSTRATED",
};
const EVIDENCE_TYPES = new Set([
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
const SENSITIVE_ATTRIBUTE_PATTERN =
  /(?:제\s*이름은|저는\s*(?:여성|남성)|나이는?\s*\d+\s*살|대학교\s*출신|출신\s*학교|출신지는?|장애인|신체\s*장애|건강\s*상태)/iu;
const NONVERBAL_SIGNAL_PATTERN = /(?:표정|시선|눈\s*맞춤|아이\s*컨택|억양|말\s*속도|목소리\s*톤)/iu;
const HIRING_DECISION_PATTERN = /(?:합격|불합격|탈락|채용\s*적합|채용\s*부적합|선별|hiring decision|pass\/fail)/iu;

interface NcsEvaluationInputContext {
  sessionId: number;
  questionId: number;
  answerId?: number;
  transcript: string;
  snapshotVersion: string;
  behaviorPointIds: Set<string>;
}

export function parseNcsEvaluationJobOutput(
  output: unknown,
  inputRef?: string | null,
): Record<string, unknown> | undefined {
  if (!isRecord(output) || output.contractVersion !== PRODUCT_CONTRACT_VERSION) {
    return undefined;
  }
  const context = parseInputContext(inputRef);
  if (!context || !hasMatchingIdentity(output, context)) {
    return undefined;
  }

  const evidences = parseEvidences(output.evidences, context);
  if (!evidences) {
    return undefined;
  }
  const behaviorEvaluations = parseBehaviorEvaluations(
    output.behaviorEvaluations,
    context.behaviorPointIds,
    evidences,
  );
  if (!behaviorEvaluations) {
    return undefined;
  }
  if (!validCoverage(output.coverage, context.behaviorPointIds.size, behaviorEvaluations.evaluatedCount)) {
    return undefined;
  }
  if (!validFollowUp(output.followUp) || !validGuardrail(output.guardrail) || !validMetadata(output.metadata)) {
    return undefined;
  }

  return output;
}

function parseInputContext(inputRef?: string | null): NcsEvaluationInputContext | undefined {
  if (!inputRef) {
    return undefined;
  }
  try {
    const input = JSON.parse(inputRef) as unknown;
    if (!isRecord(input) || input.kind !== "MOCK_NCS_ANSWER_EVALUATION") {
      return undefined;
    }
    const payload = isRecord(input.payload) ? input.payload : undefined;
    const snapshot = payload && isRecord(payload.evaluationSnapshot) ? payload.evaluationSnapshot : undefined;
    const question = snapshot && isRecord(snapshot.question) ? snapshot.question : undefined;
    const policy = snapshot && isRecord(snapshot.evaluationPolicy) ? snapshot.evaluationPolicy : undefined;
    const scoreMap = policy && isRecord(policy.scoreMap) ? policy.scoreMap : undefined;
    if (
      !payload ||
      payload.step !== "NCS_ANSWER_EVALUATION" ||
      !snapshot ||
      snapshot.contractVersion !== PRODUCT_CONTRACT_VERSION ||
      !question ||
      !policy ||
      !scoreMap
    ) {
      return undefined;
    }

    const sessionId = positiveInteger(payload.sessionId);
    const questionId = positiveInteger(payload.questionId);
    const hasAnswerId = Object.hasOwn(payload, "answerId");
    const answerId = hasAnswerId ? positiveInteger(payload.answerId) : undefined;
    const transcript = nonEmptyText(payload.transcript);
    const snapshotVersion = nonEmptyText(snapshot.snapshotVersion);
    if (
      !sessionId ||
      !questionId ||
      (hasAnswerId && answerId === undefined) ||
      !transcript ||
      transcript !== transcript.trim() ||
      !snapshotVersion ||
      question.questionId !== String(questionId) ||
      !validInputPolicy(policy, scoreMap)
    ) {
      return undefined;
    }

    const behaviorPointIds = behaviorPointIdsFromSnapshot(snapshot.behaviorPoints);
    if (!behaviorPointIds) {
      return undefined;
    }
    return {
      sessionId,
      questionId,
      ...(answerId !== undefined ? { answerId } : {}),
      transcript,
      snapshotVersion,
      behaviorPointIds,
    };
  } catch {
    return undefined;
  }
}

function validInputPolicy(
  policy: Record<string, unknown>,
  scoreMap: Record<string, unknown>,
): boolean {
  return (
    scoreMap["1"] === 25 &&
    scoreMap["2"] === 50 &&
    scoreMap["3"] === 70 &&
    scoreMap["4"] === 85 &&
    scoreMap["5"] === 100 &&
    positiveInteger(policy.minimumSupportingEvidence) !== undefined &&
    policy.insufficientEvidenceScore === null &&
    policy.allowSensitiveAttributes === false &&
    policy.allowNonverbalScore === false
  );
}

function behaviorPointIdsFromSnapshot(value: unknown): Set<string> | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  const ids = value.map((point) => (isRecord(point) ? nonEmptyText(point.behaviorPointId) : undefined));
  if (ids.some((id) => !id)) {
    return undefined;
  }
  const uniqueIds = new Set(ids as string[]);
  return uniqueIds.size === ids.length ? uniqueIds : undefined;
}

function hasMatchingIdentity(output: Record<string, unknown>, context: NcsEvaluationInputContext): boolean {
  if (
    output.evaluationSnapshotVersion !== context.snapshotVersion ||
    output.sessionId !== context.sessionId ||
    output.questionId !== context.questionId
  ) {
    return false;
  }
  return context.answerId === undefined
    ? !Object.hasOwn(output, "answerId")
    : output.answerId === context.answerId;
}

function parseEvidences(
  value: unknown,
  context: NcsEvaluationInputContext,
): Map<string, Record<string, unknown>> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const evidences = new Map<string, Record<string, unknown>>();
  for (const item of value) {
    if (!isRecord(item)) {
      return undefined;
    }
    const evidenceId = nonEmptyText(item.evidenceId);
    const quote = nonEmptyText(item.quote);
    const startChar = nonNegativeInteger(item.startChar);
    const endChar = nonNegativeInteger(item.endChar);
    const behaviorPointIds = uniqueStringArray(item.behaviorPointIds, false);
    if (
      !evidenceId ||
      evidences.has(evidenceId) ||
      !quote ||
      startChar === undefined ||
      endChar === undefined ||
      endChar <= startChar ||
      quote !== context.transcript.slice(startChar, endChar) ||
      typeof item.claimType !== "string" ||
      !CLAIM_TYPES.has(item.claimType) ||
      !behaviorPointIds ||
      behaviorPointIds.some((id) => !context.behaviorPointIds.has(id)) ||
      SENSITIVE_ATTRIBUTE_PATTERN.test(quote) ||
      NONVERBAL_SIGNAL_PATTERN.test(quote)
    ) {
      return undefined;
    }
    evidences.set(evidenceId, item);
  }
  return evidences;
}

function parseBehaviorEvaluations(
  value: unknown,
  expectedBehaviorPointIds: Set<string>,
  evidences: Map<string, Record<string, unknown>>,
): { evaluatedCount: number } | undefined {
  if (!Array.isArray(value) || value.length !== expectedBehaviorPointIds.size) {
    return undefined;
  }

  const seen = new Set<string>();
  let evaluatedCount = 0;
  for (const item of value) {
    if (!isRecord(item)) {
      return undefined;
    }
    const behaviorPointId = nonEmptyText(item.behaviorPointId);
    const rationale = nonEmptyText(item.rationale);
    const supporting = uniqueStringArray(item.supportingEvidenceIds, true);
    const contradicting = uniqueStringArray(item.contradictingEvidenceIds, true);
    const missingEvidence = uniqueStringArray(item.missingEvidence, true);
    if (
      !behaviorPointId ||
      !expectedBehaviorPointIds.has(behaviorPointId) ||
      seen.has(behaviorPointId) ||
      !rationale ||
      HIRING_DECISION_PATTERN.test(rationale) ||
      !supporting ||
      !contradicting ||
      !missingEvidence ||
      missingEvidence.some((type) => !EVIDENCE_TYPES.has(type)) ||
      supporting.some((id) => !evidences.has(id)) ||
      contradicting.some((id) => !evidences.has(id)) ||
      supporting.some((id) => contradicting.includes(id)) ||
      !["HIGH", "MEDIUM", "LOW"].includes(String(item.confidence))
    ) {
      return undefined;
    }

    if (item.status === "INSUFFICIENT_EVIDENCE") {
      if (item.level !== null || item.score !== null) {
        return undefined;
      }
    } else {
      const level = positiveInteger(item.level);
      if (
        !level ||
        level > 5 ||
        item.score !== SCORE_BY_LEVEL[level] ||
        item.status !== STATUS_BY_LEVEL[level]
      ) {
        return undefined;
      }
      evaluatedCount += 1;
    }
    seen.add(behaviorPointId);
  }
  return seen.size === expectedBehaviorPointIds.size ? { evaluatedCount } : undefined;
}

function validCoverage(value: unknown, assessableCount: number, evaluatedCount: number): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const ratio = evaluatedCount / assessableCount;
  const expectedStatus = ratio === 0 ? "INSUFFICIENT" : ratio >= 0.8 ? "SUFFICIENT" : "LOW";
  return (
    value.assessableBehaviorPointCount === assessableCount &&
    value.evaluatedBehaviorPointCount === evaluatedCount &&
    typeof value.ratio === "number" &&
    Math.abs(value.ratio - ratio) < Number.EPSILON &&
    value.status === expectedStatus
  );
}

function validFollowUp(value: unknown): boolean {
  if (!isRecord(value) || typeof value.required !== "boolean") {
    return false;
  }
  const missingEvidence = uniqueStringArray(value.missingEvidence, true);
  if (!missingEvidence || missingEvidence.some((type) => !EVIDENCE_TYPES.has(type))) {
    return false;
  }
  if (value.required) {
    return Boolean(nonEmptyText(value.reason)) && Boolean(nonEmptyText(value.suggestedQuestion));
  }
  return value.reason === null && value.suggestedQuestion === null;
}

function validGuardrail(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.unsupportedFactDetected === false &&
    value.sensitiveAttributeUsed === false &&
    value.nonverbalSignalUsed === false &&
    value.hiringDecisionLanguageDetected === false
  );
}

function validMetadata(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.strategyId === "evidence-state" &&
    Boolean(nonEmptyText(value.strategyVersion)) &&
    Boolean(nonEmptyText(value.model))
  );
}

function uniqueStringArray(value: unknown, allowEmpty: boolean): string[] | undefined {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    return undefined;
  }
  const strings = value.map(nonEmptyText);
  if (strings.some((item) => !item)) {
    return undefined;
  }
  const result = strings as string[];
  return new Set(result).size === result.length ? result : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function nonEmptyText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
