import { resolve } from "node:path";
import { runNcsStrategyCli } from "../shared/cli";
import { DeterministicNcsBaselineEvaluator } from "./evaluator";

async function main(): Promise<void> {
  await runNcsStrategyCli(
    new DeterministicNcsBaselineEvaluator(),
    process.argv.slice(2),
    resolve(__dirname, "results.json"),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[fail] ${message}`);
  process.exit(1);
});
