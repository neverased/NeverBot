import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

interface ErrorResponseBody {
  timestamp: string;
  path: string;
  statusCode: number;
  message: string;
  traceId: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? this.extractMessage(exception)
        : 'Internal server error';

    const traceId: string =
      request.headers['x-request-id']?.toString() || this.generateTraceId();

    const body: ErrorResponseBody = {
      timestamp: new Date().toISOString(),
      path: request.url,
      statusCode: status,
      message,
      traceId,
    };

    const headers: Record<string, string> = {
      'x-request-id': traceId,
    };
    const method = request.method;
    const ip = request.ip || request.connection?.remoteAddress || '';
    // Attach meta for debugging in non-production only
    if (process.env.NODE_ENV !== 'production') {
      headers['x-method'] = method;
      headers['x-remote-ip'] = ip;
    }
    Object.entries(headers).forEach(([k, v]) => response.setHeader(k, v));
    response.status(status).json(body);
  }

  private extractMessage(exception: HttpException): string {
    const res = exception.getResponse();
    if (typeof res === 'string') {
      return res;
    }
    if (typeof res === 'object' && res && 'message' in res) {
      const msg = (res as Record<string, unknown>).message;
      if (Array.isArray(msg)) {
        return msg.join('; ');
      }
      if (typeof msg === 'string') {
        return msg;
      }
    }
    return exception.message;
  }

  private generateTraceId(): string {
    // Simple RFC4122 v4-like generator (non-crypto)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
