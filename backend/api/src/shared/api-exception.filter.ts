import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { ERROR_CODES } from "@init/common";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;

    const body =
      typeof payload === "object" && payload !== null && "code" in payload
        ? (payload as { code: string; message?: string; details?: Array<Record<string, unknown>> })
        : {
            code: ERROR_CODES.COMMON_VALIDATION_FAILED,
            message: status >= 500 ? "서버 오류가 발생했습니다." : "요청을 처리할 수 없습니다.",
            details: [],
          };

    response.status(status).json({
      error: {
        code: body.code,
        message: body.message ?? "요청을 처리할 수 없습니다.",
        details: body.details ?? [],
      },
    });
  }
}
