import type {
  ApiEnvelope,
  ApiErrorEnvelope,
  CreateInterviewQuestionInput,
  CreateInterviewQuestionResult,
  EvaluationCriteriaResult,
  InterviewSettings,
  UpdateEvaluationCriteriaInput,
  UpdateInterviewTimePolicyInput,
  UpdateInterviewTimePolicyResult,
} from "./types";
import { authFetch } from "../../api/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export async function getInterviewSettings(postingId?: number) {
  return request<InterviewSettings>("/company/interviews/settings", {
    query: { postingId },
  });
}

export async function updateEvaluationCriteria(input: UpdateEvaluationCriteriaInput) {
  return request<EvaluationCriteriaResult>("/company/interviews/evaluation-criteria", {
    method: "PATCH",
    body: input,
  });
}

export async function createInterviewQuestion(input: CreateInterviewQuestionInput) {
  return request<CreateInterviewQuestionResult>("/company/interviews/questions", {
    method: "POST",
    body: input,
  });
}

export async function updateInterviewTimePolicy(input: UpdateInterviewTimePolicyInput) {
  return request<UpdateInterviewTimePolicyResult>("/company/interviews/time-policy", {
    method: "PATCH",
    body: input,
  });
}

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH";
    query?: Record<string, string | number | undefined>;
    body?: unknown;
  } = {},
): Promise<ApiEnvelope<T>> {
  const url = new URL(`/api/v1${path}`, API_BASE_URL);
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await authFetch(url.toString(), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json()) as ApiEnvelope<T> | ApiErrorEnvelope;
  if (!response.ok || "error" in payload) {
    const message = "error" in payload ? payload.error.message : "요청 처리 중 오류가 발생했습니다.";
    throw new Error(message);
  }

  return payload;
}
