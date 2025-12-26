# NestJS + Drizzle + DDD (CQRS) 架构设计规范 V6.0

本文档描述了基于 NestJS、Drizzle ORM 和 DDD（领域驱动设计）原则的推荐项目架构。本架构核心采用了 **CQRS（命令查询职责分离）** 模式，旨在解决读写逻辑耦合问题，并明确基础设施层的定位。

## 1. 核心设计原则

1.  **DDD (领域驱动设计)**: 核心业务逻辑（Domain）必须独立于框架、数据库和外部服务。
2.  **CQRS (读写分离)**:
    *   **命令 (Command)**: 处理复杂的业务状态变更。路径：`Controller -> Command Handler -> Domain Service -> Repository Interface`。
    *   **查询 (Query)**: 处理高效的数据展示。路径：`Controller -> Query Handler -> Drizzle (Infrastructure)`。**查询操作绕过 Domain Entity，直接返回 DTO**。
3.  **依赖倒置 (DIP)**:
    *   **Domain 层** 只定义接口（Interface）。
    *   **Infrastructure 层** 实现接口（Implementation）。
    *   依赖方向永远指向内层（Infrastructure -> Domain）。

---

## 2. 标准目录结构

```text
src/
├── api/                                  # [接口层] HTTP 接入点
│   ├── controllers/                      # 控制器 (路由定义)
│   │   ├── contract/
│   │   ├── placement/
│   │   └── ...
│   ├── dto/                              # 数据传输对象 (输入/输出定义)
│   │   ├── request/                      # Request DTO (带 class-validator 校验)
│   │   └── response/                     # Response DTO (统一返回结构)
│   ├── transformers/                     # 转换器 (Domain Entity -> Response DTO)
│   └── api.module.ts
│
├── application/                          # [应用层] 用例编排 (读写彻底分离)
│   ├── commands/                         # 【写操作】(CUD) - 改变系统状态
│   │   ├── contract/                     # 按模块划分
│   │   │   ├── create-contract.command.ts
│   │   │   └── create-contract.handler.ts
│   │   ├── placement/
│   │   └── ...
│   ├── queries/                          # 【读操作】(R) - 获取数据 (原 domain/query 迁移至此)
│   │   ├── contract/
│   │   │   ├── dto/                      # 查询专用参数 DTO
│   │   │   ├── contract-list.query.ts    # 列表查询 (直接注入 Drizzle)
│   │   │   └── contract-detail.query.ts  # 详情查询
│   │   ├── placement/
│   │   │   └── query-jobs.query.ts       # 岗位搜索
│   │   └── mentor/
│   │       └── mentor-list.query.ts
│   ├── events/                           # 应用层事件处理
│   │   ├── definitions/                  # 事件类定义
│   │   └── handlers/                     # 事件监听器 (处理副作用，如发邮件)
│   └── application.module.ts
│
├── domains/                              # [领域层] 纯净业务规则 (无 Drizzle/SQL 依赖)
│   ├── contract/
│   │   ├── models/                       # 领域实体 (Entity) 与 值对象 (VO)
│   │   │   ├── contract.entity.ts
│   │   │   └── contract-status.vo.ts
│   │   ├── services/                     # 领域服务 (Domain Services)
│   │   │   └── contract-policy.service.ts
│   │   ├── interfaces/                   # ★ 核心：仓储接口定义 (Repository Interfaces)
│   │   │   └── i-contract.repository.ts  # 定义 save, findById 等方法签名
│   │   ├── events/                       # 领域事件定义
│   │   └── exceptions/                   # 领域特定异常
│   ├── placement/
│   └── ... (注意：此处不再包含 query 目录)
│
├── infrastructure/                       # [基础设施层] 技术落地实现
│   ├── database/                         # 数据库配置与定义
│   │   ├── schema/                       # Drizzle Schema (Table 定义)
│   │   │   ├── contracts.schema.ts
│   │   │   └── ...
│   │   ├── migrations/                   # SQL 迁移文件
│   │   └── database.provider.ts          # 数据库连接注入
│   ├── repositories/                     # ★ 核心：领域接口的具体实现
│   │   ├── contract.drizzle.repository.ts # 实现 IContractRepository
│   │   └── user.drizzle.repository.ts
│   ├── external/                         # 第三方服务适配器
│   │   ├── email/
│   │   └── payment/
│   └── infrastructure.module.ts          # 导出 Repositories 实现
│
├── shared/                               # [共享内核]
│   ├── constants/
│   ├── decorators/
│   ├── types/
│   └── utils/
│
├── app.module.ts                         # 根模块 (组装 Layers)
└── main.ts                               # 入口文件
```

---

## 3. 层级职责详解

### 3.1 API 层 (`src/api`)
*   **职责**: 处理 HTTP 请求/响应，参数验证，异常捕获。
*   **规则**: 不包含业务逻辑。仅负责将 DTO 传递给 Application 层。

### 3.2 Application 层 (`src/application`)
*   **Commands (写)**:
    *   接收 Command 对象。
    *   开启数据库事务（如有必要）。
    *   调用 Domain Service 或 Entity 进行业务操作。
    *   调用 `Repository Interface` 保存数据。
*   **Queries (读)**:
    *   **直接注入 `DATABASE_CONNECTION` (Drizzle)**。
    *   编写 SQL 或 Query Builder 逻辑。
    *   直接返回 ViewModel/DTO，**不**经过 Domain Entity 转换，以确保高性能。

### 3.3 Domain 层 (`src/domains`)
*   **职责**: 表达业务规则。是软件的核心资产。
*   **规则**:
    *   **零依赖**: 不能引用 `infrastructure`、`application` 或 `api`。
    *   **接口化**: 需要持久化数据时，只定义 `Interface` (如 `IContractRepository`)。

### 3.4 Infrastructure 层 (`src/infrastructure`)
*   **职责**: 提供技术支持。
*   **实现**:
    *   实现 Domain 层定义的 `Repository Interface`。
    *   包含 Drizzle Schema 定义。
    *   包含具体的第三方 API 调用代码。

---

## 4. 关键代码模式示例

### 4.1 领域层定义接口 (Domain Interface)
文件: `src/domains/contract/interfaces/i-contract.repository.ts`

```typescript
import { Contract } from '../models/contract.entity';

export interface IContractRepository {
  save(contract: Contract): Promise<void>;
  findById(id: string): Promise<Contract | null>;
}

// 定义 Injection Token
export const CONTRACT_REPOSITORY = Symbol('CONTRACT_REPOSITORY');
```

### 4.2 基础设施层实现接口 (Infrastructure Implementation)
文件: `src/infrastructure/repositories/contract.drizzle.repository.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { IContractRepository } from '@domains/contract/interfaces/i-contract.repository';
import { DATABASE_CONNECTION } from '../database/database.provider';
import { DrizzleDatabase } from '@shared/types/database.types';
import { contracts } from '../database/schema';

@Injectable()
export class ContractDrizzleRepository implements IContractRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DrizzleDatabase) {}

  async save(contract: Contract): Promise<void> {
    // 将 Domain Entity 映射为 DB Schema 并保存
    const persistenceModel = ContractMapper.toPersistence(contract);
    await this.db.insert(contracts).values(persistenceModel)...
  }
}
```

### 4.3 应用层查询 (Application Query) - **无需 Repository**
文件: `src/application/queries/contract/contract-list.query.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { DrizzleDatabase } from '@shared/types/database.types';
import { contracts } from '@infrastructure/database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class ContractListQuery {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DrizzleDatabase) {}

  async execute(studentId: string) {
    // 直接查询数据库，高效返回 DTO
    return this.db.query.contracts.findMany({
      where: eq(contracts.studentId, studentId),
      with: {
        productSnapshot: true
      }
    });
  }
}
```

---

## 5. 迁移路径建议

1.  **移动 Query**: 将 `src/domains/query/services/*` 下的所有逻辑移动到 `src/application/queries/*` 对应的模块中。
2.  **删除冗余**: 确认移动无误后，删除 `src/domains/query` 目录。
3.  **标准化 Repo**: 检查 `src/domains/*/interfaces` 是否存在 Repository 接口，并在 `src/infrastructure/repositories` 中实现它们。
4.  **修正引用**: 更新 `app.module.ts` 和各模块的 `imports`，确保 Application 层直接引用 Drizzle 做查询，Command Handler 使用 Repository Interface 做写入。
