# 事件处理迁移指南：从 Domain 到 Application

本文档详细说明如何将事件监听器从 Domain 层迁移到 Application 层，以符合领域驱动设计 (DDD) 和整洁架构原则。

## 核心原则

1.  **Domain (领域层)**：只负责**定义**事件 (`*.event.ts`) 和**产生**事件 (在聚合根中 `addDomainEvent`)。**绝不消费事件**。
2.  **Application (应用层)**：负责**消费**事件 (`*.handler.ts`)。它作为指挥官，协调多个领域服务执行业务逻辑，并负责事务管理。

---

## 案例一：迁移 Contract 域的监听器

**目标**：将 `Contract` 域监听“服务会话完成”的逻辑迁移到应用层。

### 1. 现状 (Before)
*   **文件位置**: `src/domains/contract/events/listeners/session-completed-listener.ts`
*   **问题**: Domain 层依赖了 `@nestjs/event-emitter` 和数据库连接，且包含应用编排逻辑。

### 2. 迁移步骤 (Step-by-Step)

#### 第一步：在 Application 层创建新目录和文件
创建文件：`src/application/event-handlers/contract/service-session-completed.handler.ts`

```typescript
import { Injectable, Logger, Inject } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  IServiceSessionCompletedEvent,
  SERVICE_SESSION_COMPLETED_EVENT,
} from "@shared/events/service-session-completed.event";
import { ServiceHoldService } from "@domains/contract/services/service-hold.service";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DrizzleDatabase } from "@shared/types/database.types";
import { eq, and } from "drizzle-orm";
import * as schema from "@infrastructure/database/schema";
import { HoldStatus } from "@shared/types/contract-enums";

/**
 * Service Session Completed Handler
 * 应用层事件处理器：处理服务会话完成后的合同履约逻辑
 */
@Injectable()
export class ServiceSessionCompletedHandler {
  private readonly logger = new Logger(ServiceSessionCompletedHandler.name);

  constructor(
    // 注入领域服务 (Domain Services)
    private readonly serviceHoldService: ServiceHoldService,
    private readonly serviceLedgerService: ServiceLedgerService,
    // 注入基础设施 (Infrastructure)
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  @OnEvent(SERVICE_SESSION_COMPLETED_EVENT)
  async handle(event: IServiceSessionCompletedEvent): Promise<void> {
    const { sessionId, studentId, sessionTypeCode, actualDurationHours } = event.payload || {};
    
    this.logger.log(`[Application] Handling session completed: ${sessionId}`);

    // 1. 纯读取逻辑（可以直接在这里做，也可以封装到 Query Service）
    const activeHolds = await this.db.query.serviceHolds.findMany({
        where: and(
            eq(schema.serviceHolds.studentId, studentId),
            eq(schema.serviceHolds.serviceType, sessionTypeCode),
            eq(schema.serviceHolds.status, HoldStatus.ACTIVE),
            eq(schema.serviceHolds.relatedBookingId, sessionId),
        )
    });

    // 2. 开启事务 (Application 层的职责)
    await this.db.transaction(async (tx) => {
        // 3. 指挥 Domain Service 执行核心业务
        if (activeHolds.length > 0) {
           await this.serviceHoldService.releaseHold(activeHolds[0].id, "completed", tx);
        }
        
        const quantity = Math.ceil(actualDurationHours || 1);
        await this.serviceLedgerService.recordConsumption({
            studentId,
            serviceType: sessionTypeCode,
            quantity,
            relatedBookingId: sessionId,
            bookingSource: "regular_mentoring_sessions",
            createdBy: studentId, 
        }, tx);
    });
  }
}
```

#### 第二步：注册 Handler
在 `src/application/application.module.ts` (或其他相关 module) 的 `providers` 数组中添加 `ServiceSessionCompletedHandler`。

#### 第三步：清理旧代码
删除 `src/domains/contract/events/listeners/session-completed-listener.ts` 文件。

---

## 案例二：迁移 Regular Mentoring 的会议监听器

**目标**：将 `RegularMentoring` 域监听“会议结束”的逻辑迁移到应用层。

### 1. 现状 (Before)
*   **文件位置**: `src/domains/services/sessions/regular-mentoring/listeners/regular-mentoring-event.listener.ts`
*   **问题**: Domain Service 监听外部事件 (`MEETING_LIFECYCLE_COMPLETED_EVENT`)，导致依赖反转（业务依赖了外部消息）。

### 2. 迁移步骤 (Step-by-Step)

#### 第一步：在 Application 层创建新文件
创建文件：`src/application/event-handlers/services/regular-mentoring-meeting-completed.handler.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
// 引用领域服务接口，而非具体实现（如果可能）
import { RegularMentoringService } from '@domains/services/sessions/regular-mentoring/services/regular-mentoring.service';
import {
  MeetingLifecycleCompletedPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events';

@Injectable()
export class RegularMentoringMeetingCompletedHandler {
  private readonly logger = new Logger(RegularMentoringMeetingCompletedHandler.name);

  constructor(
    private readonly regularMentoringService: RegularMentoringService,
  ) {}

  @OnEvent(MEETING_LIFECYCLE_COMPLETED_EVENT)
  async handle(payload: MeetingLifecycleCompletedPayload): Promise<void> {
    this.logger.log(`[Application] Handling meeting completion for: ${payload.meetingId}`);

    // 应用层负责协调：先查，再改
    const session = await this.regularMentoringService.findByMeetingId(payload.meetingId);

    if (session) {
        // 调用 Domain Service 的方法来变更状态
        // 注意：这里最好也在一个事务中，虽然当前业务逻辑可能只有一步
        await this.regularMentoringService.completeSession(session.id, payload);
    }
  }
}
```

#### 第二步：注册 Handler
在 `src/application/application.module.ts` 中注册 `RegularMentoringMeetingCompletedHandler`。

#### 第三步：清理旧代码
删除 `src/domains/services/sessions/regular-mentoring/listeners/regular-mentoring-event.listener.ts`。

---

## 总结：目录结构变化

### 迁移前
```
src/
├── domains/
│   ├── contract/
│   │   └── events/
│   │       └── listeners/
│   │           └── session-completed-listener.ts  <-- 污染 Domain
│   └── services/
│       └── regular-mentoring/
│           └── listeners/
│               └── regular-mentoring-event.listener.ts <-- 污染 Domain
```

### 迁移后
```
src/
├── application/
│   └── event-handlers/  <-- 新增统一目录
│       ├── contract/
│       │   └── service-session-completed.handler.ts
│       └── services/
│           └── regular-mentoring-meeting-completed.handler.ts
├── domains/
│   ├── contract/  <-- 纯净
│   └── services/  <-- 纯净
```

通过这种方式，你的 Domain 层变得非常“轻”，只包含核心业务规则，没有任何事件监听的代码。所有“听到消息后该干什么”的逻辑都安全地放在了 Application 层。