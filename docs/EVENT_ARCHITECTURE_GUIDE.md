# Event-Driven Architecture Guide

## 事件驱动架构指南

> 本文档为 sa2-mvp 项目的事件驱动架构开发指南，供未来开发者参考。

---

## 目录

1. [架构概述](#1-架构概述)
2. [Event Catalog 规则](#2-event-catalog-规则)
3. [Flow Definition 规则](#3-flow-definition-规则)
4. [Enhanced Event Bus 使用](#4-enhanced-event-bus-使用)
5. [Saga Orchestrator 编写指南](#5-saga-orchestrator-编写指南)
6. [Session Booking 改造详解](#6-session-booking-改造详解)
7. [本次实现变更记录](#7-本次实现变更记录)

---

## 1. 架构概述

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     Event-Driven Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Catalog   │    │    Flows    │    │   Infrastructure    │  │
│  │  (38 events)│    │ (7 flows)   │    │  (Bus + Tracking)   │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│         │                  │                     │               │
│         └──────────────────┼─────────────────────┘               │
│                            │                                     │
│                   ┌────────▼────────┐                           │
│                   │  EventsModule   │                           │
│                   └─────────────────┘                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 核心组件

| 组件 | 路径 | 职责 |
|------|------|------|
| **Event Catalog** | `src/events/catalog/` | 事件元数据注册中心，定义所有事件的生产者、消费者、关系 |
| **Flow Definitions** | `src/events/flows/definitions/` | 声明式业务流程定义，用于文档和可视化 |
| **Enhanced Event Bus** | `src/events/infrastructure/` | 增强的事件总线，提供关联追踪和验证 |
| **Events Module** | `src/events/events.module.ts` | NestJS 模块，统一配置和导出 |

### 1.3 设计原则

1. **单一真相源 (Single Source of Truth)**: 所有事件定义集中在 Catalog
2. **向后兼容**: 现有 `@OnEvent` 装饰器继续工作
3. **渐进式采用**: 新功能可选启用，不强制迁移
4. **可追踪性**: 通过 Correlation ID 追踪完整事件链
5. **可视化**: 通过 Flow Definitions 生成 Mermaid 图

### 1.4 Stage 1-4 当前完成度（对齐当前代码）

> 这一节是“文档 vs 代码”的对齐结论：哪些能力已经能直接用、哪些只是设计/示例，避免新人踩坑。

| Stage | 状态 | 说明 | 关键代码 |
|------|------|------|---------|
| Stage 1: Event Catalog | ✅ 完成 | 38 个事件已注册，`validateCatalog()` 通过 | `src/events/catalog/` |
| Stage 2: Enhanced Event Bus | ✅ 基础设施完成 | 已接入 `AppModule`；但业务代码目前大多仍在用 `EventEmitter2.emit`（想要校验/追踪请用 `EnhancedEventBus`） | `src/events/infrastructure/`, `src/app.module.ts` |
| Stage 3: Saga Orchestrator | ⚠️ 部分完成 | `SagaOrchestrator` 已实现并有一个落地示例 `SessionBookingSaga`；目前主要用于 `regular_mentoring` 的异步 booking，其他流程仍以普通 handler 为主；无持久化/断点续跑 | `src/events/sagas/` |
| Stage 4: Flow Definitions | ✅ 完成（文档层） | 7 个流程已定义并可校验（当前总步骤数为 36）；用于文档/可视化，不参与运行时编排 | `src/events/flows/definitions/` |

> 快速自检：执行 `npx ts-node -r tsconfig-paths/register -e "const {getCatalogStats,validateCatalog}=require('./src/events/catalog'); console.log(getCatalogStats(), validateCatalog()); const {getFlowStats,validateAllFlows}=require('./src/events/flows/definitions'); console.log(getFlowStats(), validateAllFlows());"`

---

## 2. Event Catalog 规则

### 2.1 目录结构

```
src/events/catalog/
├── types.ts                    # 类型定义
├── session-events.catalog.ts   # 会话领域事件
├── meeting-events.catalog.ts   # 会议领域事件
├── financial-events.catalog.ts # 财务领域事件
├── placement-events.catalog.ts # 就业领域事件
├── contract-events.catalog.ts  # 合同领域事件
├── index.ts                    # 统一导出和查询函数
└── catalog.spec.ts             # 单元测试
```

### 2.2 添加新事件的步骤（从 0 到 1）

> 如果你是第一次做 EDA：先记住一句话——**事件是“已经发生的事实”**（happened fact），不是“请你去做”。

#### Step 0: 明确语义与边界（先别写代码）

1. 这个东西是 **Event** 还是 **Command**？
   - Event：`xxx.completed` / `xxx.failed`（事实）
   - Command：`xxx.create` / `xxx.doSomething`（请求）
2. 事件归属哪个 Domain（`EventDomain`）？由哪个模块负责发布（Producer）？
3. 事件 payload 里要放什么？经验法则：
   - ✅ 放：业务实体 ID、状态、关键时间点、必要的上下文（谁/何时/什么结果）
   - ❌ 不放：数据库行全量、敏感信息、大对象、依赖内部结构的字段

#### Step 1: 在 `src/shared/events/event-constants.ts` 定义事件名常量

```typescript
// 命名规则（常量名）: {DOMAIN}_{ENTITY}_{ACTION}_EVENT
// 命名规则（事件名）: {domain}.{entity}.{action}
export const MY_FEATURE_SUBMITTED_EVENT = "my_feature.submitted";
```

> 建议：对外“统一引用事件名”只从 `event-constants.ts` 取，避免字符串散落导致拼写/重构成本高。

#### Step 2: 定义 payload 类型，并从 `src/shared/events/index.ts` 导出

1. 新建事件类型文件，例如：`src/shared/events/my-feature-submitted.event.ts`
2. 只导出 **type/interface**（常量仍放在 `event-constants.ts`）

```typescript
// src/shared/events/my-feature-submitted.event.ts
export type MyFeatureSubmittedEvent = {
  id: string;
  submittedAt: string; // 尽量用 ISO string，避免 Date 在序列化/跨进程时产生歧义
  userId: string;
};
```

3. 在 `src/shared/events/index.ts` 增加导出：

```typescript
export type { MyFeatureSubmittedEvent } from "./my-feature-submitted.event";
```

#### Step 3: 在 Event Catalog 注册（让系统“认识”这个事件）

1. 找到对应领域 catalog：`src/events/catalog/{domain}-events.catalog.ts`
2. 增加一条 `EventCatalogEntry`，把生产者/消费者写清楚

```typescript
import { MY_FEATURE_SUBMITTED_EVENT } from "@shared/events/event-constants";

export const MyDomainEventsCatalog: Record<string, EventCatalogEntry> = {
  [MY_FEATURE_SUBMITTED_EVENT]: {
    name: MY_FEATURE_SUBMITTED_EVENT,
    description: "My feature was submitted",
    descriptionCN: "某功能已提交",
    domain: EventDomain.USER, // 示例
    eventType: EventType.TRIGGER,
    payloadType: "MyFeatureSubmittedEvent",
    producers: ["MyFeatureService.submit"],
    consumers: [
      {
        handler: "MyFeatureSubmittedHandler",
        priority: ConsumerPriority.HIGH,
        async: true,
        module: "application",
        description: "Kick off downstream processing",
        errorStrategy: ErrorHandlingStrategy.RETRY,
      },
    ],
    tags: ["my-feature"],
    version: "1.0",
  },
};
```

3. 如果是**新领域**：需要在 `src/events/catalog/index.ts` 合并该领域 catalog（参考已有 `...SessionEventsCatalog` 的写法）

#### Step 4: 在 Producer 里发事件（推荐用 EnhancedEventBus）

**推荐（新代码）**：注入 `EnhancedEventBus`，发事件时自动做校验 + 追踪 + correlation metadata

```typescript
const result = await this.eventBus.emit(MY_FEATURE_SUBMITTED_EVENT, payload, {
  producer: "MyFeatureService.submit",
});
if (!result.success) throw new Error(result.error);
```

**兼容（老代码/快速接入）**：继续用 `EventEmitter2.emit`

```typescript
this.eventEmitter.emit(MY_FEATURE_SUBMITTED_EVENT, payload);
```

> 注意：只有通过 `EnhancedEventBus` 发出的事件才会带 `correlationId`/flow tracking（老的 `EventEmitter2.emit` 不会自动注入元数据）。

#### Step 5: 在 Consumer/Handler 里订阅事件

```typescript
@Injectable()
export class MyFeatureSubmittedHandler {
  @OnEvent(MY_FEATURE_SUBMITTED_EVENT)
  async handle(payload: MyFeatureSubmittedEvent) {
    // 可选：如果事件是由 EnhancedEventBus 发出的，可提取元数据
    // const meta = EnhancedEventBus.extractMetadata(payload);
  }
}
```

#### Step 6: 把 Handler 注册到对应 Module（否则不会生效）

1. 找到放置 handler 的模块（常见：`src/application/application.module.ts` 或某个 domain module）
2. 在 `providers: []` 中加入 handler class

> 判断标准：**能被 Nest DI 创建出来**，`@OnEvent` 才会注册监听。

#### Step 7:（推荐）补一份 Flow Definition（用于可视化/对齐）

1. 在 `src/events/flows/definitions/` 新建或修改 `*.flow.ts`
2. 在 `src/events/flows/definitions/index.ts` 注册
3. 用 `validateAllFlows()` 检查（见第 3 章）

#### Step 8: 运行测试与校验

```bash
# 校验 catalog
npm run test -- --testPathPatterns="catalog.spec.ts"

# 如需快速校验 flow（无需跑 Jest）
npx ts-node -r tsconfig-paths/register -e "const {validateAllFlows}=require('./src/events/flows/definitions'); console.log(validateAllFlows());"
```

### 2.3 Event Catalog 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 事件名称，必须与 key 一致 |
| `description` | string | ✅ | 英文描述 |
| `descriptionCN` | string | ❌ | 中文描述 |
| `domain` | EventDomain | ✅ | 所属领域 |
| `eventType` | EventType | ✅ | 事件类型 |
| `payloadType` | string | ✅ | Payload 的 TypeScript 类型名 |
| `producers` | string[] | ✅ | 生产者列表 |
| `consumers` | EventConsumer[] | ✅ | 消费者列表 |
| `triggers` | string[] | ❌ | 下游事件 |
| `requires` | string[] | ❌ | 上游依赖 |
| `version` | string | ❌ | 版本号 |
| `deprecated` | boolean | ❌ | 是否已弃用 |
| `tags` | string[] | ❌ | 标签 |

### 2.4 EventDomain 枚举

```typescript
export enum EventDomain {
  SESSION = "session",       // 会话管理
  MEETING = "meeting",       // 会议生命周期
  FINANCIAL = "financial",   // 财务/计费
  CONTRACT = "contract",     // 合同/服务
  PLACEMENT = "placement",   // 就业安置
  USER = "user",            // 用户管理
  NOTIFICATION = "notification", // 通知
}
```

### 2.5 EventType 枚举

```typescript
export enum EventType {
  TRIGGER = "trigger",           // 触发工作流的事件
  RESULT = "result",             // 操作结果事件
  STATE_CHANGE = "state-change", // 状态转换事件
  INTEGRATION = "integration",   // 跨域集成事件
}
```

### 2.6 查询 Catalog 的 API

```typescript
import {
  EventCatalog,
  getEventEntry,
  getEventsByDomain,
  getEventsByType,
  getEventsByTag,
  getDeprecatedEvents,
  getEventsForHandler,
  getEventsForProducer,
  getDownstreamEvents,
  getUpstreamEvents,
  validateCatalog,
  getCatalogStats,
  generateMermaidDiagram,
} from '@events';

// 获取单个事件信息
const event = getEventEntry('session.booked');

// 按领域查询
const sessionEvents = getEventsByDomain(EventDomain.SESSION);

// 按类型查询
const triggerEvents = getEventsByType(EventType.TRIGGER);

// 按标签查询
const billingEvents = getEventsByTag('billing');

// 查询处理器消费的事件
const handlerEvents = getEventsForHandler('MyEventListener');

// 查询生产者发出的事件
const producerEvents = getEventsForProducer('MyService.myMethod');

// 验证 Catalog 完整性
const validation = validateCatalog();
if (!validation.valid) {
  console.error('Errors:', validation.errors);
}

// 获取统计信息
const stats = getCatalogStats();
// { totalEvents: 38, byDomain: {...}, byType: {...}, ... }
```

---

## 3. Flow Definition 规则

### 3.1 目录结构

```
src/events/flows/definitions/
├── types.ts                       # 流程定义类型
├── session-booking.flow.ts        # 会话预约流程
├── session-completion.flow.ts     # 会话完成流程
├── placement-application.flow.ts  # 就业申请流程
├── settlement.flow.ts             # 结算和申诉流程
└── index.ts                       # 统一注册和查询
```

### 3.2 创建新 Flow 的步骤

#### Step 1: 创建流程定义文件

```typescript
// src/events/flows/definitions/my-feature.flow.ts

import { BusinessFlowDefinition } from "./types";
import { ErrorHandlingStrategy } from "@events/catalog/types";

export const MyFeatureFlow: BusinessFlowDefinition = {
  // 基本信息
  id: "my-feature",                    // 唯一标识符
  name: "My Feature Flow",             // 可读名称
  description: "What this flow does",  // 英文描述
  descriptionCN: "此流程的中文描述",      // 中文描述
  version: "1.0",
  domain: "my-domain",

  // 流程边界
  entryPoint: "my.feature.started",     // 入口事件
  terminationEvents: [                  // 终止事件
    "my.feature.completed",
    "my.feature.failed",
  ],

  // 步骤定义
  steps: [
    {
      id: "step-1",
      name: "Start Processing",
      description: "First step in the flow",
      triggerEvent: "my.feature.started",
      handler: "MyService.startProcessing",
      emitsEvents: ["my.feature.step1.done"],
      next: "step-2",  // 单一下一步
      async: true,
      timeout: 30000,
      retries: 3,
      onError: ErrorHandlingStrategy.RETRY,
    },
    {
      id: "step-2",
      name: "Process Data",
      description: "Main processing step",
      triggerEvent: "my.feature.step1.done",
      handler: "MyService.processData",
      emitsEvents: ["my.feature.completed", "my.feature.failed"],
      // 条件分支
      next: [
        { to: "success-step", condition: "processing succeeded" },
        { to: "failure-step", condition: "processing failed" },
      ],
      onError: ErrorHandlingStrategy.FAIL_FAST,
    },
    {
      id: "success-step",
      name: "Handle Success",
      description: "Success handling",
      triggerEvent: "my.feature.completed",
      handler: "NotificationService",
      onError: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      async: true,
    },
    {
      id: "failure-step",
      name: "Handle Failure",
      description: "Failure handling",
      triggerEvent: "my.feature.failed",
      handler: "AlertService",
      compensationStep: "rollback-step", // Saga 补偿步骤
    },
    {
      id: "rollback-step",
      name: "Rollback",
      description: "Compensate on failure",
      triggerEvent: "internal",
      handler: "MyService.rollback",
    },
  ],

  // Mermaid 图 (用于文档生成)
  mermaidDiagram: `
graph TD
    A[Start Processing] -->|step1.done| B[Process Data]
    B -->|completed| C[Handle Success]
    B -->|failed| D[Handle Failure]
    D --> E[Rollback]
  `,

  // 监控配置
  monitoring: {
    alertOnStepFailure: true,
    maxFlowDuration: 60000,      // 最大流程时长 (毫秒)
    deadLetterQueue: "my-dlq",   // 死信队列
    enableTracing: true,
    metrics: ["my_flow_duration", "my_flow_success_rate"],
  },

  // 元数据
  tags: ["my-domain", "critical-path"],
  owner: "my-team",
  lastUpdated: "2024-12-17",
};
```

#### Step 2: 在 index.ts 中注册

```typescript
// src/events/flows/definitions/index.ts

import { MyFeatureFlow } from "./my-feature.flow";

export const BusinessFlows: BusinessFlowsRegistry = {
  // ... 现有流程
  "my-feature": MyFeatureFlow,
};
```

#### Step 3: 验证流程定义

```typescript
import { validateFlow, validateAllFlows } from '@events';

// 验证单个流程
const result = validateFlow(MyFeatureFlow);
if (!result.valid) {
  console.error('Flow errors:', result.errors);
}

// 验证所有流程
const allResults = validateAllFlows();
```

### 3.3 FlowStep 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 步骤唯一标识 |
| `name` | string | ✅ | 步骤名称 |
| `description` | string | ✅ | 步骤描述 |
| `triggerEvent` | string | ✅ | 触发此步骤的事件 (或 "internal") |
| `handler` | string | ✅ | 处理此步骤的 Handler |
| `emitsEvents` | string[] | ❌ | 此步骤发出的事件 |
| `next` | string \| FlowTransition[] | ❌ | 下一步骤 |
| `timeout` | number | ❌ | 超时时间 (毫秒) |
| `retries` | number | ❌ | 重试次数 |
| `onError` | ErrorHandlingStrategy | ❌ | 错误处理策略 |
| `async` | boolean | ❌ | 是否异步 |
| `compensationStep` | string | ❌ | Saga 补偿步骤 ID |

### 3.4 查询 Flow 的 API

```typescript
import {
  BusinessFlows,
  getAllFlowIds,
  getFlowDefinition,
  getFlowsByDomain,
  getFlowsByTag,
  getFlowsForEvent,
  validateFlow,
  getFlowDiagram,
  getFlowStats,
} from '@events';

// 获取所有流程 ID
const flowIds = getAllFlowIds();
// ["session-booking", "session-completion", ...]

// 获取单个流程
const flow = getFlowDefinition('session-booking');

// 按领域查询
const sessionFlows = getFlowsByDomain('session');

// 获取 Mermaid 图
const diagram = getFlowDiagram('session-booking');

// 获取统计
const stats = getFlowStats();
// { totalFlows: 7, byDomain: {...}, totalSteps: 42, ... }
```

---

## 4. Enhanced Event Bus 使用

### 4.1 启用 EventsModule

```typescript
// app.module.ts

import { EventsModule } from '@events';

@Module({
  imports: [
    EventsModule.forRoot({
      strictValidation: false,      // 严格验证 (未知事件会失败)
      enableTracking: true,         // 启用流追踪
      skipTrackingEvents: [],       // 跳过追踪的高频事件
      enableCorrelationMiddleware: true, // 启用 HTTP 关联 ID 中间件
    }),
  ],
})
export class AppModule {}
```

### 4.2 使用 EnhancedEventBus

```typescript
import { Injectable } from '@nestjs/common';
import { EnhancedEventBus, CorrelationIdProvider } from '@events';

@Injectable()
export class MyService {
  constructor(
    private readonly eventBus: EnhancedEventBus,
    private readonly correlationProvider: CorrelationIdProvider,
  ) {}

  async doSomething() {
    // 发出事件 (自动带有 correlation ID)
    const result = await this.eventBus.emit('my.event', {
      id: '123',
      data: 'payload',
    }, {
      producer: 'MyService.doSomething', // 可选，指定生产者
      skipValidation: false,              // 可选，跳过验证
      skipTracking: false,                // 可选，跳过追踪
    });

    if (result.success) {
      console.log(`Event ID: ${result.eventId}`);
      console.log(`Correlation ID: ${result.correlationId}`);
    } else {
      console.error(`Failed: ${result.error}`);
    }
  }

  // 在 Handler 中获取元数据
  @OnEvent('other.event')
  handleOtherEvent(payload: any) {
    // 提取事件元数据
    const metadata = EnhancedEventBus.extractMetadata(payload);
    if (metadata) {
      console.log(`Correlation: ${metadata.correlationId}`);
      console.log(`Depth: ${metadata.depth}`);
      console.log(`Causation: ${metadata.causationId}`);
    }
  }
}
```

### 4.3 使用 CorrelationIdProvider

```typescript
import { CorrelationIdProvider } from '@events';

@Injectable()
export class MyService {
  constructor(private readonly correlation: CorrelationIdProvider) {}

  async processInContext() {
    // 获取当前 correlation ID
    const correlationId = this.correlation.getCorrelationId();

    // 获取完整上下文
    const context = this.correlation.getContext();
    // { correlationId, causationId, rootCorrelationId, depth, startTime, userId, origin }

    // 在新的 correlation 上下文中运行
    await this.correlation.runWithCorrelationAsync(async () => {
      // 在这里的所有操作都有相同的 correlation ID
      await this.doWork();
    }, {
      origin: 'MyService.processInContext',
    });
  }
}
```

### 4.4 使用 EventFlowTracker

```typescript
import { EventFlowTracker } from '@events';

@Injectable()
export class MyService {
  constructor(private readonly flowTracker: EventFlowTracker) {}

  debugFlow(rootCorrelationId: string) {
    // 获取流程信息
    const flow = this.flowTracker.getFlow(rootCorrelationId);

    // 获取流程摘要
    const summary = this.flowTracker.getFlowSummary(rootCorrelationId);
    console.log(summary);
    // "Flow abc123: events=5 completed=5 maxDepth=3 duration=1234ms"

    // 生成序列图
    const diagram = this.flowTracker.generateFlowDiagram(rootCorrelationId);

    // 获取统计
    const stats = this.flowTracker.getStats();
    // { activeFlows: 2, completedFlows: 100, totalEvents: 500, avgEventsPerFlow: 5 }
  }
}
```

---

## 5. Saga Orchestrator 编写指南

> 本项目已实现可用的 `SagaOrchestrator`（`src/events/sagas/saga-orchestrator.ts`），并落地了一个示例 `SessionBookingSaga`。本章既是使用指南，也会说明当前实现的边界/限制（尤其适合第一次写 Saga 的同学）。

### 5.1 Saga 模式概述

Saga 模式用于处理跨多个服务的长事务，支持补偿逻辑回滚。

```
┌─────────┐    ┌─────────┐    ┌─────────┐
│  Step 1 │───▶│  Step 2 │───▶│  Step 3 │
└─────────┘    └─────────┘    └─────────┘
     │              │              │
     ▼              ▼              ▼
┌─────────┐    ┌─────────┐    ┌─────────┐
│Compensate│◀───│Compensate│◀───│Compensate│
│    1    │    │    2    │    │    3    │
└─────────┘    └─────────┘    └─────────┘
```

### 5.2 什么时候应该用 SagaOrchestrator？

建议在满足以下任一条件时使用 Saga：

1. **包含外部副作用**：调用第三方 API、发短信/邮件、创建会议等（这些通常无法参与 DB 事务）。
2. **跨多个模块/表的联动更新**：需要“按步骤推进”，并在失败时做补偿或通知人工介入。
3. **需要重试/超时策略**：例如外部 API 不稳定，需要指数退避重试，且必须可观测。

不建议用 Saga 的场景：

- 纯数据库内的简单写操作（直接用事务即可）
- 需要跨进程/跨服务、可能持续很久的长事务（当前实现**无持久化/断点续跑**，见 5.4）

### 5.3 SagaOrchestrator（当前实现）能力与限制

**已支持：**

- 顺序执行 `steps[]`
- 单步 `timeout` / `retries` / 指数退避 `retryDelay`
- 失败时按逆序执行 `compensate()`
- 通过 `saga.*` 事件发出过程信号（便于日志/观测）

**未支持（需要额外设计/演进）：**

- Saga 状态持久化（进程重启会丢）
- 断点续跑/人工重试/查询 Saga 状态的 API
- 基于消息队列的异步调度、DLQ、Outbox 等可靠投递能力

### 5.4 Step-by-step：写一个新的 Saga（推荐流程）

下面以“新人也能照抄落地”的方式给出步骤：

#### Step 1: 划定 Saga 边界 + 定义输入输出

1. 找到你的流程里“**必须先提交数据库**”的同步部分（例如：创建记录、占用资源、写入状态）
2. 把“外部副作用 + 后续补齐信息”的部分放到 Saga（例如：调用第三方创建会议、回写 meetingId）
3. 定义 `Input/Output`（尽量只放 ID/必要字段）

#### Step 2: 列出步骤（Step）与补偿（Compensation）

每个步骤都问自己三件事：

1. 这个步骤失败是否要让 Saga 失败？（`onError: FAIL | SKIP`）
2. 这个步骤需要补偿吗？（如果产生外部副作用，通常需要）
3. 这个步骤需要重试/超时吗？（外部 API 基本都需要）

#### Step 3: 用 `SagaDefinition` 描述 Saga

（可参考现有 `src/events/sagas/session-booking.saga.ts` 的结构：`definition + execute()`）

#### Step 4: 用 `SagaOrchestrator.execute()` 运行

常见触发点：

- 在 `@OnEvent(...)` handler 里：收到某个“创建完成/触发”事件后运行
- 在 Command 里：事务提交后触发（切记不要把外部 API 调用放在 DB 事务里）

#### Step 5: 把“结果事件”放在最后一步发出

经验法则：最后一步发出 `xxx.completed/xxx.failed`，让下游订阅者只关心结果，不关心中间细节。

#### Step 6: 更新 Event Catalog + Flow Definitions

1. 给新的事件补齐 catalog entry（生产者/消费者）
2. 给复杂流程补一份 flow definition（用于可视化与对齐）

#### Step 7: 注册到 Module 并做最小化验证

- Saga class/handler class 必须是 module 的 provider
- 跑 `catalog.spec.ts`，确保 catalog 没破

### 5.5 Session Booking（概览）

Session Booking 属于本项目最复杂、也最容易“以为已经迁移但其实没覆盖全”的流程之一，因此单独开了一章做对齐与说明（见第 6 章）。

你只需要记住两个结论：

1. **Counselor Portal 的 session 创建（`{session_type}.session.created`）已经走异步 meeting 创建链路**，其中 `regular_mentoring` 使用了 `SessionBookingSaga`。
2. **Legacy 的 `BookSessionCommand` 仍然是同步逻辑（meeting 仍在 DB 事务内创建）**，目前未迁移到 Saga。

### 5.6 兼容：`SagaBase`（同步事务内编排）

项目中已有 `src/application/core/saga.base.ts`：

```typescript
import { SagaBase } from '@application/core/saga.base';

@Injectable()
export class MyComplexSaga extends SagaBase {
  constructor(
    eventEmitter: EventEmitter2,
    private readonly serviceA: ServiceA,
    private readonly serviceB: ServiceB,
  ) {
    super(eventEmitter);
  }

  async execute(input: MyInput): Promise<MyOutput> {
    // 使用 coordinateSteps 执行多步骤操作
    return this.coordinateSteps(async () => {
      // Step 1
      const resultA = await this.serviceA.doSomething(input);

      // Step 2
      const resultB = await this.serviceB.doSomethingElse(resultA);

      // 发出事件
      this.emitEvent('my.saga.completed', { result: resultB });

      return resultB;
    });
  }
}
```

> `SagaBase` 更像是“有事务的 Command 编排基类”，适用于**纯 DB 内**的多步骤操作；而 `SagaOrchestrator` 面向的是“包含外部副作用 + 需要补偿/重试”的流程。

### 5.7 未来演进建议（复杂流程/跨进程场景）

如果你要做“更复杂、更可靠”的长事务（例如需要跨进程、需要重启后继续），建议在当前基础上补齐：

1. **Outbox / Inbox（可靠投递 + 去重）**：保证事件不丢、不重放造成副作用
2. **Saga State 持久化**：把 `context.executedSteps/stepResults/status` 落库
3. **可操作的运维能力**：查询 Saga、人工重试某步、触发补偿、DLQ
4. **统一观测**：把 `saga.*` 事件接入 metrics/logs/tracing

这些属于 Stage 5/6 级别能力（当前仓库尚未实现），但不影响你用现有 `SagaOrchestrator` 解决“单进程内的外部副作用编排”问题。

---

## 6. Session Booking 改造详解

> 这一章以“按代码走读”的方式解释 session booking 的改造：改了什么、为什么这么改、是否改变业务语义、以及后续如何扩展/迁移。

### 6.1 改造目标

1. **把外部副作用从数据库事务里移出去**：会议创建/更新/取消是第三方调用，不应拖长 DB 事务或导致锁占用。
2. **让 API 立即返回**：同步部分只做“可回滚的本地写入”（hold/slot/session），meetingUrl 等信息异步补齐。
3. **用事件表达业务语义**：用 `{session_type}.session.created` 表达“会话记录已创建”，用 `session.booked` 表达“会议已创建且可预约确认”。
4. **失败可观测、可人工介入**：meeting 创建失败时把 session 标记到明确失败状态，并发布统一 result 事件通知 counselor。

### 6.2 入口与覆盖范围（先看这张表，避免误判）

| 入口 | 典型 API | meeting 创建时机 | 是否走 `{session_type}.session.created` | 是否用 SagaOrchestrator | 备注 |
|------|----------|------------------|----------------------------------------|--------------------------|------|
| Counselor Portal（推荐） | `/api/services/sessions` / `/api/services/regular-mentoring` 等 | 异步（事务外） | ✅ | `regular_mentoring` ✅（`SessionBookingSaga`） | 其他类型目前多为普通 handler |
| Legacy booking | `/api/sessions`（`BookSessionCommand`） | 同步（事务内） | ❌ | ❌ | 仍保留，未迁移到 Saga |

**API 行为（给调用方/前端的心智模型）：**

- 异步链路的创建接口通常会立即返回 `sessionId` + `status=PENDING_MEETING`（此时 meetingUrl 还没有）。
- 调用方需要轮询对应的查询接口（`GET /api/services/{sessionType}/:id` 或统一接口的查询）等待状态变为 `SCHEDULED` 后获取 meetingUrl。
- Legacy 的 `BookSessionCommand` 入口通常会同步返回 meetingUrl（因为 meeting 在事务内创建）。

### 6.3 Booking 相关事件与语义（你应该订阅哪个？）

| 事件 | 类型 | 语义 | 典型 Producer | 典型 Consumer |
|------|------|------|---------------|---------------|
| `{session_type}.session.created` | TRIGGER | 会话记录已创建，meeting 需要异步创建 | `*Service.createSession()`（应用层） | `*CreatedEventHandler` |
| `session.booked` | RESULT | meeting 已创建 + session 已补齐，可用于“发送预约成功通知”等 | `SessionBookingSaga` / 各类 handler / `BookSessionCommand` | 通知/下游工作流 |
| `{session_type}.session.meeting.operation.result` | RESULT | meeting 的 create/update/cancel 结果（success/failed） | Saga/handler | 通知 + 人工介入流程 |

> 经验法则：下游若只关心“最终成功/失败”，订阅 `...operation.result`；若只在“真的能加入会议”后才做事，订阅 `session.booked`。

### 6.4 状态与数据写入点（是否改变原有逻辑的关键）

以“异步创建 meeting”的 sessionType 为例（如 `regular_mentoring`）：

1. **同步事务内写入**（必须可回滚）：
   - 创建 service hold（可选，取决于是否计费）
   - 创建 mentor/student 的 calendar slots（不含 meetingUrl）
   - 创建 session 记录：`meetingId = null`，`status = PENDING_MEETING`
2. **异步补齐**（事务外调用第三方）：
   - 创建 meeting（飞书/Zoom）
   - 更新 session：写入 `meetingId`，并把 `status` 从 `PENDING_MEETING` 变为 `SCHEDULED`
   - 更新 calendar slot：补齐 `meeting_id` 与 metadata.meetingUrl
   - 发布 `session.booked`（以及 result 事件）

**是否改变业务语义？**

- 成功路径：`session.booked` 仍然代表“会议已创建且可用”，业务含义不变，只是发生时间从“同步立即”变为“异步稍后”。
- 失败路径：新增了更明确的失败状态 `MEETING_FAILED`（用于人工介入），避免 silent failure。

**关于 service hold（计费/余额）的一点提醒：**

- 预占（hold）是否需要创建取决于 sessionType 是否计费；即使创建了 hold，也需要在 sessionId 确定后把 `service_holds.related_booking_id` 写成 `sessionId`，否则后续“按 sessionId 释放预占/记录消耗”的逻辑无法关联到正确的 hold。
- 目前仓库里已经提供了 `ServiceHoldService.updateRelatedBooking(holdId, sessionId, tx)`，但在部分 booking 链路中尚未看到完整接入；实现新 sessionType 时建议把它作为同步事务内的标准步骤补齐。

### 6.5 Regular Mentoring（Saga 版，当前落地）

#### 6.5.1 同步部分：创建 session（不创建 meeting）

- 应用层：`src/application/commands/services/regular-mentoring.service.ts`
  - 事务内：创建 hold + 两个 calendar slot + session（`PENDING_MEETING`）
  - 事务外：`emit(REGULAR_MENTORING_SESSION_CREATED_EVENT, ...)`

#### 6.5.2 异步部分：事件触发 Saga 编排

触发链路：

1. 监听：`src/application/commands/services/regular-mentoring-event.handler.ts`（`@OnEvent(REGULAR_MENTORING_SESSION_CREATED_EVENT)`）
2. 编排：`src/events/sagas/session-booking.saga.ts`（由 `src/events/sagas/saga-orchestrator.ts` 执行）

Saga 步骤（简化版）：

| Step | 主要动作 | 失败时怎么做 | 备注 |
|------|----------|--------------|------|
| create-meeting | 调用 `MeetingManagerService.createMeeting()`（带重试/超时） | 已创建则补偿 `cancelMeeting` | 外部副作用，最关键 |
| update-session | `completeMeetingSetup()` 写 meetingId + 状态变更 | Saga 失败后整体会标记 `MEETING_FAILED` | 本地写入 |
| update-calendar | `updateSlotWithSessionAndMeeting()` 写 meetingUrl | 非关键步骤，失败可跳过 | 可能需要运营修复 |
| publish-events | 发 `session.booked` + `...operation.result(success)` | 非关键步骤，失败可跳过 | 下游仅感知结果 |

失败处理（重要）：

- Saga 失败后会：
  - 最佳努力补偿：如果 meeting 已创建则取消
  - 把 session 标记为 `MEETING_FAILED`（便于人工处理）
  - 发布 `REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT`（`status=failed`，`notifyRoles=["counselor"]`）

### 6.6 其他 sessionType（当前多为 Handler 版）

`gap_analysis / ai_career / comm_session / class_session` 目前的 meeting 创建链路主要在各自的 `*CreatedEventHandler` 内完成：

- 创建 meeting（部分类型带 `retryWithBackoff`）
- 用 DB 事务更新 session + calendar slots
- 发布 `session.booked` + `...operation.result`

建议：如果你希望统一“重试/补偿/步骤可观测”，可以为这些 sessionType 增加各自的 `XxxSessionBookingSaga`（复用同一个 `SagaOrchestrator`）。

### 6.7 Legacy：`BookSessionCommand`（同步事务版，仍在用）

当前 `src/application/commands/booking/book-session.command.ts` 仍是：

- 事务内：创建 hold + calendar slots + **创建 meeting** + 创建 session + 更新 slot
- 事务外：`emit(session.booked)`

因此本次 session booking 的“Saga 改造”并不覆盖这条入口；是否迁移取决于你是否接受“API 改为异步补齐 meetingUrl（需要前端轮询）”的交互变化。

### 6.8 扩展/迁移 Checklist：把一个新 sessionType 接入 booking 流程

以新增 `mock_interview` 为例（按顺序做）：

1. 在 `src/shared/events/event-constants.ts` 增加：
   - `MOCK_INTERVIEW_SESSION_CREATED_EVENT`
   - `MOCK_INTERVIEW_SESSION_MEETING_OPERATION_RESULT_EVENT`
2. 在 `src/shared/events/` 定义 payload 类型，并在 `src/shared/events/index.ts` 导出
3. 在 `src/events/catalog/session-events.catalog.ts` 注册 catalog entry（producer/consumer 写清楚）
4. 在应用层 `*Service.createSession()` 里完成同步事务写入，并在事务外 `emit(MOCK_INTERVIEW_SESSION_CREATED_EVENT, ...)`
5. 实现 `MockInterviewCreatedEventHandler`：
   - 简单版本：在 handler 里做 meeting create + session/calendar 更新 + 发事件
   - 复杂版本：写 `MockInterviewSessionBookingSaga` 并用 `SagaOrchestrator.execute()` 执行
6. 把 handler/saga 注册到对应 module 的 `providers`（常见：`src/application/application.module.ts`）
7.（推荐）更新 `src/events/flows/definitions/session-booking.flow.ts` 的 `SessionTypeMapping`（文档对齐）
8. 跑最小验证：
   - `npm run test -- --testPathPatterns="catalog.spec.ts"`
   - `npx ts-node -r tsconfig-paths/register -e "const {validateAllFlows}=require('./src/events/flows/definitions'); console.log(validateAllFlows());"`

### 6.9 常见问题（排错指南）

1. **Session 一直停在 `PENDING_MEETING`**：通常是 handler 没注册进 module / handler 抛错 / 外部 meeting API 失败。
2. **Session 变成 `MEETING_FAILED`**：需要人工介入；可根据 `...operation.result` 的错误信息决定是否重试创建 meeting。
3. **Session 已 `SCHEDULED` 但 calendar 没有 meetingUrl**：当前 `update-calendar` 可能被跳过（非关键步骤），可用 `CalendarService.updateSlotWithSessionAndMeeting()` 修复。
4. **重复创建 meeting（同一个 session 出现多个 meeting）**：典型原因是事件重复触发/重放但缺少幂等保护；建议在创建 meeting 前先检查 session 是否已有 `meetingId`，必要时为“创建 meeting”加幂等键或落库去重。
5. **hold 没有在完成/取消时释放**：先检查 `service_holds.related_booking_id` 是否被写入了 `sessionId`，以及完成事件是否携带了正确的 `sessionId/serviceType`。

---

## 7. 本次实现变更记录

### 7.1 变更概述

| 变更类型 | 数量 | 说明 |
|---------|------|------|
| 新增文件 | 18 | 事件架构核心文件 |
| 修改文件 | 2 | tsconfig.json, jest.config.js |
| 新增测试 | 41 | catalog.spec.ts |
| 新增事件目录 | 38 | 5 个领域的事件 |
| 新增流程定义 | 7 | 业务流程定义 |

### 7.2 新增文件清单

#### Event Catalog (8 files)

| 文件 | 说明 |
|------|------|
| `src/events/catalog/types.ts` | Catalog 类型定义 (EventCatalogEntry, ConsumerPriority, etc.) |
| `src/events/catalog/session-events.catalog.ts` | 24 个会话领域事件 |
| `src/events/catalog/meeting-events.catalog.ts` | 3 个会议生命周期事件 |
| `src/events/catalog/financial-events.catalog.ts` | 6 个财务领域事件 |
| `src/events/catalog/placement-events.catalog.ts` | 3 个就业领域事件 |
| `src/events/catalog/contract-events.catalog.ts` | 2 个合同领域事件 |
| `src/events/catalog/index.ts` | 统一导出和查询函数 |
| `src/events/catalog/catalog.spec.ts` | 41 个单元测试 |

#### Flow Definitions (6 files)

| 文件 | 说明 |
|------|------|
| `src/events/flows/definitions/types.ts` | 流程定义类型 |
| `src/events/flows/definitions/session-booking.flow.ts` | 会话预约流程 (含 5 种会话类型映射) |
| `src/events/flows/definitions/session-completion.flow.ts` | 会话完成 + 录制流程 |
| `src/events/flows/definitions/placement-application.flow.ts` | 就业申请 + 回滚流程 |
| `src/events/flows/definitions/settlement.flow.ts` | 结算 + 申诉流程 |
| `src/events/flows/definitions/index.ts` | 流程注册和验证 |

#### Infrastructure (5 files)

| 文件 | 说明 |
|------|------|
| `src/events/infrastructure/correlation-id.provider.ts` | Correlation ID 提供器 (AsyncLocalStorage) |
| `src/events/infrastructure/event-flow-context.ts` | 事件流追踪器 |
| `src/events/infrastructure/enhanced-event-bus.ts` | 增强事件总线 |
| `src/events/infrastructure/index.ts` | 基础设施导出 |
| `src/events/events.module.ts` | NestJS 模块 |

#### Module Exports (2 files)

| 文件 | 说明 |
|------|------|
| `src/events/index.ts` | 主模块导出 |
| `src/events/flows/index.ts` | 流程模块导出 |

### 7.3 修改文件清单

| 文件 | 变更 |
|------|------|
| `tsconfig.json` | 添加 `@events/*` 路径别名 |
| `jest.config.js` | 添加 `@events/*` 模块映射 |

### 7.4 Catalog 统计

```
Total Events: 38
By Domain:
  - session: 24 events
  - meeting: 3 events
  - financial: 6 events
  - placement: 3 events
  - contract: 2 events
By Type:
  - trigger: 16 events
  - result: 9 events
  - state-change: 13 events
Deprecated Events: 2
Total Consumers: 51
Total Producers: 60
```

### 7.5 Flow 统计

```
Total Flows: 7
By Domain:
  - session: 3 flows
  - placement: 2 flows
  - financial: 2 flows
Total Steps: 36
Critical Path Flows: 2
```

### 7.6 待完成事项

| 阶段 | 状态 | 说明 |
|------|------|------|
| Stage 1: Event Catalog | ✅ 完成 | 38 事件已注册 |
| Stage 2: Enhanced Event Bus | ✅ 完成 | 基础设施已实现 |
| Stage 3: Saga Orchestrator | ⚠️ 部分完成 | 已实现 Orchestrator + SessionBookingSaga，但仅覆盖部分 booking 入口 |
| Stage 4: Flow Definitions | ✅ 完成 | 7 流程已定义（文档/可视化用途） |
| Stage 5: Observability | ⏳ 待实现 | 指标、AsyncAPI、死信队列 |

---

## 附录

### A. 常用导入

```typescript
// 完整导入
import {
  // Module
  EventsModule,

  // Catalog
  EventCatalog,
  EventDomain,
  EventType,
  ConsumerPriority,
  getEventEntry,
  getEventsByDomain,
  validateCatalog,

  // Infrastructure
  EnhancedEventBus,
  CorrelationIdProvider,
  EventFlowTracker,

  // Flows
  BusinessFlows,
  getFlowDefinition,
  validateAllFlows,
} from '@events';
```

### B. 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 事件常量 | `{DOMAIN}_{ENTITY}_{ACTION}_EVENT` | `REGULAR_MENTORING_SESSION_CREATED_EVENT` |
| 事件名称 | `{domain}.{entity}.{action}` | `regular_mentoring.session.created` |
| 流程 ID | `{feature}-{action}` | `session-booking`, `mentor-appeal` |
| Handler | `{Entity}{Action}Handler/Listener` | `SessionCompletedListener` |

### C. 相关文档

- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - 实现计划详情
- [CLAUDE.md](../CLAUDE.md) - 项目开发指南
- [NestJS Event Emitter](https://docs.nestjs.com/techniques/events) - 官方文档
