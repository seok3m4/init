import { BadRequestException } from "@nestjs/common";
import { AiReportPipelineService } from "./ai-report-pipeline.service";
import { GuardrailService } from "./guardrail.service";
import { MockAiReportProvider } from "./mock-ai-report.provider";
import { GenerateReportRequest, GeneratedReport } from "./report.types";

describe("AiReportPipelineService", () => {
  let service: AiReportPipelineService;
  let guardrailService: GuardrailService;

  beforeEach(() => {
    guardrailService = new GuardrailService();
    service = new AiReportPipelineService(new MockAiReportProvider(), guardrailService);
  });

  it("generates a completed recruiting report with scores and evidence", () => {
    const result = service.generate({
      currentUser: { userId: 1, userType: "COMPANY", companyId: 1 },
      reportId: 1,
      body: validRequest()
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.guardrail.result).toBe("PASS");
    expect(result.scores).toHaveLength(1);
    expect(result.scores[0].rationale).toContain("Problem solving");
    expect(result.scores[0].evidences[0].answerId).toBe(10);
  });

  it("rejects missing criteria before report generation", () => {
    const body = { ...validRequest(), criteria: [] };

    expect(() =>
      service.generate({
        currentUser: { userId: 1, userType: "COMPANY", companyId: 1 },
        reportId: 1,
        body
      })
    ).toThrow(BadRequestException);
  });

  it("blocks generated reports that do not include evidence", () => {
    const report: GeneratedReport = {
      summary: "Generated summary.",
      totalScore: 80,
      scores: [
        {
          criterionId: 1,
          criterionName: "Problem solving",
          score: 80,
          rationale: "Reason exists.",
          evidences: []
        }
      ]
    };

    const decision = guardrailService.validate("RECRUITING_REPORT", report);

    expect(decision.result).toBe("BLOCKED");
    expect(decision.reason).toContain("evidence");
  });

  it("blocks hiring decision expressions in mock interview feedback", () => {
    const report: GeneratedReport = {
      summary: "이 지원자는 합격 가능성이 높습니다.",
      totalScore: 80,
      scores: [
        {
          criterionId: 1,
          criterionName: "Communication",
          score: 80,
          rationale: "Reason exists.",
          evidences: [{ answerId: 10, text: "Clear answer." }]
        }
      ]
    };

    const decision = guardrailService.validate("MOCK_INTERVIEW_REPORT", report);

    expect(decision.result).toBe("BLOCKED");
  });
});

function validRequest(): GenerateReportRequest {
  return {
    reportType: "RECRUITING_REPORT",
    jobDescription: "Backend engineer with NestJS, PostgreSQL, and Redis experience.",
    documentText: "The candidate has worked on NestJS APIs and Redis cache policies.",
    criteria: [
      {
        criterionId: 1,
        name: "Problem solving",
        description: "Ability to analyze and solve technical problems.",
        weight: 40
      }
    ],
    answers: [
      {
        answerId: 10,
        question: "Describe your Redis experience.",
        transcript: "I improved read performance with Redis cache, TTL, and invalidation policies."
      }
    ]
  };
}
