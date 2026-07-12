CREATE TABLE "ncs_evaluation_revisions" (
    "revision_id" BIGSERIAL NOT NULL,
    "process_log_id" BIGINT NOT NULL,
    "session_id" BIGINT NOT NULL,
    "question_id" BIGINT NOT NULL,
    "answer_id" BIGINT,
    "contract_version" VARCHAR(80) NOT NULL,
    "snapshot_version" VARCHAR(128) NOT NULL,
    "strategy_id" VARCHAR(120) NOT NULL,
    "input_snapshot_json" TEXT NOT NULL,
    "output_json" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ncs_evaluation_revisions_pkey" PRIMARY KEY ("revision_id")
);

CREATE UNIQUE INDEX "uk_ncs_evaluation_revisions_process"
ON "ncs_evaluation_revisions"("process_log_id");

CREATE INDEX "idx_ncs_evaluation_revisions_session_created"
ON "ncs_evaluation_revisions"("session_id", "created_at");

CREATE INDEX "idx_ncs_evaluation_revisions_answer_created"
ON "ncs_evaluation_revisions"("answer_id", "created_at");

ALTER TABLE "ncs_evaluation_revisions"
ADD CONSTRAINT "ncs_evaluation_revisions_process_log_id_fkey"
FOREIGN KEY ("process_log_id") REFERENCES "ai_process_logs"("process_log_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ncs_evaluation_revisions"
ADD CONSTRAINT "ncs_evaluation_revisions_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("session_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ncs_evaluation_revisions"
ADD CONSTRAINT "ncs_evaluation_revisions_question_id_fkey"
FOREIGN KEY ("question_id") REFERENCES "question_bank"("question_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ncs_evaluation_revisions"
ADD CONSTRAINT "ncs_evaluation_revisions_answer_id_fkey"
FOREIGN KEY ("answer_id") REFERENCES "interview_answers"("answer_id")
ON DELETE SET NULL ON UPDATE CASCADE;
