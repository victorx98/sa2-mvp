# `src/shared/` & `src/application/` DDD 评审报告（面向新手）

> 范围：本报告重点审查 `src/shared/`、`src/application/` 以及它们直接牵连的 Domain 实现（`src/domains/*`、`src/core/*` 中被这些层调用/依赖的部分）。
>
> 目标读者：刚开始用 DDD（Domain-Driven Design）做后端开发的同学，想知道“现在的代码哪里不像 DDD、为什么、以及通常更好的做法是什么”。

---

## 0. 总结（先给你一个地图）

### 0.1 一句话结论

当前代码更像“**按 DDD 命名的分层 NestJS 项目**”，而不是严格意义的 DDD/整洁架构：**Domain 与 Shared 依赖了 Infrastructure 与框架（Nest/Drizzle/HTTP），Application 又直接依赖 API DTO 与 DB Schema**。这会导致边界不清、耦合偏强、事务与事件一致性难保证、域模型偏贫血。

> 这并不意味着“项目写错了”。很多 MVP 会先用这种方式快速交付。但如果你的目标是：可演进、可拆分 bounded context、可测试、可维护的 DDD，那么这些问题会逐渐变成成本/风险。

### 0.2 本次发现的“最关键问题”Top 5

1. **依赖方向反了**：Domain/Shared 直接依赖 `@infrastructure/*`、Drizzle schema、Nest（最典型的“洋葱最内层被污染”）。
2. **Application 层边界不纯**：Application 直接依赖 `@api/*` DTO、直接返回 `@infrastructure/database/schema` 类型；用例层无法脱离 HTTP/DB 复用。
3. **Shared Kernel 膨胀且混杂**：`src/shared/` 同时放了领域契约（events/enums）和技术横切（guards/interceptors/logging/query-builder），甚至 DB 类型还反向依赖 schema。
4. **事务与副作用处理存在高风险路径**：`BookSessionCommand` 在 DB 事务里调用第三方建会（无法回滚外部系统），易产生“外部会议已创建但 DB 回滚”的不一致。
5. **域模型偏贫血**：很多所谓 entity 只是 DB schema type alias，业务规则主要堆在 service + SQL/CRUD，聚合/值对象/仓储抽象很少。

---

## 1. 现在的结构长什么样（从代码读出来的）

### 1.1 目录意图（推测）

- `src/api/`：HTTP Controller / request DTO / guard/interceptor（接口层）。
- `src/application/`：Use Case 编排层（commands/queries），包含 `CommandBase/QueryBase/SagaBase` 等。
- `src/domains/`：按业务域拆分模块（contract/catalog/financial/placement/identity/services/query...）。
- `src/core/`：跨域核心能力模块（calendar/meeting/webhook...），有些也像独立 bounded context。
- `src/shared/`：共享代码集合（目前混合了领域契约与技术横切）。
- `src/infrastructure/`：数据库、第三方认证等基础设施（drizzle schema/migrations、supabase auth）。

### 1.2 典型调用链（简化）

```
HTTP(API) -> Application(Command/Query) -> Domain/Core Service -> Drizzle DB/schema
                                          -> EventEmitter -> listeners(在 Application 或 Domain 中)
```

### 1.3 DDD/整洁架构里“理想的依赖方向”（对照用）

```
        外层(变化多)                      内层(变化少)
Infrastructure -> Application -> Domain
Interface(API) -> Application -> Domain

依赖规则（Dependency Rule）：外层可以依赖内层，内层不依赖外层。
```

> 你可以把 Domain 想成“发动机”，Infrastructure/API 是“轮胎/方向盘/车身”。发动机不应该 import 轮胎的实现细节。

---

## 2. 现在的设计/实现具体如何违背（或偏离）DDD 的常见最优方案？

下面每条都会用“新手能理解的语言”解释：DDD 这么做的好处是什么、现在为什么做不到、代码证据在哪里、风险是什么。

> 注：DDD 并非要求“框架零依赖”。但**依赖方向**与**职责边界**是 DDD/整洁架构的地基；地基不稳，后续越写越难改。

---

### 2.1 依赖方向反了：Domain/Shared 依赖 Infrastructure（最核心问题）

#### 直觉解释（新手版）

DDD/整洁架构希望做到：**业务规则（Domain）独立于技术细节（数据库/HTTP/框架）**。这样：

- 业务规则好测试（单元测试不需要起 DB）
- 业务规则可迁移（换 ORM/DB/事件机制，Domain 不用大动）
- 系统更可演进（边界清晰，团队协作更稳）

当 Domain 直接 import Drizzle schema、DATABASE_CONNECTION、Nest 的 Injectable 等时，业务规则就被技术细节“绑死”了。

#### 代码证据

- Domain 直接依赖数据库连接与 schema：  
  - `src/domains/contract/services/contract.service.ts:3-5`
    - `import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";`
    - `import * as schema from "@infrastructure/database/schema";`
    - `import { DrizzleDatabase } from "@shared/types/database.types";`
- Shared 中的 DB 类型反向依赖 infrastructure schema：  
  - `src/shared/types/database.types.ts:1-8`
    - `import * as schema from "@infrastructure/database/schema";`

#### 风险/后果

- **Domain 单测很难写**：你想测“合同状态流转规则”，却必须起 DB 或 mock 一堆 drizzle 行为。
- **换技术栈代价巨大**：比如从 Drizzle 换 Prisma，Domain 也要跟着改。
- **边界变模糊**：团队会越来越习惯在 Domain 里写 SQL/CRUD，最后 Domain 退化成“数据库脚本集合”。

---

### 2.2 Domain 绑死了 HTTP（Nest HttpException）：领域异常变成接口层概念

#### 直觉解释（新手版）

Domain 的错误应该是“业务语义”，例如：

- “合同不存在”
- “状态不允许从 DRAFT 直接跳到 COMPLETED”
- “余额不足”

但现在 Domain 里的异常很多直接继承/使用了 Nest 的 `HttpException`（也就是“HTTP 状态码、响应结构”这种接口层概念）。这会让 Domain 语义上变成“为 HTTP API 服务的业务逻辑”，而不是“独立的领域模型”。

#### 代码证据

- 领域异常直接引用 Nest HTTP 异常基类：  
  - `src/domains/contract/common/exceptions/contract.exception.ts:1-7`（`BadRequestException/NotFoundException/ConflictException/HttpStatus...`）
- `src/shared/exceptions/index.ts:1-47`：所谓“业务异常”同样继承 `HttpException`，并且绑定 `HttpStatus`。

#### 风险/后果

- **用例复用困难**：如果未来要把同一套用例用于消息队列/定时任务/CLI，而不是 HTTP API，你会发现 Domain 抛的异常天然带着 HTTP 语义。
- **领域语言被污染**：业务讨论“合同不可终止”时，代码却在讨论“409/400/422”这类传输层概念。
- **接口层难以统一**：不同 domain 自己决定 statusCode/response shape，会逐步出现不一致的错误响应规范。

#### 通常更好的做法（最常见的“整洁架构解法”）

1) **Domain 只定义“领域错误（Domain Error）”**：包含 `code`、`message`、可选 `metadata`，不包含 HTTP。

2) **接口层（API）或 Application 层做映射**：把 `DomainError.code` 映射成 HTTP 状态码/错误响应结构。

一个极简例子（只为说明概念）：

```ts
// domain/errors.ts（Domain 层）
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message ?? code);
  }
}

export class ContractNotFoundError extends DomainError {
  constructor(contractId: string) {
    super("CONTRACT_NOT_FOUND", `Contract not found: ${contractId}`, { contractId });
  }
}
```

```ts
// api/error-mapper.ts（接口层）
export function toHttpException(e: unknown): HttpException {
  if (e instanceof DomainError) {
    const status = e.code === "CONTRACT_NOT_FOUND" ? 404 : 400;
    return new HttpException({ code: e.code, message: e.message, meta: e.meta }, status);
  }
  return new HttpException({ code: "INTERNAL", message: "Internal server error" }, 500);
}
```

> 这样做的核心收益：**Domain 语言更纯、边界更清晰、未来更可复用。**

---

### 2.3 Application 直接依赖 `@api/*` DTO 与 DB Schema：用例层被 HTTP/DB “定型”

#### 直觉解释（新手版）

Application 层（Use Case）通常被视为“**系统对外提供的业务能力**”。它更像“产品说明书里的功能”，而不是“某个 HTTP 接口的实现细节”。

因此常见最优方案是：

- API 层负责：解析 HTTP 请求、校验格式、把 request DTO 转成用例 input
- Application 层负责：执行用例（事务、编排、调用 domain）
- Domain 层负责：业务规则

现在的问题是：Application 层直接 import 了 API request DTO，等于让用例“长成了 HTTP 的形状”。

#### 代码证据

- Application 命令直接依赖 API request DTO：  
  - `src/application/commands/auth/register.command.ts:14`：`import { RegisterDto } from "@api/dto/request/register.dto";`
  - `src/application/commands/auth/login.command.ts:13`：`import { LoginDto } from "@api/dto/request/login.dto";`
  - `src/application/commands/profile/update-student-profile.command.ts:3`：`import { UpdateStudentProfileDto } from "@api/dto/request/update-student-profile.dto";`
- Application 返回/使用 Infrastructure 的 schema 类型：  
  - `src/application/commands/contract/create-contract.command.ts:7`：`import type { Contract } from "@infrastructure/database/schema";`

#### 风险/后果

- **用例复用差**：如果你以后要做 GraphQL、RPC、消息队列消费者，同一个用例还得重新“适配”一套 DTO 或直接复用 HTTP DTO（进一步耦合）。
- **用例模型不稳定**：API DTO 的字段往往是“前端/接口协议驱动”，会随着 UI/接口变动频繁变化；用例 input 反而应该更稳定、更贴近业务语义。
- **无法做到“用例与持久化解耦”**：用例直接返回 DB schema type，会让 DB 字段演进直接冲击用例层。

#### 更好的做法（推荐）

- Application 为每个用例定义 **UseCase Input/Output（业务 DTO）**，不直接引用 API DTO 与 DB schema。
- API DTO 只存在于 `src/api/`，在 controller 里映射为 use case input。
- Domain entity / value object 也不必等同于 DB schema；DB schema 是 Infrastructure 的存储细节。

---

### 2.4 `src/shared/` 不是“Shared Kernel”，更像“everything bagel”

#### 直觉解释（新手版）

DDD 里的 **Shared Kernel（共享内核）** 有一个非常强的前提：

- 它是 **多个 bounded context 必须共享** 的那一小撮模型（非常小、非常稳定）
- 变更它需要 **跨团队共同治理**（否则任何一边改动都会影响另一边）
- 它通常只放“领域概念”，不放框架/技术细节

现在 `src/shared/` 同时包含：

1) 领域共享概念：`events/`、`types/*-enums.ts`  
2) 技术横切：decorators/guards/interceptors/logging/query-builder  
3) 甚至 DB 类型还反向依赖 schema（见 2.1）

这更像一个“common 工具箱”，而不是 DDD 意义上的 Shared Kernel。

#### 代码证据（示例）

- `src/shared/decorators/current-user.decorator.ts`：Nest 的 `createParamDecorator`（接口层/框架细节）
- `src/shared/guards/*`、`src/shared/interceptors/*`：明显属于 Web/API 横切关注点
- `src/shared/logging/otel-logger.service.ts`：框架 + OTEL（基础设施）
- `src/shared/query-builder/*`：强依赖 Drizzle ORM（基础设施）
- 事件常量重复定义（易产生漂移）：  
  - `src/shared/events/session-booked.event.ts` 定义了 `SESSION_BOOKED_EVENT`  
  - `src/shared/events/event-constants.ts` 也定义了 `SESSION_BOOKED_EVENT`
- `src/shared/events/service-session-completed.event.ts:24`：字段名 `refrenceId` 拼写错误已经扩散到多个模块（说明事件契约一旦被共享，就很难修正）

#### 风险/后果

- **共享越多，耦合越深**：任何“shared”变更都会全仓波及，bounded context 越拆越难。
- **领域概念被技术概念淹没**：新人打开 shared，看见 guards/interceptors/logging，很难理解哪些是领域语言。
- **事件契约不稳定**：常量重复定义、字段拼写错误，会让“集成契约”不可控。

#### 更好的做法（推荐的拆分方式）

把 `shared` 拆成两类（名字可自选）：

1) `shared-kernel`（纯领域、非常稳定）  
   - 例如：跨域统一的 ID 类型、少量值对象、真正的共享枚举（需要联合治理）
2) `platform` / `common`（技术横切）  
   - 例如：Nest guards/interceptors、logger、query-builder、retry util

另外，对于“跨域事件契约”，更常见的叫法是 **Published Language（发布语言）**：它可以放在一个独立目录/包中（例如 `src/published-language/events`），并且有版本治理策略。

---

### 2.5 域模型偏贫血：Entity 只是 DB 类型别名，业务规则主要堆在 Service + SQL/CRUD

#### 直觉解释（新手版）

DDD 的“战术设计（tactical DDD）”希望你把业务规则放在靠近模型的地方，让代码表达业务：

- Entity/Value Object/聚合根（Aggregate Root）封装不变量（invariant）
- Service 只负责“实体之间的协调”，而不是把所有规则都堆在 service 里

现在很多 domain “实体”只是 DB schema 类型别名，真正的业务规则写在“拿着 db 就开干”的 service 里，这更像“Transaction Script（事务脚本）”。

#### 代码证据（示例）

- `src/domains/services/sessions/ai-career/entities/ai-career-session.entity.ts:1-3`  
  只是 `export type AiCareerSessionEntity = AiCareerSessionSchema;`
- 大量 domain service 直接操作 drizzle：  
  - `src/domains/contract/services/contract.service.ts`（大量 `this.db.insert/update/select` + 业务规则混合）
  - `src/domains/catalog/product/services/product.service.ts`（同上）

#### 风险/后果

- **业务规则难复用**：规则散落在不同 service 的不同 SQL 分支里，很难保证一致。
- **状态/不变量容易被绕过**：当写入点多了以后，很容易出现“某个地方忘了检查状态”。
- **演进成本上升**：当需求变复杂（比如合同状态机、计费规则）时，service 会越来越大，修改会越来越不安全。

#### 重要提醒（避免误解）

DDD 并不强制你一定要写 OOP “充血模型”。你也可以用函数式的 domain model。

关键点是：**业务规则应该被一个清晰的“域层模型边界”托住**，而不是散落在“随处可写 SQL 的 service”里。

---

### 2.6 事务策略不统一：看似有事务，实际没覆盖业务写入（或各自为战）

#### 直觉解释（新手版）

在 DDD/整洁架构中，**事务边界通常属于 Application（用例）**：

- 用例开启事务
- 调用多个仓储/领域服务完成写入
- 提交事务
- 再发布事件/触发副作用

这样你可以保证“一个用例就是一个一致性边界”。

但现在代码里事务用法不统一：有的地方 Application 开事务但没把 `tx` 传下去，有的地方 Domain 自己再开事务，有的地方 service 根本不支持 tx。

#### 代码证据（示例）

- `CommandBase.withTransaction` 设计成 `callback(tx)`：  
  - `src/application/core/command.base.ts:55-66`
- 但有些 Command 在事务 callback 里不接收 `tx`，也不传给下层：  
  - `src/application/commands/placement/create-job-position.command.ts:30-36`  
    这里 `withTransaction(async () => ...)` 根本没用 `tx`
- 同时下层 service 也不支持 tx 参数：  
  - `src/domains/placement/services/job-position.service.ts:33`（`createJobPosition` 不接收 tx，内部直接用 `this.db`）

这会导致：你以为“这个用例在事务里”，但实际上写入不一定被同一个事务包住。

#### 风险/后果

- **原子性错觉**：你以为“这个用例失败会回滚”，实际可能已经写入部分数据。
- **跨域编排困难**：当一个用例要同时改 A 域和 B 域的数据，如果双方各自开事务，就很难做到一致性。

#### 更好的做法（推荐）

统一成“Application 统一开事务 + 下层通过仓储/端口接收 tx（Unit of Work）”的模式（第 4 章有例子）。

---

### 2.7 在 DB 事务里做外部副作用：无法回滚第三方系统（高风险）

#### 直觉解释（新手版）

数据库事务只能回滚数据库里的改动，**不能回滚第三方系统**（比如飞书/Zoom 建会）。

因此把“调用第三方 API”放在 DB 事务内部，是一个经典的分布式一致性坑：  
事务失败回滚了 DB，但第三方已经创建成功，产生“孤儿资源”。

#### 代码证据

- `BookSessionCommand` 在 `db.transaction` 里创建会议：  
  - `src/application/commands/booking/book-session.command.ts:100`（开始事务）
  - `src/application/commands/booking/book-session.command.ts:150-177`（事务内调用 `meetingManagerService.createMeeting`）
- `MeetingManagerService.createMeeting` 先调用 provider 再落库：  
  - `src/core/meeting/services/meeting-manager.service.ts:51-85`

#### 额外的实现风险（小但真实）

`BookSessionCommand` 只判断了 `studentCalendarSlot`，没有判断 `mentorCalendarSlot` 是否为 null，后续直接用 `mentorCalendarSlot.id`，在导师冲突时存在潜在 NPE：  
`src/application/commands/booking/book-session.command.ts:146-207`

#### 你们已有的“更好方向”（值得肯定）

你们在新的 regular mentoring 流程里已经在往正确方向走：

- Application 先落库一个 `PENDING_MEETING` 的 session + calendar slot（事务内）
- 事务后发布 `REGULAR_MENTORING_SESSION_CREATED_EVENT`
- 异步 handler 再去创建第三方会议并回写 DB  
  - `src/application/commands/services/regular-mentoring.service.ts`
  - `src/application/commands/services/regular-mentoring-event.handler.ts`

这就是“把不可回滚的外部副作用移出 DB 事务”的正确思路。

> 进一步的最佳实践：使用 Outbox（事务内写 outbox 表，异步 worker 可靠投递），而不是只靠进程内 `EventEmitter`（进程挂了事件就丢了）。

---

### 2.8 领域事件、应用事件、集成事件混在一起：事件契约治理困难

#### 直觉解释（新手版）

DDD 里常见三类事件（名字可能不同，但概念类似）：

- **Domain Event（领域事件）**：领域模型里发生的“事实”，例如 `ContractActivated`。它应该从领域模型产生，但不需要知道“怎么发布”。
- **Application Event（应用事件）**：用例编排过程中的事件，更多是内部用（例如“某个异步任务需要开始”）。
- **Integration Event（集成事件 / Published Language）**：对外发布给其他 bounded context/系统使用的稳定契约，需要版本治理。

现在的问题是：事件定义集中在 `src/shared/events`，并且很多 domain service 直接使用 `EventEmitter2` 发布事件（直接绑定 Nest 事件机制），这会把 Domain 绑到具体的发布方式上，同时也让“事件到底是领域事实还是集成契约”变得不清晰。

#### 代码证据（示例）

- Domain service 直接注入并使用 `EventEmitter2`：  
  - `src/domains/services/sessions/regular-mentoring/services/regular-mentoring.service.ts:2`（`EventEmitter2`）
- 事件定义集中在 `src/shared/events/*`，但其中夹杂了 “legacy/trigger/result” 多套语义，且常量重复（见 2.4）。

#### 风险/后果

- **可靠性难保证**：进程内 EventEmitter 不是可靠消息；重启/崩溃会丢事件。
- **契约漂移**：事件名/字段分散定义、常量重复、拼写错误扩散，长期会变成“谁也不敢改”。

---

### 2.9 `domains/query` 更像 Read Model：命名与边界容易误导新人

#### 直觉解释（新手版）

DDD 很常见的一个实践是 CQRS：

- 写模型（Domain）负责业务规则与一致性
- 读模型（Query/Read Model）负责查询与聚合展示（可以是 SQL join、物化视图等）

读模型不一定需要“领域对象”，也不一定符合 Domain 的聚合边界，它的目标是“查得快、组合方便”。

在当前代码里，`src/domains/query/services/*` 很明显在做 SQL 聚合查询，例如：

- `src/domains/query/services/student-query.service.ts`：大量 `sql\`...\`` join，返回扁平化 read model

这本身并不坏，但把它叫做 `domains/query` 容易让新手误以为“Query 也是 Domain”，从而混淆 DDD 的层次。

更常见的做法是：

- 把它叫 `read-model` / `reporting` / `query`，并明确它是 CQRS 的读侧
- 或者放在 `src/application/queries` 下，但内部使用专门的 query service

---

### 2.10 全局共享枚举/类型会弱化 bounded context：Shared Kernel 需要更严格治理

#### 直觉解释（新手版）

DDD 的 bounded context 强调：**每个业务域拥有自己的语言与模型**。  
如果所有 domain 都共享同一份枚举/类型，短期看起来省事，长期会变成“所有人被迫同步变更”。

#### 代码证据（示例）

- `src/shared/types/catalog-enums.ts`、`src/shared/types/contract-enums.ts`、`src/shared/types/financial-enums.ts` 等把多个 domain 的枚举放到 shared。
- Contract domain 使用了 catalog 的 `Currency`：  
  - `src/domains/contract/services/contract.service.ts:27`

#### 风险/后果

- **边界变弱**：Catalog 改一个枚举语义，Contract/Financial 都会被迫跟着改。
- **未来难拆服务**：如果将来要把 Catalog/Contract 拆成独立服务，shared enums 会变成强耦合点。

#### 更好的做法（两种常见路线）

1) **真正的 Shared Kernel**：只保留极少、非常稳定、跨域都必须一致的概念，并建立联合治理（变更评审）。
2) **Published Language + ACL**：各域保留自己的枚举/模型，对外用事件/DTO（发布语言）沟通，通过 ACL（防腐层）做映射。

---

### 2.11 也有一些“朝 DDD 更好方向”靠近的实践（建议保留并强化）

- **命令/查询分离的雏形**：`src/application/commands/*` 与 `src/application/queries/*` 的结构对新手很友好。
- **异步建会流程**：`regular-mentoring` 已经开始把外部副作用放到事务外，这是很关键的一步（见 2.7）。
- **部分服务支持可选 tx**：例如 `StudentProfileService` 支持 `tx?: DrizzleTransaction`（这是往 UnitOfWork 方向走的基础）。
- `docs/outbox_migration_implementation_plan.md` 已经有 outbox 规划文档：说明你们知道“可靠事件投递”是下一步。

---

## 3. DDD 的原则与“通常的最优方案”是什么？（新手友好版）

先把 DDD 拆成两部分理解会更清楚：

- **战略设计（Strategic DDD）**：怎么划分业务边界（bounded context）、怎么让团队协作与模型演进更稳。
- **战术设计（Tactical DDD）**：在代码层如何表达业务模型（实体、值对象、聚合、仓储、领域事件等）。

### 3.1 战略 DDD：Bounded Context（边界上下文）与语言

#### 3.1.1 什么是 bounded context？

一句话：**同一个词在不同业务域可能含义不同，所以要用“边界”隔离含义与模型。**

在你们仓库里，目录上已经隐含了多个上下文：

- Catalog（产品/服务类型）
- Contract（合同/权益/台账/预占）
- Financial（导师结算/申诉/支付参数）
- Services（各种 session / service registry）
- Identity（用户/角色/档案）
- Calendar/Meeting（可能也是独立上下文）
- Query（读模型/报表）

DDD 的目标不是“目录分开就叫 bounded context”，而是：

- 每个 context 内部语言一致（Ubiquitous Language）
- context 之间通过明确的契约交互（事件/DTO），而不是互相 import 内部模型

#### 3.1.2 Context Mapping 的常见集成方式

- **Published Language（发布语言）**：对外公布稳定的事件/DTO（例如“session.completed”事件契约）。
- **ACL（Anti-Corruption Layer，防腐层）**：把外部系统/外部上下文的模型翻译成自己域内的模型，避免“外部概念污染内部”。
- **Shared Kernel（共享内核）**：非常小、非常稳定的共享模型，需要联合治理。

> 一个经验：**Shared Kernel 是最“省事但最危险”的集成方式**。如果没有严格治理，它会变成“全局耦合点”。

### 3.2 战术 DDD：模型怎么写（实体/值对象/聚合/仓储）

#### 3.2.1 Entity vs Value Object（实体 vs 值对象）

新手可以用一句话区分：

- **实体（Entity）**：有身份（ID），生命周期中属性会变，但身份不变。例：Contract、User、Session。
- **值对象（Value Object）**：没有独立身份，用“值相等”判断。例：Money、DateRange、Email、ContractStatus（也可视为 VO/枚举）。

好处：值对象可以封装校验/计算逻辑，让业务规则更集中、更不容易漏。

#### 3.2.2 Aggregate（聚合）与一致性边界

聚合（Aggregate）可以理解为：**一次事务里必须保持一致的那一组对象**，并且只通过“聚合根（Aggregate Root）”对外暴露修改入口。

例子（概念举例，不代表你们一定要这样设计）：

- Contract 作为聚合根：修改状态、生成权益、记录状态历史等都应通过 Contract 聚合的行为完成。
- ServiceHold/ServiceLedger 可能属于 Contract 聚合的一部分，或者是独立聚合（取决于一致性要求与规模）。

#### 3.2.3 Repository（仓储）与端口/适配器

Repository 的新手理解：

- Domain 想要：`contractRepository.save(contract)`、`contractRepository.findById(id)`
- Infrastructure 才关心：这是用 Drizzle/SQL 还是别的实现

所以常见做法是：

- **仓储接口放在 Domain（或 domain 包的边界）**
- **仓储实现放在 Infrastructure**

这样 Domain 就不会 import `@infrastructure/database/schema`。

#### 3.2.4 Application Service（用例编排） vs Domain Service（领域服务）

新手常混淆这两个：

- **Application Service/Command**：实现“一个用例”（例如“创建合同”、“预约会话”），负责事务、权限、调用多个 domain。
- **Domain Service**：属于领域逻辑的一部分，但不适合放到某个实体方法里（例如跨多个聚合的纯业务计算/策略）。

通常最优实践：**Application 决定事务边界，Domain 不自己开事务**（除非是内部仓储实现的细节）。

### 3.3 事件（Domain Event）与可靠投递（Outbox）

对新手最重要的一点：

- **事件不是“顺手 emit 一下”**，事件是跨模块/跨系统的契约和一致性工具。

如果你希望“事务提交成功后一定能通知到下游”，最常见的可靠方案是 Outbox：

1) 同一个 DB 事务里：写业务表 + 写 outbox 表（待投递事件）
2) 事务提交后：后台 worker 拉取 outbox，投递到消息系统/事件总线
3) 投递成功：标记 outbox 已发送（可重试、可幂等）

这样才能在“进程挂了/网络抖动”时仍然保证最终一致性。

---

## 4. 通常的最优方案长什么样？（结合你们的 NestJS + Drizzle）

这里给一个“既符合 DDD/整洁架构，又不至于把 Nest 项目重写一遍”的落地形态。

### 4.1 推荐的分层（建议你们用来对齐团队共识）

```
Domain（纯业务）:
  - entities / value-objects / aggregates / domain-events
  - repository interfaces（端口）
  - domain services（纯业务规则）

Application（用例）:
  - commands/queries（用例 input/output）
  - transaction(UnitOfWork)
  - 调用 domain + repository
  - 事务后发布事件（或写 outbox）

Infrastructure（适配器）:
  - drizzle schema / repository implementations / external clients
  - event bus/outbox worker（可靠投递）

Interface(API)（适配器）:
  - controllers + request DTO
  - auth/guards/interceptors
  - 把 request DTO 映射为 use case input，处理错误映射
```

### 4.2 一个“合同状态流转”的最小示例（帮助你把概念对齐）

你们现在的做法（简化版）往往像：

```ts
// domain service 里直接 update DB，然后顺手写历史表
await db.update(contracts).set({ status: "ACTIVE" }).where(eq(id));
await db.insert(contractStatusHistory).values(...);
```

DDD 常见做法是把规则放在聚合里（OOP 只是表达方式之一）：

```ts
// domain/contract.aggregate.ts
export class Contract {
  constructor(private props: { id: string; status: ContractStatus /* ... */ }) {}

  activate() {
    if (this.props.status !== "SIGNED") {
      throw new DomainError("INVALID_STATUS_TRANSITION");
    }
    this.props.status = "ACTIVE";
    // this.recordDomainEvent(new ContractActivated(this.props.id));
  }
}
```

然后由 Application 用例负责事务与持久化：

```ts
// application/activate-contract.usecase.ts
await uow.transaction(async (tx) => {
  const contract = await contractRepo.findByIdOrThrow(id, tx);
  contract.activate();
  await contractRepo.save(contract, tx);
  // tx.enqueue(contract.pullDomainEvents());
});
```

这样做的收益：

- 业务规则（能不能 activate）集中在模型里，写漏的概率大幅下降
- 用例负责事务，domain 不关心 drizzle
- 未来要从 API/消息队列调用同一个用例，也更容易复用

### 4.3 “错误处理”的推荐模式（把 HTTP 语义隔离到外层）

- Domain 抛 `DomainError(code, message)`
- API 统一捕获并映射到 HTTP

你们已经有 `ErrorInterceptor`（`src/shared/interceptors/error.interceptor.ts`），这是一个很好的统一入口。建议做的是：

- 让 Domain 不再抛 `HttpException`
- 让 `ErrorInterceptor` 或 API 层 mapper 将 `DomainError` 映射成 `{ code, message } + status`

### 4.4 “预约会话/创建会议”的推荐模式（解决 2.7 的高风险）

目标：避免在 DB 事务中调用第三方建会。

推荐改成你们 regular mentoring 已经在做的模式：

1) 事务内：创建 session（状态 `PENDING_MEETING`）、calendar slot、service hold
2) 事务内：写 outbox（或事务后 emit event）
3) 异步 handler：调用第三方建会 -> 更新 session（meetingId/meetingUrl）-> 更新 calendar slot
4) 失败则标记 session `MEETING_FAILED`，可人工/自动重试

> 这本质上是一个 Saga/流程编排：把“不可回滚的外部动作”变成异步步骤 + 可重试 + 可补偿。

---

## 5. 针对本仓库的渐进式改造建议（不推倒重来）

下面按“先止血 -> 再重构 -> 最后提升”的顺序给建议，新手也能跟得上。

### 5.1 先止血：建立依赖红线（强烈建议先做）

目标：防止新代码继续加深耦合。

建议的红线（以 lint/架构测试强制）：

- `src/domains/**` 不允许 import：
  - `@infrastructure/**`
  - `@api/**`
  - `@nestjs/**`（如果短期做不到，至少先禁止 `@infrastructure/**`）
- `src/application/**` 不允许 import：
  - `@api/**`
  - `@infrastructure/database/schema`（返回值也尽量不用 schema type）
- “纯共享契约”（你们未来的 shared-kernel/published-language）不允许 import：
  - `@infrastructure/**`

### 5.2 拆分 `src/shared/`（让新人一眼分清“领域契约 vs 技术横切”）

最低成本拆法（目录名可调整）：

- `src/shared-kernel/`：只放跨域稳定的领域概念（少量 enums/VO/IDs）
- `src/published-language/`：只放对外事件契约（稳定、可版本化）
- `src/platform/`：放 Nest 相关横切（decorators/guards/interceptors/logging/query-builder）

并且把 `src/shared/types/database.types.ts` 这种“反向依赖 schema”的文件迁走（放到 infra 或 platform），避免 shared-kernel 依赖基础设施。

### 5.3 修高风险路径：把 `BookSessionCommand` 改成“事务内落库 + 异步建会”

这是最值回票价的一步：

- 能立刻降低外部副作用导致的数据不一致风险
- 也能让团队对“事务边界、事件发布”形成一致实践

### 5.4 统一事务与仓储抽象（从 1 个域开始做样板）

建议从变化最大、规则最复杂的域先做（Contract / Services / Financial 任选其一），建立模板：

- 把 repository interface 放到 domain
- 把 drizzle 实现放到 infrastructure
- application 用 UnitOfWork 开事务并传递 tx

做好一个域的样板，再逐步推广到其他域。

### 5.5 长期：明确 bounded context 的集成方式（不要默认 Shared Kernel）

- 哪些域之间用事件（published language）通信？
- 哪些域需要 ACL 做映射？
- 哪些概念真的必须共享（shared-kernel）？谁负责治理？

把这些写成一页“架构规则”，比口头约定更有效。

---

## 6. 给 DDD 新手的“自检清单”（写新代码前先看一眼）

当你要新增一个业务功能时，按下面问自己：

1) 这是一个“用例”吗？如果是，用 Application Command/UseCase 表达（并决定事务边界）。
2) 业务规则写在哪里？  
   - 能放到聚合/值对象里就放进去（减少遗漏）
   - 实在不适合才放 Domain Service
3) Domain 有没有 import 到 DB schema / Nest / HTTP？如果有，先停一下想想能不能通过仓储/端口隔离。
4) 需要调用第三方吗？如果会影响一致性，尽量异步化 + 重试 + outbox。
5) 事件是“领域事实”还是“集成契约”？命名、字段、版本策略是否清晰？

---

## 7. 附：本报告引用到的关键文件（方便你回到代码定位）

- `src/shared/types/database.types.ts`
- `src/domains/contract/services/contract.service.ts`
- `src/domains/contract/common/exceptions/contract.exception.ts`
- `src/shared/exceptions/index.ts`
- `src/application/commands/auth/register.command.ts`
- `src/application/commands/profile/update-student-profile.command.ts`
- `src/application/commands/booking/book-session.command.ts`
- `src/core/meeting/services/meeting-manager.service.ts`
- `src/application/commands/services/regular-mentoring.service.ts`
- `src/application/commands/services/regular-mentoring-event.handler.ts`
- `src/domains/query/services/student-query.service.ts`

