# System Architecture Design v5.3

**文档版本**: v5.3  
**更新日期**: 2025-11-24  
**核心变更**: 
1. Calendar 表回归本质：时间占位 + 冲突检测 + 显示辅助
2. 明确 CQRS 查询层设计：单模块查询 vs 跨模块聚合查询
3. 优化 metadata 设计：title 独立字段，仅保留稳定快照
4. Meetings 表新增 reserve_id，强化技术适配层定位
5. Sessions 子表状态简化：取消 in_progress 状态
6. Service_references 表简化：仅保留 service_type，字段重命名
7. 完整的目录结构设计：sessions 作为核心子域，service-registry 作为服务注册表

---

## 📐 1. 架构设计概述

### 1.1 核心理念

**四层架构，职责清晰，CQRS 模式，事件驱动**

### 1.2 层级架构

```
┌─────────────────────────────────────────┐
│   API Layer (接口层)                     │
│   - Controllers (RESTful API)           │
│   - DTOs (数据传输对象)                  │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│   Application Layer (应用层)            │
│   - Commands (写操作)                    │
│   - Queries (读操作) ⭐                  │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│   Core Layer (核心基础设施层)           │
│   - Meetings (会议技术管理)             │
│   - Calendar (时间占位 + Read Model)    │
│   → 发布：MeetingCompletedEvent         │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│   Domain Layer (业务领域层)             │
│   - Services Domain (服务域)            │
│     - Sessions Subdomain (课时子域)     │
│       - Regular Mentoring              │
│       - Gap Analysis                   │
│       - AI Career                      │
│       - Communication                  │
│       - Class                          │
│     - Resume Subdomain (简历子域)      │
│     - Service Registry (服务注册表) ⭐  │
│   - Query Aggregators (跨模块查询)     │
│   → 发布：SessionCompletedEvent         │
└─────────────────────────────────────────┘
```

---

## 📊 2. 数据库详细设计

### 2.1 meetings (会议 - Core 层)

**职责**：管理第三方视频会议资源的技术生命周期

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|:---|:---|:---|:---|:---|
| **id** | UUID | PK | uuid_generate_v4() | 主键 |
| **meeting_no** | VARCHAR(20) | NOT NULL | - | 飞书会议号（9位）或 Zoom Meeting ID |
| **meeting_provider** | VARCHAR(20) | NOT NULL | - | 会议提供商 Enum: `feishu`, `zoom` |
| **meeting_id** | VARCHAR(255) | NOT NULL | - | 第三方平台的会议 ID |
| **reserve_id** | VARCHAR(255) | | - | 飞书预定 ID（用于更新/取消会议）⭐ |
| **meeting_url** | TEXT | NOT NULL | - | 会议入会链接 |
| **owner_id** | UUID | FK (users.id) | - | 会议拥有者 ID（通常是导师） |
| **schedule_start_time** | TIMESTAMPTZ | NOT NULL | - | 预定开始时间 |
| **schedule_duration** | INT | NOT NULL | - | 预定时长（分钟） |
| **status** | VARCHAR(20) | NOT NULL | `scheduled` | 状态 Enum: `scheduled`, `active`, `ended`, `cancelled` ⭐ |
| **actual_duration** | INT | | - | 实际时长（秒），会议结束后计算 |
| **meeting_time_list** | JSONB | | `'[]'::jsonb` | 时间片段列表（支持断线重连） |
| **last_meeting_ended_timestamp** | TIMESTAMPTZ | | - | 最后一次 meeting.ended 事件时间 |
| **pending_task_id** | VARCHAR(255) | | - | 延迟任务 ID（30分钟延迟判定） |
| **event_type** | VARCHAR(100) | | - | 最后处理的事件类型（调试用）⭐ |
| **created_at** | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| **updated_at** | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**唯一约束**:
```sql
UNIQUE (meeting_no, meeting_provider, schedule_start_time);
```

**索引**:
*   `idx_meeting_no_created_at` (meeting_no, created_at)
*   `idx_meeting_reserve_id` (reserve_id) ⭐
*   `idx_meeting_status` (status)
*   `idx_meeting_schedule_start_time` (schedule_start_time)
*   `idx_meeting_owner` (owner_id)

**CHECK 约束**:
```sql
CHECK (meeting_provider IN ('feishu', 'zoom'))
CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled'))  -- ⭐ 去掉 expired，新增 cancelled
CHECK (schedule_duration >= 30 AND schedule_duration <= 180)
```

**核心职责**：
- ✅ 调用飞书/Zoom API 创建/更新会议
- ✅ 接收 Webhook 事件（user_joined, meeting.ended）
- ✅ 延迟判定会议是否真正结束（30分钟延迟任务）
- ✅ 计算实际时长（actual_duration）
- ✅ 发布领域事件：`MeetingCompletedEvent`

**不承担的职责**：
- ❌ 不存储业务信息（title, description 在 Sessions）
- ❌ 不关心业务状态（scheduled/completed 是 Sessions 的事）
- ❌ 不参与计费逻辑
- ❌ 不直接被用户查询

---

### 2.2 calendar (日历 - Read Model)

**职责**：时间占位 + 冲突检测 + 显示辅助

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|:---|:---|:---|:---|:---|
| **id** | UUID | PK | uuid_generate_v4() | 主键 |
| **user_id** | UUID | NOT NULL, FK (users.id) | - | 用户 ID（导师/学生/顾问） |
| **user_type** | VARCHAR(20) | NOT NULL | - | 用户类型 Enum: `mentor`, `student`, `counselor` |
| **session_id** | UUID | NOT NULL | - | 关联的会话 ID（多态关联） |
| **session_type** | VARCHAR(50) | NOT NULL | - | 会话类型 ⭐ |
| **title** | VARCHAR(255) | NOT NULL | - | 课程标题（一等公民）⭐ |
| **scheduled_start_time** | TIMESTAMPTZ | NOT NULL | - | 预约开始时间（冗余，查询优化） |
| **time_range** | TSTZRANGE | NOT NULL | - | 时间范围 `[start, end)` |
| **duration_minutes** | INT | NOT NULL | - | 时长（分钟） |
| **status** | VARCHAR(20) | NOT NULL | `booked` | 状态 Enum: `booked`, `completed`, `cancelled` |
| **metadata** | JSONB | | `'{}'::jsonb` | 快照数据（仅稳定字段）⭐ |
| **created_at** | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| **updated_at** | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**Metadata 结构** ⭐：
```typescript
interface CalendarMetadata {
  otherPartyName: string;  // "张三" (快照，不同步用户改名)
  meetingUrl: string;      // "https://meetings.feishu.cn/j/123456789" (权威同步)
}
```

**索引**:
*   `idx_calendar_user_scheduled` (user_id, scheduled_start_time DESC)
*   `idx_calendar_session` (session_id, session_type)
*   `idx_calendar_status` (status)
*   **GIST Index**: `idx_calendar_time_range` (time_range)

**关键约束**:
```sql
-- 排他约束：防止同一用户时间重叠
EXCLUDE USING GIST (
  user_id WITH =,
  time_range WITH &&
) WHERE (status = 'booked');

-- CHECK 约束
CHECK (user_type IN ('mentor', 'student', 'counselor'))
CHECK (session_type IN ('regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session'))  -- ⭐
CHECK (status IN ('booked', 'completed', 'cancelled'))
CHECK (duration_minutes >= 30 AND duration_minutes <= 180)
```

**核心职责**：
- ✅ **时间占位**：INSERT 记录占用时间段
- ✅ **冲突检测**：排他约束防止重复预约
- ✅ **日历视图**：单表查询支持日历展示
- ✅ **显示优化**：metadata 快照避免频繁 JOIN

**不承担的职责**：
- ❌ 不作为课时查询的唯一权威表（Sessions 才是）
- ❌ 不维护详细业务信息（description、feedback 等）
- ❌ 不保证与业务表的强一致性（允许弱一致性）
- ❌ 不承担复杂业务逻辑

**数据同步策略**：
| 场景 | 同步策略 |
|:---|:---|
| **约课时** | 同步写入 title + metadata（完整快照） |
| **编辑 title** | 同步更新 title 字段 ⭐ |
| **修改时间** | 同步更新 time_range + metadata.meetingUrl |
| **完成课时** | 同步更新 status='completed' |
| **用户改名** | ❌ 不同步 metadata.otherPartyName（历史快照） |

---

### 2.3 regular_mentoring_sessions (常规辅导 - Domain 层)

**职责**：管理常规辅导课时的业务信息和生命周期

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|:---|:---|:---|:---|:---|
| **id** | UUID | PK | uuid_generate_v4() | 主键 |
| **meeting_id** | UUID | UNIQUE, FK (meetings.id) | - | 关联的会议 ID（1:1 关系） |
| **session_type** | VARCHAR(50) | NOT NULL | `standard` | 子类型 Enum: `standard`, `career_planning`, `resume_review`, `interview_prep` |
| **student_user_id** | UUID | NOT NULL, FK (users.id) | - | 学生的用户 ID |
| **mentor_user_id** | UUID | NOT NULL, FK (users.id) | - | 导师的用户 ID ⭐ 改名 |
| **created_by_counselor_id** | UUID | FK (users.id) | - | 创建该课时的顾问 ID |
| **title** | VARCHAR(255) | NOT NULL | - | 课程标题 |
| **description** | TEXT | | - | 课程大纲/详细描述 |
| **status** | VARCHAR(20) | NOT NULL | `scheduled` | 状态 ⭐ |
| **scheduled_at** | TIMESTAMPTZ | NOT NULL | - | 预约开始时间 |
| **completed_at** | TIMESTAMPTZ | | - | 完成时间 |
| **cancelled_at** | TIMESTAMPTZ | | - | 取消时间 |
| **ai_summaries** | JSONB | | `'[]'::jsonb` | AI 生成的课时摘要 ⭐ 新增 |
| **created_at** | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| **updated_at** | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**索引**:
*   `idx_regular_session_meeting` (meeting_id)
*   `idx_regular_session_mentor_scheduled` (mentor_user_id, scheduled_at DESC) ⭐
*   `idx_regular_session_student_scheduled` (student_user_id, scheduled_at DESC) ⭐
*   `idx_regular_session_status` (status)
*   `idx_regular_session_type` (session_type)

**CHECK 约束**:
```sql
CHECK (session_type IN ('standard', 'career_planning', 'resume_review', 'interview_prep'))
CHECK (status IN ('scheduled', 'completed', 'cancelled'))  -- ⭐ 简化，去掉 in_progress
```

**字段变更说明**：
- ✅ `provider_user_id` → `mentor_user_id`（语义更清晰）
- ❌ 删除 `mentor_feedback`、`student_rating`（暂不需要）
- ✅ 新增 `ai_summaries`（AI 生成的摘要）
- ⭐ 状态简化为 3 个：`scheduled`, `completed`, `cancelled`

**核心职责**：
- ✅ 存储完整业务信息（title, description, ai_summaries）
- ✅ 管理业务生命周期（状态机）
- ✅ 响应查询请求（权威数据源）
- ✅ 监听 `MeetingCompletedEvent`，更新状态为 completed
- ✅ 触发计费：直接 INSERT service_references（共享主键）

---

### 2.4 gap_analysis_sessions (Gap 分析 - Domain 层)

**职责**：管理 Gap 分析服务的业务信息和生命周期

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|:---|:---|:---|:---|:---|
| **id** | UUID | PK | uuid_generate_v4() | 主键 |
| **meeting_id** | UUID | UNIQUE, FK (meetings.id) | - | 关联的会议 ID（1:1 关系） |
| **student_user_id** | UUID | NOT NULL, FK (users.id) | - | 学生的用户 ID |
| **mentor_user_id** | UUID | NOT NULL, FK (users.id) | - | 导师的用户 ID ⭐ |
| **created_by_counselor_id** | UUID | FK (users.id) | - | 创建该服务的顾问 ID |
| **analysis_focus** | VARCHAR(100) | NOT NULL | - | 分析重点 Enum: `resume`, `profile`, `skills`, `career`, `comprehensive` |
| **title** | VARCHAR(255) | NOT NULL | - | 服务标题 |
| **current_level** | VARCHAR(50) | | - | 当前水平 |
| **target_level** | VARCHAR(50) | | - | 目标水平 |
| **gap_areas** | JSONB | | `'[]'::jsonb` | 差距领域 |
| **action_plan** | TEXT | | - | 行动计划 |
| **status** | VARCHAR(20) | NOT NULL | `scheduled` | 状态 Enum: `scheduled`, `completed`, `cancelled` ⭐ |
| **scheduled_at** | TIMESTAMPTZ | NOT NULL | - | 预约开始时间 |
| **completed_at** | TIMESTAMPTZ | | - | 完成时间 |
| **cancelled_at** | TIMESTAMPTZ | | - | 取消时间 |
| **created_at** | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| **updated_at** | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**索引**: 与 regular_mentoring_sessions 类似

**CHECK 约束**:
```sql
CHECK (analysis_focus IN ('resume', 'profile', 'skills', 'career', 'comprehensive'))
CHECK (status IN ('scheduled', 'completed', 'cancelled'))  -- ⭐ 简化
```

---

### 2.5 ai_career_sessions (AI 职业课 - Domain 层)

**职责**：管理 AI 职业规划课时的业务信息和生命周期

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|:---|:---|:---|:---|:---|
| **id** | UUID | PK | uuid_generate_v4() | 主键 |
| **meeting_id** | UUID | UNIQUE, FK (meetings.id) | - | 关联的会议 ID（1:1 关系） |
| **student_user_id** | UUID | NOT NULL, FK (users.id) | - | 学生的用户 ID |
| **mentor_user_id** | UUID | NOT NULL, FK (users.id) | - | 导师的用户 ID ⭐ |
| **created_by_counselor_id** | UUID | FK (users.id) | - | 创建该课时的顾问 ID |
| **title** | VARCHAR(255) | NOT NULL | - | 课程标题 |
| **description** | TEXT | | - | 课程描述 |
| **ai_topics** | JSONB | | `'[]'::jsonb` | AI 相关主题列表 |
| **status** | VARCHAR(20) | NOT NULL | `scheduled` | 状态 Enum: `scheduled`, `completed`, `cancelled` ⭐ |
| **scheduled_at** | TIMESTAMPTZ | NOT NULL | - | 预约开始时间 |
| **completed_at** | TIMESTAMPTZ | | - | 完成时间 |
| **cancelled_at** | TIMESTAMPTZ | | - | 取消时间 |
| **created_at** | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| **updated_at** | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**索引**: 与 regular_mentoring_sessions 类似

**CHECK 约束**:
```sql
CHECK (status IN ('scheduled', 'completed', 'cancelled'))  -- ⭐ 简化
```

---

### 2.6 comm_sessions (沟通课 - Domain 层)

**职责**：管理沟通课的业务信息和生命周期

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|:---|:---|:---|:---|:---|
| **id** | UUID | PK | uuid_generate_v4() | 主键 |
| **meeting_id** | UUID | UNIQUE, FK (meetings.id) | - | 关联的会议 ID（1:1 关系） |
| **student_user_id** | UUID | NOT NULL, FK (users.id) | - | 学生的用户 ID |
| **counselor_user_id** | UUID | NOT NULL, FK (users.id) | - | 咨询师的用户 ID ⭐ |
| **created_by_counselor_id** | UUID | FK (users.id) | - | 创建该课时的顾问 ID |
| **title** | VARCHAR(255) | NOT NULL | - | 课程标题 |
| **description** | TEXT | | - | 课程描述 |
| **status** | VARCHAR(20) | NOT NULL | `scheduled` | 状态 Enum: `scheduled`, `completed`, `cancelled` ⭐ |
| **scheduled_at** | TIMESTAMPTZ | NOT NULL | - | 预约开始时间 |
| **completed_at** | TIMESTAMPTZ | | - | 完成时间 |
| **cancelled_at** | TIMESTAMPTZ | | - | 取消时间 |
| **created_at** | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| **updated_at** | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**说明**: 沟通课的服务提供者是咨询师，字段名为 `counselor_user_id`

**索引**：与 regular_mentoring_sessions 类似

**CHECK 约束**:
```sql
CHECK (status IN ('scheduled', 'completed', 'cancelled'))  -- ⭐ 简化
```

---

### 2.7 class_sessions (班课 - Domain 层)

**职责**：管理班课的业务信息和生命周期

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|:---|:---|:---|:---|:---|
| **id** | UUID | PK | uuid_generate_v4() | 主键 |
| **meeting_id** | UUID | UNIQUE, FK (meetings.id) | - | 关联的会议 ID（1:1 关系） |
| **mentor_user_id** | UUID | NOT NULL, FK (users.id) | - | 导师的用户 ID ⭐ |
| **created_by_counselor_id** | UUID | FK (users.id) | - | 创建该课时的顾问 ID |
| **title** | VARCHAR(255) | NOT NULL | - | 班课标题 |
| **description** | TEXT | | - | 课程描述 |
| **status** | VARCHAR(20) | NOT NULL | `scheduled` | 状态 Enum: `scheduled`, `completed`, `cancelled` ⭐ |
| **scheduled_at** | TIMESTAMPTZ | NOT NULL | - | 预约开始时间 |
| **completed_at** | TIMESTAMPTZ | | - | 完成时间 |
| **cancelled_at** | TIMESTAMPTZ | | - | 取消时间 |
| **created_at** | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| **updated_at** | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**特殊说明**：
- 班课没有 `student_user_id`（一对多）
- 学生列表存储在关联表 `class_session_students` 中

**CHECK 约束**:
```sql
CHECK (status IN ('scheduled', 'completed', 'cancelled'))  -- ⭐ 简化
```

---

### 2.8 service_references (服务注册表 - Service Registry)

**职责**：记录所有已完成的服务（Immutable，共享主键）

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|:---|:---|:---|:---|:---|
| **id** | UUID | PK | - | 主键（来自 Sessions 子表的 ID，共享主键） |
| **service_type** | VARCHAR(50) | NOT NULL | - | 服务类型 ⭐ |
| **student_user_id** | UUID | NOT NULL, FK (users.id) | - | 学生的用户 ID |
| **provider_user_id** | UUID | NOT NULL, FK (users.id) | - | 服务提供者的用户 ID |
| **consumed_units** | DECIMAL(10,2) | NOT NULL | - | 消耗的单位数量（如 1.5 小时、1 次） |
| **unit_type** | VARCHAR(20) | NOT NULL | - | 单位类型 Enum: `hour`, `count` |
| **completed_time** | TIMESTAMPTZ | NOT NULL | - | 服务完成时间 ⭐ 改名 |
| **created_at** | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间（无 updated_at，因为不可变） |

**索引**:
*   `idx_service_ref_type` (service_type)
*   `idx_service_ref_student` (student_user_id, completed_time DESC) ⭐
*   `idx_service_ref_provider` (provider_user_id, completed_time DESC) ⭐
*   `idx_service_ref_completed_time` (completed_time) ⭐

**CHECK 约束**:
```sql
CHECK (service_type IN (
  'regular_mentoring',
  'gap_analysis', 
  'ai_career',
  'comm_session',
  'class_session',
  'resume',
  'recommendation_letter'
))  -- ⭐ 简化，仅一个字段
CHECK (unit_type IN ('hour', 'count'))
CHECK (consumed_units > 0)
```

**字段变更说明**：
- ❌ 删除 `session_type`（冗余，service_type 已足够区分）
- ⭐ `billing_time` → `completed_time`（语义更准确）

**核心特点**：
- **共享主键**：`id` 来自业务表（如 regular_mentoring_sessions.id）
- **Immutable**：只有 INSERT，无 UPDATE/DELETE
- **创建时机**：仅在服务完成后创建
- **防重复计费**：主键天然保证 1:1 关系
- **统一枚举**：service_type 统一区分所有服务类型

---

## 📁 3. 目录结构设计

### 3.1 完整目录树 ⭐

```
src/
├── api/                                    # API 层
│   └── controllers/
│       └── mentor/
│           ├── mentor-sessions.controller.ts
│           └── mentor-calendar.controller.ts
│
├── application/                            # 应用层
│   ├── commands/
│   │   └── booking/
│   │       ├── book-regular-session.command.ts
│   │       ├── book-comm-session.command.ts
│   │       └── book-class-session.command.ts
│   │
│   └── queries/
│       └── mentor/
│           ├── get-mentoring-sessions.query.ts
│           ├── get-comm-sessions.query.ts
│           └── get-mentor-calendar.query.ts
│
├── core/                                   # 核心基础设施
│   ├── calendar/
│   │   ├── calendar.service.ts
│   │   └── calendar-query.service.ts
│   │
│   └── meeting/
│       ├── meeting.service.ts
│       └── meeting-query.service.ts
│
├── domains/                                # 领域层 ⭐⭐⭐
│   ├── services/                           # 服务域（限界上下文）⭐
│   │   ├── sessions/                       # 课时子域（核心）⭐
│   │   │   ├── regular-mentoring/
│   │   │   │   ├── entities/
│   │   │   │   ├── regular-mentoring.repository.ts
│   │   │   │   ├── regular-mentoring.service.ts
│   │   │   │   └── regular-mentoring-query.service.ts
│   │   │   │
│   │   │   ├── gap-analysis/
│   │   │   │   ├── entities/
│   │   │   │   ├── gap-analysis.repository.ts
│   │   │   │   ├── gap-analysis.service.ts
│   │   │   │   └── gap-analysis-query.service.ts
│   │   │   │
│   │   │   ├── ai-career/
│   │   │   │   ├── entities/
│   │   │   │   ├── ai-career.repository.ts
│   │   │   │   ├── ai-career.service.ts
│   │   │   │   └── ai-career-query.service.ts
│   │   │   │
│   │   │   ├── communication/
│   │   │   │   ├── entities/
│   │   │   │   ├── comm-session.repository.ts
│   │   │   │   ├── comm-session.service.ts
│   │   │   │   └── comm-session-query.service.ts
│   │   │   │
│   │   │   ├── class/
│   │   │   │   ├── entities/
│   │   │   │   ├── class-session.repository.ts
│   │   │   │   ├── class-session.service.ts
│   │   │   │   └── class-session-query.service.ts
│   │   │   │
│   │   │   ├── shared/                     # Session 共享资源
│   │   │   │   ├── interfaces/
│   │   │   │   ├── dto/
│   │   │   │   └── exceptions/
│   │   │   │
│   │   │   └── sessions.module.ts
│   │   │
│   │   ├── resume/                         # 简历子域
│   │   │   ├── entities/
│   │   │   ├── resume.repository.ts
│   │   │   ├── resume.service.ts
│   │   │   └── resume.module.ts
│   │   │
│   │   ├── recommendation-letter/          # 推荐信子域
│   │   │   ├── entities/
│   │   │   ├── recommendation-letter.repository.ts
│   │   │   ├── recommendation-letter.service.ts
│   │   │   └── recommendation-letter.module.ts
│   │   │
│   │   └── service-registry/               # 服务注册表（基础设施）⭐
│   │       ├── entities/
│   │       │   └── service-reference.entity.ts
│   │       ├── service-reference.repository.ts
│   │       ├── service-registry.service.ts
│   │       ├── service-registry-query.service.ts
│   │       └── service-registry.module.ts
│   │
│   ├── query/                              # 跨域聚合查询
│   │   ├── session-aggregator.service.ts   # 辅导课时聚合
│   │   ├── calendar-aggregator.service.ts
│   │   └── service-search.service.ts
│   │
│   ├── catalog/                            # 目录域（现有）
│   ├── contract/                           # 合同域（现有）
│   ├── financial/                          # 财务域（现有）
│   └── identity/                           # 身份域（现有）
│
└── infrastructure/                         # 基础设施
    └── database/
```

---

### 3.2 架构设计说明

#### Session 作为核心抽象 ⭐

**领域建模**：
```
Services Domain (服务域)
    ↓
Sessions Subdomain (课时子域) - 核心领域概念
    ├── Regular Mentoring (常规辅导)
    ├── Gap Analysis (Gap 分析)
    ├── AI Career (AI 职业测评)
    ├── Communication (沟通课)
    └── Class (班课)

特征:
- 有时间、有参与者、消耗课时
- 生命周期: scheduled → completed
- 子类型: 通过 Table-per-Type 实现多态
```

---

#### service-registry 的定位 ⭐

**放在 services/ 下的理由**：
```
service-registry 是服务域的基础设施
    ↓
职责: 登记已完成的服务
    ↓
作用: 为 financial、contract 等域提供统一引用
    ↓
位置: domains/services/service-registry/
```

**数据流向**：
```
1. 服务完成
   ↓
services/sessions/ 更新状态为 completed
   ↓
2. 登记服务
   ↓
services/service-registry/ 创建引用记录
   ↓
发布 ServiceCompletedEvent
   ↓
3. 下游消费（软引用）
   ↓
financial/ledger/ → 创建财务记录（引用 service_reference_id）
contract/ledger/ → 扣减合同课时（引用 service_reference_id）
```

---

## 🎯 4. 设计原则总结

### 4.1 单一职责

| 表 | 职责 | 创建时机 | 查询场景 |
|:---|:---|:---|:---|
| **Meetings** | 第三方会议技术管理 | 约课时 | 详情页获取会议 URL |
| **Sessions 子表** | 业务生命周期管理 | 约课时 | **主查询表** ⭐ |
| **Calendar** | 时间占位 + 显示辅助 | 约课时 | 日历视图、冲突检测 |
| **Service_references** | 服务注册记录 | **完成后** | 计费统计、财务报表 |

---

### 4.2 CQRS 模式

**查询分层**：
```
单模块查询 → domains/services/sessions/*/query.service.ts
跨模块聚合 → domains/query/aggregator.service.ts
Calendar 查询 → core/calendar/calendar-query.service.ts
```

---

### 4.3 共享主键模式

**实现**：
```
约课时：生成 UUID
sessionId = uuid_generate_v4()

完成后：使用同一个 UUID
INSERT INTO service_references (id, ...) VALUES (sessionId, ...)
```

**优势**：
- ✅ 防重复计费（数据库级别保证）
- ✅ 查询性能好（直接 JOIN）
- ✅ 关联关系简单（1:1）

---

### 4.4 状态机简化

**Sessions 状态机**：
```
scheduled → completed  (会议结束触发)
    ↓
cancelled  (用户取消)
```

**为什么取消 in_progress**：
- ✅ 用户在会议中不查看系统
- ✅ Meetings.status = 'active' 已足够表示进行中
- ✅ 简化状态维护逻辑
- ✅ 前端可根据 Meetings.status 动态显示

---

### 4.5 数据自治原则

**scheduled_at vs schedule_start_time**：
```
Sessions.scheduled_at       = 课时预约时间（业务层）
Meetings.schedule_start_time = 会议开始时间（技术层）

虽然值相同，但各自存储：
- 数据自治（各表管理自己的数据）
- 容错能力（会议创建失败不影响 Sessions）
- 一致性检查（可发现同步失败）
```

---

## 📊 5. 数据关系图

```
meetings (Core 层)
    ↓ 1:1
regular_mentoring_sessions (Domain 层)
    ↓ 1:1 (共享主键)
service_references (Service Registry)

regular_mentoring_sessions
    ↓ 1:N
calendar (Read Model)
```

---

## ✅ 6. 版本历史

**版本演进**：
- **v5.0**: 初始设计，Table-per-Type 拆分
- **v5.1**: 精简字段，优化结构
- **v5.2**: 采用共享主键模式，明确计费时机
- **v5.3**: ⭐ **当前版本**
  - Calendar 表回归本质（时间占位 + 冲突检测 + 显示辅助）
  - title 字段独立（从 metadata 提升为一等公民）
  - metadata 仅保留稳定快照（otherPartyName, meetingUrl）
  - Meetings 表新增 reserve_id（支持更新会议）
  - Meetings 状态优化（去掉 expired，新增 cancelled）
  - Sessions 状态简化（取消 in_progress，仅保留 3 状态）
  - provider_user_id → mentor_user_id（语义更清晰）
  - 新增 ai_summaries 字段，删除 mentor_feedback/student_rating
  - service_references 简化（删除 session_type，billing_time → completed_time）
  - 完整的目录结构设计（sessions 作为核心子域，service-registry 作为服务注册表）
  - 移除核心业务流程章节（以代码实现为准）

---

**文档结束** 🎉

**关键设计模式**：
- ✅ **CQRS**（Command Query Responsibility Segregation）
- ✅ **Shared Primary Key**（共享主键）
- ✅ **Domain Events**（领域事件）
- ✅ **Read Model**（读模型）
- ✅ **Polymorphic Association**（多态关联）
- ✅ **Table-per-Type**（每类型一表）

**设计哲学**：
> "职责清晰胜过巧妙抽象，性能优化基于实际场景，弱一致性优于复杂同步"
