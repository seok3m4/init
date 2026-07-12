import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireBuilt(relativePath) {
  const absolutePath = path.join(ROOT_DIR, relativePath);
  assert(fs.existsSync(absolutePath), "Missing build output: " + relativePath);
  return require(absolutePath);
}

const candidate = requireBuilt("backend/api/dist/src/modules/candidate/index.js");
const { InterviewController } = requireBuilt(
  "backend/api/dist/src/modules/interview/controller/interview.controller.js",
);
const { InMemoryInterviewRepository } = requireBuilt(
  "backend/api/dist/src/modules/interview/repository/in-memory-interview.repository.js",
);
const { InterviewService } = requireBuilt(
  "backend/api/dist/src/modules/interview/service/interview.service.js",
);
const { AiJobsStatusController } = requireBuilt(
  "backend/api/dist/src/modules/ai/controller/ai-jobs.controller.js",
);
const { InMemoryReportRepository } = requireBuilt(
  "backend/api/dist/src/modules/report/repository/in-memory-report.repository.js",
);
const { AiJobDispatcherService } = requireBuilt(
  "backend/api/dist/src/modules/report/service/ai-job-dispatcher.service.js",
);
const { InMemoryAiJobQueuePublisher } = requireBuilt(
  "backend/api/dist/src/modules/report/service/ai-job-queue.publisher.js",
);

const { InMemoryAiResultRepository } = requireBuilt(
  "backend/worker/dist/ai-result.repository.js",
);
const { MockAiTaskHandler } = requireBuilt(
  "backend/worker/dist/mock-ai-task.handler.js",
);
const { InMemoryAiProcessLogRepository } = requireBuilt(
  "backend/worker/dist/process-log.repository.js",
);
const { InMemoryAiJobQueue } = requireBuilt("backend/worker/dist/queue.js");
const { AiWorkerRunner } = requireBuilt("backend/worker/dist/worker-runner.js");

const currentUser = {
  ...candidate.DEV_CANDIDATE_USER,
  companyId: null,
};
const candidateRequest = {
  headers: {},
  currentUser,
};

function createApiRuntime() {
  const candidateService = new candidate.CandidateService(
    new candidate.InMemoryCandidateRepository(),
  );
  const interviewRepository = new InMemoryInterviewRepository();
  const reportRepository = new InMemoryReportRepository();
  const queuePublisher = new InMemoryAiJobQueuePublisher();
  const dispatcher = new AiJobDispatcherService(reportRepository, queuePublisher);
  const interviewService = new InterviewService(
    candidateService,
    interviewRepository,
    dispatcher,
  );

  return {
    interviewController: new InterviewController(interviewService),
    statusController: new AiJobsStatusController(reportRepository),
    reportRepository,
    queuePublisher,
  };
}

async function processQueuedEvaluation(runtime, handoff) {
  assert(runtime.queuePublisher.messages.length === 1, "API must publish one queue message");
  const queuedMessage = runtime.queuePublisher.messages[0];
  assert(queuedMessage.processLogId === handoff.data.processLogId, "processLogId mismatch");
  assert(queuedMessage.processType === "REPORT_GENERATE", "process type mismatch");

  const workerRepository = new InMemoryAiProcessLogRepository();
  const workerQueue = new InMemoryAiJobQueue([
    {
      messageId: "m3-e2e-" + queuedMessage.processLogId,
      receiptHandle: "receipt-" + queuedMessage.processLogId,
      job: queuedMessage,
    },
  ]);
  const worker = new AiWorkerRunner(
    workerQueue,
    workerRepository,
    new MockAiTaskHandler(new InMemoryAiResultRepository()),
    { guardrailPolicyName: "NCS_EVALUATION_PRODUCT_VALIDATE" },
  );
  await worker.processBatch();

  const workerProcess = workerRepository.get(queuedMessage.processLogId);
  assert(workerProcess.status === "COMPLETED", "worker must complete the NCS evaluation");
  assert(workerRepository.guardrailLogs.at(-1)?.decision.result === "PASS", "worker guardrail must pass");
  assert(workerProcess.outputRef, "worker outputRef is required");
  await runtime.reportRepository.markQueuedProcessCompleted(
    queuedMessage.processLogId,
    workerProcess.outputRef,
  );

  const polled = await runtime.statusController.getStatus(
    {
      headers: {},
      currentUser: {
        userId: currentUser.userId,
        userType: currentUser.userType,
        candidateId: currentUser.candidateId,
        companyId: null,
      },
    },
    String(queuedMessage.processLogId),
  );
  assert(polled.status === "COMPLETED", "polling status must be COMPLETED");
  assert(polled.output && typeof polled.output === "object", "validated polling output is required");

  return {
    output: polled.output,
    canonicalInput: JSON.parse(queuedMessage.inputRef),
  };
}

async function runTextInputFlow() {
  const runtime = createApiRuntime();
  const started = await runtime.interviewController.startMockInterview(
    candidateRequest,
    {
      questionTypes: ["TECHNICAL"],
      showQuestionText: true,
    },
  );
  const questions = await runtime.interviewController.listMockQuestions(
    candidateRequest,
    String(started.data.sessionId),
  );
  const questionId = questions.data.questions[0]?.questionId;
  assert(questionId, "technical question is required");

  const handoff = await runtime.interviewController.requestMockNcsEvaluation(
    candidateRequest,
    String(started.data.sessionId),
    {
      questionId,
      answerSource: "TEXT_INPUT",
      transcript:
        "실행 계획에서 풀스캔을 확인하고 복합 인덱스를 적용했습니다. 조회 빈도와 쓰기 비용을 비교해 선택했고 같은 부하에서 p95가 줄었는지 결과를 확인했습니다.",
    },
  );
  assert(handoff.data.queued === true, "TEXT_INPUT handoff must be queued");
  assert(handoff.data.answerId === undefined, "TEXT_INPUT must not expose answerId");
  return processQueuedEvaluation(runtime, handoff);
}

async function runStoredAnswerFlow() {
  const runtime = createApiRuntime();
  const started = await runtime.interviewController.startMockInterview(
    candidateRequest,
    {
      questionTypes: ["EXPERIENCE"],
      showQuestionText: true,
    },
  );
  const questions = await runtime.interviewController.listMockQuestions(
    candidateRequest,
    String(started.data.sessionId),
  );
  const questionId = questions.data.questions[0]?.questionId;
  assert(questionId, "experience question is required");
  const saved = await runtime.interviewController.saveMockAnswer(
    candidateRequest,
    String(started.data.sessionId),
    {
      questionId,
      audioFile: {
        storageKey: "candidate/1/m3-e2e-answer.webm",
        originalName: "m3-e2e-answer.webm",
        mimeType: "audio/webm",
        sizeBytes: 2048,
      },
      transcript:
        "새 도구가 필요했던 상황에서 공식 문서를 학습하고 테스트 환경에 직접 적용했습니다. 배포 오류 위험을 줄이기 위해 선택했고 오류율이 줄었는지 결과를 확인했습니다. 이후 체크리스트에 학습 내용을 반영했습니다.",
      durationSeconds: 40,
    },
  );

  const handoff = await runtime.interviewController.requestMockNcsEvaluation(
    candidateRequest,
    String(started.data.sessionId),
    {
      questionId,
      answerSource: "STORED_ANSWER",
      answerId: saved.data.answer.answerId,
    },
  );
  assert(handoff.data.queued === true, "STORED_ANSWER handoff must be queued");
  assert(
    handoff.data.answerId === saved.data.answer.answerId,
    "STORED_ANSWER answerId mismatch",
  );
  return processQueuedEvaluation(runtime, handoff);
}

function validateProductResult(run, sourceName) {
  const output = run.output;
  const payload = run.canonicalInput.payload;
  assert(output.contractVersion === "ncs-evaluation-product.v1", sourceName + " contract mismatch");
  assert(
    output.evaluationSnapshotVersion === payload.evaluationSnapshot.snapshotVersion,
    sourceName + " snapshot mismatch",
  );
  assert(output.sessionId === payload.sessionId, sourceName + " session mismatch");
  assert(output.questionId === payload.questionId, sourceName + " question mismatch");
  assert(output.metadata.strategyId === "evidence-state", sourceName + " strategy mismatch");
  assert(
    Object.values(output.guardrail).every((value) => value === false),
    sourceName + " guardrail must be clear",
  );
  for (const evidence of output.evidences) {
    assert(
      evidence.quote === payload.transcript.slice(evidence.startChar, evidence.endChar),
      sourceName + " evidence offset mismatch",
    );
  }
  for (const evaluation of output.behaviorEvaluations) {
    if (evaluation.level === null) {
      assert(evaluation.score === null, sourceName + " null level score mismatch");
    } else {
      const scoreMap = { 1: 25, 2: 50, 3: 70, 4: 85, 5: 100 };
      assert(
        evaluation.score === scoreMap[evaluation.level],
        sourceName + " fixed score map mismatch",
      );
    }
  }
}

function assertSameResultShape(textRun, storedRun) {
  const textKeys = Object.keys(textRun.output).filter((key) => key !== "answerId").sort();
  const storedKeys = Object.keys(storedRun.output).filter((key) => key !== "answerId").sort();
  assert(
    JSON.stringify(textKeys) === JSON.stringify(storedKeys),
    "TEXT_INPUT and STORED_ANSWER output keys must match",
  );
  for (const key of [
    "evidences",
    "behaviorEvaluations",
    "coverage",
    "followUp",
    "guardrail",
    "metadata",
  ]) {
    assert(
      typeof textRun.output[key] === typeof storedRun.output[key],
      "output field type mismatch: " + key,
    );
  }
}

async function main() {
  const textRun = await runTextInputFlow();
  const storedRun = await runStoredAnswerFlow();
  validateProductResult(textRun, "TEXT_INPUT");
  validateProductResult(storedRun, "STORED_ANSWER");
  assert(textRun.output.answerId === undefined, "TEXT_INPUT output must omit answerId");
  assert(
    storedRun.output.answerId === storedRun.canonicalInput.payload.answerId,
    "STORED_ANSWER output must preserve answerId",
  );
  assertSameResultShape(textRun, storedRun);

  console.log("[ok] TEXT_INPUT API -> worker -> polling flow");
  console.log("[ok] STORED_ANSWER API -> worker -> polling flow");
  console.log("[ok] both sources converge on ncs-evaluation-product.v1");
  console.log("[ok] verify-ncs-evaluation-m3 passed");
}

main().catch((error) => {
  console.error("[fail] " + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
