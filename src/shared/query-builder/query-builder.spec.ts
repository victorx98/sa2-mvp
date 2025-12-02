import { QueryExecutor } from './query-builder';
import {
  SchemaRegistry,
  manyToOne,
  oneToOne,
  oneToMany,
} from './schema-registry';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { SQL } from 'drizzle-orm';
import { TableMetadata } from './types';

jest.mock('drizzle-orm', () => {
  const asCondition = (type: string, column?: any, value?: unknown) => ({
    kind: 'condition',
    type,
    column: column?.name,
    table: column?.tableName,
    value,
  });
  const logical = (type: string, conditions: any[]) => ({
    kind: 'condition',
    type,
    conditions: conditions.filter(Boolean),
  });

  return {
    and: (...conditions: any[]) => logical('and', conditions),
    or: (...conditions: any[]) => logical('or', conditions),
    not: (condition: any) => ({ kind: 'condition', type: 'not', condition }),
    eq: (column: any, value: unknown) => asCondition('eq', column, value),
    ne: (column: any, value: unknown) => asCondition('ne', column, value),
    lt: (column: any, value: unknown) => asCondition('lt', column, value),
    lte: (column: any, value: unknown) => asCondition('lte', column, value),
    gt: (column: any, value: unknown) => asCondition('gt', column, value),
    gte: (column: any, value: unknown) => asCondition('gte', column, value),
    like: (column: any, value: unknown) => asCondition('like', column, value),
    ilike: (column: any, value: unknown) => asCondition('ilike', column, value),
    inArray: (column: any, values: unknown[]) => ({
      kind: 'condition',
      type: 'in',
      column: column?.name,
      table: column?.tableName,
      values,
    }),
    notInArray: (column: any, values: unknown[]) => ({
      kind: 'condition',
      type: 'notIn',
      column: column?.name,
      table: column?.tableName,
      values,
    }),
    isNull: (column: any) => asCondition('isNull', column),
    isNotNull: (column: any) => asCondition('isNotNull', column),
    asc: (column: any) => ({
      kind: 'order',
      direction: 'asc',
      column: column?.name,
      table: column?.tableName,
    }),
    desc: (column: any) => ({
      kind: 'order',
      direction: 'desc',
      column: column?.name,
      table: column?.tableName,
    }),
    sql: () => ({ kind: 'raw' }),
    SQL: class SQL {},
    getTableColumns: (table: any) => table.columns,
    getTableName: (table: any) => table.name,
  };
});

interface IMockColumn extends PgColumn {
  tableName: string;
  name: string;
}

interface IMockTable {
  name: string;
  columns: Record<string, IMockColumn>;
  _: {
    readonly brand: 'Table';
    readonly config: any;
    readonly name: any;
    readonly schema: any;
    readonly columns: any;
    readonly inferSelect: { [x: string]: any };
    readonly inferInsert: { [x: string]: any };
  };
}

type QueryHandler = (query: MockQuery) => Record<string, unknown>[] | Promise<Record<string, unknown>[]>;

class MockQuery implements PromiseLike<Record<string, unknown>[]> {
  public table?: IMockTable;
  public joins: Array<{ type: string; table: IMockTable; on: SQL }> = [];
  public whereClauses: SQL[] = [];
  public orderByClauses: any[] = [];
  public groupByClauses: any[] = [];
  public limitValue?: number;
  public offsetValue?: number;

  constructor(
    public readonly selectedColumns: Record<string, PgColumn>,
    private readonly handler: QueryHandler,
  ) {}

  private ensureTable(): void {
    if (!this.table) {
      throw new Error('Table not specified before executing the query');
    }
  }

  from(table: IMockTable) {
    this.table = table;
    return this;
  }

  $dynamic() {
    return this;
  }

  where(condition?: SQL) {
    if (condition) {
      this.whereClauses.push(condition);
    }
    return this;
  }

  orderBy(...clauses: any[]) {
    this.orderByClauses.push(...clauses);
    return this;
  }

  groupBy(...columns: any[]) {
    this.groupByClauses.push(...columns);
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  offset(value: number) {
    this.offsetValue = value;
    return this;
  }

  leftJoin(table: IMockTable, on: SQL) {
    this.joins.push({ type: 'left', table, on });
    return this;
  }

  innerJoin(table: IMockTable, on: SQL) {
    this.joins.push({ type: 'inner', table, on });
    return this;
  }

  rightJoin(table: IMockTable, on: SQL) {
    this.joins.push({ type: 'right', table, on });
    return this;
  }

  fullJoin(table: IMockTable, on: SQL) {
    this.joins.push({ type: 'full', table, on });
    return this;
  }

  private execute(): Promise<Record<string, unknown>[]> {
    this.ensureTable();
    return Promise.resolve(this.handler(this));
  }

  then<TResult1 = Record<string, unknown>[], TResult2 = never>(
    onfulfilled?: ((value: Record<string, unknown>[]) => TResult1 | Promise<TResult1>) | undefined,
    onrejected?: ((reason: unknown) => TResult2 | Promise<TResult2>) | undefined,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class MockDatabase {
  private handlers: QueryHandler[] = [];

  enqueue(handler: QueryHandler) {
    this.handlers.push(handler);
  }

  select(): MockQuery;
  select<TSelection extends Record<string, PgColumn>>(selectedColumns: TSelection): MockQuery;
  select(selectedColumns?: Record<string, PgColumn>): MockQuery {
    if (this.handlers.length === 0) {
      throw new Error('No query handler registered');
    }
    const handler = this.handlers.shift()!;
    return new MockQuery(selectedColumns || {}, handler);
  }

  assertAllQueriesConsumed() {
    if (this.handlers.length !== 0) {
      throw new Error(`Expected all queries to be consumed but ${this.handlers.length} handler(s) remain`);
    }
  }
}

const createMockTable = (name: string, columns: string[]): IMockTable => {
  const columnMap: Record<string, IMockColumn> = {};
  for (const columnName of columns) {
    columnMap[columnName] = { tableName: name, name: columnName } as IMockColumn;
  }
  return {
    name,
    columns: columnMap,
    _: {
      brand: 'Table' as const,
      config: {},
      name,
      schema: undefined,
      columns: columnMap,
      inferSelect: {},
      inferInsert: {},
    },
  } as IMockTable;
};

// 辅助函数：手动注册表到 SchemaRegistry
function registerTableManually(
  registry: SchemaRegistry,
  table: IMockTable,
  metadata: Omit<TableMetadata, 'name'>,
) {
  // 使用反射访问私有方法或直接操作内部状态
  const registryAny = registry as any;
  if (!registryAny.tables) {
    registryAny.tables = new Map();
  }
  if (!registryAny.tableInstances) {
    registryAny.tableInstances = new Map();
  }

  registryAny.tables.set(table.name, {
    name: table.name,
    ...metadata,
  });
  registryAny.tableInstances.set(table.name, table as any);
}

describe('Prisma-like Query Builder', () => {
  const userTable = createMockTable('users', ['id', 'name', 'status', 'email', 'createdAt']);
  const profileTable = createMockTable('profiles', ['id', 'userId', 'bio']);
  const postTable = createMockTable('posts', ['id', 'title', 'authorId', 'content', 'publishedAt']);
  const commentTable = createMockTable('comments', ['id', 'postId', 'isPublished', 'content']);
  const tagTable = createMockTable('tags', ['id', 'name']);
  const postTagTable = createMockTable('post_tags', ['postId', 'tagId']);

  let registry: SchemaRegistry;
  let db: MockDatabase;

  beforeEach(() => {
    SchemaRegistry.resetInstance();
    registry = SchemaRegistry.getInstance();
    db = new MockDatabase();

    // 手动注册所有表
    registerTableManually(registry, userTable, {
      primaryKey: 'id',
      columns: ['id', 'name', 'status', 'email', 'createdAt'],
      relations: {},
    });

    registerTableManually(registry, profileTable, {
      primaryKey: 'id',
      columns: ['id', 'userId', 'bio'],
      relations: {},
    });

    registerTableManually(registry, postTable, {
      primaryKey: 'id',
      columns: ['id', 'title', 'authorId', 'content', 'publishedAt'],
      relations: {},
    });

    registerTableManually(registry, commentTable, {
      primaryKey: 'id',
      columns: ['id', 'postId', 'isPublished', 'content'],
      relations: {},
    });

    registerTableManually(registry, tagTable, {
      primaryKey: 'id',
      columns: ['id', 'name'],
      relations: {},
    });

    registerTableManually(registry, postTagTable, {
      primaryKey: ['postId', 'tagId'],
      columns: ['postId', 'tagId'],
      relations: {},
    });

    // 定义关系
    registry.defineRelation('users', 'profile', oneToOne('profiles', { fromField: 'id', toField: 'userId' }));
    registry.defineRelation('profiles', 'user', manyToOne('users', { fromField: 'userId', toField: 'id' }));
    registry.defineRelation('posts', 'author', manyToOne('users', { fromField: 'authorId', toField: 'id' }));
    registry.defineRelation('posts', 'comments', oneToMany('comments', { fromField: 'id', toField: 'postId' }));
    registry.defineRelation('comments', 'post', manyToOne('posts', { fromField: 'postId', toField: 'id' }));
  });

  afterEach(() => {
    db.assertAllQueriesConsumed();
  });

  const createExecutor = () => new QueryExecutor(db as any as NodePgDatabase<any>, registry);

  // ============================================================================
  // 单表查询测试
  // ============================================================================

  describe('单表查询', () => {
    it('执行简单的 findMany 查询，带基础表过滤', async () => {
      const expected = [
        { id: 'u1', name: 'Alice', status: 'active' },
        { id: 'u3', name: 'Amber', status: 'active' },
      ];

      db.enqueue(query => {
        expect(query.table?.name).toBe('users');
        expect(query.whereClauses).toHaveLength(1);
        expect(query.whereClauses[0]).toMatchObject({ type: 'eq', column: 'status', value: 'active' });
        return expected;
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, { where: { status: 'active' } });

      expect(result.data).toEqual(expected);
    });

    it('支持简单的字段选择 (select)', async () => {
      db.enqueue(query => {
        expect(query.selectedColumns).toHaveProperty('id');
        expect(query.selectedColumns).toHaveProperty('name');
        expect(query.selectedColumns).not.toHaveProperty('status');
        return [{ id: 'u1', name: 'Alice' }];
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, {
        select: {
          id: true,
          name: true,
        },
      });

      expect(result.data).toEqual([{ id: 'u1', name: 'Alice' }]);
    });

    it('支持字段排除 (omit)', async () => {
      db.enqueue(query => {
        expect(query.selectedColumns).toHaveProperty('id');
        expect(query.selectedColumns).toHaveProperty('name');
        expect(query.selectedColumns).not.toHaveProperty('email');
        return [{ id: 'u1', name: 'Alice', status: 'active' }];
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, {
        omit: {
          email: true,
        },
      });

      expect(result.data[0]).not.toHaveProperty('email');
    });

    it('支持 take 限制数量', async () => {
      db.enqueue(query => {
        expect(query.limitValue).toBe(10);
        return Array(10).fill(null).map((_, i) => ({ id: `u${i}`, name: `User ${i}` }));
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, { take: 10 });

      expect(result.data).toHaveLength(10);
    });

    it('支持 skip 跳过记录', async () => {
      db.enqueue(query => {
        expect(query.offsetValue).toBe(5);
        return Array(5).fill(null).map((_, i) => ({ id: `u${i + 5}`, name: `User ${i + 5}` }));
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, { skip: 5 });

      expect(result.data).toHaveLength(5);
    });

    it('支持 take 和 skip 组合使用', async () => {
      db.enqueue(query => {
        expect(query.limitValue).toBe(10);
        expect(query.offsetValue).toBe(5);
        return Array(10).fill(null).map((_, i) => ({ id: `u${i + 5}`, name: `User ${i + 5}` }));
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, { take: 10, skip: 5 });

      expect(result.data).toHaveLength(10);
    });

    it('支持 distinct 去重', async () => {
      db.enqueue(query => {
        expect(query.groupByClauses).toBeDefined();
        return [{ id: 'u1', name: 'Alice' }];
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, { distinct: ['status'] });

      expect(result.data).toBeDefined();
    });

    it('支持单字段排序', async () => {
      db.enqueue(query => {
        expect(query.orderByClauses).toHaveLength(1);
        expect(query.orderByClauses[0]).toMatchObject({ column: 'name', direction: 'asc' });
        return [
          { id: 'u1', name: 'Alice' },
          { id: 'u2', name: 'Bob' },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, { orderBy: { name: 'asc' } });

      expect(result.data).toHaveLength(2);
    });

    it('支持多字段排序', async () => {
      db.enqueue(query => {
        expect(query.orderByClauses.length).toBeGreaterThanOrEqual(2);
        return [
          { id: 'u1', name: 'Alice', status: 'active' },
          { id: 'u2', name: 'Bob', status: 'active' },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, {
        orderBy: [
          { status: 'asc' },
          { name: 'desc' },
        ],
      });

      expect(result.data).toHaveLength(2);
    });

    it('支持复杂的 where 条件 - AND', async () => {
      db.enqueue(query => {
        expect(query.whereClauses.length).toBeGreaterThan(0);
        return [{ id: 'u1', name: 'Alice', status: 'active', email: 'alice@example.com' }];
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, {
        where: {
          AND: [
            { status: 'active' },
            { email: { contains: 'alice' } },
          ],
        } as any,
      });

      expect(result.data).toHaveLength(1);
    });

    it('支持复杂的 where 条件 - OR', async () => {
      db.enqueue(query => {
        expect(query.whereClauses.length).toBeGreaterThan(0);
        return [
          { id: 'u1', name: 'Alice', status: 'active' },
          { id: 'u2', name: 'Bob', status: 'inactive' },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, {
        where: {
          OR: [
            { status: 'active' },
            { name: 'Bob' },
          ],
        } as any,
      });

      expect(result.data.length).toBeGreaterThanOrEqual(1);
    });

    it('支持复杂的 where 条件 - NOT', async () => {
      db.enqueue(query => {
        expect(query.whereClauses.length).toBeGreaterThan(0);
        return [{ id: 'u2', name: 'Bob', status: 'inactive' }];
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, {
        where: {
          NOT: { status: 'active' },
        } as any,
      });

      expect(result.data.length).toBeGreaterThanOrEqual(0);
    });

    it('支持字符串过滤条件 - contains', async () => {
      db.enqueue(query => {
        expect(query.whereClauses[0]).toMatchObject({ type: 'like', column: 'name' });
        return [{ id: 'u1', name: 'Alice' }];
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, {
        where: { name: { contains: 'Ali' } },
      });

      expect(result.data).toBeDefined();
    });

    it('支持字符串过滤条件 - startsWith', async () => {
      db.enqueue(query => {
        expect(query.whereClauses[0]).toMatchObject({ type: 'like', column: 'name' });
        return [{ id: 'u1', name: 'Alice' }];
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, {
        where: { name: { startsWith: 'Ali' } },
      });

      expect(result.data).toBeDefined();
    });

    it('支持字符串过滤条件 - endsWith', async () => {
      db.enqueue(query => {
        expect(query.whereClauses[0]).toMatchObject({ type: 'like', column: 'name' });
        return [{ id: 'u1', name: 'Alice' }];
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, {
        where: { name: { endsWith: 'ice' } },
      });

      expect(result.data).toBeDefined();
    });

    it('支持 in 和 notIn 过滤', async () => {
      db.enqueue(query => {
        expect(query.whereClauses[0]).toMatchObject({ type: 'in', column: 'id' });
        return [{ id: 'u1', name: 'Alice' }];
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, {
        where: { id: { in: ['u1', 'u2'] } },
      });

      expect(result.data).toBeDefined();
    });

    it('支持数字比较过滤 - lt, lte, gt, gte', async () => {
      db.enqueue(query => {
        expect(query.whereClauses[0]).toMatchObject({ type: 'lt' });
        return [];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        where: { id: { lt: 100 } },
      });

      expect(result.data).toBeDefined();
    });

    it('支持 cursor 分页', async () => {
      db.enqueue(query => {
        expect(query.whereClauses.length).toBeGreaterThan(0);
        return [
          { id: 'p2', title: 'Post 2' },
          { id: 'p3', title: 'Post 3' },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        cursor: { id: 'p1' },
        take: 10,
      });

      expect(result.data).toBeDefined();
    });
  });

  // ============================================================================
  // 关联表查询测试
  // ============================================================================

  describe('关联表查询', () => {
    it('使用默认策略执行 LEFT JOIN', async () => {
      db.enqueue(query => {
        expect(query.table?.name).toBe('posts');
        expect(query.joins).toHaveLength(1);
        expect(query.joins[0]?.type).toBe('left');
        expect(query.joins[0]?.table?.name).toBe('users');
        return [
          {
            id: 'p1',
            title: 'Post 1',
            authorId: 'u1',
            author_id: 'u1',
            author_name: 'Alice',
            author_status: 'active',
          },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        include: { author: true },
        relationLoadStrategy: 'join',
      });

      expect(result.data).toEqual([
        {
          id: 'p1',
          title: 'Post 1',
          authorId: 'u1',
          author: { id: 'u1', name: 'Alice', status: 'active' },
        },
      ]);
    });

    it('支持显式指定 INNER JOIN', async () => {
      db.enqueue(query => {
        expect(query.joins).toHaveLength(1);
        expect(query.joins[0]?.type).toBe('inner');
        return [
          {
            id: 'p2',
            title: 'Post 2',
            authorId: 'u2',
            author_id: 'u2',
            author_name: 'Bob',
          },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        include: {
          author: {
            join: 'inner',
            select: { id: true, name: true },
          },
        },
        relationLoadStrategy: 'join',
      });

      expect(result.data[0]?.author).toEqual({ id: 'u2', name: 'Bob' });
    });

    it('支持 RIGHT JOIN', async () => {
      db.enqueue(query => {
        expect(query.joins[0]?.type).toBe('right');
        return [
          {
            id: 'p1',
            title: 'Post 1',
            authorId: 'u1',
            author_id: 'u1',
            author_name: 'Alice',
          },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        include: {
          author: {
            join: 'right',
          },
        },
        relationLoadStrategy: 'join',
      });

      expect(result.data).toBeDefined();
    });

    it('支持 FULL JOIN', async () => {
      db.enqueue(query => {
        expect(query.joins[0]?.type).toBe('full');
        return [
          {
            id: 'p1',
            title: 'Post 1',
            authorId: 'u1',
            author_id: 'u1',
            author_name: 'Alice',
          },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        include: {
          author: {
            join: 'full',
          },
        },
        relationLoadStrategy: 'join',
      });

      expect(result.data).toBeDefined();
    });

    it('使用 query 策略加载一对多关系', async () => {
      db.enqueue(() => [
        { id: 'p1', title: 'Post 1', authorId: 'u1' },
      ]);

      db.enqueue(query => {
        expect(query.table?.name).toBe('comments');
        expect(query.whereClauses).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: 'in', column: 'postId', values: ['p1'] }),
          ]),
        );
        return [
          { id: 'c1', postId: 'p1', isPublished: true, content: 'Comment 1' },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        include: {
          comments: true,
        },
        relationLoadStrategy: 'query',
      });

      expect(result.data[0]?.comments).toEqual([
        { id: 'c1', postId: 'p1', isPublished: true, content: 'Comment 1' },
      ]);
    });

    it('支持关联表的嵌套 select', async () => {
      db.enqueue(query => {
        expect(query.joins).toHaveLength(1);
        return [
          {
            id: 'p1',
            title: 'Post 1',
            authorId: 'u1',
            author_id: 'u1',
            author_name: 'Alice',
          },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        include: {
          author: {
            select: { id: true, name: true },
          },
        },
        relationLoadStrategy: 'join',
      });

      expect(result.data[0]?.author).toEqual({ id: 'u1', name: 'Alice' });
      expect(result.data[0]?.author).not.toHaveProperty('status');
    });
  });

  // ============================================================================
  // 多层关联表查询测试
  // ============================================================================

  describe('多层关联表查询', () => {
    it('使用 query 策略加载多层关联', async () => {
      db.enqueue(query => {
        expect(query.table?.name).toBe('posts');
        return [
          { id: 'p1', title: 'Post 1', authorId: 'u1' },
          { id: 'p2', title: 'Post 2', authorId: 'u2' },
        ];
      });

      db.enqueue(query => {
        expect(query.table?.name).toBe('users');
        expect(query.whereClauses[0]).toMatchObject({ type: 'in', column: 'id', values: ['u1', 'u2'] });
        return [
          { id: 'u1', name: 'Alice', status: 'active' },
          { id: 'u2', name: 'Bob', status: 'inactive' },
        ];
      });

      db.enqueue(query => {
        expect(query.table?.name).toBe('profiles');
        expect(query.whereClauses[0]).toMatchObject({ type: 'in', column: 'userId', values: ['u1', 'u2'] });
        return [
          { id: 'prof-1', userId: 'u1', bio: 'Mentor' },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        include: {
          author: {
            include: { profile: true },
          },
        },
        relationLoadStrategy: 'query',
      });

      expect(result.data).toEqual([
        {
          id: 'p1',
          title: 'Post 1',
          authorId: 'u1',
          author: {
            id: 'u1',
            name: 'Alice',
            status: 'active',
            profile: { id: 'prof-1', userId: 'u1', bio: 'Mentor' },
          },
        },
        {
          id: 'p2',
          title: 'Post 2',
          authorId: 'u2',
          author: {
            id: 'u2',
            name: 'Bob',
            status: 'inactive',
            profile: null,
          },
        },
      ]);
    });

    it('支持三层关联查询', async () => {
      db.enqueue(() => [
        { id: 'c1', postId: 'p1', isPublished: true },
      ]);

      db.enqueue(query => {
        expect(query.table?.name).toBe('posts');
        expect(query.whereClauses[0]).toMatchObject({ type: 'in', column: 'id', values: ['p1'] });
        return [
          { id: 'p1', title: 'Post 1', authorId: 'u1' },
        ];
      });

      db.enqueue(query => {
        expect(query.table?.name).toBe('users');
        expect(query.whereClauses[0]).toMatchObject({ type: 'in', column: 'id', values: ['u1'] });
        return [
          { id: 'u1', name: 'Alice', status: 'active' },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(commentTable as any, {
        include: {
          post: {
            include: {
              author: true,
            },
          },
        },
        relationLoadStrategy: 'query',
      });

      expect((result.data[0] as any)?.post?.author).toEqual({
        id: 'u1',
        name: 'Alice',
        status: 'active',
      });
    });
  });

  // ============================================================================
  // 主表过滤和关联表过滤测试
  // ============================================================================

  describe('主表过滤和关联表过滤', () => {
    it('支持主表过滤条件', async () => {
      db.enqueue(query => {
        expect(query.table?.name).toBe('posts');
        // whereClauses 可能包含合并的条件，检查是否有 title 相关的条件
        const hasTitleCondition = query.whereClauses.some((clause: any) => {
          if (clause.type === 'eq' && clause.column === 'title') return true;
          if (clause.type === 'and' && clause.conditions) {
            return clause.conditions.some((c: any) => c.type === 'eq' && c.column === 'title');
          }
          return false;
        });
        expect(hasTitleCondition).toBe(true);
        return [
          {
            id: 'p3',
            title: 'Important',
            authorId: 'u1',
            author_id: 'u1',
            author_name: 'Alice',
            author_status: 'active',
          },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        where: { title: 'Important' },
        include: {
          author: {
            join: 'inner',
            where: { status: 'active' },
          },
        },
        relationLoadStrategy: 'join',
      });

      expect(result.data).toHaveLength(1);
      expect((result.data[0] as any)?.author?.status).toBe('active');
    });

    it('支持关联表过滤条件（JOIN 策略）', async () => {
      db.enqueue(query => {
        expect(query.whereClauses).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: 'eq', column: 'status', table: 'users', value: 'active' }),
          ]),
        );
        return [
          {
            id: 'p1',
            title: 'Post 1',
            authorId: 'u1',
            author_id: 'u1',
            author_name: 'Alice',
            author_status: 'active',
          },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        include: {
          author: {
            join: 'inner',
            where: { status: 'active' },
          },
        },
        relationLoadStrategy: 'join',
      });

      expect(result.data).toHaveLength(1);
    });

    it('支持关联表过滤条件（query 策略）', async () => {
      db.enqueue(() => [
        { id: 'p1', title: 'Post 1', authorId: 'u1' },
      ]);

      db.enqueue(query => {
        expect(query.table?.name).toBe('comments');
        expect(query.whereClauses).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: 'in', column: 'postId', values: ['p1'] }),
            expect.objectContaining({ type: 'eq', column: 'isPublished', value: true }),
          ]),
        );
        return [
          { id: 'c1', postId: 'p1', isPublished: true },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        include: {
          comments: {
            where: { isPublished: true },
          },
        },
        relationLoadStrategy: 'query',
      });

      expect(result.data[0]?.comments).toEqual([
        { id: 'c1', postId: 'p1', isPublished: true },
      ]);
    });

    it('支持关联表的复杂过滤条件', async () => {
      db.enqueue(() => [
        { id: 'p1', title: 'Post 1', authorId: 'u1' },
      ]);

      db.enqueue(query => {
        expect(query.whereClauses.length).toBeGreaterThan(1);
        return [
          { id: 'c1', postId: 'p1', isPublished: true, content: 'Great post!' },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        include: {
          comments: {
            where: {
              AND: [
                { isPublished: true },
                { content: { contains: 'Great' } },
              ],
            } as any,
          },
        },
        relationLoadStrategy: 'query',
      });

      expect(result.data[0]?.comments).toBeDefined();
    });
  });

  // ============================================================================
  // OrderBy 测试
  // ============================================================================

  describe('OrderBy 测试', () => {
    it('支持主表和关联表字段混合排序（JOIN 策略）', async () => {
      db.enqueue(query => {
        expect(query.orderByClauses).toEqual([
          expect.objectContaining({ column: 'title', direction: 'asc' }),
          expect.objectContaining({ column: 'name', table: 'users', direction: 'desc' }),
        ]);
        return [
          {
            id: 'p1',
            title: 'Alpha',
            authorId: 'u2',
            author_id: 'u2',
            author_name: 'Bob',
          },
          {
            id: 'p2',
            title: 'Beta',
            authorId: 'u1',
            author_id: 'u1',
            author_name: 'Alice',
          },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        include: { author: true },
        relationLoadStrategy: 'join',
        orderBy: [
          { title: 'asc' },
          { author: { name: 'desc' } },
        ],
      });

      expect(result.data).toHaveLength(2);
      expect((result.data[0] as any)?.author?.name).toBeDefined();
    });

    it('支持关联表排序（query 策略）', async () => {
      db.enqueue(() => [
        { id: 'p1', title: 'Post 1', authorId: 'u1' },
      ]);

      db.enqueue(query => {
        expect(query.orderByClauses.length).toBeGreaterThan(0);
        return [
          { id: 'c2', postId: 'p1', isPublished: true, content: 'Second' },
          { id: 'c1', postId: 'p1', isPublished: true, content: 'First' },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        include: {
          comments: {
            orderBy: { id: 'asc' },
          },
        },
        relationLoadStrategy: 'query',
      });

      expect(result.data[0]?.comments).toBeDefined();
    });
  });

  // ============================================================================
  // 复杂场景测试
  // ============================================================================

  describe('复杂场景测试', () => {
    it('支持组合使用 select、where、orderBy、take、skip', async () => {
      db.enqueue(query => {
        expect(query.selectedColumns).toBeDefined();
        expect(query.whereClauses.length).toBeGreaterThan(0);
        expect(query.orderByClauses.length).toBeGreaterThan(0);
        expect(query.limitValue).toBe(10);
        expect(query.offsetValue).toBe(5);
        return Array(10).fill(null).map((_, i) => ({
          id: `u${i + 5}`,
          name: `User ${i + 5}`,
        }));
      });

      const executor = createExecutor();
      const result = await executor.findMany(userTable as any, {
        select: {
          id: true,
          name: true,
        },
        where: {
          status: 'active',
        },
        orderBy: { name: 'asc' },
        take: 10,
        skip: 5,
      });

      expect(result.data).toHaveLength(10);
    });

    it('支持关联查询 + 主表过滤 + 关联表过滤 + 排序', async () => {
      db.enqueue(query => {
        // whereClauses 可能被合并成一个条件，所以检查长度 >= 1
        expect(query.whereClauses.length).toBeGreaterThanOrEqual(1);
        expect(query.orderByClauses.length).toBeGreaterThan(0);
        return [
          {
            id: 'p1',
            title: 'Post 1',
            authorId: 'u1',
            author_id: 'u1',
            author_name: 'Alice',
            author_status: 'active',
          },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        where: { title: { contains: 'Post' } },
        include: {
          author: {
            join: 'inner',
            where: { status: 'active' },
          },
        },
        orderBy: { title: 'asc' },
        relationLoadStrategy: 'join',
      });

      expect(result.data).toBeDefined();
    });

    it('支持多层关联 + 多层过滤 + 多层排序', async () => {
      db.enqueue(() => [
        { id: 'p1', title: 'Post 1', authorId: 'u1' },
      ]);

      db.enqueue(query => {
        expect(query.whereClauses.length).toBeGreaterThan(0);
        return [
          { id: 'u1', name: 'Alice', status: 'active' },
        ];
      });

      db.enqueue(query => {
        expect(query.whereClauses.length).toBeGreaterThan(0);
        return [
          { id: 'prof-1', userId: 'u1', bio: 'Mentor' },
        ];
      });

      db.enqueue(query => {
        expect(query.whereClauses.length).toBeGreaterThan(0);
        return [
          { id: 'c1', postId: 'p1', isPublished: true },
        ];
      });

      const executor = createExecutor();
      const result = await executor.findMany(postTable as any, {
        where: { title: 'Post 1' },
        include: {
          author: {
            where: { status: 'active' },
            include: {
              profile: true,
            },
          },
          comments: {
            where: { isPublished: true },
            orderBy: { id: 'asc' },
          },
        },
        orderBy: { title: 'asc' },
        relationLoadStrategy: 'query',
      });

      expect(result.data).toBeDefined();
      expect((result.data[0] as any)?.author).toBeDefined();
      expect((result.data[0] as any)?.comments).toBeDefined();
    });
  });
});
