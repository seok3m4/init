import { resolve } from "node:path";
import { NcsEvaluationStrategy } from "./contract";
import { readNcsGoldenDataset } from "./dataset";
import { runNcsEvaluationStrategy, writeNcsStrategyResults } from "./runner";

interface CliOptions {
  dataset: string;
  output: string;
  runs: number;
}

export async function runNcsStrategyCli(
  strategy: NcsEvaluationStrategy,
  args: string[],
  defaultOutput: string,
): Promise<void> {
  const options = parseArgs(args, defaultOutput);
  const dataset = await readNcsGoldenDataset(options.dataset);
  const results = await runNcsEvaluationStrategy(strategy, dataset, {
    runs: options.runs,
    estimatedCostUsd: 0,
  });
  await writeNcsStrategyResults(options.output, results);
  console.log(`[ok] ${results.strategyId}: ${dataset.cases.length} cases x ${options.runs} runs`);
  console.log(`[ok] wrote ${options.output}`);
}

function parseArgs(args: string[], defaultOutput: string): CliOptions {
  const options: CliOptions = {
    dataset: resolve(process.cwd(), "..", "..", "docs", "04_implementation", "ncs-evaluation-m0", "golden-cases.json"),
    output: resolve(defaultOutput),
    runs: 5,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === "--dataset" || argument === "--output" || argument === "--runs") {
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
      if (argument === "--dataset") options.dataset = resolve(process.cwd(), value);
      if (argument === "--output") options.output = resolve(process.cwd(), value);
      if (argument === "--runs") options.runs = Number(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!Number.isInteger(options.runs) || options.runs < 1) throw new Error("--runs must be a positive integer");
  return options;
}
