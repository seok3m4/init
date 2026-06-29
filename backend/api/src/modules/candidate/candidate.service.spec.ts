import { strict as assert } from "node:assert";
import { resolveCurrentCandidate } from "./candidate.auth";
import {
  CandidateDomainError,
  CandidateService,
  DEV_CANDIDATE_USER,
  InMemoryCandidateRepository,
} from "./candidate.service";
import { createCandidateValidationException } from "./candidate.validation";

async function run() {
  const service = new CandidateService(new InMemoryCandidateRepository());

  const currentUser = DEV_CANDIDATE_USER;
  assert.deepEqual(
    resolveCurrentCandidate({
      "x-dev-user-type": "CANDIDATE",
      "x-dev-user-id": "2",
      "x-dev-candidate-id": "1",
    }),
    currentUser,
  );
  assert.throws(
    () =>
      resolveCurrentCandidate({
        "x-dev-user-type": "COMPANY",
        "x-dev-user-id": "1",
        "x-dev-candidate-id": "1",
      }),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_FORBIDDEN",
  );

  const validationException = createCandidateValidationException([
    {
      property: "resumeFileId",
      constraints: {
        isInt: "resumeFileId must be an integer number",
      },
      children: [],
    },
  ]);
  const validationResponse = validationException.getResponse() as { error?: { code?: string }; meta?: unknown };
  assert.equal(validationResponse.error?.code, "COMMON_VALIDATION_FAILED");
  assert.ok(validationResponse.meta);

  const repository = new InMemoryCandidateRepository();
  await repository.createApplication({
    postingId: 1,
    candidateId: 99,
    resumeFileId: 1,
    consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
  });
  await assert.rejects(
    () =>
      repository.createApplication({
        postingId: 1,
        candidateId: 99,
        resumeFileId: 1,
        consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
      }),
    (error) => error instanceof CandidateDomainError && error.code === "APPLICATION_ALREADY_SUBMITTED",
  );

  const repositoryFileAsset = await repository.createFileAsset({
    ownerUserId: 99,
    storageKey: "candidate/99/resume.pdf",
    originalName: "resume.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1000,
  });
  assert.equal("content" in repositoryFileAsset, false);

  await assert.rejects(
    () =>
      repository.createFileAsset({
        ownerUserId: 99,
        storageKey: "candidate/99/resume.pdf",
        originalName: "resume.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1000,
        content: "raw-file-payload",
      } as never),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  const invalidFileRepository = new InMemoryCandidateRepository();
  const invalidFileService = new CandidateService(invalidFileRepository);
  const invalidFileAsset = await invalidFileRepository.createFileAsset({
    ownerUserId: currentUser.userId,
    storageKey: "candidate/1/profile.png",
    originalName: "profile.png",
    mimeType: "image/png",
    sizeBytes: 1000,
  });
  await assert.rejects(
    () =>
      invalidFileService.submitApplication(
        1,
        {
          candidateName: "Kim",
          email: "kim@example.com",
          phone: "010-0000-0000",
          resumeFileId: invalidFileAsset.fileId,
          portfolioUrl: "https://portfolio.example.com/kim",
          consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
        },
        currentUser,
      ),
    (error) => error instanceof CandidateDomainError && error.code === "FILE_INVALID_TYPE",
  );
  await assert.rejects(
    () =>
      invalidFileService.createPortfolioLink(
        { url: "https://portfolio.example.com/kim", fileId: invalidFileAsset.fileId },
        currentUser,
      ),
    (error) => error instanceof CandidateDomainError && error.code === "FILE_INVALID_TYPE",
  );
  const wrongPrefixFileAsset = await invalidFileRepository.createFileAsset({
    ownerUserId: currentUser.userId,
    storageKey: "candidate/2/resume.pdf",
    originalName: "resume.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1000,
  });
  await assert.rejects(
    () =>
      invalidFileService.submitApplication(
        1,
        {
          candidateName: "Kim",
          email: "kim@example.com",
          phone: "010-0000-0000",
          resumeFileId: wrongPrefixFileAsset.fileId,
          portfolioUrl: "https://portfolio.example.com/kim",
          consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
        },
        currentUser,
      ),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  const defaultJobs = await service.listJobs({} as never);
  assert.equal(defaultJobs.meta.page.page, 1);
  assert.equal(defaultJobs.meta.page.limit, 20);
  assert.equal(defaultJobs.data.items.length, 2);

  const allJobs = await service.listJobs({ page: 1, limit: 20, sort: "createdAt", order: "desc" });
  assert.equal(allJobs.data.items.length, 2);
  assert.equal(allJobs.data.items.some((job) => job.postingStatus === "CLOSED"), false);
  assert.equal(allJobs.data.items.some((job) => job.jobId === 4), false);

  const jobs = await service.listJobs({ page: 1, limit: 20, jobRole: "Android", sort: "createdAt", order: "desc" });
  assert.equal(jobs.data.items.length, 1);
  assert.equal(jobs.data.items[0]?.jobRole, "Android");
  assert.equal(jobs.data.items[0]?.jobGroup, "Engineering");
  assert.equal(jobs.meta.page.totalItems, 1);

  const filteredJobs = await service.listJobs({
    page: 1,
    limit: 20,
    q: "android",
    jobGroup: "Engineering",
    location: "Pangyo",
    careerLevel: "Entry",
    postingStatus: "CLOSING_SOON",
    sort: "endsOn",
    order: "asc",
  });
  assert.equal(filteredJobs.data.items.length, 1);
  assert.equal(filteredJobs.data.items[0]?.jobId, 2);

  await assert.rejects(
    () => service.listJobs({ page: 0, limit: 20, sort: "createdAt", order: "desc" }),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () => service.listJobs({ page: 1, limit: 101, sort: "createdAt", order: "desc" }),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () => service.listJobs({ page: 1, limit: 20, q: 42, sort: "createdAt", order: "desc" } as never),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () => service.listJobs({ page: 1, limit: 20, postingStatus: "CLOSED", sort: "createdAt", order: "desc" } as never),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () => service.listJobs({ page: 1, limit: 20, sort: "updatedAt", order: "desc" } as never),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () => service.listJobs({ page: 1, limit: 20, sort: "createdAt", order: "latest" } as never),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  const detail = await service.getJobDetail(2, currentUser);
  assert.equal(detail.data.companyName, "Jungle Works");
  assert.equal(detail.data.companyIndustry, "Mobile Platform");
  assert.equal(detail.data.canApply, true);
  assert.equal(detail.data.alreadyApplied, false);
  assert.ok(detail.data.companyProfile.includes("모바일"));

  const applyView = await service.getApplyView(2, currentUser);
  assert.equal(applyView.data.job.jobId, 2);
  assert.equal(applyView.data.documentPolicy.storageProvider, "S3");
  assert.equal(applyView.data.documentPolicy.metadataOnly, true);
  assert.equal(applyView.data.documentPolicy.maxSizeBytes, 20 * 1024 * 1024);
  assert.equal(applyView.data.documentPolicy.storageKeyPrefix, "candidate/1/");
  assert.deepEqual(applyView.data.requiredConsentTypes, ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"]);
  assert.equal(applyView.data.portfolioRequired, true);

  await assert.rejects(
    () => service.getJobDetail(Number.NaN, currentUser),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () =>
      service.submitApplication(
        0,
        {
          candidateName: "Kim",
          email: "kim@example.com",
          phone: "010-0000-0000",
          resumeFileId: 1,
          portfolioUrl: "https://portfolio.example.com/kim",
          consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
        },
        currentUser,
      ),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () =>
      service.submitApplication(
        1,
        {
          email: "kim@example.com",
          phone: "010-0000-0000",
          resumeFileId: 1,
          portfolioUrl: "https://portfolio.example.com/kim",
          consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
        } as never,
        currentUser,
      ),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () =>
      service.submitApplication(
        1,
        {
          candidateName: "Kim",
          email: "not-an-email",
          phone: "010-0000-0000",
          resumeFileId: 1,
          portfolioUrl: "https://portfolio.example.com/kim",
          consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
        },
        currentUser,
      ),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () =>
      service.submitApplication(
        1,
        {
          candidateName: "Kim",
          email: "kim@example.com",
          phone: "010-0000-0000",
          resumeFileId: 1,
          portfolioFileId: -1,
          consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
        },
        currentUser,
      ),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () =>
      service.submitApplication(
        1,
        {
          candidateName: "Kim",
          email: "kim@example.com",
          phone: "010-0000-0000",
          resumeFileId: 1,
          portfolioUrl: "https://portfolio.example.com/kim",
        } as never,
        currentUser,
      ),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () =>
      service.submitApplication(
        1,
        {
          candidateName: "Kim",
          email: "kim@example.com",
          phone: "010-0000-0000",
          resumeFileId: 1,
          portfolioUrl: "https://portfolio.example.com/kim",
          consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS", "MARKETING_OPT_IN" as never],
        },
        currentUser,
      ),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  const resume = await service.uploadResume({
    storageKey: "candidate/1/resume.pdf",
    originalName: "resume.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1000,
  }, currentUser);
  assert.equal(resume.data.storageKey, "candidate/1/resume.pdf");
  assert.equal("content" in resume.data, false);
  assert.equal("buffer" in resume.data, false);
  assert.equal("base64" in resume.data, false);

  await assert.rejects(
    () =>
      service.submitApplication(
        1,
        {
          candidateName: "Kim",
          email: "kim@example.com",
          phone: "010-0000-0000",
          resumeFileId: 999,
          portfolioUrl: "https://portfolio.example.com/kim",
          consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
        },
        currentUser,
      ),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_NOT_FOUND",
  );

  await assert.rejects(
    () =>
      service.submitApplication(
        1,
        {
          candidateName: "Kim",
          email: "kim@example.com",
          phone: "010-0000-0000",
          resumeFileId: resume.data.fileId,
          consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
        },
        currentUser,
      ),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  const submitted = await service.submitApplication(
    1,
    {
      candidateName: "Kim",
      email: "kim@example.com",
      phone: "010-0000-0000",
      resumeFileId: resume.data.fileId,
      portfolioUrl: "https://portfolio.example.com/kim",
      consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
    },
    currentUser,
  );
  assert.equal(submitted.data.application.applicationStatus, "SUBMITTED");
  assert.equal(submitted.data.application.documentStatus, "SUBMITTED");
  assert.equal(submitted.data.application.interviewStatus, "NOT_READY");
  assert.equal(submitted.data.application.postingId, 1);
  assert.equal(submitted.data.application.candidateId, currentUser.candidateId);
  assert.equal(submitted.data.documents.length, 1);
  assert.equal(submitted.data.documents[0]?.applicationId, submitted.data.application.applicationId);
  assert.equal(submitted.data.documents[0]?.fileId, resume.data.fileId);
  assert.equal(submitted.data.documents[0]?.documentType, "RESUME");
  assert.equal(submitted.data.documents[0]?.parseStatus, "SUBMITTED");
  assert.equal(submitted.data.consents.length, 2);
  assert.equal(submitted.data.consents[0]?.applicationId, submitted.data.application.applicationId);
  assert.equal(submitted.data.consents[0]?.agreed, true);
  assert.equal(submitted.data.portfolioLink?.applicationId, submitted.data.application.applicationId);
  assert.equal(submitted.data.portfolioLink?.linkType, "PORTFOLIO");

  const submittedJobDetail = await service.getJobDetail(1, currentUser);
  assert.equal(submittedJobDetail.data.alreadyApplied, true);
  assert.equal(submittedJobDetail.data.canApply, false);

  const submittedApplyView = await service.getApplyView(1, currentUser);
  assert.equal(submittedApplyView.data.job.alreadyApplied, true);
  assert.equal(submittedApplyView.data.job.canApply, false);

  await assert.rejects(
    () =>
      service.submitApplication(
        1,
        {
          candidateName: "Kim",
          email: "kim@example.com",
          phone: "010-0000-0000",
          resumeFileId: resume.data.fileId,
          portfolioUrl: "https://portfolio.example.com/kim",
          consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
        },
        currentUser,
      ),
    (error) => error instanceof CandidateDomainError && error.code === "APPLICATION_ALREADY_SUBMITTED",
  );

  await assert.rejects(
    () =>
      service.uploadResume({
        storageKey: "candidate/1/resume.exe",
        originalName: "resume.exe",
        mimeType: "application/x-msdownload",
        sizeBytes: 1000,
      }, currentUser),
    (error) => error instanceof CandidateDomainError && error.code === "FILE_INVALID_TYPE",
  );

  await assert.rejects(
    () =>
      service.uploadResume({
        storageKey: "candidate/1/resume.pdf",
        originalName: "resume.pdf",
        mimeType: "application/pdf",
        sizeBytes: 20 * 1024 * 1024 + 1,
      }, currentUser),
    (error) => error instanceof CandidateDomainError && error.code === "FILE_SIZE_EXCEEDED",
  );

  await assert.rejects(
    () =>
      service.uploadResume({
        originalName: "resume.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1000,
      } as never, currentUser),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () =>
      service.uploadResume({
        storageKey: "candidate/1/resume.pdf",
        originalName: "resume.pdf",
        mimeType: "application/pdf",
        sizeBytes: 0,
      }, currentUser),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () =>
      service.uploadResume({
        storageKey: "candidate/1/resume.pdf",
        originalName: "resume.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1000,
        content: "raw-file-payload",
      } as never, currentUser),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () =>
      service.uploadResume({
        storageKey: "candidate/2/resume.pdf",
        originalName: "resume.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1000,
      }, currentUser),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  const portfolioFile = await service.uploadResume({
    storageKey: "candidate/1/portfolio.pdf",
    originalName: "portfolio.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1000,
  }, currentUser);
  await assert.rejects(
    () =>
      service.submitApplication(
        2,
        {
          candidateName: "Kim",
          email: "kim@example.com",
          phone: "010-0000-0000",
          resumeFileId: resume.data.fileId,
          portfolioUrl: "ftp://example.com/portfolio",
          consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
        },
        currentUser,
      ),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );
  const secondSubmitted = await service.submitApplication(
    2,
    {
      candidateName: "Kim",
      email: "kim@example.com",
      phone: "010-0000-0000",
      resumeFileId: resume.data.fileId,
      portfolioFileId: portfolioFile.data.fileId,
      portfolioUrl: "https://github.com/example",
      consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
    },
    currentUser,
  );
  assert.equal(secondSubmitted.data.documents.length, 2);
  assert.equal(secondSubmitted.data.application.postingId, 2);
  assert.equal(secondSubmitted.data.documents[0]?.applicationId, secondSubmitted.data.application.applicationId);
  assert.equal(secondSubmitted.data.documents[0]?.fileId, resume.data.fileId);
  assert.equal(secondSubmitted.data.documents[0]?.parseStatus, "SUBMITTED");
  assert.equal(secondSubmitted.data.documents[1]?.applicationId, secondSubmitted.data.application.applicationId);
  assert.equal(secondSubmitted.data.documents[1]?.fileId, portfolioFile.data.fileId);
  assert.equal(secondSubmitted.data.documents[1]?.parseStatus, "SUBMITTED");
  assert.equal(secondSubmitted.data.portfolioLink?.applicationId, secondSubmitted.data.application.applicationId);
  assert.equal(secondSubmitted.data.portfolioLink?.linkType, "GITHUB");
  assert.equal(secondSubmitted.data.portfolioLink?.url, "https://github.com/example");
  assert.equal(secondSubmitted.data.documents[0]?.documentType, "RESUME");
  assert.equal(secondSubmitted.data.documents[1]?.documentType, "PORTFOLIO");
  assert.notEqual(secondSubmitted.data.documents[0]?.documentId, secondSubmitted.data.documents[1]?.documentId);

  await assert.rejects(
    () => service.getJobDetail(3, currentUser),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_NOT_FOUND",
  );

  await assert.rejects(
    () => service.getJobDetail(4, currentUser),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_NOT_FOUND",
  );

  await assert.rejects(
    () =>
      service.submitApplication(
        2,
        {
          candidateName: "Kim",
          email: "kim@example.com",
          phone: "010-0000-0000",
          resumeFileId: resume.data.fileId,
          portfolioUrl: "https://portfolio.example.com/kim",
          consentTypes: ["PRIVACY_COLLECTION"],
        },
        currentUser,
      ),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  const portfolio = await service.createPortfolioLink(
    { linkType: "GITHUB", url: "https://github.com/example", description: "GitHub" },
    currentUser,
  );
  assert.equal(portfolio.data.candidateId, currentUser.candidateId);
  assert.equal(portfolio.data.applicationId, undefined);
  assert.equal(portfolio.data.linkType, "GITHUB");

  await assert.rejects(
    () => service.createPortfolioLink({ description: "Missing URL" } as never, currentUser),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () => service.createPortfolioLink({ linkType: "BLOG" as never, url: "https://example.com" }, currentUser),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () => service.createPortfolioLink({ url: "https://example.com", fileId: -1 }, currentUser),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () => service.createPortfolioLink({ url: "ftp://example.com" }, currentUser),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );

  await assert.rejects(
    () => service.createPortfolioLink({ linkType: "GITHUB", url: "https://example.com/not-github" }, currentUser),
    (error) => error instanceof CandidateDomainError && error.code === "COMMON_VALIDATION_FAILED",
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
