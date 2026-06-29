export const candidateApiRoutePrefix = "api/v1/candidate";

export const candidateApiRoutes = {
  jobs: "jobs",
  jobDetail: "jobs/:jobId",
  applyView: "jobs/:jobId/apply",
  submitApplication: "jobs/:jobId/applications",
  applications: "applications",
  interviewGuide: "applications/:applicationId/interview-guide",
  interviewConsent: "applications/:applicationId/consent",
  resume: "resume",
  portfolioLinks: "portfolio-links",
} as const;
