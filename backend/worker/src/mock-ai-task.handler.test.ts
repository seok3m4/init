import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { InMemoryAiResultRepository } from "./ai-result.repository";
import { MockAiTaskHandler } from "./mock-ai-task.handler";
import { InMemoryAiProcessLogRepository } from "./process-log.repository";
import { InMemoryAiJobQueue } from "./queue";
import { createDocumentExtractionStartHandler, createReportFailureHandler } from "./report-failure.handler";
import { AiWorkerRunner } from "./worker-runner";
import { AiProcessType, AiQueueMessage } from "./worker.types";

test("document extraction uses S3 reference and does not persist raw file content", async () => {
  const results = new InMemoryAiResultRepository();
  const repository = new InMemoryAiProcessLogRepository();
  const queue = new InMemoryAiJobQueue([
    message(10, "DOCUMENT_EXTRACT", {
      kind: "DOCUMENT_EXTRACT",
      payload: {
        documentId: 7,
        s3Key: "candidate/1/resume.pdf"
      }
    })
  ]);

  await new AiWorkerRunner(queue, repository, new MockAiTaskHandler(results), {
    onStart: createDocumentExtractionStartHandler(results),
    onFailure: createReportFailureHandler(results)
  }).processBatch();

  assert.deepEqual(results.documentExtractions, [
    {
      documentId: 7,
      s3Key: "candidate/1/resume.pdf",
      extractedText: "Extracted text from candidate/1/resume.pdf"
    }
  ]);
  assert.equal("fileContent" in results.documentExtractions[0], false);
  assert.equal(results.documentParseStatuses.get(7), "EXTRACTED");
  assert.deepEqual(
    results.documentParseStatusEvents.map((event) => event.status),
    ["EXTRACTING", "EXTRACTED"]
  );
});

test("document extraction marks application document failed when input is invalid", async () => {
  const results = new InMemoryAiResultRepository();
  const repository = new InMemoryAiProcessLogRepository();
  const queue = new InMemoryAiJobQueue([
    message(24, "DOCUMENT_EXTRACT", {
      kind: "DOCUMENT_EXTRACT",
      payload: {
        documentId: 7,
        s3Key: "candidate/1/resume.pdf",
        fileContent: "raw pdf bytes must not be here"
      }
    })
  ]);

  await new AiWorkerRunner(queue, repository, new MockAiTaskHandler(results), {
    onStart: createDocumentExtractionStartHandler(results),
    onFailure: createReportFailureHandler(results)
  }).processBatch();

  assert.equal(repository.get(24).status, "FAILED");
  assert.equal(repository.get(24).failure?.category, "NON_RETRYABLE");
  assert.equal(results.documentParseStatuses.get(7), "FAILED");
  assert.deepEqual(
    results.documentParseStatusEvents.map((event) => event.status),
    ["EXTRACTING", "FAILED"]
  );
});

test("duplicate document extraction keeps the completed result", async () => {
  const results = new InMemoryAiResultRepository();

  await runDocumentExtraction({
    processLogId: 25,
    input: {
      kind: "DOCUMENT_EXTRACT",
      payload: {
        documentId: 7,
        s3Key: "candidate/1/resume-first.pdf"
      }
    },
    results
  });

  await runDocumentExtraction({
    processLogId: 26,
    input: {
      kind: "DOCUMENT_EXTRACT",
      payload: {
        documentId: 7,
        s3Key: "candidate/1/resume-second.pdf"
      }
    },
    results
  });

  assert.equal(results.documentExtractions.length, 1);
  assert.equal(results.documentExtractions[0].s3Key, "candidate/1/resume-first.pdf");
  assert.equal(results.documentParseStatuses.get(7), "EXTRACTED");
  assert.deepEqual(
    results.documentParseStatusEvents.map((event) => event.status),
    ["EXTRACTING", "EXTRACTED"]
  );
});

test("STT stores transcript against the target interview answer", async () => {
  const results = new InMemoryAiResultRepository();

  await run({
    processLogId: 11,
    processType: "STT",
    input: {
      kind: "MOCK_INTERVIEW_STT",
      payload: {
        answerId: 42,
        audioS3Key: "candidate/1/answer-42.wav"
      }
    },
    results
  });

  assert.deepEqual(results.transcripts, [
    {
      answerId: 42,
      transcript: "Transcript generated from candidate/1/answer-42.wav"
    }
  ]);
});

test("duplicate STT requests keep the existing transcript result", async () => {
  const results = new InMemoryAiResultRepository();

  await run({
    processLogId: 18,
    processType: "STT",
    input: {
      kind: "MOCK_INTERVIEW_STT",
      payload: {
        answerId: 42,
        audioS3Key: "candidate/1/answer-42-first.wav"
      }
    },
    results
  });

  await run({
    processLogId: 19,
    processType: "STT",
    input: {
      kind: "MOCK_INTERVIEW_STT",
      payload: {
        answerId: 42,
        audioS3Key: "candidate/1/answer-42-second.wav"
      }
    },
    results
  });

  assert.equal(results.transcripts.length, 1);
  assert.deepEqual(results.transcripts[0], {
    answerId: 42,
    transcript: "Transcript generated from candidate/1/answer-42-first.wav"
  });
});

test("follow-up question policy is separated for mock and recruiting interviews", async () => {
  const results = new InMemoryAiResultRepository();

  await run({
    processLogId: 12,
    processType: "FOLLOW_UP",
    input: {
      kind: "MOCK_FOLLOW_UP",
      payload: {
        sessionId: 3,
        answerId: 4,
        transcript: "I used Redis cache invalidation."
      }
    },
    results
  });

  await run({
    processLogId: 13,
    processType: "FOLLOW_UP",
    input: {
      kind: "RECRUITING_FOLLOW_UP",
      payload: {
        sessionId: 5,
        answerId: 6,
        transcript: "I used Redis cache invalidation."
      }
    },
    results
  });

  assert.equal(results.followUpQuestions[0].policy, "MOCK");
  assert.match(results.followUpQuestions[0].content, /Practice follow-up/);
  assert.equal(results.followUpQuestions[1].policy, "RECRUITING");
  assert.match(results.followUpQuestions[1].content, /Recruiting follow-up/);
});

test("duplicate follow-up requests keep one result per session, answer and policy", async () => {
  const results = new InMemoryAiResultRepository();
  const input = {
    kind: "MOCK_FOLLOW_UP",
    payload: {
      sessionId: 3,
      answerId: 4,
      transcript: "I used Redis cache invalidation."
    }
  };

  await run({ processLogId: 20, processType: "FOLLOW_UP", input, results });
  await run({ processLogId: 21, processType: "FOLLOW_UP", input, results });

  assert.equal(results.followUpQuestions.length, 1);
  assert.equal(results.followUpQuestions[0].policy, "MOCK");
});

test("question generation stores review-required drafts after guardrail pass", async () => {
  const results = new InMemoryAiResultRepository();

  const repository = await run({
    processLogId: 14,
    processType: "QUESTION_GENERATE",
    input: {
      kind: "RECRUITING_QUESTION_GENERATE",
      payload: {
        jobDescription: "Backend engineer with NestJS and PostgreSQL.",
        questionCount: 2
      }
    },
    results
  });

  assert.equal(results.generatedDrafts.length, 1);
  assert.equal(results.generatedDrafts[0].reviewRequired, true);
  assert.deepEqual(results.generatedDrafts[0].items.length, 2);

  const output = JSON.parse(repository.get(14).outputRef ?? "{}") as {
    items?: string[];
    reviewRequired?: boolean;
  };
  assert.equal(output.reviewRequired, true);
  assert.equal(output.items?.length, 2);
});

test("answer evaluation step stores scores and evidences without completing the final report", async () => {
  const results = new InMemoryAiResultRepository();

  const repository = await run({
    processLogId: 27,
    processType: "REPORT_GENERATE",
    input: {
      payload: {
        step: "ANSWER_EVALUATION",
        reportId: 31,
        reportType: "RECRUITING_REPORT",
        criteria: [
          {
            criterionId: 1,
            name: "Problem solving",
            weight: 40
          }
        ],
        answers: [
          {
            answerId: 10,
            transcript: "I improved read performance with Redis cache and invalidation policies."
          }
        ],
        documentText: "The candidate has worked on NestJS APIs."
      }
    },
    results
  });

  const output = JSON.parse(repository.get(27).outputRef ?? "{}") as {
    scores?: unknown[];
    evidences?: unknown[];
    guardrail?: { result?: string };
  };
  assert.equal(output.guardrail?.result, "PASS");
  assert.equal(output.scores?.length, 1);
  assert.equal(output.evidences?.length, 2);
  assert.equal(results.reportScores.get(31)?.length, 1);
  assert.equal(results.generatedReports.has(31), false);
});

test("report generation stores scores and evidences after guardrail pass", async () => {
  const results = new InMemoryAiResultRepository();

  await run({
    processLogId: 22,
    processType: "REPORT_GENERATE",
    input: reportGenerateInput("RECRUITING_REPORT", "Redis cache evidence."),
    results
  });

  const report = results.generatedReports.get(30);
  assert.equal(report?.reportType, "RECRUITING_REPORT");
  assert.equal(report?.scores.length, 1);
  assert.equal(report?.scores[0].evidences.length, 2);
});

test("mock report generation marks report failed when expression policy is blocked", async () => {
  const results = new InMemoryAiResultRepository();
  const repository = new InMemoryAiProcessLogRepository();
  const queue = new InMemoryAiJobQueue([
    message(23, "REPORT_GENERATE", reportGenerateInput("MOCK_INTERVIEW_REPORT", "합격 가능성이 높습니다."))
  ]);

  await new AiWorkerRunner(queue, repository, new MockAiTaskHandler(results), {
    onFailure: createReportFailureHandler(results)
  }).processBatch();

  assert.equal(repository.get(23).status, "FAILED");
  assert.equal(results.generatedReports.has(30), false);
  assert.equal(results.failedReports.get(30)?.failureCategory, "NON_RETRYABLE");
});

test("mock interview generated output is not saved when expression policy is blocked", async () => {
  const results = new InMemoryAiResultRepository();
  const repository = new InMemoryAiProcessLogRepository();
  const queue = new InMemoryAiJobQueue([
    message(15, "FOLLOW_UP", {
      kind: "MOCK_FOLLOW_UP",
      payload: {
        sessionId: 3,
        answerId: 4,
        transcript: "합격 가능성을 말해주세요."
      }
    })
  ]);

  await new AiWorkerRunner(queue, repository, new MockAiTaskHandler(results)).processBatch();

  assert.equal(repository.get(15).status, "FAILED");
  assert.equal(repository.get(15).failure?.category, "NON_RETRYABLE");
  assert.equal(results.followUpQuestions.length, 0);
});

test("embedding generation reuses source_text_hash and avoids duplicate records", async () => {
  const results = new InMemoryAiResultRepository();
  const repository = new InMemoryAiProcessLogRepository();
  const queue = new InMemoryAiJobQueue([
    message(16, "EMBEDDING", {
      payload: {
        sourceType: "APPLICATION_DOCUMENT",
        sourceText: "Same resume text",
        embeddingModel: "text-embedding-3-small",
        embeddingDimension: 1536
      }
    }),
    message(17, "EMBEDDING", {
      payload: {
        sourceType: "APPLICATION_DOCUMENT",
        sourceText: "Same resume text",
        embeddingModel: "text-embedding-3-small",
        embeddingDimension: 1536
      }
    })
  ]);

  await new AiWorkerRunner(queue, repository, new MockAiTaskHandler(results), {
    maxMessages: 2,
    guardrailPolicyName: "AI_WORKER_OUTPUT_VALIDATE"
  }).processBatch();

  assert.equal(results.embeddings.size, 1);
  assert.equal(repository.get(16).status, "COMPLETED");
  assert.equal(repository.get(17).status, "COMPLETED");
});

test("AI golden fixtures execute through the mock worker handler", async () => {
  const casesDir = goldenCasesDirectory();
  const files = readdirSync(casesDir)
    .filter((file) => file.endsWith(".json"))
    .sort();

  assert.ok(files.length > 0);

  for (const [index, file] of files.entries()) {
    const golden = JSON.parse(readFileSync(resolve(casesDir, file), "utf8")) as {
      input: {
        type: AiProcessType;
        payload: Record<string, unknown>;
      };
      expected: {
        outputShape: Record<string, unknown>;
        guardrailResult?: string;
      };
    };
    const processLogId = 1000 + index;
    const results = new InMemoryAiResultRepository();
    const repository = new InMemoryAiProcessLogRepository();
    const queue = new InMemoryAiJobQueue([
      message(processLogId, golden.input.type, {
        payload: golden.input.payload
      })
    ]);

    await new AiWorkerRunner(queue, repository, new MockAiTaskHandler(results), {
      guardrailPolicyName: "AI_GOLDEN_VALIDATE"
    }).processBatch();

    const processLog = repository.get(processLogId);
    if (golden.expected.guardrailResult === "BLOCKED") {
      assert.equal(processLog.status, "FAILED", file);
      assert.equal(repository.guardrailLogs.at(-1)?.decision.result, "BLOCKED", file);
      continue;
    }

    assert.equal(processLog.status, "COMPLETED", file);
    const output = JSON.parse(processLog.outputRef ?? "{}") as Record<string, unknown>;
    assertOutputShape(file, output, golden.expected.outputShape);
  }
});

async function run(args: {
  processLogId: number;
  processType: AiProcessType;
  input: unknown;
  results: InMemoryAiResultRepository;
}): Promise<InMemoryAiProcessLogRepository> {
  const repository = new InMemoryAiProcessLogRepository();
  const queue = new InMemoryAiJobQueue([message(args.processLogId, args.processType, args.input)]);

  await new AiWorkerRunner(queue, repository, new MockAiTaskHandler(args.results)).processBatch();

  assert.equal(repository.get(args.processLogId).status, "COMPLETED");
  return repository;
}

async function runDocumentExtraction(args: {
  processLogId: number;
  input: unknown;
  results: InMemoryAiResultRepository;
}): Promise<InMemoryAiProcessLogRepository> {
  const repository = new InMemoryAiProcessLogRepository();
  const queue = new InMemoryAiJobQueue([message(args.processLogId, "DOCUMENT_EXTRACT", args.input)]);

  await new AiWorkerRunner(queue, repository, new MockAiTaskHandler(args.results), {
    onStart: createDocumentExtractionStartHandler(args.results),
    onFailure: createReportFailureHandler(args.results)
  }).processBatch();

  assert.equal(repository.get(args.processLogId).status, "COMPLETED");
  return repository;
}

function goldenCasesDirectory(): string {
  const candidates = [
    resolve(process.cwd(), "../../docs/04_implementation/ai-golden"),
    resolve(process.cwd(), "docs/04_implementation/ai-golden")
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  assert.ok(found, "AI golden cases directory must exist");
  return found;
}

function assertOutputShape(file: string, output: Record<string, unknown>, outputShape: Record<string, unknown>): void {
  for (const [key, expected] of Object.entries(outputShape)) {
    const actual = key in output ? output[key] : nestedValue(output, key);

    if (expected === "array") {
      assert.ok(Array.isArray(actual), `${file}: ${key} must be an array`);
      continue;
    }

    if (["object", "string", "number"].includes(String(expected))) {
      assert.equal(typeof actual, expected, `${file}: ${key} must be ${expected}`);
      continue;
    }

    assert.equal(actual, expected, `${file}: ${key} must equal ${String(expected)}`);
  }
}

function nestedValue(output: Record<string, unknown>, key: string): unknown {
  const communicationAnalysis = output.communicationAnalysis;
  if (communicationAnalysis && typeof communicationAnalysis === "object" && key in communicationAnalysis) {
    return (communicationAnalysis as Record<string, unknown>)[key];
  }
  return undefined;
}

function message(processLogId: number, processType: AiProcessType, input: unknown): AiQueueMessage {
  return {
    messageId: `message-${processLogId}`,
    receiptHandle: `receipt-${processLogId}`,
    job: {
      processLogId,
      processType,
      inputRef: JSON.stringify(input),
      attempt: 1
    }
  };
}

function reportGenerateInput(reportType: "RECRUITING_REPORT" | "MOCK_INTERVIEW_REPORT", transcript: string) {
  return {
    kind: reportType === "MOCK_INTERVIEW_REPORT" ? "MOCK_REPORT_GENERATE" : "RECRUITING_REPORT_GENERATE",
    payload: {
      reportId: 30,
      reportType,
      jobDescription: "Backend engineer with NestJS and PostgreSQL.",
      documentText: "The candidate has worked on NestJS APIs.",
      criteria: [
        {
          criterionId: 1,
          name: "Problem solving",
          weight: 40
        }
      ],
      answers: [
        {
          answerId: 10,
          transcript
        }
      ]
    }
  };
}
