import "reflect-metadata";
import { strict as assert } from "node:assert";
import { HttpException, RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import {
  CandidateDomainError,
  CandidateService,
  DEV_CANDIDATE_USER,
  InMemoryCandidateRepository,
  type CandidateErrorResponse,
} from "../candidate";
import { InterviewController } from "./interview.controller";
import { interviewApiRoutePrefix, interviewApiRoutes } from "./interview.routes";
import { InterviewService } from "./interview.service";

const validCandidateHeaders = {
  "x-dev-user-type": "CANDIDATE",
  "x-dev-user-id": "2",
  "x-dev-candidate-id": "1",
};

assert.equal(Reflect.getMetadata(PATH_METADATA, InterviewController), interviewApiRoutePrefix);
assert.equal(
  Reflect.getMetadata(PATH_METADATA, InterviewController.prototype.saveDeviceCheck),
  interviewApiRoutes.deviceCheck,
);
assert.equal(Reflect.getMetadata(METHOD_METADATA, InterviewController.prototype.saveDeviceCheck), RequestMethod.POST);
assert.equal(
  Reflect.getMetadata(PATH_METADATA, InterviewController.prototype.startInterview),
  interviewApiRoutes.startInterview,
);
assert.equal(Reflect.getMetadata(METHOD_METADATA, InterviewController.prototype.startInterview), RequestMethod.POST);
assert.equal(
  Reflect.getMetadata(PATH_METADATA, InterviewController.prototype.getInterviewRuntime),
  interviewApiRoutes.interviewRuntime,
);
assert.equal(Reflect.getMetadata(METHOD_METADATA, InterviewController.prototype.getInterviewRuntime), RequestMethod.GET);

async function assertInterviewHttpError(
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

    const response = error.getResponse() as CandidateErrorResponse;
    assert.equal(response.error.code, expectedCode);
    assert.ok(Array.isArray(response.error.details));
    assert.equal(response.meta.traceId, "local-candidate-module");
  }
}

async function runControllerRuntimeAssertions() {
  const repository = new InMemoryCandidateRepository();
  const candidateService = new CandidateService(repository);
  const controller = new InterviewController(new InterviewService(candidateService));

  const submitted = await repository.createApplication({
    postingId: 1,
    candidateId: DEV_CANDIDATE_USER.candidateId,
    resumeFileId: 1,
    consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS"],
  });
  const session = await repository.findInterviewSessionByApplication(submitted.application.applicationId);
  assert.ok(session);

  await assertInterviewHttpError(
    () => controller.startInterview(validCandidateHeaders, String(submitted.application.applicationId)),
    409,
    "COMMON_CONFLICT",
  );

  await assertInterviewHttpError(
    () => controller.saveDeviceCheck({}, String(session.sessionId), {
      cameraGranted: true,
      microphoneGranted: true,
      networkStable: true,
    }),
    401,
    "COMMON_UNAUTHORIZED",
  );

  await assert.rejects(
    () =>
      candidateService.saveDeviceCheck(
        session.sessionId,
        { cameraGranted: false, microphoneGranted: true, networkStable: true },
        DEV_CANDIDATE_USER,
      ),
    (error) => error instanceof CandidateDomainError && error.code === "DEVICE_PERMISSION_DENIED",
  );

  await candidateService.saveInterviewConsent(
    submitted.application.applicationId,
    { consentTypes: ["PRIVACY_COLLECTION", "AI_DOCUMENT_ANALYSIS", "AI_INTERVIEW_RECORDING"] },
    DEV_CANDIDATE_USER,
  );

  const response = await controller.saveDeviceCheck(validCandidateHeaders, String(session.sessionId), {
    cameraGranted: true,
    microphoneGranted: true,
    networkStable: true,
  });
  assert.equal(response.data.applicationId, submitted.application.applicationId);
  assert.equal(response.data.sessionId, session.sessionId);
  assert.equal(response.data.consentCompleted, true);
  assert.equal(response.data.deviceCheckCompleted, true);
  assert.equal(response.data.canStart, true);
  assert.equal(response.data.deviceCheck.status, "PASSED");

  const started = await controller.startInterview(validCandidateHeaders, String(submitted.application.applicationId));
  assert.equal(started.data.applicationId, submitted.application.applicationId);
  assert.equal(started.data.sessionId, session.sessionId);
  assert.equal(started.data.interviewStatus, "IN_PROGRESS");
  assert.equal(started.data.sessionStatus, "IN_PROGRESS");

  const runtime = await controller.getInterviewRuntime(
    validCandidateHeaders,
    String(submitted.application.applicationId),
  );
  assert.equal(runtime.data.applicationId, submitted.application.applicationId);
  assert.equal(runtime.data.sessionId, session.sessionId);
  assert.equal(runtime.data.status, "IN_PROGRESS");
  assert.equal(runtime.data.canRecord, true);
}

runControllerRuntimeAssertions().catch((error) => {
  console.error(error);
  process.exit(1);
});
