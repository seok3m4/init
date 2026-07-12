import type { InterviewQuestion } from "../interview.runtime.types";

export const NCS_EVALUATION_PRODUCT_CONTRACT_VERSION = "ncs-evaluation-product.v1" as const;

export const NCS_EVALUATION_SCORE_MAP = {
  1: 25,
  2: 50,
  3: 70,
  4: 85,
  5: 100,
} as const;

export type NcsEvaluationQuestionType = "EXPERIENCE" | "SITUATION" | "FOLLOW_UP";

export type NcsEvaluationEvidenceType =
  | "SITUATION"
  | "TASK"
  | "ACTION"
  | "RATIONALE"
  | "RESULT"
  | "REFLECTION"
  | "KNOWLEDGE"
  | "CONSTRAINT"
  | "TRADEOFF";

export interface NcsEvaluationSnapshot {
  contractVersion: typeof NCS_EVALUATION_PRODUCT_CONTRACT_VERSION;
  snapshotVersion: string;
  locale: "ko-KR";
  jobRole: string | null;
  question: {
    questionId: string;
    questionType: NcsEvaluationQuestionType;
    content: string;
  };
  ncsContext: {
    sourceKind: "OFFICIAL_NCS" | "SYNTHETIC_NCS_LIKE";
    version: string;
    categoryType: "OCCUPATIONAL_BASIC" | "JOB_PERFORMANCE";
    unit: {
      code: string;
      name: string;
      level: number | null;
      definition: string;
      elements: Array<{
        elementCode: string;
        name: string;
      }>;
    };
  };
  behaviorPoints: Array<{
    behaviorPointId: string;
    description: string;
    sourceElementCodes: string[];
    observability: "INTERVIEW";
    requiredEvidence: NcsEvaluationEvidenceType[];
  }>;
  evaluationPolicy: {
    scoreMap: Record<"1" | "2" | "3" | "4" | "5", number>;
    minimumSupportingEvidence: number;
    insufficientEvidenceScore: null;
    allowSensitiveAttributes: false;
    allowNonverbalScore: false;
  };
}

export interface NcsEvaluationSnapshotResolver {
  resolve(question: InterviewQuestion): NcsEvaluationSnapshot | undefined;
}

export const NCS_EVALUATION_SNAPSHOT_RESOLVER = Symbol("NCS_EVALUATION_SNAPSHOT_RESOLVER");

const EVIDENCE_TYPES = new Set<NcsEvaluationEvidenceType>([
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

const QUESTION_TYPES = new Set<NcsEvaluationQuestionType>(["EXPERIENCE", "SITUATION", "FOLLOW_UP"]);

export function parseNcsEvaluationSnapshot(value: unknown): NcsEvaluationSnapshot | undefined {
  if (!isRecord(value) || value.contractVersion !== NCS_EVALUATION_PRODUCT_CONTRACT_VERSION) return undefined;
  if (value.locale !== "ko-KR" || !nonEmptyText(value.snapshotVersion)) return undefined;

  const parsedJobRole = value.jobRole === undefined || value.jobRole === null ? null : nonEmptyText(value.jobRole, 80);
  if (value.jobRole !== undefined && value.jobRole !== null && !parsedJobRole) return undefined;
  const jobRole = parsedJobRole ?? null;

  const question = parseQuestion(value.question);
  const ncsContext = parseContext(value.ncsContext);
  const policy = parsePolicy(value.evaluationPolicy);
  if (!question || !ncsContext || !policy || !Array.isArray(value.behaviorPoints) || value.behaviorPoints.length === 0) {
    return undefined;
  }

  const sourceElementCodes = new Set(ncsContext.unit.elements.map((element) => element.elementCode));
  const behaviorPoints: NcsEvaluationSnapshot["behaviorPoints"] = [];
  const behaviorPointIds = new Set<string>();
  for (const candidate of value.behaviorPoints) {
    if (!isRecord(candidate)) return undefined;
    const behaviorPointId = nonEmptyText(candidate.behaviorPointId);
    const description = nonEmptyText(candidate.description);
    const sourceCodes = uniqueTextArray(candidate.sourceElementCodes);
    const requiredEvidence = uniqueTextArray(candidate.requiredEvidence);
    if (
      !behaviorPointId ||
      behaviorPointIds.has(behaviorPointId) ||
      !description ||
      !sourceCodes ||
      sourceCodes.some((code) => !sourceElementCodes.has(code)) ||
      !requiredEvidence ||
      requiredEvidence.some((type) => !EVIDENCE_TYPES.has(type as NcsEvaluationEvidenceType)) ||
      candidate.observability !== "INTERVIEW"
    ) {
      return undefined;
    }
    behaviorPointIds.add(behaviorPointId);
    behaviorPoints.push({
      behaviorPointId,
      description,
      sourceElementCodes: sourceCodes,
      observability: "INTERVIEW",
      requiredEvidence: requiredEvidence as NcsEvaluationEvidenceType[],
    });
  }

  return {
    contractVersion: NCS_EVALUATION_PRODUCT_CONTRACT_VERSION,
    snapshotVersion: value.snapshotVersion as string,
    locale: "ko-KR",
    jobRole,
    question,
    ncsContext,
    behaviorPoints,
    evaluationPolicy: policy,
  };
}

function parseQuestion(value: unknown): NcsEvaluationSnapshot["question"] | undefined {
  if (!isRecord(value)) return undefined;
  const questionId = nonEmptyText(value.questionId);
  const content = nonEmptyText(value.content);
  const questionType = typeof value.questionType === "string" && QUESTION_TYPES.has(value.questionType as NcsEvaluationQuestionType)
    ? (value.questionType as NcsEvaluationQuestionType)
    : undefined;
  return questionId && content && questionType ? { questionId, questionType, content } : undefined;
}

function parseContext(value: unknown): NcsEvaluationSnapshot["ncsContext"] | undefined {
  if (!isRecord(value) || !isRecord(value.unit) || !Array.isArray(value.unit.elements) || value.unit.elements.length === 0) {
    return undefined;
  }
  const sourceKind = value.sourceKind;
  const categoryType = value.categoryType;
  const version = nonEmptyText(value.version);
  const code = nonEmptyText(value.unit.code);
  const name = nonEmptyText(value.unit.name);
  const definition = nonEmptyText(value.unit.definition);
  const level = value.unit.level;
  if (
    !["OFFICIAL_NCS", "SYNTHETIC_NCS_LIKE"].includes(String(sourceKind)) ||
    !["OCCUPATIONAL_BASIC", "JOB_PERFORMANCE"].includes(String(categoryType)) ||
    !version ||
    !code ||
    !name ||
    !definition ||
    (level !== null && (!Number.isInteger(level) || Number(level) < 1))
  ) {
    return undefined;
  }

  const elements: NcsEvaluationSnapshot["ncsContext"]["unit"]["elements"] = [];
  const elementCodes = new Set<string>();
  for (const candidate of value.unit.elements) {
    if (!isRecord(candidate)) return undefined;
    const elementCode = nonEmptyText(candidate.elementCode);
    const elementName = nonEmptyText(candidate.name);
    if (!elementCode || !elementName || elementCodes.has(elementCode)) return undefined;
    elementCodes.add(elementCode);
    elements.push({ elementCode, name: elementName });
  }

  return {
    sourceKind: sourceKind as NcsEvaluationSnapshot["ncsContext"]["sourceKind"],
    version,
    categoryType: categoryType as NcsEvaluationSnapshot["ncsContext"]["categoryType"],
    unit: { code, name, level: level as number | null, definition, elements },
  };
}

function parsePolicy(value: unknown): NcsEvaluationSnapshot["evaluationPolicy"] | undefined {
  if (!isRecord(value) || !isRecord(value.scoreMap)) return undefined;
  if (
    value.scoreMap["1"] !== 25 ||
    value.scoreMap["2"] !== 50 ||
    value.scoreMap["3"] !== 70 ||
    value.scoreMap["4"] !== 85 ||
    value.scoreMap["5"] !== 100 ||
    !Number.isInteger(value.minimumSupportingEvidence) ||
    Number(value.minimumSupportingEvidence) < 1 ||
    value.insufficientEvidenceScore !== null ||
    value.allowSensitiveAttributes !== false ||
    value.allowNonverbalScore !== false
  ) {
    return undefined;
  }
  return {
    scoreMap: { ...NCS_EVALUATION_SCORE_MAP },
    minimumSupportingEvidence: Number(value.minimumSupportingEvidence),
    insufficientEvidenceScore: null,
    allowSensitiveAttributes: false,
    allowNonverbalScore: false,
  };
}

function uniqueTextArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const items = value.map((item) => nonEmptyText(item));
  if (items.some((item) => !item)) return undefined;
  const strings = items as string[];
  return new Set(strings).size === strings.length ? strings : undefined;
}

function nonEmptyText(value: unknown, maxLength?: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized && (maxLength === undefined || normalized.length <= maxLength) ? normalized : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
