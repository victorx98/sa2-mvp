/**
 * REST API 查询参数转换器
 * 将 REST API 的查询参数转换为 Prisma 风格的 FindManyArgs
 */

import { FindManyArgs, OrderByInput } from '../types';
import {
  QueryParamsDto,
  ListQueryParamsDto,
  FilterInput,
  FilterValue,
} from './query-params.dto';

/**
 * API Where 输入类型
 * 使用更宽松的类型以支持前端传入的 JSON
 */
type ApiWhereInput = Record<string, unknown>;

/**
 * 查询参数转换器
 * 将 REST API 参数转换为 Prisma 风格的查询参数
 */
export class QueryParamsTransformer {
  /**
   * 转换 QueryParamsDto 为 FindManyArgs
   *
   * @param params - REST API 查询参数
   * @param options - 转换选项
   * @returns Prisma 风格的查询参数
   *
   * @example
   * ```typescript
   * const prismaArgs = QueryParamsTransformer.transform(query);
   * const results = await queryService.findMany(table, prismaArgs);
   * ```
   */
  static transform(
    params: QueryParamsDto,
    options: TransformOptions = {},
  ): FindManyArgs {
    const result: FindManyArgs = {};

    // 转换 filter -> where
    if (params.filter) {
      result.where = this.transformFilter(params.filter, options) as any;
    }

    // 转换 orderBy
    if (params.orderBy) {
      result.orderBy = this.transformOrderBy(params.orderBy);
    }

    // 转换 pagination
    if (params.take !== undefined) {
      result.take = params.take;
    }

    if (params.skip !== undefined) {
      result.skip = params.skip;
    }

    // 转换 cursor
    if (params.cursor) {
      const cursorField = params.cursorField || 'id';
      result.cursor = { [cursorField]: params.cursor };
    }

    // 转换 distinct
    if (params.distinct) {
      result.distinct = params.distinct.split(',').map(s => s.trim());
    }

    // 处理通用搜索（需要业务层指定搜索字段）
    if (params.search && options.searchFields && options.searchFields.length > 0) {
      const searchCondition = this.buildSearchCondition(
        params.search,
        options.searchFields,
        options.searchMode,
      );

      if (result.where) {
        // 合并搜索条件
        result.where = {
          AND: [result.where, searchCondition],
        } as any;
      } else {
        result.where = searchCondition as any;
      }
    }

    return result;
  }

  /**
   * 转换 ListQueryParamsDto 为 FindManyArgs（偏移分页）
   *
   * @param params - 列表查询参数
   * @param options - 转换选项
   * @returns Prisma 风格的查询参数
   */
  static transformList(
    params: ListQueryParamsDto,
    options: TransformOptions = {},
  ): FindManyArgs & { page: number; pageSize: number } {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;

    const result: FindManyArgs & { page: number; pageSize: number } = {
      page,
      pageSize,
      take: pageSize,
      skip: (page - 1) * pageSize,
    };

    // 转换 filter -> where
    if (params.filter) {
      result.where = this.transformFilter(params.filter, options) as any;
    }

    // 转换 orderBy
    if (params.orderBy) {
      result.orderBy = this.transformOrderBy(params.orderBy);
    }

    // 处理通用搜索
    if (params.search && options.searchFields && options.searchFields.length > 0) {
      const searchCondition = this.buildSearchCondition(
        params.search,
        options.searchFields,
        options.searchMode,
      );

      if (result.where) {
        result.where = {
          AND: [result.where, searchCondition],
        } as any;
      } else {
        result.where = searchCondition as any;
      }
    }

    return result;
  }

  /**
   * 转换 filter 为 where 条件
   */
  static transformFilter(
    filter: FilterInput,
    options: TransformOptions = {},
  ): ApiWhereInput {
    const where: ApiWhereInput = {};

    for (const [key, value] of Object.entries(filter)) {
      if (value === undefined) continue;

      // 处理逻辑操作符
      if (key === 'AND' && Array.isArray(value)) {
        where.AND = value.map(v => this.transformFilter(v as FilterInput, options));
        continue;
      }

      if (key === 'OR' && Array.isArray(value)) {
        where.OR = value.map(v => this.transformFilter(v as FilterInput, options));
        continue;
      }

      if (key === 'NOT') {
        if (Array.isArray(value)) {
          where.NOT = value.map(v => this.transformFilter(v as FilterInput, options));
        } else {
          where.NOT = this.transformFilter(value as FilterInput, options);
        }
        continue;
      }

      // 检查是否在允许的字段列表中
      if (options.allowedFilterFields && !options.allowedFilterFields.includes(key)) {
        continue; // 跳过不允许的字段
      }

      // 转换字段值
      where[key] = this.transformFieldValue(value as FilterValue);
    }

    return where;
  }

  /**
   * 转换字段过滤值
   */
  private static transformFieldValue(value: FilterValue): unknown {
    // 直接值
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    // 对象格式（带操作符）
    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};

      for (const [op, opValue] of Object.entries(value)) {
        switch (op) {
          case 'equals':
          case 'not':
          case 'lt':
          case 'lte':
          case 'gt':
          case 'gte':
          case 'contains':
          case 'startsWith':
          case 'endsWith':
          case 'mode':
            result[op] = opValue;
            break;
          case 'in':
          case 'notIn':
            // 确保是数组
            result[op] = Array.isArray(opValue) ? opValue : [opValue];
            break;
          case 'isNull':
            if (opValue === true) {
              result.isNull = true;
            }
            break;
          case 'isNotNull':
            if (opValue === true) {
              result.isNotNull = true;
            }
            break;
          default:
            // 可能是嵌套对象（关联过滤）
            result[op] = this.transformFieldValue(opValue as FilterValue);
        }
      }

      return result;
    }

    return value;
  }

  /**
   * 转换 orderBy 字符串为 OrderByInput
   *
   * @param orderByStr - 格式: "field1:asc,field2:desc"
   * @returns Prisma 风格的 OrderByInput
   */
  static transformOrderBy(orderByStr: string): OrderByInput {
    const items = orderByStr.split(',').map(s => s.trim()).filter(Boolean);
    
    if (items.length === 0) {
      return {};
    }

    if (items.length === 1) {
      const [field, direction] = items[0].split(':');
      return {
        [field.trim()]: (direction?.trim().toLowerCase() || 'asc') as 'asc' | 'desc',
      };
    }

    // 多字段排序，返回数组
    return items.map(item => {
      const [field, direction] = item.split(':');
      return {
        [field.trim()]: (direction?.trim().toLowerCase() || 'asc') as 'asc' | 'desc',
      };
    });
  }

  /**
   * 构建搜索条件
   */
  private static buildSearchCondition(
    search: string,
    fields: string[],
    mode: 'default' | 'insensitive' = 'insensitive',
  ): ApiWhereInput {
    if (fields.length === 0) {
      return {};
    }

    const searchConditions = fields.map(field => ({
      [field]: {
        contains: search,
        mode,
      },
    }));

    if (searchConditions.length === 1) {
      return searchConditions[0];
    }

    return {
      OR: searchConditions,
    };
  }
}

/**
 * 转换选项
 */
export interface TransformOptions {
  /**
   * 允许过滤的字段列表
   * 如果指定，则只有在列表中的字段才会被处理
   * 用于防止前端过滤敏感字段
   */
  allowedFilterFields?: string[];

  /**
   * 搜索字段列表
   * 当 search 参数存在时，会在这些字段中进行搜索
   */
  searchFields?: string[];

  /**
   * 搜索模式
   * - 'default': 区分大小写
   * - 'insensitive': 不区分大小写
   */
  searchMode?: 'default' | 'insensitive';

  /**
   * 默认排序（当没有指定 orderBy 时使用）
   */
  defaultOrderBy?: string;

  /**
   * 默认每页数量
   */
  defaultPageSize?: number;

  /**
   * 最大每页数量
   */
  maxPageSize?: number;
}

// ============================================================================
// 辅助类型
// ============================================================================

/**
 * 分页结果包装器
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * 游标分页结果包装器
 */
export interface CursorPaginatedResult<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

/**
 * 创建分页结果
 */
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / pageSize);

  return {
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

/**
 * 创建游标分页结果
 */
export function createCursorPaginatedResult<T extends { id?: string }>(
  data: T[],
  take: number,
  cursorField: string = 'id',
): CursorPaginatedResult<T> {
  const hasMore = data.length >= Math.abs(take);

  return {
    data,
    pagination: {
      hasMore,
      nextCursor: hasMore && data.length > 0 ? (data[data.length - 1] as any)[cursorField] : undefined,
      prevCursor: data.length > 0 ? (data[0] as any)[cursorField] : undefined,
    },
  };
}

