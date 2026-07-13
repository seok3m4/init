import type { InterviewQuestion, QuestionType } from "../interview.runtime.types";

export const NCS_TEXT_PRACTICE_MODES = ["QUICK", "STANDARD", "DEEP"] as const;
export type NcsTextPracticeMode = (typeof NCS_TEXT_PRACTICE_MODES)[number];

export const NCS_TEXT_PRACTICE_MODE_POLICY: Record<
  NcsTextPracticeMode,
  { questionCount: number; maxFollowUps: number }
> = {
  QUICK: { questionCount: 3, maxFollowUps: 2 },
  STANDARD: { questionCount: 5, maxFollowUps: 3 },
  DEEP: { questionCount: 7, maxFollowUps: 4 },
};

export const NCS_TEXT_PRACTICE_QUESTIONS: Array<{
  questionType: Extract<QuestionType, "TECHNICAL" | "EXPERIENCE" | "SITUATION">;
  content: string;
  sortOrder: number;
}> = [
  {
    questionType: "TECHNICAL",
    content: "지원 직무에서 기술 대안을 비교하고 선택했던 경험과 판단 기준을 설명해주세요.",
    sortOrder: 101,
  },
  {
    questionType: "SITUATION",
    content: "지원 직무에서 예상하지 못한 문제나 장애를 발견하고 해결한 과정을 설명해주세요.",
    sortOrder: 102,
  },
  {
    questionType: "EXPERIENCE",
    content: "지원 직무에 필요한 새로운 지식이나 도구를 학습해 실제 업무에 적용한 경험을 설명해주세요.",
    sortOrder: 103,
  },
  {
    questionType: "TECHNICAL",
    content: "일정과 품질이 충돌했던 상황에서 테스트 또는 검증 범위를 결정한 경험을 설명해주세요.",
    sortOrder: 104,
  },
  {
    questionType: "SITUATION",
    content: "요구사항이나 이해관계자의 의견이 충돌했을 때 기준을 정하고 합의한 과정을 설명해주세요.",
    sortOrder: 105,
  },
  {
    questionType: "TECHNICAL",
    content: "성능, 확장성 또는 운영 안정성을 개선하기 위해 측정하고 검증했던 경험을 설명해주세요.",
    sortOrder: 106,
  },
  {
    questionType: "EXPERIENCE",
    content: "실패하거나 기대와 달랐던 결과를 회고하고 이후 업무 방식을 바꾼 경험을 설명해주세요.",
    sortOrder: 107,
  },
];

const NCS_TEXT_PRACTICE_QUESTION_ORDER = new Map(
  NCS_TEXT_PRACTICE_QUESTIONS.map((question, index) => [question.content, index]),
);

export function isNcsTextPracticeMode(value: unknown): value is NcsTextPracticeMode {
  return NCS_TEXT_PRACTICE_MODES.includes(value as NcsTextPracticeMode);
}

export function isNcsTextPracticeQuestion(question: Pick<InterviewQuestion, "content">): boolean {
  return NCS_TEXT_PRACTICE_QUESTION_ORDER.has(question.content);
}

export function selectNcsTextPracticeQuestions(
  questions: InterviewQuestion[],
  mode: NcsTextPracticeMode,
): InterviewQuestion[] {
  return questions
    .filter(isNcsTextPracticeQuestion)
    .sort(
      (left, right) =>
        (NCS_TEXT_PRACTICE_QUESTION_ORDER.get(left.content) ?? Number.MAX_SAFE_INTEGER)
        - (NCS_TEXT_PRACTICE_QUESTION_ORDER.get(right.content) ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, NCS_TEXT_PRACTICE_MODE_POLICY[mode].questionCount);
}
