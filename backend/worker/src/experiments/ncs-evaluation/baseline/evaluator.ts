import {
  NCS_EVALUATION_CONTRACT_VERSION,
  NCS_SCORE_MAP,
  NcsBehaviorPoint,
  NcsClaimType,
  NcsEvaluationInput,
  NcsEvaluationOutput,
  NcsEvaluationStatus,
  NcsEvaluationStrategy,
  NcsEvidence,
  NcsEvidenceType,
} from "../shared/contract";

type BehaviorGroup = "OPS" | "DB" | "TEST" | "REQ" | "COMM" | "PROBLEM" | "SOLVE" | "SHARE";

interface TranscriptFeatures {
  relevant: boolean;
  generic: boolean;
  negative: boolean;
  contradiction: boolean;
  hasAction: boolean;
  hasRationale: boolean;
  hasResult: boolean;
  hasReflection: boolean;
  hasConstraint: boolean;
  hasTradeoff: boolean;
  hasSituation: boolean;
  hasKnowledge: boolean;
}

interface TranscriptSegment {
  quote: string;
  startChar: number;
  endChar: number;
}

const RELEVANCE_PATTERNS: Record<BehaviorGroup, RegExp> = {
  OPS: /(장애|오류|경보|로그|서버|롤백|복구|지연|큐|배포|재시작)/,
  DB: /(데이터베이스|쿼리|인덱스|실행 계획|조회|p95|풀스캔|캐시|성능|응답)/i,
  TEST: /(테스트|결함|오류|커버리지|배포|요구사항|경계값|회귀)/,
  REQ: /(요구사항|요구를|요구해|수용 기준|담당자|이해관계자|명세|모호)/,
  COMM: /(팀|의견|동료|합의|공유|경청|협업|운영팀|개발팀|디자인)/,
  PROBLEM: /(정보|문제|가설|대안|방법|자료|실험|원인|위험|비용)/,
  SOLVE: /(오류|로그|설정|롤백|정상화|원인|복구)/,
  SHARE: /(팀|공유|역할|전달|알리|고객지원|관계자|의견|합의)/,
};

const NEGATIVE_PATTERNS: Record<BehaviorGroup, RegExp> = {
  OPS: /(확인하지 않았|로그를 보지 않았|다른 팀에 넘겼|다른 팀이 원인을 찾아 복구|일시적인 현상이라고 생각)/,
  DB: /(원인은 확인하지 않고|모든 컬럼에 인덱스|전후 측정은 하지 않았|좋아졌을 것|팀원이 이미 인덱스를 적용|결과만 전달받)/,
  TEST: /(테스트 없이|문제가 발생하면 그때 고치|결제 오류가 발생)/,
  REQ: /(질문하지 않고|추정해서 개발|대부분 다시 만들)/,
  COMM: /(의견은 자세히 듣지 않고|반대 의견을 듣지 않고|합의한 적이 없|협업이 어렵다고)/,
  PROBLEM: /(처음 떠오른 방법을 바로 적용|운이 나빴다고 생각|정보를 모으느라 시간을 쓰기보다)/,
  SOLVE: /(원인을 확인하지|로그를 보지 않았|다른 팀이 원인을 찾아 복구)/,
  SHARE: /(알리지 않았|설명할 시간이 없어서|의견을 듣지 않고|합의한 적이 없)/,
};

const LOW_INFORMATION_PATTERN = /^(없습니다|잘 모르겠습니다|모르겠습니다|답변하기 어렵습니다)\.?$/;
const SENSITIVE_ONLY_PATTERN = /(여성 지원자|남성 지원자|대학교 출신|나이는|장애가|출신 학교)/;
const ACTION_PATTERN = /(확인|비교|분석|적용|추가|수정|작성|질문|정리|공유|합의|선택|실행|검증|수집|나누|롤백|재시작|테스트|전달|조율|구분|모니터링|도입|찾았|찾았습니다|기록하|바꿔)/;
const RATIONALE_PATTERN = /(때문|위해|판단|기준|비교|위험|영향|비용|손실|목표|원인|풀스캔|설정 변경|정렬 비용|가설|장단점|수용 기준|주요 사용자|가능성이 높은|경계값|이메일 중복)/;
const RESULT_PATTERN = /(줄었|내려갔|정상화|발견해 수정|발견했고|합의해|합의하여|승인을 받|예정일에 배포|문제없이 배포|확정했습니다|더 이상 발생하지|돌아왔|오류를 줄였|전달했습니다|결함을 찾아 수정|다시 만들|장애 시간이 더 길어졌|결제 오류가 발생|결과 지표|결과를 확인)/;
const REFLECTION_PATTERN = /(재발|체크리스트에 넣|템플릿에 반영|템플릿을 남|모니터링을 배포|경보를 추가|CI 필수 단계|과정과 학습을 기록|회고에서)/i;
const CONSTRAINT_PATTERN = /(시한|일정|시간|영향도|고객 영향|데이터 손실|동시 사용자|실패 비용|개발 비용)/;
const TRADEOFF_PATTERN = /(대안을 비교|비용을 비교|위험과|쓰기 지연|중단 기준|단계 배포|영향도와 실행 비용|조회 빈도와 쓰기 비용)/;
const SITUATION_PATTERN = /(발생|늘어|느려|모호|달랐|충돌|위험|문제가 생겼|오류율|지연|요청했|요구해)/;
const KNOWLEDGE_PATTERN = /(알고 있습니다|중요하다고|단위 테스트|통합 테스트|실행 계획|인덱스|가설)/;
const GENERIC_PATTERN = /(보통|필요하면|중요하다고|알고 있습니다|하면 됩니다|하는 것이 중요|하겠습니다)/;
const CONTRADICTION_PATTERN = /(처음에는|본 질문에서는).*(하지만|실제로는|그러나)/s;

const STATUS_BY_LEVEL: Record<1 | 2 | 3 | 4 | 5, Exclude<NcsEvaluationStatus, "INSUFFICIENT_EVIDENCE">> = {
  1: "NOT_DEMONSTRATED",
  2: "LIMITED",
  3: "DEVELOPING",
  4: "DEMONSTRATED",
  5: "STRONGLY_DEMONSTRATED",
};

export class DeterministicNcsBaselineEvaluator implements NcsEvaluationStrategy {
  readonly strategyId = "baseline-deterministic";
  readonly promptVersion = "none";
  readonly model = "deterministic-rules-v1";

  evaluate(input: NcsEvaluationInput): NcsEvaluationOutput {
    const evidences: NcsEvidence[] = [];
    const behaviorEvaluations = input.behaviorPoints.map((behaviorPoint) => {
      const group = behaviorGroup(behaviorPoint);
      const features = extractFeatures(input.answer.transcript, group);
      const level = determineLevel(features);
      const status: NcsEvaluationStatus = level === null ? "INSUFFICIENT_EVIDENCE" : STATUS_BY_LEVEL[level];
      const behaviorEvidence = level === null
        ? []
        : extractEvidence(input, behaviorPoint, group, features.negative || features.contradiction);
      evidences.push(...behaviorEvidence);
      const evidenceIds = behaviorEvidence.map((evidence) => evidence.evidenceId);
      const missingEvidence = findMissingEvidence(behaviorPoint.requiredEvidence, features, level);
      const isContradicting = features.negative || features.contradiction;
      return {
        behaviorPointId: behaviorPoint.behaviorPointId,
        status,
        level,
        score: level === null ? null : NCS_SCORE_MAP[level],
        rationale: rationaleFor(level, behaviorEvidence.length, missingEvidence),
        supportingEvidenceIds: isContradicting ? [] : evidenceIds,
        contradictingEvidenceIds: isContradicting ? evidenceIds : [],
        missingEvidence,
        confidence: level === null || level === 1 ? "LOW" as const : level >= 4 && behaviorEvidence.length >= 2 ? "HIGH" as const : "MEDIUM" as const,
      };
    });

    const evaluatedCount = behaviorEvaluations.filter((evaluation) => evaluation.status !== "INSUFFICIENT_EVIDENCE").length;
    const assessableCount = behaviorEvaluations.length;
    const ratio = evaluatedCount / assessableCount;
    const insufficientEvaluations = behaviorEvaluations.filter((evaluation) => evaluation.status === "INSUFFICIENT_EVIDENCE");
    const followUpRequired = insufficientEvaluations.length > 0
      && input.interviewContext.followUpsUsed < input.interviewContext.maxFollowUps;
    const missingEvidence = unique(insufficientEvaluations.flatMap((evaluation) => evaluation.missingEvidence));

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
        reason: followUpRequired ? "필수 행동 포인트를 판정할 직접 발화 근거가 부족합니다." : null,
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

function behaviorGroup(behaviorPoint: NcsBehaviorPoint): BehaviorGroup {
  const id = behaviorPoint.behaviorPointId;
  if (id.includes("MULTI-SOLVE")) return "SOLVE";
  if (id.includes("MULTI-SHARE")) return "SHARE";
  if (id.includes("DB")) return "DB";
  if (id.includes("TEST")) return "TEST";
  if (id.includes("REQ")) return "REQ";
  if (id.includes("COMM")) return "COMM";
  if (id.includes("PROBLEM")) return "PROBLEM";
  return "OPS";
}

function extractFeatures(transcript: string, group: BehaviorGroup): TranscriptFeatures {
  const normalized = transcript.replace(/\s+/g, " ").trim();
  const relevant = normalized.length > 0
    && !LOW_INFORMATION_PATTERN.test(normalized)
    && RELEVANCE_PATTERNS[group].test(normalized);
  return {
    relevant,
    generic: GENERIC_PATTERN.test(normalized),
    negative: relevant && NEGATIVE_PATTERNS[group].test(normalized),
    contradiction: relevant && CONTRADICTION_PATTERN.test(normalized),
    hasAction: ACTION_PATTERN.test(normalized),
    hasRationale: RATIONALE_PATTERN.test(normalized),
    hasResult: RESULT_PATTERN.test(normalized),
    hasReflection: REFLECTION_PATTERN.test(normalized),
    hasConstraint: CONSTRAINT_PATTERN.test(normalized),
    hasTradeoff: TRADEOFF_PATTERN.test(normalized),
    hasSituation: SITUATION_PATTERN.test(normalized),
    hasKnowledge: KNOWLEDGE_PATTERN.test(normalized),
  };
}

function determineLevel(features: TranscriptFeatures): 1 | 2 | 3 | 4 | 5 | null {
  if (!features.relevant) return null;
  if (features.negative || features.contradiction) return 1;
  if (features.generic && !features.hasRationale && !features.hasResult && !features.hasReflection) return 2;
  if (!features.hasAction) return 2;
  if (features.hasReflection && features.hasRationale && features.hasResult) return 5;
  if (features.hasRationale && features.hasResult) return 4;
  if (features.hasRationale || features.hasResult || features.hasSituation) return 3;
  return 2;
}

function extractEvidence(
  input: NcsEvaluationInput,
  behaviorPoint: NcsBehaviorPoint,
  group: BehaviorGroup,
  contradiction: boolean,
): NcsEvidence[] {
  const segments = transcriptSegments(input.answer.transcript).filter((segment) => {
    if (SENSITIVE_ONLY_PATTERN.test(segment.quote) && !RELEVANCE_PATTERNS[group].test(segment.quote)) return false;
    if (input.behaviorPoints.length === 1) return true;
    return RELEVANCE_PATTERNS[group].test(segment.quote);
  });
  return segments.map((segment, index) => ({
    evidenceId: `${input.caseId}-${behaviorPoint.behaviorPointId}-${index + 1}`,
    source: "ANSWER_TRANSCRIPT",
    quote: segment.quote,
    startChar: segment.startChar,
    endChar: segment.endChar,
    claimType: contradiction ? "CONTRADICTION" : claimTypeFor(segment.quote),
    behaviorPointIds: [behaviorPoint.behaviorPointId],
  }));
}

function transcriptSegments(transcript: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  for (const match of transcript.matchAll(/[^.!?\n]+[.!?]?/gu)) {
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

function claimTypeFor(quote: string): NcsClaimType {
  if (REFLECTION_PATTERN.test(quote)) return "REFLECTION";
  if (RESULT_PATTERN.test(quote)) return "RESULT";
  if (TRADEOFF_PATTERN.test(quote)) return "TRADEOFF";
  if (RATIONALE_PATTERN.test(quote)) return "RATIONALE";
  if (ACTION_PATTERN.test(quote)) return "ACTION";
  if (SITUATION_PATTERN.test(quote)) return "SITUATION";
  return "KNOWLEDGE";
}

function findMissingEvidence(
  requiredEvidence: NcsEvidenceType[],
  features: TranscriptFeatures,
  level: 1 | 2 | 3 | 4 | 5 | null,
): NcsEvidenceType[] {
  if (level === null) return [...requiredEvidence];
  const available: Record<NcsEvidenceType, boolean> = {
    SITUATION: features.hasSituation && !features.generic,
    TASK: features.hasAction && !features.negative,
    ACTION: features.hasAction && !features.negative && !features.contradiction,
    RATIONALE: features.hasRationale && !features.negative && !features.contradiction,
    RESULT: features.hasResult,
    REFLECTION: features.hasReflection,
    KNOWLEDGE: features.hasKnowledge,
    CONSTRAINT: features.hasConstraint,
    TRADEOFF: features.hasTradeoff,
  };
  return requiredEvidence.filter((evidenceType) => !available[evidenceType]);
}

function rationaleFor(
  level: 1 | 2 | 3 | 4 | 5 | null,
  evidenceCount: number,
  missingEvidence: NcsEvidenceType[],
): string {
  if (level === null) {
    return "질문과 행동 포인트를 판정할 직접 발화 근거를 찾지 못했습니다.";
  }
  if (level === 1) {
    return `${evidenceCount}개의 발화 구간에서 행동 포인트와 반대되거나 자기모순인 수행 근거가 확인됐습니다.`;
  }
  const missing = missingEvidence.length > 0 ? ` 누락 근거: ${missingEvidence.join(", ")}.` : "";
  return `${evidenceCount}개의 발화 구간을 근거로 ${level}단계 행동 충족 수준을 판정했습니다.${missing}`;
}

function followUpQuestion(missingEvidence: NcsEvidenceType[]): string {
  const labels: Partial<Record<NcsEvidenceType, string>> = {
    SITUATION: "당시 상황",
    ACTION: "본인이 직접 수행한 행동",
    RATIONALE: "그 행동을 선택한 이유",
    RESULT: "행동 이후 확인한 결과",
    REFLECTION: "이후 개선하거나 다르게 적용한 점",
    CONSTRAINT: "당시 제약 조건",
    TRADEOFF: "검토한 대안과 선택 기준",
  };
  const targets = missingEvidence.map((item) => labels[item]).filter((item): item is string => Boolean(item));
  const targetText = targets.length > 0 ? targets.join(", ") : "구체적인 수행 근거";
  return `${targetText}을 정답을 가정하지 않고 실제 경험에 근거해 설명해 주세요.`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
