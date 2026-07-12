import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKER_DIR = path.join(ROOT_DIR, "backend", "worker");
const DEFAULT_DATASET = path.join(ROOT_DIR, "docs", "04_implementation", "ncs-evaluation-m0", "golden-cases.json");
const STRATEGIES = ["common-rubric", "evidence-state", "pairwise", "hybrid"];

function parseArgs(argv) {
  const options = { dataset: DEFAULT_DATASET, runs: 5, strategies: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--dataset" && value) {
      options.dataset = path.resolve(value);
      index += 1;
    } else if (argument === "--runs" && value) {
      options.runs = Number(value);
      index += 1;
    } else if (argument === "--strategy" && value) {
      options.strategies.push(value);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  if (!Number.isInteger(options.runs) || options.runs <= 0) {
    throw new Error("--runs must be a positive integer");
  }
  const selected = options.strategies.length > 0 ? options.strategies : STRATEGIES;
  for (const strategy of selected) {
    if (!STRATEGIES.includes(strategy)) throw new Error(`Unknown strategy: ${strategy}`);
  }
  return { ...options, strategies: [...new Set(selected)] };
}

function runStrategy(strategy, options) {
  const runner = path.join(WORKER_DIR, "dist", "experiments", "ncs-evaluation", strategy, "run.js");
  const output = path.join(WORKER_DIR, "src", "experiments", "ncs-evaluation", strategy, "results.json");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      runner,
      "--dataset",
      options.dataset,
      "--output",
      output,
      "--runs",
      String(options.runs),
    ], {
      cwd: WORKER_DIR,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${strategy} runner failed with ${signal ?? `exit code ${code}`}`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await Promise.all(options.strategies.map((strategy) => runStrategy(strategy, options)));
  console.log(`[ok] generated ${options.runs} runs per case for ${options.strategies.join(", ")}`);
}

main().catch((error) => {
  console.error(`[error] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
