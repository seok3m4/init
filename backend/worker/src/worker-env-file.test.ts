import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadWorkerEnvFiles } from "./worker-env-file";

test("loadWorkerEnvFiles reads root env before worker env without overriding existing values", () => {
  const root = mkdtempSync(path.join(tmpdir(), "worker-env-"));
  const workerDir = path.join(root, "backend", "worker");
  mkdirSync(workerDir, { recursive: true });
  writeFileSync(path.join(root, ".env"), "AWS_REGION=ap-northeast-2\nOPENAI_MODEL=gpt-4o-mini\n", "utf8");
  writeFileSync(path.join(workerDir, ".env"), "AWS_REGION=us-east-1\nAI_PROVIDER_MODE=openai\n", "utf8");

  const env: NodeJS.ProcessEnv = { OPENAI_MODEL: "preconfigured-model" };
  const loaded = loadWorkerEnvFiles(env, workerDir);

  assert.equal(loaded.length, 2);
  assert.equal(env.AWS_REGION, "ap-northeast-2");
  assert.equal(env.OPENAI_MODEL, "preconfigured-model");
  assert.equal(env.AI_PROVIDER_MODE, "openai");
});
