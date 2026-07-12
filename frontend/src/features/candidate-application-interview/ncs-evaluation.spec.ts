import test from "node:test";
import assert from "node:assert/strict";
import {
  parseNcsEvaluationProductOutput,
  pollNcsEvaluation,
  queueStoredAnswerNcsEvaluation,
  shouldQueueStoredAnswerNcsEvaluation,
  type NcsAiJobStatus,
  type NcsEvaluationRequest,
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

test("queues assessable mock answers with the STORED_ANSWER contract", async () => {
  const requests: Array<{ sessionId: number; body: NcsEvaluationRequest }> = [];
  const result = await queueStoredAnswerNcsEvaluation({
    mode: "mock",
    sessionId: 101,
    questionId: 501,
    questionType: "TECHNICAL",
    answerId: 701,
    requestEvaluation: async (sessionId, body) => {
      requests.push({ sessionId, body });
      return {
        data: {
          accepted: true,
          processType: "REPORT_GENERATE",
          step: "NCS_ANSWER_EVALUATION",
          status: "PENDING",
          queued: true,
          processLogId: 901,
          sessionId,
          questionId: body.questionId,
          answerId: body.answerId,
          inputRef: "stored-answer-input",
          callbackTopic: "ai.interview.ncs-answer-evaluation.requested",
        },
      };
    },
  });

  assert.equal(result.status, "QUEUED");
  assert.deepEqual(requests, [
    {
      sessionId: 101,
      body: {
        questionId: 501,
        answerSource: "STORED_ANSWER",
        answerId: 701,
      },
    },
  ]);
});

test("skips recruiting and non-assessable mock questions without an API call", async () => {
  let requestCount = 0;
  const requestEvaluation = async () => {
    requestCount += 1;
    throw new Error("request must not run");
  };

  const recruiting = await queueStoredAnswerNcsEvaluation({
    mode: "recruiting",
    sessionId: 101,
    questionId: 501,
    questionType: "TECHNICAL",
    answerId: 701,
    requestEvaluation,
  });
  const intro = await queueStoredAnswerNcsEvaluation({
    mode: "mock",
    sessionId: 101,
    questionId: 502,
    questionType: "INTRO",
    answerId: 702,
    requestEvaluation,
  });

  assert.deepEqual(recruiting, { status: "SKIPPED", reason: "UNSUPPORTED_MODE" });
  assert.deepEqual(intro, { status: "SKIPPED", reason: "QUESTION_NOT_ASSESSABLE" });
  assert.equal(shouldQueueStoredAnswerNcsEvaluation("mock", "FOLLOW_UP"), true);
  assert.equal(shouldQueueStoredAnswerNcsEvaluation("mock", "CLOSING"), false);
  assert.equal(requestCount, 0);
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
