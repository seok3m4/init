import test from "node:test";
import assert from "node:assert/strict";
import { generateTalentRubricSnapshot } from "./generator";
import {
  TALENT_PROFILE_DESCRIPTION_MAX_LENGTH,
  TALENT_PROFILE_NAME_MAX_LENGTH,
  TalentRubricValidationError,
  type TalentRubricValidationErrorCode,
} from "./validation";
import { normalizeTalentWeights } from "./weight-normalizer";

test("동일한 입력 순서와 값은 동일한 snapshot과 sourceHash를 만든다", () => {
  const input = sampleInput();
  const first = generateTalentRubricSnapshot(input);
  const second = generateTalentRubricSnapshot(input);

  assert.deepEqual(first, second);
  assert.match(first.sourceHash, /^sha256:[0-9a-f]{64}$/u);

  const whitespaceEquivalent = generateTalentRubricSnapshot([
    { name: "  협업  ", description: "서로 다른 의견을   조율해 공동 결과를 만든다.", weight: 2 },
    { name: "책임감", description: "맡은 일을 끝까지 수행하고 결과를 확인한다.", weight: 1 },
  ]);
  assert.equal(first.sourceHash, whitespaceEquivalent.sourceHash);
});

test("largest-remainder 방식으로 정수 가중치 합계를 정확히 100으로 만든다", () => {
  assert.deepEqual(normalizeTalentWeights([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(normalizeTalentWeights([0.1, 0.2, 0.3]), [17, 33, 50]);
  assert.deepEqual(normalizeTalentWeights([Number.MIN_VALUE, Number.MAX_VALUE]), [0, 100]);

  const snapshot = generateTalentRubricSnapshot([
    { name: "A", description: "A 행동", weight: 1 },
    { name: "B", description: "B 행동", weight: 1 },
    { name: "C", description: "C 행동" },
  ]);
  assert.equal(snapshot.criteria.reduce((sum, criterion) => sum + criterion.weight, 0), 100);
  assert.deepEqual(snapshot.criteria.map((criterion) => criterion.weight), [34, 33, 33]);
});

test("정규화 후 동일한 인재상 이름을 거부한다", () => {
  assertValidationError(
    () => generateTalentRubricSnapshot([
      { name: "Teamwork", description: "의견을 조율한다." },
      { name: "  teamwork  ", description: "공동 결과를 만든다." },
    ]),
    "DUPLICATE_NAME",
  );
});

test("빈 입력, 6개 초과 입력과 공백 또는 길이 위반을 거부한다", () => {
  assertValidationError(() => generateTalentRubricSnapshot([]), "ITEM_COUNT_OUT_OF_RANGE");
  assertValidationError(
    () => generateTalentRubricSnapshot(
      Array.from({ length: 7 }, (_, index) => ({ name: `기준 ${index}`, description: `설명 ${index}` })),
    ),
    "ITEM_COUNT_OUT_OF_RANGE",
  );
  assertValidationError(
    () => generateTalentRubricSnapshot([{ name: "   ", description: "설명" }]),
    "NAME_REQUIRED",
  );
  assertValidationError(
    () => generateTalentRubricSnapshot([{ name: "기준", description: "\n\t" }]),
    "DESCRIPTION_REQUIRED",
  );
  assertValidationError(
    () => generateTalentRubricSnapshot([{ name: "가".repeat(TALENT_PROFILE_NAME_MAX_LENGTH + 1), description: "설명" }]),
    "NAME_TOO_LONG",
  );
  assertValidationError(
    () => generateTalentRubricSnapshot([{ name: "기준", description: "가".repeat(TALENT_PROFILE_DESCRIPTION_MAX_LENGTH + 1) }]),
    "DESCRIPTION_TOO_LONG",
  );
});

test("weight는 생략하거나 유한한 양수만 사용할 수 있다", () => {
  const snapshot = generateTalentRubricSnapshot([
    { name: "실행", description: "계획을 행동으로 옮긴다." },
    { name: "검증", description: "결과를 확인한다.", weight: 2 },
  ]);
  assert.deepEqual(snapshot.criteria.map((criterion) => criterion.weight), [33, 67]);

  for (const weight of [0, -1, Number.POSITIVE_INFINITY, Number.NaN]) {
    assertValidationError(
      () => generateTalentRubricSnapshot([{ name: "기준", description: "설명", weight }]),
      "WEIGHT_NOT_POSITIVE",
    );
  }
});

test("민감 속성과 비언어 신호를 점수 기준에서 제거하고 금지 목록에 기록한다", () => {
  const snapshot = generateTalentRubricSnapshot([
    {
      name: "포용적 협업",
      description:
        "팀원의 의견을 듣고 합의한 행동과 결과를 설명한다. 성별 나이 학교 외모 장애 시선 표정 목소리 톤",
    },
  ]);
  const scoringText = JSON.stringify(snapshot.criteria);

  for (const signal of ["성별", "나이", "학교", "외모", "장애", "시선", "표정", "목소리 톤"]) {
    assert.equal(scoringText.includes(signal), false, `${signal} must not remain in scoring criteria`);
  }
  assert.deepEqual(
    snapshot.prohibitedSignals.find((signal) => signal.category === "SENSITIVE_ATTRIBUTE")?.detectedInSource,
    ["성별/성 정체성", "나이/연령", "출신 학교/학벌", "외모/용모", "장애 여부"],
  );
  assert.deepEqual(
    snapshot.prohibitedSignals.find((signal) => signal.category === "NONVERBAL_SIGNAL")?.detectedInSource,
    ["시선/눈맞춤", "표정", "목소리 톤/음색/억양"],
  );
  assertValidationError(
    () => generateTalentRubricSnapshot([{ name: "외모", description: "시선과 표정, 목소리 톤" }]),
    "NO_ASSESSABLE_CONTENT",
  );

  const technicalIncident = generateTalentRubricSnapshot([
    {
      name: "장애 대응",
      description: "서비스 장애를 자세히 분석하고 장애가 발생하면 빠르게 복구한 결과를 확인한다.",
    },
  ]);
  assert.equal(technicalIncident.criteria[0]?.name, "장애 대응");
  assert.equal(
    technicalIncident.criteria[0]?.definition,
    "서비스 장애를 자세히 분석하고 장애가 발생하면 빠르게 복구한 결과를 확인한다.",
  );
  assert.deepEqual(
    technicalIncident.prohibitedSignals.find((signal) => signal.category === "SENSITIVE_ATTRIBUTE")?.detectedInSource,
    [],
  );
  assert.deepEqual(
    technicalIncident.prohibitedSignals.find((signal) => signal.category === "NONVERBAL_SIGNAL")?.detectedInSource,
    [],
  );
});

test("금지 신호 제거 후 같은 이름이 되는 인재상은 중복으로 거부한다", () => {
  assertValidationError(
    () => generateTalentRubricSnapshot([
      { name: "남성 책임감", description: "맡은 일을 끝까지 수행한다." },
      { name: "여성 책임감", description: "약속한 결과를 확인한다." },
    ]),
    "DUPLICATE_NAME",
  );
});

test("서로 다른 인재상의 원문 의미를 criterion 정의와 indicator에 보존한다", () => {
  const snapshot = generateTalentRubricSnapshot([
    { name: "실험적 학습", description: "작은 실험을 실행하고 결과를 다음 시도에 반영한다." },
    { name: "고객 책임", description: "고객에게 미치는 영향을 확인하고 약속한 후속 조치를 수행한다." },
  ]);
  const [learning, responsibility] = snapshot.criteria;

  assert.equal(learning?.definition, "작은 실험을 실행하고 결과를 다음 시도에 반영한다.");
  assert.equal(responsibility?.definition, "고객에게 미치는 영향을 확인하고 약속한 후속 조치를 수행한다.");
  assert.notEqual(learning?.id, responsibility?.id);
  assert.ok(learning?.behaviorIndicators.every((indicator) => indicator.description.includes("실험적 학습")));
  assert.ok(responsibility?.behaviorIndicators.every((indicator) => indicator.description.includes("고객 책임")));
  assert.ok(learning?.behaviorIndicators.every((indicator) => indicator.description.includes(learning.definition)));
  assert.ok(
    responsibility?.behaviorIndicators.every((indicator) => indicator.description.includes(responsibility.definition)),
  );
});

test("각 criterion은 transcript 전용 indicator, 필수 근거와 단조로운 1~5 anchor를 가진다", () => {
  const snapshot = generateTalentRubricSnapshot(sampleInput());

  for (const criterion of snapshot.criteria) {
    assert.equal(criterion.behaviorIndicators.length, 4);
    assert.deepEqual(
      criterion.behaviorIndicators.map((indicator) => indicator.evidenceType),
      ["ACTION", "RATIONALE", "RESULT", "REFLECTION"],
    );
    assert.ok(criterion.behaviorIndicators.every((indicator) => indicator.observability === "ANSWER_TRANSCRIPT"));
    assert.deepEqual(criterion.requiredEvidence, ["ACTION", "RATIONALE", "RESULT", "REFLECTION"]);
    assert.deepEqual(criterion.scoringAnchors.map((anchor) => anchor.level), [1, 2, 3, 4, 5]);
    assert.deepEqual(criterion.scoringAnchors.map((anchor) => anchor.evidenceStrength), [1, 2, 3, 4, 5]);
    for (let index = 1; index < criterion.scoringAnchors.length; index += 1) {
      assert.ok(
        (criterion.scoringAnchors[index]?.evidenceStrength ?? 0)
          > (criterion.scoringAnchors[index - 1]?.evidenceStrength ?? 0),
      );
    }
  }
  assert.deepEqual(snapshot.evidencePolicy, {
    source: "ANSWER_TRANSCRIPT",
    requiredEvidenceRule: "ALL_REQUIRED",
    missingRequiredEvidenceStatus: "INSUFFICIENT_EVIDENCE",
    insufficientEvidenceScore: null,
  });
});

function sampleInput() {
  return [
    { name: "협업", description: "서로 다른 의견을 조율해 공동 결과를 만든다.", weight: 2 },
    { name: "책임감", description: "맡은 일을 끝까지 수행하고 결과를 확인한다.", weight: 1 },
  ];
}

function assertValidationError(action: () => unknown, code: TalentRubricValidationErrorCode): void {
  assert.throws(
    action,
    (error: unknown) => error instanceof TalentRubricValidationError && error.code === code,
  );
}
