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
        // Handle undefined/null data (e.g., from void commands) [处理undefined/null数据（例如来自void命令）]
        if (data === undefined || data === null) {
          // Return standard success response for void operations [为void操作返回标准成功响应]
          return {
            success: true,
            message: 'Operation completed successfully'
          };
        }

        // 处理分页数据 [Handle paginated data]
        if (data && typeof data === 'object' && 'data' in data && data.total !== undefined) {
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
