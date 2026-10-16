import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiError } from '@opd/contracts';
import { AppError } from '../errors';
import { reportFault } from '../sentry';

/**
 * The single place an error becomes an HTTP response (docs/Rules.md 7).
 *
 * Guarantees:
 *   - one response shape, always: { error: { code, message, details?, requestId? } }
 *   - internals (stack, SQL, secrets) are logged server-side and NEVER sent to a client
 *   - unexpected faults are logged at error level with the full exception
 *
 * Uses the standard Nest Logger rather than injecting nestjs-pino's PinoLogger:
 * PinoLogger is transient-scoped and awkward to inject here, and main.ts already
 * routes the global logger into pino via app.useLogger().
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const requestId = req.id;

    const { status, body } = this.toResponse(exception, requestId);
    const where = `${req.method} ${req.url}${requestId ? ` [${requestId}]` : ''}`;

    if (status >= 500) {
      this.logger.error(
        `Unhandled server error: ${where}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      // 5xx only, and scrubbed on the way out (common/sentry.ts). A no-op until a
      // DSN is configured, which is every environment but staging and production.
      reportFault(exception, requestId);
    } else {
      this.logger.warn(`${body.error.code}: ${where} - ${body.error.message}`);
    }

    res.status(status).json(body);
  }

  private toResponse(exception: unknown, requestId?: string): { status: number; body: ApiError } {
    const withId = requestId ? { requestId } : {};

    if (exception instanceof AppError) {
      return {
        status: exception.httpStatus,
        body: {
          error: {
            code: exception.code,
            message: exception.message,
            ...(exception.details ? { details: exception.details } : {}),
            ...withId,
          },
        },
      };
    }

    // The body parser runs before Nest and throws its own errors (http-errors, which
    // mark themselves `expose`). An oversized body used to land in the branch below
    // and answer 500 - telling the caller WE broke, logging at error level and paging
    // Sentry, for a request the client got wrong. The parser's own message is not
    // passed through: it names the parser and the byte offset, which is internals.
    const parser = asBodyParserError(exception);
    if (parser !== null) {
      return {
        status: parser.status,
        body: {
          error: {
            code: 'VALIDATION_FAILED',
            message:
              parser.status === 413
                ? 'Request body is too large'
                : parser.type === 'entity.parse.failed'
                  ? 'Request body is not valid JSON'
                  : 'Request body could not be read',
            ...withId,
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        body: {
          error: {
            code:
              status === 404
                ? 'NOT_FOUND'
                : // ThrottlerGuard throws a plain HttpException, so without this a
                  // rate-limited caller is told their REQUEST was invalid and will
                  // "fix" it and retry - the opposite of what 429 asks for.
                  status === 429
                  ? 'RATE_LIMITED'
                  : status < 500
                    ? 'VALIDATION_FAILED'
                    : 'INTERNAL_ERROR',
            message:
              status === 429
                ? 'Too many requests. Please wait and try again.'
                : status === 400
                  ? malformedRequestMessage(exception.message)
                  : exception.message,
            ...withId,
          },
        },
      };
    }

    // Unknown: say nothing useful to the client, log everything server-side.
    return {
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error', ...withId } },
    };
  }
}

/** An error from Express's body parser - a client fault, with a 4xx of its own. */
function asBodyParserError(exception: unknown): { status: number; type: string } | null {
  if (typeof exception !== 'object' || exception === null) return null;
  const e = exception as { status?: unknown; type?: unknown; expose?: unknown };
  if (e.expose !== true || typeof e.type !== 'string' || !e.type.startsWith('entity.')) return null;
  if (typeof e.status !== 'number' || e.status < 400 || e.status >= 500) return null;
  return { status: e.status, type: e.type };
}

/**
 * Nest turns a body-parser SyntaxError (bad JSON) or an Express URIError (a bad
 * %-escape in the path) into `new BadRequestException(err.message)` - the parser's
 * own sentence, byte offset included - and throws the original away. Nothing in
 * this API throws a bare BadRequestException itself (validation is an AppError),
 * so a 400 arriving here is always one of those two, and gets a sentence of ours.
 */
function malformedRequestMessage(raw: string): string {
  return /JSON/.test(raw) ? 'Request body is not valid JSON' : 'Request could not be read';
}
