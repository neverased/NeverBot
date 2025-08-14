import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method: string = req?.method ?? 'N/A';
    const url: string = req?.url ?? 'N/A';
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        // eslint-disable-next-line no-console
        console.log(`[HTTP] ${method} ${url} - ${ms}ms`);
      }),
    );
  }
}
