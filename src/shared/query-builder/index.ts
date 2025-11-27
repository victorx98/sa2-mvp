/**
 * Prisma-like Query Builder Module
 * 类似 Prisma 的通用查询构建器模块
 *
 * 特性：
 * - 自动从 schema 推断表关系（基于外键）
 * - 支持 JOIN 和分离查询两种关联加载策略
 * - 支持 select/include/omit 字段选择（嵌套）
 * - 支持复杂的 where 条件（AND/OR/NOT、关联过滤）
 * - 支持 orderBy/cursor/take/skip/distinct
 *
 * 使用示例：
 *
 * 1. 在 NestJS 服务中使用 PrismaQueryService：
 * ```typescript
 * import { PrismaQueryService } from '@shared/query-builder';
 * import { studentTable, userTable } from '@infrastructure/database/schema';
 *
 * @Injectable()
 * class MyService {
 *   constructor(private readonly queryService: PrismaQueryService) {}
 *
 *   async getStudents() {
 *     // 自动推断关系，使用 JOIN 加载关联数据
 *     return this.queryService.findMany(studentTable, {
 *       where: { status: 'active' },
 *       include: {
 *         user: true,           // LEFT JOIN user
 *         highSchool: true,     // LEFT JOIN schools
 *       },
 *       orderBy: { createdTime: 'desc' },
 *       take: 10,
 *     });
 *   }
 *
 *   async getStudentsWithInnerJoin() {
 *     // 指定 INNER JOIN
 *     return this.queryService.findMany(studentTable, {
 *       include: {
 *         user: { join: 'inner' },  // INNER JOIN - 只返回有关联的记录
 *       },
 *     });
 *   }
 *
 *   async getStudentsWithSeparateQuery() {
 *     // 使用分离查询（适合一对多关系）
 *     return this.queryService.findMany(studentTable, {
 *       include: { mentors: true },
 *       relationLoadStrategy: 'query',  // 分离查询
 *     });
 *   }
 * }
 * ```
 *
 * 2. 独立使用（脚本/测试）：
 * ```typescript
 * import { createQueryService } from '@shared/query-builder';
 * import * as schema from '@infrastructure/database/schema';
 *
 * const queryService = createQueryService(db, schema);
 * const users = await queryService.findMany(schema.userTable, {
 *   where: { id: '123' },
 * });
 * ```
 *
 * 3. 手动添加自定义关系（可选）：
 * ```typescript
 * const registry = queryService.getRegistry();
 * registry.defineRelation('user', 'customRelation', manyToOne('custom_table', {
 *   fromField: 'customId',
 *   toField: 'id',
 * }));
 * ```
 */

// 类型定义
export * from './types';

// Schema 注册中心
export {
  SchemaRegistry,
  oneToOne,
  manyToOne,
  oneToMany,
  manyToMany,
} from './schema-registry';

// 查询构建器
export {
  WhereParser,
  OrderByParser,
  FieldSelectionParser,
  JoinBuilder,
  QueryExecutor,
  createQueryExecutor,
  createFindMany,
} from './query-builder';

// Prisma 风格查询服务
export {
  PrismaQueryService,
  createPrismaFindMany,
  createQueryService,
} from './prisma-query.service';

// NestJS 模块
export { QueryBuilderModule } from './query-builder.module';
