CREATE TABLE "ncs_evaluation_snapshots" (
  "snapshot_id" BIGSERIAL NOT NULL,
  "session_id" BIGINT NOT NULL,
  "question_id" BIGINT NOT NULL,
  "contract_version" VARCHAR(80) NOT NULL,
  "snapshot_version" VARCHAR(128) NOT NULL,
  "job_role" VARCHAR(80),
  "snapshot_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ncs_evaluation_snapshots_pkey" PRIMARY KEY ("snapshot_id")
);

CREATE UNIQUE INDEX "uk_ncs_evaluation_snapshots_session_question"
  ON "ncs_evaluation_snapshots"("session_id", "question_id");

CREATE INDEX "idx_ncs_evaluation_snapshots_question"
  ON "ncs_evaluation_snapshots"("question_id");

ALTER TABLE "ncs_evaluation_snapshots"
  ADD CONSTRAINT "ncs_evaluation_snapshots_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("session_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ncs_evaluation_snapshots"
  ADD CONSTRAINT "ncs_evaluation_snapshots_question_id_fkey"
  FOREIGN KEY ("question_id") REFERENCES "question_bank"("question_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
