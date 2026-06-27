# AI Worker

This package owns the long-running AI job boundary for E-part work.

The first layer is intentionally adapter-based:

- `AiJobQueue` abstracts SQS receive/delete behavior.
- `AiProcessLogRepository` abstracts `ai_process_logs` and `ai_guardrail_logs`.
- `AiWorkerRunner` guarantees `RUNNING -> COMPLETED/FAILED` state transitions.
- `AiWorkerLoop` polls SQS in a long-running process and exits on SIGINT/SIGTERM.
- task handlers do the actual document/STT/follow-up/report/embedding work.

Runtime commands:

- `npm run build`
- `npm start`

Required runtime environment variables:

- `AI_SQS_QUEUE_URL`
- `AWS_REGION`
- `AI_PROVIDER_API_KEY`
- `S3_BUCKET_NAME`

Optional runtime environment variables:

- `WORKER_BATCH_SIZE` defaults to `1`, max `10`.
- `WORKER_POLL_INTERVAL_MS` defaults to `1000`.
- `WORKER_REPOSITORY_MODE` is `memory` by default and can be set to `prisma`.
- `PRISMA_CLIENT_MODULE` overrides the Prisma client module path. The default resolves to the API package's `@prisma/client`.

Secrets are read from environment variables only and must not be committed.
