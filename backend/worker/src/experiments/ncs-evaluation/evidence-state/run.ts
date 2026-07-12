import { resolve } from "node:path";
import { runNcsStrategyCli } from "../shared/cli";
import { EvidenceStateNcsEvaluator } from "./evaluator";

async function main(): Promise<void> {
  await runNcsStrategyCli(
    new EvidenceStateNcsEvaluator(),
    process.argv.slice(2),
    resolve(__dirname, "results.json"),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[fail] ${message}`);
  process.exit(1);
});
