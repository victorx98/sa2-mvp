import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Response Interceptor to standardize API responses
 * [标准化API响应的拦截器]
 * 
 * Usage:
 * ```typescript
 * // Apply globally in main.ts:
 * app.useGlobalInterceptors(new ResponseInterceptor());
 * ```
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;

        // 处理分页数据 [Handle paginated data]
        if (data.data && data.total !== undefined) {
          return {
            data: data.data,
            meta: {
              total: data.total,
              page: data.page || 1,
              pageSize: data.pageSize || 20,
              totalPages: data.totalPages || Math.ceil(data.total / (data.pageSize || 20))
            }
          };
        }

        // 处理普通数据 [Handle regular data]
        return data;
      })
    );
  }
}
