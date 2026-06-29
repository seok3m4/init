import { strict as assert } from "node:assert";
import { candidateApiRoutePrefix, candidateApiRoutes } from "./candidate.routes";

assert.equal(candidateApiRoutePrefix, "api/v1/candidate");
assert.equal(candidateApiRoutes.jobs, "jobs");
assert.equal(candidateApiRoutes.jobDetail, "jobs/:jobId");
assert.equal(candidateApiRoutes.applyView, "jobs/:jobId/apply");
assert.equal(candidateApiRoutes.submitApplication, "jobs/:jobId/applications");
assert.equal(candidateApiRoutes.resume, "resume");
assert.equal(candidateApiRoutes.portfolioLinks, "portfolio-links");
