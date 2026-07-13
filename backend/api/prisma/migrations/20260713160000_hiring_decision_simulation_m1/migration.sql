CREATE TYPE "HiringDecisionMode" AS ENUM ('ABSOLUTE', 'RELATIVE', 'HYBRID');
CREATE TYPE "HiringQuestionSetMode" AS ENUM ('QUICK', 'STANDARD', 'DEEP', 'CUSTOM');
CREATE TYPE "HiringCohortStatus" AS ENUM ('OPEN', 'LOCKED', 'EVALUATED', 'FINALIZED');
CREATE TYPE "CandidateEvaluationStatus" AS ENUM ('PENDING', 'COMPLETED', 'INSUFFICIENT_EVIDENCE', 'FAILED');
CREATE TYPE "HiringEligibilityOutcome" AS ENUM ('ELIGIBLE', 'INELIGIBLE', 'INSUFFICIENT_EVIDENCE');
CREATE TYPE "HiringDecisionOutcome" AS ENUM ('PASS', 'WAITLIST', 'FAIL', 'INSUFFICIENT_EVIDENCE');
CREATE TYPE "HiringTieBreakMode" AS ENUM ('WEIGHT_ORDER');

CREATE TABLE "hiring_evaluation_policies" (
  "policy_id" BIGSERIAL NOT NULL,
  "posting_id" BIGINT,
  "created_by_user_id" BIGINT NOT NULL,
  "policy_version" VARCHAR(128) NOT NULL,
  "decision_mode" "HiringDecisionMode" NOT NULL DEFAULT 'HYBRID',
  "job_weight_percent" INTEGER NOT NULL,
  "talent_weight_percent" INTEGER NOT NULL,
  "minimum_job_score" INTEGER NOT NULL DEFAULT 65,
  "minimum_talent_score" INTEGER NOT NULL DEFAULT 60,
  "minimum_evidence_coverage_percent" INTEGER NOT NULL DEFAULT 80,
  "tie_break_mode" "HiringTieBreakMode" NOT NULL DEFAULT 'WEIGHT_ORDER',
  "snapshot_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "hiring_evaluation_policies_pkey" PRIMARY KEY ("policy_id"),
  CONSTRAINT "ck_hiring_evaluation_policies_weights" CHECK (
    "job_weight_percent" BETWEEN 0 AND 100
    AND "talent_weight_percent" BETWEEN 0 AND 100
    AND "job_weight_percent" + "talent_weight_percent" = 100
  ),
  CONSTRAINT "ck_hiring_evaluation_policies_minimums" CHECK (
    "minimum_job_score" BETWEEN 0 AND 100
    AND "minimum_talent_score" BETWEEN 0 AND 100
    AND "minimum_evidence_coverage_percent" BETWEEN 0 AND 100
  )
);

CREATE TABLE "hiring_question_set_snapshots" (
  "question_set_snapshot_id" BIGSERIAL NOT NULL,
  "posting_id" BIGINT,
  "source_question_set_id" BIGINT,
  "snapshot_version" VARCHAR(128) NOT NULL,
  "job_role" VARCHAR(100) NOT NULL,
  "mode" "HiringQuestionSetMode" NOT NULL,
  "question_count" INTEGER NOT NULL,
  "max_follow_up_count" INTEGER NOT NULL,
  "snapshot_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "hiring_question_set_snapshots_pkey" PRIMARY KEY ("question_set_snapshot_id"),
  CONSTRAINT "ck_hiring_question_set_snapshots_mode_counts" CHECK (
    ("mode" = 'QUICK' AND "question_count" = 3 AND "max_follow_up_count" = 2)
    OR ("mode" = 'STANDARD' AND "question_count" = 5 AND "max_follow_up_count" = 3)
    OR ("mode" = 'DEEP' AND "question_count" = 7 AND "max_follow_up_count" = 4)
    OR ("mode" = 'CUSTOM' AND "question_count" > 0 AND "max_follow_up_count" >= 0)
  )
);

CREATE TABLE "hiring_evaluation_cohorts" (
  "cohort_id" BIGSERIAL NOT NULL,
  "posting_id" BIGINT,
  "policy_id" BIGINT NOT NULL,
  "question_set_snapshot_id" BIGINT NOT NULL,
  "created_by_user_id" BIGINT NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "job_role" VARCHAR(100) NOT NULL,
  "status" "HiringCohortStatus" NOT NULL DEFAULT 'OPEN',
  "capacity" INTEGER NOT NULL,
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "evaluated_at" TIMESTAMP(3),
  "finalized_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hiring_evaluation_cohorts_pkey" PRIMARY KEY ("cohort_id"),
  CONSTRAINT "ck_hiring_evaluation_cohorts_capacity" CHECK ("capacity" > 0),
  CONSTRAINT "ck_hiring_evaluation_cohorts_timestamps" CHECK (
    ("locked_at" IS NULL OR "locked_at" >= "opened_at")
    AND ("evaluated_at" IS NULL OR ("locked_at" IS NOT NULL AND "evaluated_at" >= "locked_at"))
    AND ("finalized_at" IS NULL OR ("evaluated_at" IS NOT NULL AND "finalized_at" >= "evaluated_at"))
  )
);

CREATE TABLE "candidate_evaluation_summaries" (
  "summary_id" BIGSERIAL NOT NULL,
  "cohort_id" BIGINT NOT NULL,
  "candidate_id" BIGINT NOT NULL,
  "session_id" BIGINT NOT NULL,
  "status" "CandidateEvaluationStatus" NOT NULL DEFAULT 'PENDING',
  "job_score" DECIMAL(5,2),
  "talent_score" DECIMAL(5,2),
  "weighted_total_score" DECIMAL(5,2),
  "evidence_coverage_percent" DECIMAL(5,2),
  "absolute_decision" "HiringEligibilityOutcome",
  "score_breakdown_json" JSONB,
  "evaluation_version" VARCHAR(128) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "candidate_evaluation_summaries_pkey" PRIMARY KEY ("summary_id"),
  CONSTRAINT "ck_candidate_evaluation_summaries_scores" CHECK (
    ("job_score" IS NULL OR "job_score" BETWEEN 0 AND 100)
    AND ("talent_score" IS NULL OR "talent_score" BETWEEN 0 AND 100)
    AND ("weighted_total_score" IS NULL OR "weighted_total_score" BETWEEN 0 AND 100)
    AND ("evidence_coverage_percent" IS NULL OR "evidence_coverage_percent" BETWEEN 0 AND 100)
  )
);

CREATE TABLE "hiring_ranking_snapshots" (
  "ranking_snapshot_id" BIGSERIAL NOT NULL,
  "cohort_id" BIGINT NOT NULL,
  "revision" INTEGER NOT NULL,
  "policy_version" VARCHAR(128) NOT NULL,
  "algorithm_version" VARCHAR(128) NOT NULL,
  "input_hash" VARCHAR(128) NOT NULL,
  "candidate_count" INTEGER NOT NULL,
  "eligible_count" INTEGER NOT NULL,
  "capacity" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "hiring_ranking_snapshots_pkey" PRIMARY KEY ("ranking_snapshot_id"),
  CONSTRAINT "ck_hiring_ranking_snapshots_counts" CHECK (
    "revision" > 0
    AND "candidate_count" >= 0
    AND "eligible_count" >= 0
    AND "eligible_count" <= "candidate_count"
    AND "capacity" > 0
  )
);

CREATE TABLE "hiring_ranking_entries" (
  "ranking_entry_id" BIGSERIAL NOT NULL,
  "ranking_snapshot_id" BIGINT NOT NULL,
  "summary_id" BIGINT NOT NULL,
  "rank" INTEGER NOT NULL,
  "percentile" DECIMAL(5,2) NOT NULL,
  "weighted_total_score" DECIMAL(5,2),
  "decision" "HiringDecisionOutcome" NOT NULL,
  "tie_break_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "hiring_ranking_entries_pkey" PRIMARY KEY ("ranking_entry_id"),
  CONSTRAINT "ck_hiring_ranking_entries_values" CHECK (
    "rank" > 0
    AND "percentile" BETWEEN 0 AND 100
    AND ("weighted_total_score" IS NULL OR "weighted_total_score" BETWEEN 0 AND 100)
  )
);

CREATE UNIQUE INDEX "uk_hiring_evaluation_policies_version"
  ON "hiring_evaluation_policies"("policy_version");
CREATE INDEX "idx_hiring_evaluation_policies_posting_created"
  ON "hiring_evaluation_policies"("posting_id", "created_at");

CREATE UNIQUE INDEX "uk_hiring_question_set_snapshots_version"
  ON "hiring_question_set_snapshots"("snapshot_version");
CREATE INDEX "idx_hiring_question_set_snapshots_posting_created"
  ON "hiring_question_set_snapshots"("posting_id", "created_at");
CREATE INDEX "idx_hiring_question_set_snapshots_source_set"
  ON "hiring_question_set_snapshots"("source_question_set_id");

CREATE INDEX "idx_hiring_evaluation_cohorts_posting_status"
  ON "hiring_evaluation_cohorts"("posting_id", "status");
CREATE INDEX "idx_hiring_evaluation_cohorts_policy"
  ON "hiring_evaluation_cohorts"("policy_id");
CREATE INDEX "idx_hiring_evaluation_cohorts_question_snapshot"
  ON "hiring_evaluation_cohorts"("question_set_snapshot_id");

CREATE UNIQUE INDEX "uk_candidate_evaluation_summaries_cohort_candidate"
  ON "candidate_evaluation_summaries"("cohort_id", "candidate_id");
CREATE UNIQUE INDEX "uk_candidate_evaluation_summaries_cohort_session"
  ON "candidate_evaluation_summaries"("cohort_id", "session_id");
CREATE INDEX "idx_candidate_evaluation_summaries_cohort_status"
  ON "candidate_evaluation_summaries"("cohort_id", "status");
CREATE INDEX "idx_candidate_evaluation_summaries_candidate_created"
  ON "candidate_evaluation_summaries"("candidate_id", "created_at");

CREATE UNIQUE INDEX "uk_hiring_ranking_snapshots_cohort_revision"
  ON "hiring_ranking_snapshots"("cohort_id", "revision");
CREATE UNIQUE INDEX "uk_hiring_ranking_snapshots_cohort_input"
  ON "hiring_ranking_snapshots"("cohort_id", "input_hash");
CREATE INDEX "idx_hiring_ranking_snapshots_cohort_created"
  ON "hiring_ranking_snapshots"("cohort_id", "created_at");

CREATE UNIQUE INDEX "uk_hiring_ranking_entries_snapshot_summary"
  ON "hiring_ranking_entries"("ranking_snapshot_id", "summary_id");
CREATE INDEX "idx_hiring_ranking_entries_snapshot_rank"
  ON "hiring_ranking_entries"("ranking_snapshot_id", "rank");
CREATE INDEX "idx_hiring_ranking_entries_summary"
  ON "hiring_ranking_entries"("summary_id");

ALTER TABLE "hiring_evaluation_policies"
  ADD CONSTRAINT "fk_hiring_evaluation_policies_posting"
  FOREIGN KEY ("posting_id") REFERENCES "postings"("posting_id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hiring_evaluation_policies"
  ADD CONSTRAINT "fk_hiring_evaluation_policies_created_by"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hiring_question_set_snapshots"
  ADD CONSTRAINT "fk_hiring_question_set_snapshots_posting"
  FOREIGN KEY ("posting_id") REFERENCES "postings"("posting_id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hiring_question_set_snapshots"
  ADD CONSTRAINT "fk_hiring_question_set_snapshots_source_set"
  FOREIGN KEY ("source_question_set_id") REFERENCES "interview_question_sets"("question_set_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hiring_evaluation_cohorts"
  ADD CONSTRAINT "fk_hiring_evaluation_cohorts_posting"
  FOREIGN KEY ("posting_id") REFERENCES "postings"("posting_id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hiring_evaluation_cohorts"
  ADD CONSTRAINT "fk_hiring_evaluation_cohorts_policy"
  FOREIGN KEY ("policy_id") REFERENCES "hiring_evaluation_policies"("policy_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hiring_evaluation_cohorts"
  ADD CONSTRAINT "fk_hiring_evaluation_cohorts_question_snapshot"
  FOREIGN KEY ("question_set_snapshot_id") REFERENCES "hiring_question_set_snapshots"("question_set_snapshot_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hiring_evaluation_cohorts"
  ADD CONSTRAINT "fk_hiring_evaluation_cohorts_created_by"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "candidate_evaluation_summaries"
  ADD CONSTRAINT "fk_candidate_evaluation_summaries_cohort"
  FOREIGN KEY ("cohort_id") REFERENCES "hiring_evaluation_cohorts"("cohort_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_evaluation_summaries"
  ADD CONSTRAINT "fk_candidate_evaluation_summaries_candidate"
  FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("candidate_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_evaluation_summaries"
  ADD CONSTRAINT "fk_candidate_evaluation_summaries_session"
  FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("session_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hiring_ranking_snapshots"
  ADD CONSTRAINT "fk_hiring_ranking_snapshots_cohort"
  FOREIGN KEY ("cohort_id") REFERENCES "hiring_evaluation_cohorts"("cohort_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hiring_ranking_entries"
  ADD CONSTRAINT "fk_hiring_ranking_entries_snapshot"
  FOREIGN KEY ("ranking_snapshot_id") REFERENCES "hiring_ranking_snapshots"("ranking_snapshot_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hiring_ranking_entries"
  ADD CONSTRAINT "fk_hiring_ranking_entries_summary"
  FOREIGN KEY ("summary_id") REFERENCES "candidate_evaluation_summaries"("summary_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
