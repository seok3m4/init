import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  NCS_EVALUATION_CONTRACT_VERSION,
  type NcsEvaluationInput,
  type NcsGoldenCase,
  type NcsGoldenContext,
} from "../shared/contract";
import { EvidenceStateNcsEvaluator } from "./evaluator";

interface HoldoutDataset {
  datasetVersion: "ncs-evaluation-holdout.v1";
  contractVersion: typeof NCS_EVALUATION_CONTRACT_VERSION;
  defaultEvaluationPolicy: NcsEvaluationInput["evaluationPolicy"];
  contexts: NcsGoldenContext[];
  cases: NcsGoldenCase[];
}

const holdoutPath = resolve(
  process.cwd(),
  "..",
  "..",
  "docs",
  "04_implementation",
  "ncs-evaluation-holdout",
  "holdout-cases.json",
);
const goldenPath = resolve(
  process.cwd(),
  "..",
  "..",
  "docs",
  "04_implementation",
  "ncs-evaluation-m0",
  "golden-cases.json",
);

test("evidence-state passes the separate STT and paraphrase holdout", async (t) => {
  const holdout = JSON.parse(await readFile(holdoutPath, "utf8")) as HoldoutDataset;
  const golden = JSON.parse(await readFile(goldenPath, "utf8")) as { cases: NcsGoldenCase[] };
  assert.equal(holdout.datasetVersion, "ncs-evaluation-holdout.v1");
  assert.equal(holdout.contractVersion, NCS_EVALUATION_CONTRACT_VERSION);

  const goldenIds = new Set(golden.cases.map((item) => item.caseId));
  assert.equal(holdout.cases.some((item) => goldenIds.has(item.caseId)), false);

  const contexts = new Map(holdout.contexts.map((context) => [context.contextId, context]));
  const evaluator = new EvidenceStateNcsEvaluator();
  for (const holdoutCase of holdout.cases) {
    await t.test(holdoutCase.caseId, () => {
      const context = contexts.get(holdoutCase.contextId);
      assert.ok(context, `missing context ${holdoutCase.contextId}`);
      const input: NcsEvaluationInput = {
        contractVersion: NCS_EVALUATION_CONTRACT_VERSION,
        caseId: holdoutCase.caseId,
        locale: context.locale,
        question: context.question,
        answer: holdoutCase.answer,
        ncsContext: context.ncsContext,
        behaviorPoints: context.behaviorPoints,
        interviewContext: holdoutCase.interviewContext,
        evaluationPolicy: holdout.defaultEvaluationPolicy,
      };
      const output = evaluator.evaluate(input);
      const expected = holdoutCase.expected.behaviorPoints[0];
      const actual = output.behaviorEvaluations[0];

      assert.equal(actual.status, expected.status);
      assert.equal(actual.level, expected.level);
      assert.equal(actual.score, expected.score);
      assert.equal(output.followUp.required, holdoutCase.expected.followUpRequired);
      for (const quote of expected.mustQuote) {
        assert.ok(output.evidences.some((evidence) => evidence.quote.includes(quote)), `missing quote: ${quote}`);
      }
      for (const evidence of output.evidences) {
        assert.equal(input.answer.transcript.slice(evidence.startChar, evidence.endChar), evidence.quote);
      }
    });
  }
});

test("holdout improvements keep all M0 golden labels stable", async () => {
  const golden = JSON.parse(await readFile(goldenPath, "utf8")) as HoldoutDataset;
  const contexts = new Map(golden.contexts.map((context) => [context.contextId, context]));
  const evaluator = new EvidenceStateNcsEvaluator();

  for (const goldenCase of golden.cases) {
    const context = contexts.get(goldenCase.contextId);
    assert.ok(context, `missing context for ${goldenCase.caseId}`);
    const input: NcsEvaluationInput = {
      contractVersion: NCS_EVALUATION_CONTRACT_VERSION,
      caseId: goldenCase.caseId,
      locale: context.locale,
      question: context.question,
      answer: goldenCase.answer,
      ncsContext: context.ncsContext,
      behaviorPoints: context.behaviorPoints,
      interviewContext: goldenCase.interviewContext,
      evaluationPolicy: golden.defaultEvaluationPolicy,
    };
    const output = evaluator.evaluate(input);
    assert.equal(output.followUp.required, goldenCase.expected.followUpRequired, `${goldenCase.caseId} follow-up`);

    for (const expected of goldenCase.expected.behaviorPoints) {
      const actual = output.behaviorEvaluations.find((item) => item.behaviorPointId === expected.behaviorPointId);
      assert.ok(actual, `${goldenCase.caseId} missing behavior ${expected.behaviorPointId}`);
      assert.equal(actual.status, expected.status, `${goldenCase.caseId} status`);
      assert.equal(actual.level, expected.level, `${goldenCase.caseId} level`);
      assert.equal(actual.score, expected.score, `${goldenCase.caseId} score`);
      for (const quote of expected.mustQuote) {
        assert.ok(output.evidences.some((evidence) => evidence.quote.includes(quote)), `${goldenCase.caseId} quote: ${quote}`);
      }
    }
  }
});
