import { strict as assert } from "node:assert";
import type { InterviewQuestion, QuestionType } from "../interview.runtime.types";
import { BuiltInNcsEvaluationSnapshotResolver } from "./built-in-ncs-evaluation-snapshot.resolver";

function createQuestion(questionType: QuestionType, overrides: Partial<InterviewQuestion> = {}): InterviewQuestion {
  return {
    questionId: 501,
    questionType,
    content: "기술 대안을 비교하고 선택한 경험을 설명해 주세요.",
    sortOrder: 1,
    interviewType: "MOCK",
    isActive: true,
    ...overrides,
  };
}

describe("BuiltInNcsEvaluationSnapshotResolver", () => {
  const resolver = new BuiltInNcsEvaluationSnapshotResolver();

  test("기술 질문을 서버 고정 평가 스냅샷으로 변환한다", () => {
    const snapshot = resolver.resolve(createQuestion("TECHNICAL", { jobRole: "백엔드 개발자" }));

    assert.ok(snapshot);
    assert.equal(snapshot.contractVersion, "ncs-evaluation-product.v1");
    assert.equal(snapshot.question.questionType, "EXPERIENCE");
    assert.equal(snapshot.ncsContext.sourceKind, "SYNTHETIC_NCS_LIKE");
    assert.equal(snapshot.ncsContext.unit.name, "백엔드 개발자 - 기술 의사결정");
    assert.deepEqual(snapshot.behaviorPoints[0]?.requiredEvidence, ["ACTION", "RATIONALE", "RESULT", "TRADEOFF"]);
    assert.deepEqual(snapshot.evaluationPolicy.scoreMap, { 1: 25, 2: 50, 3: 70, 4: 85, 5: 100 });
    assert.equal(snapshot.evaluationPolicy.allowSensitiveAttributes, false);
    assert.equal(snapshot.evaluationPolicy.allowNonverbalScore, false);
  });

  test("동일 질문은 동일 버전을 반환하되 공유 객체를 재사용하지 않는다", () => {
    const question = createQuestion("EXPERIENCE");
    const first = resolver.resolve(question);
    const second = resolver.resolve(question);

    assert.ok(first);
    assert.ok(second);
    assert.equal(first.snapshotVersion, second.snapshotVersion);
    assert.notEqual(first, second);
    assert.notEqual(first.behaviorPoints, second.behaviorPoints);
  });

  test("질문 내용이 바뀌면 스냅샷 버전도 바뀐다", () => {
    const first = resolver.resolve(createQuestion("SITUATION"));
    const second = resolver.resolve(createQuestion("SITUATION", { content: "장애 상황의 대응 계획을 설명해 주세요." }));

    assert.ok(first);
    assert.ok(second);
    assert.notEqual(first.snapshotVersion, second.snapshotVersion);
  });

  test.each(["INTRO", "CLOSING"] satisfies QuestionType[])("%s 질문에는 점수 스냅샷을 만들지 않는다", (questionType) => {
    assert.equal(resolver.resolve(createQuestion(questionType)), undefined);
  });
});
