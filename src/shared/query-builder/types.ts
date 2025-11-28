/**
 * Prisma-like Query Builder Types
 * 类似 Prisma 的查询构建器类型定义
 *
 * 支持功能:
 * - select: 选择返回哪些字段（支持嵌套）
 * - include: 包含关联关系（支持嵌套）
 * - omit: 排除某些字段
 * - where: 过滤条件（支持关联字段过滤）
 * - orderBy: 排序（支持多字段、关联字段排序）
 * - cursor: 游标分页
 * - take: 获取数量
 * - skip: 跳过数量
 * - distinct: 去重
 * - relationLoadStrategy: 关联加载策略
 */

// ============================================================================
// 基础类型定义
// ============================================================================

/**
 * 关联加载策略
 */
export type RelationLoadStrategy = 'join' | 'query';

/**
 * JOIN 类型
 */
export type JoinType = 'left' | 'inner' | 'right' | 'full';

/**
 * 排序方向
 */
export type SortOrder = 'asc' | 'desc';

/**
 * 空排序处理方式
 */
export type NullsOrder = 'first' | 'last';

/**
 * 排序配置
 */
export interface OrderByConfig {
  sort: SortOrder;
  nulls?: NullsOrder;
}

// ============================================================================
// 条件过滤类型
// ============================================================================

/**
 * 字符串过滤条件
 */
export interface StringFilter {
  equals?: string;
  not?: string | StringFilter;
  in?: string[];
  notIn?: string[];
  lt?: string;
  lte?: string;
  gt?: string;
  gte?: string;
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  mode?: 'default' | 'insensitive';
}

/**
 * 数字过滤条件
 */
export interface NumberFilter {
  equals?: number;
  not?: number | NumberFilter;
  in?: number[];
  notIn?: number[];
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
}

/**
 * 日期过滤条件
 */
export interface DateTimeFilter {
  equals?: Date | string;
  not?: Date | string | DateTimeFilter;
  in?: (Date | string)[];
  notIn?: (Date | string)[];
  lt?: Date | string;
  lte?: Date | string;
  gt?: Date | string;
  gte?: Date | string;
}

/**
 * 布尔过滤条件
 */
export interface BoolFilter {
  equals?: boolean;
  not?: boolean | BoolFilter;
}

/**
 * UUID 过滤条件
 */
export interface UuidFilter {
  equals?: string;
  not?: string | UuidFilter;
  in?: string[];
  notIn?: string[];
  mode?: 'default' | 'insensitive';
}

/**
 * 可空值过滤
 */
export type NullableFilter<T> = T | { isNull?: boolean; isNotNull?: boolean };

/**
 * 通用字段过滤类型
 */
export type FieldFilter =
  | string
  | number
  | boolean
  | Date
  | null
  | StringFilter
  | NumberFilter
  | DateTimeFilter
  | BoolFilter
  | UuidFilter;

// ============================================================================
// 关联过滤类型
// ============================================================================

/**
 * 一对多关联过滤
 */
export interface ListRelationFilter<T> {
  every?: T;
  some?: T;
  none?: T;
}

/**
 * 一对一/多对一关联过滤
 */
export interface RelationFilter<T> {
  is?: T | null;
  isNot?: T | null;
}

// ============================================================================
// Where 条件类型
// ============================================================================

/**
 * 基础 Where 输入类型
 */
export interface BaseWhereInput {
  AND?: this | this[];
  OR?: this[];
  NOT?: this | this[];
}

/**
 * 动态 Where 输入类型
 * 支持任意字段的过滤条件
 */
export type WhereInput<T = Record<string, unknown>> = BaseWhereInput & {
  [K in keyof T]?: FieldFilter | RelationFilter<WhereInput> | ListRelationFilter<WhereInput>;
};

// ============================================================================
// OrderBy 类型
// ============================================================================

/**
 * 排序方向或配置
 */
export type OrderByDirection = SortOrder | OrderByConfig;

/**
 * 动态排序输入
 */
export type OrderByInput<T = Record<string, unknown>> = {
  [K in keyof T]?: OrderByDirection | OrderByInput;
} | Array<{
  [K in keyof T]?: OrderByDirection | OrderByInput;
}>;

// ============================================================================
// Select / Include / Omit 类型
// ============================================================================

/**
 * 关联查询嵌套配置
 */
export interface RelationNestedConfig {
  select?: SelectConfig;
  include?: IncludeConfig;
  where?: WhereInput;
  orderBy?: OrderByInput;
  cursor?: Record<string, unknown>;
  take?: number;
  skip?: number;
  distinct?: string[];
  /**
   * JOIN 类型（仅在 relationLoadStrategy='join' 时有效）
   * - 'left': LEFT JOIN（默认，包含无关联数据的记录）
   * - 'inner': INNER JOIN（只返回有关联数据的记录）
   * - 'right': RIGHT JOIN
   * - 'full': FULL OUTER JOIN
   */
  join?: JoinType;
}

/**
 * Select 配置
 * true: 选择该字段
 * 对于关联字段，可以嵌套 select/include
 */
export type SelectConfig<T = Record<string, unknown>> = {
  [K in keyof T]?: boolean | RelationNestedConfig;
};

/**
 * Include 配置
 * true: 包含关联的所有字段
 * 对象: 嵌套配置
 */
export type IncludeConfig<T = Record<string, unknown>> = {
  [K in keyof T]?: boolean | RelationNestedConfig;
};

/**
 * Omit 配置
 * true: 排除该字段
 */
export type OmitConfig<T = Record<string, unknown>> = {
  [K in keyof T]?: boolean;
};

// ============================================================================
// Cursor 类型
// ============================================================================

/**
 * 游标输入类型（唯一标识符）
 */
export type CursorInput<T = Record<string, unknown>> = {
  [K in keyof T]?: T[K];
};

// ============================================================================
// FindMany 主入参类型
// ============================================================================

/**
 * FindMany 查询参数
 * 完整的 Prisma 风格查询接口
 */
export interface FindManyArgs<
  TSelect = Record<string, unknown>,
  TInclude = Record<string, unknown>,
  TOmit = Record<string, unknown>,
  TWhere = Record<string, unknown>,
  TOrderBy = Record<string, unknown>,
  TCursor = Record<string, unknown>,
> {
  /**
   * 选择返回哪些字段
   * 与 include 互斥使用
   */
  select?: SelectConfig<TSelect> | null;

  /**
   * 包含哪些关联关系
   * 与 select 互斥使用
   */
  include?: IncludeConfig<TInclude> | null;

  /**
   * 排除哪些字段
   */
  omit?: OmitConfig<TOmit> | null;

  /**
   * 关联加载策略
   * - 'join': 使用 LEFT JOIN 一次性加载（默认，性能更好）
   * - 'query': 分别查询（适合大数据量关联）
   */
  relationLoadStrategy?: RelationLoadStrategy;

  /**
   * 过滤条件
   */
  where?: WhereInput<TWhere>;

  /**
   * 排序配置
   */
  orderBy?: OrderByInput<TOrderBy>;

  /**
   * 游标位置（用于游标分页）
   */
  cursor?: CursorInput<TCursor>;

  /**
   * 获取数量
   * 正数: 从头/游标位置开始获取
   * 负数: 从尾部开始获取
   */
  take?: number;

  /**
   * 跳过数量
   */
  skip?: number;

  /**
   * 去重字段
   */
  distinct?: string[];
}

// ============================================================================
// 关系元数据类型
// ============================================================================

/**
 * 关系类型
 */
export type RelationType = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';

/**
 * 关系定义
 */
export interface RelationDefinition {
  /**
   * 关系名称
   */
  name: string;

  /**
   * 关系类型
   */
  type: RelationType;

  /**
   * 目标表名
   */
  target: string;

  /**
   * 本表外键字段
   */
  fromField?: string;

  /**
   * 目标表关联字段
   */
  toField?: string;

  /**
   * 中间表（多对多）
   */
  through?: {
    table: string;
    fromField: string;
    toField: string;
  };

  /**
   * 是否可选关系
   */
  optional?: boolean;
}

/**
 * 表元数据
 */
export interface TableMetadata {
  /**
   * 表名
   */
  name: string;

  /**
   * 主键字段名
   */
  primaryKey: string | string[];

  /**
   * 字段列表
   */
  columns: string[];

  /**
   * 关系定义
   */
  relations: Record<string, RelationDefinition>;
}

// ============================================================================
// 查询结果类型
// ============================================================================

/**
 * 查询结果
 */
export interface QueryResult<T> {
  data: T[];
  count?: number;
}

/**
 * 分页查询结果
 */
export interface PaginatedQueryResult<T> extends QueryResult<T> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============================================================================
// 内部使用类型
// ============================================================================

/**
 * 解析后的字段选择
 */
export interface ParsedFieldSelection {
  /**
   * 选中的字段
   */
  fields: Set<string>;

  /**
   * 排除的字段
   */
  excludedFields: Set<string>;

  /**
   * 关联配置
   */
  relations: Map<string, {
    include: boolean;
    nested?: ParsedFieldSelection;
    where?: WhereInput;
    orderBy?: OrderByInput;
    take?: number;
    skip?: number;
    distinct?: string[];
    /**
     * JOIN 类型
     */
    join?: JoinType;
  }>;
}

/**
 * 解析后的 Where 条件
 */
export interface ParsedWhereCondition {
  /**
   * SQL 条件片段
   */
  sql: string;

  /**
   * 参数值
   */
  params: unknown[];

  /**
   * 关联过滤条件
   */
  relationFilters: Map<string, ParsedWhereCondition>;
}

/**
 * 解析后的排序
 */
export interface ParsedOrderBy {
  /**
   * 字段名
   */
  field: string;

  /**
   * 排序方向
   */
  direction: SortOrder;

  /**
   * 空值排序
   */
  nulls?: NullsOrder;

  /**
   * 关联表名（如果是关联字段排序）
   */
  relation?: string;
}

