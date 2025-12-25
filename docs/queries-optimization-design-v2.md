# Queries 目录优化设计方案 V2.0
## 基于仓储模式的完全解耦架构（Fully Decoupled Architecture）

## 核心目标（Objectives）

- **应用层不依赖领域层（No Domain Dependency）**：查询用例不调用领域服务，不依赖 `domains/query`
- **应用层不依赖数据库（No DB Dependency）**：查询用例不注入数据库连接，不引用全局 DB Provider（例如 `DATABASE_CONNECTION`）
- **通过仓储接口隔离（Repository Interface）**：应用层仅定义查询仓储接口与读模型；基础设施层实现数据访问
- **统一分页响应（Unified Pagination）**：所有分页查询统一返回 `{ data, total, page, pageSize, totalPages }`

## 必须遵守的边界（Boundaries）

- **依赖倒置（DIP）**：应用层定义接口/模型；基础设施层提供实现
- **职责单一（SRP）**：用例只做编排/规则/权限；仓储只做 SQL/映射/性能优化
- **接口隔离（ISP）**：按查询场景拆分仓储接口，避免“万能查询服务”
- **边界清晰（Clear Boundaries）**
  - API 层只做 HTTP 边界（路由/鉴权/校验/转换/返回），不写 SQL，不注入数据库连接
  - 应用层查询只依赖查询仓储接口与 Read Model，不引用 API Response DTO
  - 全局 `infrastructure/database` 只提供通用数据库能力（连接/Schema/迁移/追踪/工具），不承载业务查询逻辑

## 统一分页契约（Unified Pagination Contract）

所有分页查询必须返回标准结构：

- `data`: 数组，直接返回列表；无数据返回 `[]`
- `total`: 满足过滤条件的总条数（不受分页影响）
- `page`: 页码，1-based；未传时默认 1；最小为 1
- `pageSize`: 每页条数；建议在 API 层做范围限制；未传时使用模块默认值
- `totalPages`: 按 `ceil(total / pageSize)` 计算；当 `total = 0` 时，`totalPages = 1`

额外约束：

- **排序稳定性（Deterministic ordering）**：分页查询必须稳定排序（即使排序字段相同也应有稳定次序），避免翻页重复/遗漏
- **包装位置（Where to wrap）**：标准分页结构由应用层用例/仓储返回，Controller 不重复拼装

## 架构图

```
API Layer (Controllers)
         ↓
Application Layer
  - Query Use Cases (用例编排、业务规则验证)
  - Query Repository Interfaces (应用层定义接口)
         ↑
Infrastructure Layer  
  - Query Repository Implementations (实现接口、执行SQL)
  - Database Connection
         
注意：领域层不参与查询流程
```

## 目录结构（Directory Structure）

```
src/
├── api/
│   ├── controllers/                           # HTTP 路由入口（HTTP entrypoints）
│   └── dto/
│       └── request/                           # API Request DTO（含校验与转换，validated）
│
├── application/
│   ├── queries/
│   │   └── [业务模块]/
│   │       ├── use-cases/                     # 查询用例（Query use cases）
│   │       ├── interfaces/                    # 查询仓储接口（Query repository interfaces）
│   │       ├── dto/                           # Query DTO：查询输入（无校验装饰器）
│   │       ├── models/                        # Read Model：查询输出（Query outputs）
│   │       └── infrastructure/                # 模块内基础设施（Module infrastructure）
│   │           ├── repositories/              # 查询仓储实现（Repository implementations）
│   │           └── query-repositories.module.ts # DI 绑定入口（DI wiring）
│   └── commands/
│       └── [业务模块]/                        # 写侧用例与策略（Commands）
│
├── domains/
│   └── [业务聚合]/                            # 领域层（仅负责写操作）
│
└── infrastructure/
    └── database/                              # 全局数据库基础设施（Global DB infrastructure）
        ├── database.module.ts
        ├── database.provider.ts               # DB Provider（DATABASE_CONNECTION 等）
        ├── schema/
        ├── migrations/
        ├── utils/
        └── database-trace.service.ts
```

## DTO / Query DTO / Read Model 分工（Responsibilities）

- **API Request DTO（`api/dto/request`）**：外部请求输入；负责校验与转换
- **Query DTO（`application/queries/**/dto`）**：应用层内部查询入参表达；不做校验装饰器
- **Read Model（`application/queries/**/models`）**：应用层查询输出；字段尽量与 API 输出一致；分页场景遵循统一分页契约

## Queries / Commands 的功能边界（Functional Boundary）

- **Queries（读，Read）**
  - 职责：提供面向展示/列表/检索的 Read Model；允许 JOIN/聚合/性能优化（避免 N+1）
  - 约束：不修改状态；不依赖领域写侧服务与写侧仓储；分页遵循统一分页契约
- **Commands（写，Write）**
  - 职责：执行业务写操作（创建/更新/状态流转），负责事务边界与写侧编排
  - 约束：不拼装复杂读模型；需要展示数据时由 Controller 组合调用 Query 获取读模型

## 依赖注入约定（DI Wiring）

推荐两级拆分（可按模块规模选择是否分层）：

- **QueryRepositoriesModule（模块内基础设施）**：位于 `application/queries/[模块]/infrastructure`；引入 DatabaseModule；绑定 Token → Repository Implementation
- **Queries Module（应用层）**：只依赖 QueryRepositoriesModule；注册查询用例并导出给 API 层

目标是让应用层查询用例无需直接引入 DatabaseModule，同时可替换数据源实现（例如 drizzle/supabase/mock）。

## 落地步骤（Implementation Steps）

以业务模块为单位推进：

1. **定义 Read Model**：列表/详情分别建模；分页统一返回标准结构
2. **定义查询仓储接口**：按查询场景拆分方法；同步定义 DI Token
3. **实现查询仓储**：仅在基础设施层注入数据库连接；负责 SQL/映射/性能优化（避免 N+1、选择必要字段）
4. **编写查询用例**：只做编排/规则/权限；只依赖接口与 Read Model
5. **更新 Controller**：继续使用 API Request DTO 做校验与转换；直接返回 Read Model（必要时做轻量映射）
6. **补齐单元测试与清理**：用 Mock 仓储验证用例编排/权限/分页参数传递；移除旧路径或建立静态规则禁止新增依赖

## 错误与权限语义（Error & Authorization Semantics）

- **无权限（Forbidden）**：权限校验失败 → 403 语义
- **不存在（Not Found）**：目标不存在 → 404 语义
- **空结果（Empty result）**：列表无数据 → `data: []`（同时满足分页契约），不视为 Not Found

说明：用例负责“是否允许访问/是否存在”的判断；Controller 负责将应用层结果/错误映射为对应 HTTP 语义与响应结构。

## 迁移策略（Migration Strategy）

为降低风险，按“先止血、再搬迁、再收口”推进：

- **先止血（Stop the Bleeding）**：新增查询一律走“应用层接口 + 模块内基础设施实现”；禁止在应用层查询里直接注入数据库连接
- **再搬迁（Move Legacy Queries）**：将 `domains/query` 的 SQL 查询逐步迁移到各模块 `application/queries/[模块]/infrastructure`
- **再收口（Converge and Simplify）**：统一分页结构与字段命名；删除不再使用的 legacy 查询模块或用静态规则封口

## 迁移验收清单（Definition of Done）

- **依赖边界（Boundaries）**
  - 应用层查询用例不注入数据库连接，不引用全局 DB Provider（例如 `DATABASE_CONNECTION`）
  - 应用层查询用例不依赖 `domains/query`
  - 仓储实现位于模块内 `application/queries/[模块]/infrastructure`，对外仅通过接口 Token 暴露
- **输出契约（Contracts）**
  - 分页查询严格遵循统一分页结构与细则（含 1-based `page` 与 `total=0 → totalPages=1`）
  - Read Model 字段命名与 API 输出保持一致（或仅在 Controller 做轻量映射），禁止在 Controller 拼装复杂读模型
- **行为语义（Semantics）**
  - 无权限 403；不存在 404；列表无数据返回空数组而非 Not Found
- **质量与收口（Quality & Convergence）**
  - 用例具备单元测试（Mock 仓储即可）
  - 迁移完成后移除旧路径或至少通过静态规则禁止新增对旧实现的依赖

---

**版本：** v2.0  
**日期：** 2025-12-25


