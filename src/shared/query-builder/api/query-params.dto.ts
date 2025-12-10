/**
 * REST API 统一查询参数 DTO
 *
 * 设计原则：
 * - select/include 由后端业务决定，不暴露给前端
 * - filter/orderBy/pagination 可以由前端控制
 *
 * 使用示例：
 * GET /api/v1/students?filter={"status":"active","createdTime":{"gte":"2024-01-01"}}&orderBy=createdTime:desc&take=10&skip=0
 *
 * 或使用简化的 filter 语法：
 * GET /api/v1/students?filter.status=active&filter.createdTime.gte=2024-01-01&orderBy=createdTime:desc&take=10
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// ============================================================================
// 排序相关
// ============================================================================

/**
 * 排序方向
 */
export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * 排序项
 */
export class OrderByItem {
  @ApiProperty({ description: '排序字段' })
  @IsString()
  field: string;

  @ApiProperty({ enum: SortDirection, description: '排序方向' })
  @IsEnum(SortDirection)
  direction: SortDirection;
}

// ============================================================================
// 过滤相关
// ============================================================================

/**
 * 过滤操作符
 */
export enum FilterOperator {
  EQUALS = 'equals',
  NOT = 'not',
  IN = 'in',
  NOT_IN = 'notIn',
  LT = 'lt',
  LTE = 'lte',
  GT = 'gt',
  GTE = 'gte',
  CONTAINS = 'contains',
  STARTS_WITH = 'startsWith',
  ENDS_WITH = 'endsWith',
  IS_NULL = 'isNull',
  IS_NOT_NULL = 'isNotNull',
}

/**
 * 字段过滤条件
 * 支持简单值或带操作符的对象
 */
export interface FieldFilterValue {
  equals?: string | number | boolean;
  not?: string | number | boolean;
  in?: (string | number)[];
  notIn?: (string | number)[];
  lt?: string | number;
  lte?: string | number;
  gt?: string | number;
  gte?: string | number;
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  isNull?: boolean;
  isNotNull?: boolean;
  mode?: 'default' | 'insensitive';
}

/**
 * 过滤条件类型
 */
export type FilterValue = string | number | boolean | null | FieldFilterValue;

/**
 * 过滤条件对象
 * 支持 AND/OR/NOT 逻辑组合
 */
export interface FilterInput {
  AND?: FilterInput[];
  OR?: FilterInput[];
  NOT?: FilterInput | FilterInput[];
  [field: string]: FilterValue | FilterInput[] | FilterInput | undefined;
}

// ============================================================================
// 分页相关
// ============================================================================

/**
 * 基础分页参数
 */
export class PaginationParams {
  @ApiPropertyOptional({
    description: '获取数量（正数从头开始，负数从尾开始）',
    minimum: -100,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(-100)
  @Max(100)
  @Type(() => Number)
  take?: number;

  @ApiPropertyOptional({
    description: '跳过数量',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  skip?: number;
}

/**
 * 游标分页参数
 */
export class CursorPaginationParams extends PaginationParams {
  @ApiPropertyOptional({
    description: '游标值（通常是主键ID）',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: '游标字段名（默认为 id）',
    default: 'id',
  })
  @IsOptional()
  @IsString()
  cursorField?: string;
}

// ============================================================================
// 统一查询参数 DTO
// ============================================================================

/**
 * 统一查询参数 DTO
 *
 * 使用方式：
 * ```typescript
 * @Get()
 * async list(@Query() query: QueryParamsDto) {
 *   const prismaArgs = QueryParamsTransformer.transform(query);
 *   return this.queryService.findMany(table, prismaArgs);
 * }
 * ```
 */
export class QueryParamsDto extends CursorPaginationParams {
  @ApiPropertyOptional({
    description: `过滤条件（JSON 格式）。
示例：
- 简单过滤: {"status":"active"}
- 范围过滤: {"createdTime":{"gte":"2024-01-01"}}
- 包含过滤: {"name":{"contains":"test","mode":"insensitive"}}
- 组合过滤: {"AND":[{"status":"active"},{"type":"mentor"}]}
- 或条件: {"OR":[{"status":"active"},{"status":"pending"}]}
`,
    example: '{"status":"active"}',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  filter?: FilterInput;

  @ApiPropertyOptional({
    description: `排序规则，格式：field1:asc,field2:desc。
示例：
- 单字段: "createdTime:desc"
- 多字段: "status:asc,createdTime:desc"
`,
    example: 'createdTime:desc',
  })
  @IsOptional()
  @IsString()
  orderBy?: string;

  @ApiPropertyOptional({
    description: '搜索关键词（通用搜索，具体搜索字段由后端业务决定）',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: '去重字段列表（逗号分隔）',
    example: 'status,type',
  })
  @IsOptional()
  @IsString()
  distinct?: string;
}

/**
 * 列表查询参数（使用偏移分页）
 */
export class ListQueryParamsDto extends PaginationParams {
  @ApiPropertyOptional({
    description: '页码（从1开始）',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: '每页数量',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number;

  @ApiPropertyOptional({
    description: '过滤条件（JSON 格式）',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  filter?: FilterInput;

  @ApiPropertyOptional({
    description: '排序规则（field:direction 格式，逗号分隔）',
  })
  @IsOptional()
  @IsString()
  orderBy?: string;

  @ApiPropertyOptional({
    description: '搜索关键词',
  })
  @IsOptional()
  @IsString()
  search?: string;
}


