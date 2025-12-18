# Services Session Domain 设计文档 v4.0

**文档版本**: v4.0  
**更新日期**: 2025-11-25  
**模块路径**: `src/domains/services/sessions`  
**定位**: 业务领域层 (Domain Layer) - Sessions 子域，负责课时类服务的业务逻辑实现，通过聚合根管理业务状态，并响应 Core 层的会议生命周期事件。  
**依赖关系**: 依赖 `src/core/meeting` (仅通过 ID 引用和事件订阅)，依赖 `src/domains/services/service-registry` (服务完成后登记)，被 `src/application` 层调用。

**核心变更** ⭐:
1. **新增 session_types 表**: 管理会话类型配置（业务分类、评估模板、计费规则）⭐
2. **session-types 独立模块**: 作为独立查询服务，提供 API 接口供前端约课时调用 ⭐
3. **统一 session_type 枚举**: `regular_mentoring`, `gap_analysis`, `ai_career`, `comm_session`, `class_session`
4. **新增 session_type_id 字段**: 所有 Sessions 子表新增 FK 关联到 session_types ⭐
5. **新增软删除**: 所有 Session 表新增 `deleted` 状态和 `deleted_at` 字段
6. **字段简化**: Gap Analysis 删除 `current_level`, `target_level`, `gap_areas`, `action_plan`；AI Career 删除 `ai_topics`
7. **新增 ai_summaries**: Gap Analysis 和 AI Career 表新增 `ai_summaries` 字段
8. **完整 Service Registry 集成**: 包含 service_references 表设计、完整调用流程、services.session.completed 事件 ⭐
9. **事件标准化**: 监听器统一使用 `MEETING_LIFECYCLE_COMPLETED_EVENT` 和 `MeetingLifecycleCompletedPayload` from `@shared/events`
10. **解耦 Calendar 更新**: `completeSession()` 不直接更新 Calendar，改为通过事件通知

---

## 📂 1. 目录结构

```text
src/
├── api/                                      # API 层
│   └── controllers/
│       └── services/
│           └── session-types.controller.ts   # 会话类型 API ⭐
│
├── application/                              # 应用层
│   └── queries/
│       └── services/
│           └── get-session-types.query.ts    # 获取会话类型查询 ⭐
│
└── domains/                                  # 领域层
    └── services/
        ├── sessions/                         # 【Sessions 子域】业务聚合根
        │   ├── regular-mentoring/            # 【常规辅导】
        │   │   ├── entities/
        │   │   │   └── regular-mentoring-session.entity.ts
        │   │   ├── services/
        │   │   │   └── regular-mentoring.service.ts
        │   │   │   └── regular-mentoring-query.service.ts
        │   │   ├── listeners/
        │   │   │   └── regular-mentoring-event.listener.ts
        │   │   ├── dto/
        │   │   │   └── create-regular-mentoring.dto.ts
        │   │   │   └── update-regular-mentoring.dto.ts
        │   │   └── regular-mentoring.repository.ts
        │   │
        │   ├── gap-analysis/                 # 【Gap 分析】
        │   │   ├── entities/
        │   │   │   └── gap-analysis-session.entity.ts
        │   │   ├── services/
        │   │   │   └── gap-analysis.service.ts
        │   │   │   └── gap-analysis-query.service.ts
        │   │   ├── listeners/
        │   │   │   └── gap-analysis-event.listener.ts
        │   │   ├── dto/
        │   │   │   └── create-gap-analysis.dto.ts
        │   │   │   └── update-gap-analysis.dto.ts
        │   │   └── gap-analysis.repository.ts
        │   │
        │   ├── ai-career/                    # 【AI 职业测评】
        │   │   ├── entities/
        │   │   │   └── ai-career-session.entity.ts
        │   │   ├── services/
        │   │   │   └── ai-career.service.ts
        │   │   │   └── ai-career-query.service.ts
        │   │   ├── listeners/
        │   │   │   └── ai-career-event.listener.ts
        │   │   ├── dto/
        │   │   │   └── create-ai-career.dto.ts
        │   │   │   └── update-ai-career.dto.ts
        │   │   └── ai-career.repository.ts
        │   │
        │   └── shared/                       # 【共享资源】
        │       ├── interfaces/
        │       │   └── session-base.interface.ts
        │       ├── dto/
        │       │   └── session-query.dto.ts
        │       └── exceptions/
        │           └── session-not-found.exception.ts
        │
        ├── session-types/                    # 【会话类型配置】独立查询服务 ⭐⭐⭐
        │   ├── entities/
        │   │   └── session-type.entity.ts
        │   ├── services/
        │   │   └── session-types.service.ts
        │   │   └── session-types-query.service.ts  ⭐
        │   ├── dto/
        │   │   └── get-session-types.dto.ts        ⭐
        │   └── session-types.repository.ts
        │
        └── service-registry/                 # 【服务注册表】⭐
            ├── entities/
            │   └── service-reference.entity.ts
            ├── services/
            │   └── service-registry.service.ts
            │   └── service-registry-query.service.ts
            ├── dto/
            │   └── register-service.dto.ts
            └── service-reference.repository.ts
```

---

## 💾 2. 数据库设计

**设计原则**: 
- 所有 Session 业务表都通过 `meeting_id` (FK) 关联到 Core 层的 `meetings` 表（1:1 关系）
- **不冗余存储** `meeting_no`、`meeting_url` 等 Core 层字段，保持数据归一化
- **状态简化**: 只保留 `scheduled`, `completed`, `cancelled` 三个状态（无 `in_progress`）
- **字段语义化**: `provider_user_id` → `mentor_user_id`（更清晰）
- **AI 增强**: 新增 `ai_summaries` 字段，删除 `mentor_feedback`、`student_rating`（暂不需要）

---

### 2.1 regular_mentoring_sessions 表 (常规辅导)

**职责**: 管理常规辅导课时的业务信息和生命周期

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | PK | uuid_generate_v4() | 主键 |
| `meeting_id` | UUID | FK (meetings.id), UNIQUE | - | 关联的会议 ID（1:1 关系） |
| `session_type` | VARCHAR(50) | NOT NULL | `regular_mentoring` | 会话类型 Enum: `regular_mentoring`, `gap_analysis`, `ai_career`, `comm_session`, `class_session` ⭐ |
| `session_type_id` | UUID | NOT NULL, FK (session_types.id) | - | 关联的会话类型配置 ID ⭐ |
| `student_user_id` | UUID | NOT NULL, FK (users.id) | - | 学生的用户 ID |
| `mentor_user_id` | UUID | NOT NULL, FK (users.id) | - | 导师的用户 ID ⭐ |
| `created_by_counselor_id` | UUID | FK (users.id) | - | 创建该课时的顾问 ID |
| `title` | VARCHAR(255) | NOT NULL | - | 课程标题 |
| `description` | TEXT | | - | 课程大纲/详细描述 |
| `status` | VARCHAR(20) | NOT NULL | `scheduled` | 状态 Enum: `scheduled`, `completed`, `cancelled`, `deleted` ⭐ |
| `scheduled_at` | TIMESTAMPTZ | NOT NULL | - | 预约开始时间 |
| `completed_at` | TIMESTAMPTZ | | - | 完成时间 |
| `cancelled_at` | TIMESTAMPTZ | | - | 取消时间 |
| `deleted_at` | TIMESTAMPTZ | | - | 软删除时间 ⭐ |
| `ai_summaries` | JSONB | | `'[]'::jsonb` | AI 生成的课时摘要 ⭐ |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**索引**:
- `idx_regular_session_meeting` (meeting_id)
- `idx_regular_session_mentor_scheduled` (mentor_user_id, scheduled_at DESC)
- `idx_regular_session_student_scheduled` (student_user_id, scheduled_at DESC)
- `idx_regular_session_status` (status)
- `idx_regular_session_type` (session_type)
- `idx_regular_session_type_id` (session_type_id) ⭐

**CHECK 约束**:
```sql
CHECK (session_type IN ('regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session'))
CHECK (status IN ('scheduled', 'completed', 'cancelled', 'deleted'))
```

**核心职责**:
- ✅ 存储完整业务信息（title, description, ai_summaries）
- ✅ 管理业务生命周期（状态机）
- ✅ 响应查询请求（权威数据源）
- ✅ 监听 `MeetingCompletedEvent`，更新状态为 completed
- ✅ 触发计费：直接 INSERT service_references（共享主键）

**不承担的职责**:
- ❌ 不管理会议技术细节（meeting_no、meeting_url 等）
- ❌ 不处理 Webhook 事件（由 Core/Meeting 处理）
- ❌ 不计算实际时长（由 Core/Meeting 计算）

---

### 2.2 gap_analysis_sessions 表 (Gap 分析)

**职责**: 管理 Gap 分析服务的业务信息和生命周期

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | PK | uuid_generate_v4() | 主键 |
| `meeting_id` | UUID | FK (meetings.id), UNIQUE | - | 关联的会议 ID（1:1 关系） |
| `session_type` | VARCHAR(50) | NOT NULL | `gap_analysis` | 会话类型 Enum: `regular_mentoring`, `gap_analysis`, `ai_career`, `comm_session`, `class_session` ⭐ |
| `session_type_id` | UUID | NOT NULL, FK (session_types.id) | - | 关联的会话类型配置 ID ⭐ |
| `student_user_id` | UUID | NOT NULL, FK (users.id) | - | 学生的用户 ID |
| `mentor_user_id` | UUID | NOT NULL, FK (users.id) | - | 导师的用户 ID ⭐ |
| `created_by_counselor_id` | UUID | FK (users.id) | - | 创建该服务的顾问 ID |
| `title` | VARCHAR(255) | NOT NULL | - | 服务标题 |
| `description` | TEXT | | - | 服务描述 |
| `status` | VARCHAR(20) | NOT NULL | `scheduled` | 状态 Enum: `scheduled`, `completed`, `cancelled`, `deleted` ⭐ |
| `scheduled_at` | TIMESTAMPTZ | NOT NULL | - | 预约开始时间 |
| `completed_at` | TIMESTAMPTZ | | - | 完成时间 |
| `cancelled_at` | TIMESTAMPTZ | | - | 取消时间 |
| `deleted_at` | TIMESTAMPTZ | | - | 软删除时间 ⭐ |
| `ai_summaries` | JSONB | | `'[]'::jsonb` | AI 生成的课时摘要 ⭐ |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**索引**:
- `idx_gap_session_meeting` (meeting_id)
- `idx_gap_session_mentor_scheduled` (mentor_user_id, scheduled_at DESC)
- `idx_gap_session_student_scheduled` (student_user_id, scheduled_at DESC)
- `idx_gap_session_status` (status)
- `idx_gap_session_type` (session_type)
- `idx_gap_session_type_id` (session_type_id) ⭐

**CHECK 约束**:
```sql
CHECK (session_type IN ('regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session'))
CHECK (status IN ('scheduled', 'completed', 'cancelled', 'deleted'))
```

**核心职责**:
- ✅ 存储 Gap 分析业务信息（title, description, ai_summaries）
- ✅ 管理业务生命周期（状态机）
- ✅ 监听 `MeetingLifecycleCompletedEvent`，更新状态并登记服务
- ✅ 触发计费：INSERT service_references (service_type = 'gap_analysis')

---

### 2.3 ai_career_sessions 表 (AI 职业测评)

**职责**: 管理 AI 职业规划课时的业务信息和生命周期

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | PK | uuid_generate_v4() | 主键 |
| `meeting_id` | UUID | FK (meetings.id), UNIQUE | - | 关联的会议 ID（1:1 关系） |
| `session_type` | VARCHAR(50) | NOT NULL | `ai_career` | 会话类型 Enum: `regular_mentoring`, `gap_analysis`, `ai_career`, `comm_session`, `class_session` ⭐ |
| `session_type_id` | UUID | NOT NULL, FK (session_types.id) | - | 关联的会话类型配置 ID ⭐ |
| `student_user_id` | UUID | NOT NULL, FK (users.id) | - | 学生的用户 ID |
| `mentor_user_id` | UUID | NOT NULL, FK (users.id) | - | 导师的用户 ID ⭐ |
| `created_by_counselor_id` | UUID | FK (users.id) | - | 创建该课时的顾问 ID |
| `title` | VARCHAR(255) | NOT NULL | - | 课程标题 |
| `description` | TEXT | | - | 课程描述 |
| `status` | VARCHAR(20) | NOT NULL | `scheduled` | 状态 Enum: `scheduled`, `completed`, `cancelled`, `deleted` ⭐ |
| `scheduled_at` | TIMESTAMPTZ | NOT NULL | - | 预约开始时间 |
| `completed_at` | TIMESTAMPTZ | | - | 完成时间 |
| `cancelled_at` | TIMESTAMPTZ | | - | 取消时间 |
| `deleted_at` | TIMESTAMPTZ | | - | 软删除时间 ⭐ |
| `ai_summaries` | JSONB | | `'[]'::jsonb` | AI 生成的课时摘要 ⭐ |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**索引**:
- `idx_ai_career_session_meeting` (meeting_id)
- `idx_ai_career_session_mentor_scheduled` (mentor_user_id, scheduled_at DESC)
- `idx_ai_career_session_student_scheduled` (student_user_id, scheduled_at DESC)
- `idx_ai_career_session_status` (status)
- `idx_ai_career_session_type` (session_type)
- `idx_ai_career_session_type_id` (session_type_id) ⭐

**CHECK 约束**:
```sql
CHECK (session_type IN ('regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session'))
CHECK (status IN ('scheduled', 'completed', 'cancelled', 'deleted'))
```

**核心职责**:
- ✅ 存储 AI 职业测评业务信息（title, description, ai_summaries）
- ✅ 管理业务生命周期（状态机）
- ✅ 监听 `MeetingLifecycleCompletedEvent`，更新状态并登记服务
- ✅ 触发计费：INSERT service_references (service_type = 'ai_career')

---

### 2.4 session_types 表 (会话类型配置) ⭐

**职责**: 管理会话类型的元数据配置（业务分类、评估模板、计费规则等）

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | PK | uuid_generate_v4() | 主键 |
| `code` | VARCHAR(50) | NOT NULL, UNIQUE | - | 业务大分类代码（`External`, `Internal`）⭐ |
| `name` | VARCHAR(100) | NOT NULL | - | 课时类型显示名称（如 `Regular Mentoring`, `Gap Analysis`）⭐ |
| `template_id` | UUID | | - | 评估模板 ID（课时完成后导师评估用）⭐ |
| `is_billing` | BOOLEAN | NOT NULL | TRUE | 是否触发计费 ⭐ |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**索引**:
- `idx_session_types_code` (code)
- `idx_session_types_name` (name)

**CHECK 约束**:
```sql
CHECK (code IN ('External', 'Internal'))  -- 业务大分类：外部/内部
```

**核心职责**:
- ✅ 集中管理会话类型的业务配置（外部导师课 vs 内部导师课）
- ✅ 关联评估模板（`template_id`），课时完成后让导师选择对应模板评估
- ✅ 控制是否触发计费逻辑（`is_billing` 字段）
- ✅ 为 `services.session.completed` 事件提供 `sessionTypeCode` 和 `allowBilling`

**示例数据**:
```sql
-- 外部导师课（需要计费）
INSERT INTO session_types (id, code, name, template_id, is_billing) VALUES
  ('uuid-1', 'External', 'Regular Mentoring', 'tpl-001', TRUE),
  ('uuid-2', 'External', 'Gap Analysis', 'tpl-002', TRUE);

-- 内部导师课（不计费）
INSERT INTO session_types (id, code, name, template_id, is_billing) VALUES
  ('uuid-3', 'Internal', 'AI Career', 'tpl-003', FALSE),
  ('uuid-4', 'Internal', 'Internal Communication', 'tpl-004', FALSE);
```

**约课流程说明** ⭐:
```
1. 前端调用 API 获取会话类型列表：
   GET /api/services/session-types?code=External
   返回：[
     { id: 'uuid-1', code: 'External', name: 'Regular Mentoring', is_billing: true },
     { id: 'uuid-2', code: 'External', name: 'Gap Analysis', is_billing: true }
   ]

2. 顾问在前端约课时选择：
   - 外部导师课 (code='External')
     └─ 下拉列表：Regular Mentoring, Gap Analysis
   
   - 内部导师课 (code='Internal')
     └─ 下拉列表：AI Career, Internal Communication

3. 选择后获得 session_type_id (如 uuid-1)

4. 创建 Session 记录时：
   POST /api/sessions/regular-mentoring
   {
     "sessionTypeId": "uuid-1",  ← 选择的类型 ID
     "session_type": "regular_mentoring"  ← 技术标识
     ...
   }
```

**字段说明**:
| 字段 | 用途 | 示例 |
|:---|:---|:---|
| `code` | 业务大分类 | `External` (外部导师课), `Internal` (内部导师课) |
| `name` | 课时类型名称 | `Regular Mentoring`, `Gap Analysis`, `AI Career` |
| `session_type` (在 Sessions 表) | 技术标识 | `regular_mentoring`, `gap_analysis`, `ai_career` |

**与 Sessions 的关系**:
- Sessions 子表的 `session_type` 字段：技术标识（`regular_mentoring`、`gap_analysis` 等）
- Sessions 子表的 `session_type_id` 字段：FK → `session_types.id`，用于获取业务配置
- 两者是独立的：`session_type` 用于区分子表类型，`session_type_id` 用于获取业务元数据

---

### 2.5 session-types 查询接口 (API) ⭐

**Controller**: `SessionTypesController`  
**路径**: `src/api/controllers/services/session-types.controller.ts`

**核心接口**:

| 方法 | 路径 | 参数 | 返回值 | 说明 |
|:---|:---|:---|:---|:---|
| `GET` | `/api/services/session-types` | `code?: string` | `SessionTypeDto[]` | 获取会话类型列表 ⭐ |
| `GET` | `/api/services/session-types/:id` | `id: UUID` | `SessionTypeDto` | 获取单个会话类型详情 |

**查询参数**:
```typescript
interface GetSessionTypesDto {
  code?: 'External' | 'Internal';  // 按业务分类筛选
}
```

**响应示例**:
```typescript
// GET /api/services/session-types?code=External
[
  {
    id: 'uuid-1',
    code: 'External',
    name: 'Regular Mentoring',
    template_id: 'tpl-001',
    is_billing: true
  },
  {
    id: 'uuid-2',
    code: 'External',
    name: 'Gap Analysis',
    template_id: 'tpl-002',
    is_billing: true
  }
]
```

**使用场景**:
1. **约课前查询**：顾问在创建 Session 前，先查询可选的会话类型
2. **下拉列表**：前端根据 `code` 字段分组展示（外部导师课 vs 内部导师课）
3. **类型验证**：创建 Session 时验证 `session_type_id` 的有效性

---

## 🛠️ 3. 核心 Services 设计

### 3.1 RegularMentoringService

**文件**: `src/domains/services/sessions/regular-mentoring/services/regular-mentoring.service.ts`

**核心方法**:

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `createSession(dto)` | `CreateRegularMentoringDto` | `Promise<RegularMentoringEntity>` | **事务内操作**。<br>接收 App 层传入的 `meetingId`，创建业务记录。<br>Initial Status: `scheduled`。 |
| `updateSession(id, dto)` | `id, UpdateRegularMentoringDto` | `Promise<RegularMentoringEntity>` | **改期/修改信息**。<br>支持修改 title、description、scheduled_at 等字段。<br>如果涉及时间修改，需同步更新 Calendar。 |
| `cancelSession(id, reason)` | `sessionId, reason` | `Promise<void>` | **业务取消操作**。<br>1. 更新 status = `cancelled`<br>2. 设置 cancelled_at<br>3. 同步更新 Calendar 状态<br>4. 调用 Core/Meeting 取消会议。 |
| `deleteSession(id)` | `sessionId` | `Promise<void>` | **软删除操作** ⭐。<br>1. 更新 status = `deleted`<br>2. 设置 deleted_at。 |
| `completeSession(sessionId, payload)` | `sessionId, MeetingLifecycleCompletedPayload` | `Promise<void>` | **事件驱动**（监听器调用）⭐。<br>1. 更新 status = `completed`<br>2. 设置 completed_at<br>3. 登记服务：INSERT service_references（共享主键）<br>4. 发布 SessionCompletedEvent<br>**注意：不需要同步更新 Calendar（通过事件通知）**。 |
| `findByMeetingId(meetingId)` | `UUID` | `Promise<RegularMentoringEntity \| null>` | **查询方法**。<br>根据 meeting_id 查找会话（用于事件监听器）。 |
| `getSessionById(id)` | `UUID` | `Promise<RegularMentoringEntity>` | **查询方法**。<br>获取会话详情（权威数据源）。 |

**依赖注入**:
- `RegularMentoringRepository`
- `ServiceRegistryService` (登记服务)
- `CalendarService` (同步日历)
- `EventEmitter` (发布事件)

---

### 3.2 GapAnalysisService

**文件**: `src/domains/services/sessions/gap-analysis/services/gap-analysis.service.ts`

**核心方法**:

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `createSession(dto)` | `CreateGapAnalysisDto` | `Promise<GapAnalysisEntity>` | 创建 Gap 分析会话。<br>Initial Status: `scheduled`。 |
| `updateSession(id, dto)` | `id, UpdateGapAnalysisDto` | `Promise<GapAnalysisEntity>` | 更新会话信息。 |
| `cancelSession(id, reason)` | `sessionId, reason` | `Promise<void>` | 取消会话。<br>同步更新 Calendar 和 Meeting。 |
| `deleteSession(id)` | `sessionId` | `Promise<void>` | **软删除操作** ⭐。<br>1. 更新 status = `deleted`<br>2. 设置 deleted_at。 |
| `completeSession(sessionId, payload)` | `sessionId, MeetingLifecycleCompletedPayload` | `Promise<void>` | **事件驱动**（监听器调用）⭐。<br>1. 更新 status = `completed`<br>2. 设置 completed_at<br>3. 登记服务（service_type = 'gap_analysis'）<br>4. 发布 SessionCompletedEvent<br>**注意：不需要同步更新 Calendar（通过事件通知）**。 |
| `findByMeetingId(meetingId)` | `UUID` | `Promise<GapAnalysisEntity \| null>` | 根据 meeting_id 查找会话。 |

**依赖注入**:
- `GapAnalysisRepository`
- `ServiceRegistryService`
- `CalendarService`
- `EventEmitter`

---

### 3.3 AiCareerService

**文件**: `src/domains/services/sessions/ai-career/services/ai-career.service.ts`

**核心方法**:

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `createSession(dto)` | `CreateAiCareerDto` | `Promise<AiCareerEntity>` | 创建 AI 职业测评会话。<br>Initial Status: `scheduled`。 |
| `updateSession(id, dto)` | `id, UpdateAiCareerDto` | `Promise<AiCareerEntity>` | 更新会话信息。 |
| `cancelSession(id, reason)` | `sessionId, reason` | `Promise<void>` | 取消会话。<br>同步更新 Calendar 和 Meeting。 |
| `deleteSession(id)` | `sessionId` | `Promise<void>` | **软删除操作** ⭐。<br>1. 更新 status = `deleted`<br>2. 设置 deleted_at。 |
| `completeSession(sessionId, payload)` | `sessionId, MeetingLifecycleCompletedPayload` | `Promise<void>` | **事件驱动**（监听器调用）⭐。<br>1. 更新 status = `completed`<br>2. 设置 completed_at<br>3. 登记服务（service_type = 'ai_career'）<br>4. 发布 SessionCompletedEvent<br>**注意：不需要同步更新 Calendar（通过事件通知）**。 |
| `findByMeetingId(meetingId)` | `UUID` | `Promise<AiCareerEntity \| null>` | 根据 meeting_id 查找会话。 |

**依赖注入**:
- `AiCareerRepository`
- `ServiceRegistryService`
- `CalendarService`
- `EventEmitter`

---

## 📊 4. Query Services 设计 (CQRS)

### 4.1 RegularMentoringQueryService

**文件**: `src/domains/services/sessions/regular-mentoring/services/regular-mentoring-query.service.ts`

**职责**: 单模块查询（仅查询 regular_mentoring_sessions 表）

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `getMentorSessions(mentorId, filters)` | `UUID, SessionFiltersDto` | `Promise<RegularMentoringEntity[]>` | 获取导师的辅导课时列表。<br>支持分页、状态筛选、时间范围筛选。<br>**默认过滤 status != 'deleted'**。 |
| `getStudentSessions(studentId, filters)` | `UUID, SessionFiltersDto` | `Promise<RegularMentoringEntity[]>` | 获取学生的辅导课时列表。<br>**默认过滤 status != 'deleted'**。 |
| `getSessionById(id)` | `UUID` | `Promise<RegularMentoringEntity>` | 获取会话详情（含关联 meeting 信息）。<br>**包含已删除记录（管理员可见）**。 |
| `countSessions(filters)` | `SessionFiltersDto` | `Promise<number>` | 统计符合条件的会话数量。<br>**默认过滤 status != 'deleted'**。 |

**查询优化**:
- 使用复合索引 `(mentor_user_id, scheduled_at DESC)` 和 `(student_user_id, scheduled_at DESC)`
- 支持 LEFT JOIN meetings 表获取会议 URL
- 分页查询使用游标分页（性能更好）

---

### 4.2 GapAnalysisQueryService

**文件**: `src/domains/services/sessions/gap-analysis/services/gap-analysis-query.service.ts`

**职责**: 单模块查询（仅查询 gap_analysis_sessions 表）

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `getMentorSessions(mentorId, filters)` | `UUID, SessionFiltersDto` | `Promise<GapAnalysisEntity[]>` | 获取导师的 Gap 分析列表。<br>**默认过滤 status != 'deleted'**。 |
| `getStudentSessions(studentId, filters)` | `UUID, SessionFiltersDto` | `Promise<GapAnalysisEntity[]>` | 获取学生的 Gap 分析列表。<br>**默认过滤 status != 'deleted'**。 |
| `getSessionById(id)` | `UUID` | `Promise<GapAnalysisEntity>` | 获取会话详情。<br>**包含已删除记录（管理员可见）**。 |

---

### 4.3 AiCareerQueryService

**文件**: `src/domains/services/sessions/ai-career/services/ai-career-query.service.ts`

**职责**: 单模块查询（仅查询 ai_career_sessions 表）

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `getMentorSessions(mentorId, filters)` | `UUID, SessionFiltersDto` | `Promise<AiCareerEntity[]>` | 获取导师的 AI 职业测评列表。<br>**默认过滤 status != 'deleted'**。 |
| `getStudentSessions(studentId, filters)` | `UUID, SessionFiltersDto` | `Promise<AiCareerEntity[]>` | 获取学生的 AI 职业测评列表。<br>**默认过滤 status != 'deleted'**。 |
| `getSessionById(id)` | `UUID` | `Promise<AiCareerEntity>` | 获取会话详情。<br>**包含已删除记录（管理员可见）**。 |

---

## 🎧 5. 事件监听器 (Listeners)

### 5.1 RegularMentoringEventListener

**文件**: `src/domains/services/sessions/regular-mentoring/listeners/regular-mentoring-event.listener.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RegularMentoringService } from '../services/regular-mentoring.service';
import {
  MeetingLifecycleCompletedPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events';

/**
 * Regular Mentoring Event Listener
 *
 * 监听 Core Meeting 生命周期事件并更新常规辅导会话状态
 */
@Injectable()
export class RegularMentoringEventListener {
  private readonly logger = new Logger(RegularMentoringEventListener.name);

  constructor(
    private readonly regularMentoringService: RegularMentoringService
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
      // 1. 根据 meetingId (UUID) 查找属于 Regular Mentoring 域的记录
      // 这是最精准的查找方式，不存在重复问题
      const session = await this.regularMentoringService.findByMeetingId(
        payload.meetingId
      );

      if (session) {
        // 2. 找到了，说明这个会议是 Regular Mentoring Session
        this.logger.log(
          `Found regular mentoring session ${session.id} for meeting ${payload.meetingId}`
        );

        // 3. 完成会话（不需要同步更新 Calendar，通过事件通知）
        await this.regularMentoringService.completeSession(session.id, payload);

        this.logger.log(
          `Successfully completed regular mentoring session ${session.id}`
        );
      } else {
        // 4. 没找到？说明这个会议可能属于其他域，忽略即可
        this.logger.debug(
          `No regular mentoring session found for meeting ${payload.meetingId}, skipping`
        );
      }
    } catch (error) {
      // 记录错误但不抛出 - 避免破坏其他监听器
      this.logger.error(
        `Error handling meeting completion for meeting ${payload.meetingId}: ${error.message}`,
        error.stack
      );
    }
  }
}
```

**事件处理流程**:
1. 监听 `meeting.lifecycle.completed` 事件（由 Core/Meeting 发布）⭐
2. 根据 `payload.meetingId` 查找对应的 Session
3. 如果找到，调用 `completeSession(sessionId, payload)` 方法：
   - 更新状态为 `completed`
   - 设置 `completed_at`
   - 登记服务到 `service_references`（共享主键）
   - 发布 `SessionCompletedEvent`
   - **不需要同步更新 Calendar（通过事件通知）** ⭐

---

### 5.2 GapAnalysisEventListener

**文件**: `src/domains/services/sessions/gap-analysis/listeners/gap-analysis-event.listener.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GapAnalysisService } from '../services/gap-analysis.service';
import {
  MeetingLifecycleCompletedPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events';

/**
 * Gap Analysis Event Listener
 *
 * 监听 Core Meeting 生命周期事件并更新 Gap 分析会话状态
 */
@Injectable()
export class GapAnalysisEventListener {
  private readonly logger = new Logger(GapAnalysisEventListener.name);

  constructor(
    private readonly gapAnalysisService: GapAnalysisService
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
      const session = await this.gapAnalysisService.findByMeetingId(
        payload.meetingId
      );

      if (session) {
        this.logger.log(
          `Found gap analysis session ${session.id} for meeting ${payload.meetingId}`
        );

        await this.gapAnalysisService.completeSession(session.id, payload);

        this.logger.log(
          `Successfully completed gap analysis session ${session.id}`
        );
      } else {
        this.logger.debug(
          `No gap analysis session found for meeting ${payload.meetingId}, skipping`
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

---

### 5.3 AiCareerEventListener

**文件**: `src/domains/services/sessions/ai-career/listeners/ai-career-event.listener.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AiCareerService } from '../services/ai-career.service';
import {
  MeetingLifecycleCompletedPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events';

/**
 * AI Career Event Listener
 *
 * 监听 Core Meeting 生命周期事件并更新 AI 职业测评会话状态
 */
@Injectable()
export class AiCareerEventListener {
  private readonly logger = new Logger(AiCareerEventListener.name);

  constructor(
    private readonly aiCareerService: AiCareerService
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
      const session = await this.aiCareerService.findByMeetingId(
        payload.meetingId
      );

      if (session) {
        this.logger.log(
          `Found AI career session ${session.id} for meeting ${payload.meetingId}`
        );

        await this.aiCareerService.completeSession(session.id, payload);

        this.logger.log(
          `Successfully completed AI career session ${session.id}`
        );
      } else {
        this.logger.debug(
          `No AI career session found for meeting ${payload.meetingId}, skipping`
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

---

## 📋 6. DTO 定义

### 6.1 CreateRegularMentoringDto

**用途**: Application Layer 编排时使用。

| 字段 | 类型 | 必须 | 说明 |
| :--- | :--- | :--- | :--- |
| `meetingId` | UUID | 是 | **关联的核心会议ID** (由 Step 1 返回) |
| `sessionType` | String | 是 | 会话类型 Enum ⭐：`regular_mentoring`, `gap_analysis`, `ai_career`, `comm_session`, `class_session`，默认 `regular_mentoring` |
| `sessionTypeId` | UUID | 是 | 关联的会话类型配置 ID（session_types.id）⭐ |
| `studentUserId` | UUID | 是 | 学生 ID |
| `mentorUserId` | UUID | 是 | 导师 ID |
| `createdByCounselorId` | UUID | 否 | 创建该课时的顾问 ID |
| `title` | String | 是 | 课程标题 |
| `description` | String | 否 | 课程大纲/详细描述 |
| `scheduledAt` | Date | 是 | 预约开始时间 |

---

### 6.2 UpdateRegularMentoringDto

**用途**: 更新会话信息。

| 字段 | 类型 | 必须 | 说明 |
| :--- | :--- | :--- | :--- |
| `title` | String | 否 | 课程标题 |
| `description` | String | 否 | 课程描述 |
| `scheduledAt` | Date | 否 | 预约开始时间（改期） |

---

### 6.3 CreateGapAnalysisDto

**用途**: Application Layer 编排时使用。

| 字段 | 类型 | 必须 | 说明 |
| :--- | :--- | :--- | :--- |
| `meetingId` | UUID | 是 | **关联的核心会议ID** |
| `sessionType` | String | 是 | 会话类型 Enum ⭐：`regular_mentoring`, `gap_analysis`, `ai_career`, `comm_session`, `class_session`，默认 `gap_analysis` |
| `sessionTypeId` | UUID | 是 | 关联的会话类型配置 ID（session_types.id）⭐ |
| `studentUserId` | UUID | 是 | 学生 ID |
| `mentorUserId` | UUID | 是 | 导师 ID |
| `createdByCounselorId` | UUID | 否 | 创建该服务的顾问 ID |
| `title` | String | 是 | 服务标题 |
| `description` | String | 否 | 服务描述 |
| `scheduledAt` | Date | 是 | 预约开始时间 |

---

### 6.4 CreateAiCareerDto

**用途**: Application Layer 编排时使用。

| 字段 | 类型 | 必须 | 说明 |
| :--- | :--- | :--- | :--- |
| `meetingId` | UUID | 是 | **关联的核心会议ID** |
| `sessionType` | String | 是 | 会话类型 Enum ⭐：`regular_mentoring`, `gap_analysis`, `ai_career`, `comm_session`, `class_session`，默认 `ai_career` |
| `sessionTypeId` | UUID | 是 | 关联的会话类型配置 ID（session_types.id）⭐ |
| `studentUserId` | UUID | 是 | 学生 ID |
| `mentorUserId` | UUID | 是 | 导师 ID |
| `createdByCounselorId` | UUID | 否 | 创建该课时的顾问 ID |
| `title` | String | 是 | 课程标题 |
| `description` | String | 否 | 课程描述 |
| `scheduledAt` | Date | 是 | 预约开始时间 |

---

## 🗂️ 7. Service Registry 集成

### 7.1 模块概述与职责

**Service Registry** 是服务注册表模块，负责记录所有已完成的服务，为财务和合同模块提供统一的服务引用。

**职责定位**:
- ✅ 记录所有已完成的服务（Sessions 类 + 非 Sessions 类）
- ✅ 使用共享主键防止重复计费
- ✅ 为下游模块（Financial、Contract）提供统一数据源
- ✅ 发布 `services.session.completed` 事件通知下游

**与 Sessions 子域的关系**:
```
Sessions 完成 → 登记到 Service Registry → 发布事件 → Financial/Contract 消费
```

---

### 7.2 service_references 表设计

**职责**: 记录所有已完成的服务（Immutable，共享主键）

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | PK | - | 主键（来自 Sessions 子表的 ID，共享主键）⭐ |
| `service_type` | VARCHAR(50) | NOT NULL | - | 服务类型 Enum ⭐ |
| `student_user_id` | UUID | NOT NULL, FK (users.id) | - | 学生的用户 ID |
| `provider_user_id` | UUID | NOT NULL, FK (users.id) | - | 服务提供者的用户 ID |
| `consumed_units` | DECIMAL(10,2) | NOT NULL | - | 消耗的单位数量（如 1.5 小时、1 次）|
| `unit_type` | VARCHAR(20) | NOT NULL | - | 单位类型 Enum: `hour`, `count` |
| `completed_time` | TIMESTAMPTZ | NOT NULL | - | 服务完成时间 |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间（无 updated_at，因为不可变）|

**索引**:
- `idx_service_ref_type` (service_type)
- `idx_service_ref_student` (student_user_id, completed_time DESC)
- `idx_service_ref_provider` (provider_user_id, completed_time DESC)
- `idx_service_ref_completed_time` (completed_time)

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
))
CHECK (unit_type IN ('hour', 'count'))
CHECK (consumed_units > 0)
```

**核心特点**:
- **共享主键**: `id` 来自业务表（如 regular_mentoring_sessions.id）⭐
- **Immutable**: 只有 INSERT，无 UPDATE/DELETE
- **创建时机**: 仅在服务完成后创建
- **防重复计费**: 主键天然保证 1:1 关系（数据库级别）

**service_type 枚举说明**:
| service_type | 来源 | 说明 |
|:---|:---|:---|
| `regular_mentoring` | regular_mentoring_sessions | 常规辅导 |
| `gap_analysis` | gap_analysis_sessions | Gap 分析 |
| `ai_career` | ai_career_sessions | AI 职业测评 |
| `comm_session` | comm_sessions | 沟通课（暂不包含）|
| `class_session` | class_sessions | 班课（暂不包含）|
| `resume` | resume 表 | 简历服务 |
| `recommendation_letter` | recommendation_letter 表 | 推荐信服务 |

---

### 7.3 ServiceRegistryService 接口

**文件**: `src/domains/services/service-registry/services/service-registry.service.ts`

**核心方法**:

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `registerService(dto)` | `RegisterServiceDto` | `Promise<ServiceReferenceEntity>` | **登记服务**。<br>使用共享主键插入 service_references 表。<br>如果主键冲突则抛出异常（防重复计费）。|

**RegisterServiceDto**:

```typescript
interface RegisterServiceDto {
  id: string;                    // 共享主键（来自 Session ID）
  service_type: string;          // 服务类型（与 session_type 相同）
  student_user_id: string;       // 学生 ID
  provider_user_id: string;      // 服务提供者 ID
  consumed_units: number;        // 消耗单位
  unit_type: 'hour' | 'count';   // 单位类型
  completed_time: Date;          // 完成时间
}
```

---

### 7.4 调用示例与完整流程

**RegularMentoringService.completeSession() 完整实现**:

```typescript
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MeetingLifecycleCompletedPayload } from '@shared/events';
import { ServiceRegistryService } from '@domains/services/service-registry';

@Injectable()
export class RegularMentoringService {
  constructor(
    private readonly repository: RegularMentoringRepository,
    private readonly sessionTypesRepository: SessionTypesRepository,
    private readonly serviceRegistryService: ServiceRegistryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async completeSession(
    sessionId: string,
    payload: MeetingLifecycleCompletedPayload,
  ): Promise<void> {
    // 1. 查询 Session 信息
    const session = await this.repository.findOne(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }

    // 2. 查询 session_types 获取业务配置（code 和 is_billing）⭐
    const sessionType = await this.sessionTypesRepository.findOne(
      session.session_type_id,
    );
    if (!sessionType) {
      throw new SessionTypeNotFoundException(session.session_type_id);
    }
    // sessionType.code = 'External' or 'Internal'
    // sessionType.is_billing = true or false

    // 3. 更新 Session 状态
    await this.repository.update(sessionId, {
      status: 'completed',
      completed_at: new Date(),
    });

    // 4. 登记服务到 Service Registry（共享主键）⭐
    await this.serviceRegistryService.registerService({
      id: sessionId, // 共享主键
      service_type: session.session_type, // 使用 session_type
      student_user_id: session.student_user_id,
      provider_user_id: session.mentor_user_id,
      consumed_units: this.calculateUnits(payload.actualDuration),
      unit_type: 'hour',
      completed_time: payload.endedAt,
    });

    // 5. 发布 services.session.completed 事件 ⭐
    this.eventEmitter.emit(SERVICE_SESSION_COMPLETED_EVENT, {
      sessionId: sessionId,
      studentId: session.student_user_id,
      mentorId: session.mentor_user_id,
      refrenceId: sessionId, // 服务引用 ID（同 sessionId）
      sessionTypeCode: session.serviceType,
      actualDurationHours: payload.actualDuration / 3600, // 秒转小时
      durationHours: payload.scheduleDuration / 60, // 分钟转小时
      allowBilling: sessionType.is_billing, // 从 session_types 获取：true | false ⭐
    });
  }

  private calculateUnits(durationSeconds: number): number {
    // 将秒转换为小时，保留 2 位小数
    return Math.round((durationSeconds / 3600) * 100) / 100;
  }
}
```

---

### 7.5 事件发布：services.session.completed

**事件常量**: `SERVICE_SESSION_COMPLETED_EVENT = "services.session.completed"`

**事件 Payload**: `IServiceSessionCompletedPayload`

```typescript
interface IServiceSessionCompletedPayload {
  sessionId: string;           // 会话 ID（共享主键）
  studentId: string;           // 学生 ID
  mentorId: string;            // 导师 ID
  refrenceId: string;          // 服务引用 ID（同 sessionId）
  sessionTypeCode: string;     // 业务分类代码（从 session_types.code 获取）⭐
  actualDurationHours: number; // 实际时长（小时）
  durationHours: number;       // 预定时长（小时）
  allowBilling: boolean;       // 是否允许计费（从 session_types.is_billing 获取）⭐
}
```

**字段来源说明**:

| 字段 | 来源 | 转换逻辑 |
|:---|:---|:---|
| `sessionId` | Session 主键 | 直接使用 |
| `studentId` | session.student_user_id | 直接使用 |
| `mentorId` | session.mentor_user_id | 直接使用 |
| `refrenceId` | sessionId | 同 sessionId（共享主键）|
| `sessionTypeCode` | session_types.code | **通过 session.session_type_id 查询获取**（`External` / `Internal`）⭐ |
| `actualDurationHours` | payload.actualDuration | 秒 → 小时（/ 3600）|
| `durationHours` | payload.scheduleDuration | 分钟 → 小时（/ 60）|
| `allowBilling` | session_types.is_billing | **通过 session.session_type_id 查询获取**（`true` / `false`）⭐ |

**下游消费者**:
- **Financial 模块**: 监听此事件，创建财务记录（如果 `allowBilling = true`）
- **Contract 模块**: 监听此事件，扣减合同课时

---

### 7.6 防重复计费机制

**多层防护**:

1. **数据库主键约束**（最强保证）⭐
   ```sql
   -- service_references.id 是主键
   -- 重复 INSERT 会抛出主键冲突异常
   INSERT INTO service_references (id, ...) VALUES (sessionId, ...);
   ```

2. **应用层检查**（可选）
   ```typescript
   // 在 registerService() 中
   const existing = await this.repository.findById(dto.id);
   if (existing) {
     throw new DuplicateServiceRegistrationException(dto.id);
   }
   ```

3. **幂等性保证**
   - 即使 `completeSession()` 被多次调用
   - 第二次调用会因为主键冲突而失败
   - 保证一个 Session 只能登记一次服务

4. **事务边界**
   ```typescript
   @Transactional()
   async completeSession(...) {
     // 1. 更新 Session 状态
     // 2. 登记服务（如果失败，整个事务回滚）
     // 3. 发布事件
   }
   ```

---

### 7.7 完整数据流图

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Meeting 完成 (Core Layer)                                     │
│    - MeetingLifecycleCompletedEvent                             │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Session Listener (Domain Layer)                              │
│    - RegularMentoringEventListener.handleMeetingCompletion()   │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Session Service (Domain Layer)                               │
│    - completeSession(sessionId, payload)                        │
│    - 查询 session_types 表获取 code 和 is_billing               │
│    - 更新 Session 状态为 completed                               │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Service Registry (Domain Layer)                              │
│    - registerService(dto) - 使用共享主键                        │
│    - INSERT service_references                                  │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. 发布事件 (Domain Layer)                                      │
│    - services.session.completed                                 │
│    - Payload 包含 sessionTypeCode 和 allowBilling               │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. 下游消费 (Financial & Contract Layers)                       │
│    - Financial: 创建财务记录（如果 allowBilling = true）        │
│    - Contract: 扣减合同课时                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📡 8. 事件常量与类型定义

### 8.1 事件导入说明 ⭐

所有监听器必须从 `@shared/events` 导入事件常量和 Payload 类型：

```typescript
import {
  MeetingLifecycleCompletedPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events';
```

**事件常量定义位置**: `src/shared/events/event-constants.ts`

```typescript
// Meeting Events (会议事件) - v4.1
export const MEETING_LIFECYCLE_COMPLETED_EVENT = "meeting.lifecycle.completed";
export const MEETING_RECORDING_READY_EVENT = "meeting.recording.ready";
```

---

### 8.2 MeetingLifecycleCompletedPayload 类型

**定义位置**: `src/shared/events/meeting-lifecycle-completed.event.ts`

```typescript
export interface MeetingLifecycleCompletedPayload {
  // Identity
  meetingId: string;        // UUID - 主键（用于 FK 查找）
  meetingNo: string;        // 会议号（飞书 9 位数字）
  
  // Provider info
  provider: string;         // 'feishu' | 'zoom'
  
  // Status
  status: 'ended';          // 固定值
  
  // Schedule info
  scheduleStartTime: Date;  // 预定开始时间
  scheduleDuration: number; // 预定时长（分钟）
  
  // Actual execution info
  actualDuration: number;   // 实际时长（秒）⭐
  endedAt: Date;           // 最终完成时间戳
  timeList: MeetingTimeSegment[]; // 时间片段列表（支持断线重连）
  
  // Recording (optional)
  recordingUrl: string | null; // 录制链接（如果有）
}
```

---

### 8.3 监听器实现模板

**标准监听器结构**:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { YourService } from '../services/your.service';
import {
  MeetingLifecycleCompletedPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events';

@Injectable()
export class YourEventListener {
  private readonly logger = new Logger(YourEventListener.name);

  constructor(private readonly yourService: YourService) {}

  @OnEvent(MEETING_LIFECYCLE_COMPLETED_EVENT)
  async handleMeetingCompletion(
    payload: MeetingLifecycleCompletedPayload
  ): Promise<void> {
    this.logger.log(
      `Received meeting.lifecycle.completed event for meeting ${payload.meetingId}`
    );

    try {
      const session = await this.yourService.findByMeetingId(payload.meetingId);

      if (session) {
        await this.yourService.completeSession(session.id, payload);
        this.logger.log(`Successfully completed session ${session.id}`);
      } else {
        this.logger.debug(
          `No session found for meeting ${payload.meetingId}, skipping`
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling meeting completion: ${error.message}`,
        error.stack
      );
    }
  }
}
```

---

## 🎯 9. 实现检查清单

### 9.1 Regular Mentoring 模块

- [ ] 创建 Entity: `RegularMentoringSessionEntity`
- [ ] 创建 Repository: `RegularMentoringRepository`
- [ ] 实现 Service: `RegularMentoringService` (写操作)
  - [ ] `createSession()` - 创建会话
  - [ ] `updateSession()` - 更新会话
  - [ ] `cancelSession()` - 取消会话
  - [ ] `deleteSession()` - 软删除会话 ⭐
  - [ ] `completeSession()` - 完成会话（事件驱动）
  - [ ] `findByMeetingId()` - 根据 meeting_id 查找
- [ ] 实现 Query Service: `RegularMentoringQueryService` (读操作)
  - [ ] 查询默认过滤 `status != 'deleted'` ⭐
- [ ] 实现 Event Listener: `RegularMentoringEventListener`
  - [ ] 监听 `MEETING_LIFECYCLE_COMPLETED_EVENT` ⭐
  - [ ] 导入 `MeetingLifecycleCompletedPayload` 和 `MEETING_LIFECYCLE_COMPLETED_EVENT` from `@shared/events` ⭐
- [ ] 创建 DTOs: `CreateRegularMentoringDto`, `UpdateRegularMentoringDto`
  - [ ] `sessionType` 字段使用统一 Enum ⭐
- [ ] 数据库迁移
  - [ ] 创建 `session_types` 表 ⭐
  - [ ] 插入 session_types 初始数据（Internal, External等）⭐
  - [ ] 添加 `session_type` 字段（统一 Enum）⭐
  - [ ] 添加 `session_type_id` 字段（FK → session_types.id）⭐
  - [ ] 添加 `deleted_at` 字段 ⭐
  - [ ] 更新 `status` CHECK 约束（包含 `deleted`）⭐
  - [ ] 添加索引: mentor_user_id, student_user_id, status, session_type, session_type_id
- [ ] 实现状态机: scheduled → completed / cancelled / deleted ⭐
- [ ] 集成 Service Registry (完成后登记，共享主键)
- [ ] 发布事件: `SessionCompletedEvent`（Calendar 监听）⭐

---

### 9.2 Gap Analysis 模块

- [ ] 创建 Entity: `GapAnalysisSessionEntity`
- [ ] 创建 Repository: `GapAnalysisRepository`
- [ ] 实现 Service: `GapAnalysisService`
  - [ ] `createSession()` - 创建会话
  - [ ] `updateSession()` - 更新会话
  - [ ] `cancelSession()` - 取消会话
  - [ ] `deleteSession()` - 软删除会话 ⭐
  - [ ] `completeSession()` - 完成会话（事件驱动）
  - [ ] `findByMeetingId()` - 根据 meeting_id 查找
- [ ] 实现 Query Service: `GapAnalysisQueryService`
  - [ ] 查询默认过滤 `status != 'deleted'` ⭐
- [ ] 实现 Event Listener: `GapAnalysisEventListener`
  - [ ] 监听 `MEETING_LIFECYCLE_COMPLETED_EVENT` ⭐
  - [ ] 导入 `MeetingLifecycleCompletedPayload` 和 `MEETING_LIFECYCLE_COMPLETED_EVENT` from `@shared/events` ⭐
- [ ] 创建 DTOs: `CreateGapAnalysisDto`, `UpdateGapAnalysisDto`
  - [ ] `sessionType` 字段使用统一 Enum ⭐
  - [ ] 删除不需要的字段（current_level, target_level, gap_areas, action_plan）⭐
- [ ] 数据库迁移
  - [ ] 添加 `session_type` 字段（统一 Enum）⭐
  - [ ] 添加 `description` 字段
  - [ ] 添加 `ai_summaries` 字段 ⭐
  - [ ] 添加 `deleted_at` 字段 ⭐
  - [ ] 更新 `status` CHECK 约束（包含 `deleted`）⭐
  - [ ] 删除不需要的字段 ⭐
- [ ] 集成 Service Registry (service_type = 'gap_analysis')
- [ ] 发布事件: `SessionCompletedEvent`（Calendar 监听）⭐

---

### 9.3 AI Career 模块

- [ ] 创建 Entity: `AiCareerSessionEntity`
- [ ] 创建 Repository: `AiCareerRepository`
- [ ] 实现 Service: `AiCareerService`
  - [ ] `createSession()` - 创建会话
  - [ ] `updateSession()` - 更新会话
  - [ ] `cancelSession()` - 取消会话
  - [ ] `deleteSession()` - 软删除会话 ⭐
  - [ ] `completeSession()` - 完成会话（事件驱动）
  - [ ] `findByMeetingId()` - 根据 meeting_id 查找
- [ ] 实现 Query Service: `AiCareerQueryService`
  - [ ] 查询默认过滤 `status != 'deleted'` ⭐
- [ ] 实现 Event Listener: `AiCareerEventListener`
  - [ ] 监听 `MEETING_LIFECYCLE_COMPLETED_EVENT` ⭐
  - [ ] 导入 `MeetingLifecycleCompletedPayload` 和 `MEETING_LIFECYCLE_COMPLETED_EVENT` from `@shared/events` ⭐
- [ ] 创建 DTOs: `CreateAiCareerDto`, `UpdateAiCareerDto`
  - [ ] `sessionType` 字段使用统一 Enum ⭐
  - [ ] 删除不需要的字段（ai_topics）⭐
- [ ] 数据库迁移
  - [ ] 添加 `session_type` 字段（统一 Enum）⭐
  - [ ] 添加 `ai_summaries` 字段 ⭐
  - [ ] 添加 `deleted_at` 字段 ⭐
  - [ ] 更新 `status` CHECK 约束（包含 `deleted`）⭐
  - [ ] 删除不需要的字段（ai_topics）⭐
- [ ] 集成 Service Registry (service_type = 'ai_career')
- [ ] 发布事件: `SessionCompletedEvent`（Calendar 监听）⭐

---

### 9.4 Session Types 配置模块 ⭐

**模块定位**: 独立的配置查询服务，与 sessions 平级

- [ ] 创建 Entity: `SessionTypeEntity`
- [ ] 创建 Repository: `SessionTypesRepository`
- [ ] 实现 Service: `SessionTypesService`
  - [ ] `findOne(id)` - 根据 ID 查找
  - [ ] `findByCode(code)` - 根据 code 查找（用于 completeSession）⭐
  - [ ] `findAll()` - 获取所有配置
- [ ] 实现 Query Service: `SessionTypesQueryService` ⭐
  - [ ] `getSessionTypes(filters)` - 获取会话类型列表（支持 code 筛选）
  - [ ] `getSessionTypeById(id)` - 获取单个详情
- [ ] 实现 API 层
  - [ ] Controller: `SessionTypesController` ⭐
  - [ ] `GET /api/services/session-types?code=External` - 获取列表
  - [ ] `GET /api/services/session-types/:id` - 获取详情
- [ ] 实现 Application 层
  - [ ] Query: `GetSessionTypesQuery` ⭐
  - [ ] DTO: `GetSessionTypesDto`
- [ ] 数据库迁移
  - [ ] 创建 session_types 表
  - [ ] 插入初始数据 ⭐
    ```sql
    -- 外部导师课
    INSERT INTO session_types (code, name, template_id, is_billing) VALUES
      ('External', 'Regular Mentoring', 'tpl-001', TRUE),
      ('External', 'Gap Analysis', 'tpl-002', TRUE);
    
    -- 内部导师课
    INSERT INTO session_types (code, name, template_id, is_billing) VALUES
      ('Internal', 'AI Career', 'tpl-003', FALSE),
      ('Internal', 'Internal Communication', 'tpl-004', FALSE);
    ```
  - [ ] 添加索引 (code, name)

---

### 9.5 共享资源

- [ ] 定义 `SessionBaseInterface` (共享接口)
- [ ] 定义 `SessionFiltersDto` (查询过滤 DTO)
  - [ ] 包含 `excludeDeleted` 选项（默认 true）⭐
- [ ] 定义 `SessionCompletedEvent` (领域事件)
  - [ ] 包含 `sessionId`, `sessionType`, `studentUserId`, `scheduledAt` ⭐
- [ ] 定义自定义异常
  - [ ] `SessionNotFoundException`
  - [ ] `SessionTypeNotFoundException` ⭐
- [ ] 定义统一的 `SessionType` Enum ⭐
  ```typescript
  export enum SessionType {
    REGULAR_MENTORING = 'regular_mentoring',
    GAP_ANALYSIS = 'gap_analysis',
    AI_CAREER = 'ai_career',
    COMM_SESSION = 'comm_session',
    CLASS_SESSION = 'class_session',
  }
  ```

---

## 📚 10. 数据库迁移步骤

**迁移顺序**:
1. 创建 session_types 表（会话类型配置）⭐
2. 创建 meetings 表（Core 层）
3. 创建 regular_mentoring_sessions 表（包含 session_type_id FK）⭐
4. 创建 gap_analysis_sessions 表（包含 session_type_id FK）⭐
5. 创建 ai_career_sessions 表（包含 session_type_id FK）⭐
6. 创建 service_references 表（Service Registry）
7. 创建 calendar 表（Read Model）
8. 添加外键约束
9. 添加索引
10. 添加 CHECK 约束
11. 插入 session_types 初始数据（Internal, External 等）⭐

---

**设计总结**: 

Sessions 子域专注于**课时类服务的业务管理**，通过聚合根管理业务状态，并通过事件驱动实现与 Core 层的松耦合协作。每个 Session 类型都有独立的表和服务，确保业务逻辑清晰、可扩展。

**核心设计模式**:
- ✅ **CQRS** (Command Query Responsibility Segregation)
- ✅ **Event-Driven Architecture** (事件驱动架构)
- ✅ **Shared Primary Key** (共享主键)
- ✅ **Table-per-Type** (每类型一表)
- ✅ **Domain Events** (领域事件)

**设计哲学**:
> "职责清晰胜过巧妙抽象，事件驱动实现松耦合，共享主键防止重复计费"

