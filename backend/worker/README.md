# AI Worker

This package owns the long-running AI job boundary for E-part work.

The first layer is intentionally adapter-based:

- `AiJobQueue` abstracts SQS receive/delete behavior.
- `AiProcessLogRepository` abstracts `ai_process_logs` and `ai_guardrail_logs`.
- `AiWorkerRunner` guarantees `RUNNING -> COMPLETED/FAILED` state transitions.
- task handlers do the actual document/STT/follow-up/report/embedding work.

Required runtime environment variables:

- `AI_SQS_QUEUE_URL`
- `AWS_REGION`
- `AI_PROVIDER_API_KEY`
- `S3_BUCKET_NAME`

Secrets are read from environment variables only and must not be committed.
