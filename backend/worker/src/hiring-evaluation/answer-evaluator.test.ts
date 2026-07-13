import test from "node:test";
import assert from "node:assert/strict";
import { generateTalentRubricSnapshot } from "../talent-rubric";
import { InMemoryAiResultRepository } from "../ai-result.repository";
import { MockAiTaskHandler } from "../mock-ai-task.handler";
import { HiringAnswerEvaluator } from "./answer-evaluator";
import { createHiringEvaluationContextHash, validateHiringEvaluationContext } from "./context";
import {
  HIRING_ANSWER_EVALUATION_CONTRACT_VERSION,
  HIRING_CALCULATION_CONTRACT_VERSION,
  HIRING_EVALUATION_CONTEXT_VERSION,
  type HiringAnswerEvaluationInput,
  type HiringEvaluationContextHashInput,
  type HiringEvaluationContextSnapshot,
} from "./types";

test("고정 context의 NCS와 인재상 트랙을 독립 평가하고 실제 발화 offset을 보존한다", () => {
  const input = evaluationInput([primaryTurn(detailedAnswer())]);
  const output = new HiringAnswerEvaluator().evaluate(input);

  assert.equal(output.contextVersion, input.context.contextVersion);
  assert.notEqual(output.jobEvaluation.behaviorEvaluations[0]?.score, null);
  assert.ok(output.talentEvaluation.criterionEvaluations.some((evaluation) => evaluation.score !== null));
  assert.equal(output.jobEvaluation.followUp.required, false);
  assert.equal(output.transcriptTurns.length, 1);
  for (const evidence of output.talentEvaluation.evidences) {
    assert.equal(evidence.quote, detailedAnswer().slice(evidence.startChar, evidence.endChar));
    assert.equal(evidence.turnId, "turn-primary");
  }
});

test("필수 근거가 같아도 한 문장 압축 답변과 구체적 다문장 답변은 같은 anchor를 받지 않는다", () => {
  const evaluator = new HiringAnswerEvaluator();
  const compact = evaluator.evaluate(evaluationInput([primaryTurn(compactAnswer())]));
  const detailed = evaluator.evaluate(evaluationInput([primaryTurn(detailedAnswer())]));
  const compactResponsibility = compact.talentEvaluation.criterionEvaluations.find(
    (evaluation) => evaluation.criterionName === "책임감",
  );
  const detailedResponsibility = detailed.talentEvaluation.criterionEvaluations.find(
    (evaluation) => evaluation.criterionName === "책임감",
  );

  assert.deepEqual(compactResponsibility?.missingEvidence, []);
  assert.deepEqual(detailedResponsibility?.missingEvidence, []);
  assert.ok((compactResponsibility?.score ?? 0) < (detailedResponsibility?.score ?? 0));
  assert.equal(compactResponsibility?.level, 2);
  assert.equal(detailedResponsibility?.level, 5);
});

test("백엔드 context에 프론트엔드 답변을 넣으면 직무 점수를 만들지 않는다", () => {
  const output = new HiringAnswerEvaluator().evaluate(evaluationInput([
    primaryTurn(
      "React 컴포넌트 렌더링 방식을 비교해 서버 컴포넌트를 적용했습니다. 번들 크기와 LCP를 측정해 사용자 화면이 빨라진 것을 확인했습니다.",
    ),
  ]));

  assert.equal(output.jobEvaluation.behaviorEvaluations[0]?.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(output.jobEvaluation.behaviorEvaluations[0]?.score, null);
  assert.equal(output.jobEvaluation.evidences.length, 0);
  assert.ok(output.talentEvaluation.criterionEvaluations.every((evaluation) => evaluation.score === null));
});

test("꼬리질문 한도를 소진한 revision은 근거가 부족해도 추가 질문을 만들지 않는다", () => {
  const output = new HiringAnswerEvaluator().evaluate(evaluationInput([
    primaryTurn("팀과 API 오류 로그를 공유하고 원인을 분석했습니다."),
    {
      turnId: "turn-follow-up-1",
      answerId: 702,
      kind: "FOLLOW_UP",
      transcript: "결과는 아직 확인하지 못했습니다.",
    },
  ]));

  assert.equal(output.jobEvaluation.followUp.required, false);
  assert.equal(output.talentEvaluation.followUp.required, false);
  assert.equal(output.transcriptTurns.length, 2);
  assert.equal(output.transcriptTurns[1]?.startChar, output.transcriptTurns[0]!.endChar + 1);
});

test("context 내용이나 질문 identity가 변조되면 평가 전에 거부한다", () => {
  const context = hiringContext();
  const tamperedPolicy = {
    ...context,
    policy: {
      ...context.policy,
      administratorInput: {
        ...context.policy.administratorInput,
        jobWeightPercent: 70,
        talentWeightPercent: 30,
      },
    },
  };
  assert.throws(() => validateHiringEvaluationContext(tamperedPolicy), /context\.contextHash/u);

  const input = evaluationInput([primaryTurn(detailedAnswer())]);
  assert.throws(
    () => new HiringAnswerEvaluator().evaluate({ ...input, questionId: 999 }),
    /input\.questionId/u,
  );
});

test("worker handler는 이중 평가 output을 불변 revision으로 저장한다", async () => {
  const results = new InMemoryAiResultRepository();
  const handler = new MockAiTaskHandler(results);
  const input = evaluationInput([primaryTurn(detailedAnswer())]);
  const result = await handler.handle({
    processLogId: 9901,
    processType: "REPORT_GENERATE",
    inputRef: JSON.stringify({
      kind: "HIRING_ANSWER_EVALUATION",
      payload: { step: "HIRING_ANSWER_EVALUATION", ...input },
    }),
    attempt: 1,
  });

  assert.equal(result.guardrail?.result, "PASS");
  await result.finalSave?.();
  const revision = results.hiringAnswerEvaluationRevisions.get(9901);
  assert.equal(revision?.cohortId, 41);
  assert.equal(revision?.candidateId, 301);
  assert.equal(revision?.contextVersion, input.context.contextVersion);
  assert.match(revision?.answerRevisionHash ?? "", /^sha256:[0-9a-f]{64}$/u);
});

function evaluationInput(
  turns: HiringAnswerEvaluationInput["turns"],
): HiringAnswerEvaluationInput {
  return {
    contractVersion: HIRING_ANSWER_EVALUATION_CONTRACT_VERSION,
    context: hiringContext(),
    candidateId: 301,
    sessionId: 101,
    questionId: 501,
    followUpsUsed: turns.length - 1,
    turns,
  };
}

function primaryTurn(transcript: string) {
  return {
    turnId: "turn-primary",
    answerId: 701,
    kind: "PRIMARY" as const,
    transcript,
  };
}

function compactAnswer(): string {
  return "팀과 대안을 비교한 이유는 데이터 정합성 위험 때문이어서 제가 복합 인덱스를 적용했고, 결과를 확인한 뒤 회고에서 다음 배포 체크리스트에 반영했습니다.";
}

function detailedAnswer(): string {
  return [
    "배포 전 API 응답 지연 문제가 발생했고 제가 원인 분석을 맡았습니다.",
    "팀과 로그를 공유하고 캐시와 인덱스 대안을 비교한 뒤 데이터 정합성 위험 때문에 복합 인덱스를 적용했습니다.",
    "p95 응답 시간이 800ms에서 220ms로 줄었는지 대시보드로 결과를 확인했습니다.",
    "회고에서 쿼리 검증을 다음 배포 체크리스트에 반영했습니다.",
  ].join(" ");
}

function hiringContext(): HiringEvaluationContextSnapshot {
  const talentRubric = generateTalentRubricSnapshot([
    { name: "협업", description: "서로 다른 의견을 조율해 공동 결과를 만든다.", weight: 1 },
    { name: "책임감", description: "맡은 일을 끝까지 수행하고 결과를 확인한다.", weight: 1 },
  ]);
  const hashInput: HiringEvaluationContextHashInput = {
    schemaVersion: HIRING_EVALUATION_CONTEXT_VERSION,
    calculationContractVersion: HIRING_CALCULATION_CONTRACT_VERSION,
    cohort: {
      cohortId: 41,
      companyId: 1,
      postingId: 11,
      configurationHash: `sha256:${"1".repeat(64)}`,
    },
    sourceConfiguration: {
      policyId: 21,
      policyVersion: "hiring-policy-v1-test",
      questionSetSnapshotId: 31,
      questionSetSnapshotVersion: "hiring-question-set-configuration-v1-test",
    },
    policy: {
      schemaVersion: "hiring-evaluation-policy.v1",
      administratorInput: {
        postingId: 11,
        decisionMode: "HYBRID",
        jobWeightPercent: 60,
        talentWeightPercent: 40,
        minimumJobScore: 65,
        minimumTalentScore: 60,
        minimumEvidenceCoveragePercent: 80,
      },
      tieBreakOrder: [
        { field: "WEIGHTED_TOTAL_SCORE", direction: "DESC" },
        { field: "PRIMARY_TRACK_SCORE", direction: "DESC", track: "JOB" },
        { field: "EVIDENCE_COVERAGE_PERCENT", direction: "DESC" },
      ],
    },
    questionSet: {
      sourceQuestionSetId: 12,
      jobRole: "백엔드 개발자",
      mode: "CUSTOM",
      questionCount: 1,
      maxFollowUpCount: 1,
      questions: [{
        questionId: 501,
        order: 1,
        questionType: "TECHNICAL",
        content: "백엔드 기술 대안을 비교하고 선택했던 경험을 설명해 주세요.",
        criterionId: 91,
        ncsEvaluationSnapshot: {
          contractVersion: "ncs-evaluation-product.v1",
          snapshotVersion: "hiring-ncs-context-v1:test",
          locale: "ko-KR",
          jobRole: "백엔드 개발자",
          question: {
            questionId: "501",
            questionType: "EXPERIENCE",
            content: "백엔드 기술 대안을 비교하고 선택했던 경험을 설명해 주세요.",
          },
          ncsContext: {
            sourceKind: "SYNTHETIC_NCS_LIKE",
            version: "service-ncs-starter-v2",
            categoryType: "JOB_PERFORMANCE",
            unit: {
              code: "SERVICE-JOB-BACKEND-TECHNICAL-DECISION",
              name: "백엔드 개발자 - 기술 의사결정",
              level: null,
              definition: "API, 데이터와 서버 운영의 제약에서 기술 대안을 비교하고 결과를 검증하는 능력",
              elements: [{
                elementCode: "SERVICE-JOB-BACKEND-TECHNICAL-DECISION-01",
                name: "대안 비교와 결과 검증",
              }],
            },
          },
          behaviorPoints: [{
            behaviorPointId: "backend-technical-decision-bp-01",
            description: "API, 데이터와 서버 운영의 제약과 대안을 구분하고 선택 근거, 실행 행동과 검증 결과를 연결해 설명한다.",
            sourceElementCodes: ["SERVICE-JOB-BACKEND-TECHNICAL-DECISION-01"],
            observability: "INTERVIEW",
            requiredEvidence: ["ACTION", "RATIONALE", "RESULT", "TRADEOFF"],
          }],
          evaluationPolicy: {
            scoreMap: { "1": 25, "2": 50, "3": 70, "4": 85, "5": 100 },
            minimumSupportingEvidence: 1,
            insufficientEvidenceScore: null,
            allowSensitiveAttributes: false,
            allowNonverbalScore: false,
          },
        },
      }],
    },
    talentRubric,
  };
  return {
    ...hashInput,
    contextVersion: "hiring-evaluation-context-v1-test",
    contextHash: createHiringEvaluationContextHash(hashInput),
  };
}
