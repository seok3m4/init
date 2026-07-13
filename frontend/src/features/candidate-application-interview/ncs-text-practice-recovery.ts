export const NCS_TEXT_PRACTICE_RECOVERY_KEY = "final-weapon:ncs-text-practice:pending:v2";
const RECOVERY_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

type RecoverableQuestionType = "INTRO" | "TECHNICAL" | "EXPERIENCE" | "SITUATION" | "FOLLOW_UP" | "CLOSING";
const RECOVERABLE_QUESTION_TYPES: RecoverableQuestionType[] = [
  "INTRO",
  "TECHNICAL",
  "EXPERIENCE",
  "SITUATION",
  "FOLLOW_UP",
  "CLOSING",
];

export interface NcsTextPracticeRecoveryQuestion {
  questionId: number;
  questionType: RecoverableQuestionType;
  sortOrder: number;
  content: string;
  audioPrompt: string;
  answered: boolean;
  current: boolean;
}

export interface NcsTextPracticeQuestionSummary {
  questionId: number;
  score: number | null;
  followUpUsed: boolean;
}

export interface NcsTextPracticeRecovery {
  version: 2;
  processLogId: number;
  sessionId: number;
  jobRole: string;
  mode: "QUICK" | "STANDARD" | "DEEP";
  questionIndex: number;
  totalQuestions: number;
  followUpsUsed: number;
  questionSummaries: NcsTextPracticeQuestionSummary[];
  question: NcsTextPracticeRecoveryQuestion;
  currentPrompt: string;
  transcript: string;
  followUpAttempt: 0 | 1;
  storedAt: number;
}

export interface NcsRecoveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function saveNcsTextPracticeRecovery(
  storage: NcsRecoveryStorage,
  recovery: NcsTextPracticeRecovery,
): void {
  try {
    storage.setItem(NCS_TEXT_PRACTICE_RECOVERY_KEY, JSON.stringify(recovery));
  } catch {
    // Recovery is best-effort when browser storage is unavailable.
  }
}

export function loadNcsTextPracticeRecovery(
  storage: NcsRecoveryStorage,
  now = Date.now(),
): NcsTextPracticeRecovery | undefined {
  try {
    const raw = storage.getItem(NCS_TEXT_PRACTICE_RECOVERY_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as unknown;
    if (!isRecovery(value) || now - value.storedAt > RECOVERY_MAX_AGE_MS || value.storedAt > now + 60_000) {
      clearNcsTextPracticeRecovery(storage);
      return undefined;
    }
    return value;
  } catch {
    clearNcsTextPracticeRecovery(storage);
    return undefined;
  }
}

export function clearNcsTextPracticeRecovery(storage: NcsRecoveryStorage): void {
  try {
    storage.removeItem(NCS_TEXT_PRACTICE_RECOVERY_KEY);
  } catch {
    // Recovery is best-effort when browser storage is unavailable.
  }
}

function isRecovery(value: unknown): value is NcsTextPracticeRecovery {
  if (!isRecord(value) || !isRecord(value.question)) return false;
  return (
    value.version === 2 &&
    isPositiveInteger(value.processLogId) &&
    isPositiveInteger(value.sessionId) &&
    typeof value.jobRole === "string" && value.jobRole.trim().length > 0 &&
    ["QUICK", "STANDARD", "DEEP"].includes(String(value.mode)) &&
    isNonNegativeInteger(value.questionIndex) &&
    isPositiveInteger(value.totalQuestions) && value.totalQuestions <= 7 &&
    value.questionIndex < value.totalQuestions &&
    isNonNegativeInteger(value.followUpsUsed) && value.followUpsUsed <= 4 &&
    Array.isArray(value.questionSummaries) && value.questionSummaries.every(isQuestionSummary) &&
    isPositiveInteger(value.question.questionId) &&
    RECOVERABLE_QUESTION_TYPES.includes(value.question.questionType as RecoverableQuestionType) &&
    typeof value.question.content === "string" && value.question.content.trim().length > 0 &&
    typeof value.question.audioPrompt === "string" &&
    typeof value.question.answered === "boolean" &&
    typeof value.question.current === "boolean" &&
    isNonNegativeInteger(value.question.sortOrder) &&
    typeof value.currentPrompt === "string" && value.currentPrompt.trim().length > 0 &&
    typeof value.transcript === "string" && value.transcript.trim().length > 0 && value.transcript.length <= 20_000 &&
    (value.followUpAttempt === 0 || value.followUpAttempt === 1) &&
    typeof value.storedAt === "number" && Number.isFinite(value.storedAt)
  );
}

function isQuestionSummary(value: unknown): value is NcsTextPracticeQuestionSummary {
  if (!isRecord(value)) return false;
  return (
    isPositiveInteger(value.questionId) &&
    (value.score === null || (isNonNegativeInteger(value.score) && value.score <= 100)) &&
    typeof value.followUpUsed === "boolean"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
