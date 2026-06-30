import { CandidateDomainError } from "./candidate.service";

export interface CandidateErrorResponse {
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
  meta: {
    traceId: string;
    timestamp: string;
  };
}

export function createCandidateErrorResponse(
  error: CandidateDomainError,
  traceId = "local-candidate-module",
): CandidateErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
    meta: {
      traceId,
      timestamp: new Date().toISOString(),
    },
  };
}
