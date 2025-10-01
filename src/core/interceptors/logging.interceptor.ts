import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method: string = req?.method ?? 'N/A';
    const url: string = req?.url ?? 'N/A';
    const requestId: string = req?.headers?.['x-request-id'] ?? 'n/a';
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        const res = context.switchToHttp().getResponse();
        const status: number = res?.statusCode ?? 0;
        this.logger.log(
          `[HTTP] ${method} ${url} ${status} - ${ms}ms reqId=${requestId}`,
        );
      }),
    );
  }
}
