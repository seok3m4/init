import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  NCS_EVALUATION_CONTRACT_VERSION,
  NcsBehaviorPoint,
  NcsEvaluationInput,
} from "../shared/contract";
import { assembleNcsEvaluationInput, readNcsGoldenDataset } from "../shared/dataset";
import { CommonRubricEvaluator } from "./evaluator";

const datasetPath = resolve(process.cwd(), "..", "..", "docs", "04_implementation", "ncs-evaluation-m0", "golden-cases.json");

test("common rubric maps complete evidence to level five with exact offsets", () => {
  const evaluator = new CommonRubricEvaluator();
  const input = makeInput(
    "오류 경보를 보고 로그에서 설정 원인을 확인했습니다. 고객 영향을 줄이기 위해 설정을 롤백했고 오류율이 정상화됐습니다. 이후 같은 오류를 막도록 경보를 체크리스트에 추가했습니다.",
  );

  const outputs = Array.from({ length: 5 }, () => evaluator.evaluate(input));
  assert.deepEqual(outputs.slice(1), outputs.slice(0, 4));
  const output = outputs[0];
  assert.equal(output.behaviorEvaluations[0].level, 5);
  assert.equal(output.behaviorEvaluations[0].score, 100);
  assert.ok(output.evidences.some((evidence) => evidence.claimType === "REFLECTION"));
  for (const evidence of output.evidences) {
    assert.equal(input.answer.transcript.slice(evidence.startChar, evidence.endChar), evidence.quote);
  }
});

test("common rubric excludes sensitive and nonverbal-only sentences", () => {
  const evaluator = new CommonRubricEvaluator();
  const transcript = "오류 경보를 보고 로그에서 설정 원인을 확인했습니다. 고객 영향을 줄이기 위해 설정을 롤백했고 오류율이 정상화됐습니다.";
  const base = evaluator.evaluate(makeInput(transcript, "transport-a"));
  const mutation = evaluator.evaluate(makeInput(`저는 여성 지원자입니다. 시선과 억양이 안정적이었습니다. ${transcript}`, "transport-b"));

  assert.deepEqual(decisionSignature(base), decisionSignature(mutation));
  assert.equal(mutation.evidences.some((evidence) => /(여성 지원자|시선|억양)/.test(evidence.quote)), false);
});

test("common rubric judges multiple behavior points independently", () => {
  const evaluator = new CommonRubricEvaluator();
  const technical = behaviorPoint(
    "technical-output-id",
    "관찰 가능한 정보로 원인을 좁히고 해결 결과를 검증한다.",
    ["SITUATION", "ACTION", "RATIONALE", "RESULT"],
  );
  const communication = behaviorPoint(
    "communication-output-id",
    "영향과 불확실성을 관계자에게 공유하고 역할과 대응을 조율한다.",
    ["SITUATION", "ACTION", "RATIONALE", "RESULT"],
  );
  const input = makeInput(
    "로그에서 토큰 만료 설정 변경을 확인해 해당 설정을 롤백했고 오류율이 정상화됐습니다.",
    "multi",
    [technical, communication],
  );
  const output = evaluator.evaluate(input);

  assert.equal(output.behaviorEvaluations.find((item) => item.behaviorPointId === technical.behaviorPointId)?.level, 4);
  assert.equal(output.behaviorEvaluations.find((item) => item.behaviorPointId === communication.behaviorPointId)?.level, null);
  assert.equal(output.followUp.required, true);
});

test("common rubric assigns explicit contradictory conduct to level one", () => {
  const evaluator = new CommonRubricEvaluator();
  const output = evaluator.evaluate(makeInput(
    "처음에는 팀원의 의견을 듣고 합의했다고 설명했습니다. 그러나 실제로는 반대 의견을 듣지 않고 제 방식대로 결정했으며 합의한 적이 없습니다.",
    "contradiction",
    [behaviorPoint(
      "collaboration-output-id",
      "상대의 관점과 근거를 확인하고 공동 목표와 객관적 기준으로 합의를 형성한다.",
      ["SITUATION", "ACTION", "RATIONALE", "RESULT"],
    )],
  ));

  assert.equal(output.behaviorEvaluations[0].level, 1);
  assert.equal(output.behaviorEvaluations[0].supportingEvidenceIds.length, 0);
  assert.ok(output.behaviorEvaluations[0].contradictingEvidenceIds.length > 0);
});

test("common rubric does not use transport identifiers in judgment", () => {
  const evaluator = new CommonRubricEvaluator();
  const first = makeInput("조회가 느려 실행 계획에서 풀스캔을 확인하고 복합 인덱스를 적용했습니다.", "alpha");
  const second = {
    ...first,
    caseId: "unrelated-case-name",
    question: { ...first.question, questionId: "changed-question-id" },
    answer: { ...first.answer, answerId: "changed-answer-id" },
  };

  assert.deepEqual(decisionSignature(evaluator.evaluate(first)), decisionSignature(evaluator.evaluate(second)));
});

test("common rubric evaluates all golden inputs without reading expected data", async () => {
  const dataset = await readNcsGoldenDataset(datasetPath);
  const evaluator = new CommonRubricEvaluator();
  for (const goldenCase of dataset.cases) {
    const input = assembleNcsEvaluationInput(dataset, goldenCase);
    const output = evaluator.evaluate(input);
    assert.equal(output.behaviorEvaluations.length, input.behaviorPoints.length);
    assert.equal(new Set(output.behaviorEvaluations.map((item) => item.behaviorPointId)).size, input.behaviorPoints.length);
    for (const evidence of output.evidences) {
      assert.equal(input.answer.transcript.slice(evidence.startChar, evidence.endChar), evidence.quote);
    }
  }
});

function makeInput(
  transcript: string,
  caseId = "transport-id",
  behaviorPoints = [behaviorPoint(
    "behavior-output-id",
    "관찰된 징후를 바탕으로 원인을 좁히고 선택 근거가 있는 복구 조치와 재발 방지를 수행한다.",
    ["SITUATION", "ACTION", "RATIONALE", "RESULT", "REFLECTION"],
  )],
): NcsEvaluationInput {
  return {
    contractVersion: NCS_EVALUATION_CONTRACT_VERSION,
    caseId,
    locale: "ko-KR",
    question: {
      questionId: "question-transport-id",
      questionType: "EXPERIENCE",
      content: "문제를 해결한 경험을 설명해 주세요.",
    },
    answer: { answerId: "answer-transport-id", transcript },
    ncsContext: {
      sourceKind: "SYNTHETIC_NCS_LIKE",
      version: "test",
      categoryType: "JOB_PERFORMANCE",
      unit: {
        code: "unit-transport-code",
        name: "문제 해결",
        level: null,
        definition: "근거를 바탕으로 문제를 해결한다.",
        elements: behaviorPoints.map((point, index) => ({
          elementCode: point.sourceElementCodes[0] ?? `element-${index + 1}`,
          name: point.description,
        })),
      },
    },
    behaviorPoints,
    interviewContext: { attemptNumber: 1, maxFollowUps: 1, followUpsUsed: 0 },
    evaluationPolicy: {
      scoreMap: { "1": 25, "2": 50, "3": 70, "4": 85, "5": 100 },
      minimumSupportingEvidence: 1,
      insufficientEvidenceScore: null,
      allowSensitiveAttributes: false,
      allowNonverbalScore: false,
    },
  };
}

function behaviorPoint(
  behaviorPointId: string,
  description: string,
  requiredEvidence: NcsBehaviorPoint["requiredEvidence"],
): NcsBehaviorPoint {
  return {
    behaviorPointId,
    description,
    sourceElementCodes: [`element-${behaviorPointId}`],
    observability: "INTERVIEW",
    requiredEvidence,
  };
}

function decisionSignature(output: ReturnType<CommonRubricEvaluator["evaluate"]>) {
  return {
    evaluations: output.behaviorEvaluations.map(({ behaviorPointId: _behaviorPointId, ...evaluation }) => evaluation),
    evidence: output.evidences.map(({ evidenceId: _evidenceId, behaviorPointIds: _behaviorPointIds, startChar: _startChar, endChar: _endChar, ...evidence }) => evidence),
    coverage: output.coverage,
    followUp: output.followUp,
    guardrail: output.guardrail,
    metadata: output.metadata,
  };
}
