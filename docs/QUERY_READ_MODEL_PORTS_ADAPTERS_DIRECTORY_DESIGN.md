# Query / Read Model 目录结构设计（Ports & Adapters）

**文档状态**：Proposal（设计稿）  
**适用范围**：NestJS + Drizzle ORM + Supabase(PostgreSQL) + DDD（分层/依赖倒置）  
**目标读者**：后端架构/模块负责人/核心开发  

---

## 1. 背景与问题

当前项目同时存在两套“读侧（Query）”实现：

- `src/application/queries/**`：更偏“查询用例编排”（Application Layer orchestration）
- `src/domains/query/**`：跨域 JOIN + Read Model 构建，且直接依赖 `@infrastructure/database/*`、Drizzle schema、`DATABASE_CONNECTION`

现状带来的主要问题：

1. **DDD 语义偏差**：`domains/query` 内大量 DB/ORM 细节，使“领域层依赖基础设施”，不符合典型分层/依赖倒置预期。
2. **边界不清**：同名 Query 概念在 Application 与 Domain 同时存在，团队容易困惑“查询应放哪层/谁负责 DTO/谁负责 SQL join”。
3. **与既有模块化原则不一致**：当前 `domains/services/**` 已采用“接口在内层（ports/repositories），实现放模块内/外的 infrastructure”的依赖倒置结构；但 `domains/query` 更像“直接实现层”。

> 说明：已有文档 `docs/QUERY_MODULE_REFACTORING.md` 主要解决 “在 `domains/query` 内补齐接口层” 的问题；本文进一步提出 **更贴合 DDD 语义的方案：将读模型（Read Model）从 `domains` 迁出**，并用 Ports & Adapters 统一读侧结构。

---

## 2. 核心结论（设计决策）

### 2.1 Query 的职责归属

**Read Model（查库、跨域 join、projection、分页排序、性能优化）更适合归属 Application/Infrastructure，而不是 Domain。**

- Application：定义“读用例/对外查询能力”的契约（ports）+ 编排（orchestrator）+ DTO/权限裁剪
- Infrastructure：实现 ports（Drizzle 查询 + join + projection）
- Domain：保留业务规则与写侧仓储接口；如有“纯规则计算（不查库）”，可在 Domain 以 rules/specification 形式存在

### 2.2 目录结构策略

采用 **“Application 定义 Query Ports，Infrastructure 按模块实现 Adapters，Database/schema 仍集中管理”** 的结构：

- `application/read-model/ports/**`：读侧接口（Port）
- `infrastructure/modules/<module>/read-model/**`：读侧实现（Adapter）
- `infrastructure/database/**`：连接/事务/schema/migrations 等共享 DB 能力（不仅仅是 schema）

---

## 3. 目标目录结构（详细版）

> 以下为“推荐结构”。命名可微调，但建议保持语义一致：**ports 在 application，adapters 在 infrastructure**。

```
src/
  api/
    controllers/
      ...
    dto/
      request/
      response/
    transformers/

  application/
    commands/
      ...

    queries/                                # Application Query Orchestration（保留/逐步收敛）
      calendar/
      contract/
      counselor/
      financial/
      major/
      mentor/
      placement/
      preference/
      product/
      school/
      services/
      student/
      user-query.service.ts

    read-model/                             # 新增：读模型“契约层”
      ports/                                # ✅ Port：查询能力抽象（不含 Drizzle/schema）
        comm-session.read-model.port.ts
        class.read-model.port.ts
        placement.read-model.port.ts
        student.read-model.port.ts
        mentor.read-model.port.ts
        counselor.read-model.port.ts
        school.read-model.port.ts
        major.read-model.port.ts
        index.ts

      dto/                                  # 可选：复用型 Read DTO（不放领域实体）
        comm-session.read.dto.ts
        class.read.dto.ts
        placement.read.dto.ts
        index.ts

      tokens/                               # 可选：Nest DI Token（Symbol/const）
        comm-session.tokens.ts
        class.tokens.ts
        placement.tokens.ts
        index.ts

      read-model.module.ts                  # 可选：聚合 ports 定义（一般仅导出 tokens/types）

  domains/
    identity/
      ...
    contract/
      ...
    financial/
      ...
    placement/
      ...
    services/
      ...
    preference/
      ...
    # ✅ Domain 不再承载“查库的 query/read-model”
    # ✅ 允许保留：纯业务规则 rules/specification（不依赖 DB/ORM）

  infrastructure/
    database/
      database.module.ts
      database.provider.ts
      schema/                               # Drizzle schema definitions（集中管理）
      migrations/
      utils/

    modules/                                # ✅ 按业务模块切片的基础设施实现
      comm-sessions/
        read-model/
          drizzle-comm-session.read-model.ts
          comm-sessions-read-model.module.ts

      class/
        read-model/
          drizzle-class.read-model.ts
          class-read-model.module.ts

      placement/
        read-model/
          drizzle-placement.read-model.ts
          placement-read-model.module.ts

      identity/
        read-model/
          drizzle-student.read-model.ts
          drizzle-mentor.read-model.ts
          identity-read-model.module.ts

      contract/
        read-model/
          drizzle-contract.read-model.ts
          contract-read-model.module.ts

    read-model/                             # 可选：统一聚合（导出各模块 read-model module）
      read-model.module.ts

  shared/
    query-builder/
    types/
    utils/
```

---

## 4. 分层职责与依赖规则（强约束）

### 4.1 层级职责

- **API Layer**
  - 接收请求、参数校验、DTO 映射
  - 仅依赖 `application/**`

- **Application Layer**
  - Commands：写用例编排（事务/跨域协调）
  - Queries：读用例编排（权限裁剪、组合多个 read-model port、输出 DTO）
  - Read-model ports：定义“读能力接口”

- **Domain Layer**
  - 业务规则、实体/值对象、领域服务、仓储接口（写侧）
  - 不直接依赖 Drizzle/schema/DB connection

- **Infrastructure Layer**
  - 实现 domain/application 定义的接口（repositories / read-model ports）
  - 组织 DB/ORM/第三方 SDK 细节

### 4.2 依赖方向（必须）

```
api  →  application  →  (domain interfaces / application ports)
                              ↑
                       infrastructure (implements)
```

### 4.3 具体禁止项（建议写入架构守则/检查项）

- `src/domains/**` 禁止 import：
  - `src/infrastructure/**`
  - `drizzle-orm`
  - `@infrastructure/database/**`
  - `DATABASE_CONNECTION`
- `src/application/read-model/ports/**` 禁止 import：
  - `drizzle-orm`、schema、DB connection（保持纯接口）
- `src/infrastructure/modules/**/read-model/**` 允许 import：
  - `@infrastructure/database/**`、`@infrastructure/database/schema/**`、`drizzle-orm`

---

## 5. Port/Adapter 命名与注入规范（建议统一）

### 5.1 Port 命名

- `XxxReadModelPort`（推荐）或 `IXxxQueryService`
- 文件建议：`<module>.read-model.port.ts`

### 5.2 Adapter 命名

- `DrizzleXxxReadModel` / `DrizzleXxxReadModelAdapter`
- 文件建议：`drizzle-<module>.read-model.ts`

### 5.3 Nest DI Token（建议全部使用 token 注入，而非直接注入具体类）

- Token 放在 `application/read-model/tokens/**`
- Adapter 在模块内 `providers: [{ provide: XXX_TOKEN, useClass: Drizzle... }]`
- Application Query Orchestrator 只注入 Token 对应的 Port

> 这样即使未来替换 Drizzle/拆表/引入缓存，也不会影响 Application 层调用方。

---

## 6. 现有代码映射（从当前结构迁移到目标结构）

> 本节仅给“路径映射”，不要求一次性迁移；建议按模块逐步替换。

### 6.1 当前 Query 实现（示例）

- `src/domains/query/services/comm-session-query.service.ts`
  - → `src/infrastructure/modules/comm-sessions/read-model/drizzle-comm-session.read-model.ts`
  - 对应 Port：`src/application/read-model/ports/comm-session.read-model.port.ts`

- `src/domains/query/services/class-query.service.ts`
  - → `src/infrastructure/modules/class/read-model/drizzle-class.read-model.ts`
  - 对应 Port：`src/application/read-model/ports/class.read-model.port.ts`

- `src/domains/query/placement/placement-query.service.ts`
  - → `src/infrastructure/modules/placement/read-model/drizzle-placement.read-model.ts`
  - 对应 Port：`src/application/read-model/ports/placement.read-model.port.ts`

### 6.2 Application 查询编排保留位置

- `src/application/queries/services/comm-session.query.service.ts`
  - 继续作为“编排者”，依赖 `CommSessionReadModelPort`

- `src/application/queries/services/class.query.service.ts`
  - 继续作为“编排者”，依赖 `ClassReadModelPort` 以及必要的 domain repository（若需要权限/聚合一致性）

---

## 7. Nest Module 装配建议（两种可选）

### 7.1 方案 A：按模块 ReadModelModule（推荐）

每个模块提供自己的 `...-read-model.module.ts`：

- `CommSessionsReadModelModule`：提供 comm-sessions 的 read-model adapter
- `ClassReadModelModule`：提供 class 的 read-model adapter
- …

Application 的 Query Orchestrator 所在 Module 按需 import 对应模块的 ReadModelModule。

优点：依赖清晰、按模块加载、可渐进迁移。  

### 7.2 方案 B：全局聚合 ReadModelModule（适合中小项目）

在 `src/infrastructure/read-model/read-model.module.ts` 统一 import/exports 各模块 ReadModelModule。

优点：装配简单；缺点：全量加载、边界容易变松。  

---

## 8. 渐进迁移计划（不破坏现有功能）

1. **定义 ports（不改 SQL 逻辑）**
   - 在 `application/read-model/ports/**` 抽象出当前查询能力（按模块分文件）
2. **为单个模块落地 adapter**
   - 例如先迁移 comm-sessions：把现有 Drizzle 查询逻辑移动到 `infrastructure/modules/comm-sessions/read-model/**`
3. **Application 查询编排改为依赖 ports**
4. **逐模块迁移完成后**
   - 删除/弃用 `src/domains/query`（或保留 deprecated 一段时间）

---

## 9. FAQ（常见疑问）

### Q1：为什么不把 ports 放在 Domain？

因为多数 Query 的返回是 Read Model/DTO，包含跨聚合 join、权限裁剪、排序分页等“用例视角”的需求；把它们放在 Domain 容易让 Domain 被 API/展示需求污染。Domain 更适合承载“业务规则与写模型接口”。

### Q2：最外层 Infrastructure 是否只保留 schema？

不建议。`database.module/provider/transaction/migrations/schema` 通常属于共享基础设施，应集中维护；读模型 adapter 则按模块切片放在 `infrastructure/modules/**`，两者各司其职。

---

## 10. 相关参考文档（仓库内）

- `docs/QUERY_MODULE_REFACTORING.md`：当前 `domains/query` 内部补齐接口层的方案（可作为过渡）
- `docs/DEPENDENCY_INVERSION_DIRECTORY_STRUCTURE.md`：依赖倒置的目录结构示例（写侧 ports + infra 实现）
- `docs/ARCHITECTURE_V5.3.md`：系统整体分层与 CQRS 方向（宏观）

