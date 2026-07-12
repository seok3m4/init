import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_DIR = path.join(ROOT_DIR, "docs", "04_implementation", "ncs-evaluation-m0");
const CONTRACT_VERSION = "ncs-evaluation-m0.v1";
const REQUIRED_RUNS = 5;
const STATUS_LEVEL = Object.freeze({
  INSUFFICIENT_EVIDENCE: null,
  NOT_DEMONSTRATED: 1,
  LIMITED: 2,
  DEVELOPING: 3,
  DEMONSTRATED: 4,
  STRONGLY_DEMONSTRATED: 5,
});
const SCORE_MAP = Object.freeze({ 1: 25, 2: 50, 3: 70, 4: 85, 5: 100 });
const REQUIRED_TAGS = [
  "no-answer",
  "irrelevant",
  "fluent-but-wrong",
  "terse-but-strong",
  "sensitive-attribute-mutation",
  "school-mutation",
  "honorific-order-mutation",
  "core-evidence-removed",
  "contradiction",
  "multi-behavior",
  "follow-up-exhausted",
];
const CLAIM_TYPES = new Set([
  "SITUATION",
  "TASK",
  "ACTION",
  "RATIONALE",
  "RESULT",
  "REFLECTION",
  "KNOWLEDGE",
  "CONSTRAINT",
  "TRADEOFF",
  "CONTRADICTION",
]);
const HIRING_DECISION_PATTERN = /합격|불합격|채용\s*(가능성|적합|부적합)|pass|fail|hire|reject/i;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Cannot parse JSON ${filePath}: ${error.message}`);
  }
}

function parseArgs(argv) {
  const options = {
    dataset: path.join(DEFAULT_DIR, "golden-cases.json"),
    inputSchema: path.join(DEFAULT_DIR, "input.schema.json"),
    outputSchema: path.join(DEFAULT_DIR, "output.schema.json"),
    results: null,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--self-test") {
      options.selfTest = true;
      continue;
    }
    const value = argv[index + 1];
    if (argument === "--dataset" || argument === "--input-schema" || argument === "--output-schema" || argument === "--results") {
      assert(value && !value.startsWith("--"), `${argument} requires a path`);
      const resolved = path.resolve(process.cwd(), value);
      if (argument === "--dataset") options.dataset = resolved;
      if (argument === "--input-schema") options.inputSchema = resolved;
      if (argument === "--output-schema") options.outputSchema = resolved;
      if (argument === "--results") options.results = resolved;
      index += 1;
      continue;
    }
    fail(`Unknown argument: ${argument}`);
  }
  assert(!(options.results && options.selfTest), "--results and --self-test cannot be used together");
  return options;
}

function assertExactKeys(value, requiredKeys, allowedKeys, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  for (const key of requiredKeys) {
    assert(Object.hasOwn(value, key), `${label} missing ${key}`);
  }
  for (const key of Object.keys(value)) {
    assert(allowedKeys.includes(key), `${label} contains unsupported property ${key}`);
  }
}

function assertSchemaSkeleton(schema, requiredKeys, label) {
  assert(schema.$schema === "https://json-schema.org/draft/2020-12/schema", `${label} must use draft 2020-12`);
  assert(schema.type === "object", `${label} root type must be object`);
  assert(schema.additionalProperties === false, `${label} must reject additional properties`);
  assert(Array.isArray(schema.required), `${label}.required must be an array`);
  for (const key of requiredKeys) {
    assert(schema.required.includes(key), `${label} missing required key ${key}`);
    assert(Object.hasOwn(schema.properties ?? {}, key), `${label} missing property ${key}`);
  }
}

function assembleInput(dataset, context, goldenCase) {
  return {
    contractVersion: dataset.contractVersion,
    caseId: goldenCase.caseId,
    locale: context.locale,
    question: context.question,
    answer: goldenCase.answer,
    ncsContext: context.ncsContext,
    behaviorPoints: context.behaviorPoints,
    interviewContext: goldenCase.interviewContext,
    evaluationPolicy: dataset.defaultEvaluationPolicy,
  };
}

function validateInput(input, label) {
  assertExactKeys(
    input,
    ["contractVersion", "caseId", "locale", "question", "answer", "ncsContext", "behaviorPoints", "interviewContext", "evaluationPolicy"],
    ["contractVersion", "caseId", "locale", "question", "answer", "ncsContext", "behaviorPoints", "interviewContext", "evaluationPolicy"],
    label,
  );
  assert(input.contractVersion === CONTRACT_VERSION, `${label}.contractVersion mismatch`);
  assert(input.locale === "ko-KR", `${label}.locale must be ko-KR`);
  assert(typeof input.caseId === "string" && input.caseId.length > 0, `${label}.caseId is required`);
  assert(["EXPERIENCE", "SITUATION", "FOLLOW_UP"].includes(input.question.questionType), `${label}.questionType is invalid`);
  assert(typeof input.question.content === "string" && input.question.content.length > 0, `${label}.question.content is required`);
  assert(typeof input.answer.transcript === "string", `${label}.answer.transcript must be a string`);
  assert(["OFFICIAL_NCS", "SYNTHETIC_NCS_LIKE"].includes(input.ncsContext.sourceKind), `${label}.sourceKind is invalid`);
  assert(input.ncsContext.sourceKind === "SYNTHETIC_NCS_LIKE", `${label} M0 fixtures must use synthetic NCS-like context`);
  assert(Array.isArray(input.ncsContext.unit.elements) && input.ncsContext.unit.elements.length > 0, `${label}.unit.elements is required`);
  const elementCodes = new Set(input.ncsContext.unit.elements.map((element) => element.elementCode));
  assert(Array.isArray(input.behaviorPoints) && input.behaviorPoints.length > 0, `${label}.behaviorPoints is required`);
  const behaviorIds = new Set();
  for (const behaviorPoint of input.behaviorPoints) {
    assert(!behaviorIds.has(behaviorPoint.behaviorPointId), `${label} duplicate behaviorPointId ${behaviorPoint.behaviorPointId}`);
    behaviorIds.add(behaviorPoint.behaviorPointId);
    assert(behaviorPoint.observability === "INTERVIEW", `${label}.${behaviorPoint.behaviorPointId} must be interview observable`);
    assert(Array.isArray(behaviorPoint.requiredEvidence) && behaviorPoint.requiredEvidence.length > 0, `${label}.${behaviorPoint.behaviorPointId} requires evidence types`);
    for (const sourceCode of behaviorPoint.sourceElementCodes) {
      assert(elementCodes.has(sourceCode), `${label}.${behaviorPoint.behaviorPointId} references unknown element ${sourceCode}`);
    }
  }
  const interview = input.interviewContext;
  assert(Number.isInteger(interview.attemptNumber) && interview.attemptNumber >= 1, `${label}.attemptNumber is invalid`);
  assert(Number.isInteger(interview.maxFollowUps) && interview.maxFollowUps >= 0 && interview.maxFollowUps <= 2, `${label}.maxFollowUps is invalid`);
  assert(Number.isInteger(interview.followUpsUsed) && interview.followUpsUsed >= 0, `${label}.followUpsUsed is invalid`);
  assert(interview.followUpsUsed <= interview.maxFollowUps, `${label}.followUpsUsed exceeds maxFollowUps`);
  assert(JSON.stringify(input.evaluationPolicy.scoreMap) === JSON.stringify(SCORE_MAP), `${label}.scoreMap mismatch`);
  assert(input.evaluationPolicy.insufficientEvidenceScore === null, `${label}.insufficientEvidenceScore must be null`);
  assert(input.evaluationPolicy.allowSensitiveAttributes === false, `${label} must reject sensitive attributes`);
  assert(input.evaluationPolicy.allowNonverbalScore === false, `${label} must reject nonverbal score input`);
}

function expectedByBehavior(goldenCase) {
  return new Map(goldenCase.expected.behaviorPoints.map((item) => [item.behaviorPointId, item]));
}

function validateExpected(dataset, context, goldenCase) {
  const label = `case ${goldenCase.caseId}`;
  assert(Array.isArray(goldenCase.tags) && goldenCase.tags.length > 0, `${label}.tags is required`);
  assert(Array.isArray(goldenCase.expected?.behaviorPoints), `${label}.expected.behaviorPoints is required`);
  assert(typeof goldenCase.expected.followUpRequired === "boolean", `${label}.expected.followUpRequired is required`);
  const expectedMap = expectedByBehavior(goldenCase);
  const inputBehaviorIds = context.behaviorPoints.map((item) => item.behaviorPointId).sort();
  const expectedBehaviorIds = [...expectedMap.keys()].sort();
  assert(JSON.stringify(inputBehaviorIds) === JSON.stringify(expectedBehaviorIds), `${label} expected behavior points do not match input`);

  for (const expected of expectedMap.values()) {
    assert(Object.hasOwn(STATUS_LEVEL, expected.status), `${label}.${expected.behaviorPointId} invalid status ${expected.status}`);
    const expectedLevel = STATUS_LEVEL[expected.status];
    assert(expected.level === expectedLevel, `${label}.${expected.behaviorPointId} level does not match status`);
    const expectedScore = expectedLevel === null ? null : dataset.scoreMap[String(expectedLevel)];
    assert(expected.score === expectedScore, `${label}.${expected.behaviorPointId} score does not match level`);
    assert(Array.isArray(expected.mustQuote), `${label}.${expected.behaviorPointId}.mustQuote must be an array`);
    assert(Array.isArray(expected.missingEvidence), `${label}.${expected.behaviorPointId}.missingEvidence must be an array`);
    if (expected.status === "INSUFFICIENT_EVIDENCE") {
      assert(expected.mustQuote.length === 0, `${label}.${expected.behaviorPointId} insufficient case cannot require quotes`);
    } else {
      assert(expected.mustQuote.length > 0, `${label}.${expected.behaviorPointId} scored case requires quotes`);
      for (const quote of expected.mustQuote) {
        assert(goldenCase.answer.transcript.includes(quote), `${label}.${expected.behaviorPointId} expected quote not found: ${quote}`);
      }
    }
  }

  const hasInsufficient = [...expectedMap.values()].some((item) => item.status === "INSUFFICIENT_EVIDENCE");
  const followUpBudgetAvailable = goldenCase.interviewContext.followUpsUsed < goldenCase.interviewContext.maxFollowUps;
  assert(
    goldenCase.expected.followUpRequired === (hasInsufficient && followUpBudgetAvailable),
    `${label}.followUpRequired does not match insufficient evidence and follow-up budget`,
  );
  if (goldenCase.tags.includes("no-answer")) {
    assert([...expectedMap.values()].every((item) => item.status === "INSUFFICIENT_EVIDENCE"), `${label} no-answer must be insufficient`);
  }
}

function expectedLevel(caseMap, caseId, behaviorPointId) {
  const goldenCase = caseMap.get(caseId);
  assert(goldenCase, `relation references unknown case ${caseId}`);
  const expected = expectedByBehavior(goldenCase).get(behaviorPointId);
  assert(expected, `case ${caseId} missing behavior point ${behaviorPointId}`);
  return expected.level;
}

function validateRelations(dataset, caseMap) {
  const relationIds = new Set();
  for (const relation of dataset.relations) {
    assert(!relationIds.has(relation.relationId), `duplicate relationId ${relation.relationId}`);
    relationIds.add(relation.relationId);
    assert(["SAME_LEVEL", "HIGHER_THAN"].includes(relation.type), `${relation.relationId} invalid relation type`);
    const left = expectedLevel(caseMap, relation.leftCaseId, relation.behaviorPointId);
    const right = expectedLevel(caseMap, relation.rightCaseId, relation.behaviorPointId);
    assert(left !== null && right !== null, `${relation.relationId} cannot compare null levels`);
    if (relation.type === "SAME_LEVEL") {
      assert(left === right, `${relation.relationId} expected levels are not equal`);
    } else {
      assert(left > right, `${relation.relationId} expected left level is not higher`);
    }
  }
}

function validateDataset(dataset, schemas) {
  assertSchemaSkeleton(
    schemas.input,
    ["contractVersion", "caseId", "locale", "question", "answer", "ncsContext", "behaviorPoints", "interviewContext", "evaluationPolicy"],
    "input schema",
  );
  assertSchemaSkeleton(
    schemas.output,
    ["contractVersion", "caseId", "evidences", "behaviorEvaluations", "coverage", "followUp", "guardrail", "metadata"],
    "output schema",
  );
  assert(dataset.datasetVersion === "ncs-evaluation-golden.v1", "datasetVersion mismatch");
  assert(dataset.contractVersion === CONTRACT_VERSION, "contractVersion mismatch");
  assert(JSON.stringify(dataset.scoreMap) === JSON.stringify(SCORE_MAP), "dataset scoreMap mismatch");
  assert(JSON.stringify(dataset.defaultEvaluationPolicy.scoreMap) === JSON.stringify(SCORE_MAP), "default policy scoreMap mismatch");
  assert(Array.isArray(dataset.contexts) && dataset.contexts.length >= 6, "at least 6 contexts are required");
  assert(Array.isArray(dataset.cases) && dataset.cases.length >= 30 && dataset.cases.length <= 50, "golden case count must be between 30 and 50");
  assert(Array.isArray(dataset.relations) && dataset.relations.length >= 6, "at least 6 mutation relations are required");

  const contextMap = new Map();
  for (const context of dataset.contexts) {
    assert(typeof context.contextId === "string" && context.contextId.length > 0, "contextId is required");
    assert(!contextMap.has(context.contextId), `duplicate contextId ${context.contextId}`);
    contextMap.set(context.contextId, context);
  }

  const caseMap = new Map();
  const seenTags = new Set();
  for (const goldenCase of dataset.cases) {
    assert(typeof goldenCase.caseId === "string" && goldenCase.caseId.length > 0, "caseId is required");
    assert(!caseMap.has(goldenCase.caseId), `duplicate caseId ${goldenCase.caseId}`);
    const context = contextMap.get(goldenCase.contextId);
    assert(context, `case ${goldenCase.caseId} references unknown context ${goldenCase.contextId}`);
    const input = assembleInput(dataset, context, goldenCase);
    validateInput(input, `case ${goldenCase.caseId} input`);
    validateExpected(dataset, context, goldenCase);
    caseMap.set(goldenCase.caseId, goldenCase);
    for (const tag of goldenCase.tags) seenTags.add(tag);
  }

  for (const tag of REQUIRED_TAGS) {
    assert(seenTags.has(tag), `golden dataset missing required tag ${tag}`);
  }
  validateRelations(dataset, caseMap);
  return { contextMap, caseMap };
}

function validateEvidence(evidence, transcript, behaviorIds, label) {
  assertExactKeys(
    evidence,
    ["evidenceId", "source", "quote", "startChar", "endChar", "claimType", "behaviorPointIds"],
    ["evidenceId", "source", "quote", "startChar", "endChar", "claimType", "behaviorPointIds"],
    label,
  );
  assert(evidence.source === "ANSWER_TRANSCRIPT", `${label}.source must be ANSWER_TRANSCRIPT`);
  assert(typeof evidence.quote === "string" && evidence.quote.length > 0, `${label}.quote is required`);
  assert(Number.isInteger(evidence.startChar) && Number.isInteger(evidence.endChar), `${label} offsets must be integers`);
  assert(evidence.startChar >= 0 && evidence.endChar > evidence.startChar, `${label} offsets are invalid`);
  assert(transcript.slice(evidence.startChar, evidence.endChar) === evidence.quote, `${label} quote does not match transcript offsets`);
  assert(CLAIM_TYPES.has(evidence.claimType), `${label}.claimType is invalid`);
  assert(Array.isArray(evidence.behaviorPointIds) && evidence.behaviorPointIds.length > 0, `${label}.behaviorPointIds is required`);
  for (const behaviorPointId of evidence.behaviorPointIds) {
    assert(behaviorIds.has(behaviorPointId), `${label} references unknown behavior point ${behaviorPointId}`);
  }
}

function validateOutput(output, input, label) {
  assertExactKeys(
    output,
    ["contractVersion", "caseId", "evidences", "behaviorEvaluations", "coverage", "followUp", "guardrail", "metadata"],
    ["contractVersion", "caseId", "evidences", "behaviorEvaluations", "coverage", "followUp", "guardrail", "metadata"],
    label,
  );
  assert(output.contractVersion === CONTRACT_VERSION, `${label}.contractVersion mismatch`);
  assert(output.caseId === input.caseId, `${label}.caseId mismatch`);
  assert(Array.isArray(output.evidences), `${label}.evidences must be an array`);
  assert(Array.isArray(output.behaviorEvaluations), `${label}.behaviorEvaluations must be an array`);
  const behaviorIds = new Set(input.behaviorPoints.map((item) => item.behaviorPointId));
  const evidenceMap = new Map();
  for (const evidence of output.evidences) {
    assert(!evidenceMap.has(evidence.evidenceId), `${label} duplicate evidenceId ${evidence.evidenceId}`);
    validateEvidence(evidence, input.answer.transcript, behaviorIds, `${label}.evidence.${evidence.evidenceId}`);
    evidenceMap.set(evidence.evidenceId, evidence);
  }

  const evaluationMap = new Map();
  for (const evaluation of output.behaviorEvaluations) {
    const behaviorId = evaluation.behaviorPointId;
    assertExactKeys(
      evaluation,
      [
        "behaviorPointId",
        "status",
        "level",
        "score",
        "rationale",
        "supportingEvidenceIds",
        "contradictingEvidenceIds",
        "missingEvidence",
        "confidence",
      ],
      [
        "behaviorPointId",
        "status",
        "level",
        "score",
        "rationale",
        "supportingEvidenceIds",
        "contradictingEvidenceIds",
        "missingEvidence",
        "confidence",
      ],
      `${label}.${behaviorId ?? "unknown-behavior"}`,
    );
    assert(behaviorIds.has(behaviorId), `${label} unknown behavior evaluation ${behaviorId}`);
    assert(!evaluationMap.has(behaviorId), `${label} duplicate behavior evaluation ${behaviorId}`);
    assert(Object.hasOwn(STATUS_LEVEL, evaluation.status), `${label}.${behaviorId} invalid status`);
    const mappedLevel = STATUS_LEVEL[evaluation.status];
    assert(evaluation.level === mappedLevel, `${label}.${behaviorId} level does not match status`);
    const mappedScore = mappedLevel === null ? null : SCORE_MAP[mappedLevel];
    assert(evaluation.score === mappedScore, `${label}.${behaviorId} score does not match level`);
    assert(typeof evaluation.rationale === "string" && evaluation.rationale.length > 0, `${label}.${behaviorId} rationale is required`);
    assert(!HIRING_DECISION_PATTERN.test(evaluation.rationale), `${label}.${behaviorId} contains hiring decision language`);
    assert(Array.isArray(evaluation.supportingEvidenceIds), `${label}.${behaviorId} supportingEvidenceIds must be an array`);
    assert(Array.isArray(evaluation.contradictingEvidenceIds), `${label}.${behaviorId} contradictingEvidenceIds must be an array`);
    assert(Array.isArray(evaluation.missingEvidence), `${label}.${behaviorId} missingEvidence must be an array`);
    for (const evidenceId of [...evaluation.supportingEvidenceIds, ...evaluation.contradictingEvidenceIds]) {
      assert(evidenceMap.has(evidenceId), `${label}.${behaviorId} references unknown evidence ${evidenceId}`);
      assert(
        evidenceMap.get(evidenceId).behaviorPointIds.includes(behaviorId),
        `${label}.${behaviorId} references evidence ${evidenceId} without a matching behaviorPointId`,
      );
    }
    if (mappedLevel === null) {
      assert(evaluation.supportingEvidenceIds.length === 0, `${label}.${behaviorId} insufficient evaluation cannot have supporting evidence`);
    } else {
      assert(evaluation.supportingEvidenceIds.length > 0 || evaluation.contradictingEvidenceIds.length > 0, `${label}.${behaviorId} scored evaluation requires evidence`);
    }
    evaluationMap.set(behaviorId, evaluation);
  }
  assert(evaluationMap.size === behaviorIds.size, `${label} behavior evaluation count mismatch`);
  for (const behaviorId of behaviorIds) {
    assert(evaluationMap.has(behaviorId), `${label} missing behavior evaluation ${behaviorId}`);
  }

  const evaluatedCount = [...evaluationMap.values()].filter((item) => item.status !== "INSUFFICIENT_EVIDENCE").length;
  const ratio = evaluatedCount / behaviorIds.size;
  const coverageStatus = ratio === 0 ? "INSUFFICIENT" : ratio >= 0.8 ? "SUFFICIENT" : "LOW";
  assertExactKeys(
    output.coverage,
    ["assessableBehaviorPointCount", "evaluatedBehaviorPointCount", "ratio", "status"],
    ["assessableBehaviorPointCount", "evaluatedBehaviorPointCount", "ratio", "status"],
    `${label}.coverage`,
  );
  assert(output.coverage.assessableBehaviorPointCount === behaviorIds.size, `${label}.coverage assessable count mismatch`);
  assert(output.coverage.evaluatedBehaviorPointCount === evaluatedCount, `${label}.coverage evaluated count mismatch`);
  assert(Math.abs(output.coverage.ratio - ratio) < 0.000001, `${label}.coverage ratio mismatch`);
  assert(output.coverage.status === coverageStatus, `${label}.coverage status mismatch`);
  assertExactKeys(
    output.followUp,
    ["required", "reason", "missingEvidence", "suggestedQuestion"],
    ["required", "reason", "missingEvidence", "suggestedQuestion"],
    `${label}.followUp`,
  );
  assert(typeof output.followUp.required === "boolean", `${label}.followUp.required is required`);
  assert(Array.isArray(output.followUp.missingEvidence), `${label}.followUp.missingEvidence must be an array`);
  assert(
    output.followUp.reason === null || typeof output.followUp.reason === "string",
    `${label}.followUp.reason must be a string or null`,
  );
  assert(
    output.followUp.suggestedQuestion === null || typeof output.followUp.suggestedQuestion === "string",
    `${label}.followUp.suggestedQuestion must be a string or null`,
  );
  if (output.followUp.required) {
    assert(output.followUp.reason?.length > 0, `${label}.followUp.reason is required when follow-up is required`);
    assert(output.followUp.suggestedQuestion?.length > 0, `${label}.followUp.suggestedQuestion is required when follow-up is required`);
    assert(!HIRING_DECISION_PATTERN.test(output.followUp.suggestedQuestion), `${label}.followUp contains hiring decision language`);
  }
  assertExactKeys(
    output.guardrail,
    ["unsupportedFactDetected", "sensitiveAttributeUsed", "nonverbalSignalUsed", "hiringDecisionLanguageDetected"],
    ["unsupportedFactDetected", "sensitiveAttributeUsed", "nonverbalSignalUsed", "hiringDecisionLanguageDetected"],
    `${label}.guardrail`,
  );
  assert(output.guardrail.unsupportedFactDetected === false, `${label} reports unsupported facts`);
  assert(output.guardrail.sensitiveAttributeUsed === false, `${label} used sensitive attributes`);
  assert(output.guardrail.nonverbalSignalUsed === false, `${label} used nonverbal signals`);
  assert(output.guardrail.hiringDecisionLanguageDetected === false, `${label} contains hiring decision language`);
  assertExactKeys(
    output.metadata,
    ["strategyId", "promptVersion", "model"],
    ["strategyId", "promptVersion", "model"],
    `${label}.metadata`,
  );
  assert(typeof output.metadata.strategyId === "string" && output.metadata.strategyId.length > 0, `${label}.metadata.strategyId is required`);
  assert(typeof output.metadata.promptVersion === "string" && output.metadata.promptVersion.length > 0, `${label}.metadata.promptVersion is required`);
  assert(typeof output.metadata.model === "string" && output.metadata.model.length > 0, `${label}.metadata.model is required`);
  return { evidenceMap, evaluationMap };
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function validateResultRelations(dataset, runIndex) {
  for (const relation of dataset.relations) {
    for (let runNumber = 1; runNumber <= REQUIRED_RUNS; runNumber += 1) {
      const left = runIndex.get(`${relation.leftCaseId}:${runNumber}`)?.evaluationMap.get(relation.behaviorPointId)?.level;
      const right = runIndex.get(`${relation.rightCaseId}:${runNumber}`)?.evaluationMap.get(relation.behaviorPointId)?.level;
      assert(left !== null && left !== undefined && right !== null && right !== undefined, `${relation.relationId} run ${runNumber} has null level`);
      if (relation.type === "SAME_LEVEL") {
        assert(left === right, `${relation.relationId} run ${runNumber} violates SAME_LEVEL: ${left} != ${right}`);
      } else {
        assert(left > right, `${relation.relationId} run ${runNumber} violates HIGHER_THAN: ${left} <= ${right}`);
      }
    }
  }
}

function validateResults(results, dataset, contextMap, caseMap) {
  assert(results.contractVersion === CONTRACT_VERSION, "results.contractVersion mismatch");
  assert(typeof results.strategyId === "string" && results.strategyId.length > 0, "results.strategyId is required");
  assert(Array.isArray(results.runs), "results.runs must be an array");
  assert(results.runs.length === dataset.cases.length * REQUIRED_RUNS, `results must contain exactly ${REQUIRED_RUNS} runs per case`);

  const runIndex = new Map();
  let evaluationCount = 0;
  let exactStatusCount = 0;
  let exactLevelCount = 0;
  let expectedQuoteCount = 0;
  let matchedQuoteCount = 0;
  let followUpMatchCount = 0;
  const latencies = [];
  const costs = [];

  for (const run of results.runs) {
    const goldenCase = caseMap.get(run.caseId);
    assert(goldenCase, `results contains unknown case ${run.caseId}`);
    assert(Number.isInteger(run.runNumber) && run.runNumber >= 1 && run.runNumber <= REQUIRED_RUNS, `${run.caseId} invalid runNumber`);
    const key = `${run.caseId}:${run.runNumber}`;
    assert(!runIndex.has(key), `duplicate result run ${key}`);
    assert(typeof run.latencyMs === "number" && run.latencyMs >= 0, `${key}.latencyMs is invalid`);
    assert(typeof run.estimatedCostUsd === "number" && run.estimatedCostUsd >= 0, `${key}.estimatedCostUsd is invalid`);
    const context = contextMap.get(goldenCase.contextId);
    const input = assembleInput(dataset, context, goldenCase);
    const validated = validateOutput(run.output, input, `result ${key}`);
    assert(run.output.metadata.strategyId === results.strategyId, `${key} strategyId mismatch`);
    const expectedMap = expectedByBehavior(goldenCase);
    for (const [behaviorPointId, expected] of expectedMap) {
      const actual = validated.evaluationMap.get(behaviorPointId);
      evaluationCount += 1;
      if (actual.status === expected.status) exactStatusCount += 1;
      if (actual.level === expected.level) exactLevelCount += 1;
      if (goldenCase.tags.includes("no-answer")) {
        assert(actual.status === "INSUFFICIENT_EVIDENCE", `${key}.${behaviorPointId} no-answer hard gate failed`);
      }
      const evidenceQuotes = new Set(
        [...actual.supportingEvidenceIds, ...actual.contradictingEvidenceIds]
          .map((evidenceId) => validated.evidenceMap.get(evidenceId)?.quote)
          .filter(Boolean),
      );
      for (const expectedQuote of expected.mustQuote) {
        expectedQuoteCount += 1;
        if ([...evidenceQuotes].some((quote) => quote.includes(expectedQuote))) {
          matchedQuoteCount += 1;
        }
      }
    }
    if (run.output.followUp.required === goldenCase.expected.followUpRequired) followUpMatchCount += 1;
    latencies.push(run.latencyMs);
    costs.push(run.estimatedCostUsd);
    runIndex.set(key, validated);
  }

  for (const goldenCase of dataset.cases) {
    for (let runNumber = 1; runNumber <= REQUIRED_RUNS; runNumber += 1) {
      assert(runIndex.has(`${goldenCase.caseId}:${runNumber}`), `missing result ${goldenCase.caseId}:${runNumber}`);
    }
  }
  validateResultRelations(dataset, runIndex);

  let repeatableEvaluationCount = 0;
  let repeatabilityDenominator = 0;
  for (const goldenCase of dataset.cases) {
    const context = contextMap.get(goldenCase.contextId);
    for (const behaviorPoint of context.behaviorPoints) {
      repeatabilityDenominator += 1;
      const signatures = new Set();
      for (let runNumber = 1; runNumber <= REQUIRED_RUNS; runNumber += 1) {
        const evaluation = runIndex.get(`${goldenCase.caseId}:${runNumber}`).evaluationMap.get(behaviorPoint.behaviorPointId);
        signatures.add(`${evaluation.status}:${evaluation.level}`);
      }
      if (signatures.size === 1) repeatableEvaluationCount += 1;
    }
  }

  const metrics = {
    strategyId: results.strategyId,
    caseCount: dataset.cases.length,
    runsPerCase: REQUIRED_RUNS,
    exactStatusRate: exactStatusCount / evaluationCount,
    exactLevelRate: exactLevelCount / evaluationCount,
    expectedQuoteCoverage: expectedQuoteCount === 0 ? 1 : matchedQuoteCount / expectedQuoteCount,
    followUpDecisionRate: followUpMatchCount / results.runs.length,
    repeatabilityRate: repeatableEvaluationCount / repeatabilityDenominator,
    p95LatencyMs: percentile(latencies, 95),
    averageEstimatedCostUsd: costs.reduce((sum, value) => sum + value, 0) / costs.length,
  };
  return metrics;
}

function formatRate(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function buildSelfTestResults(dataset, contextMap) {
  const runs = [];
  for (const goldenCase of dataset.cases) {
    const context = contextMap.get(goldenCase.contextId);
    for (let runNumber = 1; runNumber <= REQUIRED_RUNS; runNumber += 1) {
      const evidences = [];
      const behaviorEvaluations = [];
      for (const expected of goldenCase.expected.behaviorPoints) {
        const supportingEvidenceIds = [];
        expected.mustQuote.forEach((quote, quoteIndex) => {
          const startChar = goldenCase.answer.transcript.indexOf(quote);
          const evidenceId = `${goldenCase.caseId}-${expected.behaviorPointId}-${quoteIndex + 1}`;
          evidences.push({
            evidenceId,
            source: "ANSWER_TRANSCRIPT",
            quote,
            startChar,
            endChar: startChar + quote.length,
            claimType: quoteIndex === 0 ? "ACTION" : "RESULT",
            behaviorPointIds: [expected.behaviorPointId],
          });
          supportingEvidenceIds.push(evidenceId);
        });
        behaviorEvaluations.push({
          behaviorPointId: expected.behaviorPointId,
          status: expected.status,
          level: expected.level,
          score: expected.score,
          rationale: "M0 self-test result based only on transcript evidence.",
          supportingEvidenceIds,
          contradictingEvidenceIds: [],
          missingEvidence: expected.missingEvidence,
          confidence: expected.level === null ? "LOW" : expected.level >= 4 ? "HIGH" : "MEDIUM",
        });
      }
      const evaluatedCount = behaviorEvaluations.filter((item) => item.status !== "INSUFFICIENT_EVIDENCE").length;
      const ratio = evaluatedCount / context.behaviorPoints.length;
      runs.push({
        caseId: goldenCase.caseId,
        runNumber,
        latencyMs: 1,
        estimatedCostUsd: 0,
        output: {
          contractVersion: CONTRACT_VERSION,
          caseId: goldenCase.caseId,
          evidences,
          behaviorEvaluations,
          coverage: {
            assessableBehaviorPointCount: context.behaviorPoints.length,
            evaluatedBehaviorPointCount: evaluatedCount,
            ratio,
            status: ratio === 0 ? "INSUFFICIENT" : ratio >= 0.8 ? "SUFFICIENT" : "LOW",
          },
          followUp: {
            required: goldenCase.expected.followUpRequired,
            reason: goldenCase.expected.followUpRequired ? "Required evidence is missing." : null,
            missingEvidence: [...new Set(behaviorEvaluations.flatMap((item) => item.missingEvidence))],
            suggestedQuestion: goldenCase.expected.followUpRequired ? "Please provide the missing evidence." : null,
          },
          guardrail: {
            unsupportedFactDetected: false,
            sensitiveAttributeUsed: false,
            nonverbalSignalUsed: false,
            hiringDecisionLanguageDetected: false,
          },
          metadata: {
            strategyId: "m0-self-test",
            promptVersion: "none",
            model: "deterministic-fixture",
          },
        },
      });
    }
  }
  return {
    contractVersion: CONTRACT_VERSION,
    strategyId: "m0-self-test",
    runs,
  };
}

function printMetrics(metrics) {
  console.log(`[metric] exact status: ${formatRate(metrics.exactStatusRate)}`);
  console.log(`[metric] exact level: ${formatRate(metrics.exactLevelRate)}`);
  console.log(`[metric] expected quote coverage: ${formatRate(metrics.expectedQuoteCoverage)}`);
  console.log(`[metric] follow-up decision: ${formatRate(metrics.followUpDecisionRate)}`);
  console.log(`[metric] repeatability: ${formatRate(metrics.repeatabilityRate)}`);
  console.log(`[metric] p95 latency: ${metrics.p95LatencyMs.toFixed(2)}ms`);
  console.log(`[metric] average estimated cost: $${metrics.averageEstimatedCostUsd.toFixed(6)}`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputSchema = readJson(options.inputSchema);
  const outputSchema = readJson(options.outputSchema);
  const dataset = readJson(options.dataset);
  const { contextMap, caseMap } = validateDataset(dataset, { input: inputSchema, output: outputSchema });
  console.log(`[ok] M0 schemas parsed: ${path.relative(ROOT_DIR, options.inputSchema)}, ${path.relative(ROOT_DIR, options.outputSchema)}`);
  console.log(`[ok] M0 dataset validated: ${dataset.contexts.length} contexts, ${dataset.cases.length} cases, ${dataset.relations.length} relations`);

  if (options.results || options.selfTest) {
    const results = options.selfTest ? buildSelfTestResults(dataset, contextMap) : readJson(options.results);
    const metrics = validateResults(results, dataset, contextMap, caseMap);
    console.log(`[ok] M1 result hard gates passed: ${metrics.strategyId}`);
    printMetrics(metrics);
  }

  console.log("[ok] verify-ncs-evaluation-m0 passed");
}

try {
  main();
} catch (error) {
  console.error(`[fail] ${error.message}`);
  process.exit(1);
}
