import test from "node:test";
import assert from "node:assert/strict";
import {
  NCS_EVALUATION_CONTRACT_VERSION,
  NcsBehaviorPoint,
  NcsEvaluationInput,
} from "../shared/contract";
import {
  createEvidenceStateMaterial,
  EvidenceStateNcsEvaluator,
  evaluateEvidenceMaterial,
  extractBehaviorEvidenceStates,
  mapEvidenceState,
} from "./evaluator";

const databaseBehavior: NcsBehaviorPoint = {
  behaviorPointId: "behavior-database",
  description: "측정과 실행 계획으로 병목을 확인하고 개선안을 적용해 효과와 부작용을 검증한다.",
  sourceElementCodes: ["element-1"],
  observability: "INTERVIEW",
  requiredEvidence: ["SITUATION", "ACTION", "RATIONALE", "RESULT", "TRADEOFF"],
};

test("extracts an explicit evidence state before mapping a decision", () => {
  const input = createInput(
    "실행 계획에서 풀스캔을 확인했습니다. 조회 조건에 맞춘 복합 인덱스를 적용했고 p95가 1.1초에서 210ms로 줄었습니다.",
  );
  const material = createEvidenceStateMaterial(input);
  const states = extractBehaviorEvidenceStates(material);

  assert.equal(Object.hasOwn(material, "caseId"), false);
  assert.equal(Object.hasOwn(material, "expected"), false);
  assert.equal(Object.hasOwn(material, "relations"), false);
  assert.equal(Object.hasOwn(states[0], "level"), false);
  assert.equal(Object.hasOwn(states[0], "score"), false);
  assert.ok(states[0].availableEvidence.includes("ACTION"));
  assert.ok(states[0].availableEvidence.includes("RATIONALE"));
  assert.ok(states[0].availableEvidence.includes("RESULT"));

  const decision = mapEvidenceState(states[0]);
  assert.equal(decision.status, "DEMONSTRATED");
  assert.equal(decision.level, 4);
  assert.equal(decision.score, 85);
});

test("uses exact transcript offsets while ignoring sensitive and nonverbal-only signals", () => {
  const evaluator = new EvidenceStateNcsEvaluator();
  const sensitiveInput = createInput(
    "저는 여성 지원자입니다. 실행 계획에서 풀스캔을 확인했습니다. 복합 인덱스를 적용했고 p95가 900ms에서 220ms로 줄었습니다.",
  );
  const output = evaluator.evaluate(sensitiveInput);

  assert.equal(output.behaviorEvaluations[0].level, 4);
  assert.equal(output.evidences.some((evidence) => /여성/u.test(evidence.quote)), false);
  for (const evidence of output.evidences) {
    assert.equal(
      sensitiveInput.answer.transcript.slice(evidence.startChar, evidence.endChar),
      evidence.quote,
    );
  }

  const nonverbalOnly = evaluator.evaluate(createInput("시선을 유지하고 목소리 톤을 안정적으로 조절했습니다."));
  assert.equal(nonverbalOnly.behaviorEvaluations[0].status, "INSUFFICIENT_EVIDENCE");
  assert.equal(nonverbalOnly.evidences.length, 0);
});

test("evaluates each behavior point independently", () => {
  const behaviors: NcsBehaviorPoint[] = [
    {
      behaviorPointId: "behavior-solve",
      description: "관찰 가능한 정보로 원인을 좁히고 해결 결과를 검증한다.",
      sourceElementCodes: ["element-1"],
      observability: "INTERVIEW",
      requiredEvidence: ["SITUATION", "ACTION", "RATIONALE", "RESULT"],
    },
    {
      behaviorPointId: "behavior-share",
      description: "영향과 불확실성을 관계자에게 공유하고 역할과 대응을 조율한다.",
      sourceElementCodes: ["element-1"],
      observability: "INTERVIEW",
      requiredEvidence: ["SITUATION", "ACTION", "RATIONALE", "RESULT"],
    },
  ];
  const output = new EvidenceStateNcsEvaluator().evaluate(createInput(
    "로그에서 토큰 만료 설정 변경을 확인해 해당 설정을 롤백했고 오류율이 정상화됐습니다.",
    behaviors,
  ));

  assert.equal(output.behaviorEvaluations[0].status, "DEMONSTRATED");
  assert.equal(output.behaviorEvaluations[1].status, "INSUFFICIENT_EVIDENCE");
  assert.equal(output.followUp.required, true);
});

test("case identifiers are opaque to deterministic evaluation", () => {
  const evaluator = new EvidenceStateNcsEvaluator();
  const firstInput = createInput("조회 속도가 느려 실행 계획을 확인하고 인덱스를 수정했습니다.");
  const secondInput = structuredClone(firstInput);
  secondInput.caseId = "completely-different-envelope-id";

  const first = evaluator.evaluate(firstInput);
  const second = evaluator.evaluate(secondInput);
  assert.equal(first.caseId, firstInput.caseId);
  assert.equal(second.caseId, secondInput.caseId);
  assert.deepEqual(first.behaviorEvaluations, second.behaviorEvaluations);
  assert.deepEqual(first.evidences, second.evidences);
  assert.deepEqual(
    evaluateEvidenceMaterial(createEvidenceStateMaterial(firstInput)),
    evaluateEvidenceMaterial(createEvidenceStateMaterial(secondInput)),
  );
});

test("keeps insufficient evidence after follow-up budget is exhausted", () => {
  const input = createInput("");
  input.interviewContext.followUpsUsed = 1;
  const output = new EvidenceStateNcsEvaluator().evaluate(input);

  assert.equal(output.behaviorEvaluations[0].status, "INSUFFICIENT_EVIDENCE");
  assert.equal(output.behaviorEvaluations[0].level, null);
  assert.equal(output.followUp.required, false);
});

function createInput(
  transcript: string,
  behaviorPoints: NcsBehaviorPoint[] = [databaseBehavior],
): NcsEvaluationInput {
  return {
    contractVersion: NCS_EVALUATION_CONTRACT_VERSION,
    caseId: "opaque-test-envelope",
    locale: "ko-KR",
    question: {
      questionId: "question-1",
      questionType: "EXPERIENCE",
      content: "문제를 분석하고 개선한 경험을 설명해 주세요.",
    },
    answer: {
      answerId: "answer-1",
      transcript,
    },
    ncsContext: {
      sourceKind: "SYNTHETIC_NCS_LIKE",
      version: "test-v1",
      categoryType: "JOB_PERFORMANCE",
      unit: {
        code: "TEST-UNIT",
        name: "문제 분석과 개선",
        level: null,
        definition: "관찰 가능한 정보로 원인을 분석하고 개선 결과를 검증한다.",
        elements: [{ elementCode: "element-1", name: "분석 및 검증" }],
      },
    },
    behaviorPoints,
    interviewContext: {
      attemptNumber: 1,
      maxFollowUps: 1,
      followUpsUsed: 0,
    },
    evaluationPolicy: {
      scoreMap: { "1": 25, "2": 50, "3": 70, "4": 85, "5": 100 },
      minimumSupportingEvidence: 1,
      insufficientEvidenceScore: null,
      allowSensitiveAttributes: false,
      allowNonverbalScore: false,
    },
  };
}
