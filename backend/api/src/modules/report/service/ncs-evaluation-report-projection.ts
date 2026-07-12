import type { QuestionType } from "../../interview";
import type {
  CandidateNcsAnswerEvaluationView,
  CandidateNcsBehaviorEvaluationView,
} from "../candidate-report.types";
import type { CandidateAiProcessRecord } from "../repository/candidate-report.repository";
import { parseNcsEvaluationJobOutput } from "./ncs-evaluation-job-output";

type ProductBehaviorEvaluation = Omit<CandidateNcsBehaviorEvaluationView, "behaviorPointDescription">;
type ProductOutput = Omit<
  CandidateNcsAnswerEvaluationView,
  "processLogId" | "answerId" | "questionType" | "questionContent" | "sortOrder" | "behaviorEvaluations"
> & {
  answerId?: number;
  behaviorEvaluations: ProductBehaviorEvaluation[];
};

interface SnapshotPresentation {
  sessionId: number;
  questionId: number;
  answerId: number;
  questionType?: QuestionType;
  questionContent?: string;
  behaviorPointDescriptions: Map<string, string>;
}

const QUESTION_TYPES = new Set<QuestionType>([
  "INTRO",
  "TECHNICAL",
  "EXPERIENCE",
  "SITUATION",
  "FOLLOW_UP",
  "CLOSING",
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
  if (!input || input.kind !== "MOCK_NCS_ANSWER_EVALUATION" || !payload || !snapshot || !question) {
    return undefined;
  }

  const sessionId = positiveInteger(payload.sessionId);
  const questionId = positiveInteger(payload.questionId);
  const answerId = positiveInteger(payload.answerId);
  if (!sessionId || !questionId || !answerId || !Array.isArray(snapshot.behaviorPoints)) {
    return undefined;
  }

  const behaviorPointDescriptions = new Map<string, string>();
  for (const point of snapshot.behaviorPoints) {
    const record = recordOf(point);
    const behaviorPointId = record && nonEmptyText(record.behaviorPointId);
    const description = record && nonEmptyText(record.description);
    if (!behaviorPointId || !description || behaviorPointDescriptions.has(behaviorPointId)) {
      return undefined;
    }
    behaviorPointDescriptions.set(behaviorPointId, description);
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
