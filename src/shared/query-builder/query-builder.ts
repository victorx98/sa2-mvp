/**
 * Prisma-like Query Builder
 * 类似 Prisma 的通用查询构建器
 *
 * 支持功能:
 * - where: 过滤条件（支持关联字段过滤）
 * - orderBy: 排序（支持多字段、关联字段排序）
 * - cursor: 游标分页
 * - take/skip: 分页
 * - distinct: 去重
 * - select/include/omit: 字段选择（支持嵌套）
 * - relationLoadStrategy: 'join' | 'query' - JOIN 策略
 */

import {
  and,
  or,
  not,
  eq,
  ne,
  lt,
  lte,
  gt,
  gte,
  like,
  ilike,
  inArray,
  notInArray,
  isNull,
  isNotNull,
  asc,
  desc,
  SQL,
  getTableColumns,
  getTableName,
} from 'drizzle-orm';
import { PgTable, PgColumn, alias } from 'drizzle-orm/pg-core';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  FindManyArgs,
  WhereInput,
  OrderByInput,
  SelectConfig,
  IncludeConfig,
  OmitConfig,
  StringFilter,
  NumberFilter,
  DateTimeFilter,
  BoolFilter,
  SortOrder,
  ParsedFieldSelection,
  QueryResult,
  RelationDefinition,
  JoinType,
} from './types';
import { SchemaRegistry } from './schema-registry';

// ============================================================================
// 类型守卫
// ============================================================================

function isStringFilter(value: unknown): value is StringFilter {
  if (typeof value !== 'object' || value === null) return false;
  const keys = ['equals', 'not', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'contains', 'startsWith', 'endsWith', 'mode'];
  return Object.keys(value).some(k => keys.includes(k));
}

function isNumberFilter(value: unknown): value is NumberFilter {
  if (typeof value !== 'object' || value === null) return false;
  const keys = ['equals', 'not', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte'];
  const valueKeys = Object.keys(value);
  return valueKeys.some(k => keys.includes(k)) && valueKeys.every(k => keys.includes(k));
}

function isDateTimeFilter(value: unknown): value is DateTimeFilter {
  if (typeof value !== 'object' || value === null) return false;
  const keys = ['equals', 'not', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte'];
  return Object.keys(value).some(k => keys.includes(k));
}

function isBoolFilter(value: unknown): value is BoolFilter {
  if (typeof value !== 'object' || value === null) return false;
  const keys = ['equals', 'not'];
  const valueKeys = Object.keys(value);
  return valueKeys.length > 0 && valueKeys.every(k => keys.includes(k));
}

// ============================================================================
// Where 条件解析器
// ============================================================================

export class WhereParser {
  constructor(
    private readonly registry: SchemaRegistry,
    private readonly tableAlias: string = '',
  ) {}

  /**
   * 解析 where 条件为 Drizzle SQL 条件
   */
  parse<T extends PgTable<any>>(
    table: T,
    where: WhereInput | undefined,
    aliasMap?: Map<string, string>,
  ): SQL | undefined {
    if (!where || Object.keys(where).length === 0) {
      return undefined;
    }

    const conditions: SQL[] = [];
    const columns = getTableColumns(table);
    const tableName = getTableName(table);

    for (const [key, value] of Object.entries(where)) {
      if (value === undefined) continue;

      // 处理逻辑操作符
      if (key === 'AND') {
        const andConditions = Array.isArray(value) ? value : [value];
        const parsed = andConditions
          .map(c => this.parse(table, c as WhereInput, aliasMap))
          .filter((c): c is SQL => c !== undefined);
        if (parsed.length > 0) {
          conditions.push(and(...parsed)!);
        }
        continue;
      }

      if (key === 'OR') {
        const orConditions = value as WhereInput[];
        const parsed = orConditions
          .map(c => this.parse(table, c, aliasMap))
          .filter((c): c is SQL => c !== undefined);
        if (parsed.length > 0) {
          conditions.push(or(...parsed)!);
        }
        continue;
      }

      if (key === 'NOT') {
        const notConditions = Array.isArray(value) ? value : [value];
        const parsed = notConditions
          .map(c => this.parse(table, c as WhereInput, aliasMap))
          .filter((c): c is SQL => c !== undefined);
        if (parsed.length > 0) {
          conditions.push(not(and(...parsed)!));
        }
        continue;
      }

      // 检查是否为字段
      if (key in columns) {
        const column = columns[key] as PgColumn;
        const condition = this.parseFieldCondition(column, value);
        if (condition) {
          conditions.push(condition);
        }
        continue;
      }

      // 检查是否为关系过滤
      const relation = this.registry.getRelation(tableName, key);
      if (relation && typeof value === 'object' && value !== null) {
        // 关系过滤条件会在 JOIN 中处理
        // 这里需要解析嵌套的 where 条件
        const targetTable = this.registry.getTableInstance(relation.target);
        if (targetTable) {
          const nestedWhere = this.parse(targetTable, value as WhereInput, aliasMap);
          if (nestedWhere) {
            conditions.push(nestedWhere);
          }
        }
        continue;
      }
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return conditions.length === 1 ? conditions[0] : and(...conditions);
  }

  /**
   * 解析字段过滤条件
   */
  private parseFieldCondition(column: PgColumn, value: unknown): SQL | undefined {
    // 直接值比较
    if (value === null) {
      return isNull(column);
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return eq(column, value);
    }

    if (value instanceof Date) {
      return eq(column, value);
    }

    // 检查 isNull/isNotNull
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if ('isNull' in obj && obj.isNull === true) {
        return isNull(column);
      }
      if ('isNotNull' in obj && obj.isNotNull === true) {
        return isNotNull(column);
      }
    }

    // 复杂过滤条件
    if (isStringFilter(value)) {
      return this.parseStringFilter(column, value);
    }

    if (isNumberFilter(value)) {
      return this.parseNumberFilter(column, value);
    }

    if (isDateTimeFilter(value)) {
      return this.parseDateTimeFilter(column, value);
    }

    if (isBoolFilter(value)) {
      return this.parseBoolFilter(column, value);
    }

    // UuidFilter 和 StringFilter 类似
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if ('equals' in obj || 'in' in obj || 'notIn' in obj || 'not' in obj) {
        return this.parseStringFilter(column, obj as StringFilter);
      }
    }

    return undefined;
  }

  /**
   * 解析字符串过滤条件
   */
  private parseStringFilter(column: PgColumn, filter: StringFilter): SQL | undefined {
    const conditions: SQL[] = [];
    const isInsensitive = filter.mode === 'insensitive';

    if (filter.equals !== undefined) {
      conditions.push(eq(column, filter.equals));
    }

    if (filter.not !== undefined) {
      if (typeof filter.not === 'string') {
        conditions.push(ne(column, filter.not));
      } else {
        const nestedCondition = this.parseStringFilter(column, filter.not);
        if (nestedCondition) {
          conditions.push(not(nestedCondition));
        }
      }
    }

    if (filter.in !== undefined && filter.in.length > 0) {
      conditions.push(inArray(column, filter.in));
    }

    if (filter.notIn !== undefined && filter.notIn.length > 0) {
      conditions.push(notInArray(column, filter.notIn));
    }

    if (filter.lt !== undefined) {
      conditions.push(lt(column, filter.lt));
    }

    if (filter.lte !== undefined) {
      conditions.push(lte(column, filter.lte));
    }

    if (filter.gt !== undefined) {
      conditions.push(gt(column, filter.gt));
    }

    if (filter.gte !== undefined) {
      conditions.push(gte(column, filter.gte));
    }

    if (filter.contains !== undefined) {
      const pattern = `%${filter.contains}%`;
      conditions.push(isInsensitive ? ilike(column, pattern) : like(column, pattern));
    }

    if (filter.startsWith !== undefined) {
      const pattern = `${filter.startsWith}%`;
      conditions.push(isInsensitive ? ilike(column, pattern) : like(column, pattern));
    }

    if (filter.endsWith !== undefined) {
      const pattern = `%${filter.endsWith}`;
      conditions.push(isInsensitive ? ilike(column, pattern) : like(column, pattern));
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return conditions.length === 1 ? conditions[0] : and(...conditions);
  }

  /**
   * 解析数字过滤条件
   */
  private parseNumberFilter(column: PgColumn, filter: NumberFilter): SQL | undefined {
    const conditions: SQL[] = [];

    if (filter.equals !== undefined) {
      conditions.push(eq(column, filter.equals));
    }

    if (filter.not !== undefined) {
      if (typeof filter.not === 'number') {
        conditions.push(ne(column, filter.not));
      } else {
        const nestedCondition = this.parseNumberFilter(column, filter.not);
        if (nestedCondition) {
          conditions.push(not(nestedCondition));
        }
      }
    }

    if (filter.in !== undefined && filter.in.length > 0) {
      conditions.push(inArray(column, filter.in));
    }

    if (filter.notIn !== undefined && filter.notIn.length > 0) {
      conditions.push(notInArray(column, filter.notIn));
    }

    if (filter.lt !== undefined) {
      conditions.push(lt(column, filter.lt));
    }

    if (filter.lte !== undefined) {
      conditions.push(lte(column, filter.lte));
    }

    if (filter.gt !== undefined) {
      conditions.push(gt(column, filter.gt));
    }

    if (filter.gte !== undefined) {
      conditions.push(gte(column, filter.gte));
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return conditions.length === 1 ? conditions[0] : and(...conditions);
  }

  /**
   * 解析日期过滤条件
   */
  private parseDateTimeFilter(column: PgColumn, filter: DateTimeFilter): SQL | undefined {
    const conditions: SQL[] = [];

    const toDate = (value: Date | string): Date => {
      return value instanceof Date ? value : new Date(value);
    };

    if (filter.equals !== undefined) {
      conditions.push(eq(column, toDate(filter.equals)));
    }

    if (filter.not !== undefined) {
      if (filter.not instanceof Date || typeof filter.not === 'string') {
        conditions.push(ne(column, toDate(filter.not)));
      } else {
        const nestedCondition = this.parseDateTimeFilter(column, filter.not);
        if (nestedCondition) {
          conditions.push(not(nestedCondition));
        }
      }
    }

    if (filter.in !== undefined && filter.in.length > 0) {
      conditions.push(inArray(column, filter.in.map(toDate)));
    }

    if (filter.notIn !== undefined && filter.notIn.length > 0) {
      conditions.push(notInArray(column, filter.notIn.map(toDate)));
    }

    if (filter.lt !== undefined) {
      conditions.push(lt(column, toDate(filter.lt)));
    }

    if (filter.lte !== undefined) {
      conditions.push(lte(column, toDate(filter.lte)));
    }

    if (filter.gt !== undefined) {
      conditions.push(gt(column, toDate(filter.gt)));
    }

    if (filter.gte !== undefined) {
      conditions.push(gte(column, toDate(filter.gte)));
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return conditions.length === 1 ? conditions[0] : and(...conditions);
  }

  /**
   * 解析布尔过滤条件
   */
  private parseBoolFilter(column: PgColumn, filter: BoolFilter): SQL | undefined {
    const conditions: SQL[] = [];

    if (filter.equals !== undefined) {
      conditions.push(eq(column, filter.equals));
    }

    if (filter.not !== undefined) {
      if (typeof filter.not === 'boolean') {
        conditions.push(ne(column, filter.not));
      } else {
        const nestedCondition = this.parseBoolFilter(column, filter.not);
        if (nestedCondition) {
          conditions.push(not(nestedCondition));
        }
      }
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return conditions.length === 1 ? conditions[0] : and(...conditions);
  }
}

// ============================================================================
// OrderBy 解析器
// ============================================================================

export class OrderByParser {
  constructor(private readonly registry: SchemaRegistry) {}

  /**
   * 解析 orderBy 为 Drizzle 排序条件
   */
  parse<T extends PgTable<any>>(
    table: T,
    orderBy: OrderByInput | undefined,
    joinedTables?: Map<string, PgTable<any>>,
  ): SQL[] {
    if (!orderBy) {
      return [];
    }

    const columns = getTableColumns(table);
    const results: SQL[] = [];

    // 处理数组格式
    const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];

    for (const orderItem of orderByArray) {
      for (const [key, value] of Object.entries(orderItem)) {
        if (value === undefined) continue;

        // 检查是否为字段
        if (key in columns) {
          const column = columns[key] as PgColumn;
          const direction = this.parseDirection(value);
          
          if (direction === 'asc') {
            results.push(asc(column));
          } else {
            results.push(desc(column));
          }
          continue;
        }

        // 检查是否为关联表的排序
        if (joinedTables && joinedTables.has(key)) {
          const joinedTable = joinedTables.get(key)!;
          const joinedColumns = getTableColumns(joinedTable);
          
          if (typeof value === 'object' && value !== null) {
            for (const [nestedKey, nestedValue] of Object.entries(value)) {
              if (nestedKey in joinedColumns) {
                const nestedColumn = joinedColumns[nestedKey] as PgColumn;
                const nestedDirection = this.parseDirection(nestedValue);
                
                if (nestedDirection === 'asc') {
                  results.push(asc(nestedColumn));
                } else {
                  results.push(desc(nestedColumn));
                }
              }
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * 解析排序方向
   */
  private parseDirection(value: unknown): SortOrder {
    if (typeof value === 'string') {
      return value as SortOrder;
    }
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if ('sort' in obj) {
        return obj.sort as SortOrder;
      }
    }
    return 'asc';
  }
}

// ============================================================================
// Select/Include/Omit 解析器
// ============================================================================

export class FieldSelectionParser {
  constructor(private readonly registry: SchemaRegistry) {}

  /**
   * 解析字段选择配置
   */
  parse<T extends PgTable<any>>(
    table: T,
    select?: SelectConfig | null,
    include?: IncludeConfig | null,
    omit?: OmitConfig | null,
  ): ParsedFieldSelection {
    const tableName = getTableName(table);
    const allColumns = getTableColumns(table);
    const columnNames = Object.keys(allColumns);
    const relations = this.registry.getRelations(tableName);

    const result: ParsedFieldSelection = {
      fields: new Set<string>(),
      excludedFields: new Set<string>(),
      relations: new Map(),
    };

    // 处理 select
    if (select) {
      for (const [key, value] of Object.entries(select)) {
        if (value === undefined) continue;

        // 检查是否为字段
        if (columnNames.includes(key)) {
          if (value === true) {
            result.fields.add(key);
          }
          continue;
        }

        // 检查是否为关系
        if (key in relations) {
          if (typeof value === 'boolean') {
            result.relations.set(key, { include: value });
          } else if (typeof value === 'object' && value !== null) {
            const nestedConfig = value as {
              select?: SelectConfig;
              include?: IncludeConfig;
              where?: WhereInput;
              orderBy?: OrderByInput;
              take?: number;
              skip?: number;
              distinct?: string[];
              join?: JoinType;
            };

            const targetTable = this.registry.getTableInstance(relations[key].target);
            if (targetTable) {
              result.relations.set(key, {
                include: true,
                nested: this.parse(targetTable, nestedConfig.select, nestedConfig.include),
                where: nestedConfig.where,
                orderBy: nestedConfig.orderBy,
                take: nestedConfig.take,
                skip: nestedConfig.skip,
                distinct: nestedConfig.distinct,
                join: nestedConfig.join,
              });
            }
          }
        }
      }

      // 如果使用了 select，只返回选择的字段
      if (result.fields.size === 0) {
        // 如果没有选择任何字段，默认选择所有字段
        columnNames.forEach(col => result.fields.add(col));
      }
    } else {
      // 没有 select，默认选择所有字段
      columnNames.forEach(col => result.fields.add(col));
    }

    // 处理 include（与 select 互斥，但如果同时存在，include 只处理关系）
    if (include) {
      for (const [key, value] of Object.entries(include)) {
        if (value === undefined) continue;

        // 只处理关系
        if (key in relations) {
          if (typeof value === 'boolean') {
            result.relations.set(key, { include: value });
          } else if (typeof value === 'object' && value !== null) {
            const nestedConfig = value as {
              select?: SelectConfig;
              include?: IncludeConfig;
              where?: WhereInput;
              orderBy?: OrderByInput;
              take?: number;
              skip?: number;
              distinct?: string[];
              join?: JoinType;
            };

            const targetTable = this.registry.getTableInstance(relations[key].target);
            if (targetTable) {
              result.relations.set(key, {
                include: true,
                nested: this.parse(targetTable, nestedConfig.select, nestedConfig.include),
                where: nestedConfig.where,
                orderBy: nestedConfig.orderBy,
                take: nestedConfig.take,
                skip: nestedConfig.skip,
                distinct: nestedConfig.distinct,
                join: nestedConfig.join,
              });
            }
          }
        }
      }
    }

    // 处理 omit
    if (omit) {
      for (const [key, value] of Object.entries(omit)) {
        if (value === true && columnNames.includes(key)) {
          result.fields.delete(key);
          result.excludedFields.add(key);
        }
      }
    }

    return result;
  }
}

// ============================================================================
// JOIN 构建器
// ============================================================================

interface JoinInfo {
  /** 原始表 */
  table: PgTable<any>;
  /** 带别名的表（用于 JOIN） */
  aliasedTable: ReturnType<typeof alias>;
  /** 别名名称 */
  aliasName: string;
  /** JOIN 条件 */
  on: SQL;
  /** JOIN 类型 */
  type: JoinType;
  /** 关系定义 */
  relation: RelationDefinition;
  /** 关系名称 */
  relationName: string;
}

export class JoinBuilder {
  private joins: JoinInfo[] = [];
  private aliasCounter = 0;

  constructor(private readonly registry: SchemaRegistry) {}

  /**
   * 添加 JOIN
   * 使用别名避免同一表多次 JOIN 时的冲突
   */
  addJoin(
    fromTable: PgTable<any>,
    relationName: string,
    joinType: JoinType = 'left',
  ): { alias: string; table: PgTable<any>; aliasedTable: ReturnType<typeof alias> } | null {
    const tableName = getTableName(fromTable);
    const relation = this.registry.getRelation(tableName, relationName);
    
    if (!relation) return null;

    const targetTable = this.registry.getTableInstance(relation.target);
    if (!targetTable) return null;

    // 为每个 JOIN 创建唯一别名
    const aliasName = `${relationName}_${this.aliasCounter++}`;
    const aliasedTable = alias(targetTable, aliasName);
    
    const fromColumns = getTableColumns(fromTable);
    // 获取原始表的列信息（用于检查字段是否存在）
    const targetColumns = getTableColumns(targetTable);

    // 构建 ON 条件（使用别名表的列）
    let onCondition: SQL;
    
    if (relation.type === 'many-to-one' || relation.type === 'one-to-one') {
      // 从当前表的外键字段连接到目标表的主键
      const fromField = relation.fromField || 'id';
      const toField = relation.toField || 'id';
      
      if (fromField in fromColumns && toField in targetColumns) {
        // 使用别名表的列
        onCondition = eq(
          fromColumns[fromField] as PgColumn,
          (aliasedTable as any)[toField] as PgColumn
        );
      } else {
        return null;
      }
    } else if (relation.type === 'one-to-many') {
      // 反向：从目标表的外键字段连接到当前表的主键
      const fromField = relation.fromField || 'id';
      const toField = relation.toField || 'id';
      
      if (fromField in fromColumns && toField in targetColumns) {
        onCondition = eq(
          fromColumns[fromField] as PgColumn,
          (aliasedTable as any)[toField] as PgColumn
        );
      } else {
        return null;
      }
    } else {
      // 多对多需要通过中间表，暂不支持 JOIN 方式
      return null;
    }

    this.joins.push({
      table: targetTable,
      aliasedTable,
      aliasName,
      on: onCondition,
      type: joinType,
      relation,
      relationName,
    });

    return { alias: aliasName, table: targetTable, aliasedTable };
  }

  /**
   * 获取所有 JOIN 信息
   */
  getJoins(): JoinInfo[] {
    return this.joins;
  }

  /**
   * 清空 JOIN
   */
  clear(): void {
    this.joins = [];
    this.aliasCounter = 0;
  }
}

// ============================================================================
// 查询执行器
// ============================================================================

export class QueryExecutor<TSchema extends Record<string, unknown>> {
  private readonly registry: SchemaRegistry;
  private readonly whereParser: WhereParser;
  private readonly orderByParser: OrderByParser;
  private readonly fieldSelectionParser: FieldSelectionParser;

  constructor(
    private readonly db: NodePgDatabase<TSchema>,
    registry?: SchemaRegistry,
  ) {
    this.registry = registry || SchemaRegistry.getInstance();
    this.whereParser = new WhereParser(this.registry);
    this.orderByParser = new OrderByParser(this.registry);
    this.fieldSelectionParser = new FieldSelectionParser(this.registry);
  }

  /**
   * 执行 findMany 查询
   */
  async findMany<T extends PgTable<any>>(
    table: T,
    args: FindManyArgs = {},
  ): Promise<QueryResult<Record<string, unknown>>> {
    const {
      select,
      include,
      omit,
      relationLoadStrategy = 'join',
      where,
      orderBy,
      cursor,
      take,
      skip,
      distinct,
    } = args;

    const tableName = getTableName(table);
    const columns = getTableColumns(table);
    const primaryKey = this.registry.getTable(tableName)?.primaryKey || 'id';

    // 解析字段选择
    const fieldSelection = this.fieldSelectionParser.parse(table, select, include, omit);

    // 构建 JOIN
    const joinBuilder = new JoinBuilder(this.registry);
    const joinedTables = new Map<string, { table: PgTable<any>; aliasedTable: any }>();
    const relationConfigs = new Map<string, {
      where?: WhereInput;
      orderBy?: OrderByInput;
      take?: number;
      skip?: number;
    }>();

    // 处理关联查询
    for (const [relationName, config] of fieldSelection.relations) {
      if (!config.include) continue;

      const joinType = config.join || 'left';
      const result = joinBuilder.addJoin(table, relationName, joinType);
      
      if (result) {
        joinedTables.set(relationName, { table: result.table, aliasedTable: result.aliasedTable });
        if (config.where || config.orderBy || config.take || config.skip) {
          relationConfigs.set(relationName, {
            where: config.where,
            orderBy: config.orderBy,
            take: config.take,
            skip: config.skip,
          });
        }
      }
    }

    // 根据策略决定是使用 JOIN 还是分离查询
    if (relationLoadStrategy === 'join' && joinBuilder.getJoins().length > 0) {
      return this.executeWithJoin(
        table,
        fieldSelection,
        joinBuilder,
        joinedTables,
        relationConfigs,
        where,
        orderBy,
        cursor,
        take,
        skip,
        distinct,
        primaryKey,
      );
    } else {
      return this.executeWithSeparateQueries(
        table,
        fieldSelection,
        where,
        orderBy,
        cursor,
        take,
        skip,
        distinct,
        primaryKey,
      );
    }
  }

  /**
   * 使用 JOIN 执行查询
   */
  private async executeWithJoin<T extends PgTable<any>>(
    table: T,
    fieldSelection: ParsedFieldSelection,
    joinBuilder: JoinBuilder,
    joinedTables: Map<string, { table: PgTable<any>; aliasedTable: any }>,
    relationConfigs: Map<string, { where?: WhereInput; orderBy?: OrderByInput; take?: number; skip?: number }>,
    where: WhereInput | undefined,
    orderBy: OrderByInput | undefined,
    cursor: Record<string, unknown> | undefined,
    take: number | undefined,
    skip: number | undefined,
    distinct: string[] | undefined,
    primaryKey: string | string[],
  ): Promise<QueryResult<Record<string, unknown>>> {
    const tableName = getTableName(table);
    const columns = getTableColumns(table);
    const joins = joinBuilder.getJoins();

    // 构建选择的字段（主表 + JOIN 表）
    const selectedColumns: Record<string, PgColumn> = {};
    
    // 主表字段
    for (const fieldName of fieldSelection.fields) {
      if (fieldName in columns) {
        selectedColumns[fieldName] = columns[fieldName] as PgColumn;
      }
    }

    // JOIN 表字段（带前缀，使用别名表的列）
    const joinFieldMap = new Map<string, string[]>(); // relationName -> fieldNames
    
    for (const join of joins) {
      const relationName = join.relationName;
      const relationConfig = fieldSelection.relations.get(relationName);
      
      // 获取原始表的列信息（用于确定字段名）
      const originalColumns = getTableColumns(join.table);
      
      // 确定要选择的字段
      let fieldsToSelect: string[];
      if (relationConfig?.nested && relationConfig.nested.fields.size > 0) {
        fieldsToSelect = Array.from(relationConfig.nested.fields);
      } else {
        fieldsToSelect = Object.keys(originalColumns);
      }

      const prefixedFields: string[] = [];
      for (const fieldName of fieldsToSelect) {
        if (fieldName in originalColumns) {
          const prefixedName = `${relationName}_${fieldName}`;
          // 使用别名表的列
          selectedColumns[prefixedName] = (join.aliasedTable as any)[fieldName] as PgColumn;
          prefixedFields.push(fieldName);
        }
      }
      joinFieldMap.set(relationName, prefixedFields);
    }

    // 构建查询
    let query = this.db.select(selectedColumns).from(table as any).$dynamic();

    // 添加 JOIN（使用别名表）
    for (const join of joins) {
      if (join.type === 'left') {
        query = query.leftJoin(join.aliasedTable as any, join.on);
      } else if (join.type === 'inner') {
        query = query.innerJoin(join.aliasedTable as any, join.on);
      } else if (join.type === 'right') {
        query = query.rightJoin(join.aliasedTable as any, join.on);
      } else if (join.type === 'full') {
        query = query.fullJoin(join.aliasedTable as any, join.on);
      }
    }

    // 应用主表 where 条件
    const whereCondition = this.whereParser.parse(table, where);
    
    // 应用关联表的 where 条件
    const allConditions: SQL[] = [];
    if (whereCondition) {
      allConditions.push(whereCondition);
    }

    for (const [relationName, config] of relationConfigs) {
      if (config.where) {
        const joinedInfo = joinedTables.get(relationName);
        if (joinedInfo) {
          // 使用别名表进行条件解析
          const relationWhere = this.whereParser.parse(joinedInfo.aliasedTable, config.where);
          if (relationWhere) {
            allConditions.push(relationWhere);
          }
        }
      }
    }

    if (allConditions.length > 0) {
      query = query.where(allConditions.length === 1 ? allConditions[0] : and(...allConditions));
    }

    // 应用 cursor 分页
    if (cursor) {
      const cursorConditions: SQL[] = [];
      const pkFields = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
      
      for (const pk of pkFields) {
        if (pk in cursor && pk in columns) {
          const cursorValue = cursor[pk];
          const pkColumn = columns[pk] as PgColumn;
          
          if (take !== undefined && take < 0) {
            cursorConditions.push(lt(pkColumn, cursorValue));
          } else {
            cursorConditions.push(gt(pkColumn, cursorValue));
          }
        }
      }
      
      if (cursorConditions.length > 0) {
        const cursorWhere = cursorConditions.length === 1 
          ? cursorConditions[0] 
          : and(...cursorConditions);
        
        query = query.where(cursorWhere);
      }
    }

    // 应用排序
    // 将 joinedTables 转换为 OrderByParser 需要的格式（使用别名表）
    const aliasedTablesMap = new Map<string, PgTable<any>>();
    for (const [relationName, { aliasedTable }] of joinedTables) {
      aliasedTablesMap.set(relationName, aliasedTable);
    }
    const orderByConditions = this.orderByParser.parse(table, orderBy, aliasedTablesMap);
    if (orderByConditions.length > 0) {
      query = query.orderBy(...orderByConditions);
    }

    // 应用 distinct
    if (distinct && distinct.length > 0) {
      const distinctColumns = distinct
        .filter(d => d in columns)
        .map(d => columns[d] as PgColumn);
      
      if (distinctColumns.length > 0) {
        query = query.groupBy(...distinctColumns);
      }
    }

    // 应用分页
    if (take !== undefined) {
      const limit = Math.abs(take);
      query = query.limit(limit);
    }

    if (skip !== undefined && skip > 0) {
      query = query.offset(skip);
    }

    // 执行查询
    const rawResults = await query;

    // 后处理：将 JOIN 结果转换为嵌套对象
    const results = this.transformJoinResults(
      rawResults,
      fieldSelection,
      joinFieldMap,
      primaryKey,
    );

    return { data: results };
  }

  /**
   * 转换 JOIN 结果为嵌套对象
   */
  private transformJoinResults(
    rawResults: Record<string, unknown>[],
    fieldSelection: ParsedFieldSelection,
    joinFieldMap: Map<string, string[]>,
    primaryKey: string | string[],
  ): Record<string, unknown>[] {
    if (rawResults.length === 0) {
      return [];
    }

    // 如果没有 JOIN，直接返回
    if (joinFieldMap.size === 0) {
      return rawResults;
    }

    // 按主键分组（处理一对多关系导致的重复行）
    const pkFields = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
    const groupedResults = new Map<string, Record<string, unknown>>();
    const relationArrays = new Map<string, Map<string, Record<string, unknown>[]>>();

    for (const row of rawResults) {
      // 构建主键值
      const pkValue = pkFields.map(pk => String(row[pk] ?? '')).join('|');
      
      if (!groupedResults.has(pkValue)) {
        // 提取主表字段
        const mainRecord: Record<string, unknown> = {};
        for (const field of fieldSelection.fields) {
          if (field in row) {
            mainRecord[field] = row[field];
          }
        }
        groupedResults.set(pkValue, mainRecord);
        relationArrays.set(pkValue, new Map());
      }

      const mainRecord = groupedResults.get(pkValue)!;
      const relArrays = relationArrays.get(pkValue)!;

      // 提取关联数据
      for (const [relationName, fields] of joinFieldMap) {
        const relationConfig = fieldSelection.relations.get(relationName);
        if (!relationConfig?.include) continue;

        const relation = this.getRelationDefinition(relationName, fieldSelection);
        const isArray = relation?.type === 'one-to-many' || relation?.type === 'many-to-many';

        // 提取关联字段
        const relatedRecord: Record<string, unknown> = {};
        let hasData = false;
        
        for (const field of fields) {
          const prefixedName = `${relationName}_${field}`;
          if (prefixedName in row) {
            relatedRecord[field] = row[prefixedName];
            if (row[prefixedName] !== null) {
              hasData = true;
            }
          }
        }

        if (isArray) {
          if (!relArrays.has(relationName)) {
            relArrays.set(relationName, []);
          }
          if (hasData) {
            // 检查是否已存在（避免重复）
            const existingArray = relArrays.get(relationName)!;
            const isDuplicate = existingArray.some(existing => 
              JSON.stringify(existing) === JSON.stringify(relatedRecord)
            );
            if (!isDuplicate) {
              existingArray.push(relatedRecord);
            }
          }
        } else {
          mainRecord[relationName] = hasData ? relatedRecord : null;
        }
      }
    }

    // 合并数组关系
    for (const [pkValue, mainRecord] of groupedResults) {
      const relArrays = relationArrays.get(pkValue)!;
      for (const [relationName, array] of relArrays) {
        mainRecord[relationName] = array;
      }
    }

    return Array.from(groupedResults.values());
  }

  /**
   * 获取关系定义
   */
  private getRelationDefinition(
    _relationName: string,
    _fieldSelection: ParsedFieldSelection,
  ): RelationDefinition | undefined {
    // 这里需要从 registry 获取，但我们没有 tableName
    // 所以暂时返回 undefined，让调用方处理
    return undefined;
  }

  /**
   * 使用分离查询执行
   */
  private async executeWithSeparateQueries<T extends PgTable<any>>(
    table: T,
    fieldSelection: ParsedFieldSelection,
    where: WhereInput | undefined,
    orderBy: OrderByInput | undefined,
    cursor: Record<string, unknown> | undefined,
    take: number | undefined,
    skip: number | undefined,
    distinct: string[] | undefined,
    primaryKey: string | string[],
  ): Promise<QueryResult<Record<string, unknown>>> {
    const columns = getTableColumns(table);

    // 构建选择的字段
    const selectedColumns: Record<string, PgColumn> = {};
    for (const fieldName of fieldSelection.fields) {
      if (fieldName in columns) {
        selectedColumns[fieldName] = columns[fieldName] as PgColumn;
      }
    }

    // 构建查询
    let query = this.db.select(selectedColumns).from(table as any).$dynamic();

    // 应用 where 条件
    const whereCondition = this.whereParser.parse(table, where);
    if (whereCondition) {
      query = query.where(whereCondition);
    }

    // 应用 cursor 分页
    if (cursor) {
      const cursorConditions: SQL[] = [];
      const pkFields = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
      
      for (const pk of pkFields) {
        if (pk in cursor && pk in columns) {
          const cursorValue = cursor[pk];
          const pkColumn = columns[pk] as PgColumn;
          
          if (take !== undefined && take < 0) {
            cursorConditions.push(lt(pkColumn, cursorValue));
          } else {
            cursorConditions.push(gt(pkColumn, cursorValue));
          }
        }
      }
      
      if (cursorConditions.length > 0) {
        const cursorWhere = cursorConditions.length === 1 
          ? cursorConditions[0] 
          : and(...cursorConditions);
        
        if (whereCondition) {
          query = query.where(and(whereCondition, cursorWhere));
        } else {
          query = query.where(cursorWhere);
        }
      }
    }

    // 应用排序
    const orderByConditions = this.orderByParser.parse(table, orderBy);
    if (orderByConditions.length > 0) {
      query = query.orderBy(...orderByConditions);
    }

    // 应用 distinct
    if (distinct && distinct.length > 0) {
      const distinctColumns = distinct
        .filter(d => d in columns)
        .map(d => columns[d] as PgColumn);
      
      if (distinctColumns.length > 0) {
        query = query.groupBy(...distinctColumns);
      }
    }

    // 应用分页
    if (take !== undefined) {
      const limit = Math.abs(take);
      query = query.limit(limit);
    }

    if (skip !== undefined && skip > 0) {
      query = query.offset(skip);
    }

    // 执行主查询
    const results = await query;

    // 如果没有关联需要加载，直接返回
    if (fieldSelection.relations.size === 0) {
      return { data: results };
    }

    // 加载关联数据（使用分离查询）
    const enrichedResults = await this.loadRelationsBySeparateQueries(
      table,
      results,
      fieldSelection.relations,
    );

    return { data: enrichedResults };
  }

  /**
   * 通过分离查询加载关联数据
   */
  private async loadRelationsBySeparateQueries<T extends PgTable<any>>(
    table: T,
    results: Record<string, unknown>[],
    relations: ParsedFieldSelection['relations'],
  ): Promise<Record<string, unknown>[]> {
    if (results.length === 0 || relations.size === 0) {
      return results;
    }

    const tableName = getTableName(table);
    const enrichedResults = [...results];

    for (const [relationName, config] of relations) {
      if (!config.include) continue;

      const relationDef = this.registry.getRelation(tableName, relationName);
      if (!relationDef) continue;

      const targetTable = this.registry.getTableInstance(relationDef.target);
      if (!targetTable) continue;

      const targetColumns = getTableColumns(targetTable);
      const fromField = relationDef.fromField || 'id';
      const toField = relationDef.toField || 'id';

      // 收集所有主表的关联键值
      const foreignKeys = enrichedResults
        .map(r => r[fromField])
        .filter((v): v is string | number => v !== null && v !== undefined);

      if (foreignKeys.length === 0) {
        for (const result of enrichedResults) {
          if (relationDef.type === 'one-to-many' || relationDef.type === 'many-to-many') {
            result[relationName] = [];
          } else {
            result[relationName] = null;
          }
        }
        continue;
      }

      // 构建选择的字段
      const selectedColumns: Record<string, PgColumn> = {};
      if (config.nested && config.nested.fields.size > 0) {
        for (const fieldName of config.nested.fields) {
          if (fieldName in targetColumns) {
            selectedColumns[fieldName] = targetColumns[fieldName] as PgColumn;
          }
        }
      } else {
        for (const [name, col] of Object.entries(targetColumns)) {
          selectedColumns[name] = col as PgColumn;
        }
      }

      // 确保包含关联字段
      if (toField in targetColumns && !(toField in selectedColumns)) {
        selectedColumns[toField] = targetColumns[toField] as PgColumn;
      }

      // 构建查询
      let relationQuery = this.db.select(selectedColumns).from(targetTable as any).$dynamic();

      // 添加关联条件
      if (toField in targetColumns) {
        const targetColumn = targetColumns[toField] as PgColumn;
        relationQuery = relationQuery.where(inArray(targetColumn, foreignKeys));
      }

      // 添加额外的 where 条件
      if (config.where) {
        const additionalWhere = this.whereParser.parse(targetTable, config.where);
        if (additionalWhere) {
          relationQuery = relationQuery.where(additionalWhere);
        }
      }

      // 添加排序
      if (config.orderBy) {
        const orderByConditions = this.orderByParser.parse(targetTable, config.orderBy);
        if (orderByConditions.length > 0) {
          relationQuery = relationQuery.orderBy(...orderByConditions);
        }
      }

      // 执行查询
      const relationResults = await relationQuery;

      // 映射回主结果
      const relationMap = new Map<unknown, Record<string, unknown>[]>();
      
      for (const relResult of relationResults) {
        const key = relResult[toField];
        if (!relationMap.has(key)) {
          relationMap.set(key, []);
        }
        relationMap.get(key)!.push(relResult);
      }

      // 填充关联数据
      for (const result of enrichedResults) {
        const key = result[fromField];
        const relatedData = relationMap.get(key) || [];

        if (relationDef.type === 'one-to-many' || relationDef.type === 'many-to-many') {
          let finalData = relatedData;
          if (config.skip !== undefined && config.skip > 0) {
            finalData = finalData.slice(config.skip);
          }
          if (config.take !== undefined) {
            finalData = finalData.slice(0, Math.abs(config.take));
          }
          result[relationName] = finalData;
        } else {
          result[relationName] = relatedData[0] || null;
        }
      }

      // 递归加载嵌套关联
      if (config.nested && config.nested.relations.size > 0) {
        const allRelatedResults = enrichedResults.flatMap(r => {
          const rel = r[relationName];
          if (Array.isArray(rel)) return rel;
          if (rel) return [rel];
          return [];
        }) as Record<string, unknown>[];

        if (allRelatedResults.length > 0) {
          await this.loadRelationsBySeparateQueries(
            targetTable,
            allRelatedResults,
            config.nested.relations,
          );
        }
      }
    }

    return enrichedResults;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建查询执行器
 */
export function createQueryExecutor<TSchema extends Record<string, unknown>>(
  db: NodePgDatabase<TSchema>,
  registry?: SchemaRegistry,
): QueryExecutor<TSchema> {
  return new QueryExecutor(db, registry);
}

/**
 * 创建 findMany 函数
 */
export function createFindMany<TSchema extends Record<string, unknown>>(
  db: NodePgDatabase<TSchema>,
  registry?: SchemaRegistry,
) {
  const executor = createQueryExecutor(db, registry);
  
  return async <T extends PgTable<any>>(
    table: T,
    args?: FindManyArgs,
  ): Promise<Record<string, unknown>[]> => {
    const result = await executor.findMany(table, args);
    return result.data;
  };
}
