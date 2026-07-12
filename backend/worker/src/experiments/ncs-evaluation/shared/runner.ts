import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import {
  NCS_EVALUATION_CONTRACT_VERSION,
  NcsEvaluationStrategy,
  NcsGoldenDataset,
  NcsStrategyResults,
} from "./contract";
import { assembleNcsEvaluationInput, contextMapFor } from "./dataset";

export interface NcsStrategyRunnerOptions {
  runs: number;
  estimatedCostUsd?: number;
}

export async function runNcsEvaluationStrategy(
  strategy: NcsEvaluationStrategy,
  dataset: NcsGoldenDataset,
  options: NcsStrategyRunnerOptions,
): Promise<NcsStrategyResults> {
  if (!Number.isInteger(options.runs) || options.runs < 1) {
    throw new Error("runs must be a positive integer");
  }
  const contexts = contextMapFor(dataset);
  const runs: NcsStrategyResults["runs"] = [];
  for (const goldenCase of dataset.cases) {
    const input = assembleNcsEvaluationInput(dataset, goldenCase, contexts);
    for (let runNumber = 1; runNumber <= options.runs; runNumber += 1) {
      const startedAt = performance.now();
      const output = await strategy.evaluate(input);
      const latencyMs = performance.now() - startedAt;
      runs.push({
        caseId: goldenCase.caseId,
        runNumber,
        latencyMs,
        estimatedCostUsd: options.estimatedCostUsd ?? 0,
        output,
      });
    }
  }
  return {
    contractVersion: NCS_EVALUATION_CONTRACT_VERSION,
    strategyId: strategy.strategyId,
    runs,
  };
}

export async function writeNcsStrategyResults(filePath: string, results: NcsStrategyResults): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
}
