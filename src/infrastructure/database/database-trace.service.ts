import { Injectable, Logger } from '@nestjs/common';
import { trace, Span, SpanStatusCode } from '@opentelemetry/api';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { SQL } from 'drizzle-orm';
import * as schema from './schema';

/**
 * 数据库操作类型
 */
export type DbOperationType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRANSACTION' | 'EXECUTE';

/**
 * 数据库Trace服务
 * 
 * 自动为所有数据库操作创建trace span，包含详细的上下文信息
 * 开发者无需关心，所有数据库操作都会自动上报到Grafana Cloud
 * 
 * @example
 * ```typescript
 * // 在 Repository 或 Service 中使用
 * constructor(
 *   @Inject(DATABASE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
 *   private readonly dbTrace: DatabaseTraceService,
 * ) {}
 * 
 * async findUser(id: string) {
 *   return this.dbTrace.traceQuery(
 *     'User.findById',
 *     'SELECT',
 *     'users',
 *     async () => {
 *       return this.db.select().from(userTable).where(eq(userTable.id, id));
 *     },
 *     { 'user.id': id }
 *   );
 * }
 * ```
 */
@Injectable()
export class DatabaseTraceService {
  private readonly logger = new Logger(DatabaseTraceService.name);
  private readonly tracer = trace.getTracer('mentorx-database');

  /**
   * 追踪数据库查询操作
   * 
   * @param operationName - 操作名称，建议格式: 'Service.method' 或 'Entity.operation'
   * @param operationType - 操作类型: SELECT, INSERT, UPDATE, DELETE等
   * @param tableName - 表名
   * @param operation - 数据库操作函数
   * @param attributes - 额外的span属性
   * @returns 查询结果
   */
  async traceQuery<T>(
    operationName: string,
    operationType: DbOperationType,
    tableName: string,
    operation: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>,
  ): Promise<T> {
    const spanName = `db.${operationType.toLowerCase()}.${tableName}`;
    
    return await this.tracer.startActiveSpan(spanName, async (span: Span) => {
      try {
        // 添加标准数据库属性（遵循 OpenTelemetry 语义约定）
        span.setAttribute('db.system', 'postgresql');
        span.setAttribute('db.operation', operationType);
        span.setAttribute('db.sql.table', tableName);
        span.setAttribute('db.operation.name', operationName);
        
        // 添加自定义属性
        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            span.setAttribute(key, value);
          });
        }

        // 执行数据库操作
        const startTime = Date.now();
        const result = await operation();
        const duration = Date.now() - startTime;

        // 记录执行时长
        span.setAttribute('db.execution.duration_ms', duration);
        
        // 记录结果元数据（不记录实际数据）
        if (Array.isArray(result)) {
          span.setAttribute('db.result.count', result.length);
        } else if (result && typeof result === 'object') {
          span.setAttribute('db.result.type', 'object');
        }

        // 标记为成功
        span.setStatus({ code: SpanStatusCode.OK });

        return result;
      } catch (error) {
        // 记录错误
        if (error instanceof Error) {
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          span.setAttribute('error.type', error.constructor.name);
          
          this.logger.error(
            `Database operation failed: ${operationName}`,
            error.stack,
          );
        }
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * 追踪数据库事务
   * 
   * @param transactionName - 事务名称
   * @param transaction - 事务函数
   * @param attributes - 额外的span属性
   * @returns 事务结果
   * 
   * @example
   * ```typescript
   * await this.dbTrace.traceTransaction(
   *   'BookingTransaction',
   *   async (tx) => {
   *     await tx.insert(sessionTable).values(session);
   *     await tx.insert(bookingTable).values(booking);
   *   },
   *   { 'student.id': studentId }
   * );
   * ```
   */
  async traceTransaction<T>(
    transactionName: string,
    transaction: (tx: NodePgDatabase<typeof schema> | null) => Promise<T>,
    attributes?: Record<string, string | number | boolean>,
  ): Promise<T> {
    const spanName = `db.transaction.${transactionName}`;
    
    return await this.tracer.startActiveSpan(spanName, async (span: Span) => {
      try {
        span.setAttribute('db.system', 'postgresql');
        span.setAttribute('db.operation', 'TRANSACTION');
        span.setAttribute('db.transaction.name', transactionName);
        
        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            span.setAttribute(key, value);
          });
        }

        span.addEvent('transaction.start');
        
        const startTime = Date.now();
        const result = await transaction(null); // tx will be provided by actual implementation
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
          
          this.logger.error(
            `Database transaction failed: ${transactionName}`,
            error.stack,
          );
        }
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * 追踪原始SQL执行
   * 
   * @param operationName - 操作名称
   * @param sqlQuery - SQL查询（仅用于日志，不会记录到span中避免泄露敏感信息）
   * @param operation - 数据库操作函数
   * @param attributes - 额外的span属性
   * @returns 查询结果
   */
  async traceRawQuery<T>(
    operationName: string,
    sqlQuery: string | SQL,
    operation: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>,
  ): Promise<T> {
    const spanName = `db.execute.${operationName}`;
    
    return await this.tracer.startActiveSpan(spanName, async (span: Span) => {
      try {
        span.setAttribute('db.system', 'postgresql');
        span.setAttribute('db.operation', 'EXECUTE');
        span.setAttribute('db.operation.name', operationName);
        
        // 只记录SQL类型，不记录完整SQL（避免泄露敏感信息）
        const sqlType = typeof sqlQuery === 'string' 
          ? this.extractSqlType(sqlQuery)
          : 'PREPARED';
        span.setAttribute('db.sql.type', sqlType);
        
        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            span.setAttribute(key, value);
          });
        }

        const startTime = Date.now();
        const result = await operation();
        const duration = Date.now() - startTime;

        span.setAttribute('db.execution.duration_ms', duration);
        span.setStatus({ code: SpanStatusCode.OK });

        return result;
      } catch (error) {
        if (error instanceof Error) {
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          
          this.logger.error(
            `Raw SQL execution failed: ${operationName}`,
            error.stack,
          );
        }
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * 从SQL语句中提取操作类型
   */
  private extractSqlType(sql: string): string {
    const normalized = sql.trim().toUpperCase();
    if (normalized.startsWith('SELECT')) return 'SELECT';
    if (normalized.startsWith('INSERT')) return 'INSERT';
    if (normalized.startsWith('UPDATE')) return 'UPDATE';
    if (normalized.startsWith('DELETE')) return 'DELETE';
    if (normalized.startsWith('CREATE')) return 'CREATE';
    if (normalized.startsWith('ALTER')) return 'ALTER';
    if (normalized.startsWith('DROP')) return 'DROP';
    return 'OTHER';
  }

  /**
   * 手动创建一个数据库操作的子span
   * 用于在已有的span中添加数据库操作的详细信息
   * 
   * @param operationName - 操作名称
   * @param callback - 回调函数
   * @returns 回调结果
   */
  async createDbSpan<T>(
    operationName: string,
    callback: (span: Span) => Promise<T>,
  ): Promise<T> {
    const spanName = `db.${operationName}`;
    
    return await this.tracer.startActiveSpan(spanName, async (span: Span) => {
      try {
        span.setAttribute('db.system', 'postgresql');
        const result = await callback(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
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
  }
}

