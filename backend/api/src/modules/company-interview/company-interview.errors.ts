import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

type ErrorCode =
  | 'COMMON_VALIDATION_FAILED'
  | 'COMMON_UNAUTHORIZED'
  | 'COMMON_FORBIDDEN'
  | 'COMMON_NOT_FOUND'
  | 'COMMON_CONFLICT'
  | 'AI_PROCESS_FAILED';

type ErrorDetail = {
  field?: string;
  reason: string;
};

type ErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    details: ErrorDetail[];
  };
  meta: {
    traceId: string;
    timestamp: string;
  };
};

function errorBody(
  code: ErrorCode,
  message: string,
  details: ErrorDetail[] = [],
): ErrorBody {
  return {
    error: {
      code,
      message,
      details,
    },
    meta: {
      traceId: 'company-interview-local',
      timestamp: new Date().toISOString(),
    },
  };
}

export function unauthorized(message = '인증 정보가 필요합니다.'): never {
  throw new UnauthorizedException(errorBody('COMMON_UNAUTHORIZED', message));
}

export function forbidden(message = '접근 권한이 없습니다.'): never {
  throw new ForbiddenException(errorBody('COMMON_FORBIDDEN', message));
}

export function notFound(message = '리소스를 찾을 수 없습니다.'): never {
  throw new NotFoundException(errorBody('COMMON_NOT_FOUND', message));
}

export function validationFailed(
  message = '입력값을 확인해주세요.',
  details: ErrorDetail[] = [],
): never {
  throw new BadRequestException(
    errorBody('COMMON_VALIDATION_FAILED', message, details),
  );
}
