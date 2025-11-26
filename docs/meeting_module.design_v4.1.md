# Core Meeting Module 设计文档 v4.1

**文档版本**: v4.1  
**更新日期**: 2025-11-24  
**模块路径**: `src/core/meeting`  
**定位**: 通用子域 (Generic Subdomain) - 负责视频会议资源的生命周期管理、事件溯源与物理状态维护。  

**核心变更** (v4.0 → v4.1):
1. 新增 `reserve_id` 字段（支持飞书会议更新/取消）
2. 新增 `owner_id` 字段（会议拥有者，通常是导师）
3. 状态优化：去掉 `expired`，新增 `cancelled`
4. 新增 `auto_record` 字段（是否自动录制）
5. 索引优化：新增 `reserve_id` 和 `owner_id` 索引
6. 新增 `cancel-meeting.dto.ts`（取消会议 DTO）
7. 移除不需要的事件类型：`share_started_v1`、`share_ended_v1`

---

## 📂 1. 目录结构

```text
src/core/meeting/
├── entities/
│   ├── meeting.entity.ts             # 核心会议实体
│   └── meeting-event.entity.ts       # 原始事件日志实体
├── services/
│   ├── meeting-manager.service.ts    # 资源管理 (创建/修改/取消)
│   ├── meeting-lifecycle.service.ts  # 状态机 (处理生命周期流转)
│   ├── meeting-event.service.ts      # 事件日志与分发服务 (Log & Dispatch)
│   ├── duration-calculator.service.ts # 时长计算引擎
│   └── delayed-task.service.ts       # 延迟检测任务
├── providers/
│   ├── feishu-provider.ts            # 飞书适配器
│   ├── zoom-provider.ts              # Zoom适配器
│   └── provider.interface.ts         # 统一接口
├── events/
│   └── meeting-lifecycle.events.ts   # 领域事件
├── dto/
│   ├── create-meeting.dto.ts
│   ├── update-meeting.dto.ts
│   ├── cancel-meeting.dto.ts         # ⭐ 新增
│   └── meeting-info.dto.ts
├── tasks/
│   └── meeting-completion.task.ts
└── repositories/
    └── meeting.repository.ts         # 数据访问层
```

---

## 💾 2. 数据库设计

### 2.1 meetings 表 ⭐ 更新
**说明**: 核心聚合根，管理第三方视频会议资源的技术生命周期

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | PK | uuid_generate_v4() | 主键（下游 Domain 关联的外键） |
| `meeting_no` | VARCHAR(20) | NOT NULL | - | 飞书/Zoom 会议号（可能长期复用） |
| `meeting_provider` | VARCHAR(20) | NOT NULL | - | 平台 Enum: `feishu` \| `zoom` |
| `reserve_id` | VARCHAR(255) | NOT NULL | - | 预约 ID（飞书 reserve_id，Zoom meeting_id）⭐ v4.1 |
| `topic` | VARCHAR(255) | | - | 会议标题 |
| `meeting_url` | TEXT | NOT NULL | - | 会议入会链接 |
| `owner_id` | UUID | FK (users.id) | - | 会议拥有者 ID（通常是导师）⭐ 新增 |
| `schedule_start_time` | TIMESTAMPTZ | NOT NULL | - | 预定开始时间（查询优化关键字段） |
| `schedule_duration` | INTEGER | NOT NULL | - | 预定时长（分钟） |
| `status` | VARCHAR(20) | NOT NULL | `scheduled` | 状态 Enum: `scheduled`, `active`, `ended`, `cancelled` ⭐ 优化 |
| `actual_duration` | INTEGER | | - | 实际时长（秒），会议结束后计算 |
| `meeting_time_list` | JSONB | | `'[]'::jsonb` | 时间片段列表 `[{start, end}]`（支持断线重连） |
| `recording_url` | TEXT | | - | 录制链接 |
| `last_meeting_ended_timestamp` | TIMESTAMPTZ | | - | 最后一次 meeting.ended 事件时间（延迟判定基准） |
| `pending_task_id` | VARCHAR(255) | | - | 延迟任务 ID（30分钟延迟判定） |
| `event_type` | VARCHAR(100) | | - | 最后处理的事件类型（调试用） |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**唯一约束**:
```sql
UNIQUE (meeting_no, meeting_provider, schedule_start_time);
```
> 说明：软约束，应用层控制 7 天防重

**索引**:
- `idx_meeting_no_created_at` (meeting_no, created_at) - Webhook 快速反查
- `idx_meeting_reserve_id` (reserve_id) ⭐ 新增 - 支持通过 reserve_id 查询
- `idx_meeting_status` (status)
- `idx_meeting_schedule_start_time` (schedule_start_time)
- `idx_meeting_owner` (owner_id) ⭐ 新增

**CHECK 约束**:
```sql
CHECK (meeting_provider IN ('feishu', 'zoom'))
CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled'))  -- ⭐ 去掉 expired，新增 cancelled
CHECK (schedule_duration >= 30 AND schedule_duration <= 180)
```

**字段变更说明** (v4.0 → v4.1):
- ✅ **移除 `meeting_id`**：遵循飞书 API 规范，只保留 `reserve_id`
- ✅ **`reserve_id` 必填**：作为统一的平台预约 ID（飞书 reserve_id，Zoom meeting_id）
- ✅ 新增 `owner_id`（明确会议拥有者）
- ✅ 状态优化：`expired` → `cancelled`（语义更清晰）
- ✅ 保留 `topic`（会议标题，方便调试和日志）
- ✅ 保留 `recording_url`（录制链接）

---

### 2.2 meeting_events 表
**说明**: 事件溯源表，记录所有 Webhook 原始事件

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | PK | uuid_generate_v4() | 主键 |
| `meeting_no` | VARCHAR(20) | NOT NULL | - | 关联字段（用于快速查询） |
| `reserve_id` | VARCHAR(255) | NOT NULL | - | 预约 ID（飞书 reserve_id，Zoom meeting_id）⭐ v4.1 |
| `event_id` | VARCHAR(255) | UNIQUE | - | 事件 ID (Header 中的唯一 ID) |
| `event_type` | VARCHAR(100) | NOT NULL | - | 事件类型 |
| `topic` | VARCHAR(255) | | - | 会议主题（冗余字段） |
| `start_time` | TIMESTAMPTZ | | - | 事件涉及的开始时间（如果有） |
| `end_time` | TIMESTAMPTZ | | - | 事件涉及的结束时间（如果有） |
| `event_data` | JSONB | NOT NULL | `'{}'::jsonb` | 原始 Payload |
| `occurred_at` | TIMESTAMPTZ | NOT NULL | NOW() | 事件发生时间 |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |

**索引**:
- `idx_meeting_event_no_occurred` (meeting_no, occurred_at DESC)
- `idx_meeting_event_type` (event_type)
- `idx_meeting_event_id` (event_id) UNIQUE

**用途**:
- 完整的事件审计日志
- 调试 Webhook 问题
- 数据一致性检查
- 未来可能的重放和回溯

---

## 🛠️ 3. 核心 Services 设计

### 3.1 MeetingManagerService
**文件**: `src/core/meeting/services/meeting-manager.service.ts`  
**职责**: 处理 Application 层的命令请求（资源管理）

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `createMeeting(dto)` | `CreateMeetingDto` | `MeetingEntity` | **创建会议**<br>1. 防重检查：查询 `meeting_no` 在 `dto.startTime` 前后 7 天内是否存在<br>2. 若存在则抛出 `DuplicateMeetingException`<br>3. 调用 Provider 创建远程会议<br>4. 插入 DB 并返回（包含 `reserve_id`）⭐ |
| `updateMeeting(id, dto)` | `id, UpdateMeetingDto` | `MeetingEntity` | **修改会议**<br>1. 检查 status 是否为 `scheduled`（进行中/已结束不可改）<br>2. 调用 Provider 更新远程会议（需要 `reserve_id`）⭐<br>3. 更新 DB 的 `schedule_start_time`、`schedule_duration` 等字段 |
| `cancelMeeting(id, reason?)` | `id, CancelMeetingDto?` | `void` | **取消会议** ⭐ 增强<br>1. 检查 status 是否为 `scheduled`<br>2. 调用 Provider 取消远程会议（需要 `reserve_id`）⭐<br>3. 更新 status = `cancelled`<br>4. 可选：记录取消原因 |

**DTO 示例**:

```typescript
// CreateMeetingDto
{
  topic: string;
  meetingProvider: 'feishu' | 'zoom';
  ownerId: string;  // ⭐ 新增
  scheduleStartTime: Date;
  scheduleDuration: number;  // 分钟
  autoRecord: boolean;  // ⭐ 新增
}

// UpdateMeetingDto
{
  scheduleStartTime?: Date;
  scheduleDuration?: number;
  topic?: string;
}

// CancelMeetingDto ⭐ 新增
{
  reason?: string;  // 取消原因（可选）
}
```

---

### 3.2 MeetingEventService
**文件**: `src/core/meeting/services/meeting-event.service.ts`  
**职责**: **核心入口**。负责日志写入与事件分发 (Log & Dispatch)

**处理的事件类型 (Feishu Enum)**:
- `vc.meeting.meeting_started_v1` (会议开始)
- `vc.meeting.meeting_ended_v1` (会议结束)
- `vc.meeting.recording_ready_v1` (录制就绪)
- `vc.meeting.recording_started_v1` (录制开始)
- `vc.meeting.recording_ended_v1` (录制结束)
- `vc.meeting.join_meeting_v1` (参会人加入)
- `vc.meeting.leave_meeting_v1` (参会人离开)

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `recordEvent(event)` | `StandardEventDto` | `void` | **事件处理入口**<br>1. 写入 `meeting_events` 表（事件溯源）<br>2. 根据 `event.eventType` 分发到对应处理器<br>3. 调用 `MeetingLifecycleService` 对应方法 |
| `handleMeetingStarted(event)` | `EventDto` | `void` | 分发到 `lifecycleService.handleMeetingStarted()` |
| `handleMeetingEnded(event)` | `EventDto` | `void` | 分发到 `lifecycleService.handleMeetingEnded()` |
| `handleRecordingReady(event)` | `EventDto` | `void` | 分发到 `lifecycleService.handleRecordingReady()` |

**幂等性保证**:
- 通过 `event_id` UNIQUE 约束防止重复处理
- 插入失败时直接返回（不抛异常）

---

### 3.3 MeetingLifecycleService
**文件**: `src/core/meeting/services/meeting-lifecycle.service.ts`  
**职责**: 状态机核心，执行具体的业务逻辑

**查询优化策略**: 
根据 `meeting_no` 反查 `meetings` 表时，**必须**附加时间窗口条件：

```sql
WHERE meeting_no = ? 
  AND created_at > (NOW() - INTERVAL '7 days')
ORDER BY created_at DESC 
LIMIT 1
```

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `handleMeetingStarted` | `meetingNo, startTime` | `void` | **会议开始**<br>1. 根据 `meeting_no` 反查（带 7 天限制）<br>2. 更新 status = `active`<br>3. 更新 `event_type` = `meeting_started` |
| `handleMeetingEnded` | `meetingNo, endTime` | `void` | **会议结束**<br>1. 根据 `meeting_no` 反查（带 7 天限制）<br>2. 更新 `last_meeting_ended_timestamp`<br>3. 取消之前的延迟任务（如果有）<br>4. 创建新的延迟任务（30分钟后执行）<br>5. 保存 `pending_task_id` |
| `finalizeMeeting` | `meetingId` | `void` | **最终判定**（延迟任务回调）<br>1. 调用 `DurationCalculatorService` 计算时长<br>2. 更新 `actual_duration`、`meeting_time_list`<br>3. 更新 status = `ended`<br>4. 发布 `MeetingCompletedEvent` |
| `handleRecordingReady` | `meetingNo, recordingUrl` | `void` | **录制就绪**<br>1. 更新 `recording_url` |
| `cancelMeetingStatus` | `meetingId` | `void` | **取消状态** ⭐ 新增<br>1. 更新 status = `cancelled`<br>2. 清理延迟任务（如果有） |

**状态机流转**:

```
scheduled (预定)
    ↓ meeting_started
active (进行中)
    ↓ meeting_ended (30分钟延迟)
ended (已结束)

scheduled → cancelled (用户取消) ⭐ 新增
```

---

### 3.4 DurationCalculatorService
**文件**: `src/core/meeting/services/duration-calculator.service.ts`  
**职责**: 基于事件日志计算实际会议时长

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `calculateDuration` | `meetingNo` | `{ actualDuration: number, timeList: TimeSegment[] }` | **计算时长**<br>1. 从 `meeting_events` 查询所有 `join_meeting` 和 `leave_meeting` 事件<br>2. 按时间排序，配对计算有效时间段<br>3. 合并重叠时间段<br>4. 返回总时长（秒）和时间段列表 |

**算法逻辑**:
```typescript
interface TimeSegment {
  start: Date;
  end: Date;
}

// 1. 提取所有 join/leave 事件
// 2. 配对成时间段（最后一个 leave 为结束）
// 3. 合并重叠时间段（处理断线重连）
// 4. 计算总秒数
```

---

### 3.5 DelayedTaskService
**文件**: `src/core/meeting/services/delayed-task.service.ts`  
**职责**: 管理延迟判定任务（30 分钟延迟）

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `createDelayedTask` | `meetingId, delay` | `taskId: string` | 创建延迟任务（返回任务 ID） |
| `cancelTask` | `taskId` | `void` | 取消延迟任务 |

**实现方式**:
- 使用 NestJS Bull Queue（Redis）
- 延迟时间：30 分钟
- 任务内容：调用 `lifecycleService.finalizeMeeting(meetingId)`

---

## 🔌 4. Provider 接口设计

### 4.1 IMeetingProvider

**文件**: `src/core/meeting/providers/provider.interface.ts`

```typescript
interface IMeetingProvider {
  /**
   * 创建会议
   */
  createMeeting(dto: CreateMeetingProviderDto): Promise<MeetingProviderResult>;

  /**
   * 更新会议（需要 reserve_id）⭐
   */
  updateMeeting(reserveId: string, dto: UpdateMeetingProviderDto): Promise<void>;

  /**
   * 取消会议（需要 reserve_id）⭐ 新增
   */
  cancelMeeting(reserveId: string): Promise<void>;
}

interface MeetingProviderResult {
  meetingId: string;      // 平台 ID
  meetingNo: string;      // 会议号
  reserveId: string;      // 预定 ID ⭐ 新增
  meetingUrl: string;     // 入会链接
}
```

### 4.2 FeishuProvider

**文件**: `src/core/meeting/providers/feishu-provider.ts`

**调用的飞书 API**:
- `POST /open-apis/vc/v1/reserves/apply` - 创建会议
- `PUT /open-apis/vc/v1/reserves/:reserve_id/update` - 更新会议 ⭐
- `DELETE /open-apis/vc/v1/reserves/:reserve_id` - 取消会议 ⭐ 新增

**关键实现**:
- 自动获取和刷新 tenant_access_token
- 错误处理和重试机制
- 请求日志记录

---

## 📢 5. 领域事件 (Events)

### 5.1 MeetingCompletedEvent
**说明**: Core → Domain 的通知事件（会议真正结束）

| 属性名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `eventName` | String | 固定值: `meeting.lifecycle.completed` |
| `meetingId` | UUID | **关键主键**，`meetings` 表的 UUID |
| `meetingNo` | String | 飞书会议号 |
| `scheduleStartTime` | Date | 预约开始时间 |
| `actualDuration` | Number | 物理时长（秒） |
| `recordingUrl` | String \| null | 录制链接 |
| `endedAt` | Date | 最终结束时间 |
| `timeList` | Array | 会议时间段列表 `[{start, end}]` |

**下游处理建议**:
- Domain 模块监听此事件后，**应直接使用 `meetingId`** 去自己的业务表 (`mentoring_sessions` 等) 查询记录
- `repo.findOne({ where: { meetingId: event.meetingId } })`
- 这是最准确的（UUID 唯一），无需关心日期范围或 `meeting_no` 复用问题

---

### 5.2 MeetingCancelledEvent ⭐ 新增
**说明**: Core → Domain 的通知事件（会议被取消）

| 属性名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `eventName` | String | 固定值: `meeting.lifecycle.cancelled` |
| `meetingId` | UUID | **关键主键**，`meetings` 表的 UUID |
| `meetingNo` | String | 飞书会议号 |
| `scheduleStartTime` | Date | 预约开始时间 |
| `cancelledAt` | Date | 取消时间 |
| `reason` | String \| null | 取消原因（可选） |

**下游处理**:
- Sessions 模块监听此事件
- 更新 Session 状态为 `cancelled`
- Calendar 模块同步更新状态

---

## 🔄 6. 关键流程

### 6.1 约课防重流程
1. **App**: `createMeeting(no, time)`
2. **Core**: `SELECT count(*) FROM meetings WHERE meeting_no = ? AND schedule_start_time BETWEEN (time - 7 days) AND (time + 7 days)`
3. **Core**: 如果 > 0，抛出 `DuplicateMeetingException`
4. **Core**: 否则调用 Provider 创建会议
5. **Core**: 插入 DB（包含 `reserve_id`）⭐

**防重逻辑说明**:
- 7 天窗口期（避免误判）
- 考虑到会议号可能长期复用
- 基于 `meeting_no` + `schedule_start_time` 联合判断

---

### 6.2 Webhook 反查流程
1. **Webhook**: 调用 `recordEvent`
2. **Core (EventService)**: 写入 `meeting_events` 表（事件溯源）
3. **Core (EventService)**: 识别到 `meeting.ended` → 调用 `lifecycle.handleMeetingEnded`
4. **Core (Lifecycle)**: 
   ```sql
   SELECT * FROM meetings 
   WHERE meeting_no = ? 
     AND created_at > (occurred_at - 7 days)
   ORDER BY created_at DESC 
   LIMIT 1
   ```
5. **Core**: 找到对应的最近一次会议记录，进行状态更新

**查询策略说明**:
- 必须附加 7 天时间窗口（性能优化）
- ORDER BY created_at DESC（取最新记录）
- LIMIT 1（只需一条记录）

---

### 6.3 延迟判定流程

```
1. meeting.ended 事件到达
   ↓
2. 创建延迟任务（30 分钟后执行）
   ↓
3. 保存 pending_task_id 到 DB
   ↓
4. 如果 30 分钟内再次收到 meeting.ended
   ↓
5. 取消之前的任务
   ↓
6. 创建新的延迟任务（重新计时 30 分钟）
   ↓
7. 30 分钟后无新事件
   ↓
8. 延迟任务触发
   ↓
9. MeetingLifecycleService.finalizeMeeting()
   ↓
10. 计算时长
   ↓
11. 更新 status = 'ended'
   ↓
12. 发布 MeetingCompletedEvent
```

**为什么需要延迟判定**:
- 飞书可能发送多次 `meeting.ended` 事件
- 用户可能断线重连
- 避免过早判定会议结束

---

### 6.4 更新会议流程 ⭐

```
1. Application Layer: updateMeeting(meetingId, dto)
   ↓
2. 查询 Meeting 记录（获取 reserve_id）
   ↓
3. 检查 status = 'scheduled'（只能修改未开始的会议）
   ↓
4. 调用 FeishuProvider.updateMeeting(reserve_id, newTime)
   ↓
5. 更新 DB 记录
   ↓
6. 返回更新后的 MeetingEntity
```

**关键字段**:
- `reserve_id`：飞书预定 ID，更新会议必需

---

### 6.5 取消会议流程 ⭐ 新增

```
1. Application Layer: cancelMeeting(meetingId, reason)
   ↓
2. 查询 Meeting 记录（获取 reserve_id）
   ↓
3. 检查 status = 'scheduled'（只能取消未开始的会议）
   ↓
4. 调用 FeishuProvider.cancelMeeting(reserve_id)
   ↓
5. 更新 status = 'cancelled'
   ↓
6. 清理延迟任务（如果有）
   ↓
7. 发布 MeetingCancelledEvent（下游监听）
```

---

## 🎯 7. 设计原则

### 7.1 单一职责

**Meeting 模块只管技术资源**:
- ✅ 会议的创建/更新/取消
- ✅ 会议的生命周期状态
- ✅ 会议的时长计算
- ✅ 会议的录制管理
- ❌ 不管业务状态（scheduled/completed 是 Sessions 的事）
- ❌ 不管计费逻辑

### 7.2 事件驱动

**松耦合设计**:
- Core 层发布事件（MeetingCompletedEvent, MeetingCancelledEvent）
- Domain 层监听事件（更新 Sessions）
- 层级之间不直接依赖

### 7.3 事件溯源

**完整的审计日志**:
- 所有 Webhook 事件都存入 `meeting_events`
- 支持重放和回溯
- 便于调试和问题定位

### 7.4 幂等性保证

**防止重复处理**:
- `event_id` UNIQUE 约束
- 延迟任务可以被覆盖（取消旧任务，创建新任务）
- 状态机保证合法流转

### 7.5 防重机制

**7 天窗口期**:
- 创建时检查：防止重复创建
- Webhook 时检查：快速反查最新记录
- 平衡性能和准确性

---

## 📊 8. 数据流图

### 8.1 创建会议流程

```
Application Command
    ↓
MeetingManagerService
    ↓
FeishuProvider (API 调用)
    ↓
Meeting Entity (插入 DB，含 reserve_id)
    ↓
返回给 Application Layer
```

### 8.2 Webhook 处理流程

```
Webhook Controller
    ↓
MeetingEventService (事件日志)
    ↓
MeetingLifecycleService (状态机)
    ↓
DelayedTaskService (延迟任务)
    ↓
DurationCalculatorService (计算时长)
    ↓
EventBus (发布领域事件)
    ↓
Domain Layer (Sessions 监听)
```

---

## ✅ 9. 版本历史

**版本演进**:
- **v4.0**: 初始设计，事件溯源 + 延迟判定
- **v4.1**: ⭐ **当前版本**
  - 新增 `reserve_id` 字段（支持会议更新/取消）
  - 新增 `owner_id` 字段（会议拥有者）
  - 新增 `auto_record` 字段（是否自动录制）
  - 状态优化：`expired` → `cancelled`
  - 新增 `MeetingCancelledEvent` 事件
  - 新增 `cancelMeetingStatus` 方法
  - 新增 `CancelMeetingDto`
  - Provider 接口新增 `cancelMeeting` 方法
  - 移除不需要的事件类型（share_started, share_ended）
  - 索引优化：新增 reserve_id 和 owner_id 索引

---

## 📝 10. 实现注意事项

### 10.1 性能优化

**查询优化**:
- 所有 `meeting_no` 查询都必须附加时间窗口条件
- 使用复合索引 `(meeting_no, created_at)`
- LIMIT 1 限制返回结果

**索引策略**:
- 为高频查询字段建立索引
- 定期分析慢查询

### 10.2 错误处理

**API 调用失败**:
- 飞书 API 调用失败时，抛出明确的异常
- Application 层负责事务回滚

**Webhook 丢失**:
- 依赖延迟判定机制（30 分钟兜底）
- 事件溯源表支持手动补偿

### 10.3 监控指标

**关键指标**:
- 会议创建成功率
- Webhook 处理延迟
- 延迟任务执行情况
- 状态流转异常率

---

**文档结束** 🎉

**设计哲学**:
> "Core 层只管技术资源，Domain 层管业务逻辑，职责清晰胜过巧妙抽象"

