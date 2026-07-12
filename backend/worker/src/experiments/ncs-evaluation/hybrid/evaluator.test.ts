import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { NCS_SCORE_MAP, NcsEvaluationInput } from "../shared/contract";
import { assembleNcsEvaluationInput, contextMapFor, readNcsGoldenDataset } from "../shared/dataset";
import { SelfContainedHybridEvaluator } from "./evaluator";

const datasetPath = resolve(
  process.cwd(),
  "..",
  "..",
  "docs",
  "04_implementation",
  "ncs-evaluation-m0",
  "golden-cases.json",
);

test("hybrid evaluates all behavior points with exact transcript offsets", async () => {
  const dataset = await readNcsGoldenDataset(datasetPath);
  const contexts = contextMapFor(dataset);
  const evaluator = new SelfContainedHybridEvaluator();
  let exactLevels = 0;
  let evaluationCount = 0;

  for (const goldenCase of dataset.cases) {
    const input = assembleNcsEvaluationInput(dataset, goldenCase, contexts);
    const output = evaluator.evaluate(input);
    assert.equal(output.behaviorEvaluations.length, input.behaviorPoints.length);
    assert.equal(new Set(output.behaviorEvaluations.map((item) => item.behaviorPointId)).size, input.behaviorPoints.length);

    for (const evidence of output.evidences) {
      assert.equal(input.answer.transcript.slice(evidence.startChar, evidence.endChar), evidence.quote);
      assert.doesNotMatch(evidence.quote, /여성 지원자|남성 지원자|대학교 출신|표정|시선|억양|말속도/);
    }

    for (const expected of goldenCase.expected.behaviorPoints) {
      const actual = output.behaviorEvaluations.find((item) => item.behaviorPointId === expected.behaviorPointId);
      assert.ok(actual);
      evaluationCount += 1;
      if (actual.level === expected.level) exactLevels += 1;
      assert.equal(actual.score, actual.level === null ? null : NCS_SCORE_MAP[actual.level]);
    }
  }

  assert.ok(exactLevels / evaluationCount >= 0.75, `exact level rate was ${(exactLevels / evaluationCount * 100).toFixed(2)}%`);
});

test("hybrid scoring is invariant to case identifiers and excluded signals", async () => {
  const dataset = await readNcsGoldenDataset(datasetPath);
  const goldenCase = dataset.cases.find((item) => item.caseId === "OPS-001");
  assert.ok(goldenCase);
  const evaluator = new SelfContainedHybridEvaluator();
  const baseInput = assembleNcsEvaluationInput(dataset, goldenCase);
  const base = evaluator.evaluate(baseInput);
  const mutation: NcsEvaluationInput = {
    ...baseInput,
    caseId: "arbitrary-transport-id",
    answer: {
      ...baseInput.answer,
      transcript: `저는 여성 지원자입니다. 표정과 시선은 평가와 무관합니다. ${baseInput.answer.transcript}`,
    },
  };
  const mutated = evaluator.evaluate(mutation);

  assert.deepEqual(
    mutated.behaviorEvaluations.map(({ behaviorPointId, status, level, score, missingEvidence }) => ({
      behaviorPointId,
      status,
      level,
      score,
      missingEvidence,
    })),
    base.behaviorEvaluations.map(({ behaviorPointId, status, level, score, missingEvidence }) => ({
      behaviorPointId,
      status,
      level,
      score,
      missingEvidence,
    })),
  );
  assert.equal(mutated.caseId, "arbitrary-transport-id");
  assert.equal(mutated.evidences.some((evidence) => /여성|표정|시선/.test(evidence.quote)), false);
});

test("hybrid evaluates multiple behavior points independently and deterministically", async () => {
  const dataset = await readNcsGoldenDataset(datasetPath);
  const goldenCase = dataset.cases.find((item) => item.caseId === "MULTI-002");
  assert.ok(goldenCase);
  const evaluator = new SelfContainedHybridEvaluator();
  const input = assembleNcsEvaluationInput(dataset, goldenCase);
  const first = evaluator.evaluate(input);
  const second = evaluator.evaluate(input);
  const solve = first.behaviorEvaluations.find((item) => item.behaviorPointId === "BP-MULTI-SOLVE");
  const share = first.behaviorEvaluations.find((item) => item.behaviorPointId === "BP-MULTI-SHARE");

  assert.equal(solve?.status, "DEMONSTRATED");
  assert.equal(share?.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(first.followUp.required, true);
  assert.deepEqual(first, second);
});
