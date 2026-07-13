import { createHash } from "node:crypto";
import {
  ncsEvaluationGuardrailDecision,
  ProductEvidenceStateNcsEvaluationAdapter,
} from "../ncs-evaluation/product-evidence-state.adapter";
import { NonRetryableAiWorkerFailure } from "../worker-errors";
import type { GuardrailDecision } from "../worker.types";
import { validateHiringEvaluationContext } from "./context";
import { evaluateTalentTrack } from "./talent-evaluator";
import {
  HIRING_ANSWER_EVALUATION_CONTRACT_VERSION,
  type HiringAnswerEvaluationInput,
  type HiringAnswerEvaluationOutput,
  type HiringAnswerTurnInput,
  type HiringTranscriptTurnRange,
} from "./types";

export class HiringAnswerEvaluator {
  private readonly ncsEvaluator = new ProductEvidenceStateNcsEvaluationAdapter();

  evaluate(input: HiringAnswerEvaluationInput): HiringAnswerEvaluationOutput {
    if (input.contractVersion !== HIRING_ANSWER_EVALUATION_CONTRACT_VERSION) {
      invalid("input.contractVersion", "unsupported contract version");
    }
    const context = validateHiringEvaluationContext(input.context);
    const candidateId = positiveInteger(input.candidateId, "input.candidateId");
    const sessionId = positiveInteger(input.sessionId, "input.sessionId");
    const questionId = positiveInteger(input.questionId, "input.questionId");
    const question = context.questionSet.questions.find((candidate) => candidate.questionId === questionId);
    if (!question) invalid("input.questionId", "question is not included in the locked context");

    const turns = validateTurns(input.turns, context.questionSet.maxFollowUpCount);
    const { transcript, ranges } = combineTurns(turns);
    const followUpsUsed = nonNegativeInteger(input.followUpsUsed, "input.followUpsUsed");
    if (followUpsUsed < turns.length - 1 || followUpsUsed > context.questionSet.maxFollowUpCount) {
      invalid("input.followUpsUsed", "must include current turns and stay within the context limit");
    }
    const primaryAnswerId = turns[0]!.answerId;
    const jobEvaluation = this.ncsEvaluator.evaluate({
      step: "NCS_ANSWER_EVALUATION",
      sessionId,
      questionId,
      answerId: primaryAnswerId,
      transcript,
      followUpsUsed,
      maxFollowUps: context.questionSet.maxFollowUpCount,
      evaluationSnapshot: question.ncsEvaluationSnapshot,
    });
    const talentEvaluation = evaluateTalentTrack({
      rubric: context.talentRubric,
      transcript,
      questionType: question.ncsEvaluationSnapshot.question.questionType,
      questionContent: question.content,
      turnRanges: ranges,
      followUpsUsed,
      maxFollowUps: context.questionSet.maxFollowUpCount,
    });

    const output: HiringAnswerEvaluationOutput = {
      contractVersion: HIRING_ANSWER_EVALUATION_CONTRACT_VERSION,
      contextVersion: context.contextVersion,
      contextHash: context.contextHash,
      answerRevisionHash: answerRevisionHash({
        contextVersion: context.contextVersion,
        candidateId,
        sessionId,
        questionId,
        followUpsUsed,
        turns,
      }),
      cohortId: context.cohort.cohortId,
      candidateId,
      sessionId,
      questionId,
      primaryAnswerId,
      transcriptHash: sha256(transcript),
      transcriptTurns: ranges,
      jobEvaluation,
      talentEvaluation,
      guardrail: { ...jobEvaluation.guardrail },
      metadata: {
        evaluatorVersion: "hiring-dual-evaluator.v1",
        jobStrategyVersion: jobEvaluation.metadata.strategyVersion,
        talentStrategyVersion: "talent-evidence-state.v1",
      },
    };
    assertOutputInvariants(output, transcript, context.talentRubric.criteria.length);
    return output;
  }
}

export function hiringAnswerEvaluationGuardrailDecision(
  output: HiringAnswerEvaluationOutput,
): GuardrailDecision {
  return ncsEvaluationGuardrailDecision(output.jobEvaluation);
}

function validateTurns(
  value: readonly HiringAnswerTurnInput[],
  maxFollowUps: number,
): HiringAnswerTurnInput[] {
  if (!Array.isArray(value) || value.length === 0) invalid("input.turns", "at least one turn is required");
  if (value.length > maxFollowUps + 1) invalid("input.turns", "follow-up limit exceeded");

  const turnIds = new Set<string>();
  const answerIds = new Set<number>();
  return value.map((turn, index) => {
    if (typeof turn !== "object" || turn === null || Array.isArray(turn)) {
      invalid(`input.turns[${index}]`, "object is required");
    }
    const expectedKind = index === 0 ? "PRIMARY" : "FOLLOW_UP";
    if (turn.kind !== expectedKind) invalid(`input.turns[${index}].kind`, `${expectedKind} is required`);
    if (typeof turn.turnId !== "string" || turn.turnId.trim().length === 0) {
      invalid(`input.turns[${index}].turnId`, "non-empty text is required");
    }
    if (turnIds.has(turn.turnId)) invalid(`input.turns[${index}].turnId`, "must be unique");
    turnIds.add(turn.turnId);
    const answerId = positiveInteger(turn.answerId, `input.turns[${index}].answerId`);
    if (answerIds.has(answerId)) invalid(`input.turns[${index}].answerId`, "must be unique");
    answerIds.add(answerId);
    if (typeof turn.transcript !== "string" || turn.transcript.trim().length === 0) {
      invalid(`input.turns[${index}].transcript`, "non-empty transcript is required");
    }
    if (turn.transcript !== turn.transcript.trim()) {
      invalid(`input.turns[${index}].transcript`, "canonical transcript must be trimmed");
    }
    return { ...turn, answerId };
  });
}

function combineTurns(turns: readonly HiringAnswerTurnInput[]): {
  transcript: string;
  ranges: HiringTranscriptTurnRange[];
} {
  const ranges: HiringTranscriptTurnRange[] = [];
  let cursor = 0;
  const transcript = turns.map((turn) => {
    const startChar = cursor;
    const endChar = startChar + turn.transcript.length;
    ranges.push({
      turnId: turn.turnId,
      answerId: turn.answerId,
      kind: turn.kind,
      startChar,
      endChar,
    });
    cursor = endChar + 1;
    return turn.transcript;
  }).join("\n");
  return { transcript, ranges };
}

function answerRevisionHash(value: {
  contextVersion: string;
  candidateId: number;
  sessionId: number;
  questionId: number;
  followUpsUsed: number;
  turns: readonly HiringAnswerTurnInput[];
}): string {
  return `sha256:${sha256(JSON.stringify(value))}`;
}

function assertOutputInvariants(
  output: HiringAnswerEvaluationOutput,
  transcript: string,
  expectedCriterionCount: number,
): void {
  if (output.jobEvaluation.questionId !== output.questionId) {
    invalid("output.jobEvaluation.questionId", "must match output.questionId");
  }
  if (output.talentEvaluation.criterionEvaluations.length !== expectedCriterionCount) {
    invalid("output.talentEvaluation.criterionEvaluations", "must contain one result per criterion");
  }
  const evidenceIds = new Set<string>();
  for (const evidence of output.talentEvaluation.evidences) {
    if (evidenceIds.has(evidence.evidenceId)) invalid("output.talentEvaluation.evidences", "evidenceId must be unique");
    evidenceIds.add(evidence.evidenceId);
    if (evidence.quote !== transcript.slice(evidence.startChar, evidence.endChar)) {
      invalid(`output.talentEvaluation.evidences.${evidence.evidenceId}`, "quote must match transcript offsets");
    }
  }
  for (const evaluation of output.talentEvaluation.criterionEvaluations) {
    const references = [...evaluation.supportingEvidenceIds, ...evaluation.contradictingEvidenceIds];
    if (references.some((evidenceId) => !evidenceIds.has(evidenceId))) {
      invalid(`output.talentEvaluation.criterionEvaluations.${evaluation.criterionId}`, "unknown evidence reference");
    }
    if (evaluation.status === "INSUFFICIENT_EVIDENCE") {
      if (evaluation.level !== null || evaluation.score !== null || evaluation.missingEvidence.length === 0) {
        invalid(
          `output.talentEvaluation.criterionEvaluations.${evaluation.criterionId}`,
          "insufficient evidence requires null score and explicit missing evidence",
        );
      }
    } else if (evaluation.level === null || evaluation.score === null || evaluation.missingEvidence.length > 0) {
      invalid(
        `output.talentEvaluation.criterionEvaluations.${evaluation.criterionId}`,
        "scored criterion must have level, score, and no missing evidence",
      );
    }
  }
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > Number.MAX_SAFE_INTEGER) {
    invalid(field, "non-negative safe integer is required");
  }
  return Number(value);
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > Number.MAX_SAFE_INTEGER) {
    invalid(field, "positive safe integer is required");
  }
  return Number(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function invalid(field: string, reason: string): never {
  throw new NonRetryableAiWorkerFailure(`${field}: ${reason}`);
}
