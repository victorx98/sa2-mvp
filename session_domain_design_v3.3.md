# Session Domain 设计文档 v3.3

**文档版本**: v3.3 (精简版)  
**更新日期**: 2025-11-12  
**范围**: Session Domain 模块专项文档  
**阅读时间**: 5分钟

---

## 📂 1. 目录结构

```
session/
├── services/
│   ├── session.service.ts                # Session CRUD原子操作
│   ├── session-duration-calculator.ts    # 时长计算服务
│   └── session-query.service.ts          # 查询服务
├── subscribers/
│   └── session-event.subscriber.ts       # 事件订阅者（监听MeetingEventCreated）
├── recording/
│   ├── session-recording-manager.ts      # 录制管理
│   ├── transcript-polling.service.ts     # 文字记录轮询
│   └── ai-summary.service.ts             # AI总结生成
├── repositories/
│   └── session.repository.ts             # Session数据访问
└── dto/
    ├── create-session.dto.ts
    ├── update-session.dto.ts
    ├── meeting-info.dto.ts
    └── query-filters.dto.ts
```

**设计说明**: CreateSessionDto 现已整合会议相关字段（meeting_provider, meeting_no, meeting_url, meeting_password），允许在BFF层创建会议后一次性创建session并设置所有会议信息。注意：meeting_id 只在会议开始后才能获取（飞书/Zoom返回），不存储在session表中，而是记录在meeting_event表中。

---

## 🎯 2. SessionService

**文件**: `src/domains/services/session/services/session.service.ts`

| 方法 | 参数 | 返回值 | 功能说明 |
|-----|-----|-------|--------|
| `createSession(dto)` | CreateSessionDto | SessionEntity | 创建session记录并设置会议信息（包含meeting_no、meeting_url等） |
| `updateSession(id, dto)` | sessionId, UpdateSessionDto | SessionEntity | 更新session字段 |
| `updateMeetingInfo(id, info)` | sessionId, MeetingInfoDto | SessionEntity | 更新会议信息（仅在特定场景如重新创建会议时使用） |
| `cancelSession(id, reason)` | sessionId, cancelReason | SessionEntity | 更新状态为cancelled，记录取消原因 |
| `softDeleteSession(id)` | sessionId | SessionEntity | 软删除（设置deleted_at） |
| `getSessionById(id)` | sessionId | SessionEntity | 查询单个session详情 |
| `getSessionByMeetingNo(no)` | meetingNo | SessionEntity | 根据meeting_no查询session（Webhook用，用于关联飞书会议事件） |

---

## 📋 3. DTO 定义

### 3.1 CreateSessionDto

| 字段 | 类型 | 必填 | 说明 | 验证规则 |
|-----|-----|-----|------|--------|
| **基础字段** |
| `student_id` | UUID | 是 | 学生用户ID | 必须存在于user表 |
| `mentor_id` | UUID | 是 | 导师用户ID | 必须存在于user表，角色为mentor |
| `scheduled_start_time` | DateTime | 是 | 计划开始时间 | 必须晚于当前时间 |
| `scheduled_duration` | Integer | 是 | 计划时长（分钟） | 30 ≤ duration ≤ 180 |
| `session_name` | String | 否 | 约课名称 | 最大长度255 |
| `notes` | String | 否 | 备注信息 | 最大长度2000 |
| `contract_id` | UUID | 否 | 关联合同ID | 必须存在于contract表 |
| **会议信息字段** |
| `meeting_provider` | Enum | 否 | 会议平台 | 'feishu' \| 'zoom' |
| `meeting_no` | String | 否 | 飞书会议号（9位数字） | 由MeetingProvider.createMeeting()返回，仅飞书会议有效 |
| `meeting_url` | String | 否 | 会议链接 | 由MeetingProvider.createMeeting()返回 |
| `meeting_password` | String | 否 | 会议密码 | 可选，由MeetingProvider.createMeeting()返回 |

**说明**: 
- `session_name` 为空时自动生成为"与{导师名称}的辅导课程"
- 会议信息字段（meeting_*）在BFF层先调用 `MeetingProvider.createMeeting()` 获取，然后随CreateSessionDto一起传入
- `meeting_no`（飞书会议号）在会议创建时就存在，用于后续webhook事件中关联session
- `meeting_id`（第三方会议ID）只在会议开始后才能获取，因此不存储在session表中，而是在meeting_event表中记录
- 这样做的好处是一次性创建session并设置所有会议信息，避免多次数据库更新

---

### 3.2 UpdateSessionDto

| 字段 | 类型 | 必填 | 说明 | 验证规则 |
|-----|-----|-----|------|--------|
| `scheduled_start_time` | DateTime | 否 | 修改开始时间 | 必须晚于当前时间 |
| `scheduled_duration` | Integer | 否 | 修改计划时长 | 30 ≤ duration ≤ 180 |
| `session_name` | String | 否 | 修改约课名称 | 最大长度255 |
| `notes` | String | 否 | 修改备注 | 最大长度2000 |
| `contract_id` | UUID | 否 | 修改关联合同ID | 必须存在于contract表 |
| `status` | Enum | 否 | 修改状态 | scheduled → started → completed 或 → cancelled |

---

### 3.3 MeetingInfoDto

| 字段 | 类型 | 必填 | 说明 |
|-----|-----|-----|------|
| `meeting_provider` | Enum | 是 | 会议平台 |
| `meeting_no` | String | 否 | 飞书会议号（9位数字） |
| `meeting_url` | String | 是 | 会议链接 |
| `meeting_password` | String | 否 | 会议密码 |

**说明**: 
- 该DTO主要用于 `updateMeetingInfo()` 方法，用于特定场景如重新创建会议时更新会议信息
- 在正常的createSession流程中，这些字段已经集成到CreateSessionDto中，无需单独使用此DTO

---

### 3.4 SessionEntity 返回值

| 字段 | 类型 | 说明 |
|-----|-----|------|
| `id` | UUID | 主键 |
| `student_id` | UUID | 学生ID |
| `mentor_id` | UUID | 导师ID |
| `contract_id` | UUID\|null | 关联合同ID |
| `meeting_provider` | String | 会议平台 |
| `meeting_no` | String\|null | 飞书会议号（创建会议时获取，用于关联webhook事件） |
| `meeting_url` | String\|null | 会议链接 |
| `meeting_password` | String\|null | 会议密码 |
| `scheduled_start_time` | DateTime | 计划开始时间 |
| `scheduled_duration` | Integer | 计划时长（分钟） |
| `actual_start_time` | DateTime\|null | 实际开始时间 |
| `actual_end_time` | DateTime\|null | 实际结束时间 |
| `recordings` | Recording[] | 录制数组（支持多段） |
| `ai_summary` | JSONB\|null | AI总结对象（结构化数据） |
| `mentor_total_duration_seconds` | Integer\|null | 导师总在线时长（秒） |
| `student_total_duration_seconds` | Integer\|null | 学生总在线时长（秒） |
| `effective_tutoring_duration_seconds` | Integer\|null | 有效辅导时长（秒） |
| `mentor_join_count` | Integer | 导师进入次数 |
| `student_join_count` | Integer | 学生进入次数 |
| `session_name` | String | 约课名称 |
| `notes` | String\|null | 备注 |
| `status` | Enum | scheduled \| started \| completed \| cancelled |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |
| `deleted_at` | DateTime\|null | 软删除时间 |

---

## 🔄 4. SessionEventSubscriber（事件订阅者）

**文件**: `src/domains/services/session/subscribers/session-event.subscriber.ts`

**设计说明**: SessionEventSubscriber作为事件订阅者，使用NestJS的`@OnEvent`装饰器监听Webhook Module发布的MeetingEventCreated事件，根据meeting_no查询session表判断是否属于自己的会议，然后处理Session的业务逻辑。

| 方法 | 参数 | 返回值 | 触发方式 |
|-----|-----|-------|--------|
| `handleMeetingEvent(event)` | MeetingEventCreated | Promise<void> | @OnEvent('MeetingEventCreated') 自动订阅 |
| `handleMeetingStarted(sessionId, occurredAt)` | sessionId: UUID, occurredAt: DateTime | Promise<void> | 内部方法：更新actual_start_time, status='started' |
| `handleMeetingEnded(sessionId, occurredAt)` | sessionId: UUID, occurredAt: DateTime | Promise<void> | 内部方法：更新actual_end_time, status='completed'，计算时长 |
| `handleRecordingReady(sessionId, event)` | sessionId: UUID, event: MeetingEventCreated | Promise<void> | 内部方法：追加录制信息，启动transcript轮询 |
| `handleParticipantJoined(...)` | sessionId, operatorId, occurredAt | Promise<void> | 内部方法：记录join事件（用于时长计算） |
| `handleParticipantLeft(...)` | sessionId, operatorId, occurredAt | Promise<void> | 内部方法：记录leave事件（用于时长计算） |

**事件处理流程**:
```
1. 通过 @OnEvent('MeetingEventCreated') 自动订阅事件
2. 根据 event.meetingNo 查询 session 表
3. 如果找不到 session，直接返回（不是自己的会议）
4. 如果找到 session，根据 event_type 路由到对应的内部方法处理
5. 更新 session 表的业务字段（actual_start_time, status等）
```

---

## 🎬 5. SessionRecordingManager

**文件**: `src/domains/services/session/recording/session-recording-manager.ts`

| 方法 | 参数 | 返回值 | 功能说明 |
|-----|-----|-------|--------|
| `appendRecording(sessionId, data)` | sessionId, RecordingData | void | 追加新录制到recordings数组 |
| `updateRecordingTranscript(...)` | sessionId, recordingId, url | void | 更新指定录制的transcript_url |
| `isAllTranscriptsFetched(sessionId)` | sessionId | boolean | 检查是否所有录制的transcript都已获取 |
| `getAllRecordings(sessionId)` | sessionId | Recording[] | 获取session的所有录制 |
| `getRecordingBySequence(...)` | sessionId, sequence | Recording | 根据sequence获取指定录制 |

**Recording 子对象**: recording_id, recording_url, transcript_url, duration, sequence, started_at, ended_at

---

## ⏱️ 5. SessionDurationCalculator

**文件**: `src/domains/services/session/services/session-duration-calculator.ts`

**设计说明**: 通过查询session_events表中的join/leave事件，计算导师和学生的在线时长。

| 方法 | 参数 | 返回值 | 功能说明 |
|-----|-----|-------|--------|
| `calculateDurations(sessionId)` | sessionId | DurationStats | 从session_events表查询join/leave事件，计算导师/学生时长、有效辅导时长 |

**DurationStats 返回值**:

| 字段 | 类型 | 说明 |
|-----|-----|------|
| `mentor_total_duration_seconds` | Integer | 导师总在线时长（秒） |
| `student_total_duration_seconds` | Integer | 学生总在线时长（秒） |
| `effective_tutoring_duration_seconds` | Integer | 有效辅导时长（导师和学生同时在线） |
| `mentor_join_count` | Integer | 导师进入次数 |
| `student_join_count` | Integer | 学生进入次数 |
| `overlap_intervals` | Array | 导师和学生同时在线的时间段列表 |

---

## 🔍 6. SessionQueryService

**文件**: `src/domains/services/session/services/session-query.service.ts`

| 方法 | 参数 | 返回值 | 功能说明 |
|-----|-----|-------|--------|
| `findByStudentId(...)` | studentId, filters, pagination | PaginatedResult<SessionEntity> | 查询学生的约课列表 |
| `findByMentorId(...)` | mentorId, filters, pagination | PaginatedResult<SessionEntity> | 查询导师的约课列表 |
| `findUpcomingSessions(...)` | userId, role, limit | SessionEntity[] | 查询即将到来的约课 |
| `getSessionStatistics(...)` | userId, role, dateRange | SessionStats | 获取约课统计数据 |

**QueryFilters**: status[], date_from, date_to, has_recording, has_transcript, keyword

**PaginationDto**: page (默认1), limit (默认20, 1-100), sort, order (asc\|desc)

**PaginatedResult**: data, total, page, limit, totalPages, hasNext, hasPrev

---

## 💾 7. 数据库表设计

### 7.1 session 表（Session Domain管理）

| 字段 | 类型 | 说明 | 约束 |
|-----|-----|------|-----|
| `id` | UUID | 主键 | NOT NULL, PK |
| `student_id` | UUID | 学生ID | NOT NULL, FK(user.id), INDEX |
| `mentor_id` | UUID | 导师ID | NOT NULL, FK(user.id), INDEX |
| `contract_id` | UUID | 关联合同ID | NULLABLE, FK(contract.id), INDEX |
| `meeting_provider` | VARCHAR(20) | 'feishu' \| 'zoom' | NOT NULL |
| `meeting_no` | VARCHAR(20) | 飞书会议号（关键字段，用于webhook关联） | NULLABLE, INDEX |
| `meeting_url` | TEXT | 会议链接 | NULLABLE |
| `meeting_password` | VARCHAR(50) | 会议密码 | NULLABLE |
| `scheduled_start_time` | TIMESTAMP | 计划开始时间 | NOT NULL, INDEX |
| `scheduled_duration` | INTEGER | 计划时长（分钟） | NOT NULL |
| `actual_start_time` | TIMESTAMP | 实际开始时间 | NULLABLE |
| `actual_end_time` | TIMESTAMP | 实际结束时间 | NULLABLE |
| `recordings` | JSONB | 录制数组 | DEFAULT '[]', GIN索引 |
| `ai_summary` | JSONB | AI总结对象 | NULLABLE |
| `mentor_total_duration_seconds` | INTEGER | 导师总在线时长 | NULLABLE |
| `student_total_duration_seconds` | INTEGER | 学生总在线时长 | NULLABLE |
| `effective_tutoring_duration_seconds` | INTEGER | 有效辅导时长 | NULLABLE |
| `mentor_join_count` | INTEGER | 导师进入次数 | DEFAULT 0 |
| `student_join_count` | INTEGER | 学生进入次数 | DEFAULT 0 |
| `session_name` | VARCHAR(255) | 约课名称 | NOT NULL |
| `notes` | TEXT | 备注 | NULLABLE |
| `status` | VARCHAR(20) | scheduled \| started \| completed \| cancelled | NOT NULL, DEFAULT 'scheduled', INDEX |
| `created_at` | TIMESTAMP | 创建时间 | NOT NULL, DEFAULT NOW() |
| `updated_at` | TIMESTAMP | 更新时间 | NOT NULL, DEFAULT NOW() |
| `deleted_at` | TIMESTAMP | 软删除时间 | NULLABLE |

**说明**:
- Session 表不存储 `meeting_id`，因为 `meeting_id` 只在会议开始后才能获取（飞书/Zoom返回）
- Session 表使用 `meeting_no`（飞书会议号）作为关键字段，用于webhook事件中关联session
- `meeting_id` 记录在 meeting_event 表中，由 Meeting Providers Module 管理
- Session Domain 通过事件订阅机制获取会议事件信息，根据 `meeting_no` 查询对应的 session
- 详细设计参见 `meeting_provider_module_design_v3.3.md` 和 `webhook_module_design_v3.3.md`

---

## 🎯 8. 核心业务流程概览

### 创建约课（BFF层编排）
```
检查导师日历（Calendar Module）
→ 调用MeetingProvider.createMeeting()创建会议室
→ 创建session记录并设置会议信息（SessionService.createSession()，包含meeting_no、meeting_url）
→ 占用导师日历 → 生成定时通知 → 发送邮件通知
```

### 会议开始（事件驱动）
```
Webhook Module:
  接收webhook → 验证签名 → 提取通用字段(meeting_no, event_type...)
  → 调用MeetingEventService存储meeting_event
  → 发布MeetingEventCreated事件

Session Domain（SessionEventSubscriber订阅者）:
  监听MeetingEventCreated → 根据meeting_no查询session表
  → 找到session → 更新actual_start_time, status='started'
```

### 会议结束（事件驱动）
```
Webhook Module:
  接收webhook → 验证签名 → 提取通用字段
  → 调用MeetingEventService存储meeting_event → 发布MeetingEventCreated事件

Session Domain（SessionEventSubscriber订阅者）:
  监听MeetingEventCreated → 根据meeting_no查询session
  → 更新actual_end_time, status='completed'
  → 调用SessionDurationCalculator计算时长统计
```

### 录制就绪（事件驱动）
```
Webhook Module:
  接收webhook → 验证签名 → 提取通用字段
  → 调用MeetingEventService存储meeting_event → 发布MeetingEventCreated事件

Session Domain（SessionEventSubscriber订阅者）:
  监听MeetingEventCreated → 根据meeting_no查询session
  → 追加录制到recordings数组 → 启动transcript轮询任务
```

---

## 📌 9. 设计原则

| 原则 | 体现 |
|-----|------|
| BFF层编排 | 流程控制在BFF层，Domain层提供原子操作 |
| 职责分离 | SessionService只负责session记录CRUD，不跨域调用 |
| 事件驱动 | 通过订阅MeetingEventCreated事件处理会议相关业务 |
| 事件溯源 | 时长统计从session_events表查询计算 |
| DTO明确定义 | 所有输入输出参数类型明确，支持类型检查 |
| 类型安全 | 返回SessionEntity等明确类型，避免Plain Object |

---

**文档结束 | 版本 v3.3 | 阅读时间 ~5分钟**
