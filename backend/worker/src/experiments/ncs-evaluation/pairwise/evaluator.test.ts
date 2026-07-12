import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  NCS_EVALUATION_CONTRACT_VERSION,
  NcsEvaluationInput,
  NcsEvaluationOutput,
  NcsGoldenContext,
} from "../shared/contract";
import { assembleNcsEvaluationInput, contextMapFor, readNcsGoldenDataset } from "../shared/dataset";
import { PairwiseAnchorEvaluator } from "./evaluator";

const datasetPath = resolve(
  process.cwd(),
  "..",
  "..",
  "docs",
  "04_implementation",
  "ncs-evaluation-m0",
  "golden-cases.json",
);

test("pairwise evaluator is deterministic and fixture metadata cannot affect decisions", async () => {
  const dataset = await readNcsGoldenDataset(datasetPath);
  const context = contextByDescription(dataset.contexts, "실행 계획");
  const base = makeInput(
    dataset,
    context,
    "실행 계획에서 풀스캔을 확인했습니다. 복합 인덱스를 적용했고 같은 부하에서 p95가 1.2초에서 220ms로 줄었습니다.",
  );
  const polluted = {
    ...base,
    caseId: "unrelated-renamed-case",
    answer: { ...base.answer, answerId: "renamed-answer" },
    question: { ...base.question, questionId: "renamed-question" },
    expected: { level: 1 },
    tags: ["force-low"],
    relations: [{ type: "SAME_LEVEL" }],
  } as NcsEvaluationInput & Record<string, unknown>;
  const evaluator = new PairwiseAnchorEvaluator();
  const first = evaluator.evaluate(base);
  const repeated = evaluator.evaluate(base);
  const changedMetadata = evaluator.evaluate(polluted);

  assert.deepEqual(repeated, first);
  assert.deepEqual(withoutCaseId(changedMetadata), withoutCaseId(first));
  assert.equal(changedMetadata.caseId, "unrelated-renamed-case");
  assert.equal(JSON.stringify(withoutCaseId(changedMetadata)).includes("unrelated-renamed-case"), false);
});

test("terse direct evidence outranks fluent harmful reasoning", async () => {
  const dataset = await readNcsGoldenDataset(datasetPath);
  const context = contextByDescription(dataset.contexts, "실행 계획");
  const evaluator = new PairwiseAnchorEvaluator();
  const terse = evaluator.evaluate(makeInput(
    dataset,
    context,
    "실행 계획에서 풀스캔을 확인했습니다. 복합 인덱스를 적용했고 같은 부하에서 p95가 1.2초에서 220ms로 줄었습니다.",
  ));
  const harmful = evaluator.evaluate(makeInput(
    dataset,
    context,
    "상세 측정은 시간을 낭비한다고 판단해 서버 사양을 바로 올렸습니다. 원인 분석이나 전후 측정은 하지 않았지만 좋아졌을 것이라고 설명했습니다.",
  ));

  assert.equal(terse.behaviorEvaluations[0].level, 4);
  assert.equal(harmful.behaviorEvaluations[0].level, 1);
  assert.ok((terse.behaviorEvaluations[0].level ?? 0) > (harmful.behaviorEvaluations[0].level ?? 0));
});

test("sensitive and nonverbal-only sentences do not affect level or evidence", async () => {
  const dataset = await readNcsGoldenDataset(datasetPath);
  const context = contextByDescription(dataset.contexts, "실행 계획");
  const evaluator = new PairwiseAnchorEvaluator();
  const transcript = "실행 계획에서 풀스캔을 확인했습니다. 복합 인덱스를 적용했고 같은 부하에서 p95가 1.2초에서 220ms로 줄었습니다.";
  const base = evaluator.evaluate(makeInput(dataset, context, transcript));
  const mutated = evaluator.evaluate(makeInput(
    dataset,
    context,
    `저는 한국대학교 출신입니다. ${transcript} 면접 중 시선을 유지하고 목소리 톤을 또렷하게 했습니다.`,
  ));

  assert.equal(mutated.behaviorEvaluations[0].level, base.behaviorEvaluations[0].level);
  assert.equal(mutated.evidences.some(({ quote }) => /대학교|시선|목소리 톤/.test(quote)), false);
  assert.equal(mutated.guardrail.sensitiveAttributeUsed, false);
  assert.equal(mutated.guardrail.nonverbalSignalUsed, false);
});

test("each behavior point is evaluated independently and order does not change decisions", async () => {
  const dataset = await readNcsGoldenDataset(datasetPath);
  const context = dataset.contexts.find(({ behaviorPoints }) => behaviorPoints.length === 2);
  assert.ok(context, "multi-behavior context is required");
  const evaluator = new PairwiseAnchorEvaluator();
  const input = makeInput(
    dataset,
    context,
    "로그에서 토큰 만료 설정 변경을 확인해 해당 설정을 롤백했고 오류율이 정상화됐습니다.",
  );
  const normal = evaluator.evaluate(input);
  const reversed = evaluator.evaluate({ ...input, behaviorPoints: [...input.behaviorPoints].reverse() });
  const normalMap = evaluationMap(normal);
  const reversedMap = evaluationMap(reversed);
  const solveId = context.behaviorPoints.find(({ description }) => description.includes("원인을 좁"))?.behaviorPointId;
  const shareId = context.behaviorPoints.find(({ description }) => description.includes("관계자에게 공유"))?.behaviorPointId;
  assert.ok(solveId && shareId);

  assert.equal(normalMap.get(solveId)?.level, 4);
  assert.equal(normalMap.get(shareId)?.level, null);
  assert.deepEqual(reversedMap, normalMap);
  assert.equal(normal.followUp.required, true);
});

test("all golden outputs preserve contract invariants and exact quote offsets", async () => {
  const dataset = await readNcsGoldenDataset(datasetPath);
  const contexts = contextMapFor(dataset);
  const evaluator = new PairwiseAnchorEvaluator();
  let exactLevels = 0;
  let evaluationCount = 0;
  let expectedQuotes = 0;
  let matchedQuotes = 0;
  const mismatches: string[] = [];

  for (const goldenCase of dataset.cases) {
    const output = evaluator.evaluate(assembleNcsEvaluationInput(dataset, goldenCase, contexts));
    assert.equal(output.behaviorEvaluations.length, contexts.get(goldenCase.contextId)?.behaviorPoints.length);
    assert.equal(new Set(output.behaviorEvaluations.map(({ behaviorPointId }) => behaviorPointId)).size, output.behaviorEvaluations.length);
    assert.equal(new Set(output.evidences.map(({ evidenceId }) => evidenceId)).size, output.evidences.length);
    for (const evidence of output.evidences) {
      assert.equal(goldenCase.answer.transcript.slice(evidence.startChar, evidence.endChar), evidence.quote);
      assert.equal(/여성 지원자|대학교\s*출신|표정|시선|억양|말속도/.test(evidence.quote), false);
    }
    for (const expected of goldenCase.expected.behaviorPoints) {
      const actual = output.behaviorEvaluations.find(({ behaviorPointId }) => behaviorPointId === expected.behaviorPointId);
      assert.ok(actual, `${goldenCase.caseId} missing ${expected.behaviorPointId}`);
      evaluationCount += 1;
      if (actual.level === expected.level) exactLevels += 1;
      else mismatches.push(`${goldenCase.caseId}/${expected.behaviorPointId}: expected=${expected.level}, actual=${actual.level}`);
      const cited = [...actual.supportingEvidenceIds, ...actual.contradictingEvidenceIds]
        .map((evidenceId) => output.evidences.find((evidence) => evidence.evidenceId === evidenceId)?.quote ?? "");
      for (const mustQuote of expected.mustQuote) {
        expectedQuotes += 1;
        if (cited.some((quote) => quote.includes(mustQuote))) matchedQuotes += 1;
      }
    }
  }

  assert.ok(
    exactLevels / evaluationCount >= 0.9,
    `exact level rate ${(exactLevels / evaluationCount * 100).toFixed(2)}%\n${mismatches.join("\n")}`,
  );
  assert.ok(matchedQuotes / expectedQuotes >= 0.9, `quote coverage ${(matchedQuotes / expectedQuotes * 100).toFixed(2)}%`);
});

function contextByDescription(contexts: NcsGoldenContext[], phrase: string): NcsGoldenContext {
  const context = contexts.find(({ behaviorPoints }) => behaviorPoints.some(({ description }) => description.includes(phrase)));
  assert.ok(context, `context containing ${phrase} is required`);
  return context;
}

function makeInput(
  dataset: Awaited<ReturnType<typeof readNcsGoldenDataset>>,
  context: NcsGoldenContext,
  transcript: string,
): NcsEvaluationInput {
  return {
    contractVersion: NCS_EVALUATION_CONTRACT_VERSION,
    caseId: "synthetic-input",
    locale: context.locale,
    question: context.question,
    answer: { answerId: "synthetic-answer", transcript },
    ncsContext: context.ncsContext,
    behaviorPoints: context.behaviorPoints,
    interviewContext: { attemptNumber: 1, maxFollowUps: 1, followUpsUsed: 0 },
    evaluationPolicy: dataset.defaultEvaluationPolicy,
  };
}

function withoutCaseId(output: NcsEvaluationOutput): Omit<NcsEvaluationOutput, "caseId"> {
  const { caseId: _caseId, ...rest } = output;
  return rest;
}

function evaluationMap(output: NcsEvaluationOutput): Map<string, Omit<NcsEvaluationOutput["behaviorEvaluations"][number], "behaviorPointId">> {
  return new Map(output.behaviorEvaluations.map(({ behaviorPointId, ...evaluation }) => [behaviorPointId, evaluation]));
}
