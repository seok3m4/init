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

interface TranscriptSpan {
  index: number;
  quote: string;
  analysisText: string;
  startChar: number;
  endChar: number;
}

interface RubricProfile {
  concepts: Set<string>;
  roots: Set<string>;
}

interface RubricSignals {
  relevant: boolean;
  situation: boolean;
  action: boolean;
  rationale: boolean;
  result: boolean;
  verification: boolean;
  reflection: boolean;
  contradiction: boolean;
  knowledge: boolean;
  constraint: boolean;
  tradeoff: boolean;
  generic: boolean;
  evidenceSpans: TranscriptSpan[];
}

interface RubricDecision {
  level: Level | null;
  signals: RubricSignals;
  missingEvidence: NcsEvidenceType[];
}

const STATUS_BY_LEVEL: Record<Level, Exclude<NcsEvaluationStatus, "INSUFFICIENT_EVIDENCE">> = {
  1: "NOT_DEMONSTRATED",
  2: "LIMITED",
  3: "DEVELOPING",
  4: "DEMONSTRATED",
  5: "STRONGLY_DEMONSTRATED",
};

const CONCEPT_LEXICONS: Record<string, readonly string[]> = {
  observation: ["관찰", "징후", "경보", "로그", "지표", "측정", "실행 계획", "데이터", "정보", "오류율", "응답 시간", "p95"],
  diagnosis: ["원인", "분석", "병목", "풀스캔", "가설", "좁히", "정렬 비용"],
  remediation: ["복구", "롤백", "재시작", "개선", "수정", "적용", "정상화", "해결", "설정값"],
  prevention: ["재발", "회귀", "체크리스트", "모니터링", "템플릿", "필수 단계", "조기 발견", "재시도 상한"],
  quality: ["테스트", "결함", "품질", "경계값", "커버리지", "회귀"],
  requirement: ["요구", "수용 기준", "명세", "사용자", "기능", "담당자", "구현 범위", "결정표"],
  collaboration: ["이해관계자", "상대", "팀", "동료", "운영팀", "개발팀", "디자인", "고객지원", "관계자", "의견"],
  alignment: ["합의", "조율", "공유", "전달", "역할", "공통 목표", "경청", "승인", "알리"],
  uncertainty: ["불확실", "정보 부족", "사실", "추정", "가설", "자료", "가능성"],
  decision: ["대안", "비교", "기준", "선택", "판단", "장단점", "비용", "위험", "영향도", "목표"],
  performance: ["데이터베이스", "쿼리", "실행 계획", "인덱스", "조회", "응답", "p95", "풀스캔", "캐시", "쓰기 지연"],
  service: ["서비스", "장애", "오류", "서버", "배포", "큐", "api", "지연"],
  verification: ["검증", "전후", "같은 부하", "동일 데이터", "결과 지표", "다시 측정", "정상 범위"],
};

const COMMON_ROOTS = new Set([
  "가능", "관련", "결과", "구체", "근거", "능력", "바탕", "본인", "선택", "설명", "실제", "적절", "행동", "확인", "검증", "수행",
]);
const TOKEN_SUFFIXES = [
  "으로부터", "에게서", "에서는", "으로", "에서", "에게", "까지", "부터", "하며", "하고", "하여", "해서", "한다", "했다", "합니다", "되는", "있는", "없는", "으로", "라고", "이라고", "을", "를", "은", "는", "이", "가", "와", "과", "의", "에", "도", "로", "만",
];

const ACTION_PATTERN = /(확인|비교|분석|적용|추가|수정|작성|질문|정리|공유|합의|선택|실행|검증|수집|나누|롤백|재시작|테스트|전달|조율|구분|모니터링|도입|찾|기록|바꾸|제안|측정|문서화|물어|의견을 듣|이유를 듣|정했|확정|올렸|만들)/;
const RATIONALE_PATTERN = /(때문|위해|하려고|판단|기준|위험|영향|비용|손실|목표|원인|가능성이 높은|맞춰|따라|비교|가장 크|모호해서|모호했|우려|요구사항|경계값)/;
const DIAGNOSTIC_LINK_PATTERN = /(풀스캔|정렬 비용|설정 변경|재시도 로직|중복 결함|원인).{0,80}(확인|찾|좁).{0,80}(롤백|수정|적용|추가|선택)/s;
const RESULT_PATTERN = /(정상화|정상 범위|줄었|줄였습니다|내려갔|돌아왔|더 이상 발생하지|발견.{0,20}수정|결함.{0,30}(찾|수정)|승인을 받|예정일.{0,20}배포|문제없이 배포|범위를 확정|수용 기준을 합의|다시 만들|길어졌|오류가 발생|증가했|복구 시점을 전달|담당 역할을 정|결과.{0,20}(확인|판단))/s;
const VERIFICATION_PATTERN = /(적용 전후|동일 데이터|같은 부하|다시 측정|검증|회귀 테스트|결과 지표|결과를 확인|오류율|p95|정상 범위|더 이상 발생하지|프로토타입)/i;
const REFLECTION_PATTERN = /((이후|회고|다음|재발|같은 유형).{0,80}(추가|체크리스트|모니터링|템플릿|필수 단계|기록|반영|조기|상한)|과정과 학습을 기록|ci 필수 단계)/is;
const SITUATION_PATTERN = /(발생|늘어|느려|모호|달랐|충돌|문제|오류|지연|요청|요구|촉박|부족|상태|경보|결함)/;
const KNOWLEDGE_PATTERN = /(알고 있습니다|중요하다고|단위 테스트|통합 테스트|실행 계획|인덱스|가설|수용 기준)/;
const CONSTRAINT_PATTERN = /(시한|일정|시간|영향도|고객 영향|데이터 손실|동시 사용자|실패 비용|개발 비용|쓰기 지연|촉박|중단 기준|목표 응답)/;
const TRADEOFF_PATTERN = /(대안|장단점|비용을 비교|위험과|조회 빈도와 쓰기 비용|영향도와 실행 비용|단계 배포|중단 기준|비교한 뒤)/;
const GENERIC_PATTERN = /(보통|필요하면|중요하다고 (생각|알고)|하면 됩니다|하는 것이 중요|가능하면|잘 해야|최선의 방법|주변 사람에게 물어|인터넷을 검색)/;
const SPECIFIC_PATTERN = /(했습니다|했고|했으며|찾았습니다|적용했습니다|수정했습니다|작성했습니다|질문했고|합의해|합의하여|선택했고|추가해|롤백|정상화|발견해|확정했습니다|정했습니다|전달했습니다|줄었습니다)/;
const LOW_INFORMATION_PATTERN = /^(없습니다|잘 모르겠습니다|모르겠습니다|답변하기 어렵습니다)[.!?]?$/;
const EXPLICIT_REVERSAL_PATTERN = /(처음에는|본 질문에서는)[\s\S]*(하지만|그러나|실제로는|다시 확인)/;
const ADVERSE_PRACTICE_PATTERN = /(확인하지 않|분석.{0,20}하지 않|측정.{0,30}하지 않|질문하지 않|듣지 않|알리지 않|공유하지 않|합의한 적이 없|테스트 없이|원인은? 확인하지 않고|더 확인하지 않|모든 (컬럼|열)에 인덱스|처음 떠오른.{0,30}바로 적용|운이 나빴|다른 팀에 넘|다른 팀이.{0,30}복구|결과만 전달받|추정해서 개발|제 방식대로|문제가 발생하면 그때|좋아졌을 것|시간을 낭비|상세 측정.{0,30}낭비)/s;

const SENSITIVE_SOURCE = "(?:여성|남성)\\s*(?:지원자|개발자|후보자)?|[가-힣A-Za-z]+(?:대학교|대학)\\s*출신|출신\\s*(?:학교|지역|지)|(?:제\\s*)?이름은\\s*[가-힣A-Za-z]+|(?:만\\s*)?\\d{1,3}\\s*세|성별|외모|장애인|신체\\s*장애|건강\\s*상태|질병|임신|종교|인종|국적";
const NONVERBAL_SOURCE = "표정|시선|눈맞춤|억양|말속도|목소리|자세|몸짓|제스처|미소|떨림";
const SENSITIVE_PATTERN = new RegExp(SENSITIVE_SOURCE, "iu");
const NONVERBAL_PATTERN = new RegExp(NONVERBAL_SOURCE, "iu");
const SENSITIVE_REDACTION_PATTERN = new RegExp(SENSITIVE_SOURCE, "giu");
const NONVERBAL_REDACTION_PATTERN = new RegExp(NONVERBAL_SOURCE, "giu");

export class CommonRubricEvaluator implements NcsEvaluationStrategy {
  readonly strategyId = "common-rubric-deterministic";
  readonly promptVersion = "common-rubric-v1";
  readonly model = "deterministic-rubric-features-v1";

  evaluate(input: NcsEvaluationInput): NcsEvaluationOutput {
    const transportCaseId = input.caseId;
    const transcriptSpans = segmentTranscript(input.answer.transcript);
    const evidences: NcsEvidence[] = [];
    const behaviorEvaluations: NcsBehaviorEvaluation[] = [];

    input.behaviorPoints.forEach((behaviorPoint, behaviorIndex) => {
      const elementNames = input.ncsContext.unit.elements
        .filter((element) => behaviorPoint.sourceElementCodes.includes(element.elementCode))
        .map((element) => element.name);
      const rubricText = [behaviorPoint.description, ...elementNames].join(" ");
      const decision = judgeRubric(
        transcriptSpans,
        rubricText,
        behaviorPoint.requiredEvidence,
        input.behaviorPoints.length === 1,
      );
      const behaviorEvidence = decision.signals.evidenceSpans.map((span, evidenceIndex) => ({
        evidenceId: `common-rubric-${behaviorIndex + 1}-${evidenceIndex + 1}`,
        source: "ANSWER_TRANSCRIPT" as const,
        quote: span.quote,
        startChar: span.startChar,
        endChar: span.endChar,
        claimType: claimTypeFor(span.analysisText, decision.signals.contradiction),
        behaviorPointIds: [behaviorPoint.behaviorPointId],
      }));
      evidences.push(...behaviorEvidence);

      const level = decision.level;
      const status: NcsEvaluationStatus = level === null ? "INSUFFICIENT_EVIDENCE" : STATUS_BY_LEVEL[level];
      const evidenceIds = behaviorEvidence.map((evidence) => evidence.evidenceId);
      behaviorEvaluations.push({
        behaviorPointId: behaviorPoint.behaviorPointId,
        status,
        level,
        score: level === null ? null : NCS_SCORE_MAP[level],
        rationale: rationaleFor(level, decision.signals),
        supportingEvidenceIds: level === null || decision.signals.contradiction ? [] : evidenceIds,
        contradictingEvidenceIds: decision.signals.contradiction ? evidenceIds : [],
        missingEvidence: decision.missingEvidence,
        confidence: confidenceFor(level, behaviorEvidence.length),
      });
    });

    const insufficient = behaviorEvaluations.filter((evaluation) => evaluation.status === "INSUFFICIENT_EVIDENCE");
    const assessableCount = behaviorEvaluations.length;
    const evaluatedCount = assessableCount - insufficient.length;
    const coverageRatio = evaluatedCount / assessableCount;
    const followUpMissing = unique(insufficient.flatMap((evaluation) => evaluation.missingEvidence));
    const followUpRequired = insufficient.length > 0
      && input.interviewContext.followUpsUsed < input.interviewContext.maxFollowUps;

    return {
      contractVersion: NCS_EVALUATION_CONTRACT_VERSION,
      caseId: transportCaseId,
      evidences,
      behaviorEvaluations,
      coverage: {
        assessableBehaviorPointCount: assessableCount,
        evaluatedBehaviorPointCount: evaluatedCount,
        ratio: coverageRatio,
        status: coverageRatio === 0 ? "INSUFFICIENT" : coverageRatio >= 0.8 ? "SUFFICIENT" : "LOW",
      },
      followUp: {
        required: followUpRequired,
        reason: followUpRequired ? "일부 행동 포인트를 판정할 관련 발화 근거가 부족합니다." : null,
        missingEvidence: followUpMissing,
        suggestedQuestion: followUpRequired ? followUpQuestion(followUpMissing) : null,
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

function judgeRubric(
  spans: TranscriptSpan[],
  rubricText: string,
  requiredEvidence: NcsEvidenceType[],
  singleBehaviorPoint: boolean,
): RubricDecision {
  const normalizedTranscript = spans.map((span) => span.analysisText).join(" ").trim();
  if (!normalizedTranscript || LOW_INFORMATION_PATTERN.test(normalizedTranscript)) {
    return insufficientDecision(requiredEvidence);
  }

  const profile = rubricProfile(rubricText);
  const annotated = spans.map((span) => {
    const relevance = relevanceScore(span.analysisText, profile);
    const ignoredSignalOnly = (SENSITIVE_PATTERN.test(span.quote) || NONVERBAL_PATTERN.test(span.quote))
      && relevance < 2;
    return { span, relevance, ignoredSignalOnly };
  });
  const directIndexes = new Set(
    annotated.filter((item) => !item.ignoredSignalOnly && item.relevance >= 2).map((item) => item.span.index),
  );
  if (directIndexes.size === 0) return insufficientDecision(requiredEvidence);

  const evidenceSpans = annotated
    .filter((item) => {
      if (item.ignoredSignalOnly) return false;
      if (directIndexes.has(item.span.index)) return true;
      if (!singleBehaviorPoint) return false;
      const local = rawSignals(item.span.analysisText);
      const adjacent = directIndexes.has(item.span.index - 1) || directIndexes.has(item.span.index + 1);
      return local.reflection || local.contradiction || (adjacent && (local.rationale || local.result || local.verification));
    })
    .map((item) => item.span);
  const signals = aggregateSignals(evidenceSpans);
  const level = determineLevel(signals);
  return {
    level,
    signals,
    missingEvidence: findMissingEvidence(requiredEvidence, signals, level),
  };
}

function insufficientDecision(requiredEvidence: NcsEvidenceType[]): RubricDecision {
  return {
    level: null,
    signals: {
      relevant: false,
      situation: false,
      action: false,
      rationale: false,
      result: false,
      verification: false,
      reflection: false,
      contradiction: false,
      knowledge: false,
      constraint: false,
      tradeoff: false,
      generic: false,
      evidenceSpans: [],
    },
    missingEvidence: [...requiredEvidence],
  };
}

function aggregateSignals(evidenceSpans: TranscriptSpan[]): RubricSignals {
  const text = evidenceSpans.map((span) => span.analysisText).join(" ");
  const raw = rawSignals(text);
  const concrete = SPECIFIC_PATTERN.test(text) && (raw.rationale || raw.result || raw.reflection);
  return {
    relevant: true,
    ...raw,
    generic: GENERIC_PATTERN.test(text) && !concrete,
    evidenceSpans,
  };
}

function rawSignals(text: string): Omit<RubricSignals, "relevant" | "generic" | "evidenceSpans"> {
  return {
    situation: SITUATION_PATTERN.test(text),
    action: ACTION_PATTERN.test(text),
    rationale: RATIONALE_PATTERN.test(text) || DIAGNOSTIC_LINK_PATTERN.test(text),
    result: RESULT_PATTERN.test(text),
    verification: VERIFICATION_PATTERN.test(text),
    reflection: REFLECTION_PATTERN.test(text),
    contradiction: EXPLICIT_REVERSAL_PATTERN.test(text) || ADVERSE_PRACTICE_PATTERN.test(text),
    knowledge: KNOWLEDGE_PATTERN.test(text),
    constraint: CONSTRAINT_PATTERN.test(text),
    tradeoff: TRADEOFF_PATTERN.test(text),
  };
}

function determineLevel(signals: RubricSignals): Level {
  if (signals.contradiction) return 1;
  if (signals.generic || !signals.action) return 2;
  if (signals.rationale && signals.result) return signals.reflection ? 5 : 4;
  return 3;
}

function findMissingEvidence(
  requiredEvidence: NcsEvidenceType[],
  signals: RubricSignals,
  level: Level | null,
): NcsEvidenceType[] {
  if (level === null) return [...requiredEvidence];
  const positive = !signals.contradiction;
  const available: Record<NcsEvidenceType, boolean> = {
    SITUATION: signals.situation,
    TASK: positive && signals.action,
    ACTION: positive && signals.action && !signals.generic,
    RATIONALE: positive && signals.rationale,
    RESULT: signals.result,
    REFLECTION: signals.reflection,
    KNOWLEDGE: signals.knowledge || signals.relevant,
    CONSTRAINT: signals.constraint,
    TRADEOFF: signals.tradeoff,
  };
  return requiredEvidence.filter((evidenceType) => !available[evidenceType]);
}

function segmentTranscript(transcript: string): TranscriptSpan[] {
  const spans: TranscriptSpan[] = [];
  for (const match of transcript.matchAll(/(?:[^.!?\n]|\.(?=\d))+(?:[.!?]|$)/gu)) {
    const raw = match[0];
    const rawStart = match.index ?? 0;
    const leftTrim = raw.length - raw.trimStart().length;
    const quote = raw.trim();
    if (!quote) continue;
    const startChar = rawStart + leftTrim;
    spans.push({
      index: spans.length,
      quote,
      analysisText: redactIgnoredSignals(quote),
      startChar,
      endChar: startChar + quote.length,
    });
  }
  return spans;
}

function redactIgnoredSignals(text: string): string {
  return text
    .replace(SENSITIVE_REDACTION_PATTERN, " ")
    .replace(NONVERBAL_REDACTION_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rubricProfile(text: string): RubricProfile {
  return { concepts: conceptsFor(text), roots: rootsFor(text) };
}

function relevanceScore(text: string, profile: RubricProfile): number {
  const concepts = conceptsFor(text);
  const sharedConcepts = [...concepts].filter((concept) => profile.concepts.has(concept)).length;
  const roots = rootsFor(text);
  const sharedRoots = [...profile.roots].filter((rubricRoot) =>
    [...roots].some((answerRoot) => answerRoot.includes(rubricRoot) || rubricRoot.includes(answerRoot)),
  ).length;
  return sharedConcepts * 2 + Math.min(sharedRoots, 2);
}

function conceptsFor(text: string): Set<string> {
  const normalized = text.toLocaleLowerCase("ko-KR");
  const concepts = new Set<string>();
  for (const [concept, keywords] of Object.entries(CONCEPT_LEXICONS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) concepts.add(concept);
  }
  return concepts;
}

function rootsFor(text: string): Set<string> {
  const tokens = text.toLocaleLowerCase("ko-KR").match(/[가-힣a-z0-9]+/gu) ?? [];
  const roots = new Set<string>();
  for (const token of tokens) {
    let root = token;
    for (const suffix of TOKEN_SUFFIXES) {
      if (root.length - suffix.length >= 2 && root.endsWith(suffix)) {
        root = root.slice(0, -suffix.length);
        break;
      }
    }
    if (root.length >= 2 && !COMMON_ROOTS.has(root)) roots.add(root);
  }
  return roots;
}

function claimTypeFor(text: string, contradiction: boolean): NcsClaimType {
  if (contradiction) return "CONTRADICTION";
  const signals = rawSignals(text);
  if (signals.reflection) return "REFLECTION";
  if (signals.result) return "RESULT";
  if (signals.tradeoff) return "TRADEOFF";
  if (signals.rationale) return "RATIONALE";
  if (signals.action) return "ACTION";
  if (signals.situation) return "SITUATION";
  return "KNOWLEDGE";
}

function rationaleFor(level: Level | null, signals: RubricSignals): string {
  if (level === null) return "행동 포인트와 의미상 관련된 발화 근거를 확인하지 못했습니다.";
  if (level === 1) return "관련 발화에서 행동 포인트와 상충하거나 앞선 주장을 뒤집는 명시적 근거가 확인됐습니다.";
  if (level === 2) return "관련 개념은 확인되지만 구체적인 본인 행동과 결과를 연결할 근거가 제한적입니다.";
  if (level === 3) return "구체적인 본인 행동은 확인되지만 선택 근거 또는 확인된 결과 중 일부가 부족합니다.";
  if (level === 4) return "관련된 본인 행동, 선택 근거, 확인된 결과가 발화 안에서 연결됩니다.";
  const advanced = signals.reflection ? "후속 개선 또는 재사용 가능한 성찰" : "추가 검증";
  return `관련된 본인 행동, 선택 근거, 결과와 ${advanced}이 함께 확인됩니다.`;
}

function confidenceFor(level: Level | null, evidenceCount: number): "HIGH" | "MEDIUM" | "LOW" {
  if (level === null || level <= 2) return "LOW";
  return evidenceCount >= 2 ? "HIGH" : "MEDIUM";
}

function followUpQuestion(missingEvidence: NcsEvidenceType[]): string {
  const labels: Partial<Record<NcsEvidenceType, string>> = {
    SITUATION: "관련 상황",
    TASK: "맡은 역할",
    ACTION: "본인이 직접 한 행동",
    RATIONALE: "그 행동을 선택한 이유",
    RESULT: "행동 뒤 확인한 결과",
    REFLECTION: "이후 적용한 점",
    KNOWLEDGE: "판단에 사용한 정보",
    CONSTRAINT: "당시 제약",
    TRADEOFF: "검토한 대안",
  };
  const targets = missingEvidence
    .map((evidenceType) => labels[evidenceType])
    .filter((label): label is string => Boolean(label))
    .slice(0, 3);
  return `${targets.length > 0 ? targets.join(", ") : "관련 근거"}을 실제 경험이나 계획에 근거해 구체적으로 설명해 주세요.`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
