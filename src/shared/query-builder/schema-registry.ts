/**
 * Schema Registry - 表元数据注册中心
 * 自动从 Drizzle schema 推断表结构和关系
 */

import { TableMetadata, RelationDefinition, RelationType } from './types';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';

/**
 * 表元数据注册表
 * 自动扫描 schema 并推断关系
 */
export class SchemaRegistry {
  private static instance: SchemaRegistry;
  private tables: Map<string, TableMetadata> = new Map();
  private tableInstances: Map<string, PgTable<any>> = new Map();
  private tableNameToExportName: Map<string, string> = new Map();
  private initialized = false;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): SchemaRegistry {
    if (!SchemaRegistry.instance) {
      SchemaRegistry.instance = new SchemaRegistry();
    }
    return SchemaRegistry.instance;
  }

  /**
   * 重置实例（主要用于测试）
   */
  static resetInstance(): void {
    SchemaRegistry.instance = new SchemaRegistry();
  }

  /**
   * 从 schema 模块自动初始化
   * 自动扫描所有表并推断关系
   *
   * @param schemaModule - Drizzle schema 模块（如 import * as schema）
   */
  initializeFromSchema(schemaModule: Record<string, unknown>): this {
    if (this.initialized) {
      return this;
    }

    // 第一步：收集所有表
    const tables: Array<{ exportName: string; table: PgTable<any> }> = [];
    
    for (const [exportName, value] of Object.entries(schemaModule)) {
      if (this.isPgTable(value)) {
        tables.push({ exportName, table: value as PgTable<any> });
      }
    }

    // 第二步：注册所有表（先不处理关系）
    for (const { exportName, table } of tables) {
      const tableName = getTableName(table);
      const columns = this.extractColumns(table);
      const primaryKey = this.inferPrimaryKey(table);

      const metadata: TableMetadata = {
        name: tableName,
        primaryKey,
        columns,
        relations: {},
      };

      this.tables.set(tableName, metadata);
      this.tableInstances.set(tableName, table);
      this.tableNameToExportName.set(tableName, exportName);
    }

    // 第三步：自动推断关系（基于外键）
    for (const { table } of tables) {
      this.inferRelationsFromForeignKeys(table);
    }

    this.initialized = true;
    return this;
  }

  /**
   * 检查值是否为 PgTable
   */
  private isPgTable(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    
    // 检查是否有 Drizzle 表的特征
    const obj = value as Record<string, unknown>;
    return (
      '_' in obj &&
      typeof obj._ === 'object' &&
      obj._ !== null &&
      'name' in (obj._ as Record<string, unknown>)
    );
  }

  /**
   * 从外键推断关系
   */
  private inferRelationsFromForeignKeys(table: PgTable<any>): void {
    const tableName = getTableName(table);
    const tableMetadata = this.tables.get(tableName);
    if (!tableMetadata) return;

    try {
      const config = getTableConfig(table);
      const foreignKeys = config.foreignKeys || [];

      for (const fk of foreignKeys) {
        const ref = fk.reference();
        if (!ref.columns || ref.columns.length === 0) continue;

        const fromColumn = ref.columns[0];
        const toColumn = ref.foreignColumns[0];
        const targetTable = ref.foreignTable;
        const targetTableName = getTableName(targetTable);

        // 获取列名
        const fromFieldName = this.getColumnPropertyName(table, fromColumn.name);
        const toFieldName = this.getColumnPropertyName(targetTable, toColumn.name);

        if (!fromFieldName || !toFieldName) continue;

        // 生成关系名称：使用外键字段名（移除 Id 后缀）
        let relationName = fromFieldName;
        if (relationName.endsWith('Id')) {
          relationName = relationName.slice(0, -2);
        }

        // 如果关系名和目标表名相同，或者外键字段就是主键，用目标表的导出名
        if (relationName === 'id' || relationName === tableName) {
          const targetExportName = this.tableNameToExportName.get(targetTableName);
          if (targetExportName) {
            // 从 userTable 转为 user
            relationName = targetExportName.replace(/Table$/, '');
          } else {
            relationName = targetTableName;
          }
        }

        // 避免重复添加
        if (tableMetadata.relations[relationName]) continue;

        // 添加多对一关系（从当前表到目标表）
        tableMetadata.relations[relationName] = {
          name: relationName,
          type: 'many-to-one',
          target: targetTableName,
          fromField: fromFieldName,
          toField: toFieldName,
          optional: true,
        };

        // 同时在目标表添加一对多关系（反向关系）
        const targetMetadata = this.tables.get(targetTableName);
        if (targetMetadata) {
          // 生成反向关系名（复数形式）
          const reverseRelationName = this.pluralize(tableName);
          
          if (!targetMetadata.relations[reverseRelationName]) {
            targetMetadata.relations[reverseRelationName] = {
              name: reverseRelationName,
              type: 'one-to-many',
              target: tableName,
              fromField: toFieldName,
              toField: fromFieldName,
              optional: false,
            };
          }
        }
      }
    } catch (e) {
      // 某些表可能没有外键配置，忽略错误
    }
  }

  /**
   * 根据数据库列名获取属性名
   */
  private getColumnPropertyName(table: PgTable<any>, dbColumnName: string): string | undefined {
    const columns = getTableColumns(table);
    
    for (const [propName, column] of Object.entries(columns)) {
      if ((column as any).name === dbColumnName) {
        return propName;
      }
    }
    
    return undefined;
  }

  /**
   * 简单的复数化
   */
  private pluralize(word: string): string {
    if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) {
      return word + 'es';
    }
    if (word.endsWith('y') && !/[aeiou]y$/.test(word)) {
      return word.slice(0, -1) + 'ies';
    }
    return word + 's';
  }

  /**
   * 手动定义关系（用于无法自动推断的情况）
   */
  defineRelation(
    fromTable: string,
    relationName: string,
    definition: RelationDefinition,
  ): this {
    const tableMetadata = this.tables.get(fromTable);
    if (!tableMetadata) {
      throw new Error(`Table "${fromTable}" not registered`);
    }

    tableMetadata.relations[relationName] = definition;
    return this;
  }

  /**
   * 批量定义关系
   */
  defineRelations(
    relations: Array<{
      from: string;
      name: string;
      definition: RelationDefinition;
    }>,
  ): this {
    for (const { from, name, definition } of relations) {
      this.defineRelation(from, name, definition);
    }
    return this;
  }

  /**
   * 获取表元数据
   */
  getTable(tableName: string): TableMetadata | undefined {
    return this.tables.get(tableName);
  }

  /**
   * 获取表实例
   */
  getTableInstance(tableName: string): PgTable<any> | undefined {
    return this.tableInstances.get(tableName);
  }

  /**
   * 根据导出名获取表实例
   */
  getTableByExportName(exportName: string): PgTable<any> | undefined {
    for (const [tableName, expName] of this.tableNameToExportName) {
      if (expName === exportName) {
        return this.tableInstances.get(tableName);
      }
    }
    return undefined;
  }

  /**
   * 获取所有已注册的表名
   */
  getTableNames(): string[] {
    return Array.from(this.tables.keys());
  }

  /**
   * 获取表的关系定义
   */
  getRelation(tableName: string, relationName: string): RelationDefinition | undefined {
    const table = this.tables.get(tableName);
    return table?.relations[relationName];
  }

  /**
   * 获取表的所有关系
   */
  getRelations(tableName: string): Record<string, RelationDefinition> {
    const table = this.tables.get(tableName);
    return table?.relations || {};
  }

  /**
   * 检查字段是否存在
   */
  hasColumn(tableName: string, columnName: string): boolean {
    const table = this.tables.get(tableName);
    return table?.columns.includes(columnName) || false;
  }

  /**
   * 检查关系是否存在
   */
  hasRelation(tableName: string, relationName: string): boolean {
    const table = this.tables.get(tableName);
    return !!table?.relations[relationName];
  }

  /**
   * 提取表的字段列表
   */
  private extractColumns(table: PgTable<any>): string[] {
    const columns: string[] = [];
    const tableColumns = getTableColumns(table);
    
    for (const key of Object.keys(tableColumns)) {
      columns.push(key);
    }
    
    return columns;
  }

  /**
   * 推断主键字段
   */
  private inferPrimaryKey(table: PgTable<any>): string {
    try {
      const config = getTableConfig(table);
      const primaryKeys = config.primaryKeys;
      
      if (primaryKeys && primaryKeys.length > 0) {
        // 取第一个主键的第一个列
        const pk = primaryKeys[0];
        if (pk.columns && pk.columns.length > 0) {
          return this.getColumnPropertyName(table, pk.columns[0].name) || 'id';
        }
      }
      
      // 查找标记为主键的列
      const columns = getTableColumns(table);
      for (const [propName, column] of Object.entries(columns)) {
        if ((column as any).primary) {
          return propName;
        }
      }
    } catch (e) {
      // 忽略错误
    }
    
    // 默认假设为 'id'
    return 'id';
  }

  /**
   * 是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// 辅助函数（用于手动定义关系）
// ============================================================================

/**
 * 创建一对一关系定义
 */
export function oneToOne(
  target: string,
  options: {
    fromField?: string;
    toField?: string;
    optional?: boolean;
  } = {},
): RelationDefinition {
  return {
    name: target,
    type: 'one-to-one',
    target,
    fromField: options.fromField,
    toField: options.toField || 'id',
    optional: options.optional ?? true,
  };
}

/**
 * 创建多对一关系定义
 */
export function manyToOne(
  target: string,
  options: {
    fromField: string;
    toField?: string;
    optional?: boolean;
  },
): RelationDefinition {
  return {
    name: target,
    type: 'many-to-one',
    target,
    fromField: options.fromField,
    toField: options.toField || 'id',
    optional: options.optional ?? true,
  };
}

/**
 * 创建一对多关系定义
 */
export function oneToMany(
  target: string,
  options: {
    toField: string;
    fromField?: string;
  },
): RelationDefinition {
  return {
    name: target,
    type: 'one-to-many',
    target,
    fromField: options.fromField || 'id',
    toField: options.toField,
    optional: false,
  };
}

/**
 * 创建多对多关系定义
 */
export function manyToMany(
  target: string,
  through: {
    table: string;
    fromField: string;
    toField: string;
  },
): RelationDefinition {
  return {
    name: target,
    type: 'many-to-many',
    target,
    through,
    optional: false,
  };
}
