import { createHash } from 'node:crypto';
import {
  parseNcsEvaluationSnapshot,
  type NcsEvaluationSnapshot,
} from '../interview/ncs-evaluation/ncs-evaluation-snapshot';
import type {
  HiringEvaluationContextSnapshotJson,
  HiringQuestionSnapshotItem,
  TalentRubricSnapshotJson,
} from './company-interview.types';

const REQUIRED_EVIDENCE = ['ACTION', 'RATIONALE', 'RESULT', 'REFLECTION'] as const;
const PROHIBITED_CATEGORIES = ['SENSITIVE_ATTRIBUTE', 'NONVERBAL_SIGNAL'] as const;

export class HiringEvaluationContextValidationError extends Error {
  constructor(
    readonly field: string,
    readonly reason: string,
  ) {
    super(`${field}: ${reason}`);
    this.name = 'HiringEvaluationContextValidationError';
  }
}

export type HiringEvaluationContextHashInput = Omit<
  HiringEvaluationContextSnapshotJson,
  'contextVersion' | 'contextHash'
>;

export function validateTalentRubricSnapshotJson(
  value: unknown,
): TalentRubricSnapshotJson {
  const rubric = recordOf(value, 'talentRubric');
  exact(rubric.contractVersion, 'talent-rubric-snapshot.v1', 'talentRubric.contractVersion');
  textOf(rubric.rubricVersion, 'talentRubric.rubricVersion');
  hashOf(rubric.sourceHash, 'talentRubric.sourceHash');

  const criteria = arrayOf(rubric.criteria, 'talentRubric.criteria');
  if (criteria.length < 1 || criteria.length > 6) invalid('talentRubric.criteria', 'ITEM_COUNT_OUT_OF_RANGE');
  const criterionIds = new Set<string>();
  const criterionNames = new Set<string>();
  const indicatorIds = new Set<string>();
  let totalWeight = 0;
  criteria.forEach((candidate, criterionIndex) => {
    const field = `talentRubric.criteria[${criterionIndex}]`;
    const criterion = recordOf(candidate, field);
    const criterionId = uniqueText(criterion.id, `${field}.id`, criterionIds);
    const name = textOf(criterion.name, `${field}.name`);
    const normalizedName = name.normalize('NFKC').toLocaleLowerCase('ko-KR');
    if (criterionNames.has(normalizedName)) invalid(`${field}.name`, 'DUPLICATED');
    criterionNames.add(normalizedName);
    textOf(criterion.definition, `${field}.definition`);
    const weight = integerInRange(criterion.weight, 1, 100, `${field}.weight`);
    totalWeight += weight;

    const indicators = arrayOf(criterion.behaviorIndicators, `${field}.behaviorIndicators`);
    if (indicators.length !== 4) invalid(`${field}.behaviorIndicators`, 'INVALID_ITEM_COUNT');
    indicators.forEach((indicatorCandidate, indicatorIndex) => {
      const indicatorField = `${field}.behaviorIndicators[${indicatorIndex}]`;
      const indicator = recordOf(indicatorCandidate, indicatorField);
      const indicatorId = uniqueText(indicator.id, `${indicatorField}.id`, indicatorIds);
      if (indicatorId === criterionId) invalid(`${indicatorField}.id`, 'MUST_DIFFER_FROM_CRITERION_ID');
      exact(indicator.evidenceType, REQUIRED_EVIDENCE[indicatorIndex], `${indicatorField}.evidenceType`);
      exact(indicator.observability, 'ANSWER_TRANSCRIPT', `${indicatorField}.observability`);
      textOf(indicator.description, `${indicatorField}.description`);
    });
    exactStringArray(criterion.requiredEvidence, REQUIRED_EVIDENCE, `${field}.requiredEvidence`);

    const anchors = arrayOf(criterion.scoringAnchors, `${field}.scoringAnchors`);
    if (anchors.length !== 5) invalid(`${field}.scoringAnchors`, 'INVALID_ITEM_COUNT');
    anchors.forEach((anchorCandidate, anchorIndex) => {
      const anchorField = `${field}.scoringAnchors[${anchorIndex}]`;
      const anchor = recordOf(anchorCandidate, anchorField);
      exact(anchor.level, anchorIndex + 1, `${anchorField}.level`);
      exact(anchor.evidenceStrength, anchorIndex + 1, `${anchorField}.evidenceStrength`);
      textOf(anchor.label, `${anchorField}.label`);
      textOf(anchor.description, `${anchorField}.description`);
    });
  });
  if (totalWeight !== 100) invalid('talentRubric.criteria', 'WEIGHT_SUM_MUST_EQUAL_100');

  const evidencePolicy = recordOf(rubric.evidencePolicy, 'talentRubric.evidencePolicy');
  exact(evidencePolicy.source, 'ANSWER_TRANSCRIPT', 'talentRubric.evidencePolicy.source');
  exact(evidencePolicy.requiredEvidenceRule, 'ALL_REQUIRED', 'talentRubric.evidencePolicy.requiredEvidenceRule');
  exact(
    evidencePolicy.missingRequiredEvidenceStatus,
    'INSUFFICIENT_EVIDENCE',
    'talentRubric.evidencePolicy.missingRequiredEvidenceStatus',
  );
  exact(evidencePolicy.insufficientEvidenceScore, null, 'talentRubric.evidencePolicy.insufficientEvidenceScore');

  const prohibitedSignals = arrayOf(rubric.prohibitedSignals, 'talentRubric.prohibitedSignals');
  if (prohibitedSignals.length !== 2) invalid('talentRubric.prohibitedSignals', 'INVALID_ITEM_COUNT');
  prohibitedSignals.forEach((candidate, index) => {
    const field = `talentRubric.prohibitedSignals[${index}]`;
    const signal = recordOf(candidate, field);
    exact(signal.category, PROHIBITED_CATEGORIES[index], `${field}.category`);
    uniqueTextArray(signal.signals, `${field}.signals`, false);
    uniqueTextArray(signal.detectedInSource, `${field}.detectedInSource`, true);
    exact(signal.disposition, 'EXCLUDE_FROM_SCORING', `${field}.disposition`);
  });
  return JSON.parse(JSON.stringify(value)) as TalentRubricSnapshotJson;
}

export function bindNcsSnapshotToHiringQuestion(
  snapshot: NcsEvaluationSnapshot,
  question: HiringQuestionSnapshotItem,
  jobRole: string,
): NcsEvaluationSnapshot {
  if (!['TECHNICAL', 'EXPERIENCE', 'SITUATION'].includes(question.questionType)) {
    invalid('question.questionType', 'NCS_SNAPSHOT_UNAVAILABLE');
  }
  const { snapshotVersion: _sourceVersion, ...source } = snapshot;
  const boundWithoutVersion = {
    ...source,
    jobRole,
    question: {
      ...source.question,
      questionId: String(question.questionId),
      content: question.content,
    },
  };
  const bound = {
    ...boundWithoutVersion,
    snapshotVersion: `hiring-ncs-context-v1:${sha256(stableJson(boundWithoutVersion)).slice(0, 16)}`,
  };
  const parsed = parseNcsEvaluationSnapshot(bound);
  if (!parsed) invalid('question.ncsEvaluationSnapshot', 'INVALID_NCS_SNAPSHOT');
  return parsed;
}

export function createHiringEvaluationContextHash(
  input: HiringEvaluationContextHashInput,
): string {
  return `sha256:${sha256(stableJson(input))}`;
}

export function parseHiringEvaluationContextSnapshot(
  value: unknown,
): HiringEvaluationContextSnapshotJson | undefined {
  try {
    const context = recordOf(value, 'context');
    exact(context.schemaVersion, 'hiring-evaluation-context.v1', 'context.schemaVersion');
    textOf(context.contextVersion, 'context.contextVersion');
    hashOf(context.contextHash, 'context.contextHash');
    exact(context.calculationContractVersion, 'hiring-evaluation.v1', 'context.calculationContractVersion');
    const talentRubric = validateTalentRubricSnapshotJson(context.talentRubric);
    const typed = { ...context, talentRubric } as unknown as HiringEvaluationContextSnapshotJson;
    const { contextVersion: _contextVersion, contextHash: _contextHash, ...hashInput } = typed;
    if (typed.contextHash !== createHiringEvaluationContextHash(hashInput)) return undefined;
    return typed;
  } catch {
    return undefined;
  }
}

export function sameCanonicalValue(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => [key, sortValue(item)]),
  );
}

function recordOf(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(field, 'OBJECT_REQUIRED');
  return value as Record<string, unknown>;
}

function arrayOf(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) invalid(field, 'ARRAY_REQUIRED');
  return value;
}

function textOf(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) invalid(field, 'TEXT_REQUIRED');
  return value;
}

function hashOf(value: unknown, field: string): string {
  const hash = textOf(value, field);
  if (!/^sha256:[0-9a-f]{64}$/u.test(hash)) invalid(field, 'INVALID_HASH');
  return hash;
}

function uniqueText(value: unknown, field: string, seen: Set<string>): string {
  const text = textOf(value, field);
  if (seen.has(text)) invalid(field, 'DUPLICATED');
  seen.add(text);
  return text;
}

function exactStringArray(value: unknown, expected: readonly string[], field: string): void {
  const actual = arrayOf(value, field);
  if (actual.length !== expected.length) invalid(field, 'INVALID_ITEM_COUNT');
  expected.forEach((item, index) => exact(actual[index], item, `${field}[${index}]`));
}

function uniqueTextArray(value: unknown, field: string, allowEmpty: boolean): void {
  const values = arrayOf(value, field);
  if (!allowEmpty && values.length === 0) invalid(field, 'ARRAY_MIN_SIZE');
  const seen = new Set<string>();
  values.forEach((item, index) => uniqueText(item, `${field}[${index}]`, seen));
}

function integerInRange(value: unknown, minimum: number, maximum: number, field: string): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    invalid(field, 'OUT_OF_RANGE');
  }
  return Number(value);
}

function exact(value: unknown, expected: unknown, field: string): void {
  if (value !== expected) invalid(field, 'INVALID_VALUE');
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function invalid(field: string, reason: string): never {
  throw new HiringEvaluationContextValidationError(field, reason);
}
