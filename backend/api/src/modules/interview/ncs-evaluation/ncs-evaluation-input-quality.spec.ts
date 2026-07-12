import { assessNcsEvaluationInputQuality } from "./ncs-evaluation-input-quality";

describe("assessNcsEvaluationInputQuality", () => {
  test.each([
    ["[NO_ANSWER] Recording validation failed twice.", "NO_ANSWER_MARKER"],
    ["...?!", "NO_MEANINGFUL_CONTENT"],
    ["잘 모르겠습니다.", "FILLER_ONLY"],
    ["ㅋㅋㅋㅋㅋ", "REPEATED_CONTENT"],
    ["모름 모름 모름", "REPEATED_CONTENT"],
  ] as const)("평가 불가 입력 %s를 차단한다", (transcript, reason) => {
    expect(assessNcsEvaluationInputQuality(transcript)).toEqual({ assessable: false, reason });
  });

  test.each([
    "캐시를 적용했습니다.",
    "네. 장애가 발생했을 때 로그를 확인하고 롤백했습니다.",
    "인덱스를 변경한 뒤 p95를 비교했습니다.",
  ])("짧아도 구체적인 입력 %s는 허용한다", (transcript) => {
    expect(assessNcsEvaluationInputQuality(transcript)).toEqual({ assessable: true });
  });
});
