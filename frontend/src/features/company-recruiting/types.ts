export type ApiEnvelope<T> = {
  data: T;
  meta: {
    traceId: string;
    timestamp: string;
    page?: PageMeta;
  };
};

export type ApiErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
  meta?: {
    traceId: string;
    timestamp: string;
  };
};

export type PageMeta = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
};

export type Recruitment = {
  recruitmentId: number;
  postingId: number;
  companyId: number;
  title: string;
  jobRole: string;
  jobDescription: string | null;
  startsOn: string | null;
  endsOn: string | null;
  status: "DRAFT" | "OPEN" | "CLOSING_SOON" | "CLOSED" | "ARCHIVED";
  applicantCount: number;
  createdAt: string;
  updatedAt: string;
};

export type RecruitmentStatus = Recruitment["status"];

export type CreateRecruitmentInput = {
  title: string;
  jobRole: string;
  jobDescription?: string;
  startsOn?: string;
  endsOn?: string;
  status: "DRAFT" | "OPEN";
};

export type UpdateRecruitmentInput = CreateRecruitmentInput;

export type Applicant = {
  applicantId: number;
  applicationId: number;
  recruitmentId: number;
  candidateId: number;
  name: string;
  email: string;
  phone: string | null;
  jobRole: string;
  applicationStatus: string;
  documentStatus: string;
  interviewStatus: string;
  reportStatus: string;
  screeningDecision: string;
  screeningMemo: string | null;
  interviewSession: {
    sessionId: number;
    status: string;
    interviewType: string;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
  report: {
    reportId: number;
    status: string;
    totalScore: number | null;
    summary: string | null;
    generatedAt: string | null;
  } | null;
  updatedAt: string;
};

export type ScreeningDecision = "UNDECIDED" | "PASS" | "HOLD" | "FAIL";

export type CreateApplicantInput = {
  recruitmentId: number;
  name: string;
  email: string;
  jobRole: string;
  phone?: string;
};

export type InviteApplicantInput = {
  applicantId: number;
  availableFrom: string;
  availableUntil: string;
  message: string;
};

export type InvitationResult = {
  invitationId: string;
  applicantId: number;
  applicationId: number;
  recruitmentId: number;
  candidateId: number;
  email: string;
  availableFrom: string;
  availableUntil: string;
  message: string;
  deliveryStatus: string;
  temporary: boolean;
  temporaryBoundary: string;
  sessionConnection: {
    status: string;
    interviewType: string;
    temporary: boolean;
  };
};

export type ApplicantEvaluation = {
  applicant: Applicant;
  recruitment: {
    recruitmentId: number;
    postingId: number;
    title: string;
    jobRole: string;
  };
  statuses: {
    applicationStatus: string;
    documentStatus: string;
    interviewStatus: string;
    reportStatus: string;
  };
  screening: {
    decision: ScreeningDecision;
    memo: string | null;
  };
  reportAvailability: "AVAILABLE" | "NONE_OR_GENERATING";
  report: {
    reportId: number;
    status: string;
    totalScore: number | null;
    summary: string | null;
    generatedAt: string | null;
    scores: Array<{
      scoreId: number;
      criterionId: number | null;
      criterionName: string | null;
      score: number;
      rationale: string | null;
      evidences: Array<{
        evidenceId: number;
        evidenceText: string;
      }>;
    }>;
  } | null;
};

export type UpdateScreeningStatusInput = {
  screeningDecision: ScreeningDecision;
  screeningMemo?: string;
};
