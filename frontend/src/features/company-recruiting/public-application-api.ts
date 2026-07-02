import type { ApiEnvelope, ApiErrorEnvelope, Recruitment } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export type PublicRecruitment = Pick<
  Recruitment,
  | "recruitmentId"
  | "postingId"
  | "title"
  | "jobRole"
  | "jobDescription"
  | "careerRequirement"
  | "educationRequirement"
  | "salaryInfo"
  | "workLocation"
  | "employmentType"
  | "startsOn"
  | "endsOn"
  | "status"
> & {
  companyName: string;
};

export type PublicApplicationInput = {
  name: string;
  email: string;
  phone?: string;
  portfolioUrl?: string;
  resumeText?: string;
  consentAgreed: boolean;
};

export type PublicApplicationResult = {
  applicationId: number;
  recruitmentId: number;
  email: string;
  applicationStatus: string;
  emailVerificationStatus: "PENDING";
  nextAction: "CHECK_EMAIL";
};

export async function getPublicRecruitment(recruitmentId: number) {
  return request<PublicRecruitment>(`/public/recruitments/${recruitmentId}`);
}

export async function submitPublicApplication(recruitmentId: number, input: PublicApplicationInput) {
  return request<PublicApplicationResult>(`/public/recruitments/${recruitmentId}/applications`, {
    method: "POST",
    body: input,
  });
}

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
  } = {},
): Promise<ApiEnvelope<T>> {
  const url = new URL(`/api/v1${path}`, API_BASE_URL);
  const response = await fetch(url.toString(), {
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
