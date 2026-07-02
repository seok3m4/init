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
        careerRequirement: (input as { careerRequirement?: string | null }).careerRequirement ?? null,
        educationRequirement: (input as { educationRequirement?: string | null }).educationRequirement ?? null,
        salaryInfo: (input as { salaryInfo?: string | null }).salaryInfo ?? null,
        workLocation: (input as { workLocation?: string | null }).workLocation ?? null,
        employmentType: (input as { employmentType?: string | null }).employmentType ?? null,
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
        careerRequirement: (input as { careerRequirement?: string | null }).careerRequirement ?? null,
        educationRequirement: (input as { educationRequirement?: string | null }).educationRequirement ?? null,
        salaryInfo: (input as { salaryInfo?: string | null }).salaryInfo ?? null,
        workLocation: (input as { workLocation?: string | null }).workLocation ?? null,
        employmentType: (input as { employmentType?: string | null }).employmentType ?? null,
        startsOn: (input as { startsOn: Date | null }).startsOn,
        endsOn: (input as { endsOn: Date | null }).endsOn,
        status: (input as { status: string }).status,
        createdAt: new Date("2026-06-29T00:00:00.000Z"),
        updatedAt: new Date("2026-06-30T00:00:00.000Z"),
        applicantCount: 2,
      };
    },
    async archivePosting(postingId: number, companyId: number) {
      calls.archivePosting = [postingId, companyId];
      return {
        postingId,
        companyId,
        title: "Backend Developer",
        jobRole: "Backend",
        jobDescription: "Build APIs",
        careerRequirement: null,
        educationRequirement: null,
        salaryInfo: null,
        workLocation: null,
        employmentType: null,
        startsOn: null,
        endsOn: null,
        status: "ARCHIVED",
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
        careerRequirement: null,
        educationRequirement: null,
        salaryInfo: null,
        workLocation: null,
        employmentType: null,
        startsOn: null,
        endsOn: null,
        status: "OPEN",
        createdAt: new Date("2026-06-29T00:00:00.000Z"),
        updatedAt: new Date("2026-06-29T00:00:00.000Z"),
        applicantCount: 0,
      };
    },
    async findOpenPostingForPublic(postingId: number) {
      calls.findOpenPostingForPublic = [postingId];
      return {
        postingId,
        companyName: "INIT Corp",
        title: "Backend Developer",
        jobRole: "Backend",
        jobDescription: "Build APIs",
        careerRequirement: "경력무관",
        educationRequirement: "학력무관",
        salaryInfo: "회사 내규에 따름",
        workLocation: "서울",
        employmentType: "정규직",
        startsOn: new Date("2026-06-29T00:00:00.000Z"),
        endsOn: new Date("2026-07-15T00:00:00.000Z"),
        status: "OPEN",
      };
    },
    async findApplicationByPostingAndEmail(postingId: number, email: string) {
      calls.findApplicationByPostingAndEmail = [postingId, email];
      return null;
    },
    async findPublicApplicationStatusByPostingAndEmail(postingId: number, email: string) {
      calls.findPublicApplicationStatusByPostingAndEmail = [postingId, email];
      return {
        ...applicant,
        candidate: {
          ...applicant.candidate,
          user: {
            ...applicant.candidate.user,
            email,
          },
        },
        posting: {
          ...applicant.posting,
          companyName: "INIT Corp",
          status: "OPEN",
          startsOn: null,
          endsOn: null,
        },
      };
    },
    async findOrCreateCandidate(input: unknown) {
      calls.findOrCreateCandidate = [input];
      return { candidateId: 44 };
    },
    async findOrCreatePublicCandidate(input: unknown) {
      calls.findOrCreatePublicCandidate = [input];
      return { candidateId: 44 };
    },
    async createApplication(input: unknown) {
      calls.createApplication = [input];
      return {
        ...applicant,
        screeningMemo: (input as { screeningMemo?: string | null }).screeningMemo ?? null,
      };
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

function createPublicApplicationAuthAdapter() {
  const calls: Record<string, unknown[]> = {};
  return {
    calls,
    async requestEmailVerification(input: unknown) {
      calls.requestEmailVerification = [input];
      return {
        emailVerificationStatus: "PENDING" as const,
        nextAction: "CHECK_EMAIL" as const,
        temporary: true as const,
        temporaryBoundary: "B_MODULE_PUBLIC_APPLICATION_AUTH_ADAPTER" as const,
        magicLinkDeliveryStatus: "NOT_SENT_TEMPORARY" as const,
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
      careerRequirement: "경력 3년 이상",
      educationRequirement: "대졸 이상",
      salaryInfo: "연봉 4,000만원 이상",
      workLocation: "판교",
      employmentType: "정규직",
      startsOn: "2026-06-29",
      endsOn: "2026-07-15",
      status: "OPEN",
    });

    assert.equal(result.companyId, 7);
    assert.equal(result.status, "OPEN");
    assert.equal(result.careerRequirement, "경력 3년 이상");
    assert.equal(result.workLocation, "판교");
    assert.deepEqual(repository.calls.createPosting, [
      {
        companyId: 7,
        title: "Backend Developer",
        jobRole: "Backend",
        jobDescription: "Build APIs",
        careerRequirement: "경력 3년 이상",
        educationRequirement: "대졸 이상",
        salaryInfo: "연봉 4,000만원 이상",
        workLocation: "판교",
        employmentType: "정규직",
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

  it("exposes only public recruitment fields for OPEN postings", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    const result = await service.getPublicRecruitment(101);

    assert.deepEqual(repository.calls.findOpenPostingForPublic, [101]);
    assert.equal(result.recruitmentId, 101);
    assert.equal(result.companyName, "INIT Corp");
    assert.equal(result.status, "OPEN");
    assert.equal("companyId" in result, false);
    assert.equal("applicantCount" in result, false);
  });

  it("stores public applications as pending candidate applications", async () => {
    const repository = createRepository();
    const invitationAdapter = createInvitationAdapter();
    const publicApplicationAuthAdapter = createPublicApplicationAuthAdapter();
    const service = new CompanyRecruitingService(repository, invitationAdapter, publicApplicationAuthAdapter);

    const result = await service.submitPublicApplication(101, {
      name: "김지원",
      email: " JIWON@EXAMPLE.COM ",
      phone: "010-0000-0000",
      portfolioUrl: "https://github.com/jiwon",
      resumeText: "백엔드 프로젝트 경험이 있습니다.",
      consentAgreed: true,
    });

    assert.deepEqual(repository.calls.findOpenPostingForPublic, [101]);
    assert.deepEqual(repository.calls.findApplicationByPostingAndEmail, [101, "jiwon@example.com"]);
    assert.deepEqual(repository.calls.findOrCreatePublicCandidate, [
      {
        name: "김지원",
        email: "jiwon@example.com",
        phone: "010-0000-0000",
        portfolioUrl: "https://github.com/jiwon",
        summary: "백엔드 프로젝트 경험이 있습니다.",
      },
    ]);
    assert.deepEqual(repository.calls.createApplication, [{ postingId: 101, candidateId: 44, screeningMemo: null }]);
    assert.deepEqual(publicApplicationAuthAdapter.calls.requestEmailVerification, [
      {
        applicationId: 77,
        recruitmentId: 101,
        email: "jiwon@example.com",
      },
    ]);
    assert.equal(result.email, "jiwon@example.com");
    assert.equal(result.applicationStatus, "SUBMITTED");
    assert.equal(result.emailVerificationStatus, "PENDING");
    assert.equal(result.nextAction, "CHECK_EMAIL");
    assert.equal(result.temporary, true);
    assert.equal(result.temporaryBoundary, "B_MODULE_PUBLIC_APPLICATION_AUTH_ADAPTER");
    assert.equal(result.magicLinkDeliveryStatus, "NOT_SENT_TEMPORARY");
  });

  it("rejects duplicate public application emails", async () => {
    const repository = createRepository({
      async findApplicationByPostingAndEmail() {
        return { applicationId: 77 };
      },
    });
    const service = new CompanyRecruitingService(repository);

    await assert.rejects(
      () =>
        service.submitPublicApplication(101, {
          name: "김지원",
          email: "jiwon@example.com",
          consentAgreed: true,
        }),
      /이미 이 공고에 지원한 이메일입니다/,
    );
    assert.equal(repository.calls.findOrCreatePublicCandidate, undefined);
  });

  it("requires consent for public application submission", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    await assert.rejects(
      () =>
        service.submitPublicApplication(101, {
          name: "김지원",
          email: "jiwon@example.com",
          consentAgreed: false,
        }),
      /동의가 필요합니다/,
    );
    assert.equal(repository.calls.findApplicationByPostingAndEmail, undefined);
  });

  it("returns limited public application status for returning applicants", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    const result = await service.getPublicApplicationStatus(101, {
      email: " KIM@EXAMPLE.COM ",
    });

    assert.deepEqual(repository.calls.findPublicApplicationStatusByPostingAndEmail, [101, "kim@example.com"]);
    assert.equal(result.applicationId, 77);
    assert.equal(result.recruitmentId, 101);
    assert.equal(result.email, "kim@example.com");
    assert.equal(result.candidateName, "Kim Applicant");
    assert.deepEqual(result.recruitment, {
      companyName: "INIT Corp",
      title: "Backend Developer",
      jobRole: "Backend",
      status: "OPEN",
      startsOn: null,
      endsOn: null,
    });
    assert.deepEqual(result.statuses, {
      applicationStatus: "SUBMITTED",
      documentStatus: "NOT_SUBMITTED",
      interviewStatus: "NOT_READY",
      reportStatus: "PENDING",
    });
    assert.equal(result.interviewAccess.nextAction, "WAIT_FOR_INTERVIEW_INVITATION");
    assert.equal(result.interviewAccess.temporaryBoundary, "B_MODULE_PUBLIC_APPLICATION_STATUS_ACCESS");
    assert.equal("screeningDecision" in result, false);
    assert.equal("screeningMemo" in result, false);
    assert.equal("report" in result, false);
  });

  it("rejects invalid email for public application status lookup", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    await assert.rejects(
      () =>
        service.getPublicApplicationStatus(101, {
          email: "invalid-email",
        }),
      /이메일 형식이 올바르지 않습니다/,
    );
    assert.equal(repository.calls.findPublicApplicationStatusByPostingAndEmail, undefined);
  });

  it("updates recruitment settings for the current company only", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    const result = await service.updateRecruitment(companyUser, 101, {
      title: "Updated Backend Hiring",
      jobRole: "Backend Engineer",
      jobDescription: "Updated JD text",
      careerRequirement: "경력무관",
      educationRequirement: "학력무관",
      salaryInfo: "회사 내규에 따름",
      workLocation: "서울",
      employmentType: "계약직",
      startsOn: "2026-07-01",
      endsOn: "2026-07-31",
      status: "OPEN",
    });

    assert.equal(result.recruitmentId, 101);
    assert.equal(result.title, "Updated Backend Hiring");
    assert.equal(result.jobDescription, "Updated JD text");
    assert.equal(result.careerRequirement, "경력무관");
    assert.equal(result.employmentType, "계약직");
    assert.deepEqual(repository.calls.updatePosting, [
      101,
      7,
      {
        title: "Updated Backend Hiring",
        jobRole: "Backend Engineer",
        jobDescription: "Updated JD text",
        careerRequirement: "경력무관",
        educationRequirement: "학력무관",
        salaryInfo: "회사 내규에 따름",
        workLocation: "서울",
        employmentType: "계약직",
        startsOn: new Date("2026-07-01T00:00:00.000Z"),
        endsOn: new Date("2026-07-31T00:00:00.000Z"),
        status: "OPEN",
      },
    ]);
  });

  it("archives recruitment deletion requests for the current company only", async () => {
    const repository = createRepository({
      async findPostingForCompany(postingId: number, companyId: number) {
        return {
          postingId,
          companyId,
          title: "Draft Backend Hiring",
          jobRole: "Backend",
          jobDescription: "Build APIs",
          startsOn: null,
          endsOn: null,
          status: "DRAFT",
          createdAt: new Date("2026-06-29T00:00:00.000Z"),
          updatedAt: new Date("2026-06-29T00:00:00.000Z"),
          applicantCount: 0,
        };
      },
    });
    const service = new CompanyRecruitingService(repository);

    const result = await service.deleteRecruitment(companyUser, 101);

    assert.equal(result.recruitmentId, 101);
    assert.equal(result.status, "ARCHIVED");
    assert.deepEqual(repository.calls.archivePosting, [101, 7]);
  });

  it("rejects deleting open recruitments to keep posting status transitions", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    await assert.rejects(
      service.deleteRecruitment(companyUser, 101),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "COMMON_VALIDATION_FAILED",
    );
    assert.equal(repository.calls.archivePosting, undefined);
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
          careerRequirement: "경력 5년 이상",
          educationRequirement: "대졸 이상",
          salaryInfo: "협의 가능",
          workLocation: "판교",
          employmentType: "정규직",
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
          careerRequirement: (input as { careerRequirement?: string | null }).careerRequirement ?? null,
          educationRequirement: (input as { educationRequirement?: string | null }).educationRequirement ?? null,
          salaryInfo: (input as { salaryInfo?: string | null }).salaryInfo ?? null,
          workLocation: (input as { workLocation?: string | null }).workLocation ?? null,
          employmentType: (input as { employmentType?: string | null }).employmentType ?? null,
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
        careerRequirement: "경력 5년 이상",
        educationRequirement: "대졸 이상",
        salaryInfo: "협의 가능",
        workLocation: "판교",
        employmentType: "정규직",
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
    assert.deepEqual(repository.calls.createApplication, [
      {
        postingId: 101,
        candidateId: 44,
        screeningMemo: null,
      },
    ]);
  });

  it("bulk-registers valid applicant rows and reports a success summary", async () => {
    const bulkCalls: Record<string, unknown[]> = {};
    const repository = createRepository({
      async findOrCreateCandidate(input: { name: string; email: string; phone: string | null }) {
        bulkCalls.findOrCreateCandidate = [...(bulkCalls.findOrCreateCandidate ?? []), input];
        return { candidateId: input.email === "lee@example.com" ? 45 : 46 };
      },
      async createApplication(input: { postingId: number; candidateId: number; screeningMemo: string | null }) {
        bulkCalls.createApplication = [...(bulkCalls.createApplication ?? []), input];
        return createApplicantRecord({
          applicationId: input.candidateId === 45 ? 78 : 79,
          candidateId: input.candidateId,
          candidate: {
            candidateId: input.candidateId,
            user: {
              userId: input.candidateId + 100,
              email: input.candidateId === 45 ? "lee@example.com" : "park@example.com",
              name: input.candidateId === 45 ? "이서연" : "박지훈",
              phone: input.candidateId === 45 ? "010-1111-1111" : "010-2222-2222",
            },
          },
        });
      },
    });
    const service = new CompanyRecruitingService(repository);

    const result = await service.bulkRegisterApplicants(companyUser, {
      recruitmentId: 101,
      applicants: [
        { rowNumber: 2, name: "이서연", email: "LEE@example.com", jobRole: "Backend", phone: "010-1111-1111" },
        { rowNumber: 3, name: "박지훈", email: "park@example.com", jobRole: "Backend", phone: "010-2222-2222" },
      ],
    });

    assert.deepEqual(result.summary, { totalRows: 2, successCount: 2, failedCount: 0 });
    assert.equal(result.successes[0]?.rowNumber, 2);
    assert.equal(result.successes[0]?.applicant.email, "lee@example.com");
    assert.deepEqual(result.failures, []);
    assert.deepEqual(bulkCalls.findOrCreateCandidate, [
      { name: "이서연", email: "lee@example.com", phone: "010-1111-1111" },
      { name: "박지훈", email: "park@example.com", phone: "010-2222-2222" },
    ]);
    assert.deepEqual(bulkCalls.createApplication, [
      { postingId: 101, candidateId: 45, screeningMemo: null },
      { postingId: 101, candidateId: 46, screeningMemo: null },
    ]);
  });

  it("bulk-registers only valid rows and returns row-level failures", async () => {
    const createdEmails: string[] = [];
    const repository = createRepository({
      async findApplicationByPostingAndEmail(_postingId: number, email: string) {
        if (email === "exists@example.com") {
          return { applicationId: 123 };
        }
        return null;
      },
      async findOrCreateCandidate(input: { email: string }) {
        createdEmails.push(input.email);
        return { candidateId: 45 };
      },
      async createApplication() {
        return createApplicantRecord({
          applicationId: 78,
          candidate: {
            candidateId: 45,
            user: {
              userId: 145,
              email: "valid@example.com",
              name: "정상지원",
              phone: null,
            },
          },
        });
      },
    });
    const service = new CompanyRecruitingService(repository);

    const result = await service.bulkRegisterApplicants(companyUser, {
      recruitmentId: 101,
      applicants: [
        { rowNumber: 2, name: "", email: "missing@example.com", jobRole: "Backend" },
        { rowNumber: 3, name: "형식오류", email: "invalid-email", jobRole: "Backend" },
        { rowNumber: 4, name: "기존중복", email: "exists@example.com", jobRole: "Backend" },
        { rowNumber: 5, name: "정상지원", email: "valid@example.com", jobRole: "Backend" },
        { rowNumber: 6, name: "CSV중복", email: "VALID@example.com", jobRole: "Backend" },
        { rowNumber: 7, name: "중복1", email: "bad-name-number@example.com", jobRole: "Backend" },
        { rowNumber: 8, name: "이,서연", email: "bad-name-comma@example.com", jobRole: "Backend" },
      ],
    });

    assert.deepEqual(result.summary, { totalRows: 7, successCount: 1, failedCount: 6 });
    assert.deepEqual(createdEmails, ["valid@example.com"]);
    assert.deepEqual(
      result.failures.map((failure) => ({ rowNumber: failure.rowNumber, reason: failure.reason, field: failure.field })),
      [
        { rowNumber: 2, reason: "MISSING_REQUIRED_FIELD", field: "name" },
        { rowNumber: 3, reason: "INVALID_EMAIL", field: "email" },
        { rowNumber: 4, reason: "DUPLICATED_IN_RECRUITMENT", field: "email" },
        { rowNumber: 6, reason: "DUPLICATED_IN_CSV", field: "email" },
        { rowNumber: 7, reason: "INVALID_NAME", field: "name" },
        { rowNumber: 8, reason: "INVALID_NAME", field: "name" },
      ],
    );
  });

  it("rejects invalid applicant names in direct registration", async () => {
    const repository = createRepository();
    const service = new CompanyRecruitingService(repository);

    await assert.rejects(
      service.registerApplicant(companyUser, {
        recruitmentId: 101,
        name: "중복1",
        email: "bad-name@example.com",
        jobRole: "Backend",
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "COMMON_VALIDATION_FAILED",
    );
    assert.equal(repository.calls.findOrCreateCandidate, undefined);
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
