/**
 * REST API 查询协议模块
 *
 * 提供统一的查询参数 DTO 和转换器，用于 REST API
 *
 * 使用示例：
 *
 * 1. 基础使用：
 * ```typescript
 * import { QueryParamsDto, QueryParamsTransformer } from '@shared/query-builder/api';
 *
 * @Controller('students')
 * class StudentController {
 *   @Get()
 *   async list(@Query() query: QueryParamsDto) {
 *     const prismaArgs = QueryParamsTransformer.transform(query, {
 *       searchFields: ['nameEn', 'nameZh', 'email'],
 *       allowedFilterFields: ['status', 'createdTime', 'type'],
 *     });
 *     return this.queryService.findMany(studentTable, prismaArgs);
 *   }
 * }
 * ```
 *
 * 2. 带分页的列表查询：
 * ```typescript
 * @Get()
 * async list(@Query() query: ListQueryParamsDto) {
 *   const { page, pageSize, ...prismaArgs } = QueryParamsTransformer.transformList(query, {
 *     searchFields: ['name'],
 *     defaultPageSize: 20,
 *   });
 *
 *   const [data, total] = await Promise.all([
 *     this.queryService.findMany(table, prismaArgs),
 *     this.queryService.count(table, { where: prismaArgs.where }),
 *   ]);
 *
 *   return createPaginatedResult(data, total, page, pageSize);
 * }
 * ```
 *
 * 3. API 请求示例：
 * ```
 * GET /api/v1/students?filter={"status":"active"}&orderBy=createdTime:desc&take=10
 * GET /api/v1/students?filter={"status":{"in":["active","pending"]}}&orderBy=name:asc
 * GET /api/v1/students?filter={"AND":[{"status":"active"},{"type":"vip"}]}&search=john
 * GET /api/v1/students?page=1&pageSize=20&filter={"createdTime":{"gte":"2024-01-01"}}
 * ```
 */

// DTO
export {
  QueryParamsDto,
  ListQueryParamsDto,
  PaginationParams,
  CursorPaginationParams,
  OrderByItem,
  SortDirection,
  FilterOperator,
  type FilterInput,
  type FilterValue,
  type FieldFilterValue,
} from './query-params.dto';

// 转换器
export {
  QueryParamsTransformer,
  type TransformOptions,
  type PaginatedResult,
  type CursorPaginatedResult,
  createPaginatedResult,
  createCursorPaginatedResult,
} from './query-params.transformer';

