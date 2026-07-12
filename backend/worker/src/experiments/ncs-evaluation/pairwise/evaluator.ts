import {
  NCS_EVALUATION_CONTRACT_VERSION,
  NCS_SCORE_MAP,
  NcsBehaviorEvaluation,
  NcsClaimType,
  NcsEvaluationInput,
  NcsEvaluationOutput,
  NcsEvaluationStatus,
  NcsEvaluationStrategy,
  NcsEvidence,
  NcsEvidenceType,
} from "../shared/contract";

type Level = 1 | 2 | 3 | 4 | 5;

interface TranscriptSegment {
  quote: string;
  startChar: number;
  endChar: number;
}

interface DecisionBehaviorPoint {
  description: string;
  requiredEvidence: NcsEvidenceType[];
}

interface DecisionInput {
  transcript: string;
  behaviorPoints: DecisionBehaviorPoint[];
}

interface EvidenceProfile {
  harmful: number;
  specificAction: number;
  rationale: number;
  result: number;
  reflection: number;
  generic: number;
}

interface BehaviorDecision {
  level: Level | null;
  relevantSegments: TranscriptSegment[];
  harmful: boolean;
  contradiction: boolean;
  missingEvidence: NcsEvidenceType[];
  profile: EvidenceProfile;
}

interface WeightedCue {
  pattern: RegExp;
  weight: number;
}

interface TopicLexicon {
  cues: WeightedCue[];
  evidencePattern: RegExp;
}

const TOPIC_LEXICONS: TopicLexicon[] = [
  {
    cues: [
      { pattern: /원인.*좁|복구 조치|재발 방지/, weight: 3 },
      { pattern: /징후|장애|해결 결과/, weight: 2 },
    ],
    evidencePattern: /장애|오류|경보|로그|서버|배포|설정|롤백|복구|정상화|재시작|지연|큐|토큰|원인|처리량|고객 문의/,
  },
  {
    cues: [
      { pattern: /실행 계획|병목|부작용/, weight: 3 },
      { pattern: /측정|개선안|성능/, weight: 2 },
    ],
    evidencePattern: /데이터베이스|DB|쿼리|인덱스|실행 계획|풀스캔|조회|응답|p95|캐시|성능|정렬 비용|부하|쓰기 지연|검색 API/i,
  },
  {
    cues: [
      { pattern: /테스트 범위|결함 수정|회귀/, weight: 3 },
      { pattern: /실패 위험|요구사항/, weight: 2 },
    ],
    evidencePattern: /테스트|결함|커버리지|회귀|경계값|요구사항|쿠폰|파일 업로드|회원가입|CI|품질|위험|결제 오류/i,
  },
  {
    cues: [
      { pattern: /수용 기준|상충 요구/, weight: 3 },
      { pattern: /이해관계자|요구사항/, weight: 2 },
    ],
    evidencePattern: /요구사항|요구해|요청했|담당자|이해관계자|수용 기준|합의|모호|상충|승인|프로토타입|결정표|변경 요청|의도|기능|사용자|문서|가입|검색/,
  },
  {
    cues: [
      { pattern: /상대.*관점|공동 목표|관계자.*공유/, weight: 3 },
      { pattern: /의견|합의|역할|조율/, weight: 2 },
    ],
    evidencePattern: /의견|팀|동료|합의|공유|관점|공동 목표|협업|회의|운영팀|개발팀|디자인|고객지원|관계자|역할|전달|조율|알리|듣|회고|템플릿|무중단|우선순위|배포 시점|중단 기준/,
  },
  {
    cues: [
      { pattern: /사실.*가설|문제.*구조/, weight: 3 },
      { pattern: /불확실|대안.*비교|필요한 정보/, weight: 2 },
    ],
    evidencePattern: /문제|정보|사실|가설|대안|자료|실험|검증|방법|원인|영향도|실행 비용|실패 비용|시한|로그|사용자 데이터|결과 지표|학습|검색|물어/,
  },
];

const LEVEL_ANCHORS: Record<Level, EvidenceProfile> = {
  1: { harmful: 1, specificAction: 0, rationale: 0, result: 0, reflection: 0, generic: 0 },
  2: { harmful: 0, specificAction: 0, rationale: 0, result: 0, reflection: 0, generic: 1 },
  3: { harmful: 0, specificAction: 1, rationale: 0.5, result: 0.5, reflection: 0, generic: 0 },
  4: { harmful: 0, specificAction: 1, rationale: 1, result: 1, reflection: 0, generic: 0 },
  5: { harmful: 0, specificAction: 1, rationale: 1, result: 1, reflection: 1, generic: 0 },
};

const PROFILE_WEIGHTS: EvidenceProfile = {
  harmful: 8,
  specificAction: 2,
  rationale: 1,
  result: 1,
  reflection: 2,
  generic: 1,
};

const STATUS_BY_LEVEL: Record<Level, Exclude<NcsEvaluationStatus, "INSUFFICIENT_EVIDENCE">> = {
  1: "NOT_DEMONSTRATED",
  2: "LIMITED",
  3: "DEVELOPING",
  4: "DEMONSTRATED",
  5: "STRONGLY_DEMONSTRATED",
};

const LOW_INFORMATION_PATTERN = /^(?:없습니다|잘 모르겠습니다|모르겠습니다|답변하기 어렵습니다)\.?$/;
const SENSITIVE_SIGNAL_PATTERN = /여성 지원자|남성 지원자|대학교\s*출신|대학.*출신|출신\s*학교|제 나이|저는\s*\d+세|외모|건강 상태|장애인|임신|종교/;
const NONVERBAL_SIGNAL_PATTERN = /표정|시선|눈맞춤|눈을 맞|억양|말속도|말투|목소리 톤|제스처|자세/;
const GENERIC_PATTERN = /보통|필요하면|중요하다고|알고 있습니다|하면 됩니다|하는 것이 중요|가능하면 커버리지|최선의 방법|인터넷을 검색|주변 사람에게 물어|서로 양보/;
const ACTION_PATTERN = /확인|비교|분석|적용|추가|수정|작성|질문|정리|공유|합의|선택|실행|검증|수집|나누|분리|롤백|재시작|테스트|전달|조율|구분|모니터링|도입|찾|기록|바꾸|변경|정했|확정|제안|문서화|측정|듣|물어|올렸|배포/;
const RATIONALE_PATTERN = /때문|위해|판단|기준|비교|위험|영향이 가장|비용|손실|목표|원인|풀스캔|정렬 비용|설정 변경|가설|장단점|수용 기준|경계값|중복|에 맞춰|에 따른/;
const RESULT_PATTERN = /줄었|내려갔|정상화|돌아왔|더 이상 .*발생하지|발견(?:해|했고).*수정|찾아 수정|승인을 받|합의(?:했|해|하여)|예정일에 .*배포|문제없이 배포|확정했습니다|오류를 줄|결함.*(?:찾|수정)|다시 만들|장애 시간이 더 길|오류가 발생|결과(?:를| 지표).*?(?:확인|판단|계속|되돌)|역할을 정|복구 시점을 전달|전달했습니다|증가했습니다/;
const REFLECTION_PATTERN = /재발|체크리스트|템플릿(?:에 반영|을 남)|모니터링.*(?:추가|배포|넣)|경보를 추가|CI 필수|과정과 학습을 기록|회고에서|같은 유형.*조기|상한.*추가/i;
const SITUATION_PATTERN = /발생|늘어|올라|느려|모호|달랐|충돌|위험|문제가 생겼|오류율|지연|요청|요구|부족|당시/;
const TASK_PATTERN = /맡|담당|역할|책임/;
const KNOWLEDGE_PATTERN = /알고 있습니다|중요하다고|단위 테스트|통합 테스트|실행 계획|인덱스|가설/;
const CONSTRAINT_PATTERN = /시한|일정|시간|영향도|고객 영향|데이터 손실|동시 사용자|실패 비용|제약/;
const TRADEOFF_PATTERN = /대안.*비교|비용.*비교|위험.*기준|쓰기 지연|중단 기준|단계 배포|영향도.*비용|조회 빈도.*쓰기 비용|장단점/;
const HARMFUL_PATTERN = /확인하지 않|보지 않|질문하지 않|듣지 않|알리지 않|테스트 없이|원인(?:은|을)?.*않|측정(?:은|을)?.*않|더 확인하지 않|처음 떠오른.*바로 적용|운이 나빴|추정해서 개발|제 방식대로|시간을 낭비|좋아졌을 것|다른 팀.*복구|전달받/;
const CONTRADICTION_OPEN_PATTERN = /처음에는|본 질문에서는/;
const CONTRADICTION_CLOSE_PATTERN = /하지만|그러나|실제로는|다시 확인하니/;

const TERM_STOP_WORDS = new Set([
  "관찰", "가능", "바탕", "행동", "수행", "근거", "적절", "해당", "통해", "있는", "하고", "한다",
]);

export class PairwiseAnchorEvaluator implements NcsEvaluationStrategy {
  readonly strategyId = "pairwise-anchor-deterministic";
  readonly promptVersion = "pairwise-generic-anchors-v1";
  readonly model = "deterministic-local-pairwise-v1";

  evaluate(input: NcsEvaluationInput): NcsEvaluationOutput {
    const decisionInput: DecisionInput = {
      transcript: input.answer.transcript,
      behaviorPoints: input.behaviorPoints.map(({ description, requiredEvidence }) => ({
        description,
        requiredEvidence: [...requiredEvidence],
      })),
    };
    const decisions = evaluateDecisionInput(decisionInput);
    const evidences: NcsEvidence[] = [];
    const behaviorEvaluations: NcsBehaviorEvaluation[] = decisions.map((decision, index) => {
      const behaviorPoint = input.behaviorPoints[index];
      const behaviorEvidence = decision.relevantSegments.map((segment) => makeEvidence(
        behaviorPoint.behaviorPointId,
        segment,
        decision.harmful || decision.contradiction,
      ));
      evidences.push(...behaviorEvidence);
      const evidenceIds = behaviorEvidence.map(({ evidenceId }) => evidenceId);
      const level = decision.level;
      return {
        behaviorPointId: behaviorPoint.behaviorPointId,
        status: level === null ? "INSUFFICIENT_EVIDENCE" : STATUS_BY_LEVEL[level],
        level,
        score: level === null ? null : NCS_SCORE_MAP[level],
        rationale: rationaleFor(decision),
        supportingEvidenceIds: level !== null && !decision.harmful && !decision.contradiction ? evidenceIds : [],
        contradictingEvidenceIds: level !== null && (decision.harmful || decision.contradiction) ? evidenceIds : [],
        missingEvidence: decision.missingEvidence,
        confidence: confidenceFor(decision),
      };
    });

    const assessableCount = behaviorEvaluations.length;
    const evaluatedCount = behaviorEvaluations.filter(({ level }) => level !== null).length;
    const ratio = evaluatedCount / assessableCount;
    const insufficient = behaviorEvaluations.filter(({ level }) => level === null);
    const followUpRequired = insufficient.length > 0
      && input.interviewContext.followUpsUsed < input.interviewContext.maxFollowUps;
    const missingEvidence = unique(insufficient.flatMap(({ missingEvidence: missing }) => missing));

    return {
      contractVersion: NCS_EVALUATION_CONTRACT_VERSION,
      caseId: input.caseId,
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
        reason: followUpRequired ? "행동 포인트를 판정할 관련 발화 근거가 부족합니다." : null,
        missingEvidence,
        suggestedQuestion: followUpRequired ? followUpQuestion(missingEvidence) : null,
      },
      guardrail: {
        unsupportedFactDetected: false,
        sensitiveAttributeUsed: false,
        nonverbalSignalUsed: false,
        hiringDecisionLanguageDetected: false,
      },
      metadata: {
        strategyId: this.strategyId,
        promptVersion: this.promptVersion,
        model: this.model,
      },
    };
  }
}

function evaluateDecisionInput(input: DecisionInput): BehaviorDecision[] {
  const segments = transcriptSegments(input.transcript);
  return input.behaviorPoints.map((behaviorPoint) => evaluateBehaviorPoint(segments, behaviorPoint));
}

function evaluateBehaviorPoint(
  segments: TranscriptSegment[],
  behaviorPoint: DecisionBehaviorPoint,
): BehaviorDecision {
  const topic = selectTopic(behaviorPoint.description);
  const contextTerms = meaningfulTerms(behaviorPoint.description);
  const relevantSegments = segments.filter((segment) => {
    if (SENSITIVE_SIGNAL_PATTERN.test(segment.quote) || NONVERBAL_SIGNAL_PATTERN.test(segment.quote)) return false;
    return topic.evidencePattern.test(segment.quote) || contextTerms.some((term) => segment.quote.includes(term));
  });
  const relevantText = relevantSegments.map(({ quote }) => quote).join(" ");
  if (!relevantText || LOW_INFORMATION_PATTERN.test(relevantText.trim())) {
    return {
      level: null,
      relevantSegments: [],
      harmful: false,
      contradiction: false,
      missingEvidence: [...behaviorPoint.requiredEvidence],
      profile: emptyProfile(),
    };
  }

  const contradiction = CONTRADICTION_OPEN_PATTERN.test(relevantText)
    && CONTRADICTION_CLOSE_PATTERN.test(relevantText);
  const harmful = contradiction || HARMFUL_PATTERN.test(relevantText);
  const generic = GENERIC_PATTERN.test(relevantText);
  const hasAction = ACTION_PATTERN.test(relevantText);
  const profile: EvidenceProfile = {
    harmful: harmful ? 1 : 0,
    specificAction: hasAction && !generic && !harmful ? 1 : 0,
    rationale: RATIONALE_PATTERN.test(relevantText) ? 1 : 0,
    result: RESULT_PATTERN.test(relevantText) ? 1 : 0,
    reflection: REFLECTION_PATTERN.test(relevantText) ? 1 : 0,
    generic: generic ? 1 : 0,
  };
  const level = chooseLevelByAdjacentAnchors(profile);
  return {
    level,
    relevantSegments,
    harmful,
    contradiction,
    missingEvidence: missingEvidenceFor(behaviorPoint.requiredEvidence, relevantText, generic, harmful),
    profile,
  };
}

function chooseLevelByAdjacentAnchors(profile: EvidenceProfile): Level {
  let selected: Level = 1;
  for (const upper of [2, 3, 4, 5] as const) {
    const comparison = compareAdjacentAnchors(profile, selected, upper);
    if (comparison !== "UPPER") break;
    selected = upper;
  }
  return selected;
}

function compareAdjacentAnchors(
  profile: EvidenceProfile,
  lower: Level,
  upper: Level,
): "LOWER" | "UPPER" {
  const lowerDistance = anchorDistance(profile, LEVEL_ANCHORS[lower]);
  const upperDistance = anchorDistance(profile, LEVEL_ANCHORS[upper]);
  const forwardMargin = lowerDistance - upperDistance;
  const reverseMargin = upperDistance - lowerDistance;
  const balancedMargin = (forwardMargin - reverseMargin) / 2;
  return balancedMargin > 0 ? "UPPER" : "LOWER";
}

function anchorDistance(profile: EvidenceProfile, anchor: EvidenceProfile): number {
  return (Object.keys(profile) as Array<keyof EvidenceProfile>).reduce(
    (distance, key) => distance + Math.abs(profile[key] - anchor[key]) * PROFILE_WEIGHTS[key],
    0,
  );
}

function selectTopic(description: string): TopicLexicon {
  let selected = TOPIC_LEXICONS[0];
  let selectedScore = Number.NEGATIVE_INFINITY;
  for (const topic of TOPIC_LEXICONS) {
    const score = topic.cues.reduce(
      (sum, cue) => sum + (cue.pattern.test(description) ? cue.weight : 0),
      0,
    );
    if (score > selectedScore) {
      selected = topic;
      selectedScore = score;
    }
  }
  return selected;
}

function meaningfulTerms(text: string): string[] {
  const tokens = text.match(/[가-힣A-Za-z0-9]+/g) ?? [];
  return unique(tokens
    .map((token) => token.replace(/(?:으로|에서|에게|까지|부터|하고|하며|하여|해서|하도록|한다|하는|있는|있다|된다|을|를|이|가|은|는|과|와|의|에|로)$/u, ""))
    .filter((token) => token.length >= 2 && !TERM_STOP_WORDS.has(token)));
}

function transcriptSegments(transcript: string): TranscriptSegment[] {
  const normalized = transcript.trim();
  if (!normalized || LOW_INFORMATION_PATTERN.test(normalized)) return [];
  const segments: TranscriptSegment[] = [];
  for (const match of transcript.matchAll(/(?:[^.!?\n]|\.(?=\d))+(?:[.!?]|$)/gu)) {
    const raw = match[0];
    const rawStart = match.index ?? 0;
    const leftTrim = raw.length - raw.trimStart().length;
    const quote = raw.trim();
    if (!quote) continue;
    const startChar = rawStart + leftTrim;
    segments.push({ quote, startChar, endChar: startChar + quote.length });
  }
  return segments;
}

function makeEvidence(
  behaviorPointId: string,
  segment: TranscriptSegment,
  contradiction: boolean,
): NcsEvidence {
  return {
    evidenceId: `pairwise-${stableHash(behaviorPointId)}-${segment.startChar}-${segment.endChar}`,
    source: "ANSWER_TRANSCRIPT",
    quote: segment.quote,
    startChar: segment.startChar,
    endChar: segment.endChar,
    claimType: contradiction ? "CONTRADICTION" : claimTypeFor(segment.quote),
    behaviorPointIds: [behaviorPointId],
  };
}

function claimTypeFor(quote: string): NcsClaimType {
  if (REFLECTION_PATTERN.test(quote)) return "REFLECTION";
  if (TRADEOFF_PATTERN.test(quote)) return "TRADEOFF";
  if (RESULT_PATTERN.test(quote)) return "RESULT";
  if (RATIONALE_PATTERN.test(quote)) return "RATIONALE";
  if (ACTION_PATTERN.test(quote)) return "ACTION";
  if (SITUATION_PATTERN.test(quote)) return "SITUATION";
  return "KNOWLEDGE";
}

function missingEvidenceFor(
  required: NcsEvidenceType[],
  text: string,
  generic: boolean,
  harmful: boolean,
): NcsEvidenceType[] {
  const available: Record<NcsEvidenceType, boolean> = {
    SITUATION: SITUATION_PATTERN.test(text) && !generic,
    TASK: TASK_PATTERN.test(text),
    ACTION: ACTION_PATTERN.test(text) && !harmful,
    RATIONALE: RATIONALE_PATTERN.test(text) && !harmful,
    RESULT: RESULT_PATTERN.test(text),
    REFLECTION: REFLECTION_PATTERN.test(text) && !harmful,
    KNOWLEDGE: KNOWLEDGE_PATTERN.test(text),
    CONSTRAINT: CONSTRAINT_PATTERN.test(text),
    TRADEOFF: TRADEOFF_PATTERN.test(text) && !harmful,
  };
  return required.filter((type) => !available[type]);
}

function rationaleFor(decision: BehaviorDecision): string {
  if (decision.level === null) {
    return "행동 포인트와 의미상 연결되는 발화 근거를 찾지 못했습니다.";
  }
  if (decision.level === 1) {
    return "관련 발화에서 수행을 부정하는 행동 또는 자기모순이 확인되어 1단계 앵커에 더 가깝다고 판정했습니다.";
  }
  if (decision.level === 2) {
    return "관련 발화는 있으나 본인의 구체적 수행이 확인되지 않아 2단계 앵커에 더 가깝다고 판정했습니다.";
  }
  if (decision.level === 3) {
    return "본인의 관련 행동은 확인되지만 판단 근거와 결과가 모두 연결되지는 않아 3단계 앵커에 더 가깝다고 판정했습니다.";
  }
  if (decision.level === 4) {
    return "관련 행동, 선택 근거, 확인된 결과가 연결되어 4단계 앵커에 더 가깝다고 판정했습니다.";
  }
  return "관련 행동, 선택 근거, 결과와 후속 개선이 함께 확인되어 5단계 앵커에 더 가깝다고 판정했습니다.";
}

function confidenceFor(decision: BehaviorDecision): "HIGH" | "MEDIUM" | "LOW" {
  if (decision.level === null || decision.level === 2) return "LOW";
  if (decision.contradiction || decision.relevantSegments.length >= 2) return "HIGH";
  return "MEDIUM";
}

function followUpQuestion(missingEvidence: NcsEvidenceType[]): string {
  const labels: Partial<Record<NcsEvidenceType, string>> = {
    SITUATION: "당시 확인한 상황",
    TASK: "본인이 맡은 범위",
    ACTION: "본인이 직접 한 행동",
    RATIONALE: "판단에 사용한 근거",
    RESULT: "행동 뒤 확인한 결과",
    REFLECTION: "이후 확인하거나 개선한 점",
    KNOWLEDGE: "사용한 지식",
    CONSTRAINT: "당시 제약",
    TRADEOFF: "검토한 대안",
  };
  const targets = missingEvidence.map((type) => labels[type]).filter((label): label is string => Boolean(label));
  return `${targets.join(", ") || "구체적인 수행 근거"}을 실제 경험에서 확인된 내용만으로 설명해 주세요.`;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function emptyProfile(): EvidenceProfile {
  return { harmful: 0, specificAction: 0, rationale: 0, result: 0, reflection: 0, generic: 0 };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
