ALTER TABLE "interview_session_questions"
  DROP CONSTRAINT "interview_session_questions_private_shape_check";

ALTER TABLE "interview_session_questions"
  ADD CONSTRAINT "interview_session_questions_private_shape_check"
  CHECK (
    (
      "question_id" IS NOT NULL
      AND "runtime_question_id" IS NULL
      AND (
        ("question_type" IS NULL AND "content" IS NULL)
        OR ("question_type" IS NOT NULL AND "content" IS NOT NULL)
      )
    )
    OR
    (
      "question_id" IS NULL
      AND "runtime_question_id" IS NOT NULL
      AND "question_type" IS NOT NULL
      AND "content" IS NOT NULL
    )
  );
