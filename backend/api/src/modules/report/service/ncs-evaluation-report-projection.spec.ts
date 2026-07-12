import type { CandidateAiProcessRecord } from "../repository/candidate-report.repository";
import {
  projectCandidateNcsEvaluation,
  projectLatestCandidateNcsEvaluations,
} from "./ncs-evaluation-report-projection";

describe("NCS evaluation report projection", () => {
  it("keeps the latest valid STORED_ANSWER result and snapshot description", () => {
    const older = processFixture({ processLogId: 10, createdAt: "2026-07-12T01:00:00.000Z" });
    const newer = processFixture({ processLogId: 11, createdAt: "2026-07-12T02:00:00.000Z" });
    const textInput = processFixture({ processLogId: 12, createdAt: "2026-07-12T03:00:00.000Z" });
    const textInputRef = JSON.parse(textInput.inputRef!) as ReturnType<typeof evaluationFixture>["input"];
    const textOutputRef = JSON.parse(textInput.outputRef!) as ReturnType<typeof evaluationFixture>["output"];
    Reflect.deleteProperty(textInputRef.payload, "answerId");
    Reflect.deleteProperty(textOutputRef, "answerId");
    textInput.inputRef = JSON.stringify(textInputRef);
    textInput.outputRef = JSON.stringify(textOutputRef);

    const projected = projectLatestCandidateNcsEvaluations([older, textInput, newer]);

    expect(projected).toHaveLength(1);
    expect(projected[0]).toMatchObject({
      processLogId: 11,
      sessionId: 101,
      questionId: 501,
      answerId: 701,
      questionType: "EXPERIENCE",
      questionContent: "기술 대안을 비교하고 선택한 경험을 설명해 주세요.",
    });
    expect(projected[0]?.behaviorEvaluations[0]?.behaviorPointDescription).toBe(
      "선택 근거, 실행 행동, 검증 결과를 연결해 설명한다.",
    );
  });

  it("rejects blocked, identity-mismatched, and incomplete process records", () => {
    const blocked = processFixture({ processLogId: 20 });
    const blockedOutput = JSON.parse(blocked.outputRef!) as ReturnType<typeof evaluationFixture>["output"];
    blockedOutput.guardrail.nonverbalSignalUsed = true;
    blocked.outputRef = JSON.stringify(blockedOutput);

    const mismatched = processFixture({ processLogId: 21, sessionId: 999 });
    const pending = processFixture({ processLogId: 22, status: "PENDING" });

    expect(projectCandidateNcsEvaluation(blocked)).toBeUndefined();
    expect(projectCandidateNcsEvaluation(mismatched)).toBeUndefined();
    expect(projectCandidateNcsEvaluation(pending)).toBeUndefined();
  });
});

function processFixture(overrides: Partial<CandidateAiProcessRecord> = {}): CandidateAiProcessRecord {
  const fixture = evaluationFixture();
  return {
    processLogId: 1,
    sessionId: fixture.input.payload.sessionId,
    processType: "REPORT_GENERATE",
    status: "COMPLETED",
    inputRef: JSON.stringify(fixture.input),
    outputRef: JSON.stringify(fixture.output),
    createdAt: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}

function evaluationFixture() {
  const transcript = "복합 인덱스를 적용하고 같은 부하에서 p95가 줄었는지 결과를 확인했습니다.";
  const input = {
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
      transcript,
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
  const output = {
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
  return { input, output };
}
