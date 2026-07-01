export type PostingStatus = "DRAFT" | "OPEN" | "CLOSING_SOON" | "CLOSED" | "ARCHIVED";

export type QuestionType = "INTRO" | "TECHNICAL" | "EXPERIENCE" | "SITUATION" | "FOLLOW_UP" | "CLOSING";

export type InterviewSettings = {
  posting: {
    postingId: number;
    title: string;
    status: PostingStatus;
  };
  availableTags: Array<{
    tagId: number;
    jobRole: string;
    tagName: string;
    category: string;
    description: string | null;
    sortOrder: number;
  }>;
  criteria: Array<{
    criterionId: number;
    tagId: number;
    tagName: string;
    category: string;
    description: string | null;
    weight: number;
    passScore: number | null;
    sortOrder: number;
  }>;
  questions: Array<{
    questionId: number;
    criterionId: number | null;
    questionType: QuestionType;
    content: string;
    isActive: boolean;
  }>;
  timePolicy: {
    preparationTimeSec: number;
    answerTimeSec: number;
    retryAllowed: boolean;
  };
};

export type UpdateEvaluationCriteriaInput = {
  postingId: number;
  criteria: Array<{
    criterionId?: number;
    tagId: number;
    weight: number;
    passScore?: number | null;
    sortOrder: number;
  }>;
};

export type EvaluationCriteriaResult = {
  postingId: number;
  criteria: InterviewSettings["criteria"];
  totalWeight: number;
};

export type AiJobResult = {
  processLogId: number;
  processType?: string;
  status: string;
  queued?: boolean;
  inputRef?: string;
};

export type SuggestEvaluationCriteriaInput = {
  postingId: number;
  jobRole?: string;
  jdText?: string;
  companyFitText?: string;
  requestedCount?: number;
  jobDescription: string;
  talentProfile: string;
  evaluationPolicy: string;
};

export type CreateInterviewQuestionInput = {
  postingId: number;
  criterionId: number;
  questionType: QuestionType;
  content: string;
};

export type UpdateInterviewQuestionInput = {
  criterionId: number;
  questionType: QuestionType;
  content: string;
};

export type CreateInterviewQuestionResult = {
  postingId: number;
  question: {
    questionId: number;
    postingId: number | null;
    criterionId: number | null;
    questionType: QuestionType;
    content: string;
    isActive: boolean;
  };
};

export type UpdateInterviewTimePolicyInput = {
  postingId: number;
  preparationTimeSec: number;
  answerTimeSec: number;
  retryAllowed: boolean;
};

export type UpdateInterviewTimePolicyResult = {
  postingId: number;
  timePolicy: InterviewSettings["timePolicy"];
};

export type GenerateInterviewQuestionsInput = {
  postingId: number;
  jobDescription: string;
  questionCount: number;
};

export type GenerateQuestionSetInput = {
  postingId: number;
  questionCount: number;
  criteria: Array<{
    criterionId: number;
    name: string;
    weight?: number;
  }>;
  questionTypes: string[];
};

export type ApiEnvelope<T> = {
  data: T;
  meta: {
    traceId: string;
    timestamp: string;
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
