import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../app.module";
import { InMemoryReportRepository } from "./in-memory-report.repository";

describe("ReportsController", () => {
  let app: INestApplication;
  let repository: InMemoryReportRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
    repository = app.get(InMemoryReportRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  it("queues evaluation context work for a company dev user", async () => {
    const response = await companyRequest("/api/v1/reports/1/evaluation-context")
      .send(validContextPayload())
      .expect(202);

    expect(response.body.data.processType).toBe("REPORT_GENERATE");
    expect(response.body.data.status).toBe("PENDING");
    expect(response.body.data.queued).toBe(true);
    expect(response.body.data.report.status).toBe("GENERATING");
    expect(response.body.data.inputRef).toContain("\"step\":\"EVALUATION_CONTEXT\"");
    expect(response.body.data.inputRef).toContain("\"reportId\":1");
  });

  it("queues answer evaluation work for a company dev user", async () => {
    const response = await companyRequest("/api/v1/reports/1/answer-evaluation")
      .send({
        reportType: "RECRUITING_REPORT",
        criteria: validGeneratePayload().criteria,
        answers: validGeneratePayload().answers,
        documentText: validGeneratePayload().documentText
      })
      .expect(202);

    expect(response.body.data.processType).toBe("REPORT_GENERATE");
    expect(response.body.data.status).toBe("PENDING");
    expect(response.body.data.queued).toBe(true);
    expect(response.body.data.report.status).toBe("GENERATING");
    expect(response.body.data.inputRef).toContain("\"step\":\"ANSWER_EVALUATION\"");
  });

  it("queues communication analysis work for a company dev user", async () => {
    const response = await companyRequest("/api/v1/reports/1/communication-analysis")
      .send({
        reportType: "RECRUITING_REPORT",
        consentConfirmed: true,
        mediaQuality: "LOW_AUDIO",
        metrics: { speechPace: "NORMAL", audioClarity: 45 }
      })
      .expect(202);

    expect(response.body.data.processType).toBe("REPORT_GENERATE");
    expect(response.body.data.status).toBe("PENDING");
    expect(response.body.data.queued).toBe(true);
    expect(response.body.data.report.status).toBe("GENERATING");
    expect(response.body.data.inputRef).toContain("\"step\":\"COMMUNICATION_ANALYSIS\"");
  });

  it("generates a recruiting report for a company dev user", async () => {
    const response = await companyRequest("/api/v1/reports/1/generate").send(validGeneratePayload()).expect(202);

    expect(response.body.data.processType).toBe("REPORT_GENERATE");
    expect(response.body.data.status).toBe("PENDING");
    expect(response.body.data.queued).toBe(true);
    expect(response.body.data.report.status).toBe("GENERATING");
    expect(response.body.data.inputRef).toContain("\"reportId\":1");
    expect(response.body.data.inputRef).toContain("Redis cache");
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

    expect(response.body.data.processType).toBe("REPORT_GENERATE");
    expect(response.body.data.status).toBe("PENDING");
    expect(response.body.data.queued).toBe(true);
    expect(response.body.data.report.reportType).toBe("MOCK_INTERVIEW_REPORT");
    expect(response.body.data.report.status).toBe("GENERATING");
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

  it("records regenerated guardrail results for passing regenerated output", async () => {
    const response = await adminRequest("/api/v1/ai/guardrails/validate")
      .send({
        reportType: "RECRUITING_REPORT",
        target: "SCORES",
        regenerated: true,
        regenerationReason: "Unsafe wording was regenerated before final validation.",
        scores: [
          {
            criterionId: 1,
            criterionName: "Communication",
            score: 80,
            rationale: "The answer is clear and evidence-backed.",
            evidences: [{ sourceType: "INTERVIEW_ANSWER", answerId: 10, text: "Clear answer." }]
          }
        ]
      })
      .expect(200);

    expect(response.body.data.guardrail).toEqual({
      result: "REGENERATED",
      reason: "Unsafe wording was regenerated before final validation."
    });
  });

  it("queues candidate document extraction without storing raw file content", async () => {
    const response = await candidateRequest("/api/v1/candidate/documents/extract")
      .send({
        applicationId: 3,
        documentId: 8,
        fileId: 9,
        s3Key: "candidate/4/resume.pdf"
      })
      .expect(202);

    expect(response.body.data.processType).toBe("DOCUMENT_EXTRACT");
    expect(response.body.data.status).toBe("PENDING");
    expect(response.body.data.queued).toBe(true);
    expect(response.body.data.inputRef).toContain("candidate/4/resume.pdf");
    expect(response.body.data.inputRef).not.toContain("fileContent");

    const statusResponse = await candidateGet(`/api/v1/ai/jobs/${response.body.data.processLogId}/status`).expect(200);
    expect(statusResponse.body.data.processType).toBe("DOCUMENT_EXTRACT");
    expect(statusResponse.body.data.status).toBe("PENDING");
  });

  it("queues candidate STT work for worker processing", async () => {
    const response = await candidateRequest("/api/v1/candidate/mock-interviews/7/stt")
      .send({
        answerId: 10,
        audioFileId: 11,
        audioS3Key: "candidate/4/answer-10.wav"
      })
      .expect(202);

    expect(response.body.data.processType).toBe("STT");
    expect(response.body.data.status).toBe("PENDING");
    expect(response.body.data.queued).toBe(true);
  });

  it("queues mock follow-up work with previous question context", async () => {
    const response = await candidateRequest("/api/v1/candidate/mock-interviews/7/follow-up-question")
      .send({
        answerId: 10,
        previousQuestion: "How did you use Redis?",
        transcript: "I improved read performance with Redis cache."
      })
      .expect(202);

    expect(response.body.data.processType).toBe("FOLLOW_UP");
    expect(response.body.data.status).toBe("PENDING");
    expect(response.body.data.inputRef).toContain("How did you use Redis?");
  });

  it("queues recruiting follow-up work with JD or document context", async () => {
    const response = await candidateRequest("/api/v1/candidate/interviews/7/follow-up-question")
      .send({
        answerId: 10,
        previousQuestion: "How did you use Redis?",
        transcript: "I improved read performance with Redis cache.",
        jobDescription: "Backend engineer with Redis operations."
      })
      .expect(202);

    expect(response.body.data.processType).toBe("FOLLOW_UP");
    expect(response.body.data.status).toBe("PENDING");
    expect(response.body.data.inputRef).toContain("Backend engineer with Redis operations.");
  });

  it("rejects recruiting follow-up without JD or document context", async () => {
    await candidateRequest("/api/v1/candidate/interviews/7/follow-up-question")
      .send({
        answerId: 10,
        previousQuestion: "How did you use Redis?",
        transcript: "I improved read performance with Redis cache."
      })
      .expect(400);
  });

  it("queues company AI criteria suggestions", async () => {
    const response = await companyRequest("/api/v1/company/interviews/evaluation-criteria/suggest")
      .send({
        postingId: 2,
        jobDescription: "Backend engineer with NestJS and PostgreSQL experience.",
        talentProfile: "Pragmatic problem solver",
        evaluationPolicy: "Prefer evidence-backed backend ownership."
      })
      .expect(202);

    expect(response.body.data.processType).toBe("CRITERIA_SUGGEST");
    expect(response.body.data.status).toBe("PENDING");
    expect(response.body.data.queued).toBe(true);
    expect(response.body.data.inputRef).toContain("Pragmatic problem solver");
    expect(response.body.data.inputRef).toContain("Prefer evidence-backed backend ownership.");
  });

  it("exposes parsed company generation output through AI job status", async () => {
    const response = await companyRequest("/api/v1/company/interviews/questions/generate")
      .send({
        postingId: 2,
        jobDescription: "Backend engineer with NestJS and PostgreSQL experience.",
        questionCount: 2
      })
      .expect(202);

    await repository.markQueuedProcessCompleted(
      response.body.data.processLogId,
      JSON.stringify({
        kind: "RECRUITING_QUESTION_GENERATE",
        items: ["Question 1", "Question 2"],
        reviewRequired: true
      })
    );

    const statusResponse = await companyGet(`/api/v1/ai/jobs/${response.body.data.processLogId}/status`).expect(200);

    expect(statusResponse.body.data.status).toBe("COMPLETED");
    expect(statusResponse.body.data.output.items).toEqual(["Question 1", "Question 2"]);
    expect(statusResponse.body.data.output.reviewRequired).toBe(true);
  });

  it("queues question-set generation with criteria and question type conditions", async () => {
    const response = await companyRequest("/api/v1/company/interviews/question-sets")
      .send({
        postingId: 2,
        questionCount: 2,
        criteria: [{ criterionId: 1, name: "Problem solving", weight: 40 }],
        questionTypes: ["TECHNICAL", "EXPERIENCE"]
      })
      .expect(202);

    expect(response.body.data.processType).toBe("QUESTION_SET_GENERATE");
    expect(response.body.data.status).toBe("PENDING");
    expect(response.body.data.inputRef).toContain("Problem solving");
    expect(response.body.data.inputRef).toContain("TECHNICAL");
  });

  it("rejects criteria suggestion without talent profile and evaluation policy", async () => {
    await companyRequest("/api/v1/company/interviews/evaluation-criteria/suggest")
      .send({
        postingId: 2,
        jobDescription: "Backend engineer with NestJS and PostgreSQL experience."
      })
      .expect(400);
  });

  it("exposes parsed candidate mock-question output through AI job status", async () => {
    const response = await candidateRequest("/api/v1/candidate/mock-interviews/questions/generate")
      .send({
        questionCount: 2
      })
      .expect(202);

    await repository.markQueuedProcessCompleted(
      response.body.data.processLogId,
      JSON.stringify({
        kind: "MOCK_QUESTION_GENERATE",
        items: ["Mock question 1", "Mock question 2"],
        reviewRequired: true
      })
    );

    const statusResponse = await candidateGet(`/api/v1/ai/jobs/${response.body.data.processLogId}/status`).expect(200);

    expect(statusResponse.body.data.status).toBe("COMPLETED");
    expect(statusResponse.body.data.output.items).toEqual(["Mock question 1", "Mock question 2"]);
    expect(statusResponse.body.data.output.reviewRequired).toBe(true);
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

  function candidateRequest(path: string) {
    return request(app.getHttpServer())
      .post(path)
      .set("X-Dev-User-Id", "2")
      .set("X-Dev-User-Type", "CANDIDATE")
      .set("X-Dev-Candidate-Id", "1");
  }

  function candidateGet(path: string) {
    return request(app.getHttpServer())
      .get(path)
      .set("X-Dev-User-Id", "2")
      .set("X-Dev-User-Type", "CANDIDATE")
      .set("X-Dev-Candidate-Id", "1");
  }

  function companyGet(path: string) {
    return request(app.getHttpServer())
      .get(path)
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
