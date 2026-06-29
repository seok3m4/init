import { strict as assert } from "node:assert";
import { interviewApiRoutePrefix, interviewApiRoutes } from "./interview.routes";

assert.equal(interviewApiRoutePrefix, "api/v1/candidate");
assert.equal(interviewApiRoutes.deviceCheck, "interviews/:sessionId/device-check");
assert.equal(interviewApiRoutes.startInterview, "applications/:applicationId/interview/start");
assert.equal(interviewApiRoutes.interviewRuntime, "applications/:applicationId/interview");
