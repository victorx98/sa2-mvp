# Catalog 领域 DDD 重构设计方案

> 本文档详细说明如何将 `src/domains/catalog/` 从依赖反转违规的架构重构为符合 DDD/整洁架构的设计。
>
> **目标读者**：开发团队成员
>
> **参考文档**：`/docs/DDD_REVIEW_src-shared_src-application.md`

---

## 决策清单（Decisions Log）

以下是本设计文档中的关键架构决策（已团队讨论确认）：

### ✅ D1: 领域事件定义的位置
**决策**: 所有领域事件定义必须统一放置在 `src/shared/events/` 目录
**理由**: 促进跨领域复用，保持项目结构一致性
**影响**: Domain → Shared 的依赖方向

### ✅ D2: Repository 接口与实现的分离方式
**决策**: 在 Domain 层内创建 `infrastructure/` 子目录，Repository 接口放在 `repositories/`，实现放在 `infrastructure/repositories/`
**理由**: 依赖倒置原则，接口与实现分离，便于替换 ORM
**影响**: 明确区分 Domain 和 Infrastructure 边界

### ✅ D3: Domain 层是否使用 DTO
**决策**: Domain 层不使用 DTO，使用 Entity 和 Value Object
**理由**: DTO 是跨边界传输对象，Domain 层应使用领域对象
**影响**: 使用 Criteria 作为 Repository 接口的查询参数

### ✅ D4: 值对象（Value Object）的使用范围
**决策**: 选项 B - 只有需要封装复杂规则或行为的字段才使用值对象
**理由**: 保持代码简洁，避免过度设计
**示例**: Price（验证+格式化）、ProductCode（格式验证）、ProductStatus（状态机）
**反例**: name、description 等简单字段不需要值对象

### ✅ D5: Repository 查询参数的命名
**决策**: 选项 A - 使用 `Criteria`（如 `ProductSearchCriteria`）
**理由**: 语义清晰，名称简洁，与 NestJS、Spring 等现代框架的命名习惯一致

### ✅ D6: 领域服务（Domain Service）的使用场景
**决策**: 选项 B - 当业务逻辑不适合放在单个实体时（即使不跨聚合）
**理由**: 保持实体简洁，遵循单一职责原则
**示例**: 批量操作、复杂验证规则、状态转换策略

### ✅ D7: 领域异常的层次结构
**决策**: 选项 A - 使用 `DomainException` 基类（code + message + metadata）
**实现**:
```typescript
export class DomainException extends Error {
  constructor(
    public readonly code: string,        // 如 'PRODUCT_NOT_DRAFT'
    message: string,
    public readonly metadata?: Record<string, any>,
  ) {
    super(message);
  }
}
```
**理由**: 统一异常处理机制，便于在应用层统一捕获和转换

### ✅ D8: 渐进式重构的粒度
**决策**: 选项 A - 一次性迁移所有 Command（2-3 天）
**实施步骤**:
1. 第 1 天：实现实体、值对象、仓储接口和实现
2. 第 2 天：迁移所有 Command Handler
3. 第 3 天：集成测试和验证
**理由**: 快速完成，减少新旧代码并存时间

---

## 〇、架构分层原则

### 0.1 整体分层结构

```
src/
├── api/                    # 接口层（HTTP Controllers）
│   ├── controllers/
│   └── dto/
│       ├── request/        # API 请求 DTO
│       └── response/       # API 响应 DTO
│
├── application/            # 应用层（用例编排）
│   ├── commands/           # 写操作命令
│   │   ├── product/        # Product 领域命令
│   │   ├── contract/       # Contract 领域命令
│   │   └── booking/        # 跨领域编排（预约）
│   └── queries/            # 读操作查询
│       └── product/
│
├── domains/                # 领域层（业务逻辑）
│   └── catalog/
│       ├── product/        # Product 聚合
│       │   ├── entities/          # 领域实体
│       │   ├── value-objects/     # 值对象
│       │   ├── repositories/      # 仓储接口
│       │   ├── services/          # 领域服务
│       │   ├── exceptions/        # 领域异常
│       │   ├── event-handlers/             # 事件处理器（仅实现，不含定义）
│       │   │   └── index.ts
│       │   └── infrastructure/    # 基础设施实现
│       │       ├── repositories/  # Drizzle 仓储实现
│       │       └── mappers/       # 数据映射器
│       └── service-type/
│
├── shared/                 # 共享层（跨领域共享代码）
│   ├── events/             # 事件定义（所有领域共享）
│   │   ├── product-published.event.ts   # 产品发布事件定义
│   │   ├── product-unpublished.event.ts # 产品下架事件定义
│   │   └── index.ts
│
└── infrastructure/         # 全局基础设施
    └── database/          # 数据库连接、schema
```

### 0.2 依赖方向（关键）

```
API Layer (Controllers)
    ↓ 调用
Application Layer (Commands/Queries)     ← src/application/
    ↓ 调用
Domain Layer (Entities/Services)         ← src/domains/catalog/product/
    ↑ 接口被实现
Infrastructure (Repositories)            ← src/domains/catalog/product/infrastructure/
```

**核心原则**：
- Domain 定义接口（`IProductRepository`）
- Infrastructure 实现接口（`DrizzleProductRepository`）
- Application 注入接口（通过 DI 容器）

---

## 一、Domain 层目录结构

### 1.1 Product 聚合完整目录树

```
src/domains/catalog/product/
│
├── entities/                           # 领域实体（富领域模型）
│   ├── product.entity.ts               # Product 聚合根
│   ├── product-item.entity.ts          # ProductItem 子实体
│   └── index.ts
│
├── value-objects/                      # 值对象（不可变）
│   ├── price.vo.ts                     # Price 值对象（金额 + 币种）
│   ├── product-code.vo.ts              # ProductCode 值对象（带验证）
│   ├── product-status.vo.ts            # ProductStatus 状态机
│   └── index.ts
│
├── repositories/                       # 仓储接口（只有接口定义）
│   ├── product.repository.interface.ts # IProductRepository 接口
│   ├── product-search.criteria.ts      # 查询条件（接口的一部分）
│   └── index.ts
│
├── services/                           # 领域服务（纯业务规则）
│   ├── product-lifecycle.service.ts    # 产品生命周期管理
│   └── index.ts
│
├── exceptions/                         # 领域异常
│   ├── product-not-draft.exception.ts
│   ├── product-min-items.exception.ts
│   ├── invalid-product-code.exception.ts
│   └── index.ts
│
├── event-handlers/                             # 事件处理器
│   ├── product-published.handler.ts     # 产品发布事件处理器
│   ├── product-unpublished.handler.ts   # 产品下架事件处理器
│   └── index.ts
│
├── infrastructure/                     # 基础设施层实现
│   ├── repositories/                   # 仓储实现
│   │   ├── drizzle-product.repository.ts  # Drizzle ORM 实现
│   │   └── index.ts
│   │
│   └── mappers/                        # 数据映射器
│       ├── product.mapper.ts           # Product 实体 ↔ DB 转换
│       └── index.ts
│
├── product.module.ts                   # NestJS 模块配置
└── index.ts                            # 统一导出
```

### 1.2 目录分层说明

#### **Domain 层内容（纯业务逻辑）**

**直接展开的目录**：
- `entities/`: 领域实体
- `value-objects/`: 值对象
- `repositories/`: 仓储接口（只有接口，无实现）
- `services/`: 领域服务
- `exceptions/`: 领域异常
- `event-handlers/`: 事件处理器

**依赖规则**：
- ✅ 可以依赖：同层其他模块、共享的领域概念
- ❌ 禁止依赖：`@infrastructure/**`、`@api/**`、`@application/**`
- ❌ 禁止引用：Drizzle、数据库连接、HTTP 相关库

#### **Events 目录设计**

**核心功能定位**：
- **Shared 目录**：统一管理所有领域事件的定义，促进代码复用和一致性
- **Domain 目录**：仅负责实现事件处理器，处理领域内的事件订阅和业务逻辑
- 实现领域事件的异步处理
- 维护领域内的最终一致性
- 解耦领域内的不同模块

**设计规范**：
- **所有事件定义必须统一放置到 shared 目录**：基于事件定义的公用性质，促进代码复用并维持项目结构的一致性
- **Domain 目录仅负责实现事件处理器**：不应包含事件定义代码
- **事件定义遵循共享代码的设计原则**：
  - 事件定义应具有良好的通用性
  - 避免过度依赖特定领域的实现细节
  - 便于跨领域使用

**命名规范**：
- **Shared 目录事件定义文件**：`{event-name}.event.ts`（例如：`product-published.event.ts`）
- **Domain 目录事件处理器文件**：`{event-name}.handler.ts`（例如：`product-published.handler.ts`）
- **事件处理器目录**：`domains/xxx/event-handlers/`

**层级结构**：

1. **Shared 目录（事件定义）**：
```
src/shared/
├── events/                     # 事件定义（所有领域共享）
│   ├── product-published.event.ts   # 产品发布事件定义
│   ├── product-unpublished.event.ts # 产品下架事件定义
│   └── index.ts                    # 统一导出
```

2. **Domain 目录（事件处理器）**：
```
src/domains/catalog/product/
├── event-handlers/                   # 事件处理器（领域内的事件处理）
│   ├── product-published.handler.ts   # 产品发布事件处理器
│   ├── product-unpublished.handler.ts # 产品下架事件处理器
│   └── index.ts                # 统一导出
└── index.ts                    # 统一导出
```

**文件类型与职责划分**：

1. **Shared 目录事件定义文件**（`*.event.ts`）：
   - **职责**：定义领域事件的数据结构，供所有领域使用
   - **位置**：必须放置在 `src/shared/events/` 目录下
   - **特点**：
     - 定义事件的所有必要字段
     - 不包含业务逻辑，只定义数据结构
     - 具有良好的通用性，便于跨领域使用
   - **示例**：
     ```typescript
     // src/shared/events/product-published.event.ts
     export class ProductPublishedEvent {
       constructor(
         public readonly productId: string,
         public readonly publishedAt: Date,
         public readonly publishedBy: string,
       ) {}
     }
     ```

2. **Domain 目录事件处理器文件**（`*.handler.ts`）：
   - **职责**：处理领域事件的业务逻辑，实现事件订阅和处理
   - **位置**：放置在 `domains/xxx/event-handlers/` 目录下
   - **特点**：
     - 实现事件订阅和处理逻辑
     - 可以调用领域服务和仓储
     - 仅负责当前领域内的事件处理
   - **示例**：
     ```typescript
     // src/domains/catalog/product/event-handlers/product-published.handler.ts
     import { ProductPublishedEvent } from "@shared/events/product-published.event";
     
     @Injectable()
     export class ProductPublishedHandler {
       constructor(
         private readonly productService: ProductLifecycleService,
         private readonly productRepository: IProductRepository,
       ) {}
       
       @OnEvent('product.published')
       async handle(event: ProductPublishedEvent): Promise<void> {
         // 处理产品发布事件
         // 可以调用领域服务、更新其他实体等
       }
     }
     ```

**依赖关系**：
- **Domain 依赖 Shared**：事件处理器依赖 shared 目录中的事件定义
- **Shared 不依赖 Domain**：事件定义不能依赖任何领域的实现细节
- **依赖方向**：`Domain → Shared`（符合依赖倒置原则）

**与其他目录的关系及交互方式**：

1. **与 Entities 的关系**：
   - 事件处理器可以读取和更新实体
   - 实体可以发布事件（使用 shared 目录中的事件定义）
   - 事件通常由实体的状态变更触发

2. **与 Value Objects 的关系**：
   - 事件可以包含值对象作为字段
   - 事件处理器可以使用值对象进行业务逻辑处理

3. **与 Services 的关系**：
   - 事件处理器可以调用领域服务
   - 领域服务可以发布事件
   - 事件处理器可以实现跨实体的业务逻辑

4. **与 Repositories 的关系**：
   - 事件处理器可以使用仓储读取和保存实体
   - 仓储不直接处理事件

5. **与 Exceptions 的关系**：
   - 事件处理器可以抛出领域异常
   - 异常处理由应用层统一处理

**事件处理流程**：
1. 实体状态变更时，使用 shared 目录中的事件定义发布事件
2. 事件总线接收事件
3. 事件总线将事件分发给注册的处理器
4. 事件处理器执行业务逻辑
5. 事件处理器可以更新实体或调用领域服务
6. 更新后的实体通过仓储保存到数据库

**依赖规则**：
- **事件定义**：
  - ✅ 可以使用：基础类型、值对象
  - ❌ 禁止依赖：领域实体、领域服务、仓储接口
  - ❌ 禁止引用：数据库相关代码、HTTP 相关库
- **事件处理器**：
  - ✅ 可以依赖：shared 目录中的事件定义、领域服务、仓储接口、实体
  - ❌ 禁止依赖：基础设施层
  - ❌ 禁止处理跨领域的事件（跨领域事件由应用层处理）

#### **Infrastructure 子目录（技术实现）**

**为什么需要 infrastructure/ 子目录**：

```
product/
├── repositories/            # 接口（Domain 层）
│   └── product.repository.interface.ts
│
└── infrastructure/          # 实现（Infrastructure 层）
    └── repositories/
        └── drizzle-product.repository.ts
```

**原因**：
- **依赖倒置**：接口和实现必须分离
- **可替换性**：可以有多个实现（Drizzle / Prisma / MongoDB）
- **测试隔离**：测试时只 Mock 接口

### 1.3 关于 DTO 的重要说明

**❌ Domain 层不需要 DTO 目录**

DTO (Data Transfer Object) 是跨边界传输数据的对象，Domain 层应该使用**领域对象**：

**Domain 层应该使用**：
- ✅ **Entity**（实体）：`Product`, `ProductItem`
- ✅ **Value Object**（值对象）：`Price`, `ProductCode`, `ProductStatus`
- ✅ **Aggregate**（聚合）：`Product` 聚合根
- ❌ **DTO**：不应该出现

**Repository 接口的查询参数处理**：

```typescript
// src/domains/catalog/product/repositories/product-search.criteria.ts
export interface ProductSearchCriteria {
  status?: string;
  nameContains?: string;
  page?: number;
  pageSize?: number;
}

export interface ProductSearchResult {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
}
```

**命名说明**：
- ✅ 叫 `Criteria`（查询条件）或 `Specification`（查询规约）
- ❌ 不叫 `DTO`（这是 Repository 接口的一部分，不是数据传输对象）

---

## 二、Application 层目录结构

### 2.1 Application 层完整目录树

```
src/application/
│
├── commands/                           # 写操作（Command）
│   │
│   ├── product/                        # Product 领域命令
│   │   ├── create-product/
│   │   │   ├── create-product.command.ts      # 命令 DTO
│   │   │   ├── create-product.handler.ts      # 命令处理器
│   │   │   └── index.ts
│   │   │
│   │   ├── publish-product/
│   │   │   ├── publish-product.command.ts
│   │   │   ├── publish-product.handler.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── add-product-item/
│   │   └── index.ts
│   │
│   ├── contract/                       # Contract 领域命令
│   │   ├── create-contract/
│   │   ├── activate-contract/
│   │   └── index.ts
│   │
│   ├── booking/                        # 跨领域编排
│   │   └── book-session.command.ts     # 预约涉及 Contract + Session
│   │
│   └── index.ts
│
├── queries/                            # 读操作（Query）
│   ├── product/
│   │   ├── get-product/
│   │   │   ├── get-product.query.ts
│   │   │   ├── get-product.handler.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── search-products/
│   │   └── index.ts
│   │
│   └── index.ts
│
├── core/                               # Application 核心基类
│   ├── command.base.ts                 # CommandBase（事务支持）
│   ├── query.base.ts                   # QueryBase
│   └── index.ts
│
└── application.module.ts               # Application 根模块
```

### 2.2 Application 层的职责

#### **职责一：单领域用例编排**

**示例**：CreateProductCommand

```
用途：创建产品
涉及领域：Product（单领域）
编排流程：
  1. 验证产品编码唯一性（调用 ProductRepository）
  2. 创建产品实体（调用 Product.createDraft()）
  3. 保存产品（调用 ProductRepository.save()）
```

**代码位置**：
- Handler: `src/application/commands/product/create-product/create-product.handler.ts`
- 依赖：`IProductRepository` 接口

#### **职责二：跨领域用例编排**

**示例**：BookSessionCommand

```
用途：预约会话
涉及领域：Contract（扣费）+ Session（创建会话）+ Calendar（占用时间段）
编排流程：
  1. 检查合同余额（Contract Domain）
  2. 创建 ServiceHold 预占（Contract Domain）
  3. 创建 Session（Session Domain）
  4. 占用 Calendar 时间段（Calendar Domain）
  5. 创建会议（Meeting Core）
  6. 事务提交后发布事件
```

**代码位置**：
- Handler: `src/application/commands/booking/book-session.command.ts`
- 跨域依赖：ContractService, SessionService, CalendarService

#### **职责三：事务管理**

Application 层负责开启事务、协调多个仓储操作

#### **职责四：事件发布**

事务提交后发布领域事件（确保最终一致性）

### 2.3 Application Command DTO

**Application 层的 Command/Query 是 DTO**：

```typescript
// src/application/commands/product/create-product/create-product.command.ts
export class CreateProductCommand {
  name: string;
  code: string;
  price: string;      // 注意：可能和 API DTO 类型不同
  currency: Currency;
  description?: string;
}
```

**为什么需要 Application DTO**：
- API DTO 可能需要转换（例如前端传 `number`，用例需要 `string` 存储金额）
- 用例表达业务能力，不应该绑定到 HTTP 协议
- 同一个用例可能被多种接口调用（HTTP, GraphQL, RPC, CLI）

---

## 三、数据流转与 DTO 使用指南

### 3.1 完整的数据流转

```
┌─────────────────────────────────────────────────────────────┐
│ 1. API Layer (HTTP 边界)                                     │
│    CreateProductRequestDto (API DTO)                        │
│    - 包含 class-validator 装饰器                              │
│    - 面向前端                                                 │
└─────────────────────────────────────────────────────────────┘
                    ↓ Controller 转换
┌─────────────────────────────────────────────────────────────┐
│ 2. Application Layer (用例边界)                              │
│    CreateProductCommand (Application DTO)                   │
│    - 用例输入参数                                             │
│    - 技术无关                                                 │
└─────────────────────────────────────────────────────────────┘
                    ↓ Handler 转换为领域对象
┌─────────────────────────────────────────────────────────────┐
│ 3. Domain Layer (领域模型 - 无 DTO)                          │
│    Product Entity + Price ValueObject + ProductCode VO     │
│    - 纯领域对象                                               │
│    - 封装业务规则                                             │
└─────────────────────────────────────────────────────────────┘
                    ↓ Mapper 转换为 DB 记录
┌─────────────────────────────────────────────────────────────┐
│ 4. Infrastructure Layer (数据库边界)                         │
│    Database Record (Drizzle schema type)                   │
│    - 数据库表结构                                             │
│    - 不暴露给 Domain                                          │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 DTO 使用指南

| 层级 | 是否需要 DTO | 类型 | 作用 |
|------|-------------|------|------|
| **API Layer** | ✅ 必需 | Request/Response DTO | HTTP 数据传输、验证 |
| **Application Layer** | ✅ 推荐 | Command/Query | 用例输入参数、解耦 API |
| **Domain Layer** | ❌ 不需要 | Entity/Value Object | 领域模型，不是 DTO |
| **Infrastructure Layer** | ⚠️ 内部使用 | DB Record | 不暴露给外层 |

### 3.3 代码示例

#### **API Layer → Application Layer**

```typescript
// src/api/controllers/product.controller.ts
@Post()
async create(@Body() requestDto: CreateProductRequestDto) {
  // API DTO → Application Command
  const command = new CreateProductCommand();
  command.name = requestDto.name;
  command.code = requestDto.code;
  command.price = requestDto.price.toString();  // number → string

  return await this.handler.execute(command, userId);
}
```

#### **Application Layer → Domain Layer**

```typescript
// src/application/commands/product/create-product/create-product.handler.ts
async execute(command: CreateProductCommand, userId: string): Promise<Product> {
  // Application Command → Domain Value Objects
  const code = ProductCode.create(command.code);
  const price = Price.create(command.price, command.currency);

  // Domain Factory
  const product = Product.createDraft(
    uuidv4(),
    command.name,
    code,      // 值对象
    price,     // 值对象
    userId,
  );

  return await this.productRepository.save(product);
}
```

---

## 四、各层文件的实现指导

### 4.1 Domain 层实现指导

#### **4.1.1 Entities（实体）**

**文件**：`src/domains/catalog/product/entities/product.entity.ts`

**实现要点**：

1. **富领域模型**：
   - 实体包含数据 + 行为（业务方法）
   - 使用私有字段 + 公共 getter 保护状态
   - 所有状态变更通过实体方法完成

2. **封装业务规则**：
   - 规则封装在方法内（例如 `publish()` 检查状态和 items）
   - 外部无法绕过规则

3. **使用值对象**：
   - 价格字段：`private price: Price`（而非 `string`）
   - 状态字段：`private status: ProductStatus`（而非 `string`）
   - 产品编码：`private code: ProductCode`（而非 `string`）

4. **提供工厂方法**：
   - `static createDraft()`: 创建新草稿产品
   - 构造函数用于从数据库重建（Mapper 调用）

5. **关键业务方法**：
   - `publish()`: 发布产品（DRAFT → ACTIVE，检查必须有 item）
   - `unpublish()`: 下架产品（ACTIVE → INACTIVE）
   - `update()`: 更新产品信息（只允许 DRAFT 状态）
   - `addItem()`: 添加产品项（检查重复、检查状态）
   - `removeItem()`: 删除产品项（保留至少一个）

6. **抛出领域异常**：
   - 业务规则违反时抛出领域异常（例如 `ProductNotDraftException`）
   - 不抛出技术异常（`HttpException`, `DatabaseException`）

**设计原则**：
- **聚合根**：Product 是聚合根，控制 ProductItem 的修改
- **不变量保护**：通过实体方法强制执行业务规则
- **领域语言**：方法名反映业务概念（`publish` 而非 `updateStatus`）

#### **4.1.2 Value Objects（值对象）**

**文件**：`src/domains/catalog/product/value-objects/price.vo.ts`

**实现要点**：

1. **不可变性**：
   - 所有字段 `private readonly`
   - 构造函数私有（只能通过工厂方法创建）
   - 无 setter 方法

2. **自包含验证**：
   - 工厂方法内验证值的有效性
   - 例如：`Price.create(amount, currency)` 检查 amount > 0
   - 验证失败抛出异常

3. **值相等性**：
   - 实现 `equals(other: Price): boolean`
   - 比较所有字段值（金额 + 币种）

4. **业务方法**：
   - `getNumericAmount()`: 将字符串转为数字
   - `toString()`: 格式化显示（"CNY 100.00"）

**文件**：`src/domains/catalog/product/value-objects/product-status.vo.ts`

**实现要点**：

1. **状态机逻辑**：
   - `transitionToActive()`: DRAFT → ACTIVE（检查前置状态）
   - `transitionToInactive()`: ACTIVE → INACTIVE
   - 非法转换抛出异常

2. **状态查询**：
   - `isDraft()`: 检查是否草稿
   - `isActive()`: 检查是否激活

3. **不可变性**：
   - 转换返回新实例（而非修改当前实例）

#### **4.1.3 Repositories（仓储接口）**

**文件**：`src/domains/catalog/product/repositories/product.repository.interface.ts`

**实现要点**：

1. **定义接口，不实现**：
   - TypeScript `interface` 或 `abstract class`
   - 只有方法签名

2. **面向领域模型**：
   - 参数和返回值使用领域实体（`Product`, `ProductCode`）
   - 不使用数据库类型（Drizzle schema, SQL builder）

3. **核心方法**：
   ```typescript
   export interface IProductRepository {
     findById(id: string): Promise<Product | null>;
     findByCode(code: ProductCode): Promise<Product | null>;
     existsByCode(code: ProductCode): Promise<boolean>;
     save(product: Product): Promise<Product>;
     update(product: Product): Promise<Product>;
     search(criteria: ProductSearchCriteria): Promise<ProductSearchResult>;
     withTransaction<T>(fn: (repo: IProductRepository) => Promise<T>): Promise<T>;
   }
   ```

4. **导出 DI Token**：
   ```typescript
   export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
   ```

**文件**：`src/domains/catalog/product/repositories/product-search.criteria.ts`

**查询条件定义**：

```typescript
export interface ProductSearchCriteria {
  status?: string;
  nameContains?: string;
  codeContains?: string;
  page?: number;
  pageSize?: number;
}

export interface ProductSearchResult {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
}
```

**说明**：
- 这些不是 DTO，而是 Repository 接口的查询参数
- 放在 `repositories/` 目录下（作为接口的一部分）

#### **4.1.4 Services（领域服务）**

**文件**：`src/domains/catalog/product/services/product-lifecycle.service.ts`

**使用场景**：
- 跨多个实体的业务规则
- 不适合放在某个实体内的逻辑
- 例如：批量产品状态转换策略

**实现要点**：

1. **无状态**：
   - 不保存实例字段
   - 所有数据通过方法参数传入

2. **纯业务逻辑**：
   - 不访问数据库（数据由调用方传入）
   - 不处理事务（由 Application 层处理）

3. **方法签名使用领域对象**：
   ```typescript
   canBatchPublish(products: Product[]): boolean {
     return products.every(p => p.getStatus().isDraft());
   }
   ```

#### **4.1.5 Exceptions（领域异常）**

**文件**：`src/domains/catalog/product/exceptions/product-not-draft.exception.ts`

**实现要点**：

1. **定义基础异常类**：
   ```typescript
   export class DomainException extends Error {
     constructor(
       public readonly code: string,
       message: string,
       public readonly metadata?: Record<string, any>,
     ) {
       super(message);
     }
   }
   ```

2. **携带错误码**：
   - 每个异常有唯一 code（例如 `'PRODUCT_NOT_DRAFT'`）
   - 不是 HTTP 状态码

3. **常见异常**：
   - `ProductNotDraftException`: 产品不是草稿状态
   - `ProductMinItemsException`: 产品 item 数量不足
   - `InvalidProductCodeException`: 产品编码格式无效
   - `ProductCodeDuplicateException`: 产品编码重复

---

### 4.2 Infrastructure 层实现指导

#### **4.2.1 Repositories（仓储实现）**

**文件**：`src/domains/catalog/product/infrastructure/repositories/drizzle-product.repository.ts`

**实现要点**：

1. **实现领域接口**：
   ```typescript
   @Injectable()
   export class DrizzleProductRepository implements IProductRepository {
     constructor(
       @Inject(DATABASE_CONNECTION)
       private readonly db: NodePgDatabase<typeof schema>,
       private readonly mapper: ProductMapper,
     ) {}
   }
   ```

2. **注入依赖**：
   - 数据库连接（`DATABASE_CONNECTION`）
   - 数据映射器（`ProductMapper`）

3. **实现查询方法**：
   ```typescript
   async findById(id: string): Promise<Product | null> {
     const [record] = await this.db
       .select()
       .from(schema.products)
       .where(eq(schema.products.id, id));

     if (!record) return null;

     const items = await this.db
       .select()
       .from(schema.productItems)
       .where(eq(schema.productItems.productId, id));

     return this.mapper.toDomain(record, items);
   }
   ```

4. **实现保存方法**：
   ```typescript
   async save(product: Product): Promise<Product> {
     return await this.db.transaction(async (tx) => {
       const data = this.mapper.toPersistence(product);

       await tx.insert(schema.products).values(data.product);
       if (data.items.length > 0) {
         await tx.insert(schema.productItems).values(data.items);
       }

       return product;
     });
   }
   ```

5. **实现事务支持**：
   ```typescript
   async withTransaction<T>(
     fn: (repo: IProductRepository) => Promise<T>
   ): Promise<T> {
     return await this.db.transaction(async (tx) => {
       const txRepo = new DrizzleProductRepository(tx as any, this.mapper);
       return await fn(txRepo);
     });
   }
   ```

6. **性能优化**：
   - 批量加载子实体（避免 N+1 查询）
   - 合理使用索引
   - 查询条件优化

#### **4.2.2 Mappers（数据映射器）**

**文件**：`src/domains/catalog/product/infrastructure/mappers/product.mapper.ts`

**实现要点**：

1. **双向映射**：
   - `toDomain()`: DB 记录 → 领域实体
   - `toPersistence()`: 领域实体 → DB 记录

2. **toDomain() 实现**：
   ```typescript
   toDomain(
     record: typeof schema.products.$inferSelect,
     itemRecords: typeof schema.productItems.$inferSelect[],
   ): Product {
     return new Product(
       record.id,
       record.name,
       ProductCode.create(record.code),
       Price.create(record.price, record.currency),
       ProductStatus.fromString(record.status),
       itemRecords.map(item => this.itemToDomain(item)),
       record.createdAt,
       record.createdBy,
       record.publishedAt,
     );
   }
   ```

3. **toPersistence() 实现**：
   ```typescript
   toPersistence(product: Product): {
     product: typeof schema.products.$inferInsert;
     items: typeof schema.productItems.$inferInsert[];
   } {
     return {
       product: {
         id: product.getId(),
         name: product.getName(),
         code: product.getCode().getValue(),
         price: product.getPrice().getAmount(),
         currency: product.getPrice().getCurrency(),
         status: product.getStatus().getValue(),
         // ...
       },
       items: product.getItems().map(item => this.itemToPersistence(item)),
     };
   }
   ```

4. **类型安全**：
   - 使用 Drizzle 的类型推断
   - 确保映射正确性

---

### 4.3 Application 层实现指导

#### **4.3.1 Command Handler（命令处理器）**

**文件**：`src/application/commands/product/create-product/create-product.handler.ts`

**实现要点**：

1. **依赖注入仓储接口**：
   ```typescript
   @Injectable()
   export class CreateProductHandler {
     constructor(
       @Inject(PRODUCT_REPOSITORY)
       private readonly productRepository: IProductRepository,
     ) {}
   }
   ```

2. **执行流程**：
   ```typescript
   async execute(command: CreateProductCommand, userId: string): Promise<Product> {
     // 1. 转换为值对象
     const code = ProductCode.create(command.code);
     const price = Price.create(command.price, command.currency);

     // 2. 检查业务前置条件
     const exists = await this.productRepository.existsByCode(code);
     if (exists) {
       throw new ProductCodeDuplicateException(code.getValue());
     }

     // 3. 创建领域实体
     const product = Product.createDraft(
       uuidv4(),
       command.name,
       code,
       price,
       userId,
       command.description,
     );

     // 4. 持久化
     return await this.productRepository.save(product);
   }
   ```

3. **事务管理**：
   ```typescript
   async execute(command: PublishProductCommand): Promise<Product> {
     return await this.productRepository.withTransaction(async (txRepo) => {
       const product = await txRepo.findById(command.id);
       if (!product) {
         throw new ProductNotFoundException(command.id);
       }

       product.publish();  // 业务规则在实体内
       return await txRepo.update(product);
     });
   }
   ```

#### **4.3.2 Query Handler（查询处理器）**

**文件**：`src/application/queries/product/get-product/get-product.handler.ts`

**实现要点**：

1. **只读操作**：
   ```typescript
   @Injectable()
   export class GetProductHandler {
     constructor(
       @Inject(PRODUCT_REPOSITORY)
       private readonly productRepository: IProductRepository,
     ) {}

     async execute(query: GetProductQuery): Promise<Product | null> {
       return await this.productRepository.findById(query.id);
     }
   }
   ```

2. **不开启事务**（除非需要一致性快照）

3. **性能优化**：
   - 仓储实现可以使用优化的查询
   - 可以返回部分字段（投影）

---

### 4.4 Module 配置（依赖注入）

#### **Product Module**

**文件**：`src/domains/catalog/product/product.module.ts`

```typescript
@Module({
  imports: [DatabaseModule],
  providers: [
    // Infrastructure
    ProductMapper,
    {
      provide: PRODUCT_REPOSITORY,
      useClass: DrizzleProductRepository,
    },

    // Domain Services（如有）
    ProductLifecycleService,
  ],
  exports: [
    PRODUCT_REPOSITORY,
    ProductLifecycleService,
  ],
})
export class ProductModule {}
```

#### **Application Module**

**文件**：`src/application/application.module.ts`

```typescript
@Module({
  imports: [
    CatalogModule,  // 导入所有 Catalog 子域
  ],
  providers: [
    // Product Commands
    CreateProductHandler,
    PublishProductHandler,

    // Contract Commands
    CreateContractHandler,

    // Cross-domain Commands
    BookSessionHandler,
  ],
  exports: [/* ... */],
})
export class ApplicationModule {}
```

---

## 五、如何编写无数据库连接的测试用例

### 5.1 Domain 层单元测试（完全无数据库）

#### **测试实体业务逻辑**

**文件**：`src/domains/catalog/product/entities/__tests__/product.entity.spec.ts`

**测试策略**：

1. **直接实例化实体**：
   - 使用工厂方法创建实体
   - 不需要数据库、仓储

2. **测试业务方法**：
   ```typescript
   describe('Product Entity', () => {
     describe('publish', () => {
       it('应该成功发布有 item 的草稿产品', () => {
         const product = Product.createDraft(/* ... */);
         const item = new ProductItem(/* ... */);
         product.addItem(item);

         product.publish();

         expect(product.getStatus().isActive()).toBe(true);
         expect(product.getPublishedAt()).toBeDefined();
       });

       it('应该拒绝发布没有 item 的产品', () => {
         const product = Product.createDraft(/* ... */);

         expect(() => product.publish())
           .toThrow(ProductMinItemsException);
       });

       it('应该拒绝发布非草稿状态的产品', () => {
         const product = Product.createDraft(/* ... */);
         product.addItem(new ProductItem(/* ... */));
         product.publish();  // 已经是 ACTIVE

         expect(() => product.publish())
           .toThrow(ProductNotDraftException);
       });
     });
   });
   ```

3. **无需 Mock**：
   - 实体不依赖外部服务

#### **测试值对象**

**文件**：`src/domains/catalog/product/value-objects/__tests__/price.vo.spec.ts`

```typescript
describe('Price Value Object', () => {
  describe('create', () => {
    it('应该创建有效价格', () => {
      const price = Price.create('100.00', Currency.CNY);

      expect(price.getAmount()).toBe('100.00');
      expect(price.getCurrency()).toBe(Currency.CNY);
    });

    it('应该拒绝负数价格', () => {
      expect(() => Price.create('-10', Currency.CNY))
        .toThrow('Invalid price');
    });
  });

  describe('equals', () => {
    it('相同金额和币种应该相等', () => {
      const price1 = Price.create('100', Currency.CNY);
      const price2 = Price.create('100', Currency.CNY);

      expect(price1.equals(price2)).toBe(true);
    });
  });
});
```

---

### 5.2 Application 层集成测试（Mock 仓储）

#### **测试 Command Handler**

**文件**：`src/application/commands/product/create-product/__tests__/create-product.handler.spec.ts`

**测试策略**：

1. **Mock 仓储接口**：
   ```typescript
   const mockProductRepository: jest.Mocked<IProductRepository> = {
     findById: jest.fn(),
     findByCode: jest.fn(),
     existsByCode: jest.fn(),
     save: jest.fn(),
     update: jest.fn(),
     search: jest.fn(),
     withTransaction: jest.fn(),
   };
   ```

2. **创建处理器实例**：
   ```typescript
   const handler = new CreateProductHandler(mockProductRepository);
   ```

3. **测试用例**：
   ```typescript
   describe('CreateProductHandler', () => {
     beforeEach(() => {
       jest.clearAllMocks();
     });

     it('应该成功创建产品', async () => {
       // Arrange
       mockProductRepository.existsByCode.mockResolvedValue(false);
       mockProductRepository.save.mockImplementation(async (product) => product);

       const command = {
         name: 'Test Product',
         code: 'TEST-001',
         price: '100.00',
         currency: Currency.CNY,
       };

       // Act
       const result = await handler.execute(command, 'user-123');

       // Assert
       expect(result.getName()).toBe('Test Product');
       expect(mockProductRepository.existsByCode).toHaveBeenCalledTimes(1);
       expect(mockProductRepository.save).toHaveBeenCalledTimes(1);
     });

     it('应该拒绝重复的产品编码', async () => {
       mockProductRepository.existsByCode.mockResolvedValue(true);

       const command = { /* ... */ };

       await expect(handler.execute(command, 'user-123'))
         .rejects
         .toThrow(ProductCodeDuplicateException);

       expect(mockProductRepository.save).not.toHaveBeenCalled();
     });
   });
   ```

---

### 5.3 Infrastructure 层集成测试（可选用真实数据库）

#### **测试 Mapper**

**文件**：`src/domains/catalog/product/infrastructure/mappers/__tests__/product.mapper.spec.ts`

```typescript
describe('ProductMapper', () => {
  let mapper: ProductMapper;

  beforeEach(() => {
    mapper = new ProductMapper();
  });

  describe('toDomain', () => {
    it('应该将数据库记录转换为领域实体', () => {
      const dbRecord = {
        id: 'product-123',
        name: 'Test Product',
        code: 'TEST-001',
        price: '100.00',
        currency: 'CNY',
        status: 'DRAFT',
        createdAt: new Date(),
        createdBy: 'user-123',
      };

      const entity = mapper.toDomain(dbRecord, []);

      expect(entity.getId()).toBe('product-123');
      expect(entity.getName()).toBe('Test Product');
      expect(entity.getPrice().getAmount()).toBe('100.00');
      expect(entity.getStatus().isDraft()).toBe(true);
    });
  });

  describe('toPersistence', () => {
    it('应该将领域实体转换为数据库记录', () => {
      const entity = Product.createDraft(/* ... */);

      const dbData = mapper.toPersistence(entity);

      expect(dbData.product.id).toBe(entity.getId());
      expect(dbData.product.name).toBe(entity.getName());
      expect(dbData.product.status).toBe('DRAFT');
    });
  });
});
```

---

### 5.4 测试金字塔与策略总结

#### **测试分层**：

```
               E2E Tests (10%)
              /               \
             /                 \
        Integration Tests (20%)
           /                     \
          /                       \
     Unit Tests (70%)
```

**测试数量分布**：
- **单元测试（70%）**：领域层（实体、值对象、领域服务）
- **集成测试（20%）**：应用层（命令/查询处理器）+ Mock 仓储
- **E2E 测试（10%）**：API 层端到端流程（需要真实数据库）

**速度对比**：
- Domain 单元测试：**毫秒级**
- Application 集成测试：**秒级**
- E2E 测试：**分钟级**

**收益**：
- TDD 友好（先写测试，再实现）
- CI/CD 快速反馈（70% 测试秒级完成）
- 测试覆盖率提升（容易写测试 → 测试更多）

---

## 六、为什么这是最优解决方案

### 6.1 解决依赖倒置问题（核心价值）

**当前问题**：
```
❌ Domain → Infrastructure（错误方向）
```

**新架构**：
```
✅ Domain 定义接口 ← Infrastructure 实现接口
```

**收益**：
- Domain 可以独立测试（Mock 接口）
- 可以替换 ORM（Drizzle → Prisma）只需改一处
- 技术债务可控（技术选型错误只影响 Infrastructure）

---

### 6.2 业务逻辑高内聚（质量提升）

**当前问题**：
- 业务规则分散在 Service 的 SQL 查询中
- 容易遗漏规则
- 重复代码多

**新架构**：
- 规则集中在实体方法（`product.publish()`）
- 无法绕过规则
- 一次定义，全局生效

**示例对比**：

**❌ 当前（分散）**：
```typescript
// ProductService.publish()
if (product.status !== 'DRAFT') throw error;
if (product.items.length === 0) throw error;
await db.update(...);

// 其他地方可能忘记检查
```

**✅ 新架构（集中）**：
```typescript
// Product.publish()
publish() {
  if (!this.status.isDraft()) throw error;
  if (this.items.length === 0) throw error;
  this.status = this.status.transitionToActive();
}

// 所有调用都经过这个方法，规则自动执行
```

---

### 6.3 可测试性提升（效率提升）

**速度对比**：
- Domain 单元测试：**毫秒级**（无数据库）
- Application 集成测试：**秒级**（Mock 仓储）
- E2E 测试：**分钟级**（真实数据库）

**收益**：
- 测试速度提升 **100 倍**
- TDD 友好（先写测试，再实现）
- CI/CD 快速反馈

---

### 6.4 技术灵活性（未来演进）

**替换 ORM**：
```typescript
// 旧绑定
{
  provide: PRODUCT_REPOSITORY,
  useClass: DrizzleProductRepository,
}

// 新绑定（只改这里）
{
  provide: PRODUCT_REPOSITORY,
  useClass: PrismaProductRepository,
}
```

**添加缓存层**：
```typescript
export class CachedProductRepository implements IProductRepository {
  constructor(
    private readonly cache: CacheService,
    private readonly delegate: DrizzleProductRepository,
  ) {}

  async findById(id: string): Promise<Product | null> {
    const cached = await this.cache.get(`product:${id}`);
    if (cached) return cached;

    const product = await this.delegate.findById(id);
    await this.cache.set(`product:${id}`, product);
    return product;
  }
}
```

---

### 6.5 团队协作效率（组织层面）

**清晰的职责分离**：

1. **业务专家 + 领域建模者**：
   - 专注于 Domain 层（实体、值对象、业务规则）
   - 不需要了解数据库技术
   - 通过单元测试快速验证业务逻辑

2. **应用架构师**：
   - 专注于 Application 层（用例编排、事务管理）
   - 定义用例接口
   - 协调多个领域模块

3. **基础设施工程师**：
   - 专注于 Infrastructure 层（数据库优化、性能调优）
   - 实现仓储接口
   - 不影响业务逻辑

**并行开发流程**：

1. **阶段一：定义接口**（半天）
   - 团队讨论确定 `IProductRepository` 接口
   - 确定实体结构和业务方法

2. **阶段二：并行开发**（可同时进行）
   - **Team A**：实现领域层（实体 + 值对象）+ 单元测试
   - **Team B**：实现应用层（Handler）+ Mock 仓储测试
   - **Team C**：实现基础设施层（仓储 + Mapper）
   - **Team D**：实现 API 层（Controller）

3. **阶段三：集成**（半天）
   - 通过 DI 容器组装各层
   - 运行集成测试和 E2E 测试

---

### 6.6 投入产出比（商业价值）

**重构成本**：
- Product 领域：2-3 天
- ServiceType 领域：1 天
- **总计：1 周**

**长期收益**：
- 测试速度提升：**100 倍**（毫秒 vs 秒）
- 并行开发能力：**3-4 个 stream**
- Bug 减少：**30%**（规则强制执行）
- 新人上手：**快 30%**（架构清晰）

**ROI**：
- 投入：1 周
- 每月节省：1-2 天
- **回本周期：< 2 个月**

---

## 七、迁移策略（渐进式重构）

### Phase 1：Product 领域 Pilot（1 周）

1. **创建新结构**（与旧代码共存）：
   ```
   product/
   ├── entities/              # 新增
   ├── value-objects/         # 新增
   ├── repositories/          # 新增（接口）
   ├── infrastructure/        # 新增（实现）
   └── services/              # 保留旧 ProductService（暂时）
   ```

2. **实现新组件**：
   - Product 实体
   - Price, ProductCode, ProductStatus 值对象
   - IProductRepository 接口
   - DrizzleProductRepository 实现
   - ProductMapper

3. **更新一个 Command**：
   - 修改 `CreateProductHandler` 使用新仓储
   - 测试通过

4. **逐步迁移其他 Command**：
   - PublishProductHandler
   - AddProductItemHandler
   - ...

5. **删除旧代码**：
   - 所有 Command 迁移完成后删除 `ProductService`

### Phase 2：其他领域（2-3 周）

- ServiceType（简单）
- Contract（复杂）
- Services（复杂）

### Phase 3：清理（1 周）

- 删除所有旧 Service
- 统一架构规范
- 添加 Lint 规则防止回退

---

## 八、总结

### 核心设计原则

1. **依赖倒置**：Domain 定义接口，Infrastructure 实现
2. **分层清晰**：Domain / Application / Infrastructure 职责明确
3. **领域对象优先**：Domain 层使用 Entity/Value Object，不用 DTO
4. **Application 层统一**：在 `src/application/`，负责单领域 + 跨领域编排
5. **Infrastructure 隔离**：唯一嵌套子目录，明确区分实现

### 最终目录结构概览

```
src/
├── api/                    # HTTP Controllers
│   └── dto/                # API Request/Response DTO
│
├── application/            # 应用层（用例编排）
│   ├── commands/
│   │   ├── product/        # Product 单领域
│   │   ├── contract/       # Contract 单领域
│   │   └── booking/        # 跨领域（预约）
│   └── queries/
│
└── domains/                # 领域层
    └── catalog/
        └── product/
            ├── entities/           # 领域实体
            ├── value-objects/      # 值对象
            ├── repositories/       # 接口 + 查询条件
            ├── services/           # 领域服务
            ├── exceptions/         # 领域异常
            └── infrastructure/     # 基础设施实现
                ├── repositories/   # Drizzle 实现
                └── mappers/        # 数据映射器
```

### 关键收益

- ✅ 解决依赖倒置问题
- ✅ 业务逻辑高内聚
- ✅ 可测试性提升 100 倍
- ✅ Domain 层使用领域对象（无 DTO）
- ✅ 清晰的 DTO 使用边界
- ✅ 与现有结构一致
- ✅ 渐进式迁移（低风险）

---

**文档版本**：v3.2（更新版）
**更新日期**：2025-12-19
**主要变更**：
- 移除所有版本比较说明
- 加入 DTO 使用指南和数据流转说明
- 明确 Domain 层不需要 DTO 目录
- 简化文档结构，更加直接实用
- 添加了 event-handler 目录设计
- 明确要求所有事件定义必须统一放置到 shared 目录中
- 规定 domain 目录仅负责实现事件处理器，不应包含事件定义代码
- 更新了目录结构示例，清晰展示了 shared 目录和 domain 目录的职责划分
