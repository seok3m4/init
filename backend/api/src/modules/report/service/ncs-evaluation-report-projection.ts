import type { QuestionType } from "../../interview";
import type {
  CandidateNcsAnswerEvaluationView,
  CandidateNcsBehaviorEvaluationView,
  CandidateNcsEvaluationBasisView,
  CandidateNcsEvidenceType,
} from "../candidate-report.types";
import type { CandidateAiProcessRecord } from "../repository/candidate-report.repository";
import { parseNcsEvaluationJobOutput } from "./ncs-evaluation-job-output";

type ProductBehaviorEvaluation = Omit<CandidateNcsBehaviorEvaluationView, "behaviorPointDescription">;
type ProductOutput = Omit<
  CandidateNcsAnswerEvaluationView,
  "processLogId" | "answerId" | "questionType" | "questionContent" | "sortOrder" | "behaviorEvaluations" | "evaluationBasis"
> & {
  answerId?: number;
  behaviorEvaluations: ProductBehaviorEvaluation[];
  evaluationBasis?: CandidateNcsEvaluationBasisView;
};

interface SnapshotPresentation {
  sessionId: number;
  questionId: number;
  answerId: number;
  questionType?: QuestionType;
  questionContent?: string;
  behaviorPointDescriptions: Map<string, string>;
  evaluationBasis: CandidateNcsEvaluationBasisView;
}

const QUESTION_TYPES = new Set<QuestionType>([
  "INTRO",
  "TECHNICAL",
  "EXPERIENCE",
  "SITUATION",
  "FOLLOW_UP",
  "CLOSING",
]);
const EVIDENCE_TYPES = new Set<CandidateNcsEvidenceType>([
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

export function projectLatestCandidateNcsEvaluations(
  processes: CandidateAiProcessRecord[],
): CandidateNcsAnswerEvaluationView[] {
  const seenAnswerIds = new Set<number>();
  const projected: CandidateNcsAnswerEvaluationView[] = [];
  const sorted = [...processes].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.processLogId - left.processLogId,
  );

  for (const process of sorted) {
    const evaluation = projectCandidateNcsEvaluation(process);
    if (!evaluation || seenAnswerIds.has(evaluation.answerId)) continue;
    seenAnswerIds.add(evaluation.answerId);
    projected.push(evaluation);
  }
  return projected;
}

export function projectCandidateNcsEvaluation(
  process: CandidateAiProcessRecord,
): CandidateNcsAnswerEvaluationView | undefined {
  if (
    process.processType !== "REPORT_GENERATE" ||
    process.status !== "COMPLETED" ||
    !process.inputRef ||
    !process.outputRef
  ) {
    return undefined;
  }

  const presentation = parseSnapshotPresentation(process.inputRef);
  const rawOutput = parseJsonRecord(process.outputRef);
  if (!presentation || !rawOutput) return undefined;

  const validated = parseNcsEvaluationJobOutput(rawOutput, process.inputRef);
  if (!validated) return undefined;
  const output = validated as unknown as ProductOutput;
  if (
    output.answerId !== presentation.answerId ||
    output.sessionId !== presentation.sessionId ||
    output.questionId !== presentation.questionId ||
    (process.sessionId !== undefined && process.sessionId !== presentation.sessionId) ||
    output.behaviorEvaluations.some(
      (evaluation) => !presentation.behaviorPointDescriptions.has(evaluation.behaviorPointId),
    )
  ) {
    return undefined;
  }

  return {
    processLogId: process.processLogId,
    contractVersion: output.contractVersion,
    sessionId: output.sessionId,
    questionId: output.questionId,
    answerId: output.answerId,
    ...(presentation.questionType ? { questionType: presentation.questionType } : {}),
    ...(presentation.questionContent ? { questionContent: presentation.questionContent } : {}),
    evaluationSnapshotVersion: output.evaluationSnapshotVersion,
    evaluationBasis: presentation.evaluationBasis,
    evidences: output.evidences,
    behaviorEvaluations: output.behaviorEvaluations.map((evaluation) => ({
      ...evaluation,
      behaviorPointDescription: presentation.behaviorPointDescriptions.get(evaluation.behaviorPointId)!,
    })),
    coverage: output.coverage,
    followUp: output.followUp,
    guardrail: output.guardrail,
    metadata: output.metadata,
  };
}

function parseSnapshotPresentation(inputRef: string): SnapshotPresentation | undefined {
  const input = parseJsonRecord(inputRef);
  const payload = input && recordOf(input.payload);
  const snapshot = payload && recordOf(payload.evaluationSnapshot);
  const question = snapshot && recordOf(snapshot.question);
  const context = snapshot && recordOf(snapshot.ncsContext);
  const unit = context && recordOf(context.unit);
  if (!input || input.kind !== "MOCK_NCS_ANSWER_EVALUATION" || !payload || !snapshot || !question || !context || !unit) {
    return undefined;
  }

  const sessionId = positiveInteger(payload.sessionId);
  const questionId = positiveInteger(payload.questionId);
  const answerId = positiveInteger(payload.answerId);
  if (!sessionId || !questionId || !answerId || !Array.isArray(snapshot.behaviorPoints)) {
    return undefined;
  }

  const sourceKind = context.sourceKind;
  const categoryType = context.categoryType;
  const sourceVersion = nonEmptyText(context.version);
  const unitCode = nonEmptyText(unit.code);
  const unitName = nonEmptyText(unit.name);
  const unitDefinition = nonEmptyText(unit.definition);
  const unitLevel = unit.level;
  const jobRole = snapshot.jobRole === undefined || snapshot.jobRole === null ? null : nonEmptyText(snapshot.jobRole);
  if (
    !["OFFICIAL_NCS", "SYNTHETIC_NCS_LIKE"].includes(String(sourceKind)) ||
    !["OCCUPATIONAL_BASIC", "JOB_PERFORMANCE"].includes(String(categoryType)) ||
    !sourceVersion ||
    !unitCode ||
    !unitName ||
    !unitDefinition ||
    (snapshot.jobRole !== undefined && snapshot.jobRole !== null && !jobRole) ||
    (unitLevel !== null && (!Number.isInteger(unitLevel) || Number(unitLevel) < 1))
  ) {
    return undefined;
  }

  const behaviorPointDescriptions = new Map<string, string>();
  const behaviorPoints: CandidateNcsEvaluationBasisView["behaviorPoints"] = [];
  for (const point of snapshot.behaviorPoints) {
    const record = recordOf(point);
    const behaviorPointId = record && nonEmptyText(record.behaviorPointId);
    const description = record && nonEmptyText(record.description);
    const sourceElementCodes = record && stringArray(record.sourceElementCodes);
    const requiredEvidence = record && stringArray(record.requiredEvidence);
    if (
      !behaviorPointId ||
      !description ||
      !sourceElementCodes ||
      !requiredEvidence ||
      requiredEvidence.some((type) => !EVIDENCE_TYPES.has(type as CandidateNcsEvidenceType)) ||
      behaviorPointDescriptions.has(behaviorPointId)
    ) {
      return undefined;
    }
    behaviorPointDescriptions.set(behaviorPointId, description);
    behaviorPoints.push({
      behaviorPointId,
      description,
      sourceElementCodes,
      requiredEvidence: requiredEvidence as CandidateNcsEvidenceType[],
    });
  }
  if (behaviorPointDescriptions.size === 0) return undefined;

  const questionType = typeof question.questionType === "string" && QUESTION_TYPES.has(question.questionType as QuestionType)
    ? (question.questionType as QuestionType)
    : undefined;
  const questionContent = nonEmptyText(question.content);
  return {
    sessionId,
    questionId,
    answerId,
    ...(questionType ? { questionType } : {}),
    ...(questionContent ? { questionContent } : {}),
    behaviorPointDescriptions,
    evaluationBasis: {
      sourceKind: sourceKind as CandidateNcsEvaluationBasisView["sourceKind"],
      sourceVersion,
      categoryType: categoryType as CandidateNcsEvaluationBasisView["categoryType"],
      jobRole: jobRole ?? null,
      unit: {
        code: unitCode,
        name: unitName,
        level: unitLevel as number | null,
        definition: unitDefinition,
      },
      behaviorPoints,
    },
  };
}

function parseJsonRecord(value: string): Record<string, unknown> | undefined {
  try {
    return recordOf(JSON.parse(value));
  } catch {
    return undefined;
  }
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

function nonEmptyText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const values = value.map(nonEmptyText);
  if (values.some((item) => !item)) return undefined;
  const strings = values as string[];
  return new Set(strings).size === strings.length ? strings : undefined;
}
