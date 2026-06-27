export type UserType = "ADMIN" | "COMPANY" | "CANDIDATE";

export type CurrentUser = {
  userId: number;
  userType: UserType;
  companyId: number | null;
  candidateId: number | null;
};

export const ERROR_CODES = {
  COMMON_VALIDATION_FAILED: "COMMON_VALIDATION_FAILED",
  COMMON_UNAUTHORIZED: "COMMON_UNAUTHORIZED",
  COMMON_FORBIDDEN: "COMMON_FORBIDDEN",
  COMMON_NOT_FOUND: "COMMON_NOT_FOUND",
  COMMON_CONFLICT: "COMMON_CONFLICT",
  COMMON_RATE_LIMITED: "COMMON_RATE_LIMITED",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_USER_TYPE_MISMATCH: "AUTH_USER_TYPE_MISMATCH",
  AUTH_EMAIL_DUPLICATED: "AUTH_EMAIL_DUPLICATED",
  AUTH_EMAIL_CODE_INVALID: "AUTH_EMAIL_CODE_INVALID",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    details: Array<Record<string, unknown>>;
  };
};

export type ApiSuccessBody<T> = {
  data: T;
  meta: {
    traceId: string;
    timestamp: string;
  };
};

export const USER_TYPES = ["ADMIN", "COMPANY", "CANDIDATE"] as const;

export const isUserType = (value: unknown): value is UserType =>
  typeof value === "string" && USER_TYPES.includes(value as UserType);
