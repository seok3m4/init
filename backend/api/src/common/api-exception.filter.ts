import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";

import { ApiException } from "./api.exception";
import { getTraceId, type RequestLike } from "./response-envelope";

type ResponseLike = {
  status(statusCode: number): {
    json(body: unknown): void;
  };
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestLike>();
    const response = context.getResponse<ResponseLike>();
    const timestamp = new Date().toISOString();
    const traceId = getTraceId(request);

    if (exception instanceof ApiException) {
      response.status(exception.status).json({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
        meta: { traceId, timestamp },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === "object" && body !== null && "message" in body
          ? String((body as { message: unknown }).message)
          : exception.message;
      response.status(status).json({
        error: {
          code: status === HttpStatus.UNAUTHORIZED ? "COMMON_UNAUTHORIZED" : "COMMON_VALIDATION_FAILED",
          message,
          details: [],
        },
        meta: { traceId, timestamp },
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: "COMMON_INTERNAL_SERVER_ERROR",
        message: "서버 오류가 발생했습니다.",
        details: [],
      },
      meta: { traceId, timestamp },
    });
  }
}
