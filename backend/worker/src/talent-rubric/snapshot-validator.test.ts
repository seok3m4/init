import test from "node:test";
import assert from "node:assert/strict";
import { generateTalentRubricSnapshot } from "./generator";
import {
  TalentRubricSnapshotValidationError,
  validateTalentRubricSnapshot,
} from "./snapshot-validator";

test("생성된 snapshot은 런타임 계약 검증을 통과한다", () => {
  const snapshot = generateTalentRubricSnapshot(sampleInput());

  assert.equal(validateTalentRubricSnapshot(snapshot), snapshot);
});

test("계약 버전과 sourceHash 형식 변조를 거부한다", () => {
  const snapshot = generateTalentRubricSnapshot(sampleInput());

  assertSnapshotError(
    () => validateTalentRubricSnapshot({ ...snapshot, contractVersion: "talent-rubric-snapshot.v2" }),
    "contractVersion",
  );
  assertSnapshotError(
    () => validateTalentRubricSnapshot({ ...snapshot, sourceHash: "sha256:not-a-hash" }),
    "sourceHash",
  );
});

test("0점 criterion, 합계 오류와 중복 ID를 거부한다", () => {
  const snapshot = generateTalentRubricSnapshot(sampleInput());
  const [first, second] = snapshot.criteria;
  assert.ok(first && second);

  assertSnapshotError(
    () => validateTalentRubricSnapshot({
      ...snapshot,
      criteria: [{ ...first, weight: 0 }, second],
    }),
    "criteria[0].weight",
  );
  assertSnapshotError(
    () => validateTalentRubricSnapshot({
      ...snapshot,
      criteria: [{ ...first, weight: 50 }, { ...second, weight: 49 }],
    }),
    "criteria",
  );
  assertSnapshotError(
    () => validateTalentRubricSnapshot({
      ...snapshot,
      criteria: [first, { ...second, id: first.id }],
    }),
    "criteria[1].id",
  );
});

test("indicator, required evidence, anchor와 evidence policy 변조를 거부한다", () => {
  const snapshot = generateTalentRubricSnapshot(sampleInput());
  const [first, second] = snapshot.criteria;
  assert.ok(first && second);

  assertSnapshotError(
    () => validateTalentRubricSnapshot({
      ...snapshot,
      criteria: [{
        ...first,
        behaviorIndicators: first.behaviorIndicators.map((indicator, index) =>
          index === 0 ? { ...indicator, observability: "VIDEO" } : indicator),
      }, second],
    }),
    "criteria[0].behaviorIndicators[0].observability",
  );
  assertSnapshotError(
    () => validateTalentRubricSnapshot({
      ...snapshot,
      criteria: [{ ...first, requiredEvidence: ["ACTION", "RATIONALE", "RESULT"] }, second],
    }),
    "criteria[0].requiredEvidence",
  );
  assertSnapshotError(
    () => validateTalentRubricSnapshot({
      ...snapshot,
      criteria: [{
        ...first,
        scoringAnchors: first.scoringAnchors.map((anchor, index) =>
          index === 4 ? { ...anchor, evidenceStrength: 4 } : anchor),
      }, second],
    }),
    "criteria[0].scoringAnchors[4].evidenceStrength",
  );
  assertSnapshotError(
    () => validateTalentRubricSnapshot({
      ...snapshot,
      evidencePolicy: { ...snapshot.evidencePolicy, requiredEvidenceRule: "ANY_REQUIRED" },
    }),
    "evidencePolicy.requiredEvidenceRule",
  );
});

test("금지 신호 category 순서와 scoring 제외 처분을 강제한다", () => {
  const snapshot = generateTalentRubricSnapshot(sampleInput());
  const [sensitive, nonverbal] = snapshot.prohibitedSignals;
  assert.ok(sensitive && nonverbal);

  assertSnapshotError(
    () => validateTalentRubricSnapshot({
      ...snapshot,
      prohibitedSignals: [nonverbal, sensitive],
    }),
    "prohibitedSignals[0].category",
  );
  assertSnapshotError(
    () => validateTalentRubricSnapshot({
      ...snapshot,
      prohibitedSignals: [{ ...sensitive, disposition: "INCLUDE_IN_SCORING" }, nonverbal],
    }),
    "prohibitedSignals[0].disposition",
  );
});

function sampleInput() {
  return [
    { name: "협업", description: "서로 다른 의견을 조율해 공동 결과를 만든다.", weight: 2 },
    { name: "책임감", description: "맡은 일을 끝까지 수행하고 결과를 확인한다.", weight: 1 },
  ];
}

function assertSnapshotError(action: () => unknown, field: string): void {
  assert.throws(
    action,
    (error: unknown) => error instanceof TalentRubricSnapshotValidationError && error.field === field,
  );
}
