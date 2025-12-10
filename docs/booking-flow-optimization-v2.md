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

## 🎯 整体架构设计

### 事件定义

#### 1. Session创建事件 (新增 - 按类型拆分)

各session类型使用独立的事件名，精准订阅，无需过滤。

##### 1.1 REGULAR_MENTORING_SESSION_CREATED_EVENT
**事件名**：`regular_mentoring.session.created`  
**触发时机**：Regular Mentoring Session记录创建完成后  
**发布者**：`RegularMentoringService.createSession()`  
**消费者**：`RegularMentoringCreatedEventHandler`  
**用途**：触发异步创建会议流程

**文件位置**：`src/shared/events/regular-mentoring-session-created.event.ts`

```typescript
export const REGULAR_MENTORING_SESSION_CREATED_EVENT = 'regular_mentoring.session.created';

export interface RegularMentoringSessionCreatedEvent {
  sessionId: string;
  studentId: string;
  mentorId: string;
  counselorId: string;
  scheduledStartTime: string;
  duration: number;
  meetingProvider: string; // 'feishu' | 'zoom'
  topic: string;
  mentorCalendarSlotId: string;   // 导师的Calendar Slot ID（用于异步更新）
  studentCalendarSlotId: string;  // 学生的Calendar Slot ID（用于异步更新）
}
```

##### 1.2 GAP_ANALYSIS_SESSION_CREATED_EVENT
**事件名**：`gap_analysis.session.created`  
**文件位置**：`src/shared/events/gap-analysis-session-created.event.ts`

##### 1.3 AI_CAREER_SESSION_CREATED_EVENT
**事件名**：`ai_career.session.created`  
**文件位置**：`src/shared/events/ai-career-session-created.event.ts`

##### 1.4 COMM_SESSION_CREATED_EVENT
**事件名**：`comm_session.session.created`  
**文件位置**：`src/shared/events/comm-session-created.event.ts`

##### 1.5 CLASS_SESSION_CREATED_EVENT
**事件名**：`class_session.created`  
**文件位置**：`src/shared/events/class-session-created.event.ts`

**命名规范**：`{domain}.session.created` 或 `{domain}.created`

#### 2. SESSION_BOOKED_EVENT (保留，统一事件)
**事件名**：`session.booked`（所有session类型共用）  
**触发时机**：会议创建完成、所有数据更新完成后  
**发布者**：各 `XXXCreatedEventHandler`（如 RegularMentoringCreatedEventHandler）  
**消费者**：Domain层 - NotificationListener（发送Email）  
**用途**：触发外部通知（Email）

**设计说明**：
- ✅ **不拆分**：所有session类型共用同一个 `session.booked` 事件
- ✅ **理由**：通知逻辑相同（发送Email），无需区分类型
- ✅ **优势**：避免重复代码，单一NotificationListener处理所有类型

**文件位置**：`src/shared/events/session-booked.event.ts`（已存在）

```typescript
export const SESSION_BOOKED_EVENT = 'session.booked';

export interface SessionBookedEvent {
  sessionId: string;
  studentId: string;
  mentorId: string;
  counselorId: string;
  serviceType: string;
  mentorCalendarSlotId: string;
  studentCalendarSlotId: string;
  serviceHoldId: string;
  scheduledStartTime: string;
  duration: number;
  meetingProvider: string;
  meetingPassword?: string;
  meetingUrl: string; // ✅ 此时一定有值
}
```

---

## 🔄 流程设计

### 阶段一：同步流程（Application层）

**文件**：`src/application/commands/services/regular-mentoring.service.ts`

**方法**：`createSession(dto: CreateRegularMentoringDto)`

#### 执行步骤

```
1. 在数据库事务中执行：
   1.1 创建服务预占（ServiceHoldService）- 可选，目前已注释
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
3. 发布 SESSION_CREATED_EVENT
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
  scheduledStartTime: string;
  duration: number;
  // ❌ 暂无 meetingUrl
}
```

#### 代码调整要点

1. **Session状态增强**
   - 新增状态：`PENDING_MEETING`（会议创建中）
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
   - 新增发布 `SESSION_CREATED_EVENT` 的逻辑

---

### 阶段二：异步流程（Application层编排）

**新增文件**：`src/application/commands/services/regular-mentoring-created-event.handler.ts`

**类名**：`RegularMentoringCreatedEventHandler`

#### Listener职责

监听 `REGULAR_MENTORING_SESSION_CREATED_EVENT`，执行异步编排（无需过滤，精准订阅）。

#### 执行步骤

```
1. 接收 RegularMentoringSessionCreatedEvent
   ↓
2. 调用 MeetingManagerService.createMeeting()（事务外）
   - 传入 provider、topic、startTime、duration、hostUserId 等
   - 内部流程：
     2.1 调用飞书/Zoom API创建会议（5秒）
     2.2 写入 meetings 表（MeetingRepository.create）
   - 返回 Meeting 对象（包含 id、meetingId、meetingUrl等）
   ↓
3. 在数据库事务中执行：
   3.1 更新Session子表的meeting_id和status（一次性更新）
       - 找到对应的session记录（通过sessionId）
       - 调用 completeMeetingSetup(sessionId, meeting.id)
       - 一次UPDATE：meeting_id = meeting.id, status = 'SCHEDULED'
   3.2 一次性更新Calendar Slot的完整信息
       - 通过sessionId找到导师和学生的calendar_slots
       - 更新 session_id = sessionId（回填）
       - 更新 meeting_id = meeting.id
       - 更新 metadata.meetingUrl = meeting.meetingUrl
   ↓
4. 事务提交成功
   ↓
5. 发布 SESSION_BOOKED_EVENT（包含完整的meetingUrl）
```

#### 错误处理

```
如果步骤2失败（会议创建失败）：
   ↓
更新Session状态为 'MEETING_FAILED'
   ↓
记录错误日志
   ↓
（可选）发送告警通知顾问重试
```

#### 代码结构

```typescript
import { 
  REGULAR_MENTORING_SESSION_CREATED_EVENT,
  RegularMentoringSessionCreatedEvent 
} from '@shared/events/regular-mentoring-session-created.event';
import { SESSION_BOOKED_EVENT } from '@shared/events/session-booked.event';

@Injectable()
export class RegularMentoringCreatedEventHandler {
  private readonly logger = new Logger(RegularMentoringCreatedEventHandler.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDatabase,
    private readonly meetingManagerService: MeetingManagerService,
    private readonly regularMentoringService: DomainRegularMentoringService,
    private readonly calendarService: CalendarService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(REGULAR_MENTORING_SESSION_CREATED_EVENT)
  async handleSessionCreated(event: RegularMentoringSessionCreatedEvent): Promise<void> {
    this.logger.log(`Handling regular_mentoring.session.created: sessionId=${event.sessionId}`);

    try {
      // Step 1: 调用Meeting Service创建会议（事务外，包含API调用）
      const meeting = await this.meetingManagerService.createMeeting({
        topic: event.topic,
        provider: event.meetingProvider,
        startTime: event.scheduledStartTime,
        duration: event.duration,
        hostUserId: this.getHostUserId(event.meetingProvider),
        autoRecord: true,
        participantJoinEarly: true,
      });
      // meeting对象包含：id(UUID)、meetingId、meetingUrl、meetingNo等

      this.logger.debug(`Meeting created: meetingId=${meeting.id}`);

      // Step 2: 在事务中更新Session和Calendar
      await this.db.transaction(async (tx) => {
        // 2.1 完成Session的会议设置（一次性更新meeting_id和status）
        await this.regularMentoringService.completeMeetingSetup(
          event.sessionId,
          meeting.id,
          tx,
        );

        // 2.2 一次性更新Calendar Slot的完整信息（sessionId + meetingId + meetingUrl）
        await this.calendarService.updateSlotWithSessionAndMeeting(
          event.sessionId,
          meeting.id,
          meeting.meetingUrl,
          tx,
        );
      });

      this.logger.log(`Session updated with meeting info: sessionId=${event.sessionId}`);

      // Step 3: 发布 SESSION_BOOKED_EVENT
      this.eventEmitter.emit(SESSION_BOOKED_EVENT, {
        sessionId: event.sessionId,
        studentId: event.studentId,
        mentorId: event.mentorId,
        counselorId: event.counselorId,
        // ... 其他字段
        meetingUrl: meeting.meetingUrl,
        meetingPassword: null, // 如需要，从meeting对象获取
      });

      this.logger.log(`session.booked event published: sessionId=${event.sessionId}`);
    } catch (error) {
      // 错误处理：标记状态为MEETING_FAILED
      this.logger.error(
        `Failed to create meeting for session ${event.sessionId}: ${error.message}`,
        error.stack,
      );

      try {
        await this.regularMentoringService.updateStatus(
          event.sessionId,
          'MEETING_FAILED',
        );
      } catch (updateError) {
        this.logger.error(
          `Failed to update session status: ${updateError.message}`,
        );
      }
    }
  }

  private getHostUserId(provider: string): string | undefined {
    // 根据provider返回hostUserId
    return provider === 'feishu' ? FEISHU_DEFAULT_HOST_USER_ID : undefined;
  }
}
```

---

### 阶段三：通知流程（Domain层）

**现有文件**：`src/domains/.../listeners/notification.listener.ts`

#### Listener职责

监听 `SESSION_BOOKED_EVENT`，发送Email通知。

#### 执行步骤

```
1. 接收 SessionBookedEvent（此时meetingUrl一定存在）
   ↓
2. 获取学生、导师、顾问的邮箱地址
   ↓
3. 发送Email通知
   - 收件人：学生、导师、顾问
   - 内容：包含会议链接、密码、时间等
   ↓
4. 记录通知日志
```

#### 代码调整要点

- 保持现有逻辑不变
- `SESSION_BOOKED_EVENT` 的语义从"会话已创建"变为"预约完成（包含会议信息）"

---

## 📦 各模块职责划分

### Application层

#### RegularMentoringService.createSession()
- **职责**：同步编排（快速响应前端）
- **操作**：
  - 创建服务预占（可选）
  - 创建Calendar Slot（导师+学生）
  - 创建Session记录（meeting_id为null，status='PENDING_MEETING'）
  - 更新Calendar Slot的sessionId
  - 发布 SESSION_CREATED_EVENT
  - 返回前端

#### RegularMentoringCreatedEventHandler (新增)
- **职责**：异步编排（完成 Regular Mentoring 会议创建流程）
- **文件位置**：`src/application/commands/services/regular-mentoring-created-event.handler.ts`
- **Module注册**：与 RegularMentoringService 相同的 Module
- **操作**：
  - 监听 `REGULAR_MENTORING_SESSION_CREATED_EVENT`（精准订阅，无需过滤）
  - 调用 MeetingManagerService 创建会议（包含写入meetings表）
  - 调用 `completeMeetingSetup()` 一次性更新 meeting_id 和 status
  - 更新 Calendar Slot 的 session_id、meeting_id 和 meetingUrl
  - 发布 `SESSION_BOOKED_EVENT`（统一事件，所有类型共用）

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
- **文件**：`src/domains/services/sessions/regular-mentoring/services/regular-mentoring.service.ts`

- **新增方法1**：`completeMeetingSetup()`（推荐：合并更新）

```typescript
async completeMeetingSetup(
  sessionId: string, 
  meetingId: string,
  tx?: DrizzleTransaction
): Promise<void> {
  // 一次性更新 regular_mentoring_sessions 表
  // - meeting_id = meetingId（meetings表的UUID）
  // - status = 'SCHEDULED'（从 PENDING_MEETING 转换）
  // - updated_at = now()
  // 
  // 优势：一次UPDATE操作，原子性更好
}
```

- **新增方法2**：`updateStatus()`

```typescript
async updateStatus(
  sessionId: string, 
  status: string,
  tx?: DrizzleTransaction
): Promise<void> {
  // 更新 regular_mentoring_sessions 表的 status 字段
  // 用于错误处理时标记为 'MEETING_FAILED'
}
```

#### 状态管理
- 新增状态：`PENDING_MEETING`、`MEETING_FAILED`
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
- **方案1**：在 SESSION_CREATED_EVENT 中携带 `calendarSlotIds`（推荐）
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
   - SESSION_CREATED_EVENT 到 SESSION_BOOKED_EVENT 的时间差
   - 告警阈值：>10秒

3. **同步流程耗时**
   - BookSessionCommand 的执行时间
   - 目标：<1秒

### 日志记录

```typescript
// 关键节点
- [RegularMentoringService] Session created: sessionId=xxx, status=PENDING_MEETING
- [RegularMentoringService] Published regular_mentoring.session.created event
- [RegularMentoringCreatedEventHandler] Handling regular_mentoring.session.created: sessionId=xxx
- [RegularMentoringCreatedEventHandler] Meeting created: meetingId=xxx, duration=5000ms
- [RegularMentoringCreatedEventHandler] Session updated with meeting info
- [RegularMentoringCreatedEventHandler] Published session.booked event
- [NotificationListener] Email sent to student/mentor/counselor
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

### Phase 1: 基础设施（1-2天）
1. 创建事件定义文件：
   - `src/shared/events/regular-mentoring-session-created.event.ts`
   - `src/shared/events/gap-analysis-session-created.event.ts`（后续）
   - 更新 `src/shared/events/event-constants.ts` 添加事件常量
   - 更新 `src/shared/events/index.ts` 导出新事件
2. 调整数据库schema（meeting_id改为nullable）
3. 新增 `PENDING_MEETING` 和 `MEETING_FAILED` 状态

### Phase 2: Application层重构（2-3天）
1. 修改 `RegularMentoringService.createSession()`
   - 移除会议创建逻辑（第173-202行）
   - 修改Session创建参数（meeting_id为null）
   - 发布 `REGULAR_MENTORING_SESSION_CREATED_EVENT`
   - 返回 PENDING_MEETING 状态（不含meetingUrl）
2. 创建 `RegularMentoringCreatedEventHandler`
   - 文件：`src/application/commands/services/regular-mentoring-created-event.handler.ts`
   - 监听 `REGULAR_MENTORING_SESSION_CREATED_EVENT`（精准订阅）
   - 异步调用 MeetingManagerService、DomainRegularMentoringService、CalendarService
   - 发布 SESSION_BOOKED_EVENT
3. 注册到相应的 Module（与 RegularMentoringService 相同）

### Phase 3: Service层调整（1天）
1. `DomainRegularMentoringService`（Domain层）新增方法：
   - `completeMeetingSetup(sessionId, meetingId, tx?)` - 一次性更新 meeting_id + status
   - `updateStatus(sessionId, status, tx?)` - 用于错误处理
2. `CalendarService`（Core层）新增方法：
   - `updateSlotWithSessionAndMeeting(sessionId, meetingId, meetingUrl, tx?)` - 一次性更新
   - 或者提供 `updateSlotsByIds(slotIds[], updates, tx?)` - 通过ID批量更新
3. 其他session服务可暂不调整（gap-analysis、ai-career、comm-session、class-session等）

### Phase 4: 前端适配（1-2天）
1. 处理 PENDING_MEETING 状态
2. 实现轮询机制
3. 添加超时处理

### Phase 5: 测试与上线（2-3天）
1. 单元测试
2. 集成测试
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
- MEETING_FAILED 状态下，支持顾问手动重试
- 考虑添加自动重试机制（如3次）

### 5. 事件设计原则
- **创建事件拆分**：各session类型使用专属的 `xxx.session.created` 事件（处理逻辑不同）
- **完成事件统一**：所有类型共用 `session.booked` 事件（通知逻辑相同）
- **原则**：事件拆分的依据是"处理逻辑是否不同"，而非"数据来源不同"

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

| Session类型 | Application服务 | Event Handler | Domain服务 | 改造方式 |
|------------|----------------|---------------|-----------|---------|
| Regular Mentoring | `regular-mentoring.service.ts` | `regular-mentoring-created-event.handler.ts` | `DomainRegularMentoringService` | ✅ 本文档 |
| Gap Analysis | `gap-analysis.service.ts` | `gap-analysis-created-event.handler.ts` | `DomainGapAnalysisService` | 照搬 |
| AI Career | `ai-career.service.ts` | `ai-career-created-event.handler.ts` | `DomainAICareerService` | 照搬 |
| Comm Session | `comm-session.service.ts` | `comm-session-created-event.handler.ts` | `DomainCommSessionService` | 照搬 |
| Class Session | `class-session.service.ts` | `class-session-created-event.handler.ts` | `DomainClassSessionService` | 照搬 |

**目录结构**：
```
src/application/commands/services/
  ├── regular-mentoring.service.ts
  ├── regular-mentoring-created-event.handler.ts     # 配套的Event Handler
  ├── gap-analysis.service.ts
  ├── gap-analysis-created-event.handler.ts          # 配套的Event Handler
  ├── ai-career.service.ts
  ├── ai-career-created-event.handler.ts             # 配套的Event Handler
  ├── comm-session.service.ts
  ├── comm-session-created-event.handler.ts          # 配套的Event Handler
  ├── class-session.service.ts
  └── class-session-created-event.handler.ts         # 配套的Event Handler
```

**设计原则**：
- ✅ **高内聚**：每个 Service 和对应的 Event Handler 在同一目录
- ✅ **单一职责**：每个 Handler 只处理自己的 session 类型
- ✅ **易扩展**：新增类型无需修改现有 Handler
- ✅ **符合DDD**：每个业务领域独立演进

**事件订阅机制**（精准订阅，无需过滤）：
```typescript
// 各Handler监听各自专属的事件

// regular-mentoring-created-event.handler.ts
@OnEvent(REGULAR_MENTORING_SESSION_CREATED_EVENT)
async handleSessionCreated(event: RegularMentoringSessionCreatedEvent) {
  // 无需过滤，直接处理
  // 处理逻辑...
}

// gap-analysis-created-event.handler.ts
@OnEvent(GAP_ANALYSIS_SESSION_CREATED_EVENT)
async handleSessionCreated(event: GapAnalysisSessionCreatedEvent) {
  // 无需过滤，直接处理
  // 处理逻辑...
}
```

**事件文件列表**：
```
src/shared/events/
  ├── regular-mentoring-session-created.event.ts  # Regular Mentoring创建事件
  ├── gap-analysis-session-created.event.ts       # Gap Analysis创建事件
  ├── ai-career-session-created.event.ts          # AI Career创建事件
  ├── comm-session-created.event.ts               # Comm Session创建事件
  ├── class-session-created.event.ts              # Class Session创建事件
  ├── session-booked.event.ts                     # 预约完成事件（已存在）
  └── event-constants.ts                          # 事件常量集中定义
```

**改造要点**：
1. 为每个session类型创建专属的 `xxx.session.created` 事件文件（在 `src/shared/events/` 下）
2. 修改各自的 `createSession()` 方法（移除会议创建逻辑，发布专属创建事件）
3. 创建各自的 `XXXCreatedEventHandler`（监听专属创建事件，无需过滤）
4. Domain层服务新增 `completeMeetingSetup()` 和 `updateStatus()` 方法
5. 所有Handler发布统一的 `session.booked` 事件（无需拆分）

---

**文档版本**：v2.1  
**创建日期**：2025-12-03  
**最后更新**：2025-12-03  
**作者**：System Architect  
**审阅**：User Confirmed

