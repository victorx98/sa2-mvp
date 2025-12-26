# 约课流程优化设计文档 v2.0

## 📋 文档概述

**目标**：优化约课流程，将飞书/Zoom会议创建改为异步执行，提升前端响应速度从6秒降至1秒以内。

**核心变化**：
- 前端立即收到响应（包含sessionId，不包含meetingUrl）
- 会议创建异步执行，完成后前端通过轮询获取meetingUrl
- 保持Application层的编排职责，通过事件驱动实现异步流程

**改造范围**：
- 本文档专注于 `RegularMentoringService` 的改造
- 其他 session 类型（gap-analysis、ai-career、comm-session、class-session）可照搬此设计

---

## ✅ 当前实现现状（代码对齐）

- **入口**：`src/api/controllers/services/sessions/session.controller.ts` → `SessionOrchestratorService` 分发到各类型服务
- **同步事务**：`src/application/commands/services/*` 的 `createSession()`
  - 可计费类型：创建 Service Hold（`ServiceHoldService.createHold()`）
  - 创建 Calendar Slot（`CalendarService.createSlotDirect()`）
  - 创建 Session 记录（`status=pending_meeting`，`meeting_id=NULL`）
- **事务后事件**：通过 `IntegrationEventPublisher` 发布 `*.session.created`
  - 定义位置：`src/application/events/definitions/services/*.events.ts`
- **异步编排（当前为 EventHandler）**：`src/application/events/handlers/services/*-event.handler.ts`
  - 创建会议（`MeetingManagerService.createMeeting()`）
  - 事务内回填 session + calendar slot
  - 发布 `*.session.meeting.operation.result`
- **通知与日历**：`src/application/events/handlers/services/*-notification.handler.ts`
  - 监听 operation result
  - 创建 Feishu/Google 日历事件、安排提醒

**当前缺口**：会议创建失败或回填事务失败时，缺少统一补偿（释放 hold、取消 slot、回滚会议等），仅发布失败通知。

---

## 🎯 整体架构设计

### 事件定义

#### 1. Session创建事件 (新增 - 按类型拆分)

各session类型使用独立的事件名，精准订阅，无需过滤。

##### 1.1 REGULAR_MENTORING_SESSION_CREATED_EVENT
**事件名**：`regular_mentoring.session.created`  
**触发时机**：Regular Mentoring Session记录创建完成后  
**发布者**：`RegularMentoringService.createSession()`  
**消费者**：`SessionProvisioningSaga`（或对应的 Session Saga）  
**用途**：触发异步创建会议流程

**文件位置**：`src/application/events/definitions/services/regular-mentoring-session.events.ts`

```typescript
export type RegularMentoringSessionCreatedPayload = {
  sessionId: string;
  studentId: string;
  mentorId: string;
  counselorId: string;
  scheduledStartTime: string;
  duration: number;
  meetingProvider: string; // 'feishu' | 'zoom'
  topic: string;
  mentorCalendarSlotId: string;
  studentCalendarSlotId: string;
};

@IntegrationEvent({
  type: "regular_mentoring.session.created",
  version: "1.0",
  producers: ["RegularMentoringService"],
  description: "Emitted when a regular mentoring session is created.",
})
export class RegularMentoringSessionCreatedEvent extends BaseIntegrationEvent<RegularMentoringSessionCreatedPayload> {
  static readonly eventType = "regular_mentoring.session.created";
}
```

##### 1.2 GAP_ANALYSIS_SESSION_CREATED_EVENT
**事件名**：`gap_analysis.session.created`  
**文件位置**：`src/application/events/definitions/services/gap-analysis-session.events.ts`

##### 1.3 AI_CAREER_SESSION_CREATED_EVENT
**事件名**：`ai_career.session.created`  
**文件位置**：`src/application/events/definitions/services/ai-career-session.events.ts`

##### 1.4 COMM_SESSION_CREATED_EVENT
**事件名**：`comm_session.session.created`  
**文件位置**：`src/application/events/definitions/services/comm-session.events.ts`

##### 1.5 CLASS_SESSION_CREATED_EVENT
**事件名**：`class_session.session.created`  
**文件位置**：`src/application/events/definitions/services/class-session.events.ts`

**命名规范**：`{domain}.session.created` 或 `{domain}.created`

#### 2. MEETING_OPERATION_RESULT_EVENT（现用结果事件）
**事件名**：`{sessionType}.session.meeting.operation.result`  
**触发时机**：Saga 执行成功或失败后  
**发布者**：`SessionProvisioningSaga`（或对应的 Session Saga）  
**消费者**：`*NotificationHandler`（Feishu/Google 日历 + Reminder）

**文件位置**：
- 定义：`src/application/events/definitions/services/*-session.events.ts`
- 消费：`src/application/events/handlers/services/*-notification.handler.ts`

**用途**：
- 成功：创建日历事件 + 安排提醒
- 失败：仅通知顾问并标记需人工介入

> 备注：`session.booked` 当前未在实现中使用，如需跨域统一通知可在 Saga 成功后额外发布。

---

## 🔄 流程设计

### 阶段一：同步流程（Application层）

**文件**：`src/application/commands/services/regular-mentoring.service.ts`

**方法**：`createSession(dto: CreateRegularMentoringDto)`

#### 执行步骤

```
1. 在数据库事务中执行：
   1.1 创建服务预占（ServiceHoldService，仅可计费类型）
   1.2 创建Calendar Slot（导师 + 学生）
       - 使用EXCLUDE约束检测冲突
       - sessionId暂时为null（待异步填充）
       - meetingId暂时为null（待异步填充）
   1.3 创建Session记录（regular_mentoring_sessions表）
       - meeting_id字段为null（待异步填充）
       - status字段为'PENDING_MEETING'（新状态）
   [优化] 不再更新Calendar Slot的sessionId（移至阶段二一次性更新）
   ↓
2. 事务提交成功
   ↓
3. 发布 `regular_mentoring.session.created`
   ↓
4. 立即返回前端响应
```

#### 返回数据结构

```typescript
{
  sessionId: string;
  status: 'PENDING_MEETING';  // 前端根据此状态显示"会议创建中..."
  studentId: string;
  mentorId: string;
  scheduledAt: string;
  duration: number;
  // ❌ 暂无 meetingUrl
}
```

#### 代码调整要点

1. **Session状态增强**
   - 新增状态：`PENDING_MEETING`（会议创建中）、`MEETING_FAILED`（会议创建失败）
   - 现有状态：`SCHEDULED`（已排期）、`COMPLETED`、`CANCELLED`

2. **数据库schema调整**
   - `regular_mentoring_sessions.meeting_id`：改为 nullable
   - `calendar_slots.meeting_id`：改为 nullable
   - 其他session子表同样处理

3. **移除会议创建逻辑**（regular-mentoring.service.ts）
   - 删除 Step 3（创建会议链接，第173-202行）
   - 修改 Step 4（创建session记录，第209-222行）
     - `meetingId` 参数改为 null
     - 确保 status 为 'PENDING_MEETING'
   - **删除 Step 5（更新calendar slots的sessionId，第227-240行）**
     - 优化：不再立即更新 sessionId
     - 改为在阶段二一次性更新 sessionId + meetingId + meetingUrl

4. **返回值调整**
   - 移除 `meetingId`、`meetingNo`、`meetingUrl`
   - 保留 `sessionId`、`status`、`scheduledAt`
   - 新增发布 `regular_mentoring.session.created`（IntegrationEventPublisher）

---

### 阶段二：Saga 异步编排（Application层）

**新增位置**：`src/application/sagas/services/session-provisioning.saga.ts`  
**类名**：`SessionProvisioningSaga`（或按 session 类型拆分）

#### Saga职责

监听 `*.session.created`，完成会议创建、回填与结果事件发布；失败时执行补偿。

#### 执行步骤

```
1. 接收 {sessionType}.session.created
   ↓
2. 调用 MeetingManagerService.createMeeting()（事务外，带重试）
   ↓
3. 在数据库事务中执行：
   3.1 更新 Session（meeting_id + status = scheduled）
   3.2 更新 Calendar Slot（session_id + meeting_id + meetingUrl）
   ↓
4. 发布 {sessionType}.session.meeting.operation.result（status=success）
   ↓
5. 若失败 → 进入补偿流程（见下文）
```

#### 代码结构（示意）

```typescript
@Injectable()
export class SessionProvisioningSaga {
  @OnEvent(RegularMentoringSessionCreatedEvent.eventType)
  @HandlesEvent(RegularMentoringSessionCreatedEvent.eventType, SessionProvisioningSaga.name)
  async handleRegularMentoringCreated(event: RegularMentoringSessionCreatedEvent) {
    // 1) create meeting (retry)
    // 2) tx: schedule session + update slots
    // 3) publish meeting.operation.result (success)
    // 4) catch -> compensate + publish failed result
  }
}
```

---

### 补偿流程（Feishu / 外部失败）

**目标**：保证失败后不遗留占用资源（hold、calendar slot、meeting）。

#### 失败点与补偿动作

1. **会议创建失败（Feishu/Zoom API）**
   - `session.status -> meeting_failed`（需要 Domain 层支持该状态）
   - 释放 Service Hold（仅可计费类型）
   - 取消 Calendar Slot（status=cancelled）
   - 发布 `*.session.meeting.operation.result`（status=failed，notify counselor）

2. **会议创建成功，但回填事务失败**
   - 尝试取消会议（`MeetingManagerService.cancelMeeting` + 重试）
   - 同步执行：释放 hold、取消 slot、标记 meeting_failed
   - 若会议取消失败：`requireManualIntervention=true` 并记录补偿失败原因

3. **通知/日历集成失败**
   - 不影响 booking 成功状态
   - 进入重试/告警队列即可（不触发会话补偿）

#### 幂等性建议

- 使用 `event.id` 作为幂等键；再次收到事件时优先检查 `meeting_id` / `status`
- 补偿动作可重复执行（release/cancel 需容错）

---

### 阶段三：通知流程（Application层 EventHandler）

**现有文件**：`src/application/events/handlers/services/*-notification.handler.ts`

#### Listener职责

监听 `*.session.meeting.operation.result`，并编排：
- Create Success：创建日历事件 + 安排提醒
- Create Failed：通知顾问（无需补偿）
- Update/Cancel Success：更新/取消日历事件与提醒

#### 执行步骤

```
1. 接收 MeetingOperationResult（operation=create/update/cancel）
   ↓
2. 根据 status 路由到具体处理
   ↓
3. 创建/更新/取消日历事件与提醒
```

#### 代码调整要点

- 统一结果事件驱动通知（`*.session.meeting.operation.result`）
- `session.booked` 可保留为未来跨域通知事件（当前未用）

---

## 📦 各模块职责划分

### Application层

#### RegularMentoringService.createSession()
- **职责**：同步编排（快速响应前端）
- **操作**：
  - 创建服务预占（可计费类型）
  - 创建Calendar Slot（导师+学生）
  - 创建Session记录（meeting_id为null，status='PENDING_MEETING'）
  - 不回填 calendar slot（session_id/meeting_id 留给 Saga 回填）
  - 发布 `regular_mentoring.session.created`
  - 返回前端

#### SessionProvisioningSaga (新增)
- **职责**：异步编排（完成会议创建 + 回填 + 结果事件 + 补偿）
- **文件位置**：`src/application/sagas/services/session-provisioning.saga.ts`
- **Module注册**：ApplicationModule
- **操作**：
  - 监听 `*.session.created`（精准订阅）
  - 调用 MeetingManagerService 创建会议（含重试）
  - 事务内回填 session + calendar slot
  - 发布 `*.session.meeting.operation.result`
  - 失败时执行补偿（释放 hold、取消 slot、回滚会议）

---

### Meeting模块（Core层）

#### MeetingManagerService
- **职责**：提供会议创建能力
- **核心流程**（第45-91行）：
  ```
  1. 调用 Provider（Feishu/Zoom）创建会议
  2. 写入 meetings 表（MeetingRepository.create）
  3. 返回 Meeting 对象
  ```
- **调整**：
  - ✅ 已支持在事务外调用（tx参数为可选）
  - ✅ 已支持在事务内调用（传入tx参数）
  - **无需修改**：现有实现已满足需求

#### 接口说明

```typescript
async createMeeting(
  dto: CreateMeetingDto, 
  tx?: DrizzleTransaction
): Promise<Meeting>

// 返回的Meeting对象包含：
// - id: UUID（meetings表主键）
// - meetingId: 第三方平台ID（Feishu reserve.id, Zoom id）
// - meetingNo: 会议号
// - meetingUrl: 会议链接
// - meetingProvider: 'feishu' | 'zoom'
// - status: 'SCHEDULED'
// - ... 其他字段
```

**重要**：返回的 `meeting.id` 是 meetings 表的 UUID 主键，用于关联到 session 子表和 calendar_slots 表。

---

### Service Domain模块

#### DomainRegularMentoringService (Domain层)
- **文件**：`src/domains/services/sessions/regular-mentoring/services/regular-mentoring-domain.service.ts`

- **已有方法**：`scheduleMeeting()`（PENDING_MEETING → SCHEDULED）

```typescript
async scheduleMeeting(
  sessionId: string,
  meetingId: string,
  tx?: DrizzleTransaction
): Promise<void> {
  // 更新 meeting_id + status
}
```

- **需补齐方法**：`markMeetingFailed()`（用于补偿）

```typescript
async markMeetingFailed(
  sessionId: string,
  tx?: DrizzleTransaction
): Promise<void> {
  // PENDING_MEETING → MEETING_FAILED
}
```

#### 状态管理
- 新增状态：`PENDING_MEETING`、`MEETING_FAILED`（regular/gap/ai 需补齐 VO）
- 状态流转：
  ```
  PENDING_MEETING → SCHEDULED → IN_PROGRESS → COMPLETED
                 ↘ MEETING_FAILED ↗
  ```

---

### Calendar模块（Core层）

#### CalendarService
- **文件**：`src/core/calendar/services/calendar.service.ts`

- **新增方法**：`updateSlotWithSessionAndMeeting()`（优化：一次性更新）

```typescript
async updateSlotWithSessionAndMeeting(
  sessionId: string,    // Session的UUID
  meetingId: string,    // meetings表的UUID主键
  meetingUrl: string,
  tx?: DrizzleTransaction
): Promise<void> {
  // 通过Calendar Slot创建时的时间范围和sessionType查找
  // 或通过内存中保存的slotIds查找（需要调整创建逻辑）
  
  // 一次性更新所有字段
  await this.updateSlots({
    session_id: sessionId,     // ← 回填sessionId
    meeting_id: meetingId,     // ← 回填meetingId
    metadata: {
      meetingUrl: meetingUrl,  // ← 回填meetingUrl
    },
  }, tx);
}
```

**注意**：由于阶段一不再设置 sessionId，需要调整查找 Calendar Slot 的方式：
- **方案1**：在 `*.session.created` payload 中携带 `calendarSlotIds`（当前已包含 mentor/student slotId）
- **方案2**：通过时间范围 + userId + sessionType 查询

---

## 🗄️ 数据库Schema调整

### 1. Session子表（如 regular_mentoring_sessions）

```sql
ALTER TABLE regular_mentoring_sessions
  ALTER COLUMN meeting_id DROP NOT NULL;  -- 改为nullable

-- status字段枚举值新增
-- 'PENDING_MEETING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'MEETING_FAILED'
```

### 2. Calendar Slots表

```sql
ALTER TABLE calendar_slots
  ALTER COLUMN meeting_id DROP NOT NULL;  -- 改为nullable（如果之前是NOT NULL）
```

---

## 🌐 前端调整

### 创建约课响应处理

```typescript
// 1. 立即收到响应
const response = await bookSession(input);
// { sessionId: 'xxx', status: 'PENDING_MEETING' }

// 2. 显示中间状态
if (response.status === 'PENDING_MEETING') {
  showMessage('会议链接创建中，请稍候...');
  
  // 3. 轮询获取会议信息（每2-3秒）
  const pollInterval = setInterval(async () => {
    const session = await getSessionById(response.sessionId);
    
    if (session.status === 'SCHEDULED' && session.meetingUrl) {
      clearInterval(pollInterval);
      showMessage('预约成功！');
      displayMeetingUrl(session.meetingUrl);
    } else if (session.status === 'MEETING_FAILED') {
      clearInterval(pollInterval);
      showError('会议创建失败，请重试');
    }
  }, 2000);
  
  // 4. 超时处理（30秒）
  setTimeout(() => {
    clearInterval(pollInterval);
    showWarning('会议创建较慢，请稍后刷新页面查看');
  }, 30000);
}
```

### API接口调整

#### 现有接口保持不变
```
POST /api/counselor/sessions/book
```

#### 响应结构调整
```typescript
// 之前：立即返回完整信息（包含meetingUrl）
// 现在：立即返回部分信息（不含meetingUrl）
{
  sessionId: string;
  status: 'PENDING_MEETING';
  // ... 其他字段
}
```

#### 新增查询接口（或复用现有）
```
GET /api/counselor/sessions/:sessionId
```

返回：
```typescript
{
  sessionId: string;
  status: 'SCHEDULED' | 'PENDING_MEETING' | 'MEETING_FAILED';
  meetingUrl?: string;  // status=SCHEDULED时存在
  // ... 其他字段
}
```

---

## 🔍 监控与告警

### 关键指标

1. **会议创建成功率**
   - 成功：status从PENDING_MEETING到SCHEDULED
   - 失败：status变为MEETING_FAILED

2. **会议创建耗时**
   - `*.session.created` 到 `*.session.meeting.operation.result(status=success)` 的时间差
   - 告警阈值：>10秒

3. **同步流程耗时**
   - BookSessionCommand 的执行时间
   - 目标：<1秒

### 日志记录

```typescript
// 关键节点
- [RegularMentoringService] Session created: sessionId=xxx, status=PENDING_MEETING
- [RegularMentoringService] Published regular_mentoring.session.created event
- [SessionProvisioningSaga] Handling regular_mentoring.session.created: sessionId=xxx
- [SessionProvisioningSaga] Meeting created: meetingId=xxx, duration=5000ms
- [SessionProvisioningSaga] Session + calendar updated
- [SessionProvisioningSaga] Published regular_mentoring.session.meeting.operation.result
- [RegularMentoringNotificationHandler] Calendar + reminders scheduled
```

---

## 🧪 测试场景

### 1. 正常流程
```
1. 顾问创建约课
2. 立即收到响应（status=PENDING_MEETING）
3. 5秒后会议创建完成
4. 前端轮询获取到meetingUrl
5. Email发送成功
```

### 2. 会议创建失败
```
1. 顾问创建约课
2. 立即收到响应（status=PENDING_MEETING）
3. 飞书API调用失败
4. Session状态更新为MEETING_FAILED
5. 前端显示错误，提示重试
```

### 3. 高并发场景
```
1. 10个顾问同时创建约课
2. 所有请求在1秒内返回
3. 后台异步处理10个会议创建
4. 监控会议创建队列长度
```

---

## 📝 实施步骤

### Phase 1: 事件治理对齐（1-2天）
1. 确认事件定义位置：`src/application/events/definitions/services/*.events.ts`
2. 确认 `@IntegrationEvent` + `@HandlesEvent` 注册到事件注册表（对齐 event-governance-design-v2）
3. 校验 session 状态枚举已包含 `pending_meeting / meeting_failed`

### Phase 2: Saga 化改造（2-3天）
1. 新增 `SessionProvisioningSaga`：`src/application/sagas/services/session-provisioning.saga.ts`
2. 迁移/封装现有 `*-event.handler.ts` 的编排逻辑到 Saga
3. Saga 统一发布 `*.session.meeting.operation.result`

### Phase 3: 补偿流程落地（1-2天）
1. Domain 层补齐 `markMeetingFailed()`（regular/gap/ai）
2. Saga 失败路径加入：释放 hold、取消 slot、回滚会议
3. 失败补偿结果通过 `requireManualIntervention` 输出到告警/工单

### Phase 4: 前端适配（1-2天）
1. 处理 `PENDING_MEETING / MEETING_FAILED` 状态
2. 实现轮询机制
3. 添加超时处理

### Phase 5: 测试与上线（2-3天）
1. 单元测试（Saga + 失败补偿）
2. 集成测试（Feishu/Zoom 模拟失败）
3. 性能测试
4. 灰度发布

---

## ⚠️ 注意事项

### 1. 向后兼容
- 保持API接口路径不变
- 响应结构向后兼容（新增字段，不删除旧字段）

### 2. 数据一致性
- Session子表的meeting_id可以为null（中间状态）
- Calendar Slot的session_id和meeting_id都可以为null（中间状态）
- 最终一致性通过异步流程保证
- **优化**：
  - Session: `completeMeetingSetup()` 一次性更新 meeting_id + status
  - Calendar: 一次性更新 session_id + meeting_id + meetingUrl

### 3. 幂等性
- 各 `XXXCreatedEventHandler` 需要处理重复事件
- 在创建会议前检查Session状态（如果已是SCHEDULED，则跳过）
- 避免重复创建会议

### 4. 错误恢复
- Saga 内部优先重试（如 3 次），失败后进入补偿
- MEETING_FAILED 状态下支持顾问手动重试
- Feishu/Zoom 取消失败进入人工处理队列

### 5. 事件设计原则
- **创建事件拆分**：各session类型使用专属的 `xxx.session.created` 事件（处理逻辑不同）
- **结果事件按类型**：`{sessionType}.session.meeting.operation.result`（通知逻辑依赖 operation/status）
- **原则**：事件拆分的依据是"处理逻辑是否不同"，而非"数据来源不同"
> 如需跨域统一通知，可在 Saga 成功后额外发布 `session.booked`

---

## 🎯 预期效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 前端等待时间 | ~6秒 | <1秒 |
| 数据库事务时长 | ~6秒 | <500ms |
| 会议创建总时长 | ~6秒 | ~5秒（异步） |
| 用户体验 | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| 系统吞吐量 | 受限 | 提升10倍+ |

---

## 📚 相关文档

- DDD分层架构设计：`docs/architecture/ddd-layers.md`
- 事件驱动设计：`docs/architecture/event-driven.md`
- Meeting模块文档：`docs/modules/meeting.md`
- Calendar模块文档：`docs/modules/calendar.md`

---

## 🔄 扩展到其他Session类型

本文档的设计可直接应用到其他session类型：

| Session类型 | Application服务 | Saga | Domain服务 | 改造方式 |
|------------|----------------|------|-----------|---------|
| Regular Mentoring | `regular-mentoring.service.ts` | `session-provisioning.saga.ts` | `RegularMentoringDomainService` | ✅ 本文档 |
| Gap Analysis | `gap-analysis.service.ts` | `session-provisioning.saga.ts` | `GapAnalysisDomainService` | 照搬 |
| AI Career | `ai-career.service.ts` | `session-provisioning.saga.ts` | `AiCareerDomainService` | 照搬 |
| Comm Session | `comm-session.service.ts` | `session-provisioning.saga.ts` | `CommSessionDomainService` | 照搬 |
| Class Session | `class-session.service.ts` | `session-provisioning.saga.ts` | `ClassSessionDomainService` | 照搬 |

**目录结构**：
```
src/application/
  commands/services/
    ├── regular-mentoring.service.ts
    ├── gap-analysis.service.ts
    ├── ai-career.service.ts
    ├── comm-session.service.ts
    └── class-session.service.ts
  events/definitions/services/
    ├── regular-mentoring-session.events.ts
    ├── gap-analysis-session.events.ts
    ├── ai-career-session.events.ts
    ├── comm-session.events.ts
    └── class-session.events.ts
  events/handlers/services/
    └── *-notification.handler.ts
  sagas/services/
    └── session-provisioning.saga.ts
```

**设计原则**：
- ✅ **Saga 负责编排**：多步骤 + 补偿逻辑集中
- ✅ **Notification Handler 只做通知**：日历/提醒不影响 booking 成功
- ✅ **符合 event-governance-design-v2 目录规范**

**事件订阅机制**（精准订阅，无需过滤）：
```typescript
@OnEvent(RegularMentoringSessionCreatedEvent.eventType)
@HandlesEvent(RegularMentoringSessionCreatedEvent.eventType, SessionProvisioningSaga.name)
async handleRegularMentoringCreated(event: RegularMentoringSessionCreatedEvent) {
  // 无需过滤，直接处理
}
```

**事件文件列表**：
```
src/application/events/definitions/services/
  ├── regular-mentoring-session.events.ts
  ├── gap-analysis-session.events.ts
  ├── ai-career-session.events.ts
  ├── comm-session.events.ts
  └── class-session.events.ts
```

**改造要点**：
1. `createSession()` 发布 `*.session.created`（IntegrationEventPublisher）
2. `SessionProvisioningSaga` 统一编排创建/回填/补偿
3. Notification 监听 `*.session.meeting.operation.result`
4. regular/gap/ai 补齐 `markMeetingFailed()` 与 VO 状态

---

**文档版本**：v2.2  
**创建日期**：2025-12-03  
**最后更新**：2025-12-25  
**作者**：System Architect  
**审阅**：User Confirmed
