import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

/**
 * The single place an outgoing error response is shaped. Two rules this
 * exists to enforce:
 *
 *   1. Never leak a raw Postgres/PostgREST error message to the client —
 *      it can contain column names, constraint names, sometimes literal
 *      values. Map known error codes to a generic, safe message instead.
 *   2. Never leak a stack trace in production. Full detail is logged
 *      server-side (with the request id for correlation); the client gets
 *      `{ statusCode, code, message, requestId }` and nothing else.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const requestId = request.id ?? 'unknown';

    const { statusCode, code, message } = this.resolve(exception);

    if (statusCode >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} -> ${statusCode}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`[${requestId}] ${request.method} ${request.url} -> ${statusCode}: ${message}`);
    }

    response.status(statusCode).json({ statusCode, code, message, requestId });
  }

  private resolve(exception: unknown): { statusCode: number; code: string; message: string | object } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const body = exception.getResponse();
      // Preserve structured bodies (e.g. ZodValidationPipe's fieldErrors)
      // rather than flattening them to a string.
      if (typeof body === 'object' && body !== null) {
        return {
          statusCode,
          code: (body as Record<string, unknown>).code as string ?? httpStatusCode(statusCode),
          message: (body as Record<string, unknown>).message ?? exception.message,
        };
      }
      return { statusCode, code: httpStatusCode(statusCode), message: exception.message };
    }

    const pgError = asPostgrestError(exception);
    if (pgError) {
      return mapPostgresError(pgError);
    }

    // Unknown/unexpected — never leak the raw message.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Internal error',
    };
  }
}

function httpStatusCode(status: number): string {
  return HttpStatus[status] ?? 'ERROR';
}

function asPostgrestError(exception: unknown): PostgrestLikeError | null {
  if (
    typeof exception === 'object' &&
    exception !== null &&
    'code' in exception &&
    typeof (exception as PostgrestLikeError).code === 'string'
  ) {
    return exception as PostgrestLikeError;
  }
  return null;
}

function mapPostgresError(err: PostgrestLikeError): { statusCode: number; code: string; message: string } {
  switch (err.code) {
    case '23505':
      return { statusCode: HttpStatus.CONFLICT, code: 'ALREADY_EXISTS', message: 'Already exists' };
    case '23503':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'INVALID_REFERENCE',
        message: 'Invalid reference',
      };
    default:
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: 'Internal error',
      };
  }
}
