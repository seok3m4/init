import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_DATASET = path.join(ROOT_DIR, "docs", "04_implementation", "ncs-evaluation-m0", "golden-cases.json");
const DEFAULT_JSON = path.join(ROOT_DIR, "docs", "04_implementation", "ncs-evaluation-m2", "current-comparison.json");
const DEFAULT_MARKDOWN = path.join(ROOT_DIR, "docs", "04_implementation", "ncs-evaluation-m2", "current-comparison.md");
const VERIFIER = path.join(ROOT_DIR, "scripts", "verify-ncs-evaluation-m0.mjs");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    dataset: DEFAULT_DATASET,
    outputJson: DEFAULT_JSON,
    outputMarkdown: DEFAULT_MARKDOWN,
    results: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (["--dataset", "--results", "--output-json", "--output-md"].includes(argument)) {
      if (!value || value.startsWith("--")) fail(`${argument} requires a path`);
      const resolved = path.resolve(process.cwd(), value);
      if (argument === "--dataset") options.dataset = resolved;
      if (argument === "--results") options.results.push(resolved);
      if (argument === "--output-json") options.outputJson = resolved;
      if (argument === "--output-md") options.outputMarkdown = resolved;
      index += 1;
      continue;
    }
    fail(`Unknown argument: ${argument}`);
  }
  if (options.results.length === 0) fail("At least one --results path is required");
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function verifyHardGates(resultsPath) {
  const verification = spawnSync(process.execPath, [VERIFIER, "--results", resultsPath], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });
  return {
    passed: verification.status === 0,
    detail: verification.status === 0
      ? "PASS"
      : `${verification.stdout ?? ""}\n${verification.stderr ?? ""}`.trim(),
  };
}

function metricsFor(dataset, results, resultsPath, hardGate) {
  const caseMap = new Map(dataset.cases.map((goldenCase) => [goldenCase.caseId, goldenCase]));
  let evaluationCount = 0;
  let exactStatusCount = 0;
  let exactLevelCount = 0;
  let expectedQuoteCount = 0;
  let matchedQuoteCount = 0;
  let followUpCount = 0;
  const latencies = [];
  const costs = [];
  const repeatability = new Map();

  for (const run of results.runs) {
    const goldenCase = caseMap.get(run.caseId);
    if (!goldenCase) fail(`${results.strategyId} contains unknown case ${run.caseId}`);
    const evidenceMap = new Map(run.output.evidences.map((evidence) => [evidence.evidenceId, evidence]));
    const evaluationMap = new Map(run.output.behaviorEvaluations.map((evaluation) => [evaluation.behaviorPointId, evaluation]));
    for (const expected of goldenCase.expected.behaviorPoints) {
      const actual = evaluationMap.get(expected.behaviorPointId);
      if (!actual) fail(`${results.strategyId}/${run.caseId} missing ${expected.behaviorPointId}`);
      evaluationCount += 1;
      if (actual.status === expected.status) exactStatusCount += 1;
      if (actual.level === expected.level) exactLevelCount += 1;
      const signatureKey = `${run.caseId}:${expected.behaviorPointId}`;
      const signatures = repeatability.get(signatureKey) ?? new Set();
      signatures.add(`${actual.status}:${actual.level}`);
      repeatability.set(signatureKey, signatures);
      const actualQuotes = [...actual.supportingEvidenceIds, ...actual.contradictingEvidenceIds]
        .map((evidenceId) => evidenceMap.get(evidenceId)?.quote)
        .filter(Boolean);
      for (const expectedQuote of expected.mustQuote) {
        expectedQuoteCount += 1;
        if (actualQuotes.some((quote) => quote.includes(expectedQuote))) matchedQuoteCount += 1;
      }
    }
    if (run.output.followUp.required === goldenCase.expected.followUpRequired) followUpCount += 1;
    latencies.push(run.latencyMs);
    costs.push(run.estimatedCostUsd);
  }

  const repeatableCount = [...repeatability.values()].filter((signatures) => signatures.size === 1).length;
  return {
    strategyId: results.strategyId,
    resultsPath: path.relative(ROOT_DIR, resultsPath).replaceAll("\\", "/"),
    hardGatePassed: hardGate.passed,
    hardGateDetail: hardGate.detail,
    exactStatusRate: exactStatusCount / evaluationCount,
    exactLevelRate: exactLevelCount / evaluationCount,
    expectedQuoteCoverage: expectedQuoteCount === 0 ? 1 : matchedQuoteCount / expectedQuoteCount,
    followUpDecisionRate: followUpCount / results.runs.length,
    repeatabilityRate: repeatableCount / repeatability.size,
    p95LatencyMs: percentile(latencies, 95),
    averageEstimatedCostUsd: costs.reduce((sum, value) => sum + value, 0) / costs.length,
    runCount: results.runs.length,
  };
}

function compareCandidates(left, right) {
  if (left.hardGatePassed !== right.hardGatePassed) return left.hardGatePassed ? -1 : 1;
  const descending = ["exactLevelRate", "expectedQuoteCoverage", "followUpDecisionRate", "repeatabilityRate"];
  for (const key of descending) {
    if (left[key] !== right[key]) return right[key] - left[key];
  }
  if (left.p95LatencyMs !== right.p95LatencyMs) return left.p95LatencyMs - right.p95LatencyMs;
  if (left.averageEstimatedCostUsd !== right.averageEstimatedCostUsd) {
    return left.averageEstimatedCostUsd - right.averageEstimatedCostUsd;
  }
  return left.strategyId.localeCompare(right.strategyId);
}

function formatRate(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function markdownFor(report) {
  const lines = [
    "# NCS Evaluation M2 Current Comparison",
    "",
    `- Status: \`${report.status}\``,
    `- Experimental candidates passing hard gates: ${report.experimentalCandidatesPassed}`,
    `- Provisional leader: ${report.provisionalLeader ? `\`${report.provisionalLeader}\`` : "none"}`,
    `- Recommended strategy: ${report.recommendedStrategy ? `\`${report.recommendedStrategy}\`` : "not decided"}`,
    "",
    "| Rank | Strategy | Hard gate | Exact level | Quote coverage | Follow-up | Repeatability | p95 latency | Avg. cost |",
    "| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  report.candidates.forEach((candidate, index) => {
    lines.push(
      `| ${index + 1} | ${candidate.strategyId} | ${candidate.hardGatePassed ? "PASS" : "FAIL"} | ${formatRate(candidate.exactLevelRate)} | ${formatRate(candidate.expectedQuoteCoverage)} | ${formatRate(candidate.followUpDecisionRate)} | ${formatRate(candidate.repeatabilityRate)} | ${candidate.p95LatencyMs.toFixed(2)}ms | $${candidate.averageEstimatedCostUsd.toFixed(6)} |`,
    );
  });
  lines.push(
    "",
    "## Decision Rule",
    "",
    "Hard gate를 통과한 전략만 정확 단계, 근거 인용, 꼬리질문, 반복성, latency, 비용 순으로 비교한다. 실험 전략이 두 개 이상 통과하기 전에는 최종 채택하지 않는다.",
  );
  return `${lines.join("\n")}\n`;
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const dataset = readJson(options.dataset);
  const candidates = options.results.map((resultsPath) => {
    const results = readJson(resultsPath);
    return metricsFor(dataset, results, resultsPath, verifyHardGates(resultsPath));
  }).sort(compareCandidates);
  const experimentalCandidatesPassed = candidates.filter(
    (candidate) => candidate.hardGatePassed && candidate.strategyId !== "baseline-deterministic",
  ).length;
  const ready = experimentalCandidatesPassed >= 2;
  const report = {
    reportVersion: "ncs-evaluation-m2.v1",
    status: ready ? "READY_FOR_DECISION" : "AWAITING_CANDIDATES",
    experimentalCandidatesPassed,
    provisionalLeader: candidates[0]?.hardGatePassed ? candidates[0].strategyId : null,
    recommendedStrategy: ready && candidates[0]?.hardGatePassed ? candidates[0].strategyId : null,
    candidates,
  };
  writeFile(options.outputJson, `${JSON.stringify(report, null, 2)}\n`);
  writeFile(options.outputMarkdown, markdownFor(report));
  console.log(`[ok] compared ${candidates.length} strategies`);
  console.log(`[ok] status ${report.status}`);
  console.log(`[ok] wrote ${options.outputJson}`);
  console.log(`[ok] wrote ${options.outputMarkdown}`);
}

try {
  main();
} catch (error) {
  console.error(`[fail] ${error.message}`);
  process.exit(1);
}
