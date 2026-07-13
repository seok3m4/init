import {
  TALENT_RUBRIC_CONTRACT_VERSION,
  type TalentEvidenceType,
  type TalentProhibitedSignalCategory,
  type TalentRubricSnapshot,
} from "./types";
import { TALENT_PROFILE_MAX_ITEMS, TALENT_PROFILE_MIN_ITEMS } from "./validation";

const REQUIRED_EVIDENCE: readonly TalentEvidenceType[] = [
  "ACTION",
  "RATIONALE",
  "RESULT",
  "REFLECTION",
];
const PROHIBITED_SIGNAL_CATEGORIES: readonly TalentProhibitedSignalCategory[] = [
  "SENSITIVE_ATTRIBUTE",
  "NONVERBAL_SIGNAL",
];

export class TalentRubricSnapshotValidationError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(`${field}: ${message}`);
    this.name = "TalentRubricSnapshotValidationError";
  }
}

export function validateTalentRubricSnapshot(value: unknown): TalentRubricSnapshot {
  const snapshot = requireRecord(value, "snapshot");
  requireExact(snapshot.contractVersion, TALENT_RUBRIC_CONTRACT_VERSION, "contractVersion");
  requireNonEmptyString(snapshot.rubricVersion, "rubricVersion");
  requireMatchingString(snapshot.sourceHash, /^sha256:[0-9a-f]{64}$/u, "sourceHash");

  const criteria = requireArray(snapshot.criteria, "criteria");
  if (criteria.length < TALENT_PROFILE_MIN_ITEMS || criteria.length > TALENT_PROFILE_MAX_ITEMS) {
    fail("criteria", `must contain ${TALENT_PROFILE_MIN_ITEMS} to ${TALENT_PROFILE_MAX_ITEMS} items`);
  }

  const criterionIds = new Set<string>();
  const criterionNames = new Set<string>();
  const indicatorIds = new Set<string>();
  let totalWeight = 0;
  criteria.forEach((candidate, criterionIndex) => {
    const field = `criteria[${criterionIndex}]`;
    const criterion = requireRecord(candidate, field);
    const criterionId = requireUniqueString(criterion.id, `${field}.id`, criterionIds);
    const criterionName = requireNonEmptyString(criterion.name, `${field}.name`);
    const normalizedName = criterionName.normalize("NFKC").toLocaleLowerCase("ko-KR");
    if (criterionNames.has(normalizedName)) fail(`${field}.name`, "must be unique after normalization");
    criterionNames.add(normalizedName);
    requireNonEmptyString(criterion.definition, `${field}.definition`);

    if (!Number.isInteger(criterion.weight) || (criterion.weight as number) < 1 || (criterion.weight as number) > 100) {
      fail(`${field}.weight`, "must be an integer between 1 and 100");
    }
    totalWeight += criterion.weight as number;

    const indicators = requireArray(criterion.behaviorIndicators, `${field}.behaviorIndicators`);
    if (indicators.length !== REQUIRED_EVIDENCE.length) {
      fail(`${field}.behaviorIndicators`, `must contain ${REQUIRED_EVIDENCE.length} items`);
    }
    indicators.forEach((indicatorCandidate, indicatorIndex) => {
      const indicatorField = `${field}.behaviorIndicators[${indicatorIndex}]`;
      const indicator = requireRecord(indicatorCandidate, indicatorField);
      const indicatorId = requireUniqueString(indicator.id, `${indicatorField}.id`, indicatorIds);
      if (indicatorId === criterionId) fail(`${indicatorField}.id`, "must differ from criterion id");
      requireExact(indicator.evidenceType, REQUIRED_EVIDENCE[indicatorIndex], `${indicatorField}.evidenceType`);
      requireExact(indicator.observability, "ANSWER_TRANSCRIPT", `${indicatorField}.observability`);
      requireNonEmptyString(indicator.description, `${indicatorField}.description`);
    });

    requireExactStringArray(criterion.requiredEvidence, REQUIRED_EVIDENCE, `${field}.requiredEvidence`);

    const anchors = requireArray(criterion.scoringAnchors, `${field}.scoringAnchors`);
    if (anchors.length !== 5) fail(`${field}.scoringAnchors`, "must contain levels 1 through 5");
    anchors.forEach((anchorCandidate, anchorIndex) => {
      const anchorField = `${field}.scoringAnchors[${anchorIndex}]`;
      const anchor = requireRecord(anchorCandidate, anchorField);
      const expectedLevel = anchorIndex + 1;
      requireExact(anchor.level, expectedLevel, `${anchorField}.level`);
      requireExact(anchor.evidenceStrength, expectedLevel, `${anchorField}.evidenceStrength`);
      requireNonEmptyString(anchor.label, `${anchorField}.label`);
      requireNonEmptyString(anchor.description, `${anchorField}.description`);
    });
  });
  if (totalWeight !== 100) fail("criteria", "weights must sum to 100");

  const evidencePolicy = requireRecord(snapshot.evidencePolicy, "evidencePolicy");
  requireExact(evidencePolicy.source, "ANSWER_TRANSCRIPT", "evidencePolicy.source");
  requireExact(evidencePolicy.requiredEvidenceRule, "ALL_REQUIRED", "evidencePolicy.requiredEvidenceRule");
  requireExact(
    evidencePolicy.missingRequiredEvidenceStatus,
    "INSUFFICIENT_EVIDENCE",
    "evidencePolicy.missingRequiredEvidenceStatus",
  );
  requireExact(evidencePolicy.insufficientEvidenceScore, null, "evidencePolicy.insufficientEvidenceScore");

  const prohibitedSignals = requireArray(snapshot.prohibitedSignals, "prohibitedSignals");
  if (prohibitedSignals.length !== PROHIBITED_SIGNAL_CATEGORIES.length) {
    fail("prohibitedSignals", `must contain ${PROHIBITED_SIGNAL_CATEGORIES.length} categories`);
  }
  prohibitedSignals.forEach((candidate, index) => {
    const field = `prohibitedSignals[${index}]`;
    const signal = requireRecord(candidate, field);
    requireExact(signal.category, PROHIBITED_SIGNAL_CATEGORIES[index], `${field}.category`);
    requireUniqueStringArray(signal.signals, `${field}.signals`, false);
    requireUniqueStringArray(signal.detectedInSource, `${field}.detectedInSource`, true);
    requireExact(signal.disposition, "EXCLUDE_FROM_SCORING", `${field}.disposition`);
  });

  return value as TalentRubricSnapshot;
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(field, "must be an object");
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) fail(field, "must be an array");
  return value;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) fail(field, "must be a non-empty string");
  return value;
}

function requireMatchingString(value: unknown, pattern: RegExp, field: string): string {
  const text = requireNonEmptyString(value, field);
  if (!pattern.test(text)) fail(field, "has an invalid format");
  return text;
}

function requireUniqueString(value: unknown, field: string, seen: Set<string>): string {
  const text = requireNonEmptyString(value, field);
  if (seen.has(text)) fail(field, "must be unique");
  seen.add(text);
  return text;
}

function requireExactStringArray(
  value: unknown,
  expected: readonly string[],
  field: string,
): void {
  const actual = requireArray(value, field);
  if (actual.length !== expected.length) fail(field, `must contain ${expected.join(", ")} in order`);
  expected.forEach((item, index) => requireExact(actual[index], item, `${field}[${index}]`));
}

function requireUniqueStringArray(value: unknown, field: string, allowEmpty: boolean): void {
  const items = requireArray(value, field);
  if (!allowEmpty && items.length === 0) fail(field, "must not be empty");
  const seen = new Set<string>();
  items.forEach((item, index) => requireUniqueString(item, `${field}[${index}]`, seen));
}

function requireExact(value: unknown, expected: unknown, field: string): void {
  if (value !== expected) fail(field, `must equal ${String(expected)}`);
}

function fail(field: string, message: string): never {
  throw new TalentRubricSnapshotValidationError(field, message);
}
