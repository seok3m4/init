ALTER TABLE "hiring_evaluation_cohorts"
  ADD COLUMN "company_id" BIGINT,
  ADD COLUMN "request_key" VARCHAR(128),
  ADD COLUMN "configuration_hash" VARCHAR(80);

UPDATE "hiring_evaluation_cohorts" AS cohort
SET "company_id" = posting."company_id"
FROM "postings" AS posting
WHERE cohort."posting_id" = posting."posting_id";

UPDATE "hiring_evaluation_cohorts" AS cohort
SET "company_id" = company."company_id"
FROM "companies" AS company
WHERE cohort."company_id" IS NULL
  AND cohort."created_by_user_id" = company."owner_user_id";

UPDATE "hiring_evaluation_cohorts"
SET
  "request_key" = 'legacy:' || "cohort_id"::text,
  "configuration_hash" = 'legacy:' || "cohort_id"::text
WHERE "request_key" IS NULL OR "configuration_hash" IS NULL;

ALTER TABLE "hiring_evaluation_cohorts"
  ALTER COLUMN "company_id" SET NOT NULL,
  ALTER COLUMN "request_key" SET NOT NULL,
  ALTER COLUMN "configuration_hash" SET NOT NULL;

CREATE UNIQUE INDEX "uk_hiring_evaluation_cohorts_creator_request"
  ON "hiring_evaluation_cohorts"("created_by_user_id", "request_key");

CREATE INDEX "idx_hiring_evaluation_cohorts_company_status"
  ON "hiring_evaluation_cohorts"("company_id", "status");

ALTER TABLE "hiring_evaluation_cohorts"
  ADD CONSTRAINT "fk_hiring_evaluation_cohorts_company"
  FOREIGN KEY ("company_id") REFERENCES "companies"("company_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hiring_ranking_entries"
  DROP CONSTRAINT "ck_hiring_ranking_entries_values",
  ALTER COLUMN "rank" DROP NOT NULL,
  ALTER COLUMN "percentile" DROP NOT NULL;

ALTER TABLE "hiring_ranking_entries"
  ADD CONSTRAINT "ck_hiring_ranking_entries_values" CHECK (
    (
      ("rank" IS NULL AND "percentile" IS NULL)
      OR ("rank" > 0 AND "percentile" BETWEEN 0 AND 100)
    )
    AND ("weighted_total_score" IS NULL OR "weighted_total_score" BETWEEN 0 AND 100)
  );
