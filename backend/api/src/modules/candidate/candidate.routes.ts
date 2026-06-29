export const candidateApiRoutePrefix = "api/v1/candidate";

export const candidateApiRoutes = {
  jobs: "jobs",
  jobDetail: "jobs/:jobId",
  applyView: "jobs/:jobId/apply",
  submitApplication: "jobs/:jobId/applications",
  resume: "resume",
  portfolioLinks: "portfolio-links",
} as const;
