export const candidateApplicationInterviewRoutes = {
  jobs: "/candidate/jobs",
  jobDetail: (jobId: number) => `/candidate/jobs/${jobId}`,
  apply: (jobId: number) => `/candidate/jobs/${jobId}/apply`,
  applications: "/candidate/applications",
  interviewGuide: (applicationId: number) => `/candidate/applications/${applicationId}/interview-guide`,
  interview: (applicationId: number) => `/candidate/applications/${applicationId}/interview`,
  mypage: "/candidate/mypage",
} as const;

export const candidateApplicationInterviewFeature = {
  owner: "D",
  featureFolder: "frontend/src/features/candidate-application-interview",
  routes: candidateApplicationInterviewRoutes,
} as const;
