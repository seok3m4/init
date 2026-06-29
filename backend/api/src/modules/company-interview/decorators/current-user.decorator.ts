import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUser } from '../company-interview.types';
import { unauthorized, validationFailed } from '../company-interview.errors';

type DevAuthHeaders = {
  'x-dev-user-id'?: string;
  'x-dev-user-type'?: string;
  'x-dev-company-id'?: string;
  'x-dev-candidate-id'?: string;
};

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

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const CurrentUserParam = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUser => {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      currentUser?: CurrentUser;
    }>();

    if (request.currentUser) {
      return request.currentUser;
    }

    const headers: DevAuthHeaders = {
      'x-dev-user-id': firstHeader(request.headers['x-dev-user-id']),
      'x-dev-user-type': firstHeader(request.headers['x-dev-user-type']),
      'x-dev-company-id': firstHeader(request.headers['x-dev-company-id']),
      'x-dev-candidate-id': firstHeader(request.headers['x-dev-candidate-id']),
    };

    if (!headers['x-dev-user-id'] || !headers['x-dev-user-type']) {
      unauthorized();
    }

    const userId = parseOptionalNumber(headers['x-dev-user-id']);
    if (userId === null) {
      unauthorized();
    }

    const userType = headers['x-dev-user-type'];
    if (
      userType !== 'ADMIN' &&
      userType !== 'COMPANY' &&
      userType !== 'CANDIDATE'
    ) {
      unauthorized('사용자 유형을 확인해주세요.');
    }

    return {
      userId,
      userType,
      companyId: parseOptionalNumber(headers['x-dev-company-id']),
      candidateId: parseOptionalNumber(headers['x-dev-candidate-id']),
    };
  },
);
