# 事务管理解决方案对比（精简版）

## 问题背景

### 当前问题

`BookSessionCommand` 中的事务**未真正生效**：

```typescript
// ❌ 当前实现（事务失效）
await this.db.transaction(async (tx) => {
  // 这些 Service 使用各自注入的独立 db 连接，不在事务中！
  await this.contractService.createServiceHold(...);  // 独立连接
  await this.sessionService.createSession(...);        // 独立连接
  await this.calendarService.createOccupiedSlot(...);  // 独立连接
});
```

### 核心原因

- `BookSessionCommand` 注入了自己的 `db` 实例
- 各个 Service 也注入了各自**独立的** `db` 实例
- `tx` 对象只在 Command 层有效，未传递给 Services

### 业务影响

| 场景 | 后果 |
|------|------|
| 会议创建失败 | `service_hold` 和 `session` 已插入，但会议未创建 |
| 并发预约 | 两个请求可能同时预约同一时段成功 |
| 财务损失 | 用户被扣款但未获得服务 |

---

## 方案对比

### 方案 1：传递事务对象 (tx)

#### 核心思路

在 Domain Service 方法中添加可选的 `tx?` 参数。

#### 示例代码

```typescript
// 1. 修改 Service
class SessionService {
  async createSession(
    dto: CreateSessionDto,
    tx?: NodePgDatabase  // ← 添加可选参数
  ): Promise<SessionEntity> {
    const db = tx || this.db;  // ← 优先使用 tx
    return db.insert(schema.sessions).values({...}).returning();
  }
}

// 2. Command 传递 tx
await this.db.transaction(async (tx) => {
  await this.contractService.createServiceHold(dto, tx);  // ← 传递 tx
  await this.sessionService.createSession(dto, tx);       // ← 传递 tx
  await this.calendarService.createOccupiedSlot(dto, tx); // ← 传递 tx
});
```

#### 优缺点

| 优点 ✅ | 缺点 ❌ |
|--------|--------|
| 实现简单，改动最小 | 违反单一职责（Service 关心事务） |
| 向后兼容（tx 可选） | 技术泄漏到 Domain Layer |
| 学习成本低 | 不符合 DDD 最佳实践 |
| 快速修复（2天） | 难以切换 ORM |
| 性能好 | 测试需要 Mock `tx` |

#### 适用场景

- ✅ 快速原型/MVP
- ✅ 紧急修复生产 Bug
- ✅ 小型项目（< 10万行代码）
- ✅ 团队不熟悉 DDD

#### 工作量

**1.5 - 2 个工作日**

---

### 方案 2：Repository + Unit of Work (REQUEST Scope)

#### 核心思路

使用 Repository 接口 + Unit of Work 模式 + NestJS REQUEST scope 管理事务。

#### 架构图

```
Application Layer (BookSessionCommand)
    ↓ 依赖
UnitOfWork.transaction(async (uow) => {
    sessionRepo = uow.getSessionRepository()
    calendarRepo = uow.getCalendarRepository()
    await sessionRepo.create(dto)  ← 自动参与事务
    await calendarRepo.create(dto) ← 自动参与事务
})
    ↓
Domain Layer (SessionService)
    依赖 ISessionRepository 接口 ← 纯业务逻辑
    ↓
Infrastructure Layer (SessionRepository)
    实现 ISessionRepository
    通过 TransactionContext (REQUEST scope) 获取事务连接
```

#### 核心代码

```typescript
// 1. Repository 接口（Domain Layer）
export interface ISessionRepository {
  create(dto: CreateSessionDto): Promise<SessionEntity>;  // ← 无需 tx 参数
}

// 2. TransactionContext（REQUEST scope）
@Injectable({ scope: Scope.REQUEST })
export class TransactionContext {
  private currentConnection: NodePgDatabase | null = null;

  setCurrentConnection(tx: NodePgDatabase): void {
    this.currentConnection = tx;
  }

  getCurrentConnection(): NodePgDatabase | null {
    return this.currentConnection;
  }
}

// 3. Repository 实现（Infrastructure Layer）
@Injectable()
export class SessionRepository implements ISessionRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private defaultDb: NodePgDatabase,
    @Inject(TRANSACTION_CONTEXT) private txContext: TransactionContext,
  ) {}

  private get db(): NodePgDatabase {
    return this.txContext.getCurrentConnection() || this.defaultDb;  // ← 自动选择
  }

  async create(dto: CreateSessionDto): Promise<SessionEntity> {
    return this.db.insert(schema.sessions).values({...}).returning();
  }
}

// 4. Unit of Work
@Injectable()
export class UnitOfWork {
  constructor(
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase,
    @Inject(TRANSACTION_CONTEXT) private txContext: TransactionContext,
    private moduleRef: ModuleRef,
  ) {}

  async transaction<T>(work: (uow: UnitOfWork) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      this.txContext.setCurrentConnection(tx);  // ← 设置事务上下文
      try {
        return await work(this);
      } finally {
        this.txContext.clearCurrentConnection();
      }
    });
  }

  getSessionRepository(): ISessionRepository {
    return this.moduleRef.get(SESSION_REPOSITORY);
  }
}

// 5. Domain Service（纯业务逻辑）
@Injectable()
export class SessionService {
  constructor(
    @Inject(SESSION_REPOSITORY) private sessionRepo: ISessionRepository,
  ) {}

  async createSession(dto: CreateSessionDto): Promise<SessionEntity> {
    // 业务规则验证
    this.validateSessionRules(dto);

    // 委托给 Repository（自动参与事务）
    return this.sessionRepo.create(dto);  // ← 无需 tx 参数
  }
}

// 6. Application Command
@Injectable()
export class BookSessionCommand {
  constructor(
    @Inject(UNIT_OF_WORK) private uow: IUnitOfWork,
    private meetingFactory: MeetingProviderFactory,
  ) {}

  async execute(input: BookSessionInput): Promise<BookSessionOutput> {
    return this.uow.transaction(async (uow) => {
      const sessionRepo = uow.getSessionRepository();
      const calendarRepo = uow.getCalendarRepository();

      // 所有操作自动参与事务
      const hold = await contractRepo.createServiceHold({...});
      const meeting = await this.meetingFactory.createMeeting({...});
      const session = await sessionRepo.create({...});
      const slot = await calendarRepo.createOccupiedSlot({...});

      return { session, hold, slot, meeting };
    });
  }
}
```

#### 优缺点

| 优点 ✅ | 缺点 ❌ |
|--------|--------|
| 完全符合 DDD 原则 | 实现复杂 |
| 关注点完美分离 | 代码量大（比方案1多3-4倍） |
| 依赖倒置（依赖抽象接口） | 学习成本高 |
| 可测试性极强（Mock 接口） | 重构成本高 |
| 技术无关性（易切换 ORM） | 不向后兼容 |
| 符合 SOLID 原则 | |
| NestJS 最佳实践 | |

#### 适用场景

- ✅ 长期维护项目（> 2年）
- ✅ 大型项目（> 10万行代码）
- ✅ 团队遵循 DDD
- ✅ 可能切换技术栈
- ✅ 需要多数据源（主从分离、读写分离）

#### 工作量

**5-7 个工作日**

---

### 方案 3：AsyncLocalStorage + TransactionContext

#### 核心思路

使用 Node.js 的 AsyncLocalStorage 在异步调用链中传播事务上下文。

#### 核心代码

```typescript
// 1. TransactionContext（使用 AsyncLocalStorage）
import { AsyncLocalStorage } from 'async_hooks';

export class TransactionContext {
  private static als = new AsyncLocalStorage<NodePgDatabase>();

  // 开启事务并自动传播
  static async runInTransaction<T>(
    db: NodePgDatabase,
    fn: () => Promise<T>,
  ): Promise<T> {
    return db.transaction(async (tx) => {
      return this.als.run(tx, fn);  // ← tx 自动传播到所有异步调用
    });
  }

  // 获取当前事务
  static getCurrentTx(): NodePgDatabase {
    const tx = this.als.getStore();
    if (!tx) throw new Error('No active transaction');
    return tx;
  }

  // 尝试获取（不抛异常）
  static tryGetCurrentTx(): NodePgDatabase | null {
    return this.als.getStore() || null;
  }
}

// 2. Domain Service（自动获取事务）
@Injectable()
export class SessionService {
  constructor(@Inject(DATABASE_CONNECTION) private db: NodePgDatabase) {}

  private get currentDb(): NodePgDatabase {
    return TransactionContext.tryGetCurrentTx() || this.db;  // ← 自动选择
  }

  async createSession(dto: CreateSessionDto): Promise<SessionEntity> {
    // 业务规则验证
    this.validateSessionRules(dto);

    // 使用 currentDb（自动支持事务）
    return this.currentDb.insert(schema.sessions).values({...}).returning();
  }
}

// 3. Application Command（极简！）
@Injectable()
export class BookSessionCommand {
  constructor(
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase,
    private contractService: ContractService,
    private sessionService: SessionService,
    private calendarService: CalendarService,
  ) {}

  async execute(input: BookSessionInput): Promise<BookSessionOutput> {
    // 使用 TransactionContext 开启事务
    return TransactionContext.runInTransaction(this.db, async () => {
      // 所有 Service 调用自动参与事务，无需传 tx！
      const hold = await this.contractService.createServiceHold({...});
      const meeting = await this.meetingFactory.createMeeting({...});
      const session = await this.sessionService.createSession({...});
      const slot = await this.calendarService.createOccupiedSlot({...});

      return { session, hold, slot, meeting };
    });
  }
}
```

#### 优缺点

| 优点 ✅ | 缺点 ❌ |
|--------|--------|
| 代码极简（无需传 tx） | 依赖 Node.js 14+ |
| 自动事务传播 | 隐式依赖（难以追踪） |
| 无需 NestJS REQUEST scope | 不符合 DDD（仍依赖具体技术） |
| 性能好 | 调试困难 |
| 易于理解 | AsyncLocalStorage 性能开销 |
| 向后兼容 | 团队可能不熟悉 ALS |

#### 适用场景

- ✅ 中型项目
- ✅ 不想引入 Repository 模式
- ✅ 团队熟悉 AsyncLocalStorage
- ⚠️ Node.js 版本 >= 14

#### 工作量

**2-3 个工作日**

---

## 完整对比表

| 特性 | 方案1: 传递 tx | 方案2: Repository + UoW | 方案3: AsyncLocalStorage |
|------|----------------|-------------------------|-------------------------|
| **实现复杂度** | ⭐ 简单 | ⭐⭐⭐⭐ 复杂 | ⭐⭐ 中等 |
| **代码量** | ⭐ 少 | ⭐⭐⭐⭐ 多 | ⭐⭐ 中等 |
| **符合 DDD** | ❌ 不符合 | ✅ 完全符合 | ⚠️ 部分符合 |
| **关注点分离** | ❌ 技术泄漏 | ✅ 完美分离 | ⚠️ 部分分离 |
| **依赖方向** | ❌ 依赖具体技术 | ✅ 依赖抽象接口 | ❌ 依赖具体技术 |
| **可测试性** | ⚠️ 需 Mock tx | ✅ Mock 接口 | ⚠️ 需 Mock ALS |
| **易切换 ORM** | ❌ 困难 | ✅ 容易 | ❌ 困难 |
| **向后兼容** | ✅ 完全兼容 | ❌ 需重构 | ✅ 完全兼容 |
| **学习成本** | ⭐ 低 | ⭐⭐⭐⭐ 高 | ⭐⭐ 中等 |
| **工作量** | 1.5-2 天 | 5-7 天 | 2-3 天 |
| **性能** | ✅ 优秀 | ✅ 优秀 | ⚠️ ALS 有小开销 |
| **调试难度** | ⭐ 简单 | ⭐⭐ 中等 | ⭐⭐⭐ 较难 |
| **适合项目** | 小型/短期 | 大型/长期 | 中型 |

---

## 选择建议

### 立即修复（紧急 Bug）→ 方案 1

```typescript
// 理由：
// - 2天内完成
// - 风险最低
// - 立即生效
```

### 长期项目（追求质量）→ 方案 2

```typescript
// 理由：
// - 符合 DDD 最佳实践
// - 易于维护和扩展
// - 可测试性最强
// - 技术无关性
```

### 中型项目（平衡）→ 方案 3

```typescript
// 理由：
// - 代码简洁
// - 自动事务传播
// - 性能好
// - 但不符合严格 DDD
```

---

## 推荐方案：分阶段实施

### 第一阶段（立即）：方案 1
- 快速修复生产 Bug（2天）
- 确保事务正常工作
- 通过测试验证

### 第二阶段（规划中）：方案 2
- 逐步重构到 Repository + UoW（5-7天）
- 提升代码质量和可维护性
- 符合 DDD 最佳实践

### 迁移路径

```typescript
// Week 1: 方案1修复
- SessionService.createSession(dto, tx?)
- 生产环境稳定

// Week 2-3: 方案2重构（迭代1）
- 创建 Repository 接口
- 实现 TransactionContext + UoW
- SessionRepository 实现

// Week 4: 方案2重构（迭代2）
- CalendarRepository 实现
- ContractRepository 实现
- 更新 Commands

// Week 5: 清理
- 移除方案1代码
- 完善测试
- 文档更新
```

---

## 关键要点总结

### 1. 为什么当前事务失效？

**每个 Service 有独立的 `db` 实例，事务对象未共享。**

### 2. 为什么推荐方案2（长期）？

**符合 DDD、SOLID，易测试、易扩展、技术无关。**

### 3. 为什么先用方案1？

**快速修复生产 Bug，避免业务损失，再逐步重构。**

### 4. AsyncLocalStorage 的局限？

**隐式依赖、调试困难、不符合 DDD，但代码简洁。**

### 5. Repository 模式的价值？

**依赖倒置、关注点分离、易切换技术栈、极强可测试性。**

---

## 最终建议

**对于你的项目（MentorX），建议：**

1. **立即采用方案1**（本周完成）
   - 修复事务 Bug
   - 确保生产稳定

2. **规划方案2迁移**（下月开始）
   - 长期维护的企业级项目
   - 团队有 DDD 实践
   - 值得投入 5-7 天重构

3. **如果资源有限**
   - 方案1 + 完善测试即可
   - 等项目成熟后再考虑方案2

**核心原则：先保证正确性，再追求优雅性。**
