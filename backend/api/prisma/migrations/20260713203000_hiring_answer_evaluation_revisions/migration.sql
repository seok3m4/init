CREATE TABLE "hiring_answer_evaluation_revisions" (
  "revision_id" BIGSERIAL PRIMARY KEY,
  "process_log_id" BIGINT NOT NULL,
  "cohort_id" BIGINT NOT NULL,
  "candidate_id" BIGINT NOT NULL,
  "session_id" BIGINT NOT NULL,
  "question_id" BIGINT NOT NULL,
  "primary_answer_id" BIGINT NOT NULL,
  "context_version" VARCHAR(128) NOT NULL,
  "answer_revision_hash" VARCHAR(80) NOT NULL,
  "contract_version" VARCHAR(80) NOT NULL,
  "evaluator_version" VARCHAR(128) NOT NULL,
  "input_snapshot_json" TEXT NOT NULL,
  "output_json" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_hiring_answer_eval_revisions_process"
    FOREIGN KEY ("process_log_id") REFERENCES "ai_process_logs"("process_log_id") ON DELETE CASCADE,
  CONSTRAINT "fk_hiring_answer_eval_revisions_cohort"
    FOREIGN KEY ("cohort_id") REFERENCES "hiring_evaluation_cohorts"("cohort_id") ON DELETE CASCADE,
  CONSTRAINT "fk_hiring_answer_eval_revisions_candidate"
    FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("candidate_id") ON DELETE RESTRICT,
  CONSTRAINT "fk_hiring_answer_eval_revisions_session"
    FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("session_id") ON DELETE RESTRICT,
  CONSTRAINT "fk_hiring_answer_eval_revisions_question"
    FOREIGN KEY ("question_id") REFERENCES "question_bank"("question_id") ON DELETE RESTRICT,
  CONSTRAINT "fk_hiring_answer_eval_revisions_answer"
    FOREIGN KEY ("primary_answer_id") REFERENCES "interview_answers"("answer_id") ON DELETE RESTRICT,
  CONSTRAINT "fk_hiring_answer_eval_revisions_context"
    FOREIGN KEY ("context_version") REFERENCES "hiring_question_set_snapshots"("snapshot_version") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "uk_hiring_answer_eval_revisions_process"
  ON "hiring_answer_evaluation_revisions"("process_log_id");
CREATE UNIQUE INDEX "uk_hiring_answer_eval_revisions_input"
  ON "hiring_answer_evaluation_revisions"("cohort_id", "candidate_id", "question_id", "answer_revision_hash");
CREATE INDEX "idx_hiring_answer_eval_revisions_candidate"
  ON "hiring_answer_evaluation_revisions"("cohort_id", "candidate_id", "created_at");
CREATE INDEX "idx_hiring_answer_eval_revisions_session"
  ON "hiring_answer_evaluation_revisions"("session_id", "question_id", "created_at");
CREATE INDEX "idx_hiring_answer_eval_revisions_context"
  ON "hiring_answer_evaluation_revisions"("context_version");
