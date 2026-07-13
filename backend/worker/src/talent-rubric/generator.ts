import { createHash } from "node:crypto";
import { sanitizeTalentMeaning, summarizeProhibitedSignals } from "./prohibited-signals";
import {
  TALENT_RUBRIC_CONTRACT_VERSION,
  TALENT_RUBRIC_VERSION,
  type TalentBehaviorIndicator,
  type TalentEvidenceType,
  type TalentProfileItemInput,
  type TalentRubricCriterion,
  type TalentRubricSnapshot,
  type TalentScoringAnchor,
} from "./types";
import { validateAndNormalizeTalentProfileItems, type NormalizedTalentProfileItem } from "./validation";
import { normalizeTalentWeights } from "./weight-normalizer";

const REQUIRED_EVIDENCE: readonly TalentEvidenceType[] = ["ACTION", "RATIONALE", "RESULT", "REFLECTION"];

const SCORING_ANCHORS: readonly TalentScoringAnchor[] = [
  {
    level: 1,
    evidenceStrength: 1,
    label: "제한적",
    description: "필수 발화 근거는 모두 있으나 내용이 추상적이고 기준 정의와의 연결이 약하다.",
  },
  {
    level: 2,
    evidenceStrength: 2,
    label: "부분적",
    description: "필수 발화 근거가 일부 구체적이지만 근거 사이의 연결과 기준 정의의 입증이 제한적이다.",
  },
  {
    level: 3,
    evidenceStrength: 3,
    label: "충분",
    description: "행동, 이유, 결과와 성찰이 구체적으로 연결되고 기준 정의를 일관되게 뒷받침한다.",
  },
  {
    level: 4,
    evidenceStrength: 4,
    label: "강함",
    description: "근거 간 인과관계와 결과 확인, 성찰에 따른 조정이 명확해 기준 정의를 강하게 뒷받침한다.",
  },
  {
    level: 5,
    evidenceStrength: 5,
    label: "매우 강함",
    description: "제시된 경험 전반의 근거가 매우 구체적이고 상호 일관되며 기준 정의를 지속적으로 입증한다.",
  },
];

export function generateTalentRubricSnapshot(
  input: readonly TalentProfileItemInput[],
): TalentRubricSnapshot {
  const normalized = validateAndNormalizeTalentProfileItems(input);
  const normalizedWeights = normalizeTalentWeights(normalized.map((item) => item.sourceWeight));
  const sourceHash = createTalentRubricSourceHash(normalized);
  const criteria = normalized.map((item, index) =>
    buildCriterion(item, index, normalizedWeights[index] ?? 0),
  );

  if (criteria.reduce((sum, criterion) => sum + criterion.weight, 0) !== 100) {
    throw new Error("talent rubric weight invariant failed");
  }

  return {
    contractVersion: TALENT_RUBRIC_CONTRACT_VERSION,
    rubricVersion: TALENT_RUBRIC_VERSION,
    sourceHash,
    criteria,
    evidencePolicy: {
      source: "ANSWER_TRANSCRIPT",
      requiredEvidenceRule: "ALL_REQUIRED",
      missingRequiredEvidenceStatus: "INSUFFICIENT_EVIDENCE",
      insufficientEvidenceScore: null,
    },
    prohibitedSignals: summarizeProhibitedSignals(normalized),
  };
}

function createTalentRubricSourceHash(items: readonly NormalizedTalentProfileItem[]): string {
  const canonicalSource = items.map((item) => ({
    name: item.name,
    description: item.description,
    weight: item.sourceWeight,
  }));
  return `sha256:${sha256(JSON.stringify(canonicalSource))}`;
}

function buildCriterion(
  source: NormalizedTalentProfileItem,
  index: number,
  weight: number,
): TalentRubricCriterion {
  const meaning = sanitizeTalentMeaning(source, index);
  const id = `talent-criterion-${sha256(JSON.stringify({ name: source.name, description: source.description })).slice(0, 16)}`;
  return {
    id,
    name: meaning.name,
    definition: meaning.definition,
    weight,
    behaviorIndicators: buildBehaviorIndicators(id, meaning.name, meaning.definition),
    requiredEvidence: [...REQUIRED_EVIDENCE],
    scoringAnchors: SCORING_ANCHORS.map((anchor) => ({ ...anchor })),
  };
}

function buildBehaviorIndicators(
  criterionId: string,
  criterionName: string,
  criterionDefinition: string,
): TalentBehaviorIndicator[] {
  const reference = `"${criterionName}"의 정의인 "${criterionDefinition}"`;
  return [
    {
      id: `${criterionId}-action`,
      evidenceType: "ACTION",
      observability: "ANSWER_TRANSCRIPT",
      description: `${reference}와 직접 연결되는 본인의 구체적 행동을 발화로 설명한다.`,
    },
    {
      id: `${criterionId}-rationale`,
      evidenceType: "RATIONALE",
      observability: "ANSWER_TRANSCRIPT",
      description: `${reference}에 따라 행동을 선택한 이유나 판단 근거를 발화로 설명한다.`,
    },
    {
      id: `${criterionId}-result`,
      evidenceType: "RESULT",
      observability: "ANSWER_TRANSCRIPT",
      description: `${reference}와 관련한 행동 뒤에 확인한 결과나 변화를 발화로 설명한다.`,
    },
    {
      id: `${criterionId}-reflection`,
      evidenceType: "REFLECTION",
      observability: "ANSWER_TRANSCRIPT",
      description: `${reference}와 관련한 경험에서 배운 점이나 이후 조정한 행동을 발화로 설명한다.`,
    },
  ];
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
