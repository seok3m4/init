import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requireDb = process.argv.includes("--require-db");
const databaseUrl = process.env.NCS_E2E_DATABASE_URL;
if (!databaseUrl) {
  if (requireDb) {
    throw new Error("NCS_E2E_DATABASE_URL is required");
  }
  console.log("[skip] NCS_E2E_DATABASE_URL is not set");
  process.exit(0);
}

const parsedUrl = new URL(databaseUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);
if (!localHosts.has(parsedUrl.hostname) && process.env.NCS_E2E_ALLOW_NONLOCAL !== "1") {
  throw new Error("NCS DB E2E accepts only a local database unless NCS_E2E_ALLOW_NONLOCAL=1");
}

process.env.DATABASE_URL = databaseUrl;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiDist = resolve(root, "backend", "api", "dist", "src");
const workerDist = resolve(root, "backend", "worker", "dist");
for (const requiredPath of [apiDist, workerDist]) {
  if (!existsSync(requiredPath)) {
    throw new Error(`Build output not found: ${requiredPath}`);
  }
}

const apiRequire = createRequire(resolve(root, "backend", "api", "package.json"));
const requireFromRoot = createRequire(import.meta.url);
const { PrismaClient } = apiRequire("@prisma/client");
const { PrismaReportRepository } = requireFromRoot(
  resolve(apiDist, "modules", "report", "repository", "prisma-report.repository.js"),
);
const { PrismaCandidateReportRepository } = requireFromRoot(
  resolve(apiDist, "modules", "report", "repository", "prisma-candidate-report.repository.js"),
);
const { PrismaInterviewRepository } = requireFromRoot(
  resolve(apiDist, "modules", "interview", "repository", "prisma-interview.repository.js"),
);
const { AiJobDispatcherService } = requireFromRoot(
  resolve(apiDist, "modules", "report", "service", "ai-job-dispatcher.service.js"),
);
const { PrismaAiProcessLogRepository } = requireFromRoot(resolve(workerDist, "prisma-process-log.repository.js"));
const { PrismaAiResultRepository } = requireFromRoot(resolve(workerDist, "prisma-ai-result.repository.js"));
const { MockAiTaskHandler } = requireFromRoot(resolve(workerDist, "mock-ai-task.handler.js"));
const { InMemoryAiJobQueue } = requireFromRoot(resolve(workerDist, "queue.js"));
const { AiWorkerRunner } = requireFromRoot(resolve(workerDist, "worker-runner.js"));

const prisma = new PrismaClient();
const baseId = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
const ids = {
  companyUser: baseId + 1n,
  candidateUser: baseId + 2n,
  company: baseId + 3n,
  candidate: baseId + 4n,
  question: baseId + 5n,
  session: baseId + 6n,
  answer: baseId + 7n,
};
let processLogId;

try {
  await createFixture(prisma, ids);
  const transcript =
    "실행 계획에서 풀스캔을 확인하고 복합 인덱스를 적용했습니다. 조회 빈도와 쓰기 비용을 비교했고 같은 부하에서 p95가 줄었는지 결과를 확인했습니다.";
  const payload = productPayload(ids, transcript);
  const interviewRepository = new PrismaInterviewRepository(prisma);
  const persistedSnapshot = await interviewRepository.findNcsEvaluationSnapshot(Number(ids.session), Number(ids.question));
  assert.ok(persistedSnapshot);
  assert.equal(persistedSnapshot.jobRole, "백엔드 개발자");
  const replacementSnapshot = structuredClone(payload.evaluationSnapshot);
  replacementSnapshot.jobRole = "보안 엔지니어";
  replacementSnapshot.snapshotVersion = "ncs-db-e2e-tampered-replacement";
  const reservedSnapshot = await interviewRepository.reserveNcsEvaluationSnapshot(
    Number(ids.session),
    Number(ids.question),
    replacementSnapshot,
  );
  assert.equal(reservedSnapshot.snapshotVersion, "ncs-db-e2e-snapshot-v2");
  assert.equal(reservedSnapshot.jobRole, "백엔드 개발자");
  const idempotencyKey = `ncs-e2e:${ids.session}:${ids.answer}:snapshot-v2`;
  const messages = [];
  const dispatcher = new AiJobDispatcherService(new PrismaReportRepository(prisma), {
    async publish(message) {
      messages.push(message);
    },
  });
  const command = {
    processType: "REPORT_GENERATE",
    input: {
      kind: "MOCK_NCS_ANSWER_EVALUATION",
      deduplicationKey: idempotencyKey,
      payload,
    },
    refs: { sessionId: Number(ids.session) },
    idempotencyKey,
  };

  const first = await dispatcher.dispatch(command);
  processLogId = first.processLogId;
  const duplicate = await dispatcher.dispatch(command);
  assert.equal(duplicate.processLogId, first.processLogId);
  assert.equal(duplicate.deduplicated, true);
  assert.equal(messages.length, 1);

  const workerMessage = toWorkerMessage(messages[0], "ncs-db-e2e-first");
  const processLogs = new PrismaAiProcessLogRepository(prisma);
  const results = new PrismaAiResultRepository(prisma);
  const firstQueue = new InMemoryAiJobQueue([workerMessage]);
  await new AiWorkerRunner(firstQueue, processLogs, new MockAiTaskHandler(results), {
    guardrailPolicyName: "NCS_DB_E2E_VALIDATE",
  }).processBatch();

  const completed = await prisma.aiProcessLog.findUniqueOrThrow({
    where: { processLogId: BigInt(processLogId) },
  });
  assert.equal(completed.status, "COMPLETED");
  const revision = await prisma.ncsEvaluationRevision.findUniqueOrThrow({
    where: { processLogId: BigInt(processLogId) },
  });
  assert.equal(revision.sessionId, ids.session);
  assert.equal(revision.questionId, ids.question);
  assert.equal(revision.answerId, ids.answer);
  assert.equal(revision.snapshotVersion, "ncs-db-e2e-snapshot-v2");
  assert.equal(JSON.parse(revision.outputJson).evaluationBasis.jobRole, "백엔드 개발자");

  const revisionProcesses = await new PrismaCandidateReportRepository(prisma)
    .listNcsEvaluationRevisionProcessesBySession(Number(ids.session));
  assert.equal(revisionProcesses.length, 1);
  assert.equal(JSON.parse(revisionProcesses[0].outputRef).contractVersion, "ncs-evaluation-product.v1");

  const redeliveryQueue = new InMemoryAiJobQueue([toWorkerMessage(messages[0], "ncs-db-e2e-redelivery")]);
  await new AiWorkerRunner(redeliveryQueue, processLogs, new MockAiTaskHandler(results), {
    guardrailPolicyName: "NCS_DB_E2E_VALIDATE",
  }).processBatch();
  assert.equal(redeliveryQueue.deletedMessageIds.length, 1);
  assert.equal(await prisma.ncsEvaluationRevision.count({ where: { processLogId: BigInt(processLogId) } }), 1);

  const completedDuplicate = await dispatcher.dispatch(command);
  assert.equal(completedDuplicate.processLogId, processLogId);
  assert.equal(completedDuplicate.status, "COMPLETED");
  assert.equal(completedDuplicate.queued, false);
  assert.equal(messages.length, 1);

  console.log(`[ok] NCS DB E2E passed: processLogId=${processLogId}, revisionId=${revision.revisionId}`);
} finally {
  await cleanup(prisma, ids, processLogId);
  await prisma.$disconnect();
}

async function createFixture(client, fixture) {
  const suffix = String(fixture.company).slice(-10);
  await client.user.createMany({
    data: [
      {
        userId: fixture.companyUser,
        email: `ncs-e2e-company-${fixture.companyUser}@example.test`,
        userType: "COMPANY",
        name: "NCS E2E Company",
        status: "ACTIVE",
        authProvider: "LOCAL",
      },
      {
        userId: fixture.candidateUser,
        email: `ncs-e2e-candidate-${fixture.candidateUser}@example.test`,
        userType: "CANDIDATE",
        name: "NCS E2E Candidate",
        status: "ACTIVE",
        authProvider: "LOCAL",
      },
    ],
  });
  await client.company.create({
    data: {
      companyId: fixture.company,
      ownerUserId: fixture.companyUser,
      name: "NCS E2E Company",
      businessRegistrationNumber: suffix.padStart(10, "0"),
      verificationStatus: "VERIFIED",
    },
  });
  await client.candidateProfile.create({
    data: { candidateId: fixture.candidate, userId: fixture.candidateUser },
  });
  await client.question.create({
    data: {
      questionId: fixture.question,
      companyId: fixture.company,
      questionType: "TECHNICAL",
      content: "기술 대안을 비교하고 검증한 경험을 설명해 주세요.",
      isActive: true,
    },
  });
  await client.interviewSession.create({
    data: {
      sessionId: fixture.session,
      candidateId: fixture.candidate,
      interviewType: "MOCK",
      status: "IN_PROGRESS",
      showQuestionText: true,
      startedAt: new Date(),
    },
  });
  const snapshot = productPayload(
    fixture,
    "실행 계획에서 풀스캔을 확인하고 복합 인덱스를 적용했습니다. 조회 빈도와 쓰기 비용을 비교했고 같은 부하에서 p95가 줄었는지 결과를 확인했습니다.",
  ).evaluationSnapshot;
  await client.ncsEvaluationSnapshot.create({
    data: {
      sessionId: fixture.session,
      questionId: fixture.question,
      contractVersion: snapshot.contractVersion,
      snapshotVersion: snapshot.snapshotVersion,
      jobRole: snapshot.jobRole,
      snapshotJson: snapshot,
    },
  });
  await client.interviewAnswer.create({
    data: {
      answerId: fixture.answer,
      sessionId: fixture.session,
      questionId: fixture.question,
      transcript:
        "실행 계획에서 풀스캔을 확인하고 복합 인덱스를 적용했습니다. 조회 빈도와 쓰기 비용을 비교했고 같은 부하에서 p95가 줄었는지 결과를 확인했습니다.",
      durationSeconds: 30,
      submittedAt: new Date(),
    },
  });
}

function productPayload(fixture, transcript) {
  return {
    step: "NCS_ANSWER_EVALUATION",
    sessionId: Number(fixture.session),
    questionId: Number(fixture.question),
    answerId: Number(fixture.answer),
    transcript,
    evaluationSnapshot: {
      contractVersion: "ncs-evaluation-product.v1",
      snapshotVersion: "ncs-db-e2e-snapshot-v2",
      locale: "ko-KR",
      jobRole: "백엔드 개발자",
      question: {
        questionId: String(fixture.question),
        questionType: "EXPERIENCE",
        content: "기술 대안을 비교하고 검증한 경험을 설명해 주세요.",
      },
      ncsContext: {
        sourceKind: "SYNTHETIC_NCS_LIKE",
        version: "ncs-db-e2e-v1",
        categoryType: "JOB_PERFORMANCE",
        unit: {
          code: "NCS-DB-E2E",
          name: "기술 의사결정",
          level: null,
          definition: "제약과 대안을 비교하고 적용 결과를 검증한다.",
          elements: [{ elementCode: "NCS-DB-E2E-E1", name: "대안 비교와 검증" }],
        },
      },
      behaviorPoints: [
        {
          behaviorPointId: "ncs-db-e2e-bp-1",
          description: "기술 대안을 비교하고 선택 근거, 실행 행동과 검증 결과를 연결한다.",
          sourceElementCodes: ["NCS-DB-E2E-E1"],
          observability: "INTERVIEW",
          requiredEvidence: ["ACTION", "RATIONALE", "RESULT", "TRADEOFF"],
        },
      ],
      evaluationPolicy: {
        scoreMap: { "1": 25, "2": 50, "3": 70, "4": 85, "5": 100 },
        minimumSupportingEvidence: 1,
        insufficientEvidenceScore: null,
        allowSensitiveAttributes: false,
        allowNonverbalScore: false,
      },
    },
  };
}

function toWorkerMessage(message, messageId) {
  return {
    messageId,
    receiptHandle: `receipt-${messageId}`,
    job: {
      processLogId: message.processLogId,
      processType: message.processType,
      inputRef: message.inputRef,
      attempt: message.attempt,
    },
  };
}

async function cleanup(client, fixture, currentProcessLogId) {
  if (currentProcessLogId !== undefined) {
    const processId = BigInt(currentProcessLogId);
    await client.ncsEvaluationRevision.deleteMany({ where: { processLogId: processId } });
    await client.aiGuardrailLog.deleteMany({ where: { processLogId: processId } });
    await client.aiProcessLog.deleteMany({ where: { processLogId: processId } });
  }
  await client.interviewAnswer.deleteMany({ where: { answerId: fixture.answer } });
  await client.interviewSession.deleteMany({ where: { sessionId: fixture.session } });
  await client.question.deleteMany({ where: { questionId: fixture.question } });
  await client.candidateProfile.deleteMany({ where: { candidateId: fixture.candidate } });
  await client.company.deleteMany({ where: { companyId: fixture.company } });
  await client.user.deleteMany({ where: { userId: { in: [fixture.companyUser, fixture.candidateUser] } } });
}
