import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../app.module";

describe("ReportsController", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("builds evaluation context for a company dev user", async () => {
    const response = await companyRequest("/api/v1/reports/1/evaluation-context")
      .send(validContextPayload())
      .expect(202);

    expect(response.body.data.step).toBe("EVALUATION_CONTEXT");
    expect(response.body.data.context.companyId).toBe(1);
    expect(response.body.data.context.manualEvaluations).toHaveLength(1);
  });

  it("evaluates answers and stores score/evidence counts", async () => {
    const response = await companyRequest("/api/v1/reports/1/answer-evaluation")
      .send({
        reportType: "RECRUITING_REPORT",
        criteria: validGeneratePayload().criteria,
        answers: validGeneratePayload().answers,
        documentText: validGeneratePayload().documentText
      })
      .expect(202);

    expect(response.body.data.step).toBe("ANSWER_EVALUATION");
    expect(response.body.data.guardrail.result).toBe("PASS");
    expect(response.body.data.stored.scoreCount).toBe(1);
    expect(response.body.data.stored.evidenceCount).toBe(2);
  });

  it("stores communication analysis as auxiliary-only data", async () => {
    const response = await companyRequest("/api/v1/reports/1/communication-analysis")
      .send({
        reportType: "RECRUITING_REPORT",
        consentConfirmed: true,
        mediaQuality: "LOW_AUDIO",
        metrics: { speechPace: "NORMAL", audioClarity: 45 }
      })
      .expect(202);

    expect(response.body.data.step).toBe("COMMUNICATION_ANALYSIS");
    expect(response.body.data.communicationAnalysis.usage).toBe("AUXILIARY_ONLY");
    expect(response.body.data.communicationAnalysis.decisionWeight).toBe(0);
  });

  it("generates a recruiting report for a company dev user", async () => {
    const response = await companyRequest("/api/v1/reports/1/generate").send(validGeneratePayload()).expect(202);

    expect(response.body.data.status).toBe("COMPLETED");
    expect(response.body.data.report.status).toBe("COMPLETED");
    expect(response.body.data.guardrail.result).toBe("PASS");
    expect(response.body.data.scores[0].evidences[0].text).toContain("Redis cache");
    expect(response.body.meta.traceId).toBeTruthy();
  });

  it("generates a mock interview report for a candidate dev user", async () => {
    const payload = { ...validGeneratePayload(), reportType: "MOCK_INTERVIEW_REPORT" };
    const response = await request(app.getHttpServer())
      .post("/api/v1/candidate/mock-interview/reports/2/generate")
      .set("X-Dev-User-Id", "2")
      .set("X-Dev-User-Type", "CANDIDATE")
      .set("X-Dev-Candidate-Id", "1")
      .send(payload)
      .expect(202);

    expect(response.body.data.report.reportType).toBe("MOCK_INTERVIEW_REPORT");
    expect(response.body.data.guardrail.result).toBe("PASS");
  });

  it("validates guardrails for an admin dev user", async () => {
    const response = await adminRequest("/api/v1/ai/guardrails/validate")
      .send({
        reportType: "MOCK_INTERVIEW_REPORT",
        target: "SCORES",
        scores: [
          {
            criterionId: 1,
            criterionName: "Communication",
            score: 80,
            rationale: "This candidate is 합격.",
            evidences: [{ sourceType: "INTERVIEW_ANSWER", answerId: 10, text: "Clear answer." }]
          }
        ]
      })
      .expect(200);

    expect(response.body.data.target).toBe("SCORES");
    expect(response.body.data.guardrail.result).toBe("BLOCKED");
  });

  it("returns unauthorized when dev auth headers are missing", async () => {
    await request(app.getHttpServer()).post("/api/v1/reports/1/generate").send(validGeneratePayload()).expect(401);
  });

  it("returns forbidden for candidate users on recruiting report generation", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/reports/1/generate")
      .set("X-Dev-User-Id", "2")
      .set("X-Dev-User-Type", "CANDIDATE")
      .set("X-Dev-Candidate-Id", "1")
      .send(validGeneratePayload())
      .expect(403);
  });

  it("returns forbidden for company users on guardrail validation", async () => {
    await companyRequest("/api/v1/ai/guardrails/validate")
      .send({
        reportType: "RECRUITING_REPORT",
        target: "SCORES",
        scores: []
      })
      .expect(403);
  });

  function companyRequest(path: string) {
    return request(app.getHttpServer())
      .post(path)
      .set("X-Dev-User-Id", "1")
      .set("X-Dev-User-Type", "COMPANY")
      .set("X-Dev-Company-Id", "1");
  }

  function adminRequest(path: string) {
    return request(app.getHttpServer())
      .post(path)
      .set("X-Dev-User-Id", "9")
      .set("X-Dev-User-Type", "ADMIN");
  }
});

function validContextPayload() {
  return {
    reportType: "RECRUITING_REPORT",
    company: { companyId: 1, name: "Init Corp", talentProfile: "Pragmatic problem solver" },
    posting: {
      postingId: 2,
      title: "Backend Engineer",
      jobDescription: "Backend engineer with NestJS, PostgreSQL, and Redis experience."
    },
    application: {
      applicationId: 3,
      candidateId: 4,
      documentText: "The candidate has worked on NestJS APIs and Redis cache policies."
    },
    criteria: validGeneratePayload().criteria,
    answers: validGeneratePayload().answers,
    manualEvaluations: [{ reviewerUserId: 9, decision: "HOLD", memo: "Needs human review." }]
  };
}

function validGeneratePayload() {
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
