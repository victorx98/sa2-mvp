/**
 * Prisma-like Query Service
 * 提供类似 Prisma Client 的查询 API
 *
 * 使用方式：
 * ```typescript
 * const queryService = new PrismaQueryService(db, schema);
 *
 * // 简单查询
 * const users = await queryService.findMany(userTable, {
 *   where: { status: 'active' },
 *   orderBy: { createdAt: 'desc' },
 *   take: 10,
 * });
 *
 * // 关联查询（使用 JOIN）
 * const students = await queryService.findMany(studentTable, {
 *   where: { status: 'active' },
 *   include: {
 *     user: true,  // 自动 LEFT JOIN
 *     highSchool: { join: 'inner' },  // 指定 INNER JOIN
 *   },
 *   relationLoadStrategy: 'join',  // 默认使用 JOIN
 * });
 *
 * // 字段选择
 * const users = await queryService.findMany(userTable, {
 *   select: {
 *     id: true,
 *     email: true,
 *     nameEn: true,
 *   },
 * });
 * ```
 */

import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PgTable } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import * as schema from '@infrastructure/database/schema';
import {
  FindManyArgs,
  WhereInput,
  SelectConfig,
  IncludeConfig,
  OmitConfig,
} from './types';
import { SchemaRegistry } from './schema-registry';
import { QueryExecutor, WhereParser } from './query-builder';

/**
 * Prisma 风格的查询服务
 * 提供 findMany, findFirst, findUnique, count 等方法
 */
@Injectable()
export class PrismaQueryService implements OnModuleInit {
  private readonly logger = new Logger(PrismaQueryService.name);
  private readonly registry: SchemaRegistry;
  private executor: QueryExecutor<typeof schema>;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {
    this.registry = SchemaRegistry.getInstance();
  }

  /**
   * 模块初始化时自动从 schema 推断关系
   */
  onModuleInit() {
    // 自动从 schema 模块初始化，无需手动注册
    this.registry.initializeFromSchema(schema);
    this.executor = new QueryExecutor(this.db, this.registry);
    
    this.logger.log(
      `PrismaQueryService initialized with ${this.registry.getTableNames().length} tables (auto-inferred from schema)`
    );
  }

  /**
   * 查询多条记录
   * 类似 Prisma 的 findMany
   *
   * @param table - Drizzle 表定义
   * @param args - 查询参数
   * @returns 查询结果数组
   *
   * @example
   * ```typescript
   * // 简单查询
   * const users = await queryService.findMany(userTable, {
   *   where: { status: 'active' },
   *   take: 10,
   * });
   *
   * // 使用 JOIN 关联查询
   * const students = await queryService.findMany(studentTable, {
   *   include: {
   *     user: true,  // LEFT JOIN user
   *     highSchool: { join: 'inner' },  // INNER JOIN schools
   *   },
   *   relationLoadStrategy: 'join',  // 使用 JOIN（默认）
   * });
   *
   * // 使用分离查询（适合一对多关系）
   * const contracts = await queryService.findMany(contracts, {
   *   include: { entitlements: true },
   *   relationLoadStrategy: 'query',  // 分离查询
   * });
   * ```
   */
  async findMany<T extends PgTable<any>>(
    table: T,
    args?: FindManyArgs,
  ): Promise<Record<string, unknown>[]> {
    const result = await this.executor.findMany(table, args);
    return result.data;
  }

  /**
   * 查询第一条记录
   * 类似 Prisma 的 findFirst
   *
   * @param table - Drizzle 表定义
   * @param args - 查询参数（不含 take）
   * @returns 第一条记录或 null
   */
  async findFirst<T extends PgTable<any>>(
    table: T,
    args?: Omit<FindManyArgs, 'take'>,
  ): Promise<Record<string, unknown> | null> {
    const result = await this.executor.findMany(table, { ...args, take: 1 });
    return result.data[0] || null;
  }

  /**
   * 根据唯一标识查询记录
   * 类似 Prisma 的 findUnique
   *
   * @param table - Drizzle 表定义
   * @param args - 查询参数，where 必须包含唯一标识
   * @returns 匹配的记录或 null
   */
  async findUnique<T extends PgTable<any>>(
    table: T,
    args: {
      where: WhereInput;
      select?: SelectConfig | null;
      include?: IncludeConfig | null;
      omit?: OmitConfig | null;
    },
  ): Promise<Record<string, unknown> | null> {
    const result = await this.executor.findMany(table, { ...args, take: 1 });
    return result.data[0] || null;
  }

  /**
   * 统计记录数量
   * 类似 Prisma 的 count
   *
   * @param table - Drizzle 表定义
   * @param args - 查询参数
   * @returns 记录数量
   */
  async count<T extends PgTable<any>>(
    table: T,
    args?: { where?: WhereInput },
  ): Promise<number> {
    const whereParser = new WhereParser(this.registry);
    const whereCondition = args?.where ? whereParser.parse(table, args.where) : undefined;

    let query = this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(table as any)
      .$dynamic();

    if (whereCondition) {
      query = query.where(whereCondition);
    }

    const result = await query;
    return result[0]?.count || 0;
  }

  /**
   * 检查记录是否存在
   *
   * @param table - Drizzle 表定义
   * @param where - 过滤条件
   * @returns 是否存在
   */
  async exists<T extends PgTable<any>>(
    table: T,
    where: WhereInput,
  ): Promise<boolean> {
    const count = await this.count(table, { where });
    return count > 0;
  }

  /**
   * 获取 Schema Registry 实例
   * 用于查看自动推断的关系或添加自定义关系
   */
  getRegistry(): SchemaRegistry {
    return this.registry;
  }

  /**
   * 获取底层数据库连接
   * 用于执行原生查询
   */
  getDb(): NodePgDatabase<typeof schema> {
    return this.db;
  }
}

// ============================================================================
// 独立工厂函数（不依赖 NestJS DI）
// ============================================================================

/**
 * 创建独立的 Prisma 风格查询服务
 * 不依赖 NestJS DI，适用于脚本或测试
 *
 * @param db - Drizzle 数据库连接
 * @param schemaModule - Schema 模块（如 import * as schema）
 * @returns 查询服务对象
 *
 * @example
 * ```typescript
 * import { createQueryService } from '@shared/query-builder';
 * import { drizzle } from 'drizzle-orm/node-postgres';
 * import * as schema from '@infrastructure/database/schema';
 *
 * const db = drizzle(pool, { schema });
 * const queryService = createQueryService(db, schema);
 *
 * const users = await queryService.findMany(schema.userTable, {
 *   where: { status: 'active' },
 *   include: { students: true },
 * });
 * ```
 */
export function createQueryService<TSchema extends Record<string, unknown>>(
  db: NodePgDatabase<TSchema>,
  schemaModule: Record<string, unknown>,
) {
  const registry = SchemaRegistry.getInstance();
  
  // 自动从 schema 初始化
  registry.initializeFromSchema(schemaModule);
  
  const executor = new QueryExecutor(db as NodePgDatabase<any>, registry);

  return {
    registry,

    async findMany<T extends PgTable<any>>(
      table: T,
      args?: FindManyArgs,
    ): Promise<Record<string, unknown>[]> {
      const result = await executor.findMany(table, args);
      return result.data;
    },

    async findFirst<T extends PgTable<any>>(
      table: T,
      args?: Omit<FindManyArgs, 'take'>,
    ): Promise<Record<string, unknown> | null> {
      const result = await executor.findMany(table, { ...args, take: 1 });
      return result.data[0] || null;
    },

    async findUnique<T extends PgTable<any>>(
      table: T,
      args: {
        where: WhereInput;
        select?: SelectConfig | null;
        include?: IncludeConfig | null;
        omit?: OmitConfig | null;
      },
    ): Promise<Record<string, unknown> | null> {
      const result = await executor.findMany(table, { ...args, take: 1 });
      return result.data[0] || null;
    },

    async count<T extends PgTable<any>>(
      table: T,
      args?: { where?: WhereInput },
    ): Promise<number> {
      const whereParser = new WhereParser(registry);
      const whereCondition = args?.where ? whereParser.parse(table, args.where) : undefined;

      let query = db
        .select({ count: sql<number>`count(*)::int` })
        .from(table as any)
        .$dynamic();

      if (whereCondition) {
        query = query.where(whereCondition);
      }

      const result = await query;
      return (result[0] as { count?: number })?.count || 0;
    },

    async exists<T extends PgTable<any>>(
      table: T,
      where: WhereInput,
    ): Promise<boolean> {
      const count = await this.count(table, { where });
      return count > 0;
    },
  };
}

/**
 * 创建 findMany 函数
 * 最简化的使用方式
 *
 * @param db - Drizzle 数据库连接
 * @param schemaModule - Schema 模块
 * @returns findMany 函数
 */
export function createPrismaFindMany<TSchema extends Record<string, unknown>>(
  db: NodePgDatabase<TSchema>,
  schemaModule: Record<string, unknown>,
): <T extends PgTable<any>>(table: T, args?: FindManyArgs) => Promise<Record<string, unknown>[]> {
  const service = createQueryService(db, schemaModule);
  return service.findMany.bind(service);
}
