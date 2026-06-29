export const reportApiRoutePrefix = "api/v1/candidate";

export const reportApiRoutes = {
  mockReports: "mock-interview/reports",
  mockHistory: "mock-interviews/history",
  mockFeedback: "mock-interview/reports/:reportId/feedback",
  mockMedia: "mock-interview/reports/:reportId/media",
  mockGenerate: "mock-interview/reports/:reportId/generate",
  applicationReport: "applications/:applicationId/report",
  applicationStatus: "applications/:applicationId/status",
} as const;
