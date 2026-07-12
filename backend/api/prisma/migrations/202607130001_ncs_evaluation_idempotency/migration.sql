ALTER TABLE "ai_process_logs"
ADD COLUMN "deduplication_key" VARCHAR(128);

CREATE UNIQUE INDEX "uk_ai_process_logs_deduplication_key"
ON "ai_process_logs"("deduplication_key");
