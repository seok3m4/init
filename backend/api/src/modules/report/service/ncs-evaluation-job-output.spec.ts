import { AiJobsStatusController } from "../../ai/controller/ai-jobs.controller";
import { InMemoryReportRepository } from "../repository/in-memory-report.repository";
import { parseAiJobOutput } from "./ai-job-output";

describe("NCS evaluation polling output", () => {
  it("validates and exposes a product output with exact transcript offsets", () => {
    const input = ncsEvaluationInput();
    const output = ncsEvaluationOutput(input);

    expect(parseAiJobOutput(JSON.stringify(output), JSON.stringify(input))).toEqual(output);
    expect(parseAiJobOutput(JSON.stringify(output))).toBeUndefined();
  });

  it("hides product output when identity, score, quote, or guardrail is invalid", () => {
    const input = ncsEvaluationInput();

    const identityMismatch = ncsEvaluationOutput(input);
    identityMismatch.questionId = 999;
    expect(parseAiJobOutput(JSON.stringify(identityMismatch), JSON.stringify(input))).toBeUndefined();

    const scoreMismatch = ncsEvaluationOutput(input);
    scoreMismatch.behaviorEvaluations[0]!.score = 100;
    expect(parseAiJobOutput(JSON.stringify(scoreMismatch), JSON.stringify(input))).toBeUndefined();

    const quoteMismatch = ncsEvaluationOutput(input);
    quoteMismatch.evidences[0]!.quote += " 변조";
    expect(parseAiJobOutput(JSON.stringify(quoteMismatch), JSON.stringify(input))).toBeUndefined();

    const blocked = ncsEvaluationOutput(input);
    blocked.guardrail.nonverbalSignalUsed = true;
    expect(parseAiJobOutput(JSON.stringify(blocked), JSON.stringify(input))).toBeUndefined();
  });

  it("rejects prohibited signals even if output guardrail flags are falsely clear", () => {
    const input = ncsEvaluationInput();
    input.payload.transcript = "시선을 유지하며 복합 인덱스를 적용하고 결과를 확인했습니다.";
    const output = ncsEvaluationOutput(input);

    expect(output.guardrail.nonverbalSignalUsed).toBe(false);
    expect(parseAiJobOutput(JSON.stringify(output), JSON.stringify(input))).toBeUndefined();
  });

  it("returns validated NCS output through the existing owner-only polling controller", async () => {
    const input = ncsEvaluationInput();
    const output = ncsEvaluationOutput(input);
    const repository = new InMemoryReportRepository();
    const queued = await repository.createQueuedProcess(
      "REPORT_GENERATE",
      JSON.stringify(input),
      { sessionId: input.payload.sessionId },
    );
    await repository.markQueuedProcessCompleted(queued.processLogId, JSON.stringify(output));
    const controller = new AiJobsStatusController(repository);

    const status = await controller.getStatus(
      {
        headers: {},
        currentUser: {
          userId: 10,
          userType: "CANDIDATE",
          candidateId: 20,
          companyId: null,
        },
      },
      String(queued.processLogId),
    );

    expect(status.status).toBe("COMPLETED");
    expect(status.output).toEqual(output);
    expect(status.outputRef).toBe(JSON.stringify(output));
  });
});

function ncsEvaluationInput() {
  return {
    kind: "MOCK_NCS_ANSWER_EVALUATION",
    requestedBy: {
      userId: 10,
      userType: "CANDIDATE",
      candidateId: 20,
    },
    payload: {
      step: "NCS_ANSWER_EVALUATION",
      sessionId: 101,
      questionId: 501,
      answerId: 701,
      transcript: "복합 인덱스를 적용하고 같은 부하에서 p95가 줄었는지 결과를 확인했습니다.",
      evaluationSnapshot: {
        contractVersion: "ncs-evaluation-product.v1",
        snapshotVersion: "service-ncs-starter-v1:test",
        locale: "ko-KR",
        question: {
          questionId: "501",
          questionType: "EXPERIENCE",
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
            definition: "기술 대안을 비교하고 결과를 검증하는 능력",
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
            description: "선택 근거, 실행 행동, 검증 결과를 연결해 설명한다.",
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
    },
  };
}

function ncsEvaluationOutput(input: ReturnType<typeof ncsEvaluationInput>) {
  const transcript = input.payload.transcript;
  return {
    contractVersion: "ncs-evaluation-product.v1",
    evaluationSnapshotVersion: input.payload.evaluationSnapshot.snapshotVersion,
    sessionId: input.payload.sessionId,
    questionId: input.payload.questionId,
    answerId: input.payload.answerId,
    evidences: [
      {
        evidenceId: "evidence-1",
        quote: transcript,
        startChar: 0,
        endChar: transcript.length,
        claimType: "RESULT",
        behaviorPointIds: ["technical-decision-bp-01"],
      },
    ],
    behaviorEvaluations: [
      {
        behaviorPointId: "technical-decision-bp-01",
        status: "DEMONSTRATED",
        level: 4,
        score: 85,
        rationale: "행동, 선택 근거와 확인 결과가 연결됩니다.",
        supportingEvidenceIds: ["evidence-1"],
        contradictingEvidenceIds: [] as string[],
        missingEvidence: ["TRADEOFF"],
        confidence: "HIGH",
      },
    ],
    coverage: {
      assessableBehaviorPointCount: 1,
      evaluatedBehaviorPointCount: 1,
      ratio: 1,
      status: "SUFFICIENT",
    },
    followUp: {
      required: false,
      reason: null,
      missingEvidence: [] as string[],
      suggestedQuestion: null,
    },
    guardrail: {
      unsupportedFactDetected: false,
      sensitiveAttributeUsed: false,
      nonverbalSignalUsed: false,
      hiringDecisionLanguageDetected: false,
    },
    metadata: {
      strategyId: "evidence-state",
      strategyVersion: "evidence-state-rules-v1",
      model: "deterministic-evidence-state-v1",
    },
  };
}
