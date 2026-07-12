import test from "node:test";
import assert from "node:assert/strict";
import {
  parseNcsEvaluationProductOutput,
  pollNcsEvaluation,
  type NcsAiJobStatus,
} from "./ncs-evaluation";

test("parses a valid NCS product output", () => {
  const output = validOutput();
  assert.deepEqual(parseNcsEvaluationProductOutput(output), output);
});

test("rejects invalid score mapping and blocked guardrail output", () => {
  const scoreMismatch = validOutput();
  scoreMismatch.behaviorEvaluations[0]!.score = 100;
  assert.equal(parseNcsEvaluationProductOutput(scoreMismatch), undefined);

  const blocked = validOutput();
  blocked.guardrail.nonverbalSignalUsed = true as false;
  assert.equal(parseNcsEvaluationProductOutput(blocked), undefined);
});

test("polls pending jobs until a validated result is completed", async () => {
  const statuses: NcsAiJobStatus[] = [
    { status: "PENDING" },
    { status: "RUNNING" },
    { status: "COMPLETED", output: validOutput() },
  ];
  const observed: string[] = [];
  const result = await pollNcsEvaluation({
    processLogId: 10,
    attempts: 3,
    intervalMs: 0,
    getStatus: async () => ({ data: statuses.shift()! }),
    onStatus: (status) => observed.push(status),
    wait: async () => undefined,
  });

  assert.equal(result.contractVersion, "ncs-evaluation-product.v1");
  assert.deepEqual(observed, ["PENDING", "RUNNING", "COMPLETED"]);
});

test("surfaces worker failure and timeout messages", async () => {
  await assert.rejects(
    pollNcsEvaluation({
      processLogId: 11,
      getStatus: async () => ({ data: { status: "FAILED", failure: { reason: "guardrail blocked" } } }),
    }),
    /guardrail blocked/,
  );
  await assert.rejects(
    pollNcsEvaluation({
      processLogId: 12,
      attempts: 2,
      intervalMs: 0,
      getStatus: async () => ({ data: { status: "RUNNING" } }),
      wait: async () => undefined,
    }),
    /평가가 지연/,
  );
});

function validOutput() {
  return {
    contractVersion: "ncs-evaluation-product.v1",
    evaluationSnapshotVersion: "service-ncs-starter-v1:test",
    sessionId: 101,
    questionId: 501,
    evidences: [
      {
        evidenceId: "evidence-1",
        quote: "복합 인덱스를 적용했습니다.",
        startChar: 0,
        endChar: 15,
        claimType: "ACTION",
        behaviorPointIds: ["behavior-1"],
      },
    ],
    behaviorEvaluations: [
      {
        behaviorPointId: "behavior-1",
        status: "DEMONSTRATED",
        level: 4,
        score: 85,
        rationale: "행동과 결과가 연결됩니다.",
        supportingEvidenceIds: ["evidence-1"],
        contradictingEvidenceIds: [] as string[],
        missingEvidence: [] as string[],
        confidence: "HIGH",
      },
    ],
    coverage: {
      assessableBehaviorPointCount: 1,
      evaluatedBehaviorPointCount: 1,
      ratio: 1,
      status: "SUFFICIENT",
    },
    followUp: {
      required: false,
      reason: null,
      missingEvidence: [] as string[],
      suggestedQuestion: null,
    },
    guardrail: {
      unsupportedFactDetected: false,
      sensitiveAttributeUsed: false,
      nonverbalSignalUsed: false,
      hiringDecisionLanguageDetected: false,
    },
    metadata: {
      strategyId: "evidence-state",
      strategyVersion: "evidence-state-rules-v1",
      model: "deterministic-evidence-state-v1",
    },
  };
}
