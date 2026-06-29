import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";

import { ApiException } from "./api.exception";
import type { CurrentUser, CurrentUserType } from "./current-user.type";
import type { RequestLike } from "./response-envelope";

type RequestWithCurrentUser = RequestLike & { currentUser?: CurrentUser };

@Injectable()
export class DevAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>();
    const userId = readIntegerHeader(request, "x-dev-user-id");
    const userType = readStringHeader(request, "x-dev-user-type") as CurrentUserType | null;

    if (!userId || !userType) {
      throw new ApiException(401, "COMMON_UNAUTHORIZED", "인증 정보가 필요합니다.");
    }

    if (!["ADMIN", "COMPANY", "CANDIDATE"].includes(userType)) {
      throw new ApiException(401, "COMMON_UNAUTHORIZED", "인증 정보가 올바르지 않습니다.");
    }

    request.currentUser = {
      userId,
      userType,
      companyId: readIntegerHeader(request, "x-dev-company-id"),
      candidateId: readIntegerHeader(request, "x-dev-candidate-id"),
    };
    return true;
  }
}

function readStringHeader(request: RequestLike, name: string): string | null {
  const value = request.headers[name];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readIntegerHeader(request: RequestLike, name: string): number | null {
  const value = readStringHeader(request, name);
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
