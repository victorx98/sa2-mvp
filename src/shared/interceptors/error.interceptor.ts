import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Logger } from '@nestjs/common';

/**
 * Error Interceptor to standardize API error responses
 * [标准化API错误响应的拦截器]
 * 
 * Usage:
 * ```typescript
 * // Apply globally in main.ts:
 * app.useGlobalInterceptors(new ErrorInterceptor());
 * ```
 */
@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError(error => {
        const request = context.switchToHttp().getRequest();
        const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
        
        // 构建错误响应 [Build error response]
        const errorResponse = {
          statusCode: status,
          message: error.message || 'Internal server error',
          error: error.name || 'Error',
          timestamp: new Date().toISOString(),
          path: request.url
        };
        
        // 记录错误日志 [Log error]
        this.logger.error(
          `${status} - ${error.message}`,
          error.stack,
          `${request.method} ${request.url}`
        );
        
        return throwError(() => new HttpException(errorResponse, status));
      })
    );
  }
}
