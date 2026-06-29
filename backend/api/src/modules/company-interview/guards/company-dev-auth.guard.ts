import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { CurrentUser } from '../company-interview.types';
import { forbidden, unauthorized, validationFailed } from '../company-interview.errors';

type RequestWithCurrentUser = {
  headers: Record<string, string | string[] | undefined>;
  currentUser?: CurrentUser;
};

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseRequiredNumber(
  value: string | undefined,
  field: string,
): number {
  if (value === undefined || value === '') {
    unauthorized();
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    validationFailed('개발 인증 헤더를 확인해주세요.', [
      { field, reason: 'INVALID_NUMBER' },
    ]);
  }

  return parsed;
}

function parseOptionalNumber(value: string | undefined): number | null {
  if (value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    validationFailed('개발 인증 헤더를 확인해주세요.', [
      { field: 'X-Dev-*', reason: 'INVALID_NUMBER' },
    ]);
  }

  return parsed;
}

@Injectable()
export class CompanyDevAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>();
    const userType = firstHeader(request.headers['x-dev-user-type']);

    if (userType !== 'COMPANY') {
      if (userType === undefined) {
        unauthorized();
      }
      forbidden('기업 사용자만 접근할 수 있습니다.');
    }

    request.currentUser = {
      userId: parseRequiredNumber(
        firstHeader(request.headers['x-dev-user-id']),
        'X-Dev-User-Id',
      ),
      userType,
      companyId: parseRequiredNumber(
        firstHeader(request.headers['x-dev-company-id']),
        'X-Dev-Company-Id',
      ),
      candidateId: parseOptionalNumber(
        firstHeader(request.headers['x-dev-candidate-id']),
      ),
    };

    return true;
  }
}
