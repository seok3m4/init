import {
  evaluateEvidenceMaterial,
  type BehaviorEvidenceState,
  type EvidenceStateMaterial,
  type EvidenceStateSegment,
} from "../experiments/ncs-evaluation/evidence-state/evaluator";
import { NCS_SCORE_MAP, type NcsEvidenceType } from "../experiments/ncs-evaluation/shared/contract";
import type { TalentEvidenceType, TalentRubricCriterion, TalentRubricSnapshot } from "../talent-rubric";
import type {
  HiringTalentCriterionEvaluation,
  HiringTalentEvaluationOutput,
  HiringTalentEvaluationStatus,
  HiringTalentEvidence,
  HiringTranscriptTurnRange,
} from "./types";

interface TalentEvaluationInput {
  readonly rubric: TalentRubricSnapshot;
  readonly transcript: string;
  readonly questionType: "EXPERIENCE" | "SITUATION" | "FOLLOW_UP";
  readonly questionContent: string;
  readonly turnRanges: readonly HiringTranscriptTurnRange[];
  readonly followUpsUsed: number;
  readonly maxFollowUps: number;
}

const STATUS_BY_LEVEL: Record<1 | 2 | 3 | 4 | 5, HiringTalentEvaluationStatus> = {
  1: "NOT_DEMONSTRATED",
  2: "LIMITED",
  3: "DEVELOPING",
  4: "DEMONSTRATED",
  5: "STRONGLY_DEMONSTRATED",
};

const RELEVANCE_RULES: Array<{ criterion: RegExp; transcript: RegExp }> = [
  {
    criterion: /협업|소통|커뮤니케이션|조율|존중|팀워크|collaboration|communication/iu,
    transcript: /팀|동료|의견|합의|공유|조율|관계자|고객지원|개발팀|운영팀|디자인|협업/iu,
  },
  {
    criterion: /책임|완수|신뢰|약속|주도|실행|ownership|accountability/iu,
    transcript: /맡|책임|끝까지|완료|기한|약속|주도|후속|검증|결과를?\s*확인/iu,
  },
  {
    criterion: /학습|성장|회고|개선|적응|learning|growth|adapt/iu,
    transcript: /학습|익혔|배웠|회고|다음|개선|반영|재발|문서화|체크리스트|템플릿/iu,
  },
  {
    criterion: /고객|사용자|서비스|customer|user/iu,
    transcript: /고객|사용자|요구|피드백|영향|문의|불편|경험/iu,
  },
  {
    criterion: /도전|혁신|실험|창의|challenge|innovation|experiment/iu,
    transcript: /도전|새로운|실험|시도|가설|대안|프로토타입|검증/iu,
  },
  {
    criterion: /문제|해결|분석|판단|problem|decision/iu,
    transcript: /문제|원인|분석|가설|대안|비교|판단|해결|로그|지표/iu,
  },
  {
    criterion: /정직|투명|윤리|신뢰|integrity|transparent/iu,
    transcript: /사실|오류|실수|공유|보고|투명|정직|위험|알렸|기록/iu,
  },
];

export function evaluateTalentTrack(input: TalentEvaluationInput): HiringTalentEvaluationOutput {
  const evidences: HiringTalentEvidence[] = [];
  const criterionEvaluations = input.rubric.criteria.map((criterion, criterionIndex) => {
    const relevant = isCriterionRelevant(criterion, input.transcript);
    const trace = evaluateEvidenceMaterial(toEvidenceMaterial(input, criterion));
    const state = trace.states[0];
    if (!state) throw new Error("talent evidence state invariant failed");

    const criterionEvidence = toTalentEvidence(
      criterion,
      criterionIndex,
      state,
      input.turnRanges,
    );
    evidences.push(...criterionEvidence);
    return toCriterionEvaluation(criterion, state, criterionEvidence, relevant, input.transcript);
  });

  const evaluated = criterionEvaluations.filter((evaluation) => evaluation.score !== null);
  const evaluatedWeight = evaluated.reduce((sum, evaluation) => sum + evaluation.weight, 0);
  const followUpTargets = criterionEvaluations.filter(
    (evaluation) => evaluation.relevance === "DIRECT" && evaluation.score === null,
  );
  const followUpAllowed = input.followUpsUsed < input.maxFollowUps;
  const missingEvidence = uniqueEvidenceTypes(followUpTargets.flatMap((target) => target.missingEvidence));
  const followUpRequired = followUpAllowed && followUpTargets.length > 0 && missingEvidence.length > 0;

  return {
    rubricVersion: input.rubric.rubricVersion,
    sourceHash: input.rubric.sourceHash,
    evidences,
    criterionEvaluations,
    coverage: {
      assessableCriterionCount: criterionEvaluations.length,
      evaluatedCriterionCount: evaluated.length,
      evaluatedWeight,
      totalWeight: 100,
      ratio: evaluatedWeight / 100,
    },
    followUp: {
      required: followUpRequired,
      criterionIds: followUpRequired ? followUpTargets.map((target) => target.criterionId) : [],
      missingEvidence: followUpRequired ? missingEvidence : [],
      suggestedQuestion: followUpRequired
        ? talentFollowUpQuestion(followUpTargets, missingEvidence)
        : null,
    },
  };
}

function toEvidenceMaterial(
  input: TalentEvaluationInput,
  criterion: TalentRubricCriterion,
): EvidenceStateMaterial {
  return {
    transcript: input.transcript,
    questionType: input.questionType,
    questionContent: input.questionContent,
    unitName: criterion.name,
    unitDefinition: criterion.definition,
    elementNames: [criterion.name],
    behaviorPoints: [{
      description: `${criterion.name} ${criterion.definition}`,
      requiredEvidence: criterion.requiredEvidence as NcsEvidenceType[],
    }],
    minimumSupportingEvidence: 1,
    followUpsUsed: input.followUpsUsed,
    maxFollowUps: input.maxFollowUps,
  };
}

function toTalentEvidence(
  criterion: TalentRubricCriterion,
  criterionIndex: number,
  state: BehaviorEvidenceState,
  turnRanges: readonly HiringTranscriptTurnRange[],
): HiringTalentEvidence[] {
  return [...state.supportingSegments, ...state.contradictingSegments]
    .sort((left, right) => left.startChar - right.startChar || left.segmentIndex - right.segmentIndex)
    .map((segment, index) => {
      const range = turnRangeFor(segment, turnRanges);
      return {
        evidenceId: `talent-evidence-${criterionIndex + 1}-${index + 1}-${segment.startChar}`,
        criterionId: criterion.id,
        evidenceTypes: segment.detectedEvidence.filter(isTalentEvidenceType),
        disposition: segment.disposition,
        quote: segment.quote,
        startChar: segment.startChar,
        endChar: segment.endChar,
        turnId: range.turnId,
        turnKind: range.kind,
      };
    });
}

function toCriterionEvaluation(
  criterion: TalentRubricCriterion,
  state: BehaviorEvidenceState,
  evidences: readonly HiringTalentEvidence[],
  semanticallyRelevant: boolean,
  transcript: string,
): HiringTalentCriterionEvaluation {
  const direct = semanticallyRelevant && state.relevance === "DIRECT";
  const missingEvidence = direct
    ? criterion.requiredEvidence.filter((type) => !state.availableEvidence.includes(type))
    : [...criterion.requiredEvidence];
  const complete = direct && missingEvidence.length === 0 && state.agency !== "CONTRADICTED";
  const level = complete ? talentLevel(state, transcript) : null;
  const anchor = level === null
    ? undefined
    : criterion.scoringAnchors.find((candidate) => candidate.level === level);

  return {
    criterionId: criterion.id,
    criterionName: criterion.name,
    weight: criterion.weight,
    relevance: direct ? "DIRECT" : "NOT_OBSERVED",
    status: level === null ? "INSUFFICIENT_EVIDENCE" : STATUS_BY_LEVEL[level],
    level,
    score: level === null ? null : NCS_SCORE_MAP[level],
    anchorLabel: anchor?.label ?? null,
    anchorDescription: anchor?.description ?? null,
    rationale: talentRationale(direct, state, missingEvidence, level),
    supportingEvidenceIds: evidences
      .filter((evidence) => evidence.disposition === "SUPPORTING")
      .map((evidence) => evidence.evidenceId),
    contradictingEvidenceIds: evidences
      .filter((evidence) => evidence.disposition === "CONTRADICTING")
      .map((evidence) => evidence.evidenceId),
    missingEvidence,
    confidence: talentConfidence(level, state),
  };
}

function talentLevel(state: BehaviorEvidenceState, transcript: string): 1 | 2 | 3 | 4 | 5 {
  if (state.agency === "GENERIC") return 1;
  const supportingCount = state.supportingSegments.length;
  const directCount = state.supportingSegments.filter((segment) => segment.direct).length;
  const hasMetric = /\d+(?:[.,]\d+)?\s*(?:%|ms|초|분|시간|건|배|명)?|p\d{2}/iu.test(transcript);
  const hasAdjustment = /회고|다음|재발|체크리스트|템플릿|모니터링|문서화|반영|바꿨|변경/iu.test(transcript);
  const hasCausalDetail = /때문|위해|기준|비교|위험|영향|제약|대안/iu.test(transcript);

  if (supportingCount <= 1) return hasMetric && hasAdjustment && hasCausalDetail ? 3 : 2;
  if (supportingCount === 2) return 3;
  if (supportingCount >= 4 && directCount >= 2 && hasMetric && hasAdjustment) return 5;
  return 4;
}

function talentRationale(
  direct: boolean,
  state: BehaviorEvidenceState,
  missingEvidence: readonly TalentEvidenceType[],
  level: 1 | 2 | 3 | 4 | 5 | null,
): string {
  if (!direct) return "이 답변에서 해당 인재상 기준과 직접 연결되는 발화 근거를 확인하지 못했습니다.";
  if (state.agency === "CONTRADICTED") {
    return "관련 발화에 본인의 수행을 부정하거나 충돌하는 내용이 있어 점수화하지 않았습니다.";
  }
  if (level === null) {
    return `필수 발화 근거가 부족해 점수화하지 않았습니다. 누락: ${missingEvidence.join(", ")}.`;
  }
  return `필수 발화 근거를 모두 확인했고, 근거의 분리도와 구체성을 ${level}단계 anchor에 대응했습니다.`;
}

function talentConfidence(
  level: 1 | 2 | 3 | 4 | 5 | null,
  state: BehaviorEvidenceState,
): "HIGH" | "MEDIUM" | "LOW" {
  if (level === null || level <= 2) return "LOW";
  const directCount = state.supportingSegments.filter((segment) => segment.direct).length;
  return level >= 4 && directCount >= 2 ? "HIGH" : "MEDIUM";
}

function isCriterionRelevant(criterion: TalentRubricCriterion, transcript: string): boolean {
  const criterionText = `${criterion.name} ${criterion.definition}`;
  const matchedRules = RELEVANCE_RULES.filter((rule) => rule.criterion.test(criterionText));
  if (matchedRules.length > 0) return matchedRules.some((rule) => rule.transcript.test(transcript));

  const normalizedTranscript = transcript.toLocaleLowerCase("ko-KR");
  return semanticKeywords(criterionText).some((keyword) => normalizedTranscript.includes(keyword));
}

function semanticKeywords(value: string): string[] {
  const stopwords = new Set([
    "행동", "결과", "경험", "업무", "기준", "확인", "수행", "설명", "직접", "관련", "대한",
    "한다", "있다", "있는", "통해", "본인", "발화", "과정", "능력",
  ]);
  return [...new Set(
    (value.toLocaleLowerCase("ko-KR").match(/[가-힣a-z0-9]+/gu) ?? [])
      .map((token) => token.replace(/(?:으로|에서|에게|하고|하며|한다|했다|하는|있는|없는|이다)$/u, ""))
      .filter((token) => token.length >= 2 && !stopwords.has(token)),
  )];
}

function turnRangeFor(
  segment: EvidenceStateSegment,
  ranges: readonly HiringTranscriptTurnRange[],
): HiringTranscriptTurnRange {
  const range = ranges.find(
    (candidate) => segment.startChar >= candidate.startChar && segment.endChar <= candidate.endChar,
  );
  if (!range) throw new Error("talent evidence turn range invariant failed");
  return range;
}

function talentFollowUpQuestion(
  targets: readonly HiringTalentCriterionEvaluation[],
  missing: readonly TalentEvidenceType[],
): string {
  const criterionNames = targets.slice(0, 2).map((target) => `"${target.criterionName}"`).join("과 ");
  const labels: Record<TalentEvidenceType, string> = {
    ACTION: "본인이 직접 한 행동",
    RATIONALE: "그 행동을 선택한 이유",
    RESULT: "확인한 결과",
    REFLECTION: "경험 이후 바꾼 점",
  };
  return `${criterionNames} 기준을 더 확인하고 싶습니다. ${missing.map((type) => labels[type]).join(", ")}을 당시 경험에 맞춰 구체적으로 설명해 주시겠어요?`;
}

function uniqueEvidenceTypes(values: readonly TalentEvidenceType[]): TalentEvidenceType[] {
  const order: TalentEvidenceType[] = ["ACTION", "RATIONALE", "RESULT", "REFLECTION"];
  const valueSet = new Set(values);
  return order.filter((type) => valueSet.has(type));
}

function isTalentEvidenceType(value: NcsEvidenceType): value is TalentEvidenceType {
  return value === "ACTION" || value === "RATIONALE" || value === "RESULT" || value === "REFLECTION";
}
