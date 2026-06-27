import { CurrentUser } from "../common/dev-auth/current-user";

export type ReportType = "MOCK_INTERVIEW_REPORT" | "RECRUITING_REPORT";
export type AiProcessType = "REPORT_GENERATE";
export type AiProcessStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type GuardrailResult = "PASS" | "BLOCKED" | "REGENERATED";

export interface EvaluationCriterionInput {
  criterionId: number;
  name: string;
  description?: string;
  weight: number;
}

export interface InterviewAnswerInput {
  answerId: number;
  question: string;
  transcript: string;
}

export interface GenerateReportRequest {
  reportType: ReportType;
  jobDescription: string;
  documentText?: string;
  criteria: EvaluationCriterionInput[];
  answers: InterviewAnswerInput[];
}

export interface GenerateReportCommand {
  currentUser: CurrentUser;
  reportId: number;
  body: GenerateReportRequest;
}

export interface ReportEvidence {
  answerId: number;
  text: string;
}

export interface ReportScore {
  criterionId: number;
  criterionName: string;
  score: number;
  rationale: string;
  evidences: ReportEvidence[];
}

export interface GeneratedReport {
  summary: string;
  totalScore: number;
  scores: ReportScore[];
}

export interface GuardrailDecision {
  result: GuardrailResult;
  reason: string | null;
}

export interface ProcessLogSnapshot {
  processLogId: number;
  processType: AiProcessType;
  status: AiProcessStatus;
}

export interface GenerateReportResult extends GeneratedReport {
  processLogId: number;
  processType: AiProcessType;
  status: AiProcessStatus;
  reportId: number;
  guardrail: GuardrailDecision;
}
