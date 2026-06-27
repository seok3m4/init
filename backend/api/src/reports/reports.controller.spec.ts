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

  it("accepts a company dev user and returns report data", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/reports/1/generate")
      .set("X-Dev-User-Id", "1")
      .set("X-Dev-User-Type", "COMPANY")
      .set("X-Dev-Company-Id", "1")
      .send(validPayload())
      .expect(202);

    expect(response.body.data.status).toBe("COMPLETED");
    expect(response.body.data.guardrail.result).toBe("PASS");
    expect(response.body.data.scores[0].evidences[0].text).toContain("Redis cache");
    expect(response.body.meta.traceId).toBeTruthy();
  });

  it("returns unauthorized when dev auth headers are missing", async () => {
    await request(app.getHttpServer()).post("/api/v1/reports/1/generate").send(validPayload()).expect(401);
  });

  it("returns forbidden for candidate users on recruiting report generation", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/reports/1/generate")
      .set("X-Dev-User-Id", "2")
      .set("X-Dev-User-Type", "CANDIDATE")
      .set("X-Dev-Candidate-Id", "1")
      .send(validPayload())
      .expect(403);
  });
});

function validPayload() {
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
