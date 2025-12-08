import { Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PgTable, PgSelectBase } from 'drizzle-orm/pg-core';
import { SQL } from 'drizzle-orm';
import { trace, Span, SpanStatusCode, context } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import * as schema from './schema';

/**
 * 增强的数据库连接，自动为所有查询创建trace
 * 
 * 这个Proxy会拦截所有数据库操作，自动创建OpenTelemetry span
 * 开发者无需手动添加trace代码
 */

// 使用与 OTEL_RESOURCE_ATTRIBUTES 中 service.name 一致的名字
const serviceName = process.env.SERVICE_NAME ?? process.env.OTEL_SERVICE_NAME ?? 'mentorxsa2';
const tracer = trace.getTracer(serviceName);
const logger = new Logger('TracedDatabase');
const otelLogger = logs.getLogger(serviceName);

/**
 * 从Drizzle查询中提取表名
 */
function extractTableName(query: any): string {
  try {
    // 尝试从查询对象中提取表名
    if (query?.table?.name) {
      return query.table.name;
    }
    if (query?.config?.table?.name) {
      return query.config.table.name;
    }
    // 从SQL中提取（如果可能）
    if (query?.sql) {
      const sqlStr = String(query.sql);
      // 匹配 FROM/INTO/UPDATE 后面的表名
      const match = sqlStr.match(/(?:FROM|INTO|UPDATE)\s+["']?(\w+)["']?/i);
      if (match) {
        return match[1];
      }
    }
  } catch (error) {
    logger.debug('Unable to extract table name from query');
  }
  return 'unknown';
}

/**
 * 从SQL字符串中提取操作类型
 */
function extractOperationType(sql: string | SQL): string {
  try {
    const sqlStr = String(sql).trim().toUpperCase();
    if (sqlStr.startsWith('SELECT')) return 'SELECT';
    if (sqlStr.startsWith('INSERT')) return 'INSERT';
    if (sqlStr.startsWith('UPDATE')) return 'UPDATE';
    if (sqlStr.startsWith('DELETE')) return 'DELETE';
  } catch (error) {
    logger.debug('Unable to extract operation type from SQL');
  }
  return 'QUERY';
}

/**
 * 创建traced数据库查询包装器
 */
async function executeWithTrace<T>(
  operationType: string,
  tableName: string,
  operation: () => Promise<T>,
  additionalAttributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const spanName = `db.${operationType.toLowerCase()}.${tableName}`;
  const startTime = Date.now();
  
  return await tracer.startActiveSpan(spanName, async (span: Span) => {
    try {
      // 添加标准数据库属性
      span.setAttribute('db.system', 'postgresql');
      span.setAttribute('db.operation', operationType);
      span.setAttribute('db.sql.table', tableName);
      
      if (additionalAttributes) {
        Object.entries(additionalAttributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
      }

      const result = await operation();
      const duration = Date.now() - startTime;

      span.setAttribute('db.execution.duration_ms', duration);
      
      // 记录结果元数据
      const resultCount = Array.isArray(result) ? result.length : undefined;
      if (resultCount !== undefined) {
        span.setAttribute('db.result.count', resultCount);
      }

      span.setStatus({ code: SpanStatusCode.OK });
      
      // 发送日志到 Grafana Cloud Log 板块
      emitLog(span, operationType, tableName, duration, resultCount);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      if (error instanceof Error) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        
        // 发送错误日志
        emitLog(span, operationType, tableName, duration, undefined, error);
      }
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * 包装Drizzle查询构建器，自动添加trace
 */
function wrapQueryBuilder(queryBuilder: any, operationType: string): any {
  // 如果已经包装过，直接返回
  if (queryBuilder.__traced) {
    return queryBuilder;
  }

  const handler = {
    get(target: any, prop: string | symbol) {
      const value = target[prop];
      
      // 如果是then方法（Promise），拦截并添加trace
      if (prop === 'then' && typeof value === 'function') {
        return function(resolve: any, reject: any) {
          const tableName = extractTableName(target);
          
          // 创建traced执行
          return executeWithTrace(
            operationType,
            tableName,
            () => value.call(target, resolve, reject),
          );
        };
      }
      
      // 如果是execute方法，拦截并添加trace
      if (prop === 'execute' && typeof value === 'function') {
        return async function(...args: any[]) {
          const tableName = extractTableName(target);
          return executeWithTrace(
            operationType,
            tableName,
            () => value.apply(target, args),
          );
        };
      }
      
      // 对于其他链式方法，继续返回wrapped对象
      if (typeof value === 'function') {
        return function(...args: any[]) {
          const result = value.apply(target, args);
          // 如果返回的是查询构建器，继续包装
          if (result && typeof result === 'object' && 'then' in result) {
            return wrapQueryBuilder(result, operationType);
          }
          return result;
        };
      }
      
      return value;
    }
  };
  
  const wrapped = new Proxy(queryBuilder, handler);
  (wrapped as any).__traced = true;
  return wrapped;
}

/**
 * 创建traced数据库连接
 * 
 * @param db - 原始的Drizzle数据库连接
 * @returns 增强的traced数据库连接
 */
export function createTracedDatabase(
  db: NodePgDatabase<typeof schema>,
): NodePgDatabase<typeof schema> {
  const handler = {
    get(target: NodePgDatabase<typeof schema>, prop: keyof NodePgDatabase<typeof schema>) {
      const value = target[prop];
      
      // 拦截select查询
      if (prop === 'select' && typeof value === 'function') {
        return function(...args: any[]) {
          const queryBuilder = (value as any).apply(target, args);
          return wrapQueryBuilder(queryBuilder, 'SELECT');
        };
      }
      
      // 拦截insert操作
      if (prop === 'insert' && typeof value === 'function') {
        return function(table: PgTable) {
          const queryBuilder = (value as any).call(target, table);
          const tableName = table?.[Symbol.for('drizzle:Name')] || extractTableName(table);
          return wrapQueryBuilder(queryBuilder, 'INSERT');
        };
      }
      
      // 拦截update操作
      if (prop === 'update' && typeof value === 'function') {
        return function(table: PgTable) {
          const queryBuilder = (value as any).call(target, table);
          const tableName = table?.[Symbol.for('drizzle:Name')] || extractTableName(table);
          return wrapQueryBuilder(queryBuilder, 'UPDATE');
        };
      }
      
      // 拦截delete操作
      if (prop === 'delete' && typeof value === 'function') {
        return function(table: PgTable) {
          const queryBuilder = (value as any).call(target, table);
          const tableName = table?.[Symbol.for('drizzle:Name')] || extractTableName(table);
          return wrapQueryBuilder(queryBuilder, 'DELETE');
        };
      }
      
      // 拦截execute（原始SQL）
      if (prop === 'execute' && typeof value === 'function') {
        return async function(query: SQL) {
          const operationType = extractOperationType(query);
          return executeWithTrace(
            operationType,
            'raw_sql',
            () => (value as any).call(target, query),
          );
        };
      }
      
      // 拦截transaction
      if (prop === 'transaction' && typeof value === 'function') {
        return async function(
          callback: (tx: NodePgDatabase<typeof schema>) => Promise<any>,
          options?: any,
        ) {
          return await tracer.startActiveSpan('db.transaction', async (span: Span) => {
            try {
              span.setAttribute('db.system', 'postgresql');
              span.setAttribute('db.operation', 'TRANSACTION');
              span.addEvent('transaction.start');
              
              const startTime = Date.now();
              
              // 创建traced的事务连接
              const result = await (value as any).call(target, (tx: NodePgDatabase<typeof schema>) => {
                const tracedTx = createTracedDatabase(tx);
                return callback(tracedTx);
              }, options);
              
              const duration = Date.now() - startTime;
              
              span.addEvent('transaction.commit');
              span.setAttribute('db.execution.duration_ms', duration);
              span.setStatus({ code: SpanStatusCode.OK });
              
              return result;
            } catch (error) {
              span.addEvent('transaction.rollback');
              if (error instanceof Error) {
                span.recordException(error);
                span.setStatus({
                  code: SpanStatusCode.ERROR,
                  message: error.message,
                });
              }
              throw error;
            } finally {
              span.end();
            }
          });
        };
      }
      
      // 其他方法直接返回
      return value;
    }
  };
  
  return new Proxy(db, handler) as NodePgDatabase<typeof schema>;
}

/**
 * 发送数据库操作日志到 Grafana Cloud Log 板块
 * 参考 OtelLoggerService 的实现
 */
function emitLog(
  span: Span,
  operationType: string,
  tableName: string,
  durationMs: number,
  resultCount?: number,
  error?: Error,
): void {
  try {
    const spanContext = span.spanContext();
    
    // 构建日志消息
    let message: string;
    let severity: SeverityNumber;
    
    if (error) {
      message = `Database ${operationType} failed on "${tableName}": ${error.message}`;
      severity = SeverityNumber.ERROR;
    } else {
      const resultInfo = resultCount !== undefined ? ` (${resultCount} rows)` : '';
      message = `Database ${operationType} on "${tableName}" completed in ${durationMs}ms${resultInfo}`;
      severity = SeverityNumber.INFO;
    }

    // 构建日志属性
    const attributes: Record<string, string | number> = {
      'db.system': 'postgresql',
      'db.operation': operationType,
      'db.sql.table': tableName,
      'db.execution.duration_ms': durationMs,
    };

    if (resultCount !== undefined) {
      attributes['db.result.count'] = resultCount;
    }

    // 添加 trace 上下文
    if (spanContext && spanContext.traceId && spanContext.traceId !== '00000000000000000000000000000000') {
      attributes['traceId'] = spanContext.traceId;
      attributes['spanId'] = spanContext.spanId;
    }

    // 如果有错误，添加异常信息
    if (error) {
      attributes['exception.type'] = error.constructor.name;
      attributes['exception.message'] = error.message;
      if (error.stack) {
        attributes['exception.stacktrace'] = error.stack;
      }
    }

    // 发送日志（与 OtelLoggerService 相同的方式）
    otelLogger.emit({
      severityNumber: severity,
      severityText: error ? 'ERROR' : 'INFO',
      body: message,
      attributes,
      timestamp: Date.now(),
      context: spanContext 
        ? trace.setSpan(context.active(), trace.wrapSpanContext(spanContext))
        : context.active(),
    });
  } catch (logError) {
    // 避免日志失败影响主流程
    if (process.env.OTEL_LOG_LEVEL === 'DEBUG') {
      logger.debug(`Failed to emit database log: ${logError}`);
    }
  }
}

/**
 * Provider token for traced database
 */
export const TRACED_DATABASE_CONNECTION = Symbol('TRACED_DATABASE_CONNECTION');

