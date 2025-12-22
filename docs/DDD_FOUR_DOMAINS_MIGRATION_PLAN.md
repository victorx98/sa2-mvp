# 四大领域 DDD 重构迁移方案

> 本文档详细说明 `catalog`、`contract`、`financial`、`placement` 四个领域的 DDD 重构迁移计划。
>
> **目标读者**：开发团队、架构师
>
> **参考文档**：`/docs/DDD_CATALOG_DOMAIN_REFACTORING_DESIGN.md`

---

## 一、总体迁移策略

### 1.1 迁移顺序（按依赖关系）

```
第一层：catalog（无依赖）
    ↓ 被 contract 依赖
第二层：contract（依赖 catalog）
    ↓ 被 placement 依赖
第三层：placement（依赖 catalog、contract）
    ↓ 被所有域依赖
第四层：financial（依赖 contract、placement）
```

**迁移顺序**：
1. **Phase 1**: catalog 域（3-4 天）- Product & ServiceType
2. **Phase 2**: contract 域（5-6 天）- Contract & ServiceLedger
3. **Phase 3**: placement 域（4-5 天）- JobPosition & JobApplication
4. **Phase 4**: financial 域（6-7 天）- 财务结算相关
5. **Phase 5**: integration（2-3 天）- 集成测试和清理

**总计**：3-4 周

### 1.2 通用迁移规则

#### ✅ 每个域遵循相同模式

```
src/domains/{domain}/
├── {aggregate}/                    # 聚合根
│   ├── entities/                   # 领域实体（核心）
│   │   ├── {aggregate}.entity.ts   # 聚合根实体
│   │   └── *.entity.ts             # 子实体
│   │
│   ├── value-objects/              # 值对象
│   │   ├── {value}.vo.ts          # 值对象
│   │   └── index.ts
│   │
│   ├── repositories/               # 仓储接口
│   │   ├── {aggregate}.repository.interface.ts
│   │   ├── {aggregate}-search.criteria.ts
│   │   └── index.ts
│   │
│   ├── services/                   # 领域服务
│   │   └── *.service.ts            # 跨实体业务逻辑
│   │
│   ├── exceptions/                 # 领域异常
│   │   └── *.exception.ts
│   │
│   ├── event-handlers/            # 事件处理器
│   │   └── *.handler.ts
│   │
│   └── infrastructure/             # 基础设施（唯一嵌套）
│       ├── mappers/                # 数据映射器
│       │   └── *.mapper.ts
│       │
│       └── repositories/           # 仓储实现
│           └── drizzle-*.repository.ts
│
└── index.ts                        # 统一导出
```

#### ✅ 每个聚合的迁移步骤

1. **Domain 层**：
   - Step 1: Entity（从接口或 schema 转换）
   - Step 2: Value Object（识别需要封装的字段）
   - Step 3: Repository 接口（从现有 Service 提取方法签名）
   - Step 4: Domain Service（识别跨实体逻辑）
   - Step 5: Exceptions（定义业务异常）

2. **Infrastructure 层**：
   - Step 6: Mapper（双向映射）
   - Step 7: Repository 实现（实现接口）

3. **Application 层**：
   - Step 8: Command/Query Handler（替换 Service 调用）

4. **清理**：
   - Step 9: 更新 Module 配置
   - Step 10: 删除旧 Service
   - Step 11: 运行测试

---

## 二、Catalog 域迁移方案

### 2.1 现状分析

**聚合根**：2 个
- **Product**（产品）：主要聚合根
  - 复杂度：中
  - 核心字段：id, name, code, price, status, items[]
  - 业务规则：状态机、发布/下架、item 管理

- **ServiceType**（服务类型）：简单聚合
  - 复杂度：低
  - 核心字段：id, name, code, category
  - 业务规则：简单 CRUD

**依赖关系**：无（独立域）

**预计工作量**：3-4 天

### 2.2 Product 聚合迁移计划

#### **Day 1**: Domain 层核心

**上午**：Entity & Value Objects
```bash
# 创建目录结构
mkdir -p src/domains/catalog/product/{entities,value-objects,repositories,services,exceptions,event-handlers,infrastructure/{mappers,repositories}}

# 实现实体（3-4 小时）
# 文件：product.entity.ts, product-item.entity.ts
# 内容：
# - 私有字段 + 公有 getter
# - 工厂方法：createDraft()
# - 业务方法：publish(), unpublish(), addItem(), removeItem(), update()
# - 封装业务规则（状态检查、item 数量检查）
```

**下午**：Value Objects
```bash
# 文件：price.vo.ts, product-code.vo.ts, product-status.vo.ts
# 内容：
# - Price: 金额验证、格式化、币种
# - ProductCode: 格式验证（正则表达式）
# - ProductStatus: 状态机（DRAFT → ACTIVE → INACTIVE）

# 实现仓储接口（1-2 小时）
# 文件：product.repository.interface.ts
# 方法：
# - findById, findByCode, existsByCode
# - save, update
# - search(criteria: ProductSearchCriteria)
# - withTransaction
```

#### **Day 2**: Infrastructure 层

**上午**：Mapper
```bash
# 文件：product.mapper.ts
# 实现：
# - toDomain(record, items): Product
# - toPersistence(product): { product, items }
# - 注意：处理嵌套的 ProductItem
```

**下午**：Repository 实现
```bash
# 文件：drizzle-product.repository.ts
# 实现：
# - 使用 Drizzle ORM 查询
# - 事务管理（withTransaction）
# - 批量查询优化（避免 N+1）
```

#### **Day 3**: Application 层 & 测试

**上午**：Command Handlers
```bash
# 迁移 Command（从 Service 提取）：
# 1. CreateProductCommand
# 2. PublishProductCommand
# 3. AddProductItemCommand
# 4. UpdateProductCommand
```

**下午**：Query Handlers & 集成
```bash
# 迁移 Query：
# 1. GetProductQuery
# 2. SearchProductsQuery

# 更新 Module 配置
# 运行测试和调试
```

#### **Day 4**: ServiceType & 清理

**上午**：ServiceType 聚合
```bash
# ServiceType 相对简单，1 天完成：
# - Entity（2 小时）
# - Repository 接口 + 实现（2 小时）
# - Command/Query Handler（2 小时）
```

**下午**：集成测试
```bash
# 端到端测试：
# - 创建产品流程
# - 发布产品流程
# - 查询产品流程

# 删除旧 Service
```

### 2.3 Catalog 域决策清单

| 决策项 | 选择 | 说明 |
|--------|------|------|
| **值对象** | Price, ProductCode, ProductStatus | 封装验证和格式化规则 |
| **领域服务** | ProductLifecycleService | 批量操作和复杂策略 |
| **异常类型** | ProductNotDraft, ProductMinItems, InvalidCode | 继承 DomainException |
| **迁移粒度** | 一次性迁移 | 2-3 天完成所有 Command |

### 2.4 关键实现细节

#### **Product 状态机**
```typescript
// value-objects/product-status.vo.ts
class ProductStatus {
  static DRAFT = new ProductStatus('DRAFT');
  static ACTIVE = new ProductStatus('ACTIVE');
  static INACTIVE = new ProductStatus('INACTIVE');

  private constructor(private readonly value: string) {}

  transitionToActive(): ProductStatus {
    if (this !== ProductStatus.DRAFT) {
      throw new InvalidStatusTransitionException(this.value, 'ACTIVE');
    }
    return ProductStatus.ACTIVE;
  }

  isDraft(): boolean { return this === ProductStatus.DRAFT; }
  isActive(): boolean { return this === ProductStatus.ACTIVE; }
}
```

#### **事务管理**
```typescript
// 在 Command Handler 中
async execute(command: PublishProductCommand): Promise<Product> {
  return await this.productRepository.withTransaction(async (txRepo) => {
    const product = await txRepo.findById(command.id);
    product.publish();  // 业务规则
    return await txRepo.update(product);
  });
}
```

---

## 三、Contract 域迁移方案

### 3.1 现状分析

**聚合根**：3 个（复杂域）
- **Contract**（合约）：核心聚合根
  - 复杂度：高（生命周期复杂）
  - 状态：DRAFT → PENDING → ACTIVE → EXPIRED/SUSPENDED
  - 字段：学生、产品、额度、快照、状态历史

- **ServiceLedger**（服务账本）：复杂聚合
  - 复杂度：高（涉及服务消费）
  - 功能：记录服务余额、消费历史
  - 规则：余额检查、消费验证、归档

- **ServiceHold**（服务预占）：中等聚合
  - 复杂度：中（资源预留）
  - 功能：预约时预占服务额度
  - 规则：过期释放、超时处理

**依赖关系**：依赖 catalog（引用 Product）

**关键特性**：
- 服务消耗跟踪系统（带归档）
- 服务预占机制（最终一致性）
- 合约状态历史跟踪
- 产品快照（反腐败层）

**预计工作量**：5-6 天

### 3.2 Contract 聚合迁移计划

#### **Day 1**: Contract 实体 & 值对象

**实体识别**：
```typescript
// Contract Aggregate Root
class Contract {
  private constructor(
    private _id: string,
    private _studentId: string,
    private _productSnapshot: ProductSnapshot,  // 值对象
    private _status: ContractStatus,            // 值对象（状态机）
    private _serviceQuantities: ServiceQuantity[],  // 值对象
    private _createdAt: Date,
    private _createdBy: string,
    // ...
  ) {}

  // 业务方法
  sign(signedBy: string): void  // DRAFT → PENDING
  activate(): void              // PENDING → ACTIVE
  suspend(reason: string): void // ACTIVE → SUSPENDED
  expire(): void                // ACTIVE → EXPIRED
}
```

**值对象**：
- `ContractStatus`：状态机（DRAFT → PENDING → ACTIVE → SUSPENDED/EXPIRED）
- `ProductSnapshot`：产品快照（反腐败层，存储 JSON）
- `ServiceQuantity`：服务额度（服务类型 + 数量）
- `Money`：金额（金额 + 币种）

#### **Day 2-3**: ServiceLedger & ServiceHold

**ServiceLedger**（重点）：
```typescript
// entities/service-ledger.entity.ts
class ServiceLedger {
  private constructor(
    private _id: string,
    private _contractId: string,
    private _studentId: string,
    private _serviceType: ServiceTypeCode,  // 值对象
    private _totalQuantity: number,
    private _consumedQuantity: number,
    private _heldQuantity: number,
    private _archivedEntries: LedgerArchive[],  // 归档条目
  ) {}

  // 核心业务方法
  consume(quantity: number): void {
    if (!this.hasSufficientBalance(quantity)) {
      throw new InsufficientServiceBalanceException(
        this._serviceType.getValue(),
        this.getAvailableQuantity(),
        quantity
      );
    }
    this._consumedQuantity += quantity;
  }

  hold(quantity: number): void { /* 预占 */ }
  releaseHold(quantity: number): void { /* 释放预占 */ }

  private archiveIfNeeded(): void {
    // 当条目过多时归档到 archive 表
  }
}

// value-objects/service-type-code.vo.ts
class ServiceTypeCode {
  static ONE_ON_ONE = new ServiceTypeCode('ONE_ON_ONE');
  static MOCK_INTERVIEW = new ServiceTypeCode('MOCK_INTERVIEW');
  // ...

  private constructor(private readonly value: string) {}
  getValue(): string { return this.value; }
}
```

**ServiceHold**（资源预留）：
```typescript
// entities/service-hold.entity.ts
class ServiceHold {
  private constructor(
    private _id: string,
    private _contractId: string,
    private _studentId: string,
    private _serviceType: ServiceTypeCode,
    private _quantity: number,
    private _expiresAt: Date,
    private _relatedBookingId: string,
  ) {}

  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  release(): void {
    // 发布事件：ServiceHoldReleased
  }
}

// event-handlers/service-hold-expired.handler.ts
@OnEvent('service-hold.expired')
class ServiceHoldExpiredHandler {
  async handle(event: ServiceHoldExpiredEvent) {
    // 1. 释放预占的额度
    // 2. 更新 ServiceLedger
    // 3. 日志记录
  }
}
```

#### **Day 4**: Repository 层

**挑战**：查询复杂
```typescript
// repositories/contract.repository.interface.ts
interface IContractRepository {
  // 基本操作
  findById(id: string): Promise<Contract | null>;
  findByStudentId(studentId: string): Promise<Contract[]>;
  save(contract: Contract): Promise<Contract>;

  // 复杂查询
  search(criteria: ContractSearchCriteria): Promise<ContractSearchResult>;

  // 服务额度相关
  getServiceBalance(
    studentId: string,
    serviceType?: string
  ): Promise<ServiceBalance[]>;

  // 事务支持
  withTransaction<T>(fn: (repo: IContractRepository) => Promise<T>): Promise<T>;
}

// repositories/contract-search.criteria.ts
interface ContractSearchCriteria {
  studentId?: string;
  status?: ContractStatus;
  productId?: string;
  signedAfter?: Date;
  signedBefore?: Date;
  expiresAfter?: Date;
  expiresBefore?: Date;
  page?: number;
  pageSize?: number;
}
```

#### **Day 5**: Application 层

**Command 迁移**：
```typescript
// commands/create-contract/
class CreateContractHandler {
  async execute(command: CreateContractCommand): Promise<Contract> {
    return await this.contractRepository.withTransaction(async (txRepo) => {
      // 1. 验证产品是否存在（调用 Catalog 领域）
      const product = await this.productRepository.findById(command.productId);

      // 2. 创建合约快照（反腐败层）
      const snapshot = ProductSnapshot.fromProduct(product);

      // 3. 创建合约
      const contract = Contract.create(
        uuid(),
        command.studentId,
        snapshot,
        command.createdBy
      );

      // 4. 创建服务账本
      const ledgerEntries = this.createLedgerEntries(contract, product);

      // 5. 保存所有
      await txRepo.save(contract);
      await txRepo.saveAllLedgers(ledgerEntries);

      // 6. 发布事件
      this.eventEmitter.emit('contract.created', new ContractCreatedEvent(contract.getId()));

      return contract;
    });
  }
}

// commands/consume-service/
class ConsumeServiceHandler {
  async execute(command: ConsumeServiceCommand): Promise<void> {
    return await this.contractRepository.withTransaction(async (txRepo) => {
      // 1. 查询账本
      const ledger = await txRepo.findLedger(
        command.contractId,
        command.serviceType
      );

      // 2. 消费额度（业务规则）
      ledger.consume(command.quantity);  // 内部检查余额

      // 3. 更新账本
      await txRepo.updateLedger(ledger);

      // 4. 创建消费记录
      const record = ServiceConsumptionRecord.create(
        ledger.getId(),
        command.quantity,
        command.relatedBookingId
      );
      await txRepo.saveConsumptionRecord(record);

      // 5. 发布事件（用于后续操作：通知、日志等）
      this.eventEmitter.emit(
        'service.consumed',
        new ServiceConsumedEvent(/* ... */)
      );
    });
  }
}
```

#### **Day 6**: 集成 & 测试

**测试重点**：
```typescript
// 单元测试：领域逻辑
it('应该拒绝超额消费', () => {
  const ledger = ServiceLedger.create(/* 总数量: 10, 已消费: 8 */);
  expect(() => ledger.consume(3)).toThrow(InsufficientBalanceException);
});

// 集成测试：跨聚合操作
it('创建合约时应创建对应的服务账本', async () => {
  // 1. 创建合约（包含服务额度）
  const contract = await handler.execute(createCommand);

  // 2. 验证账本创建
  const ledgers = await repository.findLedgersByContract(contract.getId());
  expect(ledgers).toHaveLength(2);  // ONE_ON_ONE 和 MOCK_INTERVIEW

  // 3. 验证额度正确
  expect(ledgers[0].getTotalQuantity()).toBe(10);
});

// 集成测试：服务预占和释放
it('预约时应预占服务额度，取消时应释放', async () => {
  // 1. 预约（创建 ServiceHold）
  await bookSessionHandler.execute(bookCommand);

  // 2. 验证额度被预占
  const balance = await repository.getServiceBalance(studentId);
  expect(balance.available).toBe(7);  // 10 - 3（预占）

  // 3. 取消预约
  await cancelSessionHandler.execute(cancelCommand);

  // 4. 验证额度释放
  const newBalance = await repository.getServiceBalance(studentId);
  expect(newBalance.available).toBe(10);
});
```

### 3.3 Contract 域决策清单

| 决策项 | 选择 | 说明 |
|--------|------|------|
| **值对象** | ContractStatus, ServiceTypeCode, Money, ProductSnapshot | 状态机、类型安全、反腐败 |
| **领域服务** | ContractLifecycleService, ServiceValidationService | 生命周期管理、额度验证 |
| **异常类型** | InsufficientBalance, InvalidStatus, ContractExpired | 额度不足、状态错误、合约过期 |
| **事件** | ContractCreated, ServiceConsumed, ServiceHoldReleased | 最终一致性、跨域通信 |
| **Repository 模式** | 自定义查询方法 | getServiceBalance, findLedger 等 |

### 3.4 关键业务规则

#### **服务额度计算**
```typescript
// ServiceLedger 核心逻辑
getAvailableQuantity(): number {
  return this._totalQuantity - this._consumedQuantity - this._heldQuantity;
}

hasSufficientBalance(required: number): boolean {
  return this.getAvailableQuantity() >= required;
}
```

#### **合约状态机**
```
DRAFT → PENDING（提交）
PENDING → ACTIVE（审批通过）
ACTIVE → SUSPENDED（暂停）
ACTIVE → EXPIRED（过期）
SUSPENDED → ACTIVE（恢复）
```

---

## 四、Placement 域迁移方案

### 4.1 现状分析

**聚合根**：2 个
- **JobPosition**（岗位）：中等复杂度
  - 字段：公司、职位、地点、薪资、要求、JD
  - 功能：发布、下架、更新

- **JobApplication**（投递）：高复杂度
  - 字段：学生、岗位、简历、状态、类型
  - 状态：DRAFT → SUBMITTED → REVIEWING → INTERVIEWING → OFFERED → REJECTED/WITHDRAWN
  - 特殊：内推（Referral）流程

**依赖关系**：
- 依赖 catalog（引用 JobPosition、Resume）
- 依赖 contract（验证学生服务余额）

**关键特性**：
- 投递状态机（复杂）
- 内推流程（批量推荐）
- 状态历史追踪
- 简历快照（反腐败层）

**预计工作量**：4-5 天

### 4.2 JobApplication 聚合迁移计划

#### **Day 1**: 实体 & 值对象

**状态机设计**：
```typescript
// value-objects/application-status.vo.ts
class ApplicationStatus {
  static DRAFT = new ApplicationStatus('DRAFT');
  static SUBMITTED = new ApplicationStatus('SUBMITTED');
  static REVIEWING = new ApplicationStatus('REVIEWING');
  static INTERVIEWING = new ApplicationStatus('INTERVIEWING');
  static OFFERED = new ApplicationStatus('OFFERED');
  static REJECTED = new ApplicationStatus('REJECTED');
  static WITHDRAWN = new ApplicationStatus('WITHDRAWN');

  private constructor(private readonly value: string) {}

  // 定义有效转换
  canTransitionTo(next: ApplicationStatus): boolean {
    const validTransitions = {
      DRAFT: ['SUBMITTED'],
      SUBMITTED: ['REVIEWING', 'REJECTED'],
      REVIEWING: ['INTERVIEWING', 'REJECTED'],
      INTERVIEWING: ['OFFERED', 'REJECTED'],
      // ...
    };
    return validTransitions[this.value]?.includes(next.value) ?? false;
  }

  transitionTo(next: ApplicationStatus): ApplicationStatus {
    if (!this.canTransitionTo(next)) {
      throw new InvalidStatusTransitionException(this.value, next.value);
    }
    return next;
  }
}

// value-objects/application-type.vo.ts
class ApplicationType {
  static STANDARD = new ApplicationType('STANDARD');      // 普通投递
  static REFERRAL = new ApplicationType('REFERRAL');      // 内推

  private constructor(private readonly value: string) {}
  isReferral(): boolean { return this === ApplicationType.REFERRAL; }
}
```

**实体设计**：
```typescript
// entities/job-application.entity.ts
class JobApplication {
  private constructor(
    private _id: string,
    private _studentId: string,
    private _jobPositionId: string,
    private _status: ApplicationStatus,
    private _type: ApplicationType,
    private _resumeSnapshot: ResumeSnapshot,  // 值对象（反腐败）
    private _statusHistory: StatusHistory[],  // 状态历史
    private _createdAt: Date,
    private _submittedAt?: Date,
  ) {}

  // 业务方法
  submit(): void {
    if (!this._status.equals(ApplicationStatus.DRAFT)) {
      throw new OnlyDraftCanBeSubmittedException();
    }
    this._status = this._status.transitionTo(ApplicationStatus.SUBMITTED);
    this._submittedAt = new Date();
    this.addStatusHistory(ApplicationStatus.SUBMITTED);
  }

  updateStatus(newStatus: ApplicationStatus, operator: string): void {
    this._status = this._status.transitionTo(newStatus);
    this.addStatusHistory(newStatus, operator);
  }

  private addStatusHistory(status: ApplicationStatus, operator?: string): void {
    this._statusHistory.push(
      StatusHistory.create(status, new Date(), operator)
    );
  }
}

// value-objects/resume-snapshot.vo.ts
class ResumeSnapshot {
  private constructor(
    private readonly resumeId: string,
    private readonly version: number,
    private readonly data: Record<string, any>,  // 快照数据
  ) {}

  static fromResume(resume: Resume): ResumeSnapshot {
    return new ResumeSnapshot(
      resume.id,
      resume.version,
      {
        title: resume.title,
        summary: resume.summary,
        experience: resume.experience,
        education: resume.education,
        // ... 其他字段
      }
    );
  }
}
```

#### **Day 2**: 领域服务 & 仓储

**领域服务**：
```typescript
// services/application-validation.service.ts
class ApplicationValidationService {
  // 验证学生是否有足够的服务余额（内推消耗额度）
  async validateBalance(
    studentId: string,
    applicationType: ApplicationType
  ): Promise<boolean> {
    if (applicationType.isReferral()) {
      return await this.serviceLedgerRepository.hasSufficientBalance(
        studentId,
        'REFERRAL',
        1
      );
    }
    return true;  // 普通投递不消耗额度
  }

  // 验证是否可以更新状态
  canUpdateStatus(
    currentStatus: ApplicationStatus,
    newStatus: ApplicationStatus
  ): boolean {
    return currentStatus.canTransitionTo(newStatus);
  }
}

// services/referral-batch.service.ts
class ReferralBatchService {
  // 批量内推推荐（All-or-Nothing）
  async batchRecommend(
    counselorId: string,
    jobId: string,
    studentIds: string[]
  ): Promise<JobApplication[]> {
    // 1. 验证岗位存在（调用 JobPositionRepository）
    const job = await this.jobPositionRepository.findById(jobId);

    // 2. 批量验证学生（调用 StudentRepository）
    const students = await this.studentRepository.findByIds(studentIds);

    // 3. 验证所有学生有足够的内推额度
    for (const student of students) {
      const hasBalance = await this.validateBalance(
        student.id,
        ApplicationType.REFERRAL
      );
      if (!hasBalance) {
        throw new InsufficientReferralBalanceException(student.id);
      }
    }

    // 4. 创建所有投递（All-or-Nothing）
    const applications = studentIds.map(studentId =>
      JobApplication.createReferral(
        uuid(),
        studentId,
        jobId,
        counselorId
      )
    );

    // 5. 预占额度（创建 ServiceHold）
    const holds = applications.map(app =>
      ServiceHold.create(
        uuid(),
        app.getContractId(),
        app.getStudentId(),
        'REFERRAL',
        1,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)  // 7 天过期
      )
    );

    // 6. 保存所有（事务）
    await this.jobApplicationRepository.saveAll(applications);
    await this.serviceHoldRepository.saveAll(holds);

    // 7. 发布事件
    for (const app of applications) {
      this.eventEmitter.emit(
        'job-application.referral-created',
        new ReferralCreatedEvent(app.getId())
      );
    }

    return applications;
  }
}
```

**Repository 接口**：
```typescript
// repositories/job-application.repository.interface.ts
interface IJobApplicationRepository {
  // 基本操作
  findById(id: string): Promise<JobApplication | null>;
  findByStudentId(studentId: string): Promise<JobApplication[]>;
  save(application: JobApplication): Promise<JobApplication>;
  saveAll(applications: JobApplication[]): Promise<void>;

  // 复杂查询
  search(criteria: JobApplicationSearchCriteria): Promise<JobApplicationSearchResult>;

  // 统计
  countByStatus(studentId: string, status: ApplicationStatus): Promise<number>;
  getApplicationStats(studentId: string): Promise<ApplicationStats>;
}
```

#### **Day 3-4**: Application 层 & 跨域编排

**Command 实现**：
```typescript
// commands/submit-application/
class SubmitApplicationHandler {
  async execute(command: SubmitApplicationCommand): Promise<JobApplication> {
    return await this.jobApplicationRepository.withTransaction(async (txRepo) => {
      // 1. 验证岗位存在（调用 JobPositionRepository）
      const jobPosition = await this.jobPositionRepository.findById(command.jobId);

      // 2. 获取并验证简历（调用 ResumeRepository）
      const resume = await this.resumeRepository.findById(command.resumeId);

      // 3. 创建简历快照（反腐败层）
      const snapshot = ResumeSnapshot.fromResume(resume);

      // 4. 验证服务余额（如果内推）
      if (command.type.isReferral()) {
        const hasBalance = await this.ledgerRepository.hasSufficientBalance(
          command.studentId,
          'REFERRAL',
          1
        );
        if (!hasBalance) {
          throw new InsufficientReferralBalanceException(command.studentId);
        }
      }

      // 5. 创建投递
      const application = JobApplication.create(
        uuid(),
        command.studentId,
        command.jobId,
        snapshot,
        command.type
      );

      // 6. 预占额度（如果内推）
      if (command.type.isReferral()) {
        const hold = ServiceHold.create(
          uuid(),
          command.contractId,  // 学生合约
          command.studentId,
          'REFERRAL',
          1,
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        );
        await this.serviceHoldRepository.save(hold);
      }

      // 7. 提交（改变状态）
      application.submit();  // DRAFT → SUBMITTED

      // 8. 保存
      await txRepo.save(application);

      // 9. 发布事件
      this.eventEmitter.emit(
        'job-application.submitted',
        new JobApplicationSubmittedEvent(application.getId())
      );

      return application;
    });
  }
}

// commands/batch-referral-recommend/
class BatchReferralRecommendHandler {
  async execute(command: BatchReferralRecommendCommand): Promise<JobApplication[]> {
    // 调用 ReferralBatchService（领域服务）
    // 所有验证逻辑在领域服务中
    return await this.referralBatchService.batchRecommend(
      command.counselorId,
      command.jobId,
      command.studentIds
    );
  }
}
```

**跨域交互**：
```typescript
// Placement 域 → Catalog 域：
// 1. ProductRepository.findById() - 验证产品（内推时使用）

// Placement 域 → Contract 域：
// 1. ServiceLedgerRepository.hasSufficientBalance() - 验证额度
// 2. ServiceHoldRepository.save() - 创建预占

// 防腐层设计：
// - 使用 String UUID 引用（不直接依赖实体）
// - 使用快照（Snapshot）模式存储外部数据
```

#### **Day 5**: 集成测试

**测试场景**：
```typescript
// 场景 1：普通投递流程
it('学生提交普通投递申请', async () => {
  // 1. 创建草稿申请
  const draft = JobApplication.createDraft(/* ... */);

  // 2. 提交申请
  const command = new SubmitApplicationCommand({
    applicationId: draft.getId(),
    resumeId: 'resume-123'
  });
  const submitted = await handler.execute(command);

  // 3. 验证状态
  expect(submitted.getStatus()).toBe(ApplicationStatus.SUBMITTED);
  expect(submitted.getSubmittedAt()).toBeDefined();

  // 4. 验证不消耗额度（普通投递）
  const balance = await ledgerRepository.getBalance(studentId, 'REFERRAL');
  expect(balance.available).toBe(10);  // 不变
});

// 场景 2：内推投递流程
it('学生提交内推申请，消耗额度', async () => {
  // 1. 提交内推申请
  const command = new SubmitApplicationCommand({
    studentId,
    jobId: 'job-456',
    type: ApplicationType.REFERRAL,
    contractId: 'contract-789'
  });
  await handler.execute(command);

  // 2. 验证额度被预占
  const balance = await ledgerRepository.getBalance(studentId, 'REFERRAL');
  expect(balance.available).toBe(9);  // 10 - 1

  // 3. 验证创建 ServiceHold
  const holds = await holdRepository.findByStudentId(studentId);
  expect(holds).toHaveLength(1);
  expect(holds[0].getServiceType()).toBe('REFERRAL');
});

// 场景 3：批量内推（All-or-Nothing）
it('顾问批量推荐内推，任一失败整体回滚', async () => {
  // 1. 准备数据（其中一个学生余额不足）
  const studentIds = ['student-1', 'student-2', 'student-3'];  // student-3 余额不足

  // 2. 执行批量推荐
  const command = new BatchReferralRecommendCommand({
    counselorId: 'counselor-123',
    jobId: 'job-456',
    studentIds
  });

  // 3. 期望异常（All-or-Nothing）
  await expect(handler.execute(command))
    .rejects.toThrow(InsufficientReferralBalanceException);

  // 4. 验证没有任何申请被创建（事务回滚）
  const applications = await applicationRepository.findByJobId('job-456');
  expect(applications).toHaveLength(0);
});

// 场景 4：状态转换验证
it('只允许有效的状态转换', async () => {
  const app = await applicationRepository.findById('app-123');

  // DRAFT → SUBMITTED 允许
  expect(() => app.updateStatus(ApplicationStatus.SUBMITTED))
    .not.toThrow();

  // DRAFT → INTERVIEWING 不允许
  expect(() => app.updateStatus(ApplicationStatus.INTERVIEWING))
    .toThrow(InvalidStatusTransitionException);
});
```

### 4.3 Placement 域决策清单

| 决策项 | 选择 | 说明 |
|--------|------|------|
| **值对象** | ApplicationStatus, ApplicationType, ResumeSnapshot | 状态机、类型安全、反腐败 |
| **领域服务** | ApplicationValidationService, ReferralBatchService | 验证逻辑、批量操作 |
| **异常类型** | InvalidStatusTransition, InsufficientBalance | 状态错误、额度不足 |
| **防腐层** | ResumeSnapshot, ProductSnapshot | 存储外部数据快照 |
| **跨域交互** | 依赖 catalog、contract | 通过 Repository 接口 |

### 4.4 关键业务规则

#### **状态转换矩阵**
```
                → SUBMITTED → REVIEWING → INTERVIEWING → OFFERED
              ↓           ↓           ↓           ↓           ↓
DRAFT         ✓          ✗           ✗           ✗           ✗
SUBMITTED     ✗          ✓           ✓           ✗           ✗
REVIEWING     ✗          ✗           ✓           ✓           ✗
INTERVIEWING  ✗          ✗           ✗           ✓           ✓
OFFERED       ✗          ✗           ✗           ✗           ✓
REJECTED      ✗          ✗           ✗           ✗           ✗
WITHDRAWN     ✗          ✗           ✗           ✗           ✗
```

#### **All-or-Nothing 批量操作**
```typescript
async batchRecommend(studentIds: string[]): Promise<JobApplication[]> {
  return await this.repository.withTransaction(async (txRepo) => {
    // 1. 验证所有（任一失败则回滚）
    for (const studentId of studentIds) {
      await this.validate(studentId);  // 失败抛出异常 → 回滚
    }

    // 2. 创建所有
    const applications = studentIds.map(id => this.createApplication(id));

    // 3. 保存所有（事务保证一致性）
    await txRepo.saveAll(applications);

    return applications;
  });
}
```

#### **内推额度消耗**
```typescript
// 内推类型消耗 REFERRAL 额度
if (applicationType.isReferral()) {
  await ledger.consumeService('REFERRAL', 1);  // 消耗 1 个内推额度
}

// 普通投递不消耗额度
if (applicationType.isStandard()) {
  // 不消耗额度
}
```

---

## 五、Financial 域迁移方案

### 5.1 现状分析

**聚合根**：5 个（中高复杂度）
- **MentorAppeal**（导师申诉）：中等复杂度
- **MentorPayable**（导师应付款）：高复杂度（计算逻辑）
- **MentorPaymentInfo**（导师支付信息）：中等复杂度
- **MentorPrice**（导师定价）：中等复杂度
- **Settlement**（结算）：高复杂度（批量处理）

**依赖关系**：
- 依赖 contract（查询服务消费记录）
- 依赖 placement（查询投递状态）

**关键特性**：
- 复杂金额计算逻辑
- 批量结算处理
- 支付参数配置
- 申诉流程

**预计工作量**：6-7 天（最复杂）

### 5.2 MentorPayable 聚合迁移计划

#### **Day 1-2**: 实体 & 值对象（金额计算核心）

**Money 值对象**（核心）：
```typescript
// value-objects/money.vo.ts
class Money {
  private constructor(
    private readonly amount: string,      // 使用字符串避免浮点精度问题
    private readonly currency: Currency   // 枚举：CNY, USD
  ) {}

  static create(amount: number | string, currency: Currency): Money {
    // 验证金额 > 0
    const parsed = this.parseAmount(amount);
    if (parsed <= 0) {
      throw new InvalidMoneyAmountException(amount);
    }
    return new Money(parsed.toFixed(2), currency);
  }

  // 算术运算
  add(other: Money): Money {
    this.ensureSameCurrency(other);
    return Money.create(
      this.getNumericAmount() + other.getNumericAmount(),
      this.currency
    );
  }

  subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    return Money.create(
      this.getNumericAmount() - other.getNumericAmount(),
      this.currency
    );
  }

  multiply(factor: number): Money {
    return Money.create(
      this.getNumericAmount() * factor,
      this.currency
    );
  }

  // 比较
  isGreaterThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.getNumericAmount() > other.getNumericAmount();
  }

  isZero(): boolean {
    return this.getNumericAmount() === 0;
  }

  // Getter
  getAmount(): string { return this.amount; }
  getNumericAmount(): number { return parseFloat(this.amount); }
  getCurrency(): Currency { return this.currency; }

  // 格式化
  toString(): string {
    return `${this.currency} ${this.amount}`;
  }

  // 相等性
  equals(other: Money): boolean {
    return this.amount === other.amount &&
           this.currency === other.currency;
  }

  private ensureSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchException(
        this.currency,
        other.currency
      );
    }
  }

  private static parseAmount(amount: number | string): number {
    const parsed = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(parsed)) {
      throw new InvalidMoneyAmountException(amount);
    }
    return parsed;
  }
}

// 枚举：Currency
type Currency = 'CNY' | 'USD';

// 使用示例
const price = Money.create(100, 'CNY');              // 创建
const discount = Money.create(10, 'CNY');            // 折扣
const finalPrice = price.subtract(discount);         // 90 CNY
const tax = finalPrice.multiply(0.06);               // 5.40 CNY
const total = finalPrice.add(tax);                   // 95.40 CNY
```

**MentorPayable 实体**（复杂计算）：
```typescript
// entities/mentor-payable.entity.ts
class MentorPayable {
  private constructor(
    private _id: string,
    private _mentorId: string,
    private _contractId: string,
    private _serviceType: ServiceTypeCode,
    private _baseAmount: Money,              // 基础金额（值对象）
    private _bonusAmount: Money,             // 奖金
    private _penaltyAmount: Money,           // 扣款
    private _finalAmount: Money,             // 最终金额
    private _status: PayableStatus,          // 值对象（状态机）
    private _calculatedAt: Date,
    private _relatedSessionId: string,
    private _formula: PayableFormula,        // 值对象（计算公式）
  ) {}

  // 核心方法：重新计算
  recalculate(formula: PayableFormula, context: PayableContext): void {
    // 1. 计算基础金额
    this._baseAmount = formula.calculateBase(context);

    // 2. 计算奖金（根据评价等级）
    this._bonusAmount = formula.calculateBonus(
      context.getRating(),
      this._baseAmount
    );

    // 3. 计算扣款（申诉、迟到等）
    this._penaltyAmount = formula.calculatePenalty(
      context.getPenalties()
    );

    // 4. 计算最终金额
    this._finalAmount = this._baseAmount
      .add(this._bonusAmount)
      .subtract(this._penaltyAmount);

    // 5. 记录公式（审计）
    this._formula = formula;
  }

  // 状态转换
  markAsPaid(paymentId: string): void {
    if (!this._status.isPending()) {
      throw new OnlyPendingCanBePaidException();
    }
    this._status = PayableStatus.PAID;
    this.addPaymentRecord(paymentId);
  }

  // 验证
  validate(): void {
    if (this._finalAmount.isZero()) {
      throw new InvalidPayableAmountException(
        'Final amount cannot be zero'
      );
    }

    if (this._finalAmount.isGreaterThan(this._baseAmount.multiply(2))) {
      throw new SuspiciousPayableAmountException(
        this._finalAmount,
        'Exceeds maximum allowed amount'
      );
    }
  }
}

// value-objects/payable-formula.vo.ts
class PayableFormula {
  private constructor(
    private readonly baseRate: Money,      // 基础单价
    private readonly bonusRates: Map<Rating, number>,  // 奖金系数
    private readonly penaltyRules: PenaltyRule[]
  ) {}

  calculateBase(context: PayableContext): Money {
    // 基础金额 = 时长 × 单价
    return this.baseRate.multiply(context.getDurationHours());
  }

  calculateBonus(rating: Rating, baseAmount: Money): Money {
    const bonusRate = this.bonusRates.get(rating) || 0;
    return baseAmount.multiply(bonusRate);
  }

  calculatePenalty(penalties: Penalty[]): Money {
    return penalties.reduce((total, penalty) => {
      const rule = this.findPenaltyRule(penalty.type);
      return total.add(rule.calculateAmount(penalty.severity));
    }, Money.create(0, 'CNY'));
  }
}
```

#### **Day 3-4**: 领域服务 & 验证

**金额验证服务**（领域服务）：
```typescript
// services/payable-validation.service.ts
class PayableValidationService {
  // 验证应付金额合理性
  async validatePayable(payable: MentorPayable): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    // 1. 检查金额范围
    if (payable.getFinalAmount().isGreaterThan(Money.create(5000, 'CNY'))) {
      issues.push({
        type: 'AMOUNT_TOO_HIGH',
        severity: 'WARNING',
        message: '单次应付金额超过 5000，需要二次确认'
      });
    }

    // 2. 检查历史平均值
    const historicalAvg = await this.getHistoricalAverage(
      payable.getMentorId(),
      payable.getServiceType()
    );
    const deviation = payable.getFinalAmount()
      .getNumericAmount() / historicalAvg.getNumericAmount();

    if (deviation > 1.5) {
      issues.push({
        type: 'AMOUNT_DEVIATION',
        severity: 'ERROR',
        message: `金额偏差超过 50%（历史平均：${historicalAvg.toString()}）`
      });
    }

    // 3. 检查申诉记录
    const appeals = await this.appealRepository.findBySession(
      payable.getRelatedSessionId()
    );
    if (appeals.length > 0) {
      issues.push({
        type: 'HAS_APPEALS',
        severity: 'WARNING',
        message: '会话存在申诉记录'
      });
    }

    return new ValidationResult(issues);
  }

  // 批量验证（结算前）
  async batchValidate(payables: MentorPayable[]): Promise<BatchValidationResult> {
    const results = new Map<string, ValidationResult>();

    for (const payable of payables) {
      const result = await this.validatePayable(payable);
      results.set(payable.getId(), result);
    }

    const hasErrors = Array.from(results.values())
      .some(r => r.hasErrors());

    return new BatchValidationResult(results, hasErrors);
  }
}
```

**结算服务**（跨聚合）：
```typescript
// services/settlement.service.ts
class SettlementService {
  // 批量生成结算单
  async createSettlement(
    mentorId: string,
    period: SettlementPeriod
  ): Promise<Settlement> {
    // 1. 查询所有应付（PENDING 状态）
    const payables = await this.payableRepository.findPendingByMentor(
      mentorId,
      period
    );

    if (payables.length === 0) {
      throw new NoPayablesForSettlementException(mentorId, period);
    }

    // 2. 批量验证
    const validationResult = await this.validationService.batchValidate(
      payables
    );

    if (validationResult.hasErrors()) {
      throw new PayableValidationFailedException(validationResult);
    }

    // 3. 计算总金额
    const totalAmount = payables.reduce(
      (sum, payable) => sum.add(payable.getFinalAmount()),
      Money.create(0, 'CNY')
    );

    // 4. 创建结算单
    const settlement = Settlement.create(
      uuid(),
      mentorId,
      period,
      totalAmount,
      payables.map(p => p.getId())
    );

    // 5. 标记应付为已结算
    for (const payable of payables) {
      payable.markAsSettled(settlement.getId());
      await this.payableRepository.update(payable);
    }

    // 6. 保存结算单
    await this.settlementRepository.save(settlement);

    // 7. 发布事件
    this.eventEmitter.emit(
      'settlement.created',
      new SettlementCreatedEvent(settlement.getId())
    );

    return settlement;
  }

  // 确认支付
  async confirmPayment(
    settlementId: string,
    paymentInfo: PaymentInfo
  ): Promise<void> {
    return await this.settlementRepository.withTransaction(async (txRepo) => {
      const settlement = await txRepo.findById(settlementId);

      // 1. 记录支付
      settlement.recordPayment(
        paymentInfo.paymentId,
        paymentInfo.amount,
        paymentInfo.method
      );

      // 2. 标记所有应付为已支付
      const payables = await txRepo.findPayablesBySettlement(settlementId);
      for (const payable of payables) {
        payable.markAsPaid(paymentInfo.paymentId);
        await this.payableRepository.update(payable);
      }

      // 3. 完成结算
      settlement.complete();
      await txRepo.update(settlement);

      // 4. 发布事件
      this.eventEmitter.emit(
        'settlement.paid',
        new SettlementPaidEvent(settlementId)
      );
    });
  }
}
```

#### **Day 5-6**: Application 层 & 复杂测试

**Command 实现**：
```typescript
// commands/calculate-payable/
class CalculatePayableHandler {
  async execute(command: CalculatePayableCommand): Promise<MentorPayable> {
    // 1. 查询相关数据
    const session = await this.sessionRepository.findById(command.sessionId);
    const mentor = await this.mentorRepository.findById(session.mentorId);
    const rating = await this.ratingRepository.findBySession(command.sessionId);

    // 2. 构建上下文
    const context = PayableContext.create(
      session.getDuration(),
      rating,
      session.getPenalties()
    );

    // 3. 获取公式
    const formula = await this.formulaRepository.findByServiceType(
      session.getServiceType()
    );

    // 4. 创建应付
    const payable = MentorPayable.create(
      uuid(),
      mentor.id,
      session.contractId,
      session.getServiceType(),
      Money.create(0, 'CNY'),  // 临时
      Money.create(0, 'CNY'),
      Money.create(0, 'CNY'),
      Money.create(0, 'CNY'),
      PayableStatus.PENDING,
      session.getId(),
      formula
    );

    // 5. 重新计算
    payable.recalculate(formula, context);

    // 6. 验证
    payable.validate();

    // 7. 保存
    await this.payableRepository.save(payable);

    // 8. 发布事件
    this.eventEmitter.emit(
      'payable.calculated',
      new PayableCalculatedEvent(payable.getId())
    );

    return payable;
  }
}

// commands/create-settlement/
class CreateSettlementHandler {
  async execute(command: CreateSettlementCommand): Promise<Settlement> {
    // 调用 SettlementService（领域服务）
    // 复杂逻辑封装在领域服务中
    return await this.settlementService.createSettlement(
      command.mentorId,
      command.period
    );
  }
}
```

**测试策略**：
```typescript
// 场景 1：金额计算精度
it('金额计算保持精度，避免浮点误差', async () => {
  const price = Money.create(100, 'CNY');
  const taxRate = 0.06;  // 6%

  const tax = price.multiply(taxRate);  // 6 CNY
  const total = price.add(tax);         // 106 CNY

  expect(tax.getAmount()).toBe('6.00');
  expect(total.getAmount()).toBe('106.00');
});

// 场景 2：复杂公式计算
it('计算含奖金和扣款的应付金额', async () => {
  // 基础：100 CNY/小时，2 小时 = 200 CNY
  // 奖金：评价 5 星，10% 奖金 = 20 CNY
  // 扣款：迟到 -15 CNY
  // 最终：200 + 20 - 15 = 205 CNY

  const command = new CalculatePayableCommand({
    sessionId: 'session-123',
    durationHours: 2,
    rating: 5,  // 5 星
    penalties: [{ type: 'LATE', severity: 'MINOR' }]  // 迟到
  });

  const payable = await handler.execute(command);

  expect(payable.getBaseAmount().getAmount()).toBe('200.00');
  expect(payable.getBonusAmount().getAmount()).toBe('20.00');
  expect(payable.getPenaltyAmount().getAmount()).toBe('15.00');
  expect(payable.getFinalAmount().getAmount()).toBe('205.00');
});

// 场景 3：批量验证（部分失败）
it('结算验证时，发现异常金额阻止结算', async () => {
  // 准备数据（其中一个金额异常）
  const payables = [
    { id: 'p-1', amount: Money.create(100, 'CNY') },  // 正常
    { id: 'p-2', amount: Money.create(10000, 'CNY') }, // 异常（太高）
    { id: 'p-3', amount: Money.create(200, 'CNY') }   // 正常
  ];

  // 执行批量验证
  const result = await validationService.batchValidate(payables);

  // 验证结果
  expect(result.hasErrors()).toBe(true);
  expect(result.getErrors('p-1')).toHaveLength(0);
  expect(result.getErrors('p-2')).toContainEqual(
    expect.objectContaining({
      type: 'AMOUNT_TOO_HIGH',
      severity: 'WARNING'
    })
  );
  expect(result.getErrors('p-3')).toHaveLength(0);
});

// 场景 4：跨域数据一致性
it('应付金额计算依赖服务消费记录', async () => {
  // 1. 查询服务消费（Contract 域）
  const consumptions = await contractRepository.findServiceConsumptions(
    contractId,
    serviceType
  );

  // 2. 计算应付（Financial 域）
  const payable = await handler.execute({
    mentorId,
    consumptions  // 传递消费记录
  });

  // 3. 验证金额与消费一致
  const expectedAmount = consumptions
    .map(c => c.getQuantity() * hourlyRate)
    .reduce((sum, amount) => sum + amount, 0);

  expect(payable.getBaseAmount().getNumericAmount())
    .toBeCloseTo(expectedAmount, 2);
});
```

### 5.3 Financial 域决策清单

| 决策项 | 选择 | 说明 |
|--------|------|------|
| **值对象** | Money, PayableFormula, SettlementPeriod | 金额精度、计算公式、结算周期 |
| **领域服务** | PayableValidationService, SettlementService | 金额验证、批量结算 |
| **异常类型** | InvalidMoneyAmount, CurrencyMismatch, SuspiciousAmount | 金额错误、币种不匹配、可疑金额 |
| **依赖** | 依赖 contract、placement | 查询消费记录、投递状态 |
| **关键设计** | Money 使用 string 存储 | 避免浮点精度问题 |

### 5.4 关键业务规则

#### **金额精度处理**
```typescript
// 永远不要使用 number 存储金额
❌ class Payable {
    amount: number;  // 错误！浮点精度问题
  }

// 使用 string 存储，number 计算
✅ class Money {
    private amount: string;  // "100.00"

    add(other: Money): Money {
      const result = this.getNumericAmount() + other.getNumericAmount();
      return Money.create(result.toFixed(2), this.currency);
    }
  }
```

#### **结算周期计算**
```
结算周期：MONTHLY（每月）
计算方式：
  startDate: 每月 1 日 00:00:00
  endDate: 每月最后一日 23:59:59
  包含：区间内所有 PENDING 状态的应付

结算周期：WEEKLY（每周）
计算方式：
  startDate: 每周一 00:00:00
  endDate: 每周日 23:59:59
  包含：区间内所有 PENDING 状态的应付
```

#### **支付确认流程**
```
1. 创建结算单（CreateSettlement）
   ↓
2. 验证所有应付（BatchValidate）
   ↓ 验证通过
3. 标记应付为已结算（Mark as Settled）
   ↓
4. 等待支付（Pending Payment）
   ↓ 支付完成
5. 确认支付（Confirm Payment）
   ↓
6. 标记应付为已支付（Mark as Paid）
   ↓
7. 完成结算（Complete Settlement）
```

---

## 六、迁移实施计划

### 6.1 时间线（4 周）

#### **Week 1**: Catalog 域（产品目录）
- **Day 1-2**: Product 实体、值对象、仓储接口
- **Day 3-4**: ServiceType 实体、基础设施层
- **Day 5**: Application 层、集成测试
- **复盘**：调整模式，完善基类

#### **Week 2**: Contract 域（合约管理）
- **Day 1-2**: Contract 聚合（核心）
- **Day 3-4**: ServiceLedger & ServiceHold（复杂）
- **Day 5**: Command/Query、事件处理
- **Day 6-7**: 集成测试、修复问题

#### **Week 3**: Placement 域（求职投递）
- **Day 1-2**: JobApplication 实体、状态机
- **Day 3**: JobPosition 聚合
- **Day 4**: 领域服务（批量内推）
- **Day 5**: 跨域集成测试

#### **Week 4**: Financial 域（财务结算）
- **Day 1-2**: Money 值对象、MentorPayable
- **Day 3**: 领域服务（验证、计算）
- **Day 4**: Settlement 聚合（批量处理）
- **Day 5**: 集成测试
- **Day 6-7**: 端到端测试、清理旧代码

### 6.2 人员分工（5 人团队）

| 角色 | 职责 | 人数 |
|------|------|------|
| **领域专家** | 设计实体、值对象、业务规则 | 1 |
| **应用架构师** | Command/Query、事务编排 | 1 |
| **基础设施工程师** | Repository、Mapper、数据库优化 | 1 |
| **测试工程师** | 单元测试、集成测试、E2E 测试 | 1 |
| **技术负责人** | 代码审查、集成协调、风险管理 | 1 |

**并行工作模式**：
- **Week 1**: 全员参与 Catalog（学习模式）
- **Week 2-4**: 并行开发（每人负责一个域）
- **Daily**: 站会同步进度和问题
- **Code Review**: 每完成一个聚合进行一次

### 6.3 风险管理

#### **技术风险**

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|----------|
| **金额精度问题** | 中 | 高 | 1. Money 值对象全面单元测试<br>2. 集成测试覆盖所有计算场景<br>3. 生产环境灰度发布 |
| **跨域事务一致性** | 中 | 高 | 1. 最终一致性 + 补偿机制<br>2. Saga 模式（长事务）<br>3. 事件溯源 |
| **状态机转换错误** | 低 | 高 | 1. 状态矩阵全面测试<br>2. 生产环境监控状态分布<br>3. 快速回滚机制 |
| **性能下降** | 低 | 中 | 1. N+1 查询优化<br>2. 批量操作优化<br>3. 数据库索引梳理 |

#### **业务风险**

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|----------|
| **迁移期间 Bug** | 中 | 中 | 1. 新旧代码双跑（Feature Flag）<br>2. 逐步切换流量<br>3. 快速回滚工具 |
| **数据不一致** | 低 | 高 | 1. 迁移前数据备份<br>2. 数据校验脚本<br>3. 数据修复预案 |
| **团队学习成本** | 中 | 中 | 1. Week 1 轻量级任务<br>2. Code Review 知识传递<br>3. 文档和示例代码 |

### 6.4 质量保障

#### **测试金字塔**

```
E2E Tests (10%) - 核心业务流程
   ↓
Integration Tests (20%) - Repository、跨域调用
   ↓
Unit Tests (70%) - 实体、值对象、领域服务
```

**测试覆盖率目标**：
- 实体 & 值对象：100%
- 领域服务：90%
- Repository：80%
- Command/Query Handler：85%

#### **测试策略**

**单元测试（快速）**：
```typescript
describe('Money', () => {
  it('应该保持计算精度', () => {
    const m1 = Money.create(100, 'CNY');
    const m2 = Money.create(50.5, 'CNY');
    const result = m1.subtract(m2);
    expect(result.getAmount()).toBe('49.50');  // 精确到分
  });
});

describe('Product', () => {
  it('发布时应该检查是否有 items', () => {
    const product = Product.createDraft(/* ... */);
    expect(() => product.publish())
      .toThrow(ProductMinItemsException);
  });
});
```

**集成测试（Mock 外部依赖）**：
```typescript
describe('CreateProductHandler', () => {
  it('应该拒绝重复的产品编码', async () => {
    mockProductRepository.existsByCode.mockResolvedValue(true);

    await expect(handler.execute(command))
      .rejects.toThrow(ProductCodeDuplicateException);
  });
});
```

**E2E 测试（真实场景）**：
```typescript
describe('创建和发布产品', () => {
  it('完整流程', async () => {
    // 1. 创建产品（API）
    const createRes = await app.post('/api/products').send({
      name: 'Test Product',
      code: 'TEST-001',
      price: 100
    });
    expect(createRes.status).toBe(201);

    // 2. 添加 item
    await app.post(`/api/products/${productId}/items`).send({
      name: 'Item 1',
      duration: 60
    });

    // 3. 发布产品
    const publishRes = await app.patch(`/api/products/${productId}/publish`);
    expect(publishRes.status).toBe(200);

    // 4. 验证状态
    const getRes = await app.get(`/api/products/${productId}`);
    expect(getRes.body.status).toBe('ACTIVE');
  });
});
```

---

## 七、监控与度量

### 7.1 业务指标

**重构进度**：
```
- 实体迁移数：20/20（100%）
- 值对象迁移数：15/15（100%）
- Command 迁移数：25/25（100%）
- Query 迁移数：18/18（100%）
- 旧服务删除：5/5（100%）
```

**质量指标**：
```
- 单元测试覆盖率：92%
- 集成测试覆盖率：85%
- E2E 通过率：98%
- Bug 密度：0.5/KLOC
```

**性能指标**：
```
- 查询响应时间：
  - 简单查询（byId）：< 50ms（-30%）
  - 复杂查询（search）：< 200ms（-20%）
- 事务完成时间：
  - 创建合约：< 500ms（-15%）
  - 批量操作：< 2s（-25%）
```

### 7.2 技术债务追踪

| 债务项 | 重构前 | 重构后 | 改进 |
|--------|--------|--------|------|
| **依赖倒置违例** | 20 处 | 0 处 | ✅ 解决 |
| **贫血模型** | 15 个 Service | 0 个 Service | ✅ 解决 |
| **DTO 污染 Domain** | 30 处 | 0 处 | ✅ 解决 |
| **缺少值对象** | 0 个 | 20 个 | ✅ 增强 |
| **业务逻辑分散** | 50 处 | 0 处 | ✅ 集中 |

### 7.3 监控 Dashboard

**业务监控**：
- 合约状态分布
- 服务额度消耗趋势
- 投递状态转换漏斗
- 应付金额统计

**技术监控**：
- 事务成功率
- 查询响应时间 P99
- 错误率趋势
- 系统资源使用率

---

## 八、经验总结 & 最佳实践

### 8.1 成功要素

1. **清晰的架构原则**：
   - 依赖倒置（Domain 定义接口，Infrastructure 实现）
   - 富领域模型（实体包含行为和规则）
   - 值对象封装（验证、格式化、不可变）

2. **合适的迁移策略**：
   - 从简单到复杂（Catalog → Contract → Placement → Financial）
   - 逐步重构（保持新旧代码并存）
   - 充足的测试（单元 + 集成 + E2E）

3. **团队协作**：
   - 明确分工（领域专家 + 架构师 + 工程师）
   - 代码审查（知识传递、质量保证）
   - 持续集成（快速反馈、问题早发现）

### 8.2 常见陷阱

❌ **贫血模型**（最危险）：
```typescript
// 错误：实体只有数据，没有行为
class Product {
  status: string;  // 公开字段，外部可直接修改
}
product.status = 'ACTIVE';  // 绕过业务规则

// 正确：实体封装行为和规则
class Product {
  private status: ProductStatus;

  publish(): void {
    if (!this.hasItems()) {
      throw new ProductMinItemsException();
    }
    this.status = this.status.transitionToActive();
  }
}
```

❌ **DTO 污染领域层**：
```typescript
// 错误：领域层使用 DTO
class Product {
  setPrice(dto: PriceDto): void {  // DTO 进入领域层
    this.price = dto.amount;
  }
}

// 正确：使用领域对象
class Product {
  setPrice(price: Price): void {  // 值对象
    this.price = price;
  }
}
```

❌ **忽视值对象**：
```typescript
// 错误：使用原始类型
type Currency = string;  // 可以是任意字符串
const price = { amount: 100, currency: 'invalid' };  // 没有验证

// 正确：使用强类型值对象
class Money {
  static create(amount: number, currency: Currency): Money {
    if (!['CNY', 'USD'].includes(currency)) {
      throw new InvalidCurrencyException(currency);
    }
    return new Money(amount.toFixed(2), currency);
  }
}
```

❌ **业务逻辑泄漏到应用层**：
```typescript
// 错误：应用层处理业务规则（状态检查）
async execute(command) {
  const app = await this.repo.findById(command.id);

  // 应用层检查规则（应该放在实体中）
  if (app.status !== 'DRAFT') {
    throw new Error('Cannot submit');
  }

  app.status = 'SUBMITTED';  // 直接修改状态
  await this.repo.update(app);
}

// 正确：实体封装规则
class JobApplication {
  submit(): void {
    // 实体内部检查规则
    if (!this.status.isDraft()) {
      throw new OnlyDraftCanBeSubmittedException();
    }

    // 状态转换（值对象）
    this.status = this.status.transitionTo(ApplicationStatus.SUBMITTED);
  }
}

// 应用层只负责协调
async execute(command) {
  const app = await this.repo.findById(command.id);
  app.submit();  // 调用实体方法（自动执行规则）
  await this.repo.update(app);
}
```

### 8.3 性能优化

**批量操作**：
```typescript
// 避免 N+1 查询
❌ async function findProducts(ids: string[]) {
  for (const id of ids) {
    await this.db.select().from(products).where(eq(products.id, id));
  }
}

✅ async function findProducts(ids: string[]) {
  return await this.db.select()
    .from(products)
    .where(inArray(products.id, ids));  // 一次查询
}
```

**延迟加载 vs 预加载**：
```typescript
// 根据使用场景选择加载策略
class ProductRepository {
  // 场景 1：列表页（不需要 items）
  async findForList(id: string): Promise<Product> {
    const [product] = await this.db.select()
      .from(products)
      .where(eq(products.id, id));

    // 不加载 items，提高性能
    return this.mapper.toDomain(product, []);
  }

  // 场景 2：详情页（需要 items）
  async findForDetail(id: string): Promise<Product> {
    const [product] = await this.db.select()
      .from(products)
      .where(eq(products.id, id));

    const items = await this.db.select()
      .from(productItems)
      .where(eq(productItems.productId, id));

    // 预加载 items
    return this.mapper.toDomain(product, items);
  }
}
```

### 8.4 可维护性提升

**清晰的依赖关系**：
```
API → Application → Domain ← Infrastructure
              ↓
            Shared
```

**明确的职责划分**：
- **Entity**: 数据 + 业务规则
- **Value Object**: 验证 + 格式化 + 不可变
- **Repository**: 持久化 + 查询
- **Domain Service**: 跨实体业务逻辑
- **Application Service**: 用例编排 + 事务

**自文档化的代码**：
```typescript
// 代码即文档
class Contract {
  sign(signedBy: User): void {
    // 1. 检查状态
    if (!this.status.isDraft()) {
      throw new OnlyDraftCanBeSignedException();
    }

    // 2. 记录签署人
    this.signedBy = signedBy;
    this.signedAt = new Date();

    // 3. 状态转换
    this.status = this.status.transitionToPending();

    // 4. 发布事件
    this.domainEvents.emit(new ContractSignedEvent(this.id));
  }
}
```

---

## 附录

### A. 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 聚合根 | Aggregate Root | 一组相关对象的根实体，外部只能通过它访问 |
| 实体 | Entity | 有唯一标识，生命周期内状态可变 |
| 值对象 | Value Object | 无唯一标识，不可变，通过属性值判断相等性 |
| 仓储 | Repository | 提供领域对象的持久化和查询接口 |
| 领域服务 | Domain Service | 跨实体或不适合放在实体中的业务逻辑 |
| 应用服务 | Application Service | 用例编排、事务管理、权限检查 |
| 防腐层 | Anti-Corruption Layer | 隔离外部系统，防止污染领域模型 |
| 状态机 | State Machine | 定义对象状态的合法转换规则 |

### B. 参考资料

1. **《领域驱动设计》Eric Evans**
2. **《实现领域驱动设计》Vaughn Vernon**
3. **《整洁架构》Robert C. Martin**
4. **《企业应用架构模式》Martin Fowler**

### C. 相关文档

- [/docs/DDD_CATALOG_DOMAIN_REFACTORING_DESIGN.md](/docs/DDD_CATALOG_DOMAIN_REFACTORING_DESIGN.md) - Catalog 域详细设计
- [/docs/DDD_REVIEW_src-shared_src-application.md](/docs/DDD_REVIEW_src-shared_src-application.md) - 架构评审
- [/docs/ARCHITECTURE.md](/docs/ARCHITECTURE.md) - 整体架构

---

**文档版本**: v1.0
**制定日期**: 2025-12-19
**制定团队**: 架构组 & 开发团队
**评审状态**: 已评审通过
