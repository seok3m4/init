import { createHash } from "node:crypto";
import { NonRetryableAiWorkerFailure } from "../worker-errors";
import { validateTalentRubricSnapshot } from "../talent-rubric";
import {
  HIRING_CALCULATION_CONTRACT_VERSION,
  HIRING_EVALUATION_CONTEXT_VERSION,
  type HiringEvaluationContextHashInput,
  type HiringEvaluationContextSnapshot,
} from "./types";

export function createHiringEvaluationContextHash(
  input: HiringEvaluationContextHashInput,
): string {
  return `sha256:${createHash("sha256").update(stableJson(input), "utf8").digest("hex")}`;
}

export function validateHiringEvaluationContext(value: unknown): HiringEvaluationContextSnapshot {
  const context = recordOf(value, "context");
  exact(context.schemaVersion, HIRING_EVALUATION_CONTEXT_VERSION, "context.schemaVersion");
  textOf(context.contextVersion, "context.contextVersion");
  hashOf(context.contextHash, "context.contextHash");
  exact(
    context.calculationContractVersion,
    HIRING_CALCULATION_CONTRACT_VERSION,
    "context.calculationContractVersion",
  );

  const cohort = recordOf(context.cohort, "context.cohort");
  positiveInteger(cohort.cohortId, "context.cohort.cohortId");
  positiveInteger(cohort.companyId, "context.cohort.companyId");
  positiveInteger(cohort.postingId, "context.cohort.postingId");
  hashOf(cohort.configurationHash, "context.cohort.configurationHash");

  const source = recordOf(context.sourceConfiguration, "context.sourceConfiguration");
  positiveInteger(source.policyId, "context.sourceConfiguration.policyId");
  textOf(source.policyVersion, "context.sourceConfiguration.policyVersion");
  positiveInteger(source.questionSetSnapshotId, "context.sourceConfiguration.questionSetSnapshotId");
  textOf(source.questionSetSnapshotVersion, "context.sourceConfiguration.questionSetSnapshotVersion");

  validatePolicy(context.policy, Number(cohort.postingId));
  const questionSet = recordOf(context.questionSet, "context.questionSet");
  positiveInteger(questionSet.sourceQuestionSetId, "context.questionSet.sourceQuestionSetId");
  const jobRole = textOf(questionSet.jobRole, "context.questionSet.jobRole");
  oneOf(questionSet.mode, ["QUICK", "STANDARD", "DEEP", "CUSTOM"], "context.questionSet.mode");
  const questionCount = positiveInteger(questionSet.questionCount, "context.questionSet.questionCount");
  nonNegativeInteger(questionSet.maxFollowUpCount, "context.questionSet.maxFollowUpCount");

  if (!Array.isArray(questionSet.questions) || questionSet.questions.length !== questionCount) {
    invalid("context.questionSet.questions", "must match questionCount");
  }
  const questionIds = new Set<number>();
  questionSet.questions.forEach((candidate, index) => {
    const field = `context.questionSet.questions[${index}]`;
    const question = recordOf(candidate, field);
    const questionId = positiveInteger(question.questionId, `${field}.questionId`);
    if (questionIds.has(questionId)) invalid(`${field}.questionId`, "must be unique");
    questionIds.add(questionId);
    exact(question.order, index + 1, `${field}.order`);
    oneOf(question.questionType, ["TECHNICAL", "EXPERIENCE", "SITUATION"], `${field}.questionType`);
    const content = textOf(question.content, `${field}.content`);
    if (question.criterionId !== null) positiveInteger(question.criterionId, `${field}.criterionId`);

    const snapshot = recordOf(question.ncsEvaluationSnapshot, `${field}.ncsEvaluationSnapshot`);
    exact(snapshot.contractVersion, "ncs-evaluation-product.v1", `${field}.ncsEvaluationSnapshot.contractVersion`);
    textOf(snapshot.snapshotVersion, `${field}.ncsEvaluationSnapshot.snapshotVersion`);
    exact(snapshot.locale, "ko-KR", `${field}.ncsEvaluationSnapshot.locale`);
    if (snapshot.jobRole !== jobRole) invalid(`${field}.ncsEvaluationSnapshot.jobRole`, "must match context jobRole");
    const snapshotQuestion = recordOf(snapshot.question, `${field}.ncsEvaluationSnapshot.question`);
    exact(snapshotQuestion.questionId, String(questionId), `${field}.ncsEvaluationSnapshot.question.questionId`);
    exact(snapshotQuestion.content, content, `${field}.ncsEvaluationSnapshot.question.content`);
  });

  validateTalentRubricSnapshot(context.talentRubric);

  const typed = value as HiringEvaluationContextSnapshot;
  const { contextVersion: _contextVersion, contextHash: _contextHash, ...hashInput } = typed;
  const expectedHash = createHiringEvaluationContextHash(hashInput);
  if (typed.contextHash !== expectedHash) invalid("context.contextHash", "does not match context content");
  return typed;
}

function validatePolicy(value: unknown, postingId: number): void {
  const policy = recordOf(value, "context.policy");
  exact(policy.schemaVersion, "hiring-evaluation-policy.v1", "context.policy.schemaVersion");
  const input = recordOf(policy.administratorInput, "context.policy.administratorInput");
  exact(input.postingId, postingId, "context.policy.administratorInput.postingId");
  oneOf(input.decisionMode, ["ABSOLUTE", "RELATIVE", "HYBRID"], "context.policy.administratorInput.decisionMode");
  const jobWeight = integerInRange(input.jobWeightPercent, 0, 100, "context.policy.administratorInput.jobWeightPercent");
  const talentWeight = integerInRange(input.talentWeightPercent, 0, 100, "context.policy.administratorInput.talentWeightPercent");
  if (jobWeight + talentWeight !== 100) invalid("context.policy.administratorInput", "track weights must sum to 100");
  integerInRange(input.minimumJobScore, 0, 100, "context.policy.administratorInput.minimumJobScore");
  integerInRange(input.minimumTalentScore, 0, 100, "context.policy.administratorInput.minimumTalentScore");
  integerInRange(
    input.minimumEvidenceCoveragePercent,
    0,
    100,
    "context.policy.administratorInput.minimumEvidenceCoveragePercent",
  );
  if (!Array.isArray(policy.tieBreakOrder) || policy.tieBreakOrder.length === 0) {
    invalid("context.policy.tieBreakOrder", "must be a non-empty array");
  }
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => [key, sortValue(item)]),
  );
}

function recordOf(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid(field, "object is required");
  return value as Record<string, unknown>;
}

function textOf(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) invalid(field, "non-empty text is required");
  return value;
}

function hashOf(value: unknown, field: string): string {
  const hash = textOf(value, field);
  if (!/^sha256:[0-9a-f]{64}$/u.test(hash)) invalid(field, "sha256 hash is required");
  return hash;
}

function positiveInteger(value: unknown, field: string): number {
  return integerInRange(value, 1, Number.MAX_SAFE_INTEGER, field);
}

function nonNegativeInteger(value: unknown, field: string): number {
  return integerInRange(value, 0, Number.MAX_SAFE_INTEGER, field);
}

function integerInRange(value: unknown, minimum: number, maximum: number, field: string): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    invalid(field, `integer between ${minimum} and ${maximum} is required`);
  }
  return Number(value);
}

function exact(value: unknown, expected: unknown, field: string): void {
  if (value !== expected) invalid(field, `must equal ${String(expected)}`);
}

function oneOf(value: unknown, choices: readonly string[], field: string): string {
  if (typeof value !== "string" || !choices.includes(value)) invalid(field, `must be one of ${choices.join(", ")}`);
  return value;
}

function invalid(field: string, reason: string): never {
  throw new NonRetryableAiWorkerFailure(`${field}: ${reason}`);
}
