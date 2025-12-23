import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * HTTP Exception Filter
 * 全局异常过滤器：确保所有异常都返回 JSON 格式的响应
 * 
 * 职责：
 * 1. 捕获所有 HTTP 异常
 * 2. 统一格式化为 JSON 响应
 * 3. 设置正确的 Content-Type 头
 * 
 * 注意：此过滤器应该在 OtelExceptionFilter 之后注册，以确保 OpenTelemetry 追踪正常工作
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: any = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const response = exceptionResponse as Record<string, any>;
        errorResponse = {
          statusCode: status,
          message: response.message || exception.message || 'Bad Request',
          error: response.error || response.code || exception.name,
          timestamp: new Date().toISOString(),
          path: request.url,
        };

        if (response.errors) {
          errorResponse.errors = response.errors;
        }
      } else {
        errorResponse = {
          statusCode: status,
          message: exceptionResponse || exception.message,
          error: exception.name,
          timestamp: new Date().toISOString(),
          path: request.url,
        };
      }
    } else if (exception instanceof Error) {
      errorResponse = {
        statusCode: status,
        message: exception.message || 'Internal server error',
        error: exception.name || 'Error',
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    } else {
      errorResponse = {
        statusCode: status,
        message: 'Internal server error',
        error: 'Error',
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    }

    response.status(status).json(errorResponse);
  }
}

