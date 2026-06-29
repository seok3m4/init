import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PrismaCompanyRecruitingRepository } from "./company-recruiting.repository";

describe("PrismaCompanyRecruitingRepository", () => {
  it("does not write D/E-owned application status fields during direct registration", async () => {
    let capturedData: Record<string, unknown> | null = null;
    const prisma = {
      application: {
        async create(args: { data: Record<string, unknown> }) {
          capturedData = args.data;
          return {
            applicationId: 77,
            postingId: 101,
            candidateId: 44,
            applicationStatus: "SUBMITTED",
            documentStatus: "NOT_SUBMITTED",
            interviewStatus: "NOT_READY",
            reportStatus: "PENDING",
            screeningDecision: "UNDECIDED",
            screeningMemo: null,
            submittedAt: null,
            updatedAt: new Date("2026-06-29T00:00:00.000Z"),
            candidate: {
              candidateId: 44,
              user: {
                userId: 88,
                email: "kim@example.com",
                name: "Kim Applicant",
                phone: null,
              },
            },
            posting: {
              postingId: 101,
              title: "Backend Developer",
              jobRole: "Backend",
            },
            evaluationReports: [],
            interviewSessions: [],
          };
        },
      },
    };
    const repository = new PrismaCompanyRecruitingRepository(prisma as never);

    await repository.createApplication({ postingId: 101, candidateId: 44 });

    assert.deepEqual(capturedData, {
      postingId: 101,
      candidateId: 44,
      applicationStatus: "SUBMITTED",
      screeningDecision: "UNDECIDED",
    });
  });

  it("updates only B-owned screening fields", async () => {
    let capturedData: Record<string, unknown> | null = null;
    const application = {
      applicationId: 77,
      postingId: 101,
      candidateId: 44,
      applicationStatus: "SUBMITTED",
      documentStatus: "NOT_SUBMITTED",
      interviewStatus: "NOT_READY",
      reportStatus: "PENDING",
      screeningDecision: "HOLD",
      screeningMemo: "추가 확인 필요",
      submittedAt: null,
      updatedAt: new Date("2026-06-29T00:00:00.000Z"),
      candidate: {
        candidateId: 44,
        user: {
          userId: 88,
          email: "kim@example.com",
          name: "Kim Applicant",
          phone: null,
        },
      },
      posting: {
        postingId: 101,
        title: "Backend Developer",
        jobRole: "Backend",
      },
      evaluationReports: [],
      interviewSessions: [],
    };
    const prisma = {
      application: {
        async findFirst() {
          return { applicationId: 77 };
        },
        async update(args: { data: Record<string, unknown> }) {
          capturedData = args.data;
          return application;
        },
      },
    };
    const repository = new PrismaCompanyRecruitingRepository(prisma as never);

    await repository.updateApplicationScreening(77, 7, {
      screeningDecision: "HOLD",
      screeningMemo: "추가 확인 필요",
    });

    assert.deepEqual(capturedData, {
      screeningDecision: "HOLD",
      screeningMemo: "추가 확인 필요",
    });
  });
});
