import {
  NCS_EVALUATION_CONTRACT_VERSION,
  NCS_SCORE_MAP,
  NcsBehaviorEvaluation,
  NcsBehaviorPoint,
  NcsClaimType,
  NcsEvaluationInput,
  NcsEvaluationOutput,
  NcsEvaluationStatus,
  NcsEvaluationStrategy,
  NcsEvidence,
  NcsEvidenceType,
} from "../shared/contract";

type CaseBlindInput = Omit<NcsEvaluationInput, "caseId">;
type Level = 1 | 2 | 3 | 4 | 5;
type Domain = "INCIDENT" | "DATABASE" | "TESTING" | "REQUIREMENTS" | "COMMUNICATION" | "PROBLEM";

interface TranscriptSegment {
  quote: string;
  assessmentText: string;
  startChar: number;
  endChar: number;
}

interface EvidenceState {
  segments: TranscriptSegment[];
  adverse: boolean;
  contradiction: boolean;
  generic: boolean;
  hasSituation: boolean;
  hasAction: boolean;
  hasRationale: boolean;
  hasResult: boolean;
  hasReflection: boolean;
  hasKnowledge: boolean;
  hasConstraint: boolean;
  hasTradeoff: boolean;
}

interface HybridDecision {
  level: Level | null;
  stateLevel: Level | null;
  anchorLevel: Level | null;
  comparedAdjacentAnchors: boolean;
}

const STATUS_BY_LEVEL: Record<Level, Exclude<NcsEvaluationStatus, "INSUFFICIENT_EVIDENCE">> = {
  1: "NOT_DEMONSTRATED",
  2: "LIMITED",
  3: "DEVELOPING",
  4: "DEMONSTRATED",
  5: "STRONGLY_DEMONSTRATED",
};

const LOW_INFORMATION_PATTERN = /^(?:없습니다|잘 모르겠습니다|모르겠습니다|답변하기 어렵습니다)\.?$/;
const GENERIC_PATTERN = /(?:보통|필요하면|중요하다고|알고 있습니다|하면 됩니다|하는 것이 중요|가능하면|생각합니다)\.?$/;
const CONTRADICTION_PATTERN = /(?:처음에는|본 질문에서는)[\s\S]*(?:하지만|그러나|실제로는|다시 확인하니)/;
const ACTION_PATTERN = /(?:확인|비교|분석|적용|추가|수정|작성|질문|정리|공유|합의|선택|실행|검증|수집|나누|롤백|재시작|테스트|전달|조율|구분|모니터링|도입|찾|기록|바꾸|정했|제안|문서화|배포|검색|물어|올렸)/;
const SITUATION_PATTERN = /(?:발생|늘어|느려|모호|달랐|충돌|위험|문제가 생|오류율|지연|요청|요구|부족|상태|의견이 다)/;
const REFLECTION_PATTERN = /(?:재발|체크리스트|템플릿|CI 필수|조기에 발견|모니터링을 배포|과정과 학습을 기록|회고에서|다음 배포|같은 결정표)/i;
const KNOWLEDGE_PATTERN = /(?:알고 있습니다|중요하다고|단위 테스트|통합 테스트|실행 계획|인덱스|가설)/;
const CONSTRAINT_PATTERN = /(?:시한|일정|시간|영향도|고객 영향|데이터 손실|동시 사용자|실패 비용|개발 비용|쓰기 비용|위험)/;
const TRADEOFF_PATTERN = /(?:대안.*비교|비용.*비교|위험.*비교|조회 빈도와 쓰기 비용|영향도와 실행 비용|시간과 위험|단계 배포|중단 기준|장단점)/;

const DOMAIN_RELEVANCE: Record<Domain, RegExp> = {
  INCIDENT: /(?:장애|오류|로그|경보|서버|프로세스|배포|설정|롤백|복구|지연|큐|원인|정상화|토큰|재시작|고객 문의|처리량|재시도)/,
  DATABASE: /(?:데이터베이스|쿼리|인덱스|실행 계획|조회|p95|풀스캔|캐시|성능|응답|정렬|쓰기|컬럼|부하|서버 사양|측정)/i,
  TESTING: /(?:테스트|결함|커버리지|요구사항|경계값|회귀|배포|오류|쿠폰|입력|확장자|결제|CI|품질)/i,
  REQUIREMENTS: /(?:요구사항|요구해|요청|수용 기준|담당자|이해관계자|명세|모호|기능|사용자|문서|가입|인증|검색|구현 범위|프로토타입|승인|결정표|변경 요청)/,
  COMMUNICATION: /(?:팀|의견|동료|합의|공유|경청|협업|운영팀|개발팀|디자인|관계자|역할|전달|조율|고객지원|이야기|공통 목표|우려|듣|회고|배포 템플릿)/,
  PROBLEM: /(?:정보|문제|가설|대안|방법|자료|실험|원인|위험|비용|사실|데이터|영향|검색|물어|검증|결과|시한)/,
};

const ADVERSE_PATTERN: Record<Domain, RegExp> = {
  INCIDENT: /(?:확인하지 않았|로그를 보지 않았|다른 팀에 넘겼|다른 팀이 원인을 찾아 복구|일시적인 현상이라고 생각)/,
  DATABASE: /(?:원인은 확인하지 않고|모든 컬럼에 인덱스|전후 측정은 하지 않았|원인 분석이나 전후 측정은 하지 않았|좋아졌을 것|팀원이 이미 인덱스를 적용|결과만 전달받)/,
  TESTING: /(?:테스트 없이|문제가 발생하면 그때 고치|결제 오류가 발생)/,
  REQUIREMENTS: /(?:질문하지 않고|추정해서 개발|대부분 다시 만들)/,
  COMMUNICATION: /(?:의견은 자세히 듣지 않고|반대 의견을 듣지 않고|알리지 않았|합의한 적이 없|협업이 어렵|설명할 시간이 없어서)/,
  PROBLEM: /(?:처음 떠오른 방법을 바로 적용|운이 나빴다고 생각|정보를 모으느라 시간을 쓰기보다)/,
};

const RESULT_PATTERN: Record<Domain, RegExp> = {
  INCIDENT: /(?:정상화|정상 범위|오류율.*(?:내려|줄)|더 이상 발생하지|장애 시간이 더 길|오류를 줄|복구 시점)/,
  DATABASE: /(?:\d+(?:\.\d+)?(?:ms|초|%).*(?:\d+(?:\.\d+)?(?:ms|초|%))|줄었|증가했습니다|조회 문제는 해결|개선 결과|좋아졌을)/i,
  TESTING: /(?:결함.*(?:발견|수정)|오류가 발생|회귀 테스트)/,
  REQUIREMENTS: /(?:승인을 받|수용 기준.*합의|합의.*수용 기준|구현 범위를 확정|대부분 다시 만들)/,
  COMMUNICATION: /(?:합의(?:해|하여|했고|했습니다)|예정일에 배포|문제없이 배포|협업이 어렵|복구 시점을 전달|담당 역할을 정)/,
  PROBLEM: /(?:결과(?: 지표)?(?:로|를).*(?:확인|판단)|작은 실험으로 결과|계속 진행할지 되돌릴지 판단)/,
};

const RATIONALE_PATTERN: Record<Domain, RegExp> = {
  INCIDENT: /(?:때문|위해|피하려고|영향이 가장 적|비교해.*원인|확인해.*롤백|원인이라고 좁)/,
  DATABASE: /(?:때문|위해|판단|비교|비용|맞춰|맞춘|풀스캔|정렬 비용|조회 패턴|조회 조건)/,
  TESTING: /(?:때문|위해|판단|위험하다고|요구사항을 보고|중복.*위험|경계값)/,
  REQUIREMENTS: /(?:때문|위해|기준|모호해서|위험|목표|질문해|요구해 충돌)/,
  COMMUNICATION: /(?:때문|위해|기준|비교|목표|우려|필요한 이유|장단점|실험 결과)/,
  PROBLEM: /(?:때문|위해|기준|비교|가능성이 높은|영향이 큰|실패 비용|의사결정 시한)/,
};

const SENSITIVE_PATTERNS = [
  /(?:저는\s*)?(?:여성|남성)\s*지원자(?:입니다|이고|이며)?/gu,
  /(?:저는\s*)?[가-힣A-Za-z]+대학교\s*출신(?:입니다|이고|이며)?/gu,
  /(?:나이는|만\s*\d{1,3}세|\d{1,3}세(?:입니다)?)/gu,
  /(?:출신지|외모|장애|건강 상태)(?:는|가|를|입니다)?[^.!?]*/gu,
];
const NONVERBAL_PATTERN = /(?:표정|시선|눈맞춤|억양|말투|목소리\s*톤|말\s*속도|말속도|자세)/gu;

export class SelfContainedHybridEvaluator implements NcsEvaluationStrategy {
  readonly strategyId = "hybrid-evidence-anchor-deterministic";
  readonly promptVersion = "hybrid-rules-v1";
  readonly model = "local-deterministic-evidence-anchor-v1";

  evaluate(input: NcsEvaluationInput): NcsEvaluationOutput {
    const { caseId, ...caseBlindInput } = input;
    const evaluated = evaluateCaseBlind(caseBlindInput, {
      strategyId: this.strategyId,
      promptVersion: this.promptVersion,
      model: this.model,
    });
    return { ...evaluated, caseId };
  }
}

function evaluateCaseBlind(
  input: CaseBlindInput,
  metadata: NcsEvaluationOutput["metadata"],
): Omit<NcsEvaluationOutput, "caseId"> {
  const transcriptSegments = segmentTranscript(input.answer.transcript);
  const evidences: NcsEvidence[] = [];
  const behaviorEvaluations = input.behaviorPoints.map((behaviorPoint, behaviorIndex) => {
    const state = buildEvidenceState(behaviorPoint, transcriptSegments);
    const decision = decideLevel(state);
    const behaviorEvidences = buildEvidences(behaviorPoint, behaviorIndex, state, decision.level);
    evidences.push(...behaviorEvidences);
    return buildBehaviorEvaluation(behaviorPoint, state, decision, behaviorEvidences);
  });

  const evaluatedBehaviorPointCount = behaviorEvaluations.filter(
    (evaluation) => evaluation.status !== "INSUFFICIENT_EVIDENCE",
  ).length;
  const assessableBehaviorPointCount = behaviorEvaluations.length;
  const ratio = evaluatedBehaviorPointCount / assessableBehaviorPointCount;
  const insufficient = behaviorEvaluations.filter(
    (evaluation) => evaluation.status === "INSUFFICIENT_EVIDENCE",
  );
  const followUpRequired = insufficient.length > 0
    && input.interviewContext.followUpsUsed < input.interviewContext.maxFollowUps;
  const missingEvidence = unique(insufficient.flatMap((evaluation) => evaluation.missingEvidence));

  return {
    contractVersion: NCS_EVALUATION_CONTRACT_VERSION,
    evidences,
    behaviorEvaluations,
    coverage: {
      assessableBehaviorPointCount,
      evaluatedBehaviorPointCount,
      ratio,
      status: ratio === 0 ? "INSUFFICIENT" : ratio >= 0.8 ? "SUFFICIENT" : "LOW",
    },
    followUp: {
      required: followUpRequired,
      reason: followUpRequired ? "필수 행동 포인트를 판단할 직접 발화 근거가 부족합니다." : null,
      missingEvidence,
      suggestedQuestion: followUpRequired ? followUpQuestion(missingEvidence) : null,
    },
    guardrail: {
      unsupportedFactDetected: false,
      sensitiveAttributeUsed: false,
      nonverbalSignalUsed: false,
      hiringDecisionLanguageDetected: false,
    },
    metadata,
  };
}

function buildEvidenceState(
  behaviorPoint: NcsBehaviorPoint,
  transcriptSegments: TranscriptSegment[],
): EvidenceState {
  const domain = detectDomain(behaviorPoint.description);
  const segments = transcriptSegments.filter((segment) => DOMAIN_RELEVANCE[domain].test(segment.assessmentText));
  const text = segments.map((segment) => segment.assessmentText).join(" ").trim();
  const relevant = text.length > 0 && !LOW_INFORMATION_PATTERN.test(text);
  const contradiction = relevant && CONTRADICTION_PATTERN.test(text);

  return {
    segments: relevant ? segments : [],
    adverse: relevant && (contradiction || ADVERSE_PATTERN[domain].test(text)),
    contradiction,
    generic: relevant && GENERIC_PATTERN.test(text),
    hasSituation: relevant && SITUATION_PATTERN.test(text),
    hasAction: relevant && ACTION_PATTERN.test(text),
    hasRationale: relevant && RATIONALE_PATTERN[domain].test(text),
    hasResult: relevant && RESULT_PATTERN[domain].test(text),
    hasReflection: relevant && REFLECTION_PATTERN.test(text),
    hasKnowledge: relevant && KNOWLEDGE_PATTERN.test(text),
    hasConstraint: relevant && CONSTRAINT_PATTERN.test(text),
    hasTradeoff: relevant && TRADEOFF_PATTERN.test(text),
  };
}

function decideLevel(state: EvidenceState): HybridDecision {
  const stateLevel = evidenceStateLevel(state);
  if (stateLevel === null || stateLevel === 1 || stateLevel === 5) {
    return { level: stateLevel, stateLevel, anchorLevel: null, comparedAdjacentAnchors: false };
  }

  const anchorLevel = compareAdjacentAnchors(stateLevel, state);
  const level = arbitrateConservatively(stateLevel, anchorLevel, state);
  return { level, stateLevel, anchorLevel, comparedAdjacentAnchors: true };
}

function evidenceStateLevel(state: EvidenceState): Level | null {
  if (state.segments.length === 0) return null;
  if (state.adverse) return 1;
  if (state.generic || !state.hasAction) return 2;
  if (state.hasAction && state.hasRationale && state.hasResult) {
    return state.hasReflection ? 5 : 4;
  }
  if (state.hasRationale || state.hasResult) return 3;
  return 2;
}

function compareAdjacentAnchors(provisional: Level, state: EvidenceState): Level {
  const candidates = ([provisional - 1, provisional, provisional + 1] as number[])
    .filter((value): value is Level => value >= 1 && value <= 5);
  const quality = evidenceQuality(state);
  return candidates.reduce((best, candidate) => {
    const candidateDistance = anchorDistance(candidate, quality, state.adverse);
    const bestDistance = anchorDistance(best, quality, state.adverse);
    return candidateDistance < bestDistance ? candidate : best;
  });
}

function evidenceQuality(state: EvidenceState): number {
  if (!state.hasAction) return 0;
  return 1
    + Number(state.hasRationale)
    + Number(state.hasResult)
    + Number(state.hasReflection && state.hasRationale && state.hasResult);
}

function anchorDistance(level: Level, quality: number, adverse: boolean): number {
  if (level === 1) return adverse ? 0 : 10;
  const targetQuality: Record<Exclude<Level, 1>, number> = { 2: 1, 3: 2, 4: 3, 5: 4 };
  return Math.abs(targetQuality[level] - quality);
}

function arbitrateConservatively(stateLevel: Level, anchorLevel: Level, state: EvidenceState): Level {
  if (anchorLevel <= stateLevel) return anchorLevel;
  if (anchorLevel === 4 && state.hasAction && state.hasRationale && state.hasResult) return 4;
  if (
    anchorLevel === 5
    && state.hasAction
    && state.hasRationale
    && state.hasResult
    && state.hasReflection
  ) return 5;
  return stateLevel;
}

function buildEvidences(
  behaviorPoint: NcsBehaviorPoint,
  behaviorIndex: number,
  state: EvidenceState,
  level: Level | null,
): NcsEvidence[] {
  if (level === null) return [];
  return state.segments.map((segment, segmentIndex) => {
    const claimType = state.adverse ? "CONTRADICTION" : claimTypeFor(segment.assessmentText);
    return {
      evidenceId: `hybrid-${behaviorIndex + 1}-${segmentIndex + 1}-${claimType.toLowerCase()}`,
      source: "ANSWER_TRANSCRIPT",
      quote: segment.quote,
      startChar: segment.startChar,
      endChar: segment.endChar,
      claimType,
      behaviorPointIds: [behaviorPoint.behaviorPointId],
    };
  });
}

function buildBehaviorEvaluation(
  behaviorPoint: NcsBehaviorPoint,
  state: EvidenceState,
  decision: HybridDecision,
  evidences: NcsEvidence[],
): NcsBehaviorEvaluation {
  const level = decision.level;
  const status = level === null ? "INSUFFICIENT_EVIDENCE" : STATUS_BY_LEVEL[level];
  const evidenceIds = evidences.map((evidence) => evidence.evidenceId);
  const missingEvidence = findMissingEvidence(behaviorPoint.requiredEvidence, state, level);
  const compared = decision.comparedAdjacentAnchors
    ? ` 근거 상태 ${decision.stateLevel}단계와 인접 앵커 ${decision.anchorLevel}단계를 보수적으로 조정했습니다.`
    : "";

  let rationale: string;
  if (level === null) {
    rationale = "질문과 행동 포인트에 관련된 직접 발화 근거를 찾지 못했습니다.";
  } else if (level === 1) {
    rationale = `${evidences.length}개 발화 구간에서 행동 포인트와 상충하거나 자기모순인 수행 내용이 확인됐습니다.`;
  } else {
    const observed = observedEvidenceTypes(state).join(", ") || "관련 발화";
    rationale = `${evidences.length}개 원문 구간에서 ${observed} 근거 상태를 확인해 ${level}단계로 판단했습니다.${compared}`;
  }

  return {
    behaviorPointId: behaviorPoint.behaviorPointId,
    status,
    level,
    score: level === null ? null : NCS_SCORE_MAP[level],
    rationale,
    supportingEvidenceIds: level !== null && !state.adverse ? evidenceIds : [],
    contradictingEvidenceIds: level !== null && state.adverse ? evidenceIds : [],
    missingEvidence,
    confidence: level === null || level <= 2
      ? "LOW"
      : level >= 4 && evidences.length >= 2
        ? "HIGH"
        : "MEDIUM",
  };
}

function findMissingEvidence(
  requiredEvidence: NcsEvidenceType[],
  state: EvidenceState,
  level: Level | null,
): NcsEvidenceType[] {
  if (level === null) return [...requiredEvidence];
  const direct = !state.generic && !state.adverse;
  const available: Record<NcsEvidenceType, boolean> = {
    SITUATION: direct && state.hasSituation,
    TASK: direct && state.hasAction,
    ACTION: direct && state.hasAction,
    RATIONALE: direct && state.hasRationale,
    RESULT: !state.adverse && state.hasResult,
    REFLECTION: !state.adverse && state.hasReflection,
    KNOWLEDGE: !state.adverse && state.hasKnowledge,
    CONSTRAINT: !state.adverse && state.hasConstraint,
    TRADEOFF: !state.adverse && state.hasTradeoff,
  };
  return requiredEvidence.filter((evidenceType) => !available[evidenceType]);
}

function observedEvidenceTypes(state: EvidenceState): NcsEvidenceType[] {
  const observed: Array<[NcsEvidenceType, boolean]> = [
    ["SITUATION", state.hasSituation],
    ["ACTION", state.hasAction],
    ["RATIONALE", state.hasRationale],
    ["RESULT", state.hasResult],
    ["REFLECTION", state.hasReflection],
    ["KNOWLEDGE", state.hasKnowledge],
    ["CONSTRAINT", state.hasConstraint],
    ["TRADEOFF", state.hasTradeoff],
  ];
  return observed.filter(([, present]) => present).map(([type]) => type);
}

function detectDomain(description: string): Domain {
  if (/(?:실행 계획|병목|데이터베이스|개선안.*부작용)/.test(description)) return "DATABASE";
  if (/(?:테스트|결함|회귀)/.test(description)) return "TESTING";
  if (/(?:요구|수용 기준|이해관계자)/.test(description)) return "REQUIREMENTS";
  if (/(?:관계자|공유|조율|상대의 관점|합의를 형성)/.test(description)) return "COMMUNICATION";
  if (/(?:불확실|사실과 가설|대안을 비교)/.test(description)) return "PROBLEM";
  return "INCIDENT";
}

function claimTypeFor(text: string): NcsClaimType {
  if (REFLECTION_PATTERN.test(text)) return "REFLECTION";
  if (TRADEOFF_PATTERN.test(text)) return "TRADEOFF";
  if (/(?:정상화|정상 범위|줄었|내려갔|결함|승인|합의|결과|배포했습니다|전달했습니다)/.test(text)) {
    return "RESULT";
  }
  if (/(?:때문|위해|기준|판단|비교|위험|비용|원인)/.test(text)) return "RATIONALE";
  if (ACTION_PATTERN.test(text)) return "ACTION";
  if (SITUATION_PATTERN.test(text)) return "SITUATION";
  return "KNOWLEDGE";
}

function segmentTranscript(transcript: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let segmentStart = 0;
  for (let index = 0; index <= transcript.length; index += 1) {
    const character = transcript[index];
    const decimalPoint = character === "." && /\d/.test(transcript[index - 1] ?? "") && /\d/.test(transcript[index + 1] ?? "");
    const boundary = index === transcript.length
      || character === "\n"
      || character === "!"
      || character === "?"
      || (character === "." && !decimalPoint);
    if (!boundary) continue;

    const rawEnd = index === transcript.length ? index : index + 1;
    const raw = transcript.slice(segmentStart, rawEnd);
    const leftTrim = raw.length - raw.trimStart().length;
    const quote = raw.trim();
    if (quote) {
      const startChar = segmentStart + leftTrim;
      const assessmentText = stripExcludedSignals(quote).replace(/\s+/g, " ").trim();
      if (assessmentText && !LOW_INFORMATION_PATTERN.test(assessmentText)) {
        segments.push({ quote, assessmentText, startChar, endChar: startChar + quote.length });
      }
    }
    segmentStart = rawEnd;
  }
  return segments;
}

function stripExcludedSignals(value: string): string {
  let stripped = value;
  for (const pattern of SENSITIVE_PATTERNS) stripped = stripped.replace(pattern, " ");
  stripped = stripped.replace(NONVERBAL_PATTERN, " ");
  return stripped.replace(/^[\s.,!?]+|[\s.,!?]+$/g, "");
}

function followUpQuestion(missingEvidence: NcsEvidenceType[]): string {
  const labels: Partial<Record<NcsEvidenceType, string>> = {
    SITUATION: "당시 상황",
    TASK: "맡은 역할",
    ACTION: "본인이 직접 수행한 행동",
    RATIONALE: "그 행동을 선택한 이유",
    RESULT: "행동 뒤 확인한 결과",
    REFLECTION: "이후 개선한 점",
    CONSTRAINT: "당시 제약 조건",
    TRADEOFF: "검토한 대안과 선택 기준",
  };
  const targets = missingEvidence
    .map((type) => labels[type])
    .filter((label): label is string => Boolean(label))
    .slice(0, 3);
  return `${targets.length > 0 ? targets.join(", ") : "구체적인 수행 근거"}을 실제 경험에 근거해 설명해 주세요.`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
