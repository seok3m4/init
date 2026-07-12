import test from "node:test";
import assert from "node:assert/strict";
import { AiWorkerLoop } from "./worker-loop";

test("AiWorkerLoop keeps polling until max batch count", async () => {
  let calls = 0;
  const loop = new AiWorkerLoop(
    {
      async processBatch() {
        calls += 1;
        return 1;
      }
    },
    { idleDelayMs: 0 }
  );

  await loop.run({ maxBatches: 3 });

  assert.equal(calls, 3);
});

test("AiWorkerLoop waits after an empty batch", async () => {
  let calls = 0;
  const startedAt = Date.now();
  const loop = new AiWorkerLoop(
    {
      async processBatch() {
        calls += 1;
        return 0;
      }
    },
    { idleDelayMs: 10 }
  );

  await loop.run({ maxBatches: 1 });

  assert.equal(calls, 1);
  assert.equal(Date.now() - startedAt >= 8, true);
});

test("AiWorkerLoop exits when aborted during idle delay", async () => {
  const abortController = new AbortController();
  let calls = 0;
  const loop = new AiWorkerLoop(
    {
      async processBatch() {
        calls += 1;
        setTimeout(() => abortController.abort(), 5);
        return 0;
      }
    },
    { idleDelayMs: 5_000, signal: abortController.signal }
  );

  await loop.run();

  assert.equal(calls, 1);
});

test("AiWorkerLoop removes the abort listener after each idle delay", async () => {
  const listeners = new Set<unknown>();
  let maxActiveListeners = 0;
  const signal = {
    aborted: false,
    addEventListener(type: string, listener: unknown) {
      if (type !== "abort") return;
      listeners.add(listener);
      maxActiveListeners = Math.max(maxActiveListeners, listeners.size);
    },
    removeEventListener(type: string, listener: unknown) {
      if (type === "abort") listeners.delete(listener);
    }
  } as unknown as AbortSignal;
  const loop = new AiWorkerLoop(
    {
      async processBatch() {
        return 0;
      }
    },
    { idleDelayMs: 1, signal }
  );

  await loop.run({ maxBatches: 12 });

  assert.equal(maxActiveListeners, 1);
  assert.equal(listeners.size, 0);
});
