import "reflect-metadata";
import { strict as assert } from "node:assert";
import { HttpException, RequestMethod } from "@nestjs/common";
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { CandidateController } from "./candidate.controller";
import { candidateApiRoutePrefix, candidateApiRoutes } from "./candidate.routes";
import { CandidateService, DEV_CANDIDATE_USER, InMemoryCandidateRepository } from "./candidate.service";

type CandidateControllerRoute =
  | "listJobs"
  | "getJobDetail"
  | "getApplyView"
  | "submitApplication"
  | "uploadResume"
  | "createPortfolioLink"
  | "listApplications"
  | "getInterviewGuide"
  | "saveInterviewConsent";

function assertRoute(
  methodName: CandidateControllerRoute,
  expectedPath: string,
  expectedMethod: RequestMethod,
  expectedStatusCode?: number,
) {
  const handler = CandidateController.prototype[methodName];

  assert.equal(Reflect.getMetadata(PATH_METADATA, handler), expectedPath);
  assert.equal(Reflect.getMetadata(METHOD_METADATA, handler), expectedMethod);
  if (expectedStatusCode) {
    assert.equal(Reflect.getMetadata(HTTP_CODE_METADATA, handler), expectedStatusCode);
  }
}

assert.equal(Reflect.getMetadata(PATH_METADATA, CandidateController), candidateApiRoutePrefix);
assertRoute("listJobs", candidateApiRoutes.jobs, RequestMethod.GET);
assertRoute("getJobDetail", candidateApiRoutes.jobDetail, RequestMethod.GET);
assertRoute("getApplyView", candidateApiRoutes.applyView, RequestMethod.GET);
assertRoute("submitApplication", candidateApiRoutes.submitApplication, RequestMethod.POST, 201);
assertRoute("uploadResume", candidateApiRoutes.resume, RequestMethod.POST, 201);
assertRoute("createPortfolioLink", candidateApiRoutes.portfolioLinks, RequestMethod.POST, 201);
assertRoute("listApplications", candidateApiRoutes.applications, RequestMethod.GET);
assertRoute("getInterviewGuide", candidateApiRoutes.interviewGuide, RequestMethod.GET);
assertRoute("saveInterviewConsent", candidateApiRoutes.interviewConsent, RequestMethod.POST);

const validCandidateRequest = {
  headers: {},
  currentUser: { ...DEV_CANDIDATE_USER, companyId: null },
};

const missingCandidateRequest = {
  headers: {},
  currentUser: undefined,
} as never;

async function assertCandidateHttpError(
  action: () => Promise<unknown>,
  expectedStatus: number,
  expectedCode: string,
) {
  try {
    await action();
    assert.fail(`Expected ${expectedCode}`);
  } catch (error) {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), expectedStatus);

    const response = error.getResponse() as { code?: string; details?: unknown[] };
    assert.equal(response.code, expectedCode);
    assert.ok(Array.isArray(response.details));
  }
}

async function runControllerRuntimeAssertions() {
  const controller = new CandidateController(new CandidateService(new InMemoryCandidateRepository()));

  const listResponse = await controller.listJobs(validCandidateRequest, {
    page: 1,
    limit: 20,
    sort: "createdAt",
    order: "desc",
  });
  assert.equal(listResponse.data.items.length, 2);
  assert.equal(listResponse.data.items.some((job) => job.postingStatus === "CLOSED"), false);

  await assertCandidateHttpError(
    () => controller.listJobs(missingCandidateRequest, { page: 1, limit: 20, sort: "createdAt", order: "desc" }),
    401,
    "COMMON_UNAUTHORIZED",
  );

  await assertCandidateHttpError(
    () => controller.getJobDetail(validCandidateRequest, "3"),
    404,
    "COMMON_NOT_FOUND",
  );

  await assertCandidateHttpError(
    () =>
      controller.uploadResume(validCandidateRequest, {
        storageKey: "candidate/1/resume.exe",
        originalName: "resume.exe",
        mimeType: "application/x-msdownload",
        sizeBytes: 1000,
      }),
    400,
    "FILE_INVALID_TYPE",
  );

  await assertCandidateHttpError(
    () =>
      controller.uploadResume(validCandidateRequest, {
        storageKey: "candidate/1/resume.pdf",
        originalName: "resume.pdf",
        mimeType: "application/pdf",
        sizeBytes: 20 * 1024 * 1024 + 1,
      }),
    400,
    "FILE_SIZE_EXCEEDED",
  );

  const resume = await controller.uploadResume(validCandidateRequest, {
    storageKey: "candidate/1/controller-resume.pdf",
    originalName: "controller-resume.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1000,
  });

  await assertCandidateHttpError(
    () =>
      controller.submitApplication(validCandidateRequest, "1", {
        candidateName: "Kim",
        email: "kim@example.com",
        phone: "010-0000-0000",
        resumeFileId: resume.data.fileId,
        portfolioUrl: "https://portfolio.example.com/kim",
        consentTypes: ["PRIVACY_COLLECTION"],
      }),
    400,
    "COMMON_VALIDATION_FAILED",
  );

  const submitted = await controller.submitApplication(validCandidateRequest, "1", {
    candidateName: "Kim",
    email: "kim@example.com",
    phone: "010-0000-0000",
    resumeFileId: resume.data.fileId,
    portfolioUrl: "https://portfolio.example.com/kim",
    consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
  });

  const applications = await controller.listApplications(validCandidateRequest);
  assert.equal(applications.data.items.length, 1);
  assert.equal(applications.data.items[0]?.applicationId, submitted.data.application.applicationId);
  assert.equal(applications.data.items[0]?.interviewStatus, "NOT_READY");
  assert.equal(applications.data.items[0]?.reportStatus, "PENDING");
  assert.equal(applications.data.items[0]?.canStartInterview, false);

  const guide = await controller.getInterviewGuide(
    validCandidateRequest,
    String(submitted.data.application.applicationId),
  );
  assert.equal(guide.data.applicationId, submitted.data.application.applicationId);
  assert.equal(guide.data.sessionId, applications.data.items[0]?.sessionId);
  assert.equal(guide.data.canStart, false);

  const consent = await controller.saveInterviewConsent(
    validCandidateRequest,
    String(submitted.data.application.applicationId),
    { consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS", "AI_INTERVIEW_RECORDING"] },
  );
  assert.equal(consent.data.applicationId, submitted.data.application.applicationId);
  assert.equal(consent.data.sessionId, applications.data.items[0]?.sessionId);
  assert.equal(consent.data.consentCompleted, true);
  assert.equal(consent.data.deviceCheckCompleted, false);

  await assertCandidateHttpError(
    () =>
      controller.submitApplication(validCandidateRequest, "1", {
        candidateName: "Kim",
        email: "kim@example.com",
        phone: "010-0000-0000",
        resumeFileId: resume.data.fileId,
        portfolioUrl: "https://portfolio.example.com/kim",
        consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
      }),
    409,
    "APPLICATION_ALREADY_SUBMITTED",
  );
}

test("candidate controller contract", async () => {
  await runControllerRuntimeAssertions();
});
