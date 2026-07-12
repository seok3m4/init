import {
  NCS_EVALUATION_CONTRACT_VERSION,
  NCS_SCORE_MAP,
  NcsBehaviorEvaluation,
  NcsClaimType,
  NcsEvaluationInput,
  NcsEvaluationOutput,
  NcsEvaluationStatus,
  NcsEvaluationStrategy,
  NcsEvaluationConfidence,
  NcsEvidence,
  NcsEvidenceType,
} from "../shared/contract";

type BehaviorProfile =
  | "INCIDENT"
  | "DATABASE"
  | "TESTING"
  | "REQUIREMENTS"
  | "COMMUNICATION"
  | "PROBLEM_SOLVING"
  | "GENERAL";

type EvidenceDisposition = "SUPPORTING" | "CONTRADICTING";

export interface EvidenceStateBehaviorMaterial {
  description: string;
  requiredEvidence: NcsEvidenceType[];
}

/** Deliberately excludes case, question, answer, behavior-point, and relation identifiers. */
export interface EvidenceStateMaterial {
  transcript: string;
  questionType: NcsEvaluationInput["question"]["questionType"];
  questionContent: string;
  unitName: string;
  unitDefinition: string;
  elementNames: string[];
  behaviorPoints: EvidenceStateBehaviorMaterial[];
  minimumSupportingEvidence: number;
  followUpsUsed: number;
  maxFollowUps: number;
}

export interface EvidenceStateSegment {
  segmentIndex: number;
  quote: string;
  startChar: number;
  endChar: number;
  detectedEvidence: NcsEvidenceType[];
  disposition: EvidenceDisposition;
  direct: boolean;
}

/** Intermediate extractor output. It intentionally contains no status, level, score, or confidence. */
export interface BehaviorEvidenceState {
  behaviorIndex: number;
  relevance: "NONE" | "DIRECT";
  agency: "NONE" | "GENERIC" | "SELF" | "CONTRADICTED";
  requiredEvidence: NcsEvidenceType[];
  availableEvidence: NcsEvidenceType[];
  missingEvidence: NcsEvidenceType[];
  supportingSegments: EvidenceStateSegment[];
  contradictingSegments: EvidenceStateSegment[];
  ignoredSignalSegmentCount: number;
}

export interface EvidenceStateDecision {
  status: NcsEvaluationStatus;
  level: 1 | 2 | 3 | 4 | 5 | null;
  score: 25 | 50 | 70 | 85 | 100 | null;
  confidence: NcsEvaluationConfidence;
  rationale: string;
  missingEvidence: NcsEvidenceType[];
}

export interface EvidenceStateTrace {
  states: BehaviorEvidenceState[];
  decisions: EvidenceStateDecision[];
}

interface TranscriptSegment {
  segmentIndex: number;
  quote: string;
  startChar: number;
  endChar: number;
  analysisText: string;
  detectedEvidence: NcsEvidenceType[];
  ignoredSignal: boolean;
}

interface ProfileRule {
  profile: BehaviorProfile;
  intent: RegExp;
  transcript: RegExp;
}

const PROFILE_RULES: ProfileRule[] = [
  {
    profile: "DATABASE",
    intent: /(데이터\s*접근|실행\s*계획|병목|인덱스|성능\s*개선)/u,
    transcript: /(데이터베이스|쿼리|인덱스|실행\s*계획|조회|p95|풀스캔|캐시|응답\s*시간|성능)/iu,
  },
  {
    profile: "TESTING",
    intent: /(테스트|품질|결함|회귀)/u,
    transcript: /(테스트|결함|커버리지|요구사항|경계값|회귀|쿠폰|확장자|배포)/u,
  },
  {
    profile: "REQUIREMENTS",
    intent: /(요구|수용\s*기준|명세|상충)/u,
    transcript: /(요구사항|요구를|요구해|수용\s*기준|담당자|이해관계자|명세|모호|사용자|프로토타입)/u,
  },
  {
    profile: "COMMUNICATION",
    intent: /(관계자|공동\s*목표|합의|공유|조율|상대의?\s*관점|의사소통|역할)/u,
    transcript: /(팀|의견|동료|합의|공유|전달|알리|고객지원|관계자|역할|운영팀|개발팀|디자인|협업|공통\s*목표|양보)/u,
  },
  {
    profile: "PROBLEM_SOLVING",
    intent: /(불확실|가설|대안|정보를?\s*수집|문제를?\s*구조|실패\s*비용)/u,
    transcript: /(정보|문제|가설|대안|방법|자료|실험|원인|위험|비용|데이터|검색|해결)/u,
  },
  {
    profile: "INCIDENT",
    intent: /(징후|원인을?\s*좁|복구|장애|서비스\s*문제|해결\s*결과)/u,
    transcript: /(장애|오류|경보|로그|서버|롤백|복구|정상화|지연|큐|배포|재시작|원인|설정)/u,
  },
];

const LOW_INFORMATION_PATTERN = /^(?:없습니다|잘\s*모르겠습니다|모르겠습니다|답변하기\s*어렵습니다)[.!?]?$/u;
const GENERIC_PATTERN = /(보통|필요하면|중요하다고|알고\s*있습니다|하면\s*됩니다|하는\s*것이\s*중요|하겠습니다)/u;
const GLOBAL_CONTRADICTION_PATTERN = /(처음에는|본\s*질문에서는|처음\s*답변에서는)[\s\S]*(하지만|그러나|실제로는|다시\s*확인하니)/u;
const NEGATIVE_ACTION_PATTERN = /(확인하지\s*않|로그를?\s*보지\s*않|질문하지\s*않|의견(?:은|을)?\s*(?:자세히\s*)?듣지\s*않|반대\s*의견을?\s*듣지\s*않|알리지\s*않|추정해서\s*개발|테스트\s*없이|다른\s*팀에\s*넘겼|다른\s*팀이\s*원인을?\s*찾아\s*복구|팀원이\s*이미.*적용|처음\s*떠오른.*바로\s*적용|더\s*확인하지\s*않|전후\s*측정(?:은|을)?\s*하지\s*않|원인\s*분석이나?\s*전후\s*측정은?\s*하지\s*않|모든\s*컬럼에\s*인덱스|문제가?\s*발생하면\s*그때\s*고치|운이\s*나빴|좋아졌을\s*것|제\s*방식대로\s*진행|합의한\s*적이\s*없|상세\s*측정은\s*시간을\s*낭비)/u;

const ACTION_PATTERN = /(확인|비교|분석|적용|추가|수정|작성|질문|정리|공유|합의|선택|실행|검증|수집|나누|롤백|재시작|테스트|전달|조율|구분|모니터링|도입|찾았|기록하|바꿔|제안|문서화|측정|배포|정했|정했습니다|확정)/u;
const RATIONALE_PATTERN = /(때문|위해|판단|기준|비교|위험|영향|비용|손실|목표|원인|풀스캔|설정\s*변경|정렬\s*비용|가설|장단점|수용\s*기준|주요\s*사용자|가능성이\s*높은|경계값|이메일\s*중복|맞춰|위험도)/u;
const RESULT_PATTERN = /(줄었|내려갔|정상화|발견해\s*수정|발견했고|합의해|합의하여|승인을\s*받|예정일에\s*배포|문제없이\s*배포|확정했습니다|더\s*이상\s*발생하지|돌아왔|오류를\s*줄였|전달했습니다|결함을\s*찾아\s*수정|다시\s*만들|장애\s*시간이\s*더\s*길어졌|결제\s*오류가\s*발생|결과\s*지표|결과를\s*확인|개선\s*결과|증가했습니다)/u;
const REFLECTION_PATTERN = /(재발|체크리스트에\s*넣|템플릿에\s*반영|템플릿을\s*남|모니터링을\s*배포|경보를\s*추가|CI\s*필수\s*단계|과정과\s*학습을\s*기록|회고에서|다음\s*배포\s*템플릿)/iu;
const CONSTRAINT_PATTERN = /(시한|일정|시간|영향도|고객\s*영향|데이터\s*손실|동시\s*사용자|실패\s*비용|개발\s*비용)/u;
const TRADEOFF_PATTERN = /(대안을?\s*비교|비용을?\s*비교|위험과|쓰기\s*지연|중단\s*기준|단계\s*배포|영향도와\s*실행\s*비용|조회\s*빈도와\s*쓰기\s*비용|장단점)/u;
const SITUATION_PATTERN = /(발생|늘어|느려|모호|달랐|충돌|위험|문제가\s*생겼|오류율|지연|요청했|요구해)/u;
const TASK_PATTERN = /(담당|맡았|역할|목표|해야\s*했)/u;
const KNOWLEDGE_PATTERN = /(알고\s*있습니다|단위\s*테스트|통합\s*테스트|실행\s*계획|인덱스|가설)/u;

const PROHIBITED_SIGNAL_PATTERN = /(?:제\s*이름은\s*[^,.!?]+|저는\s*(?:여성|남성)\s*(?:지원자)?(?:입니다)?|\S*대학교\s*출신(?:입니다)?|출신\s*학교(?:는|가)?\s*[^,.!?]+|나이는?\s*\d+\s*살(?:입니다)?|출신지는?\s*[^,.!?]+|외모|장애(?:가|는|를|인)?|건강\s*상태|표정|시선|눈맞춤|억양|말\s*속도|목소리\s*톤)/giu;
const SAFE_FILLER_PATTERN = /^(?:저는|제가|지원자입니다|입니다|은|는|이|가|을|를|\s|[.!?,])+$/u;

const EVIDENCE_TYPE_ORDER: NcsEvidenceType[] = [
  "SITUATION",
  "TASK",
  "ACTION",
  "RATIONALE",
  "RESULT",
  "REFLECTION",
  "KNOWLEDGE",
  "CONSTRAINT",
  "TRADEOFF",
];

const STATUS_BY_LEVEL: Record<1 | 2 | 3 | 4 | 5, Exclude<NcsEvaluationStatus, "INSUFFICIENT_EVIDENCE">> = {
  1: "NOT_DEMONSTRATED",
  2: "LIMITED",
  3: "DEVELOPING",
  4: "DEMONSTRATED",
  5: "STRONGLY_DEMONSTRATED",
};

export class EvidenceStateNcsEvaluator implements NcsEvaluationStrategy {
  readonly strategyId = "evidence-state";
  readonly promptVersion = "evidence-state-rules-v1";
  readonly model = "deterministic-evidence-state-v1";

  evaluate(input: NcsEvaluationInput): NcsEvaluationOutput {
    const trace = evaluateEvidenceMaterial(createEvidenceStateMaterial(input));

    // The frozen contract requires caseId in the response. It is copied only here and never enters evaluation state.
    return toContractOutput(
      trace,
      input.caseId,
      input.behaviorPoints.map((point) => point.behaviorPointId),
      this,
      input.interviewContext.followUpsUsed,
      input.interviewContext.maxFollowUps,
    );
  }
}

export function createEvidenceStateMaterial(input: NcsEvaluationInput): EvidenceStateMaterial {
  return {
    transcript: input.answer.transcript,
    questionType: input.question.questionType,
    questionContent: input.question.content,
    unitName: input.ncsContext.unit.name,
    unitDefinition: input.ncsContext.unit.definition,
    elementNames: input.ncsContext.unit.elements.map((element) => element.name),
    behaviorPoints: input.behaviorPoints.map((point) => ({
      description: point.description,
      requiredEvidence: [...point.requiredEvidence],
    })),
    minimumSupportingEvidence: input.evaluationPolicy.minimumSupportingEvidence,
    followUpsUsed: input.interviewContext.followUpsUsed,
    maxFollowUps: input.interviewContext.maxFollowUps,
  };
}

export function evaluateEvidenceMaterial(material: EvidenceStateMaterial): EvidenceStateTrace {
  const states = extractBehaviorEvidenceStates(material);
  const decisions = states.map((state) => mapEvidenceState(state, material.minimumSupportingEvidence));
  return { states, decisions };
}

export function extractBehaviorEvidenceStates(material: EvidenceStateMaterial): BehaviorEvidenceState[] {
  const segments = transcriptSegments(material.transcript);
  const usableText = normalize(segments.map((segment) => segment.analysisText).join(" "));
  const lowInformation = usableText.length === 0 || LOW_INFORMATION_PATTERN.test(usableText);
  const globalContradiction = GLOBAL_CONTRADICTION_PATTERN.test(usableText);
  const behaviorCount = material.behaviorPoints.length;

  return material.behaviorPoints.map((behaviorPoint, behaviorIndex) => {
    const profile = profileFor(behaviorPoint.description, material);
    const transcriptRelevant = !lowInformation
      && isRelevantText(usableText, profile, behaviorPoint.description, material.unitDefinition);
    const directIndexes = new Set(
      segments
        .filter((segment) => isUsableSegment(segment) && isRelevantText(segment.analysisText, profile, behaviorPoint.description, ""))
        .map((segment) => segment.segmentIndex),
    );

    const selectedSegments = transcriptRelevant
      ? segments.filter((segment) => {
        if (!isUsableSegment(segment)) return false;
        if (behaviorCount === 1) return true;
        if (directIndexes.has(segment.segmentIndex)) return true;
        return isBridgeEvidence(segment, directIndexes);
      })
      : [];

    const stateSegments: EvidenceStateSegment[] = selectedSegments.map((segment) => {
      const contradicting = globalContradiction || NEGATIVE_ACTION_PATTERN.test(segment.analysisText);
      return {
        segmentIndex: segment.segmentIndex,
        quote: segment.quote,
        startChar: segment.startChar,
        endChar: segment.endChar,
        detectedEvidence: [...segment.detectedEvidence],
        disposition: contradicting ? "CONTRADICTING" : "SUPPORTING",
        direct: directIndexes.has(segment.segmentIndex),
      };
    });

    const supportingSegments = stateSegments.filter((segment) => segment.disposition === "SUPPORTING");
    const contradictingSegments = stateSegments.filter((segment) => segment.disposition === "CONTRADICTING");
    const observedSupporting = uniqueEvidenceTypes(supportingSegments.flatMap((segment) => segment.detectedEvidence));
    const genericOnly = GENERIC_PATTERN.test(usableText)
      && !hasAnyEvidence(observedSupporting, ["RATIONALE", "RESULT", "REFLECTION"]);
    const hasAction = observedSupporting.includes("ACTION");
    const relevance = stateSegments.length > 0 ? "DIRECT" as const : "NONE" as const;
    const agency = contradictingSegments.length > 0
      ? "CONTRADICTED" as const
      : relevance === "NONE"
        ? "NONE" as const
        : genericOnly || !hasAction
          ? "GENERIC" as const
          : "SELF" as const;
    const availableEvidence = agency === "CONTRADICTED"
      ? observedSupporting.filter((type) => type !== "ACTION" && type !== "RATIONALE")
      : observedSupporting;

    return {
      behaviorIndex,
      relevance,
      agency,
      requiredEvidence: [...behaviorPoint.requiredEvidence],
      availableEvidence,
      missingEvidence: behaviorPoint.requiredEvidence.filter((type) => !availableEvidence.includes(type)),
      supportingSegments,
      contradictingSegments,
      ignoredSignalSegmentCount: segments.filter((segment) => segment.ignoredSignal && !isUsableSegment(segment)).length,
    };
  });
}

export function mapEvidenceState(
  state: BehaviorEvidenceState,
  minimumSupportingEvidence = 1,
): EvidenceStateDecision {
  const evidenceCount = state.supportingSegments.length + state.contradictingSegments.length;
  let level: 1 | 2 | 3 | 4 | 5 | null;

  if (state.relevance === "NONE" || evidenceCount < minimumSupportingEvidence) {
    level = null;
  } else if (state.agency === "CONTRADICTED") {
    level = 1;
  } else if (state.agency === "GENERIC") {
    level = 2;
  } else {
    const hasAction = state.availableEvidence.includes("ACTION");
    const hasRationale = state.availableEvidence.includes("RATIONALE");
    const hasResult = state.availableEvidence.includes("RESULT");
    const hasReflection = state.availableEvidence.includes("REFLECTION");
    const hasSituation = state.availableEvidence.includes("SITUATION");

    if (!hasAction) level = 2;
    else if (hasReflection && hasRationale && hasResult) level = 5;
    else if (hasRationale && hasResult) level = 4;
    else if (hasRationale || hasResult || hasSituation) level = 3;
    else level = 2;
  }

  const status = level === null ? "INSUFFICIENT_EVIDENCE" : STATUS_BY_LEVEL[level];
  return {
    status,
    level,
    score: level === null ? null : NCS_SCORE_MAP[level],
    confidence: confidenceFor(state, level),
    rationale: rationaleFor(state, level),
    missingEvidence: level === null ? [...state.requiredEvidence] : [...state.missingEvidence],
  };
}

function toContractOutput(
  trace: EvidenceStateTrace,
  caseId: string,
  behaviorPointIds: string[],
  evaluator: Pick<EvidenceStateNcsEvaluator, "strategyId" | "promptVersion" | "model">,
  followUpsUsed: number,
  maxFollowUps: number,
): NcsEvaluationOutput {
  const evidences: NcsEvidence[] = [];
  const behaviorEvaluations: NcsBehaviorEvaluation[] = trace.states.map((state, index) => {
    const behaviorPointId = behaviorPointIds[index];
    const decision = trace.decisions[index];
    const stateEvidence = [...state.supportingSegments, ...state.contradictingSegments]
      .sort((left, right) => left.startChar - right.startChar || left.segmentIndex - right.segmentIndex);
    const evidenceBySegment = new Map<number, NcsEvidence>();

    for (const segment of stateEvidence) {
      const evidence: NcsEvidence = {
        evidenceId: `evidence-${state.behaviorIndex + 1}-${segment.segmentIndex + 1}-${segment.startChar}`,
        source: "ANSWER_TRANSCRIPT",
        quote: segment.quote,
        startChar: segment.startChar,
        endChar: segment.endChar,
        claimType: claimTypeFor(segment),
        behaviorPointIds: [behaviorPointId],
      };
      evidences.push(evidence);
      evidenceBySegment.set(segment.segmentIndex, evidence);
    }

    return {
      behaviorPointId,
      status: decision.status,
      level: decision.level,
      score: decision.score,
      rationale: decision.rationale,
      supportingEvidenceIds: state.supportingSegments
        .map((segment) => evidenceBySegment.get(segment.segmentIndex)?.evidenceId)
        .filter((id): id is string => Boolean(id)),
      contradictingEvidenceIds: state.contradictingSegments
        .map((segment) => evidenceBySegment.get(segment.segmentIndex)?.evidenceId)
        .filter((id): id is string => Boolean(id)),
      missingEvidence: decision.missingEvidence,
      confidence: decision.confidence,
    };
  });

  const assessableCount = behaviorEvaluations.length;
  const evaluatedCount = behaviorEvaluations.filter((evaluation) => evaluation.status !== "INSUFFICIENT_EVIDENCE").length;
  const ratio = evaluatedCount / assessableCount;
  const insufficient = behaviorEvaluations.filter((evaluation) => evaluation.status === "INSUFFICIENT_EVIDENCE");
  const followUpRequired = insufficient.length > 0 && followUpsUsed < maxFollowUps;
  const followUpMissingEvidence = uniqueEvidenceTypes(insufficient.flatMap((evaluation) => evaluation.missingEvidence));

  return {
    contractVersion: NCS_EVALUATION_CONTRACT_VERSION,
    caseId,
    evidences,
    behaviorEvaluations,
    coverage: {
      assessableBehaviorPointCount: assessableCount,
      evaluatedBehaviorPointCount: evaluatedCount,
      ratio,
      status: ratio === 0 ? "INSUFFICIENT" : ratio >= 0.8 ? "SUFFICIENT" : "LOW",
    },
    followUp: {
      required: followUpRequired,
      reason: followUpRequired ? "필수 행동 포인트를 판단할 직접 발화 근거가 부족합니다." : null,
      missingEvidence: followUpMissingEvidence,
      suggestedQuestion: followUpRequired ? followUpQuestion(followUpMissingEvidence) : null,
    },
    guardrail: {
      unsupportedFactDetected: false,
      sensitiveAttributeUsed: false,
      nonverbalSignalUsed: false,
      hiringDecisionLanguageDetected: false,
    },
    metadata: {
      strategyId: evaluator.strategyId,
      promptVersion: evaluator.promptVersion,
      model: evaluator.model,
    },
  };
}

function transcriptSegments(transcript: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let segmentIndex = 0;
  for (const match of transcript.matchAll(/(?:[^.!?\n]|\.(?=\d))+(?:[.!?]|$)/gu)) {
    const raw = match[0];
    const rawStart = match.index ?? 0;
    const leftTrim = raw.length - raw.trimStart().length;
    const quote = raw.trim();
    if (!quote) continue;
    const startChar = rawStart + leftTrim;
    const sanitized = normalize(quote.replace(PROHIBITED_SIGNAL_PATTERN, " "));
    segments.push({
      segmentIndex,
      quote,
      startChar,
      endChar: startChar + quote.length,
      analysisText: sanitized,
      detectedEvidence: detectEvidenceTypes(sanitized),
      ignoredSignal: sanitized !== normalize(quote),
    });
    segmentIndex += 1;
  }
  return segments;
}

function detectEvidenceTypes(text: string): NcsEvidenceType[] {
  const detected = new Set<NcsEvidenceType>();
  if (SITUATION_PATTERN.test(text)) detected.add("SITUATION");
  if (TASK_PATTERN.test(text)) detected.add("TASK");
  if (ACTION_PATTERN.test(text)) detected.add("ACTION");
  if (RATIONALE_PATTERN.test(text)) detected.add("RATIONALE");
  if (RESULT_PATTERN.test(text)) detected.add("RESULT");
  if (REFLECTION_PATTERN.test(text)) detected.add("REFLECTION");
  if (KNOWLEDGE_PATTERN.test(text)) detected.add("KNOWLEDGE");
  if (CONSTRAINT_PATTERN.test(text)) detected.add("CONSTRAINT");
  if (TRADEOFF_PATTERN.test(text)) detected.add("TRADEOFF");
  return EVIDENCE_TYPE_ORDER.filter((type) => detected.has(type));
}

function profileFor(description: string, material: EvidenceStateMaterial): ProfileRule {
  const matched = PROFILE_RULES.find((rule) => rule.intent.test(description));
  if (matched) return matched;
  const fallback = `${description} ${material.unitName} ${material.unitDefinition} ${material.questionContent}`;
  return PROFILE_RULES.find((rule) => rule.intent.test(fallback)) ?? {
    profile: "GENERAL",
    intent: /[\s\S]*/u,
    transcript: /[\s\S]*/u,
  };
}

function isRelevantText(text: string, profile: ProfileRule, description: string, fallback: string): boolean {
  if (!text || LOW_INFORMATION_PATTERN.test(text)) return false;
  if (profile.transcript.test(text)) return true;
  const keywords = semanticKeywords(`${description} ${fallback}`);
  return keywords.some((keyword) => text.includes(keyword));
}

function semanticKeywords(text: string): string[] {
  const stopwords = new Set(["행동", "근거", "수행", "확인", "바탕으로", "적절한", "필요한", "있는", "한다"]);
  return unique(
    (text.match(/[가-힣A-Za-z0-9]+/gu) ?? [])
      .map((token) => token.replace(/(으로|에서|에게|하고|하며|한다|있는|없는|한다)$/u, ""))
      .filter((token) => token.length >= 2 && !stopwords.has(token)),
  );
}

function isBridgeEvidence(segment: TranscriptSegment, directIndexes: Set<number>): boolean {
  const adjacentToDirect = directIndexes.has(segment.segmentIndex - 1) || directIndexes.has(segment.segmentIndex + 1);
  if (!adjacentToDirect || NEGATIVE_ACTION_PATTERN.test(segment.analysisText)) return false;
  return hasAnyEvidence(segment.detectedEvidence, ["RATIONALE", "RESULT", "REFLECTION"]);
}

function isUsableSegment(segment: TranscriptSegment): boolean {
  const safeText = segment.analysisText.replace(/[.!?,]/gu, "").trim();
  return safeText.length > 0 && !SAFE_FILLER_PATTERN.test(safeText);
}

function claimTypeFor(segment: EvidenceStateSegment): NcsClaimType {
  if (segment.disposition === "CONTRADICTING") return "CONTRADICTION";
  const priorities: NcsEvidenceType[] = [
    "REFLECTION",
    "RESULT",
    "TRADEOFF",
    "RATIONALE",
    "ACTION",
    "SITUATION",
    "CONSTRAINT",
    "TASK",
    "KNOWLEDGE",
  ];
  return priorities.find((type) => segment.detectedEvidence.includes(type)) ?? "KNOWLEDGE";
}

function confidenceFor(
  state: BehaviorEvidenceState,
  level: 1 | 2 | 3 | 4 | 5 | null,
): NcsEvaluationConfidence {
  if (level === null || level === 1 || state.agency === "GENERIC") return "LOW";
  const directSupportingCount = state.supportingSegments.filter((segment) => segment.direct).length;
  if (level >= 4 && directSupportingCount >= 2) return "HIGH";
  return directSupportingCount >= 1 ? "MEDIUM" : "LOW";
}

function rationaleFor(state: BehaviorEvidenceState, level: 1 | 2 | 3 | 4 | 5 | null): string {
  if (level === null) {
    return "행동 포인트와 의미상 연결되는 직접 발화 근거를 확인하지 못했습니다.";
  }
  if (level === 1) {
    return "관련 발화에서 수행을 부정하거나 앞선 설명과 충돌하는 근거가 확인되었습니다.";
  }
  if (level === 2) {
    return "관련 개념은 언급됐지만 본인이 수행한 구체 행동과 판단 연결이 제한적입니다.";
  }
  const observed = state.availableEvidence.join(", ");
  const missing = state.missingEvidence.length > 0 ? ` 누락 근거: ${state.missingEvidence.join(", ")}.` : "";
  return `검증된 발화에서 ${observed} 근거가 연결되어 ${level}단계로 판정했습니다.${missing}`;
}

function followUpQuestion(missingEvidence: NcsEvidenceType[]): string {
  const labels: Record<NcsEvidenceType, string> = {
    SITUATION: "당시 상황",
    TASK: "본인이 맡은 역할",
    ACTION: "본인이 직접 수행한 행동",
    RATIONALE: "그 행동을 선택한 이유",
    RESULT: "행동 이후 확인한 결과",
    REFLECTION: "이후 달라진 점",
    KNOWLEDGE: "당시 활용한 지식",
    CONSTRAINT: "당시 제약 조건",
    TRADEOFF: "검토한 대안과 선택 기준",
  };
  const targets = missingEvidence.map((type) => labels[type]);
  const targetText = targets.length > 0 ? targets.join(", ") : "구체적인 수행 근거";
  return `${targetText}을 실제 경험이나 판단 과정에 근거해 설명해 주세요.`;
}

function hasAnyEvidence(values: NcsEvidenceType[], targets: NcsEvidenceType[]): boolean {
  return targets.some((target) => values.includes(target));
}

function uniqueEvidenceTypes(values: NcsEvidenceType[]): NcsEvidenceType[] {
  const valueSet = new Set(values);
  return EVIDENCE_TYPE_ORDER.filter((type) => valueSet.has(type));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalize(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}
