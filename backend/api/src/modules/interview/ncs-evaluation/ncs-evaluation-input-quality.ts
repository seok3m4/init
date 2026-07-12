export type NcsEvaluationInputQualityFailure =
  | "NO_ANSWER_MARKER"
  | "NO_MEANINGFUL_CONTENT"
  | "FILLER_ONLY"
  | "REPEATED_CONTENT";

export type NcsEvaluationInputQuality =
  | { assessable: true }
  | { assessable: false; reason: NcsEvaluationInputQualityFailure };

const FILLER_PHRASES = new Set([
  "네",
  "아니요",
  "음",
  "어",
  "글쎄요",
  "모르겠습니다",
  "잘모르겠습니다",
  "생각이안납니다",
  "답변하기어렵습니다",
]);

export function assessNcsEvaluationInputQuality(transcript: string): NcsEvaluationInputQuality {
  const trimmed = transcript.trim();
  if (/^\[NO_ANSWER\]/i.test(trimmed)) {
    return { assessable: false, reason: "NO_ANSWER_MARKER" };
  }

  const meaningful = trimmed.match(/[\p{L}\p{N}]/gu)?.join("") ?? "";
  if (!meaningful) {
    return { assessable: false, reason: "NO_MEANINGFUL_CONTENT" };
  }

  const compact = trimmed.replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase("ko-KR");
  if (FILLER_PHRASES.has(compact)) {
    return { assessable: false, reason: "FILLER_ONLY" };
  }

  if (/^(.)\1{3,}$/u.test(meaningful)) {
    return { assessable: false, reason: "REPEATED_CONTENT" };
  }

  const tokens = trimmed
    .toLocaleLowerCase("ko-KR")
    .split(/\s+/u)
    .map((token) => token.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (tokens.length >= 3 && new Set(tokens).size === 1) {
    return { assessable: false, reason: "REPEATED_CONTENT" };
  }

  return { assessable: true };
}
