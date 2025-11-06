# Session Domain 详细设计文档

**文档版本**: v3.2
**更新日期**: 2025-11-05
**作者**: Architecture Team
**说明**: 基于v3.1版本优化，统一主键为`id`，补充contract_id修改功能，ai_summary改为JSONB类型

---

## 📦 1. 模块总览

| 模块名称                | 位置路径                          | 核心职责                      | 架构定位  | 依赖关系                                  |
|---------------------|-------------------------------|---------------------------|-------|---------------------------------------|
| Session Domain      | src/domains/services/session/ | Session记录CRUD、生命周期管理、录制管理 | 核心业务域 | 依赖: Calendar, MeetingProviders, Notification |
| Calendar Module     | src/core/calendar/            | 时间段占用管理、冲突检测              | 基础设施层 | 被依赖: Session Domain                    |
| Meeting Providers   | src/core/meeting-providers/   | 飞书/Zoom会议集成、工厂模式          | 基础设施层 | 被依赖: Session Domain                    |
| Webhook Module      | src/core/webhook/             | 接收飞书/Zoom事件、签名验证、事件分发     | 基础设施层 | 调用: Session Domain                      |
| Notification Module | src/core/notification/        | 邮件发送服务、定时通知队列             | 基础设施层 | 被依赖: Session Domain, BFF Layer         |
| Feishu Auth         | src/core/auth/feishu/         | 飞书扫码登录、OAuth 2.0授权        | 基础设施层 | 独立模块                                  |
| Feishu Bot          | src/core/feishu/bot/          | 飞书卡片消息发送、Bot管理            | 基础设施层 | 被依赖: Notification Module               |
| Email Service       | src/core/email/               | 邮件发送、模板管理                 | 基础设施层 | 被依赖: Notification Module               |
| BFF Layer           | src/operations/*/             | 流程编排、聚合调用、DTO转换           | 业务编排层 | 调用: 所有Domain和Infrastructure模块         |

---

## 🏗️ 2. 架构设计原则

### 2.1 核心设计变更

| 层级                         | 职责                    | 示例                                              | 特点               |
|----------------------------|-----------------------|-------------------------------------------------|------------------|
| BFF层（Business Flow Facade） | 流程编排、聚合调用、事务控制        | SessionController.createSession() 依次调用多个Service | 控制业务流程，不包含业务逻辑 |
| Domain层                    | 提供原子操作，返回Plain Object | SessionService.createSession() 仅创建记录            | 单一职责，可独立测试     |
| Infrastructure层            | 提供基础能力服务              | CalendarService.isSlotAvailable()               | 技术性服务，可被多个Domain复用 |

### 2.2 设计优势

| 优势   | 说明                                 |
|------|------------------------------------|
| 职责清晰 | 每个Domain Service只负责自己的核心业务，不涉及跨域调用 |
| 易于测试 | 可以单独mock每个Service，测试粒度更细           |
| 易于理解 | 流程在BFF层一目了然，不需要追踪事件链路              |
| 性能更好 | 减少事件发布/订阅的开销，同步调用更直接               |
| 易于扩展 | 新增业务流程只需在BFF层编排，不影响Domain层         |

---

## 📂 3. Session Domain 模块

**位置**: `src/domains/services/session/`

### 3.1 目录结构

```
session/
├── services/
│   ├── session.service.ts                # Session CRUD原子操作
│   ├── session-lifecycle.service.ts      # Webhook事件处理
│   ├── session-duration-calculator.ts    # 时长计算服务
│   └── session-query.service.ts          # 查询服务
├── recording/
│   ├── session-recording-manager.ts      # 录制管理
│   ├── transcript-polling.service.ts     # 文字记录轮询
│   └── ai-summary.service.ts             # AI总结生成
├── repositories/
│   ├── session.repository.ts             # Session数据访问
│   └── session-event.repository.ts       # SessionEvent数据访问
├── dto/
│   ├── create-session.dto.ts             # 创建Session DTO
│   ├── update-session.dto.ts             # 更新Session DTO
│   ├── meeting-info.dto.ts               # 会议信息DTO
│   └── session-response.dto.ts           # Session响应DTO
└── interfaces/
    ├── session.interface.ts              # Session接口定义
    └── session-event.interface.ts        # SessionEvent接口定义
```

---

### 3.2 SessionService（原子操作）

**文件路径**: `src/domains/services/session/services/session.service.ts`

#### 3.2.1 方法列表

| 方法                          | 参数                          | 返回值            | 功能说明                            | 调用者  |
|-----------------------------|-----------------------------|--------------|---------------------------------|------|
| createSession(dto)          | CreateSessionDto            | SessionEntity | 仅创建session记录，不涉及会议创建、日历占用       | BFF层 |
| updateSession(id, dto)      | sessionId, UpdateSessionDto | SessionEntity | 更新session字段（不包含会议同步）            | BFF层 |
| updateMeetingInfo(id, info) | sessionId, MeetingInfoDto   | SessionEntity | 更新会议信息（meeting_id、meeting_url等） | BFF层 |
| cancelSession(id, reason)   | sessionId, cancelReason     | SessionEntity | 更新状态为cancelled，记录取消原因           | BFF层 |
| softDeleteSession(id)       | sessionId                   | SessionEntity | 软删除（设置deleted_at）               | BFF层 |
| getSessionById(id)          | sessionId                   | SessionEntity | 查询单个session详情                   | BFF层 |
| getSessionByMeetingId(id)   | meetingId                   | SessionEntity | 根据meeting_id查询session（Webhook用） | Webhook Module |

---

### 3.3 DTO定义

#### 3.3.1 CreateSessionDto

**文件路径**: `src/domains/services/session/dto/create-session.dto.ts`

| 字段名                  | 类型        | 必填  | 说明              | 示例值                     | 验证规则                  |
|----------------------|-----------|-----|-----------------|-------------------------|----------------------|
| student_id           | UUID      | 是   | 学生用户ID          | "uuid-xxx"              | 必须存在于user表           |
| mentor_id            | UUID      | 是   | 导师用户ID          | "uuid-yyy"              | 必须存在于user表，角色为mentor |
| scheduled_start_time | DateTime  | 是   | 计划开始时间          | "2025-11-10T14:00:00Z"  | 必须晚于当前时间             |
| scheduled_duration   | Integer   | 是   | 计划时长（分钟）        | 60                      | 30 <= duration <= 180  |
| session_name         | String    | 否   | 约课名称            | "系统设计面试辅导"              | 最大长度255              |
| notes                | String    | 否   | 备注信息            | "学生想重点讨论分布式锁"           | 最大长度2000             |
| meeting_provider     | Enum      | 否   | 会议平台            | "feishu"                | 'feishu' \| 'zoom'     |
| contract_id          | UUID      | 否   | 关联合同ID（用于后续扣费） | "uuid-zzz"              | 必须存在于contract表       |
| service_type         | String    | 否   | 服务类型标识          | "one-on-one-session"    | -                      |

**说明**：
- `meeting_provider` 默认值从系统配置读取（DEFAULT_MEETING_PROVIDER）
- `session_name` 如果为空，自动生成格式为："与{导师名称}的辅导课程"
- 该DTO只负责创建数据库记录，会议信息（meeting_id, meeting_url）后续通过 `updateMeetingInfo` 更新

---

#### 3.3.2 UpdateSessionDto

**文件路径**: `src/domains/services/session/dto/update-session.dto.ts`

| 字段名                  | 类型       | 必填  | 说明              | 示例值        | 验证规则                 |
|----------------------|----------|-----|-----------------|------------|----------------------|
| scheduled_start_time | DateTime | 否   | 修改开始时间          | "..."      | 必须晚于当前时间           |
| scheduled_duration   | Integer  | 否   | 修改计划时长          | 90         | 30 <= duration <= 180 |
| session_name         | String   | 否   | 修改约课名称          | "..."      | 最大长度255            |
| notes                | String   | 否   | 修改备注            | "..."      | 最大长度2000           |
| contract_id          | UUID     | 否   | 修改关联合同ID（选错产品时） | "uuid-zzz" | 必须存在于contract表     |
| status               | Enum     | 否   | 修改状态            | "cancelled" | 仅限特定状态转换           |

**说明**：
- 该DTO用于业务字段更新，不包含会议系统相关字段
- 状态转换限制：scheduled -> started -> completed，或 scheduled -> cancelled
- `contract_id` 允许修改，用于处理"学生选错产品"的场景

---

#### 3.3.3 MeetingInfoDto

**文件路径**: `src/domains/services/session/dto/meeting-info.dto.ts`

| 字段名              | 类型     | 必填  | 说明          | 示例值                              |
|------------------|--------|-----|-------------|----------------------------------|
| meeting_provider | Enum   | 是   | 会议平台        | "feishu"                         |
| meeting_id       | String | 是   | 第三方会议ID     | "6892847362938471942"            |
| meeting_no       | String | 否   | 飞书会议号（9位数字） | "123456789"                      |
| meeting_url      | String | 是   | 会议链接        | "https://vc.feishu.cn/j/123456789" |
| meeting_password | String | 否   | 会议密码        | "abc123"                         |

**说明**：
- 该DTO由BFF层调用 `MeetingProvider.createMeeting()` 后获取
- `meeting_no` 仅飞书会议有效，Zoom使用meeting_id

---

#### 3.3.4 SessionEntity 返回值结构

**文件路径**: `src/domains/services/session/interfaces/session.interface.ts`

| 字段名                                 | 类型          | 说明                                | 示例值                              |
|-------------------------------------|-------------|-----------------------------------|----------------------------------|
| id                                  | UUID        | 主键                                | "uuid-xxx"                       |
| student_id                          | UUID        | 学生ID                              | "uuid-yyy"                       |
| mentor_id                           | UUID        | 导师ID                              | "uuid-zzz"                       |
| contract_id                         | UUID\|null  | 关联合同ID                            | "uuid-contract-123"              |
| meeting_provider                    | String      | 会议平台                              | "feishu"                         |
| meeting_id                          | String      | 第三方会议ID                           | "6892847362938471942"            |
| meeting_no                          | String\|null | 飞书会议号                             | "123456789"                      |
| meeting_url                         | String\|null | 会议链接                              | "https://vc.feishu.cn/j/123456789" |
| meeting_password                    | String\|null | 会议密码                              | "abc123"                         |
| scheduled_start_time                | DateTime    | 计划开始时间                            | "2025-11-10T14:00:00Z"           |
| scheduled_duration                  | Integer     | 计划时长（分钟）                          | 60                               |
| actual_start_time                   | DateTime\|null | 实际开始时间（Webhook更新）                 | "2025-11-10T14:02:15Z"           |
| actual_end_time                     | DateTime\|null | 实际结束时间（Webhook更新）                 | "2025-11-10T15:10:30Z"           |
| recordings                          | Recording[] | 录制数组（支持多段）                        | `[{recording_id, url, ...}, ...]` |
| ai_summary                          | JSONB\|null | AI总结对象（结构化数据）                     | `{ summary: "...", topics: [...], ... }` |
| mentor_total_duration_seconds       | Integer\|null | 导师总在线时长（秒）                        | 3600                             |
| student_total_duration_seconds      | Integer\|null | 学生总在线时长（秒）                        | 3500                             |
| effective_tutoring_duration_seconds | Integer\|null | 有效辅导时长（秒，导师和学生同时在线）               | 3400                             |
| mentor_join_count                   | Integer     | 导师进入次数                            | 2                                |
| student_join_count                  | Integer     | 学生进入次数                            | 1                                |
| session_name                        | String      | 约课名称                              | "系统设计面试辅导"                       |
| notes                               | String\|null | 备注                                | "..."                            |
| status                              | Enum        | 状态                                | "scheduled"                      |
| created_at                          | DateTime    | 创建时间                              | "2025-11-05T10:00:00Z"           |
| updated_at                          | DateTime    | 更新时间                              | "2025-11-05T10:00:00Z"           |
| deleted_at                          | DateTime\|null | 软删除时间                             | null                             |

**Recording 子对象结构**：

| 字段名            | 类型          | 说明           | 示例值                              |
|----------------|-------------|--------------|----------------------------------|
| recording_id   | String      | 录制文件ID       | "rec_xxx"                        |
| recording_url  | String      | 录制文件URL      | "https://feishu.cn/minutes/rec_xxx" |
| transcript_url | String\|null | 文字记录URL（保留待确认） | "https://feishu.cn/transcript/xxx" |
| duration       | Integer     | 录制时长（秒）      | 3600                             |
| sequence       | Integer     | 录制顺序（支持多段录制） | 1                                |
| started_at     | DateTime    | 录制开始时间       | "2025-11-10T14:00:00Z"           |
| ended_at       | DateTime    | 录制结束时间       | "2025-11-10T15:00:00Z"           |

**ai_summary JSONB结构示例**：

```json
{
  "summary": "本次辅导主要讨论了系统设计中的分布式锁实现方案...",
  "topics": ["分布式锁", "Redis", "Redlock算法"],
  "key_points": [
    "介绍了基于Redis的分布式锁实现",
    "讨论了Redlock算法的优缺点",
    "分析了实际项目中的应用场景"
  ],
  "suggestions": [
    "建议学生深入学习Redis持久化机制",
    "推荐阅读《Redis设计与实现》相关章节"
  ],
  "duration_analysis": {
    "effective_minutes": 56,
    "topic_breakdown": {
      "分布式锁": 30,
      "Redis": 15,
      "Redlock算法": 11
    }
  }
}
```

---

### 3.4 SessionLifecycleService（Webhook事件处理）

**文件路径**: `src/domains/services/session/services/session-lifecycle.service.ts`

#### 3.4.1 方法列表

| 方法                                     | 参数            | 返回值  | 功能说明                             | 触发时机                            |
|----------------------------------------|---------------|------|----------------------------------|---------------------------------|
| handleMeetingStarted(event)            | WebhookEvent  | void | 更新actual_start_time，更新状态为started | 飞书Webhook: meeting_started_v1   |
| handleMeetingEnded(event)              | WebhookEvent  | void | 更新actual_end_time，计算时长统计         | 飞书Webhook: meeting_ended_v1     |
| handleRecordingReady(event)            | WebhookEvent  | void | 追加录制记录，启动transcript轮询            | 飞书Webhook: recording_ready_v1   |
| handleRecordingStarted(event)          | WebhookEvent  | void | 记录录制开始时间                         | 飞书Webhook: recording_started_v1 |
| handleRecordingEnded(event)            | WebhookEvent  | void | 记录录制结束时间                         | 飞书Webhook: recording_ended_v1   |
| handleParticipantJoined(event)         | WebhookEvent  | void | 记录参会者加入事件                        | 飞书Webhook: join_meeting_v1      |
| handleParticipantLeft(event)           | WebhookEvent  | void | 记录参会者离开事件                        | 飞书Webhook: leave_meeting_v1     |
| handleShareStarted(event)              | WebhookEvent  | void | 记录屏幕共享开始                         | 飞书Webhook: share_started_v1     |
| handleShareEnded(event)                | WebhookEvent  | void | 记录屏幕共享结束                         | 飞书Webhook: share_ended_v1       |
| handleAllTranscriptsFetched(sessionId) | UUID          | void | 合并所有transcript，生成AI总结            | 轮询任务完成                          |

---

### 3.5 SessionRecordingManager（录制管理）

**文件路径**: `src/domains/services/session/recording/session-recording-manager.ts`

#### 3.5.1 方法列表

| 方法                                                               | 参数                                | 返回值         | 功能说明                    |
|------------------------------------------------------------------|-----------------------------------|-------------|-------------------------|
| appendRecording(sessionId, data)                                 | sessionId: UUID, data: RecordingData | void        | 追加新录制到recordings数组      |
| updateRecordingTranscript(sessionId, recordingId, transcriptUrl) | sessionId: UUID, recordingId: String, url: String | void        | 更新指定录制的transcript_url   |
| isAllTranscriptsFetched(sessionId)                               | sessionId: UUID                   | boolean     | 检查是否所有录制的transcript都已获取 |
| getAllRecordings(sessionId)                                      | sessionId: UUID                   | Recording[] | 获取session的所有录制          |
| getRecordingBySequence(sessionId, sequence)                      | sessionId: UUID, sequence: Integer | Recording   | 根据sequence获取指定录制        |

---

### 3.6 SessionDurationCalculator（时长计算）

**文件路径**: `src/domains/services/session/services/session-duration-calculator.ts`

#### 3.6.1 方法列表

| 方法                            | 参数              | 返回值           | 功能说明                             |
|-------------------------------|-----------------|---------------|----------------------------------|
| calculateDurations(sessionId) | sessionId: UUID | DurationStats | 从session_event溯源计算导师/学生时长、有效辅导时长 |

#### 3.6.2 DurationStats 返回值结构

| 字段名                                 | 类型      | 说明                      | 计算逻辑                                      |
|-------------------------------------|---------|-------------------------|-------------------------------------------|
| mentor_total_duration_seconds       | Integer | 导师总在线时长（秒）              | 所有导师join到leave的时间段总和                      |
| student_total_duration_seconds      | Integer | 学生总在线时长（秒）              | 所有学生join到leave的时间段总和                      |
| effective_tutoring_duration_seconds | Integer | 有效辅导时长（秒，导师和学生同时在线）     | 导师和学生在线时间段的交集总和                           |
| mentor_join_count                   | Integer | 导师进入次数                  | 统计导师触发join_meeting事件的次数                   |
| student_join_count                  | Integer | 学生进入次数                  | 统计学生触发join_meeting事件的次数                   |
| overlap_intervals                   | Array   | 导师和学生同时在线的时间段列表（用于调试）   | `[{ start: DateTime, end: DateTime }, ...]` |

---

### 3.7 SessionQueryService（查询服务）

**文件路径**: `src/domains/services/session/services/session-query.service.ts`

#### 3.7.1 方法列表

| 方法                                          | 参数                                 | 返回值              | 功能说明        |
|---------------------------------------------|------------------------------------|--------------------|-------------|
| findByStudentId(studentId, filters, pagination) | studentId: UUID, filters: QueryFilters, pagination: PaginationDto | PaginatedResult<SessionEntity> | 查询学生的约课列表   |
| findByMentorId(mentorId, filters, pagination)  | mentorId: UUID, filters: QueryFilters, pagination: PaginationDto  | PaginatedResult<SessionEntity> | 查询导师的约课列表   |
| findUpcomingSessions(userId, role, limit)      | userId: UUID, role: Enum, limit: Integer | SessionEntity[]    | 查询即将到来的约课   |
| getSessionStatistics(userId, role, dateRange)  | userId: UUID, role: Enum, dateRange: DateRangeDto | SessionStats       | 获取约课统计数据    |

#### 3.7.2 QueryFilters 定义

**文件路径**: `src/domains/services/session/dto/query-filters.dto.ts`

| 字段名         | 类型       | 必填  | 说明          | 可选值                                        |
|-------------|----------|-----|-------------|---------------------------------------------|
| status      | String[] | 否   | 状态筛选        | ['scheduled', 'started', 'completed', 'cancelled'] |
| date_from   | DateTime | 否   | 开始日期        | "2025-11-01T00:00:00Z"                      |
| date_to     | DateTime | 否   | 结束日期        | "2025-11-30T23:59:59Z"                      |
| has_recording | Boolean  | 否   | 是否有录制       | true/false                                  |
| has_transcript | Boolean  | 否   | 是否有文字记录URL  | true/false                                  |
| keyword     | String   | 否   | 关键词搜索（约课名称） | "系统设计"                                      |

#### 3.7.3 PaginationDto 定义

| 字段名   | 类型      | 必填  | 默认值  | 说明     | 验证规则        |
|-------|---------|-----|------|--------|-------------|
| page  | Integer | 否   | 1    | 页码     | >= 1        |
| limit | Integer | 否   | 20   | 每页数量   | 1 <= limit <= 100 |
| sort  | String  | 否   | "-scheduled_start_time" | 排序字段   | 支持: scheduled_start_time, created_at |
| order | Enum    | 否   | "desc" | 排序方向   | "asc" \| "desc" |

#### 3.7.4 PaginatedResult 返回值结构

| 字段名        | 类型              | 说明     |
|------------|-----------------|--------|
| data       | SessionEntity[] | 数据列表   |
| total      | Integer         | 总记录数   |
| page       | Integer         | 当前页码   |
| limit      | Integer         | 每页数量   |
| totalPages | Integer         | 总页数    |
| hasNext    | Boolean         | 是否有下一页 |
| hasPrev    | Boolean         | 是否有上一页 |

#### 3.7.5 SessionStats 返回值结构

| 字段名                     | 类型      | 说明        |
|-------------------------|---------|-----------|
| total_sessions          | Integer | 总约课数      |
| completed_sessions      | Integer | 已完成约课数    |
| cancelled_sessions      | Integer | 已取消约课数    |
| total_duration_hours    | Float   | 总辅导时长（小时） |
| average_duration_minutes | Float   | 平均约课时长（分钟） |
| completion_rate         | Float   | 完成率（百分比）  |

---

## 🗓️ 4. Calendar Module

**位置**: `src/core/calendar/`

### 4.1 目录结构

```
calendar/
├── services/
│   └── calendar.service.ts              # 时间段管理核心服务
├── repositories/
│   └── calendar-slot.repository.ts      # 数据访问层
├── dto/
│   ├── create-slot.dto.ts               # 创建时间段DTO
│   └── query-slot.dto.ts                # 查询时间段DTO
└── interfaces/
    └── calendar-slot.interface.ts       # CalendarSlot接口定义
```

### 4.2 CalendarService（原子操作）

**文件路径**: `src/core/calendar/services/calendar.service.ts`

#### 4.2.1 方法列表

| 方法                       | 参数                                            | 返回值            | 功能说明                     | 调用者  |
|--------------------------|-----------------------------------------------|----------------|--------------------------|------|
| isSlotAvailable(...)     | resourceType, resourceId, startTime, duration | boolean        | 查询时间段是否可用                | BFF层 |
| getSlotOccupancy(...)    | resourceType, resourceId, startTime, duration | CalendarSlot\|null | 获取占用详情（如果被占用）            | BFF层 |
| createOccupiedSlot(data) | CreateSlotDto                                 | CalendarSlotEntity | 创建占用记录                   | BFF层 |
| releaseSlot(slotId)      | slotId: UUID                                  | void           | 释放占用（更新status为cancelled） | BFF层 |
| getOccupiedSlots(...)    | resourceType, resourceId, dateRange           | CalendarSlotEntity[] | 批量查询占用时段                 | BFF层 |
| blockTimeSlot(...)       | resourceType, resourceId, timeRange, reason   | CalendarSlotEntity | 导师主动设置不可用时间              | BFF层 |
| rescheduleSlot(...)      | oldSlotId, newStartTime, newDuration          | CalendarSlotEntity | 改期（释放旧+占用新）              | BFF层 |
| getSlotBySessionId(...)  | sessionId: UUID                               | CalendarSlotEntity\|null | 根据session_id查询时间段        | BFF层 |

#### 4.2.2 CreateSlotDto 定义

**文件路径**: `src/core/calendar/dto/create-slot.dto.ts`

| 字段名              | 类型       | 必填  | 说明                            | 示例值                    | 验证规则                |
|------------------|----------|-----|-------------------------------|------------------------|---------------------|
| resource_type    | Enum     | 是   | 资源类型                          | "mentor"               | 'mentor' \| 'student' \| 'room' |
| resource_id      | UUID     | 是   | 资源ID                          | "uuid-mentor-123"      | 必须存在对应的资源         |
| start_time       | DateTime | 是   | 开始时间                          | "2025-11-10T14:00:00Z" | 必须晚于当前时间          |
| duration_minutes | Integer  | 是   | 时长（分钟）                        | 60                     | 30 <= duration <= 180 |
| session_id       | UUID     | 否   | 关联的session_id（如果是约课占用）        | "uuid-session-123"     | -                   |
| slot_type        | Enum     | 是   | 时间段类型                         | "session"              | 'session' \| 'blocked' |
| reason           | String   | 否   | 占用/封锁原因（blocked类型时建议填写）       | "导师休假"                 | 最大长度255           |

#### 4.2.3 CalendarSlotEntity 返回值结构

**文件路径**: `src/core/calendar/interfaces/calendar-slot.interface.ts`

| 字段名              | 类型          | 说明                            | 示例值                                              |
|------------------|-------------|-------------------------------|--------------------------------------------------|
| id               | UUID        | 主键                            | "uuid-slot-123"                                  |
| resource_type    | String      | 资源类型                          | "mentor"                                         |
| resource_id      | UUID        | 资源ID                          | "uuid-mentor-123"                                |
| time_range       | PostgreSQL TSTZRANGE | PostgreSQL时间范围类型              | `[2025-11-10 14:00:00+00, 2025-11-10 15:00:00+00)` |
| start_time       | DateTime    | 开始时间（从time_range解析）          | "2025-11-10T14:00:00Z"                           |
| end_time         | DateTime    | 结束时间（从time_range解析）          | "2025-11-10T15:00:00Z"                           |
| duration_minutes | Integer     | 时长（分钟）                        | 60                                               |
| session_id       | UUID\|null  | 关联的session_id                 | "uuid-session-123"                               |
| slot_type        | String      | 时间段类型                         | "session"                                        |
| status           | String      | 状态                            | "occupied"                                       |
| reason           | String\|null | 占用/封锁原因                       | "导师休假"                                           |
| created_at       | DateTime    | 创建时间                          | "2025-11-05T10:00:00Z"                           |
| updated_at       | DateTime    | 更新时间                          | "2025-11-05T10:00:00Z"                           |

---

## 🎥 5. Meeting Providers Module

**位置**: `src/core/meeting-providers/`

### 5.1 目录结构

```
meeting-providers/
├── interfaces/
│   └── meeting-provider.interface.ts     # IMeetingProvider接口
├── factory/
│   └── meeting-provider.factory.ts       # 工厂类
├── feishu/
│   ├── feishu-meeting.adapter.ts         # 飞书适配器
│   └── feishu-meeting.client.ts          # 飞书API客户端
├── zoom/
│   ├── zoom-meeting.adapter.ts           # Zoom适配器
│   └── zoom-meeting.client.ts            # Zoom API客户端
└── dto/
    ├── create-meeting.dto.ts             # 创建会议DTO
    └── meeting-info.dto.ts               # 会议信息DTO
```

### 5.2 IMeetingProvider（接口定义）

**文件路径**: `src/core/meeting-providers/interfaces/meeting-provider.interface.ts`

#### 5.2.1 方法列表

| 方法                              | 参数                            | 返回值         | 功能说明                           |
|---------------------------------|-------------------------------|-------------|--------------------------------|
| createMeeting(input)            | CreateMeetingInput            | MeetingInfo | 创建会议，返回meeting_id、meeting_url等 |
| updateMeeting(meetingId, input) | meetingId: String, input: UpdateMeetingInput | boolean     | 更新会议时间或设置                      |
| cancelMeeting(meetingId)        | meetingId: String             | boolean     | 取消会议                           |
| getMeetingInfo(meetingId)       | meetingId: String             | MeetingInfo | 获取会议详情                         |

#### 5.2.2 CreateMeetingInput 定义

**文件路径**: `src/core/meeting-providers/dto/create-meeting.dto.ts`

| 字段名                  | 类型       | 必填  | 说明               | 示例值                    | 飞书字段映射         | Zoom字段映射    |
|----------------------|----------|-----|------------------|------------------------|----------------|------------|
| topic                | String   | 是   | 会议主题             | "系统设计面试辅导"             | topic          | topic      |
| start_time           | DateTime | 是   | 开始时间             | "2025-11-10T14:00:00Z" | start_time     | start_time |
| duration             | Integer  | 是   | 时长（分钟）           | 60                     | end_time（计算得出） | duration   |
| host_user_id         | String   | 否   | 主持人的平台用户ID（如飞书ID） | "ou_xxx"               | owner_id       | host_id    |
| auto_record          | Boolean  | 否   | 是否自动录制           | true                   | auto_record_type | auto_recording |
| enable_waiting_room  | Boolean  | 否   | 是否启用等候室          | false                  | （不支持）          | waiting_room |
| participant_join_early | Boolean  | 否   | 参会者是否可提前进入       | true                   | allow_attendees_start | join_before_host |

#### 5.2.3 MeetingInfo 返回值结构

**文件路径**: `src/core/meeting-providers/dto/meeting-info.dto.ts`

| 字段名              | 类型          | 说明                  | 飞书示例                              | Zoom示例                  |
|------------------|-------------|--------------------|-----------------------------------|-------------------------|
| provider         | String      | 会议平台                | "feishu"                          | "zoom"                  |
| meeting_id       | String      | 第三方会议ID             | "6892847362938471942"             | "123456789"             |
| meeting_no       | String\|null | 会议号（飞书9位数字，Zoom为空） | "123456789"                       | null                    |
| meeting_url      | String      | 会议链接                | "https://vc.feishu.cn/j/123456789" | "https://zoom.us/j/..." |
| meeting_password | String\|null | 会议密码                | null（飞书无密码）                       | "abc123"                |
| host_join_url    | String\|null | 主持人专用链接（部分平台支持）    | null                              | "https://zoom.us/s/..." |
| start_time       | DateTime    | 开始时间                | "2025-11-10T14:00:00Z"            | "2025-11-10T14:00:00Z"  |
| duration         | Integer     | 时长（分钟）              | 60                                | 60                      |

### 5.3 MeetingProviderFactory（工厂类）

**文件路径**: `src/core/meeting-providers/factory/meeting-provider.factory.ts`

#### 5.3.1 方法列表

| 方法                        | 参数                | 返回值              | 功能说明         |
|---------------------------|-------------------|------------------|--------------|
| getProvider(providerType) | providerType: Enum | IMeetingProvider | 根据类型返回对应实例   |
| getDefaultProvider()      | -                 | IMeetingProvider | 返回默认Provider |

---

## 🌐 6. Webhook Module

**位置**: `src/core/webhook/`

### 6.1 目录结构

```
webhook/
├── controllers/
│   └── webhook-gateway.controller.ts     # HTTP入口
├── services/
│   └── webhook-verification.service.ts   # 签名验证
├── handlers/
│   ├── feishu-webhook.handler.ts         # 飞书事件处理
│   ├── zoom-webhook.handler.ts           # Zoom事件处理
│   └── webhook-handler.registry.ts       # Handler注册表
├── interfaces/
│   └── webhook-handler.interface.ts      # IWebhookHandler接口
└── dto/
    └── webhook-event.dto.ts              # Webhook事件DTO
```

### 6.2 WebhookGatewayController

**文件路径**: `src/core/webhook/controllers/webhook-gateway.controller.ts`

#### 6.2.1 路由列表

| 方法                           | 路由                    | 请求体           | 功能说明                     |
|------------------------------|-----------------------|---------------|--------------------------|
| handleFeishuWebhook(request) | POST /webhooks/feishu | WebhookRequest | 接收飞书Webhook，验证签名，分发事件    |
| handleZoomWebhook(request)   | POST /webhooks/zoom   | WebhookRequest | 接收Zoom Webhook，验证签名，分发事件 |

### 6.3 FeishuWebhookHandler

**文件路径**: `src/core/webhook/handlers/feishu-webhook.handler.ts`

#### 6.3.1 支持的飞书事件类型

| 事件类型                          | 说明     | 处理逻辑                                   |
|-------------------------------|--------|----------------------------------------|
| vc.meeting.meeting_started_v1 | 会议开始   | 更新actual_start_time，status -> started |
| vc.meeting.meeting_ended_v1   | 会议结束   | 更新actual_end_time，计算时长统计               |
| vc.meeting.recording_ready_v1 | 录制就绪   | 追加录制记录，启动transcript轮询                 |
| vc.meeting.recording_started_v1 | 录制开始   | 记录录制开始时间                               |
| vc.meeting.recording_ended_v1 | 录制结束   | 记录录制结束时间                               |
| vc.meeting.join_meeting_v1    | 参会者加入  | 记录join事件（用于时长计算）                      |
| vc.meeting.leave_meeting_v1   | 参会者离开  | 记录leave事件（用于时长计算）                     |
| vc.meeting.share_started_v1   | 屏幕共享开始 | 记录屏幕共享事件                               |
| vc.meeting.share_ended_v1     | 屏幕共享结束 | 记录屏幕共享事件                               |

---

## 🔔 7. Notification Module

**位置**: `src/core/notification/`

### 7.1 目录结构

```
notification/
├── services/
│   └── notification.service.ts           # 邮件发送服务
├── queue/
│   ├── notification-queue.service.ts     # 定时通知队列
│   └── notification-scheduler.worker.ts  # Cron任务生成器
└── dto/
    ├── send-email.dto.ts                 # 发送邮件DTO
    └── queue-notification.dto.ts         # 入队通知DTO
```

### 7.2 NotificationService（原子操作）

**文件路径**: `src/core/notification/services/notification.service.ts`

#### 7.2.1 方法列表

| 方法                                     | 参数          | 返回值  | 功能说明       | 调用者    |
|----------------------------------------|-------------|------|------------|--------|
| sendEmail(params)                      | SendEmailDto | void | 发送邮件（同步调用） | BFF层   |
| sendSessionCreatedEmail(session)       | SessionEntity | void | 发送约课创建邮件   | BFF层   |
| sendSessionCancelledEmail(session)     | SessionEntity | void | 发送约课取消邮件   | BFF层   |
| sendSessionReminderEmail(session)      | SessionEntity | void | 发送约课提醒邮件   | Cron任务 |
| sendSessionCompletedEmail(session)     | SessionEntity | void | 发送约课完成邮件   | BFF层   |

#### 7.2.2 SendEmailDto 定义

**文件路径**: `src/core/notification/dto/send-email.dto.ts`

| 字段名        | 类型     | 必填  | 说明           | 示例值                        |
|------------|--------|-----|--------------|----------------------------|
| to         | String | 是   | 收件人邮箱        | "student@example.com"      |
| subject    | String | 是   | 邮件主题         | "您的约课已创建"                  |
| template   | String | 是   | 邮件模板名称       | "session-created"          |
| data       | Object | 是   | 模板变量数据       | `{ studentName: "张三", ... }` |
| cc         | String | 否   | 抄送邮箱         | "counselor@example.com"    |
| attachments | Array  | 否   | 附件列表         | `[{ filename: "...", path: "..." }]` |

### 7.3 NotificationQueueService

**文件路径**: `src/core/notification/queue/notification-queue.service.ts`

#### 7.3.1 方法列表

| 方法                                    | 参数                          | 返回值  | 功能说明               |
|---------------------------------------|-----------------------------|------|--------------------|
| enqueue(notification)                 | QueueNotificationDto        | void | 加入通知到队列            |
| processDueNotifications()             | -                           | void | 处理到期的通知（Cron每分钟执行） |
| cancelBySessionId(sessionId)          | sessionId: UUID             | void | 取消某session的所有待发通知  |
| updateBySessionId(sessionId, newTime) | sessionId: UUID, newTime: DateTime | void | 更新通知时间（改期时使用）      |

---

## 🤖 8. Feishu Bot Module

**位置**: `src/core/feishu/bot/`

### 8.1 FeishuBotService

**文件路径**: `src/core/feishu/bot/feishu-bot.service.ts`

#### 8.1.1 方法列表

| 方法                              | 参数           | 返回值  | 功能说明           | 调用者  |
|---------------------------------|--------------|------|----------------|------|
| sendCard(userId, cardContent)   | userId: String, card: CardDto | void | 发送卡片消息到指定用户    | BFF层 |
| sendTextMessage(userId, text)   | userId: String, text: String | void | 发送文本消息         | BFF层 |
| sendSessionSummaryCard(session) | SessionEntity | void | 发送约课总结卡片（业务封装） | BFF层 |

---

## 🔐 9. Feishu Auth Module

**位置**: `src/core/auth/feishu/`

### 9.1 FeishuAuthService

**文件路径**: `src/core/auth/feishu/feishu-auth.service.ts`

#### 9.1.1 方法列表

| 方法                                | 参数                   | 返回值    | 功能说明                           |
|-----------------------------------|----------------------|--------|--------------------------------|
| authorize()                       | -                    | string | 生成state、存储Redis、返回授权URL        |
| handleCallback(code, state)       | code: String, state: String | JWT    | 验证state、换取access_token、创建/绑定账号 |
| bindAccount(userId, feishuUserId) | userId: UUID, feishuUserId: String | void   | 绑定飞书账号到现有用户                    |
| unbindAccount(userId)             | userId: UUID         | void   | 解绑飞书账号                         |

---

## 📧 10. Email Service

**位置**: `src/core/email/`

### 10.1 EmailService

**文件路径**: `src/core/email/email.service.ts`

#### 10.1.1 方法列表

| 方法                                                            | 参数          | 返回值  | 功能说明     |
|---------------------------------------------------------------|-------------|------|----------|
| send(to, subject, template, data)                             | SendEmailParams | void | 发送邮件     |
| sendWithAttachments(to, subject, template, data, attachments) | SendEmailParams | void | 发送带附件的邮件 |

---

## 📊 11. 数据库表设计

### 11.1 session表

**表名**: `session`

| 字段名                                 | 类型           | 说明                                                  | 索引    | 约束       |
|-------------------------------------|--------------|-----------------------------------------------------|-------|----------|
| id                                  | UUID         | 主键                                                  | PK    | NOT NULL |
| student_id                          | UUID         | 学生ID                                                | INDEX | NOT NULL, FK(user.id) |
| mentor_id                           | UUID         | 导师ID                                                | INDEX | NOT NULL, FK(user.id) |
| contract_id                         | UUID         | 关联合同ID                                              | INDEX | NULLABLE, FK(contract.id) |
| meeting_provider                    | VARCHAR(20)  | 'feishu' \| 'zoom'                                   | -     | NOT NULL |
| meeting_id                          | VARCHAR(255) | 第三方会议ID                                             | INDEX | NULLABLE |
| meeting_no                          | VARCHAR(20)  | 飞书会议号（9位数字）                                         | INDEX | NULLABLE |
| meeting_url                         | TEXT         | 会议链接                                                | -     | NULLABLE |
| meeting_password                    | VARCHAR(50)  | 会议密码                                                | -     | NULLABLE |
| scheduled_start_time                | TIMESTAMP    | 计划开始时间                                              | INDEX | NOT NULL |
| scheduled_duration                  | INTEGER      | 计划时长（分钟）                                            | -     | NOT NULL |
| actual_start_time                   | TIMESTAMP    | 实际开始时间                                              | -     | NULLABLE |
| actual_end_time                     | TIMESTAMP    | 实际结束时间                                              | -     | NULLABLE |
| recordings                          | JSONB        | 录制数组（支持多段）                                          | GIN   | DEFAULT '[]' |
| ai_summary                          | JSONB        | AI总结对象（结构化数据）                                       | -     | NULLABLE |
| mentor_total_duration_seconds       | INTEGER      | 导师总在线时长                                             | -     | NULLABLE |
| student_total_duration_seconds      | INTEGER      | 学生总在线时长                                             | -     | NULLABLE |
| effective_tutoring_duration_seconds | INTEGER      | 有效辅导时长                                              | -     | NULLABLE |
| mentor_join_count                   | INTEGER      | 导师进入次数                                              | -     | DEFAULT 0 |
| student_join_count                  | INTEGER      | 学生进入次数                                              | -     | DEFAULT 0 |
| session_name                        | VARCHAR(255) | 约课名称                                                | -     | NOT NULL |
| notes                               | TEXT         | 备注                                                  | -     | NULLABLE |
| status                              | VARCHAR(20)  | 'scheduled' \| 'started' \| 'completed' \| 'cancelled' | INDEX | NOT NULL, DEFAULT 'scheduled' |
| created_at                          | TIMESTAMP    | 创建时间                                                | -     | NOT NULL, DEFAULT NOW() |
| updated_at                          | TIMESTAMP    | 更新时间                                                | -     | NOT NULL, DEFAULT NOW() |
| deleted_at                          | TIMESTAMP    | 软删除时间                                               | -     | NULLABLE |

**索引说明**：
- `idx_session_student`: (student_id, scheduled_start_time)
- `idx_session_mentor`: (mentor_id, scheduled_start_time)
- `idx_session_contract`: (contract_id)
- `idx_session_meeting`: (meeting_id)
- `idx_session_status`: (status)
- `idx_recordings_gin`: USING GIN (recordings) - 支持JSONB查询
- `idx_ai_summary_gin`: USING GIN (ai_summary) - 支持JSONB查询

---

### 11.2 session_event表

**表名**: `session_event`

| 字段名         | 类型           | 说明                       | 索引    | 约束       |
|-------------|--------------|--------------------------|-------|----------|
| id          | UUID         | 主键                       | PK    | NOT NULL |
| session_id  | UUID         | 关联session                | INDEX | NOT NULL, FK(session.id) |
| provider    | VARCHAR(20)  | 'feishu' \| 'zoom'        | -     | NOT NULL |
| event_type  | VARCHAR(100) | 事件类型（如：meeting_ended_v1） | INDEX | NOT NULL |
| event_data  | JSONB        | 事件数据                     | -     | NOT NULL |
| occurred_at | TIMESTAMP    | 事件发生时间                   | INDEX | NOT NULL |
| created_at  | TIMESTAMP    | 记录创建时间                   | -     | NOT NULL, DEFAULT NOW() |

**复合索引**：
- `idx_session_event_time`: (session_id, occurred_at) - 用于时长计算
- `idx_event_type`: (event_type) - 用于事件类型查询

---

### 11.3 calendar_slot表

**表名**: `calendar_slot`

| 字段名              | 类型          | 说明                            | 索引    | 约束       |
|------------------|-------------|-------------------------------|-------|----------|
| id               | UUID        | 主键                            | PK    | NOT NULL |
| resource_type    | VARCHAR(30) | 'mentor' \| 'student' \| 'room' | GIST  | NOT NULL |
| resource_id      | UUID        | 资源ID                          | GIST  | NOT NULL |
| time_range       | TSTZRANGE   | PostgreSQL时间范围类型              | GIST  | NOT NULL |
| duration_minutes | INTEGER     | 时长（分钟）                        | -     | NOT NULL |
| session_id       | UUID        | 关联session                     | INDEX | NULLABLE, FK(session.id) |
| slot_type        | VARCHAR(30) | 'session' \| 'blocked'         | -     | NOT NULL |
| status           | VARCHAR(20) | 'occupied' \| 'cancelled'      | -     | NOT NULL, DEFAULT 'occupied' |
| reason           | VARCHAR(255) | 占用/封锁原因                       | -     | NULLABLE |
| created_at       | TIMESTAMP   | 创建时间                          | -     | NOT NULL, DEFAULT NOW() |
| updated_at       | TIMESTAMP   | 更新时间                          | -     | NOT NULL, DEFAULT NOW() |

**EXCLUDE约束（防止时间冲突）**：
```sql
EXCLUDE USING GIST (
  resource_type WITH =,
  resource_id WITH =,
  time_range WITH &&
) WHERE (status = 'occupied');
```

**复合索引**：
- `idx_calendar_resource`: (resource_type, resource_id, status)
- `idx_calendar_session`: (session_id)

---

### 11.4 notification_queue表

**表名**: `notification_queue`

| 字段名             | 类型          | 说明                                          | 索引    | 约束       |
|-----------------|-------------|---------------------------------------------|-------|----------|
| id              | UUID        | 主键                                          | PK    | NOT NULL |
| session_id      | UUID        | 关联session                                   | INDEX | NOT NULL, FK(session.id) |
| recipient_type  | VARCHAR(20) | 'mentor' \| 'student' \| 'counselor'          | -     | NOT NULL |
| recipient_id    | UUID        | 接收者ID                                       | -     | NOT NULL |
| notification_type | VARCHAR(50) | 通知类型                                        | -     | NOT NULL |
| scheduled_at    | TIMESTAMP   | 计划发送时间                                      | INDEX | NOT NULL |
| status          | VARCHAR(20) | 'pending' \| 'sent' \| 'failed' \| 'cancelled' | INDEX | NOT NULL, DEFAULT 'pending' |
| data            | JSONB       | 通知数据                                        | -     | NOT NULL |
| sent_at         | TIMESTAMP   | 实际发送时间                                      | -     | NULLABLE |
| error_message   | TEXT        | 失败原因                                        | -     | NULLABLE |
| created_at      | TIMESTAMP   | 创建时间                                        | -     | NOT NULL, DEFAULT NOW() |

**复合索引**：
- `idx_notification_due`: (status, scheduled_at) - 用于查询待发送通知
- `idx_notification_session`: (session_id)

---

## 🔄 12. 约课业务流程（精简版）

### 12.1 创建约课流程

```
前端请求
  ↓
┌─────────────────────────────────────────────────────────┐
│ BFF层: SessionController.createSession(dto)             │
└─────────────────────────────────────────────────────────┘
  ↓
  │ Step 1: 检查导师日历冲突
  │ CalendarService.isSlotAvailable(...)
  │ 返回: boolean (true=可用, false=冲突)
  ↓
  │ Step 2: 创建session记录
  │ SessionService.createSession(CreateSessionDto)
  │ 返回: SessionEntity (status='scheduled', meeting_id=null)
  ↓
  │ Step 3: 创建会议室
  │ provider = MeetingProviderFactory.getProvider(dto.meeting_provider)
  │ meetingInfo = provider.createMeeting(...)
  │ 返回: MeetingInfo { meeting_id, meeting_url, ... }
  ↓
  │ Step 4: 更新session的会议信息
  │ SessionService.updateMeetingInfo(sessionId, MeetingInfoDto)
  │ 返回: SessionEntity (meeting_id已填充)
  ↓
  │ Step 5: 占用导师日历
  │ CalendarService.createOccupiedSlot(CreateSlotDto)
  │ 返回: CalendarSlotEntity
  ↓
  │ Step 6: 生成定时通知（入队）
  │ 计算通知时间: 3天前、3小时前、1小时前
  │ NotificationQueueService.enqueue([...])
  ↓
  │ Step 7: 发送邮件通知（立即发送）
  │ NotificationService.sendSessionCreatedEmail(SessionEntity)
  ↓
返回前端: { sessionId, meetingUrl, status, ... }
```

---

### 12.2 会议开始流程（Webhook触发）

```
飞书服务器
  ↓
POST /webhooks/feishu
Body: { event_type: "vc.meeting.meeting_started_v1", ... }
  ↓
┌─────────────────────────────────────────────────────────┐
│ Webhook Module: WebhookGatewayController                │
└─────────────────────────────────────────────────────────┘
  ↓
  │ Step 1: 验证签名
  │ WebhookVerificationService.verifyFeishuSignature(request)
  │ 返回: boolean (true=合法)
  ↓
  │ Step 2: 查找对应的session
  │ SessionService.getSessionByMeetingId(meeting.id)
  │ 返回: SessionEntity
  ↓
  │ Step 3: 保存事件到session_event表
  │ SessionEventRepository.create({...})
  ↓
  │ Step 4: 分发到Handler
  │ FeishuWebhookHandler.handle(WebhookEventDto)
  ↓
┌─────────────────────────────────────────────────────────┐
│ Session Domain: SessionLifecycleService                 │
└─────────────────────────────────────────────────────────┘
  ↓
  │ Step 5: 更新实际开始时间
  │ SessionRepository.update(sessionId, {
  │   actual_start_time: new Date(meeting.start_time),
  │   status: 'started'
  │ })
  ↓
返回飞书: { success: true }
```

---

### 12.3 会议结束流程（Webhook触发）

```
飞书服务器
  ↓
POST /webhooks/feishu
Body: { event_type: "vc.meeting.meeting_ended_v1", ... }
  ↓
┌─────────────────────────────────────────────────────────┐
│ Webhook Module → SessionLifecycleService                │
└─────────────────────────────────────────────────────────┘
  ↓
  │ Step 1: 保存事件（同会议开始流程）
  ↓
  │ Step 2: 更新实际结束时间
  │ SessionRepository.update(sessionId, {
  │   actual_end_time: new Date(meeting.end_time),
  │   status: 'completed'
  │ })
  ↓
  │ Step 3: 计算时长统计
  │ stats = SessionDurationCalculator.calculateDurations(sessionId)
  │
  │ 计算逻辑:
  │   1. 查询所有join_meeting和leave_meeting事件
  │   2. 根据participant.user_id区分导师和学生
  │   3. 配对每个join和leave，计算在线时间段
  │   4. 计算导师和学生时间段的交集
  │
  │ 返回: DurationStats { ... }
  ↓
  │ Step 4: 保存统计结果
  │ SessionRepository.update(sessionId, {
  │   mentor_total_duration_seconds: stats.mentor_total_duration_seconds,
  │   student_total_duration_seconds: stats.student_total_duration_seconds,
  │   effective_tutoring_duration_seconds: stats.effective_tutoring_duration_seconds,
  │   mentor_join_count: stats.mentor_join_count,
  │   student_join_count: stats.student_join_count
  │ })
  ↓
返回飞书: { success: true }
```

---

### 12.4 录制就绪流程（支持多段）

```
飞书服务器（可能触发多次）
  ↓
POST /webhooks/feishu
Body: { event_type: "vc.meeting.recording_ready_v1", ... }
  ↓
┌─────────────────────────────────────────────────────────┐
│ Webhook Module → SessionLifecycleService                │
└─────────────────────────────────────────────────────────┘
  ↓
  │ Step 1: 保存事件
  ↓
  │ Step 2: 追加录制到recordings数组
  │ SessionRecordingManager.appendRecording(sessionId, RecordingData{
  │   recording_id: "rec_xxx",
  │   recording_url: "https://...",
  │   duration: 3600,
  │   sequence: 自动计算（当前数组长度+1）,
  │   transcript_url: null
  │ })
  │
  │ 更新后的recordings数组:
  │ [
  │   { recording_id: "rec_001", sequence: 1, transcript_url: null },
  │   { recording_id: "rec_002", sequence: 2, transcript_url: null }
  │ ]
  ↓
  │ Step 3: 启动transcript轮询任务
  │ TranscriptPollingService.startPolling(
  │   sessionId, recordingId,
  │   config: { interval: 5分钟, maxAttempts: 100 }
  │ )
  ↓
返回飞书: { success: true }
```

---

### 12.5 改期流程

```
前端请求
  ↓
┌─────────────────────────────────────────────────────────┐
│ BFF层: SessionController.rescheduleSession(sessionId, dto) │
└─────────────────────────────────────────────────────────┘
  ↓
  │ Step 1: 检查新时间段是否可用
  │ CalendarService.isSlotAvailable(...)
  │ 返回: boolean
  ↓
  │ Step 2: 更新session的计划时间
  │ SessionService.updateSession(sessionId, UpdateSessionDto)
  ↓
  │ Step 3: 更新第三方会议
  │ provider = MeetingProviderFactory.getProvider(session.meeting_provider)
  │ provider.updateMeeting(session.meeting_id, UpdateMeetingInput)
  ↓
  │ Step 4: 改期日历占用（释放旧+占用新）
  │ oldSlot = CalendarService.getSlotBySessionId(sessionId)
  │ CalendarService.rescheduleSlot(oldSlotId, newStartTime, newDuration)
  ↓
  │ Step 5: 更新通知队列的计划时间
  │ NotificationQueueService.updateBySessionId(sessionId, newScheduledTime)
  ↓
  │ Step 6: 发送改期通知邮件
  │ NotificationService.sendEmail(SendEmailDto{ template: "session-rescheduled", ... })
  ↓
返回前端: { success: true, newStartTime: "..." }
```

---

### 12.6 取消约课流程

```
前端请求
  ↓
┌─────────────────────────────────────────────────────────┐
│ BFF层: SessionController.cancelSession(sessionId, reason) │
└─────────────────────────────────────────────────────────┘
  ↓
  │ Step 1: 更新session状态
  │ SessionService.cancelSession(sessionId, reason)
  │ 内部逻辑: status → 'cancelled', notes → 追加取消原因
  ↓
  │ Step 2: 取消第三方会议
  │ provider = MeetingProviderFactory.getProvider(session.meeting_provider)
  │ provider.cancelMeeting(session.meeting_id)
  ↓
  │ Step 3: 释放日历占用
  │ slot = CalendarService.getSlotBySessionId(sessionId)
  │ CalendarService.releaseSlot(slot.id)
  ↓
  │ Step 4: 取消所有待发通知
  │ NotificationQueueService.cancelBySessionId(sessionId)
  ↓
  │ Step 5: 发送取消通知邮件
  │ NotificationService.sendSessionCancelledEmail(SessionEntity)
  ↓
返回前端: { success: true, status: "cancelled" }
```

---

## ✅ 13. 核心设计原则总结

| 原则          | 说明                      | 体现                             |
|-------------|-------------------------|--------------------------------|
| BFF层编排      | 流程控制在BFF层，Domain层提供原子操作 | SessionController编排创建约课的7个步骤   |
| 职责分离        | 每个Service职责单一，不跨域调用     | SessionService只负责session记录CRUD |
| 依赖倒置        | 依赖抽象而非具体实现              | IMeetingProvider接口，工厂模式        |
| 数据库防护       | 数据库层面保证数据一致性            | EXCLUDE约束防止时间冲突                |
| 事件溯源        | 单一数据源，支持重新计算            | 时长统计从session_event溯源计算         |
| Webhook集中管理 | 统一入口、签名验证、事件分发          | src/core/webhook统一管理第三方回调      |
| DTO明确定义     | 所有输入输出参数类型明确            | 本文档详细定义所有DTO结构                 |
| 类型安全        | 避免使用Plain Object，明确返回类型  | SessionEntity、CalendarSlotEntity等 |
| 主键统一        | 所有表主键统一使用id              | session.id、user.id、contract.id等 |

---

**文档结束**
