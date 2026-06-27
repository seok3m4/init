export interface WorkerEnv {
  aiSqsQueueUrl: string;
  awsRegion: string;
  aiProviderApiKey: string;
  s3BucketName: string;
}

export function loadWorkerEnv(env: NodeJS.ProcessEnv = process.env): WorkerEnv {
  return {
    aiSqsQueueUrl: required(env, "AI_SQS_QUEUE_URL"),
    awsRegion: required(env, "AWS_REGION"),
    aiProviderApiKey: required(env, "AI_PROVIDER_API_KEY"),
    s3BucketName: required(env, "S3_BUCKET_NAME")
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value?.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value;
}
