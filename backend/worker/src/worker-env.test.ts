import test from "node:test";
import assert from "node:assert/strict";
import { loadWorkerEnv } from "./worker-env";

const validEnv = {
  AI_SQS_QUEUE_URL: "https://sqs.ap-northeast-2.amazonaws.com/123456789012/init-ai-worker",
  AWS_REGION: "ap-northeast-2",
  AI_PROVIDER_API_KEY: "test-ai-provider-key",
  S3_BUCKET_NAME: "init-dev-bucket"
};

test("loadWorkerEnv requires SQS, AWS, AI provider and S3 configuration", () => {
  for (const name of Object.keys(validEnv)) {
    const env = { ...validEnv };
    delete env[name as keyof typeof env];

    assert.throws(() => loadWorkerEnv(env), new RegExp(`${name} is required`));
  }
});

test("loadWorkerEnv returns defaults for optional worker settings", () => {
  assert.deepEqual(loadWorkerEnv(validEnv), {
    aiSqsQueueUrl: validEnv.AI_SQS_QUEUE_URL,
    awsRegion: validEnv.AWS_REGION,
    aiProviderApiKey: validEnv.AI_PROVIDER_API_KEY,
    s3BucketName: validEnv.S3_BUCKET_NAME,
    workerBatchSize: 1,
    workerPollIntervalMs: 1000,
    workerRepositoryMode: "memory",
    prismaClientModule: undefined
  });
});

test("loadWorkerEnv validates bounded numeric worker settings", () => {
  assert.equal(loadWorkerEnv({ ...validEnv, WORKER_BATCH_SIZE: "10" }).workerBatchSize, 10);
  assert.equal(loadWorkerEnv({ ...validEnv, WORKER_POLL_INTERVAL_MS: "60000" }).workerPollIntervalMs, 60000);

  assert.throws(() => loadWorkerEnv({ ...validEnv, WORKER_BATCH_SIZE: "0" }), /Expected integer between 1 and 10/);
  assert.throws(
    () => loadWorkerEnv({ ...validEnv, WORKER_POLL_INTERVAL_MS: "99" }),
    /Expected integer between 100 and 60000/
  );
});

test("loadWorkerEnv validates repository mode and optional Prisma module", () => {
  assert.equal(loadWorkerEnv({ ...validEnv, WORKER_REPOSITORY_MODE: "prisma" }).workerRepositoryMode, "prisma");
  assert.equal(
    loadWorkerEnv({ ...validEnv, PRISMA_CLIENT_MODULE: " @prisma/client " }).prismaClientModule,
    "@prisma/client"
  );

  assert.throws(
    () => loadWorkerEnv({ ...validEnv, WORKER_REPOSITORY_MODE: "filesystem" }),
    /WORKER_REPOSITORY_MODE must be memory or prisma/
  );
});
