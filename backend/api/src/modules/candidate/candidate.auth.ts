import { CandidateDomainError } from "./candidate.service";
import type { CurrentCandidateUser } from "./candidate.types";

type HeaderValue = string | string[] | undefined;

export type CandidateAuthHeaders = Record<string, HeaderValue>;

export function resolveCurrentCandidate(headers: CandidateAuthHeaders): CurrentCandidateUser {
  const userType = readHeader(headers, "x-dev-user-type");
  const userId = Number(readHeader(headers, "x-dev-user-id"));
  const candidateId = Number(readHeader(headers, "x-dev-candidate-id"));

  if (!userType || !userId || !candidateId) {
    throw new CandidateDomainError("COMMON_UNAUTHORIZED", "로그인이 필요합니다.", 401);
  }

  if (userType !== "CANDIDATE") {
    throw new CandidateDomainError("COMMON_FORBIDDEN", "지원자 권한이 필요합니다.", 403);
  }

  return {
    userId,
    candidateId,
    userType: "CANDIDATE",
  };
}

function readHeader(headers: CandidateAuthHeaders, name: string): string | undefined {
  const lowerName = name.toLowerCase();
  const value = headers[lowerName] ?? headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
