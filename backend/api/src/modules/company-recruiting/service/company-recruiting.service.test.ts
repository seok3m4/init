import assert from "node:assert/strict";

import { CompanyRecruitingService } from "./company-recruiting.service";
import type { ApplicantRecord } from "../company-recruiting.types";

const companyUser = {
  userId: 1,
  userType: "COMPANY" as const,
  companyId: 7,
  candidateId: null,
};

function createRepository(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[]> = {};
  const applicant = createApplicantRecord();
  const repository = {
    calls,
    async createPosting(input: unknown) {
      calls.createPosting = [input];
      return {
        postingId: 101,
        companyId: 7,
        title: "Backend Developer",
        jobRole: "Backend",
        jobDescription: "Build APIs",
        startsOn: new Date("2026-06-29T00:00:00.000Z"),
        endsOn: new Date("2026-07-15T00:00:00.000Z"),
        status: "OPEN",
        createdAt: new Date("2026-06-29T00:00:00.000Z"),
        updatedAt: new Date("2026-06-29T00:00:00.000Z"),
        applicantCount: 0,
      };
    },
    async updatePosting(postingId: number, companyId: number, input: unknown) {
      calls.updatePosting = [postingId, companyId, input];
      return {
        postingId,
        companyId,
        title: (input as { title: string }).title,
        jobRole: (input as { jobRole: string }).jobRole,
        jobDescription: (input as { jobDescription: string | null }).jobDescription,
        startsOn: (input as { startsOn: Date | null }).startsOn,
        endsOn: (input as { endsOn: Date | null }).endsOn,
        status: (input as { status: string }).status,
        createdAt: new Date("2026-06-29T00:00:00.000Z"),
        updatedAt: new Date("2026-06-30T00:00:00.000Z"),
        applicantCount: 2,
      };
    },
    async listPostings(companyId: number, query: unknown) {
      calls.listPostings = [companyId, query];
      return [];
    },
    async countPostings(companyId: number, query: unknown) {
      calls.countPostings = [companyId, query];
      return 0;
    },
    async findPostingForCompany(postingId: number, companyId: number) {
      calls.findPostingForCompany = [postingId, companyId];
      return {
        postingId,
        companyId,
        title: "Backend Developer",
        jobRole: "Backend",
        jobDescription: "Build APIs",
        startsOn: null,
        endsOn: null,
        status: "OPEN",
        createdAt: new Date("2026-06-29T00:00:00.000Z"),
        updatedAt: new Date("2026-06-29T00:00:00.000Z"),
        applicantCount: 0,
      };
    },
    async findApplicationByPostingAndEmail(postingId: number, email: string) {
      calls.findApplicationByPostingAndEmail = [postingId, email];
      return null;
    },
    async findOrCreateCandidate(input: unknown) {
      calls.findOrCreateCandidate = [input];
      return { candidateId: 44 };
    },
    async createApplication(input: unknown) {
      calls.createApplication = [input];
      return applicant;
    },
    async listApplicationsForPosting(postingId: number, companyId: number, query: unknown) {
      calls.listApplicationsForPosting = [postingId, companyId, query];
      return [];
    },
    async countApplicationsForPosting(postingId: number, companyId: number, query: unknown) {
      calls.countApplicationsForPosting = [postingId, companyId, query];
      return 0;
    },
    async findApplicationForCompany(applicationId: number, companyId: number) {
      calls.findApplicationForCompany = [applicationId, companyId];
      return applicationId === applicant.applicationId && companyId === 7 ? applicant : null;
    },
    async updateApplicationScreening(applicationId: number, companyId: number, input: unknown) {
      calls.updateApplicationScreening = [applicationId, companyId, input];
      return {
        ...applicant,
        screeningDecision: (input as { screeningDecision: string }).screeningDecision,
        screeningMemo: (input as { screeningMemo?: string | null }).screeningMemo ?? null,
      };
    },
    ...overrides,
  };
  return repository;
}

function createApplicantRecord(overrides: Partial<ApplicantRecord> = {}): ApplicantRecord {
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
        phone: "010-0000-0000",
      },
    },
    posting: {
      postingId: 101,
      title: "Backend Developer",
      jobRole: "Backend",
    },
    evaluationReports: [],
    interviewSessions: [],
    ...overrides,
  };
}

function createInvitationAdapter() {
  const calls: Record<string, unknown[]> = {};
  return {
    calls,
    async requestInvitation(input: unknown) {
      calls.requestInvitation = [input];
      return {
        invitationId: "temp-invitation-77",
        applicationId: 77,
        availableFrom: new Date("2026-06-30T00:00:00.000Z"),
        availableUntil: new Date("2026-07-02T00:00:00.000Z"),
        message: "응시 안내입니다.",
        deliveryStatus: "REQUESTED" as const,
        temporary: true as const,
        temporaryBoundary: "B_MODULE_IN_MEMORY_INVITATION_ADAPTER" as const,
        sessionConnection: {
          status: "REQUESTED_FROM_D_MODULE" as const,
          interviewType: "RECRUITING" as const,
          temporary: true as const,
        },
      };
    },
  };
}

describe("CompanyRecruitingService", () => {
  it("creates recruitments for the current company only", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    const result = await service.createRecruitment(companyUser, {
      title: "Backend Developer",
      jobRole: "Backend",
      jobDescription: "Build APIs",
      startsOn: "2026-06-29",
      endsOn: "2026-07-15",
      status: "OPEN",
    });

    assert.equal(result.companyId, 7);
    assert.equal(result.status, "OPEN");
    assert.deepEqual(repository.calls.createPosting, [
      {
        companyId: 7,
        title: "Backend Developer",
        jobRole: "Backend",
        jobDescription: "Build APIs",
        startsOn: new Date("2026-06-29T00:00:00.000Z"),
        endsOn: new Date("2026-07-15T00:00:00.000Z"),
        status: "OPEN",
      },
    ]);
  });

  it("lists recruitments using CurrentUser.companyId", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    await service.listRecruitments(companyUser, {
      page: 2,
      limit: 10,
      q: "backend",
      sort: "createdAt",
      order: "asc",
    });

    assert.deepEqual(repository.calls.listPostings, [
      7,
      {
        page: 2,
        limit: 10,
        q: "backend",
        sort: "createdAt",
        order: "asc",
        skip: 10,
        take: 10,
      },
    ]);
  });

  it("lists recruitments with keyword alias and posting status filter", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    await service.listRecruitments(companyUser, {
      page: 1,
      limit: 20,
      keyword: "frontend",
      status: "CLOSED",
      sort: "status",
      order: "desc",
    });

    assert.deepEqual(repository.calls.listPostings, [
      7,
      {
        page: 1,
        limit: 20,
        q: "frontend",
        status: "CLOSED",
        sort: "status",
        order: "desc",
        skip: 0,
        take: 20,
      },
    ]);
  });

  it("updates recruitment settings for the current company only", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    const result = await service.updateRecruitment(companyUser, 101, {
      title: "Updated Backend Hiring",
      jobRole: "Backend Engineer",
      jobDescription: "Updated JD text",
      startsOn: "2026-07-01",
      endsOn: "2026-07-31",
      status: "OPEN",
    });

    assert.equal(result.recruitmentId, 101);
    assert.equal(result.title, "Updated Backend Hiring");
    assert.equal(result.jobDescription, "Updated JD text");
    assert.deepEqual(repository.calls.updatePosting, [
      101,
      7,
      {
        title: "Updated Backend Hiring",
        jobRole: "Backend Engineer",
        jobDescription: "Updated JD text",
        startsOn: new Date("2026-07-01T00:00:00.000Z"),
        endsOn: new Date("2026-07-31T00:00:00.000Z"),
        status: "OPEN",
      },
    ]);
  });

  it("copies only the current company's closed recruitment as a draft", async () => {
    const copyCalls: Record<string, unknown[]> = {};
    const repository = createRepository({
      async findPostingForCompany(postingId: number, companyId: number) {
        copyCalls.findPostingForCompany = [postingId, companyId];
        return {
          postingId,
          companyId,
          title: "Closed Backend Hiring",
          jobRole: "Backend",
          jobDescription: "Closed JD",
          startsOn: new Date("2026-06-01T00:00:00.000Z"),
          endsOn: new Date("2026-06-15T00:00:00.000Z"),
          status: "CLOSED",
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
          updatedAt: new Date("2026-06-15T00:00:00.000Z"),
          applicantCount: 3,
        };
      },
      async createPosting(input: unknown) {
        copyCalls.createPosting = [input];
        return {
          postingId: 202,
          companyId: 7,
          title: "Closed Backend Hiring (복사본)",
          jobRole: "Backend",
          jobDescription: "Closed JD",
          startsOn: null,
          endsOn: null,
          status: "DRAFT",
          createdAt: new Date("2026-06-30T00:00:00.000Z"),
          updatedAt: new Date("2026-06-30T00:00:00.000Z"),
          applicantCount: 0,
        };
      },
    });
    const service = new CompanyRecruitingService(repository);

    const result = await service.copyRecruitment(companyUser, 101);

    assert.equal(result.recruitmentId, 202);
    assert.equal(result.status, "DRAFT");
    assert.deepEqual(copyCalls.createPosting, [
      {
        companyId: 7,
        title: "Closed Backend Hiring (복사본)",
        jobRole: "Backend",
        jobDescription: "Closed JD",
        startsOn: null,
        endsOn: null,
        status: "DRAFT",
      },
    ]);
  });

  it("rejects copying recruitments that are not closed", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    await assert.rejects(
      service.copyRecruitment(companyUser, 101),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "COMMON_VALIDATION_FAILED",
    );
    assert.equal(repository.calls.createPosting, undefined);
  });

  it("rejects duplicate applicant email within the same recruitment", async () => {
    const repository = createRepository({
      async findApplicationByPostingAndEmail() {
        return { applicationId: 123 };
      },
    });
    const service = new CompanyRecruitingService(repository);

    await assert.rejects(
      service.registerApplicant(companyUser, {
        recruitmentId: 101,
        name: "Kim Applicant",
        email: "KIM@example.com",
        jobRole: "Backend",
        phone: "010-0000-0000",
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "COMMON_CONFLICT",
    );
  });

  it("creates an application with B-owned initial statuses", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    const result = await service.registerApplicant(companyUser, {
      recruitmentId: 101,
      name: "Kim Applicant",
      email: "KIM@example.com",
      jobRole: "Backend",
      phone: "010-0000-0000",
    });

    assert.equal(result.applicationStatus, "SUBMITTED");
    assert.equal(result.documentStatus, "NOT_SUBMITTED");
    assert.equal(result.interviewStatus, "NOT_READY");
    assert.equal(result.reportStatus, "PENDING");
    assert.equal(result.screeningDecision, "UNDECIDED");
    assert.deepEqual(repository.calls.findApplicationByPostingAndEmail, [101, "kim@example.com"]);
  });

  it("requests invitations through the temporary B adapter boundary", async () => {
    const repository = createRepository();
    const invitationAdapter = createInvitationAdapter();
    const service = new CompanyRecruitingService(repository, invitationAdapter);

    const result = await service.inviteApplicant(companyUser, {
      applicantId: 77,
      availableFrom: "2026-06-30T00:00:00.000Z",
      availableUntil: "2026-07-02T00:00:00.000Z",
      message: "응시 안내입니다.",
    });

    assert.equal(result.temporary, true);
    assert.equal(result.temporaryBoundary, "B_MODULE_IN_MEMORY_INVITATION_ADAPTER");
    assert.equal(result.sessionConnection.status, "REQUESTED_FROM_D_MODULE");
    assert.deepEqual(repository.calls.findApplicationForCompany, [77, 7]);
    assert.equal((invitationAdapter.calls.requestInvitation[0] as { application: ApplicantRecord }).application.applicationId, 77);
  });

  it("rejects invalid invitation periods before calling the adapter", async () => {
    const repository = createRepository();
    const invitationAdapter = createInvitationAdapter();
    const service = new CompanyRecruitingService(repository, invitationAdapter);

    await assert.rejects(
      service.inviteApplicant(companyUser, {
        applicantId: 77,
        availableFrom: "2026-07-02T00:00:00.000Z",
        availableUntil: "2026-06-30T00:00:00.000Z",
        message: "응시 안내입니다.",
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "COMMON_VALIDATION_FAILED",
    );
    assert.equal(invitationAdapter.calls.requestInvitation, undefined);
  });

  it("returns evaluation detail with report absence as none or generating", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    const result = await service.getApplicantEvaluation(companyUser, 77);

    assert.equal(result.applicant.applicantId, 77);
    assert.equal(result.reportAvailability, "NONE_OR_GENERATING");
    assert.equal(result.report, null);
    assert.equal(result.screening.decision, "UNDECIDED");
  });

  it("returns evaluation detail with report summary, score, and evidence when available", async () => {
    const repository = createRepository({
      async findApplicationForCompany(applicationId: number, companyId: number) {
        return createApplicantRecord({
          evaluationReports: [
            {
              reportId: 501,
              status: "COMPLETED",
              totalScore: 82,
              summary: "지원 직무와 경험이 잘 맞습니다.",
              generatedAt: new Date("2026-06-30T08:00:00.000Z"),
              scores: [
                {
                  scoreId: 9001,
                  score: 82,
                  rationale: "API 설계 경험이 구체적입니다.",
                  criterion: { criterionId: 10, tagName: "Backend" },
                  evidences: [{ evidenceId: 1, evidenceText: "NestJS 기반 API 구축 경험" }],
                },
              ],
            },
          ],
        });
      },
    });
    const service = new CompanyRecruitingService(repository);

    const result = await service.getApplicantEvaluation(companyUser, 77);

    assert.equal(result.reportAvailability, "AVAILABLE");
    assert.equal(result.report?.totalScore, 82);
    assert.equal(result.report?.scores[0]?.evidences[0]?.evidenceText, "NestJS 기반 API 구축 경험");
  });

  it("stores only allowed screening decisions and memo through the B-owned fields", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    const result = await service.updateScreeningStatus(companyUser, 77, {
      screeningDecision: "HOLD",
      screeningMemo: "추가 확인 필요",
    });

    assert.equal(result.screeningDecision, "HOLD");
    assert.equal(result.screeningMemo, "추가 확인 필요");
    assert.deepEqual(repository.calls.updateApplicationScreening, [
      77,
      7,
      { screeningDecision: "HOLD", screeningMemo: "추가 확인 필요" },
    ]);
  });

  it("rejects screening decisions outside the agreed enum values", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    await assert.rejects(
      service.updateScreeningStatus(companyUser, 77, {
        screeningDecision: "REJECTED" as never,
        screeningMemo: "잘못된 값",
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "COMMON_VALIDATION_FAILED",
    );
  });
});
