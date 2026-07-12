import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryAiResultRepository } from "../ai-result.repository";
import { MockAiTaskHandler } from "../mock-ai-task.handler";
import { InMemoryAiProcessLogRepository } from "../process-log.repository";
import { InMemoryAiJobQueue } from "../queue";
import { AiWorkerRunner } from "../worker-runner";
import type { AiQueueMessage } from "../worker.types";
import {
  ncsEvaluationGuardrailDecision,
  ProductEvidenceStateNcsEvaluationAdapter,
} from "./product-evidence-state.adapter";

test("제품 payload를 evidence-state 결과 계약으로 변환한다", () => {
  const adapter = new ProductEvidenceStateNcsEvaluationAdapter();
  const payload = productPayload();
  const output = adapter.evaluate(payload);

  assert.equal(output.contractVersion, "ncs-evaluation-product.v1");
  assert.equal(output.evaluationSnapshotVersion, "service-ncs-starter-v1:test");
  assert.equal(output.sessionId, 101);
  assert.equal(output.questionId, 501);
  assert.equal(output.answerId, 701);
  assert.equal(output.metadata.strategyId, "evidence-state");
  assert.equal(output.metadata.strategyVersion, "evidence-state-rules-v1");
  assert.equal(output.metadata.model, "deterministic-evidence-state-v1");
  assert.equal(output.behaviorEvaluations.length, 1);
  assert.equal(output.behaviorEvaluations[0]?.level, 4);
  assert.equal(output.behaviorEvaluations[0]?.score, 85);
  assert.equal(output.followUp.required, false);
  assert.deepEqual(ncsEvaluationGuardrailDecision(output), { result: "PASS", reason: null });
  for (const evidence of output.evidences) {
    assert.equal(evidence.quote, payload.transcript.slice(evidence.startChar, evidence.endChar));
  }
});

test("근거 부족은 null 점수와 꼬리질문으로 반환한다", () => {
  const adapter = new ProductEvidenceStateNcsEvaluationAdapter();
  const output = adapter.evaluate(productPayload({ transcript: "잘 모르겠습니다.", answerId: undefined }));
  const evaluation = output.behaviorEvaluations[0];

  assert.equal(output.answerId, undefined);
  assert.equal(evaluation?.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(evaluation?.level, null);
  assert.equal(evaluation?.score, null);
  assert.equal(output.coverage.status, "INSUFFICIENT");
  assert.equal(output.followUp.required, true);
  assert.ok(output.followUp.suggestedQuestion);
});

test("follow-up 질문에서는 추가 꼬리질문 생성을 중단한다", () => {
  const adapter = new ProductEvidenceStateNcsEvaluationAdapter();
  const payload = productPayload({ transcript: "잘 모르겠습니다.", answerId: undefined });
  payload.evaluationSnapshot.question.questionType = "FOLLOW_UP";
  const output = adapter.evaluate(payload);

  assert.equal(output.behaviorEvaluations[0]?.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(output.followUp.required, false);
  assert.equal(output.followUp.suggestedQuestion, null);
});

test("고정 점수표와 질문 identity가 변조된 snapshot을 거부한다", () => {
  const adapter = new ProductEvidenceStateNcsEvaluationAdapter();
  const tamperedScoreMap = productPayload();
  tamperedScoreMap.evaluationSnapshot.evaluationPolicy.scoreMap["4"] = 90;
  assert.throws(
    () => adapter.evaluate(tamperedScoreMap),
    /payload\.evaluationSnapshot\.evaluationPolicy\.scoreMap\.4/,
  );

  const mismatchedQuestion = productPayload();
  mismatchedQuestion.evaluationSnapshot.question.questionId = "999";
  assert.throws(
    () => adapter.evaluate(mismatchedQuestion),
    /payload\.evaluationSnapshot\.question\.questionId/,
  );
});

test("worker runner가 제품 평가 output과 PASS guardrail을 저장한다", async () => {
  const repository = await runWorker(productPayload(), 801);
  const process = repository.get(801);
  const output = JSON.parse(process.outputRef ?? "{}") as {
    contractVersion?: string;
    metadata?: { strategyId?: string };
  };

  assert.equal(process.status, "COMPLETED");
  assert.equal(output.contractVersion, "ncs-evaluation-product.v1");
  assert.equal(output.metadata?.strategyId, "evidence-state");
  assert.equal(repository.guardrailLogs.at(-1)?.decision.result, "PASS");
});

test("평가 근거 quote에 민감·비언어 신호가 섞이면 완료를 차단한다", async () => {
  const transcript =
    "저는 여성 지원자이고 시선을 유지하면서 실행 계획의 풀스캔을 확인하고 복합 인덱스를 적용했습니다. 조회 빈도와 쓰기 비용을 비교했고 p95가 줄었는지 결과를 확인했습니다.";
  const repository = await runWorker(productPayload({ transcript }), 802);
  const process = repository.get(802);

  assert.equal(process.status, "FAILED");
  assert.equal(process.failure?.category, "NON_RETRYABLE");
  assert.equal(repository.guardrailLogs.at(-1)?.decision.result, "BLOCKED");
  assert.match(repository.guardrailLogs.at(-1)?.decision.reason ?? "", /sensitive attribute/);
  assert.match(repository.guardrailLogs.at(-1)?.decision.reason ?? "", /nonverbal signal/);
});

test("NCS step에 다른 queue kind를 사용하면 non-retryable로 실패한다", async () => {
  const repository = await runWorker(productPayload(), 803, "RECRUITING_REPORT_GENERATE");

  assert.equal(repository.get(803).status, "FAILED");
  assert.equal(repository.get(803).failure?.category, "NON_RETRYABLE");
  assert.match(repository.get(803).failure?.reason ?? "", /MOCK_NCS_ANSWER_EVALUATION/);
});

async function runWorker(
  payload: ReturnType<typeof productPayload>,
  processLogId: number,
  kind = "MOCK_NCS_ANSWER_EVALUATION",
): Promise<InMemoryAiProcessLogRepository> {
  const repository = new InMemoryAiProcessLogRepository();
  const queue = new InMemoryAiJobQueue([
    message(processLogId, {
      kind,
      payload,
    }),
  ]);
  const handler = new MockAiTaskHandler(new InMemoryAiResultRepository());

  await new AiWorkerRunner(queue, repository, handler, {
    guardrailPolicyName: "NCS_EVALUATION_PRODUCT_VALIDATE",
  }).processBatch();
  return repository;
}

function message(processLogId: number, input: unknown): AiQueueMessage {
  return {
    messageId: "message-" + processLogId,
    receiptHandle: "receipt-" + processLogId,
    job: {
      processLogId,
      processType: "REPORT_GENERATE",
      inputRef: JSON.stringify(input),
      attempt: 1,
    },
  };
}

function productPayload(
  overrides: {
    transcript?: string;
    answerId?: number;
  } = {},
) {
  const transcript =
    overrides.transcript ??
    "실행 계획에서 풀스캔을 확인하고 복합 인덱스를 적용했습니다. 조회 빈도와 쓰기 비용을 비교해 선택했고 같은 부하에서 p95가 줄었는지 결과를 확인했습니다.";
  return {
    step: "NCS_ANSWER_EVALUATION",
    sessionId: 101,
    questionId: 501,
    ...(overrides.answerId !== undefined || !Object.hasOwn(overrides, "answerId")
      ? { answerId: overrides.answerId ?? 701 }
      : {}),
    transcript,
    evaluationSnapshot: {
      contractVersion: "ncs-evaluation-product.v1",
      snapshotVersion: "service-ncs-starter-v1:test",
      locale: "ko-KR",
      question: {
        questionId: "501",
        questionType: "EXPERIENCE" as "EXPERIENCE" | "SITUATION" | "FOLLOW_UP",
        content: "기술 대안을 비교하고 선택한 경험을 설명해 주세요.",
      },
      ncsContext: {
        sourceKind: "SYNTHETIC_NCS_LIKE",
        version: "service-ncs-starter-v1",
        categoryType: "JOB_PERFORMANCE",
        unit: {
          code: "SERVICE-JOB-TECHNICAL-DECISION",
          name: "기술 의사결정",
          level: null,
          definition: "주어진 제약에서 기술 대안을 비교하고 근거와 검증 결과를 설명하는 능력",
          elements: [
            {
              elementCode: "SERVICE-JOB-TECHNICAL-DECISION-01",
              name: "대안 비교와 결과 검증",
            },
          ],
        },
      },
      behaviorPoints: [
        {
          behaviorPointId: "technical-decision-bp-01",
          description: "기술적 제약과 대안을 구분하고 선택 근거, 실행 행동, 검증 결과를 연결해 설명한다.",
          sourceElementCodes: ["SERVICE-JOB-TECHNICAL-DECISION-01"],
          observability: "INTERVIEW",
          requiredEvidence: ["ACTION", "RATIONALE", "RESULT", "TRADEOFF"],
        },
      ],
      evaluationPolicy: {
        scoreMap: {
          "1": 25,
          "2": 50,
          "3": 70,
          "4": 85,
          "5": 100,
        },
        minimumSupportingEvidence: 1,
        insufficientEvidenceScore: null,
        allowSensitiveAttributes: false,
        allowNonverbalScore: false,
      },
    },
  };
}
