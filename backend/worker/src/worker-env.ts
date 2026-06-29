export interface WorkerEnv {
  aiSqsQueueUrl: string;
  awsRegion: string;
  aiProviderApiKey: string;
  s3BucketName: string;
  workerBatchSize: number;
  workerPollIntervalMs: number;
  workerRepositoryMode: "memory" | "prisma";
  prismaClientModule?: string;
}

export function loadWorkerEnv(env: NodeJS.ProcessEnv = process.env): WorkerEnv {
  return {
    aiSqsQueueUrl: required(env, "AI_SQS_QUEUE_URL"),
    awsRegion: required(env, "AWS_REGION"),
    aiProviderApiKey: required(env, "AI_PROVIDER_API_KEY"),
    s3BucketName: required(env, "S3_BUCKET_NAME"),
    workerBatchSize: integer(env.WORKER_BATCH_SIZE, 1, 10, 1),
    workerPollIntervalMs: integer(env.WORKER_POLL_INTERVAL_MS, 100, 60_000, 1_000),
    workerRepositoryMode: repositoryMode(env.WORKER_REPOSITORY_MODE),
    prismaClientModule: optional(env.PRISMA_CLIENT_MODULE)
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value?.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function integer(value: string | undefined, min: number, max: number, fallback: number): number {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Expected integer between ${min} and ${max}, received ${value}.`);
  }
  return parsed;
}

function repositoryMode(value: string | undefined): WorkerEnv["workerRepositoryMode"] {
  if (!value?.trim()) {
    return "memory";
  }
  if (value === "memory" || value === "prisma") {
    return value;
  }
  throw new Error("WORKER_REPOSITORY_MODE must be memory or prisma.");
}
