# Core Meeting Module 设计文档 v4.0

**文档版本**: v4.0  
**更新日期**: 2025-11-19  
**模块路径**: `src/core/meeting`  
**定位**: 通用子域 (Generic Subdomain) - 负责视频会议资源的生命周期管理、事件溯源与物理状态维护。  

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
│   └── meeting-info.dto.ts
└── tasks/
    └── meeting-completion.task.ts
```

---

## 💾 2. 数据库设计

### 2.1 meetings 表
**说明**: 核心聚合根。

| 字段名 | 类型 | 用途 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | 主键 | **下游 Domain 关联的外键 (FK)** |
| `meeting_no` | VARCHAR | 核心索引 | 飞书/Zoom 会议号 (可能长期复用) |
| `meeting_provider` | VARCHAR | 平台 | `feishu` \| `zoom` |
| `meeting_id` | VARCHAR | 平台ID | 第三方平台唯一ID |
| `topic` | VARCHAR | 标题 | - |
| `meeting_url` | TEXT | 链接 | - |
| `schedule_start_time` | TIMESTAMPTZ | 计划时间 | **查询优化关键字段** |
| `schedule_duration` | INTEGER | 计划时长 | 分钟 |
| `status` | VARCHAR | 状态 | `scheduled`, `active`, `ended`, `expired` |
| `actual_duration` | INTEGER | 物理时长 | 秒 |
| `meeting_time_list` | JSONB | 时间段 | `[{start, end}]` |
| `recording_url` | TEXT | 录制 | - |
| `last_meeting_ended_timestamp` | TIMESTAMPTZ | 延迟基准 | - |
| `pending_task_id` | VARCHAR | 任务锁 | - |
| `event_type` | VARCHAR | 事件类型 | - |
| `created_at` | TIMESTAMPTZ | 创建时间 | - |
| `updated_at` | TIMESTAMPTZ | 更新时间 | - |

**索引**:
*   `UNIQUE(meeting_no, meeting_provider, schedule_start_time)` (软约束，应用层控制7天防重)
*   `INDEX(meeting_no, created_at)` (用于 Webhook 快速反查)
*   `INDEX(status)`

### 2.2 meeting_events 表
**说明**: 事件溯源表。

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | UUID | 主键 |
| `meeting_no` | VARCHAR | 关联字段 |
| `meeting_id` | VARCHAR | 平台ID |
| `event_id` | VARCHAR | 事件ID (Header中的唯一ID) |
| `event_type` | VARCHAR | `vc.meeting.meeting_started_v1` 等 |
| `topic` | VARCHAR | 会议主题 (冗余字段) |
| `start_time` | TIMESTAMPTZ | 事件涉及的开始时间 (如果有) |
| `end_time` | TIMESTAMPTZ | 事件涉及的结束时间 (如果有) |
| `event_data` | JSONB | 原始 Payload |
| `occurred_at` | TIMESTAMPTZ | 发生时间 |

---

## 🛠️ 3. 核心 Services 设计

### 3.1 MeetingManagerService
**文件**: `src/core/meeting/services/meeting-manager.service.ts`  
**职责**: 处理 Application 层的命令请求。

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `createMeeting(dto)` | `CreateMeetingDto` | `MeetingEntity` | 1. **防重检查**: 查询 `meeting_no` 在 `dto.startTime` 前后 7 天内是否存在。<br>2. 若存在则报错，不存在则调用 Provider 创建。<br>3. 插入 DB 并返回。 |
| `updateMeeting(id, dto)` | `id, UpdateMeetingDto` | `MeetingEntity` | **修改会议**。<br>1. 检查 status 是否为 `scheduled` (进行中不可改)。<br>2. 调用 Provider 更新远程会议。<br>3. 更新 DB 的 `schedule_start_time` 等字段。 |
| `cancelMeeting(id)` | `id` | `void` | 取消会议。 |

### 3.2 MeetingEventService
**文件**: `src/core/meeting/services/meeting-event.service.ts`  
**职责**: **核心入口**。负责日志写入与事件分发 (Log & Dispatch)。

**处理的事件类型 (Feishu Enum)**:
*   `vc.meeting.meeting_started_v1` (会议开始)
*   `vc.meeting.meeting_ended_v1` (会议结束)
*   `vc.meeting.recording_ready_v1` (录制就绪)
*   `vc.meeting.recording_started_v1` (录制开始)
*   `vc.meeting.recording_ended_v1` (录制结束)
*   `vc.meeting.join_meeting_v1` (参会人加入)
*   `vc.meeting.leave_meeting_v1` (参会人离开)
*   `vc.meeting.share_started_v1` (屏幕共享开始)
*   `vc.meeting.share_ended_v1` (屏幕共享结束)

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `recordEvent(event)` | `StandardEventDto` | `void` | 1. `repo.insert(event)`<br>2. `switch(event.eventType)`<br>3. 调用 `MeetingLifecycleService` 对应方法。 |

### 3.3 MeetingLifecycleService
**文件**: `src/core/meeting/services/meeting-lifecycle.service.ts`  
**职责**: 状态机核心，执行具体的业务逻辑。

**查询优化策略**: 
根据 `meeting_no` 反查 `meetings` 表时，**必须**附加时间窗口条件：
`WHERE meeting_no = ? AND created_at > (NOW() - 7 DAYS)`。

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `handleMeetingStarted` | `meetingNo, time` | `void` | 查表(带7天限制) -> 更新 status=`active`。 |
| `handleMeetingEnded` | `meetingNo, time` | `void` | 查表(带7天限制) -> 启动延迟检测任务。 |
| `finalizeMeeting` | `meetingNo` | `void` | 任务回调 -> 计算时长 -> 发布 `MeetingLifecycleCompletedEvent`。 |
| `handleRecordingReady` | `meetingNo, url` | `void` | 更新 `recording_url`。 |

---

## 📢 4. 领域事件 (Events)

### 4.1 MeetingLifecycleCompletedEvent
**说明**: Core -> Domain 的通知事件。

| 属性名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `eventName` | String | 固定值: `meeting.lifecycle.completed` |
| `meetingId` | UUID | **关键主键**。`meetings` 表的 UUID。 |
| `meetingNo` | String | 飞书会议号。 |
| `scheduleStartTime` | Date | 预约开始时间 (新增字段)。 |
| `actualDuration` | Number | 物理时长 (秒)。 |
| `recordingUrl` | String | 录制链接。 |
| `endedAt` | Date | 最终结束时间。 |
| `timeList` | Array | 会议时间段列表 `[{start, end}]`。 |

**下游处理建议**:
Domain 模块监听此事件后，**应直接使用 `meetingId`** 去自己的业务表 (`mentoring_sessions` 等) 查询记录。
`repo.findOne({ where: { meetingId: event.meetingId } })`
这是最准确的（UUID 唯一），无需关心日期范围或 `meeting_no` 复用问题。

---

## 🔄 5. 关键流程修正

### 5.1 约课防重流程
1.  **App**: `createMeeting(no, time)`
2.  **Core**: `SELECT count(*) FROM meetings WHERE meeting_no = ? AND schedule_start_time BETWEEN time-7d AND time+7d`
3.  **Core**: 如果 > 0，抛出 `DuplicateMeetingException`。
4.  **Core**: 否则继续创建。

### 5.2 Webhook 反查流程
1.  **Webhook**: 调用 `recordEvent`。
2.  **Core (EventService)**: 写入日志 -> 识别到 `meeting.ended` -> 调用 `lifecycle.handleMeetingEnded`。
3.  **Core (Lifecycle)**: `SELECT * FROM meetings WHERE meeting_no = ? AND created_at > (occurred_at - 7d) ORDER BY created_at DESC LIMIT 1`。
4.  **Core**: 找到对应的最近一次会议记录，进行状态更新。
