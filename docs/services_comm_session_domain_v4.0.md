# Services Comm Session Domain 设计文档 v4.0

**文档版本**: v4.0  
**更新日期**: 2025-12-01  
**模块路径**: `src/domains/services/comm-sessions`  
**定位**: 业务领域层 (Domain Layer) - Comm Sessions 子域，负责内部沟通课时的业务逻辑实现，通过聚合根管理业务状态，并响应 Core 层的会议生命周期事件。  
**依赖关系**: 依赖 `src/core/meeting` (仅通过 ID 引用和事件订阅)，被 `src/application` 层调用。

**核心特性** ⭐:
1. **内部沟通课时**：用于学生与内部导师/顾问的沟通会话
2. **不计费特性**：完成后不触发导师费用计算，不登记到 service_references ⭐
3. **不发布完成事件**：不发布 `services.session.completed` 事件，下游无需监听 ⭐
4. **简化流程**：会议完成后仅更新 comm_sessions 表状态即可
5. **独立状态管理**：状态（scheduled/completed/cancelled/deleted）独立管理

---

## 📂 1. 目录结构

```text
src/
├── api/                                      # API 层
│   └── controllers/
│       └── services/
│           └── comm-sessions.controller.ts   # 沟通课时 API

├── application/                              # 应用层
│   ├── commands/
│   │   └── services/
│   │       ├── create-comm-session.command.ts
│   │       └── update-comm-session.command.ts
│   └── queries/
│       └── services/
│           └── get-comm-sessions.query.ts

└── domains/                                  # 领域层
    └── services/
        └── comm-sessions/                    # 【沟通课时子域】⭐
            ├── entities/
            │   └── comm-session.entity.ts
            ├── services/
            │   ├── comm-session.service.ts
            │   └── comm-session-query.service.ts
            ├── listeners/
            │   └── comm-session-event.listener.ts
            ├── dto/
            │   ├── create-comm-session.dto.ts
            │   └── update-comm-session.dto.ts
            └── comm-session.repository.ts
```

---

## 💾 2. 数据库设计

### 2.1 comm_sessions 表 (沟通课时)

**职责**: 管理内部沟通课时的业务信息和生命周期

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | PK | uuid_generate_v4() | 主键 |
| `meeting_id` | UUID | FK (meetings.id), UNIQUE | - | 关联的会议 ID（1:1 关系） |
| `session_type` | VARCHAR(50) | NOT NULL | `comm_session` | 会话类型（固定值）⭐ |
| `student_user_id` | UUID | NOT NULL, FK (users.id) | - | 学生的用户 ID |
| `mentor_user_id` | UUID | FK (users.id) | - | 导师的用户 ID（如果是导师沟通）⭐ |
| `counselor_user_id` | UUID | FK (users.id) | - | 顾问的用户 ID（如果是顾问沟通）⭐ |
| `created_by_counselor_id` | UUID | NOT NULL, FK (users.id) | - | 创建该课时的顾问 ID（记录操作人）⭐ |
| `title` | VARCHAR(255) | NOT NULL | - | 课时标题 |
| `description` | TEXT | | - | 课时描述 |
| `status` | VARCHAR(20) | NOT NULL | `scheduled` | 状态 Enum: `scheduled`, `completed`, `cancelled`, `deleted` |
| `scheduled_at` | TIMESTAMPTZ | NOT NULL | - | 预约开始时间 |
| `completed_at` | TIMESTAMPTZ | | - | 完成时间 |
| `cancelled_at` | TIMESTAMPTZ | | - | 取消时间 |
| `deleted_at` | TIMESTAMPTZ | | - | 软删除时间 |
| `ai_summaries` | JSONB | | `'[]'::jsonb` | AI 生成的课时摘要 |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**索引**:
- `idx_comm_session_meeting` (meeting_id)
- `idx_comm_session_mentor_scheduled` (mentor_user_id, scheduled_at DESC)
- `idx_comm_session_student_scheduled` (student_user_id, scheduled_at DESC)
- `idx_comm_session_status` (status)

**CHECK 约束**:
```sql
CHECK (session_type = 'comm_session')
CHECK (status IN ('scheduled', 'completed', 'cancelled', 'deleted'))
```

**字段说明** ⭐:

| 场景 | mentor_user_id | counselor_user_id | created_by_counselor_id |
|:---|:---|:---|:---|
| 导师友情沟通 | ✅ 导师ID | NULL | 创建者顾问ID |
| 主顾问沟通 | NULL | ✅ 主顾问ID | 主顾问ID |
| 副顾问创建，主顾问沟通 | NULL | ✅ 主顾问ID | 副顾问ID ⭐ |
| 副顾问沟通 | NULL | ✅ 副顾问ID | 副顾问ID |

**核心职责**:
- ✅ 存储沟通课时的业务信息（title, description, ai_summaries）
- ✅ 管理业务生命周期（状态机）
- ✅ 监听 `MeetingLifecycleCompletedEvent`，更新状态为 completed
- ❌ **不登记到 service_references**（不计费）⭐
- ❌ **不发布 services.session.completed 事件**（下游无需监听）⭐

**不承担的职责**:
- ❌ 不管理会议技术细节（meeting_no、meeting_url 等）
- ❌ 不处理 Webhook 事件（由 Core/Meeting 处理）
- ❌ 不计算实际时长（由 Core/Meeting 计算）

---

## 🛠️ 3. 核心 Services 设计

### 3.1 CommSessionService

**文件**: `src/domains/services/comm-sessions/services/comm-session.service.ts`

**核心方法**:

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `createSession(dto)` | `CreateCommSessionDto` | `Promise<CommSessionEntity>` | **创建沟通课时**。<br>接收 App 层传入的 meetingId，创建业务记录。<br>Initial Status: `scheduled`。 |
| `updateSession(id, dto)` | `id, UpdateCommSessionDto` | `Promise<CommSessionEntity>` | **更新课时信息**。<br>支持修改 title、description、scheduled_at 字段。 |
| `cancelSession(id, reason)` | `sessionId, reason` | `Promise<void>` | **取消课时**。<br>1. 更新 status = `cancelled`<br>2. 设置 cancelled_at<br>**注意：Calendar 更新和 Meeting 取消由 Application 层编排**。 |
| `deleteSession(id)` | `sessionId` | `Promise<void>` | **软删除操作**。<br>1. 更新 status = `deleted`<br>2. 设置 deleted_at。 |
| `completeSession(sessionId, payload)` | `sessionId, MeetingLifecycleCompletedPayload` | `Promise<void>` | **事件驱动**（监听器调用）⭐。<br>1. 更新 status = `completed`<br>2. 设置 completed_at<br>**注意：不登记服务，不发布事件**。 ⭐ |
| `findByMeetingId(meetingId)` | `UUID` | `Promise<CommSessionEntity \| null>` | **查询方法**。<br>根据 meeting_id 查找课时（用于事件监听器）。 |
| `getSessionById(id)` | `UUID` | `Promise<CommSessionEntity>` | **查询方法**。<br>获取课时详情。 |

**依赖注入**:
- `CommSessionRepository`

**特别说明** ⭐:
- **不注入** `ServiceRegistryService`（无需登记服务）
- **不注入** `EventEmitter`（无需发布任何事件）⭐
- **不发布** `services.session.completed` 事件（无需通知下游）
- Calendar 更新由 **Application 层编排**（与 cancelSession 保持一致）⭐

---

### 3.2 CommSessionQueryService

**文件**: `src/domains/services/comm-sessions/services/comm-session-query.service.ts`

**职责**: 单模块查询（仅查询 comm_sessions 表）

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `getMentorSessions(mentorId, filters)` | `UUID, SessionFiltersDto` | `Promise<CommSessionEntity[]>` | 获取导师的沟通课时列表。<br>**默认过滤 status != 'deleted'**。 |
| `getStudentSessions(studentId, filters)` | `UUID, SessionFiltersDto` | `Promise<CommSessionEntity[]>` | 获取学生的沟通课时列表。<br>**默认过滤 status != 'deleted'**。 |
| `getSessionById(id)` | `UUID` | `Promise<CommSessionEntity>` | 获取课时详情。<br>**包含已删除记录（管理员可见）**。 |

**查询优化**:
- 使用复合索引 `(mentor_user_id, scheduled_at DESC)` 和 `(student_user_id, scheduled_at DESC)`
- 支持 LEFT JOIN meetings 表获取会议 URL

---

## 🎧 4. 事件监听器 (Listeners)

### 4.1 CommSessionEventListener

**文件**: `src/domains/services/comm-sessions/listeners/comm-session-event.listener.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CommSessionService } from '../services/comm-session.service';
import {
  MeetingLifecycleCompletedPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events';

/**
 * Comm Session Event Listener
 *
 * 监听 Core Meeting 生命周期事件并更新沟通课时状态
 */
@Injectable()
export class CommSessionEventListener {
  private readonly logger = new Logger(CommSessionEventListener.name);

  constructor(
    private readonly commSessionService: CommSessionService
  ) {}

  /**
   * 处理会议生命周期完成事件
   *
   * @param payload - 来自 Core 层的会议生命周期完成事件 payload
   */
  @OnEvent(MEETING_LIFECYCLE_COMPLETED_EVENT)
  async handleMeetingCompletion(
    payload: MeetingLifecycleCompletedPayload
  ): Promise<void> {
    this.logger.log(
      `Received meeting.lifecycle.completed event for meeting ${payload.meetingId}`
    );

    try {
      const session = await this.commSessionService.findByMeetingId(
        payload.meetingId
      );

      if (session) {
        this.logger.log(
          `Found comm session ${session.id} for meeting ${payload.meetingId}`
        );

        // 仅更新状态，不登记服务，不发布事件 ⭐
        await this.commSessionService.completeSession(session.id, payload);

        this.logger.log(
          `Successfully completed comm session ${session.id}`
        );
      } else {
        this.logger.debug(
          `No comm session found for meeting ${payload.meetingId}, skipping`
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling meeting completion for meeting ${payload.meetingId}: ${error.message}`,
        error.stack
      );
    }
  }
}
```

**事件处理流程** ⭐:
```
1. Core/Meeting 发布 meeting.lifecycle.completed 事件
   ↓
2. CommSessionEventListener 监听事件
   ↓
3. 根据 meetingId 查找 comm_session
   ↓
4. 如果找到 → completeSession()
   - 更新 comm_sessions.status = 'completed'
   - 设置 completed_at
   ✅ 流程结束（不登记服务，不发布事件）⭐
```

---

## 📋 5. DTO 定义

### 5.1 CreateCommSessionDto

**用途**: Application Layer 编排时使用

| 字段 | 类型 | 必须 | 说明 |
| :--- | :--- | :--- | :--- |
| `meetingId` | UUID | 是 | **关联的核心会议 ID**（由 Step 1 返回）|
| `sessionType` | String | 是 | 会话类型（固定值 `comm_session`）|
| `studentUserId` | UUID | 是 | 学生 ID |
| `mentorUserId` | UUID | 否 | 导师 ID（如果是导师沟通）⭐ |
| `counselorUserId` | UUID | 否 | 顾问 ID（如果是顾问沟通）⭐ |
| `createdByCounselorId` | UUID | 是 | 创建该课时的顾问 ID（记录操作人）⭐ |
| `title` | String | 是 | 课时标题 |
| `description` | String | 否 | 课时描述 |
| `scheduledAt` | Date | 是 | 预约开始时间 |

---

### 5.2 UpdateCommSessionDto

**用途**: 更新会话信息

| 字段 | 类型 | 必须 | 说明 |
| :--- | :--- | :--- | :--- |
| `title` | String | 否 | 课时标题 |
| `description` | String | 否 | 课时描述 |
| `scheduledAt` | Date | 否 | 预约开始时间（改期）|

---

## 📊 6. 数据流图

### 6.1 创建沟通课时流程

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. API Layer - POST /api/comm-sessions                          │
│    - CreateCommSessionDto                                        │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Application Layer - CreateCommSessionCommand                 │
│    - Step 1: Call Core/Meeting to create meeting (get meetingId)│
│    - Step 2: Call CommSessionService.createSession()            │
│    - Step 3: Call Calendar to create calendar entry             │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Domain Layer - CommSessionService.createSession()            │
│    - Insert comm_sessions record                                │
│    - Status: scheduled                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

### 6.2 课时完成流程 ⭐

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Meeting 完成 (Core Layer)                                     │
│    - MeetingLifecycleCompletedEvent                             │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. CommSession Listener (Domain Layer)                          │
│    - CommSessionEventListener.handleMeetingCompletion()         │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. CommSession Service (Domain Layer)                           │
│    - 根据 meeting_id 查询 comm_sessions 表                       │
│    - 如果找到记录：                                              │
│      - completeSession(sessionId, payload)                      │
│      - 更新 comm_sessions.status = 'completed'                  │
│      - 设置 completed_at                                         │
│    ✅ 流程结束（不登记服务，不发布事件）⭐                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 7. 设计总结

### 7.1 核心设计模式

- ✅ **CQRS** (命令查询职责分离)
- ✅ **Event-Driven Architecture** (事件驱动架构)
- ✅ **Table-per-Type** (每类型一表)
- ✅ **Domain Events** (领域事件)

---

### 7.2 与其他 Session 类型的区别

| 特性 | Regular Mentoring / Gap Analysis / AI Career | Comm Session |
|:---|:---|:---|
| **计费特性** | 需要登记服务到 service_references | **不需要登记服务** ⭐ |
| **完成事件** | 发布 `services.session.completed` | **不发布完成事件** ⭐ |
| **下游依赖** | ServiceRegistryService | **无需注入** ⭐ |
| **Financial 处理** | 生成导师费用 | **无需处理** ⭐ |
| **Contract 处理** | 扣减合同课时 | 扣减合同课时（通过其他机制）|
| **状态管理** | scheduled → completed / cancelled / deleted | **相同** ✅ |
| **事件监听** | 监听 `meeting.lifecycle.completed` | **相同** ✅ |

---

### 7.3 关键设计决策

1. **不登记服务** ⭐
   - Comm Session 是内部沟通课时，不需要支付导师费用
   - 完成后不调用 `ServiceRegistryService.registerService()`
   - **优点**：简化流程，避免无效数据

2. **不发布完成事件** ⭐
   - 不发布 `services.session.completed` 事件
   - Financial 和 Calendar 模块无需监听
   - **优点**：减少事件噪音，提升性能

3. **保持统一的数据结构** ✅
   - 字段与其他 Session 类型一致（便于维护）
   - 状态机与其他 Session 类型一致（便于理解）
   - **优点**：架构一致性，降低学习成本

4. **独立的业务逻辑** ✅
   - 独立的 Service、Repository、Listener
   - 与其他 Session 类型解耦
   - **优点**：职责清晰，易于扩展

---

**文档结束** 🎉

