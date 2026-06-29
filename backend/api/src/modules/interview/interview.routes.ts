export const interviewApiRoutePrefix = "api/v1/candidate";

export const interviewApiRoutes = {
  deviceCheck: "interviews/:sessionId/device-check",
  startInterview: "applications/:applicationId/interview/start",
  interviewRuntime: "applications/:applicationId/interview",
} as const;
