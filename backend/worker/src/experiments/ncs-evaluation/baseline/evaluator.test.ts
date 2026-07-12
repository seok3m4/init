import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { assembleNcsEvaluationInput, contextMapFor, readNcsGoldenDataset } from "../shared/dataset";
import { NcsGoldenCase } from "../shared/contract";
import { DeterministicNcsBaselineEvaluator } from "./evaluator";

const datasetPath = resolve(process.cwd(), "..", "..", "docs", "04_implementation", "ncs-evaluation-m0", "golden-cases.json");

test("baseline evaluates every golden case without reading expected labels", async () => {
  const dataset = await readNcsGoldenDataset(datasetPath);
  const contexts = contextMapFor(dataset);
  const evaluator = new DeterministicNcsBaselineEvaluator();
  let exact = 0;
  let total = 0;
  const mismatches: string[] = [];
  for (const goldenCase of dataset.cases) {
    const output = evaluator.evaluate(assembleNcsEvaluationInput(dataset, goldenCase, contexts));
    for (const expected of goldenCase.expected.behaviorPoints) {
      const actual = output.behaviorEvaluations.find((item) => item.behaviorPointId === expected.behaviorPointId);
      assert.ok(actual, `${goldenCase.caseId} missing ${expected.behaviorPointId}`);
      total += 1;
      if (actual.level === expected.level) {
        exact += 1;
      } else {
        mismatches.push(`${goldenCase.caseId}/${expected.behaviorPointId}: expected=${expected.level}, actual=${actual.level}`);
      }
      for (const evidenceId of [...actual.supportingEvidenceIds, ...actual.contradictingEvidenceIds]) {
        const evidence = output.evidences.find((item) => item.evidenceId === evidenceId);
        assert.ok(evidence, `${goldenCase.caseId} missing evidence ${evidenceId}`);
        assert.equal(
          goldenCase.answer.transcript.slice(evidence.startChar, evidence.endChar),
          evidence.quote,
          `${goldenCase.caseId} evidence offsets`,
        );
      }
    }
  }
  assert.ok(
    exact / total >= 0.95,
    `baseline exact level rate ${(exact / total * 100).toFixed(2)}% is below 95%\n${mismatches.join("\n")}`,
  );
});

test("baseline ignores sensitive-only sentence for scoring", async () => {
  const dataset = await readNcsGoldenDataset(datasetPath);
  const evaluator = new DeterministicNcsBaselineEvaluator();
  const base = evaluateCase(dataset.cases, "OPS-001", dataset, evaluator);
  const mutation = evaluateCase(dataset.cases, "OPS-007", dataset, evaluator);
  assert.equal(base.behaviorEvaluations[0].level, mutation.behaviorEvaluations[0].level);
  assert.equal(mutation.evidences.some((evidence) => /여성 지원자/.test(evidence.quote)), false);
});

test("baseline keeps multi-behavior evaluations independent", async () => {
  const dataset = await readNcsGoldenDataset(datasetPath);
  const evaluator = new DeterministicNcsBaselineEvaluator();
  const output = evaluateCase(dataset.cases, "MULTI-002", dataset, evaluator);
  const solve = output.behaviorEvaluations.find((item) => item.behaviorPointId === "BP-MULTI-SOLVE");
  const share = output.behaviorEvaluations.find((item) => item.behaviorPointId === "BP-MULTI-SHARE");
  assert.equal(solve?.status, "DEMONSTRATED");
  assert.equal(share?.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(output.followUp.required, true);
});

function evaluateCase(
  cases: NcsGoldenCase[],
  caseId: string,
  dataset: Awaited<ReturnType<typeof readNcsGoldenDataset>>,
  evaluator: DeterministicNcsBaselineEvaluator,
) {
  const goldenCase = cases.find((item) => item.caseId === caseId);
  assert.ok(goldenCase, `missing golden case ${caseId}`);
  return evaluator.evaluate(assembleNcsEvaluationInput(dataset, goldenCase));
}
