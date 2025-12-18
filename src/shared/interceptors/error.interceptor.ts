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

        // 如果是 HttpException，直接使用其原始响应 [If it's HttpException, use its original response directly]
        if (error instanceof HttpException) {
          const status = error.getStatus();
          const originalResponse = error.getResponse();
          const errorResponse: any = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url
          };

          // 处理原始响应 [Handle original response]
          if (originalResponse && typeof originalResponse === 'object') {
            const response = originalResponse as Record<string, any>;
            // 使用原始响应中的message（如果存在） [Use message from original response if exists]
            errorResponse.message = response.message || error.message || 'Bad Request';

            // 如果原始响应包含code字段，则使用它作为error字段的值 [If original response contains code field, use it as error field value]
            errorResponse.error = response.code || response.error || error.name;

            // 如果原始响应包含 errors 字段，则保留它 [If original response contains errors field, keep it]
            if (response.errors) {
              errorResponse.errors = response.errors;
            }
          } else {
            // 字符串类型的响应 [String type response]
            errorResponse.message = originalResponse || error.message;
            errorResponse.error = error.name;
          }

          // 记录错误日志 [Log error]
          this.logger.error(
            `${status} - ${error.message}`,
            error.stack,
            `${request.method} ${request.url}`,
          );

          return throwError(() => new HttpException(errorResponse, status));
        }

        // 对于非 HttpException，进行数据库错误检测和其他处理 [For non-HttpException, perform database error detection and other handling]
        let status = HttpStatus.INTERNAL_SERVER_ERROR;

        // 构建错误响应 [Build error response]
        const errorResponse: any = {
          statusCode: status,
          message: 'Internal server error',
          error: error.name || 'Error',
          timestamp: new Date().toISOString(),
          path: request.url
        };

        // 处理数据库错误 [Handle database errors]
        const dbError = this.parseDatabaseError(error);
        if (dbError) {
          errorResponse.message = dbError.message;
          errorResponse.error = dbError.code || 'DATABASE_ERROR';
          errorResponse.dbError = {
            code: dbError.code,
            detail: dbError.detail,
            table: dbError.table,
            constraint: dbError.constraint
          };
          // 根据数据库错误类型调整状态码 [Adjust status code based on database error type]
          if (dbError.code === '23505') { // Unique constraint violation
            status = HttpStatus.CONFLICT;
          } else if (dbError.code === '23502') { // Not null constraint violation
            status = HttpStatus.BAD_REQUEST;
          } else if (dbError.code === '22P02') { // Invalid data type
            status = HttpStatus.BAD_REQUEST;
          } else if (dbError.code === '23514') { // Check constraint violation
            status = HttpStatus.BAD_REQUEST;
          }
        } else {
          // 否则使用默认值 [Otherwise use default values]
          errorResponse.message = error.message || 'Internal server error';
        }
        
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

  /**
   * Parse database error and extract detailed information [解析数据库错误并提取详细信息]
   * @param error Original error object [原始错误对象]
   * @returns Parsed database error information [解析后的数据库错误信息]
   */
  private parseDatabaseError(error: any): { code: string; message: string; detail?: string; table?: string; constraint?: string } | null {
    // Check if error has a cause property (which may contain the original PostgreSQL error) [检查错误是否有cause属性，其中可能包含原始PostgreSQL错误]
    const originalError = error.cause || error;
    
    // Check if it's a PostgreSQL error [检查是否为PostgreSQL错误]
    if (originalError && originalError.code && originalError.detail) {
      let message = 'Database operation failed';
      
      switch (originalError.code) {
        case '23505': // Unique constraint violation [唯一约束冲突]
          message = `Database insert failed: Unique constraint violated`;
          break;
        case '23502': // Not null constraint violation [非空约束冲突]
          message = `Database insert failed: Required field cannot be null`;
          break;
        case '22P02': // Invalid data type [无效数据类型]
          message = `Database insert failed: Invalid data type`;
          break;
        case '23514': // Check constraint violation [检查约束冲突]
          message = `Database insert failed: Check constraint violated`;
          break;
        case '23503': // Foreign key constraint violation [外键约束冲突]
          message = `Database insert failed: Foreign key constraint violated`;
          break;
        default:
          message = `Database insert failed: ${originalError.message}`;
      }
      
      // Extract table and constraint information if available [如果可用，提取表和约束信息]
      let table: string | undefined;
      let constraint: string | undefined;
      
      if (originalError.detail) {
        // Extract table name from detail [从详细信息中提取表名]
        const tableMatch = originalError.detail.match(/table "([^"]+)"/i);
        if (tableMatch && tableMatch[1]) {
          table = tableMatch[1];
        }
        
        // Extract constraint name from detail [从详细信息中提取约束名]
        const constraintMatch = originalError.detail.match(/constraint "([^"]+)"/i);
        if (constraintMatch && constraintMatch[1]) {
          constraint = constraintMatch[1];
        }
      }
      
      return {
        code: originalError.code,
        message,
        detail: originalError.detail,
        table,
        constraint
      };
    }
    
    // Check if it's a Drizzle ORM error [检查是否为Drizzle ORM错误]
    if (error && error.message && error.message.includes('Failed query')) {
      // Try to extract more information from Drizzle error [尝试从Drizzle错误中提取更多信息]
      let detailedMessage = 'Database query failed';
      
      // Determine the query type from error message [从错误消息中确定查询类型]
      const queryType = error.message.includes('select') ? 'select' : 
                        error.message.includes('insert') ? 'insert' :
                        error.message.includes('update') ? 'update' :
                        error.message.includes('delete') ? 'delete' : 'query';
      
      // Generate appropriate message based on query type [根据查询类型生成适当的消息]
      detailedMessage = `Database ${queryType} failed`;
      
      // Check if error message contains specific constraint violation patterns [检查错误消息是否包含特定的约束冲突模式]
      if (error.message.includes('duplicate key')) {
        detailedMessage = `Database ${queryType} failed: Unique constraint violated`;
      } else if (error.message.includes('null value in column')) {
        detailedMessage = `Database ${queryType} failed: Required field cannot be null`;
      } else if (error.message.includes('invalid input syntax')) {
        detailedMessage = `Database ${queryType} failed: Invalid data type`;
      } else if (error.message.includes('violates check constraint')) {
        detailedMessage = `Database ${queryType} failed: Check constraint violated`;
      } else if (error.message.includes('violates foreign key constraint')) {
        detailedMessage = `Database ${queryType} failed: Foreign key constraint violated`;
      }
      
      return {
        code: 'DRIZZLE_ERROR',
        message: detailedMessage,
        detail: error.message
      };
    }
    
    return null;
  }
}
