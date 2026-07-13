import type { TalentProhibitedSignal, TalentProhibitedSignalCategory } from "./types";
import {
  TalentRubricValidationError,
  type NormalizedTalentProfileItem,
} from "./validation";

interface SignalRule {
  readonly label: string;
  readonly pattern: RegExp;
}

interface SignalGroup {
  readonly category: TalentProhibitedSignalCategory;
  readonly signals: readonly string[];
  readonly rules: readonly SignalRule[];
}

const SIGNAL_GROUPS: readonly SignalGroup[] = [
  {
    category: "SENSITIVE_ATTRIBUTE",
    signals: [
      "성별/성 정체성",
      "나이/연령",
      "출신 학교/학벌",
      "외모/용모",
      "장애 여부",
      "인종/민족/국적",
      "종교",
      "혼인/임신/가족 관계",
    ],
    rules: [
      { label: "성별/성 정체성", pattern: /성별|성\s*정체성|여성|남성|\bgender\b|\bsex\b/giu },
      { label: "나이/연령", pattern: /나이|연령|생년월일|\bage\b/giu },
      {
        label: "출신 학교/학벌",
        pattern:
          /출신\s*학교|출신학교|학벌|학교(?!\s*(?:시스템|서비스|플랫폼|프로젝트|운영|교육|행정|네트워크|서버))|\bschool\b|\buniversity\b/giu,
      },
      { label: "외모/용모", pattern: /외모|용모|\bappearance\b/giu },
      {
        label: "장애 여부",
        pattern: /장애(?!물)\s*(?:여부|인|가\s*있는|를\s*가진|을\s*가진)?|\bdisabilit(?:y|ies)\b/giu,
      },
      { label: "인종/민족/국적", pattern: /인종|민족|국적|\brace\b|\bethnicity\b|\bnationality\b/giu },
      { label: "종교", pattern: /종교|\breligion\b/giu },
      { label: "혼인/임신/가족 관계", pattern: /혼인|결혼\s*여부|임신|출산|가족\s*관계|\bmarital\s+status\b|\bpregnancy\b/giu },
    ],
  },
  {
    category: "NONVERBAL_SIGNAL",
    signals: ["시선/눈맞춤", "표정", "목소리 톤/음색/억양", "자세/몸짓/제스처", "말하기 속도"],
    rules: [
      { label: "시선/눈맞춤", pattern: /시선|눈\s*맞춤|아이\s*컨택|\bgaze\b|\beye\s+contact\b/giu },
      { label: "표정", pattern: /표정|\bfacial\s+expression\b/giu },
      { label: "목소리 톤/음색/억양", pattern: /목소리(?:의)?\s*톤|음색|억양|\bvoice\s+tone\b|\bintonation\b/giu },
      {
        label: "자세/몸짓/제스처",
        pattern: /자세(?!히|하게|한)|몸짓|제스처|\bposture\b|\bgesture\b/giu,
      },
      { label: "말하기 속도", pattern: /말(?:하기|의)?\s*속도|말하는\s*속도|\bspeaking\s+(?:pace|speed)\b/giu },
    ],
  },
];

export interface SanitizedTalentMeaning {
  readonly name: string;
  readonly definition: string;
}

const TECHNICAL_INCIDENT_SENTINEL = "__TECHNICAL_INCIDENT__";
const TECHNICAL_INCIDENT_PREFIX =
  /((?:서비스|시스템|서버|네트워크|데이터베이스|DB|인프라|애플리케이션|앱|소프트웨어|프로덕션|배포|운영)\s*)장애/giu;
const TECHNICAL_INCIDENT_ACTION =
  /장애(?=(?:를|을|가|는|의|로|에)?\s*(?:(?:신속(?:히|하게)|즉시|빠르게|자세히|자세하게|직접|먼저|자동으로)\s*)?(?:대응|복구|발생|원인|예방|탐지|분석|처리|해결|전파|알림|상황|시간|율|건수|영향))/giu;

export function sanitizeTalentMeaning(
  item: NormalizedTalentProfileItem,
  itemIndex: number,
): SanitizedTalentMeaning {
  const sanitizedName = sanitizeText(item.name);
  const sanitizedDescription = sanitizeText(item.description);
  const name = isMeaningful(sanitizedName)
    ? sanitizedName
    : isMeaningful(sanitizedDescription)
      ? truncate(sanitizedDescription, 80)
      : "";
  const definition = isMeaningful(sanitizedDescription) ? sanitizedDescription : name;

  if (!isMeaningful(name) || !isMeaningful(definition)) {
    throw new TalentRubricValidationError(
      "NO_ASSESSABLE_CONTENT",
      `items[${itemIndex}]`,
      "must retain transcript-assessable meaning after prohibited signals are removed",
    );
  }
  return { name, definition };
}

export function summarizeProhibitedSignals(
  items: readonly NormalizedTalentProfileItem[],
): TalentProhibitedSignal[] {
  const source = items.map((item) => `${item.name}\n${item.description}`).join("\n");
  return SIGNAL_GROUPS.map((group) => ({
    category: group.category,
    signals: [...group.signals],
    detectedInSource: group.rules
      .filter((rule) => matchesRule(rule, source))
      .map((rule) => rule.label),
    disposition: "EXCLUDE_FROM_SCORING",
  }));
}

function sanitizeText(source: string): string {
  let sanitized = protectTechnicalIncidentTerms(source);
  for (const group of SIGNAL_GROUPS) {
    for (const rule of group.rules) {
      sanitized = sanitized.replace(clonePattern(rule.pattern), " ");
    }
  }
  return sanitized
    .replace(/\(\s*\)|\[\s*\]|\{\s*\}/gu, " ")
    .replace(/\s+([,.;:!?])/gu, "$1")
    .replace(/(?:\s*[,;:/|·-]\s*){2,}/gu, ", ")
    .replace(/^[\s,;:/|·-]+|[\s,;:/|·-]+$/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .replaceAll(TECHNICAL_INCIDENT_SENTINEL, "장애");
}

function matchesRule(rule: SignalRule, source: string): boolean {
  const candidate = rule.label === "장애 여부" ? protectTechnicalIncidentTerms(source) : source;
  return matches(rule.pattern, candidate);
}

function protectTechnicalIncidentTerms(source: string): string {
  return source
    .replace(
      clonePattern(TECHNICAL_INCIDENT_PREFIX),
      (_match, prefix: string) => `${prefix}${TECHNICAL_INCIDENT_SENTINEL}`,
    )
    .replace(clonePattern(TECHNICAL_INCIDENT_ACTION), TECHNICAL_INCIDENT_SENTINEL);
}

function matches(pattern: RegExp, source: string): boolean {
  return clonePattern(pattern).test(source);
}

function clonePattern(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags);
}

function isMeaningful(value: string): boolean {
  const compact = value.replace(/[^\p{L}\p{N}]+/gu, "");
  return compact.length > 0 && !/^(?:(?:과|와|및|또는|이|가|을|를|의|에|로|으로|등))+$/u.test(compact);
}

function truncate(value: string, maximum: number): string {
  return [...value].slice(0, maximum).join("").trim();
}
