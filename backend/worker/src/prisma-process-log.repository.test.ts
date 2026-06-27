import test from "node:test";
import assert from "node:assert/strict";
import { PrismaAiProcessLogRepository } from "./prisma-process-log.repository";

test("PrismaAiProcessLogRepository writes process state transitions to ai_process_logs", async () => {
  const calls: Array<{ method: string; args: any }> = [];
  const records = new Map<bigint, any>();
  const prisma = {
    aiProcessLog: {
      async upsert(args: any) {
        calls.push({ method: "upsert", args });
        const id = args.where.processLogId;
        const existing = records.get(id);
        if (existing) {
          return existing;
        }
        const created = {
          ...args.create,
          outputRef: null,
          failureCategory: null,
          failureReason: null
        };
        records.set(id, created);
        return created;
      },
      async update(args: any) {
        calls.push({ method: "update", args });
        const id = args.where.processLogId;
        const updated = {
          ...records.get(id),
          ...args.data
        };
        records.set(id, updated);
        return updated;
      }
    },
    aiGuardrailLog: {
      async create(args: any) {
        calls.push({ method: "guardrailCreate", args });
        return { guardrailLogId: args.data.guardrailLogId };
      }
    }
  };
  const repository = new PrismaAiProcessLogRepository(prisma);

  await repository.ensurePending({
    processLogId: 10,
    processType: "REPORT_GENERATE",
    inputRef: "report:10",
    attempt: 1
  });
  await repository.markRunning(10);
  const completed = await repository.markCompleted(10, "s3://reports/10.json");
  const guardrailLogId = await repository.saveGuardrailLog(10, "REPORT_FINAL_SAVE", {
    result: "PASS",
    reason: null
  });

  assert.equal(completed.status, "COMPLETED");
  assert.equal(completed.outputRef, "s3://reports/10.json");
  assert.equal(typeof guardrailLogId, "number");
  assert.deepEqual(
    calls.map((call) => call.method),
    ["upsert", "update", "update", "guardrailCreate"]
  );
  assert.equal(calls[1].args.data.status, "RUNNING");
  assert.equal(calls[2].args.data.status, "COMPLETED");
  assert.equal(calls[3].args.data.result, "PASS");
});

test("PrismaAiProcessLogRepository records retryability on failed worker jobs", async () => {
  const records = new Map<bigint, any>();
  const prisma = {
    aiProcessLog: {
      async upsert(args: any) {
        const created = {
          ...args.create,
          outputRef: null,
          failureCategory: null,
          failureReason: null
        };
        records.set(args.where.processLogId, created);
        return created;
      },
      async update(args: any) {
        const id = args.where.processLogId;
        const updated = {
          ...records.get(id),
          ...args.data
        };
        records.set(id, updated);
        return updated;
      }
    },
    aiGuardrailLog: {
      async create(args: any) {
        return { guardrailLogId: args.data.guardrailLogId };
      }
    }
  };
  const repository = new PrismaAiProcessLogRepository(prisma);

  await repository.ensurePending({
    processLogId: 11,
    processType: "STT",
    inputRef: "answer:11",
    attempt: 1
  });
  const failed = await repository.markFailed(11, {
    category: "RETRYABLE",
    reason: "provider timeout"
  });

  assert.equal(failed.status, "FAILED");
  assert.deepEqual(failed.failure, {
    category: "RETRYABLE",
    reason: "provider timeout"
  });
});
