# Services Class Session Domain 设计文档 v4.0

**文档版本**: v4.0  
**更新日期**: 2025-12-01  
**模块路径**: `src/domains/services/class-sessions`  
**定位**: 业务领域层 (Domain Layer) - Class Sessions 子域，负责班课类服务的业务逻辑实现，通过聚合根管理业务状态，并响应 Core 层的会议生命周期事件。  
**依赖关系**: 依赖 `src/core/meeting` (仅通过 ID 引用和事件订阅)，依赖 `src/domains/services/service-registry` (服务完成后登记)，被 `src/application` 层调用。

**核心特性** ⭐:
1. **班课管理**: 支持创建班级（classes），管理导师、学生、顾问列表
2. **1:N 教学模式**: 一位导师同时给多位学生上课
3. **两种班课类型**: `session`（消耗合同课时）和 `enroll`（公共班课）
4. **课时组合**: 每个班级包含若干节 `class_sessions` 课时
5. **导师定价**: 支持为每个班级的不同导师设置单独价格
6. **独立状态管理**: 班级状态（Active/Inactive）与课时状态（scheduled/completed/cancelled/deleted）独立管理
7. **完整 Service Registry 集成**: 课时完成后登记服务，触发导师费用计算

---

## 📂 1. 目录结构

```text
src/
├── api/                                      # API 层
│   └── controllers/
│       └── services/
│           ├── classes.controller.ts         # 班级管理 API ⭐
│           └── class-sessions.controller.ts  # 班课课时 API ⭐
│
├── application/                              # 应用层
│   ├── commands/
│   │   └── services/
│   │       ├── create-class.command.ts       # 创建班级命令 ⭐
│   │       └── create-class-session.command.ts # 创建课时命令 ⭐
│   └── queries/
│       └── services/
│           ├── get-classes.query.ts          # 获取班级查询 ⭐
│           └── get-class-sessions.query.ts   # 获取课时查询 ⭐
│
└── domains/                                  # 领域层
    └── services/
        ├── class-sessions/                   # 【班课子域】业务聚合根 ⭐
        │   ├── classes/                      # 【班级管理】⭐
        │   │   ├── entities/
        │   │   │   ├── class.entity.ts
        │   │   │   ├── class-mentor-price.entity.ts
        │   │   │   ├── class-student.entity.ts
        │   │   │   └── class-counselor.entity.ts
        │   │   ├── services/
        │   │   │   ├── class.service.ts
        │   │   │   └── class-query.service.ts
        │   │   ├── dto/
        │   │   │   ├── create-class.dto.ts
        │   │   │   └── update-class.dto.ts
        │   │   └── class.repository.ts
        │   │
        │   ├── sessions/                     # 【班课课时】⭐
        │   │   ├── entities/
        │   │   │   └── class-session.entity.ts
        │   │   ├── services/
        │   │   │   ├── class-session.service.ts
        │   │   │   └── class-session-query.service.ts
        │   │   ├── listeners/
        │   │   │   └── class-session-event.listener.ts
        │   │   ├── dto/
        │   │   │   ├── create-class-session.dto.ts
        │   │   │   └── update-class-session.dto.ts
        │   │   └── class-session.repository.ts
        │   │
        │   └── shared/                       # 【共享资源】
        │       ├── interfaces/
        │       │   └── class-session-base.interface.ts
        │       └── exceptions/
        │           ├── class-not-found.exception.ts
        │           └── class-session-not-found.exception.ts
        │
        └── service-registry/                 # 【服务注册表】
            ├── entities/
            │   └── service-reference.entity.ts
            ├── services/
            │   └── service-registry.service.ts
            └── service-reference.repository.ts
```

---

## 💾 2. 数据库设计

**设计原则**: 
- 班级（classes）和课时（class_sessions）分层管理
- 所有课时都通过 `meeting_id` (FK) 关联到 Core 层的 `meetings` 表（1:1 关系）
- 使用关联表管理多对多关系（导师、学生、顾问）
- **状态独立**: 班级状态与课时状态独立管理
- **1:N 教学**: 一节课时一个导师，但可以有多个学生

---

### 2.1 classes 表 (班级主表)

**职责**: 管理班课的基本信息和生命周期

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | PK | uuid_generate_v4() | 主键 |
| `name` | VARCHAR(255) | NOT NULL | - | 班级名称 |
| `type` | VARCHAR(20) | NOT NULL | - | 班课类型 Enum: `session`, `enroll` ⭐ |
| `status` | VARCHAR(20) | NOT NULL | `Active` | 班级状态 Enum: `Active`, `Inactive` ⭐ |
| `start_date` | TIMESTAMPTZ | NOT NULL | - | 班级开始时间 |
| `end_date` | TIMESTAMPTZ | NOT NULL | - | 班级结束时间 |
| `description` | TEXT | | - | 班课简介 |
| `total_sessions` | INTEGER | NOT NULL | 0 | 总课时数 |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**索引**:
- `idx_class_type` (type)
- `idx_class_status` (status)
- `idx_class_start_date` (start_date DESC)

**CHECK 约束**:
```sql
CHECK (type IN ('session', 'enroll'))
CHECK (status IN ('Active', 'Inactive'))
CHECK (end_date > start_date)
CHECK (total_sessions >= 0)
```

**班课类型说明** ⭐:

| type | 含义 | 计费规则 |
|:---|:---|:---|
| `session` | 合同班课 | 需要学生合同包含班课类型的课时数，完成后扣减合同课时 |
| `enroll` | 公共班课 | 所有学生都可以参与，不消耗合同课时 |

**核心职责**:
- ✅ 管理班级基本信息（名称、时间、描述）
- ✅ 管理班级状态（Active/Inactive）
- ✅ 记录总课时数
- ✅ 区分班课类型（session vs enroll）

**不承担的职责**:
- ❌ 不管理具体课时安排（由 class_sessions 表管理）
- ❌ 不管理会议技术细节（由 Core/Meeting 管理）

---

### 2.2 class_mentors_prices 表 (班级导师及价格)

**职责**: 管理班级的导师列表及每位导师的课时单价

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | PK | uuid_generate_v4() | 主键 |
| `class_id` | UUID | NOT NULL, FK (classes.id) | - | 关联的班级 ID |
| `mentor_user_id` | UUID | NOT NULL, FK (users.id) | - | 导师的用户 ID |
| `price_per_session` | DECIMAL(10,2) | NOT NULL | - | 每课时价格 |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**索引**:
- `idx_class_mentors_class` (class_id)
- `idx_class_mentors_mentor` (mentor_user_id)
- `unique_class_mentor` (class_id, mentor_user_id) UNIQUE ⭐

**CHECK 约束**:
```sql
CHECK (price_per_session >= 0)
```

**核心职责**:
- ✅ 记录班级的导师池（一个班级可以有多位导师）
- ✅ 为每位导师设置独立的课时单价
- ✅ 创建 class_session 时从此表选择导师
- ✅ 课时完成后根据导师价格计算费用

**业务规则**:
- 一个班级可以有多位导师（1:N）
- 同一导师在同一班级只能有一条价格记录（UNIQUE 约束）
- 创建课时时，必须选择该班级已注册的导师

---

### 2.3 class_students 表 (班级学生列表)

**职责**: 管理班级的学生名单

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | PK | uuid_generate_v4() | 主键 |
| `class_id` | UUID | NOT NULL, FK (classes.id) | - | 关联的班级 ID |
| `student_user_id` | UUID | NOT NULL, FK (users.id) | - | 学生的用户 ID |
| `enrolled_at` | TIMESTAMPTZ | NOT NULL | NOW() | 加入班级时间 |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |

**索引**:
- `idx_class_students_class` (class_id)
- `idx_class_students_student` (student_user_id)
- `unique_class_student` (class_id, student_user_id) UNIQUE ⭐

**核心职责**:
- ✅ 记录班级的固定学生名单
- ✅ 创建 class_session 时，自动继承该班级的所有学生
- ✅ 支持动态添加/移除学生

**业务规则**:
- 一个班级可以有多位学生（1:N）
- 同一学生在同一班级只能注册一次（UNIQUE 约束）
- 学生列表由顾问在创建班级时添加

**说明** ⭐:
- 创建 `class_session` 时，**不需要再次指定学生列表**
- 学生列表由 `class_students` 表统一管理
- 查询某节课时的学生列表：通过 `class_id` 关联查询 `class_students` 表

---

### 2.4 class_counselors 表 (班级顾问列表)

**职责**: 管理班级的顾问列表

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | PK | uuid_generate_v4() | 主键 |
| `class_id` | UUID | NOT NULL, FK (classes.id) | - | 关联的班级 ID |
| `counselor_user_id` | UUID | NOT NULL, FK (users.id) | - | 顾问的用户 ID |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |

**索引**:
- `idx_class_counselors_class` (class_id)
- `idx_class_counselors_counselor` (counselor_user_id)
- `unique_class_counselor` (class_id, counselor_user_id) UNIQUE ⭐

**核心职责**:
- ✅ 记录班级的负责顾问列表
- ✅ 支持多位顾问共同管理一个班级

**业务规则**:
- 一个班级可以有多位顾问（1:N）
- 同一顾问在同一班级只能注册一次（UNIQUE 约束）

---

### 2.5 class_sessions 表 (班课课时)

**职责**: 管理班课的具体课时安排和生命周期

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | PK | uuid_generate_v4() | 主键 |
| `class_id` | UUID | NOT NULL, FK (classes.id) | - | 关联的班级 ID ⭐ |
| `meeting_id` | UUID | FK (meetings.id), UNIQUE | - | 关联的会议 ID（1:1 关系）⭐ |
| `session_type` | VARCHAR(50) | NOT NULL | `class_session` | 会话类型（固定值）⭐ |
| `mentor_user_id` | UUID | NOT NULL, FK (users.id) | - | 本节课的导师 ID（单个导师）⭐ |
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
- `idx_class_session_class` (class_id) ⭐
- `idx_class_session_meeting` (meeting_id)
- `idx_class_session_mentor` (mentor_user_id)
- `idx_class_session_status` (status)
- `idx_class_session_scheduled` (scheduled_at DESC)

**CHECK 约束**:
```sql
CHECK (status IN ('scheduled', 'completed', 'cancelled', 'deleted'))
CHECK (session_type = 'class_session')
```

**外键约束** ⭐:
```sql
-- 导师必须是该班级已注册的导师之一
FOREIGN KEY (class_id, mentor_user_id) 
  REFERENCES class_mentors_prices(class_id, mentor_user_id)
```

**核心职责**:
- ✅ 存储课时的基本信息（标题、描述、时间）
- ✅ 管理课时生命周期（scheduled → completed/cancelled/deleted）
- ✅ 关联班级（class_id）和会议（meeting_id）
- ✅ 指定单个导师（从 class_mentors_prices 表选择）
- ✅ 监听 `MeetingLifecycleCompletedEvent`，更新状态为 completed
- ✅ 触发计费：直接 INSERT service_references（共享主键）

**不承担的职责**:
- ❌ 不管理学生列表（由 class_students 表统一管理）
- ❌ 不管理会议技术细节（meeting_no、meeting_url 等）
- ❌ 不处理 Webhook 事件（由 Core/Meeting 处理）

**字段说明** ⭐:

| 字段 | 说明 |
|:---|:---|
| `class_id` | **必须字段**，关联到所属班级，用于查询班级信息和学生列表 |
| `meeting_id` | **必须字段**，关联到会议，保持与其他 session 类型的架构一致性 |
| `session_type` | **固定值** `class_session`，用于区分课时类型 |
| `mentor_user_id` | **单个导师**，必须是该班级已注册的导师（外键约束） |

**学生列表获取方式** ⭐:
```sql
-- 查询某节课时的学生列表
SELECT cs.student_user_id, u.name
FROM class_students cs
JOIN users u ON cs.student_user_id = u.id
WHERE cs.class_id = (
  SELECT class_id FROM class_sessions WHERE id = :session_id
);
```

---

## 🛠️ 3. 核心 Services 设计

### 3.1 ClassService (班级管理服务)

**文件**: `src/domains/services/class-sessions/classes/services/class.service.ts`

**核心方法**:

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `createClass(dto)` | `CreateClassDto` | `Promise<ClassEntity>` | **创建班级**。<br>创建 classes 记录，Initial Status: `Active`。 |
| `updateClass(id, dto)` | `id, UpdateClassDto` | `Promise<ClassEntity>` | **更新班级信息**。<br>支持修改 name、description、start_date、end_date、total_sessions 等字段。 |
| `updateClassStatus(id, status)` | `classId, status` | `Promise<void>` | **更新班级状态**。<br>状态: `Active` ↔ `Inactive`。<br>**注意：不影响已创建的课时状态**。 |
| `addMentor(classId, mentorId, price)` | `classId, mentorId, price` | `Promise<void>` | **添加导师**。<br>插入 class_mentors_prices 表。 |
| `removeMentor(classId, mentorId)` | `classId, mentorId` | `Promise<void>` | **移除导师**。<br>删除 class_mentors_prices 记录。<br>**校验：该导师不能有未完成的课时**。 |
| `updateMentorPrice(classId, mentorId, price)` | `classId, mentorId, price` | `Promise<void>` | **更新导师价格**。<br>更新 class_mentors_prices 表。 |
| `addStudent(classId, studentId)` | `classId, studentId` | `Promise<void>` | **添加学生**。<br>插入 class_students 表。 |
| `removeStudent(classId, studentId)` | `classId, studentId` | `Promise<void>` | **移除学生**。<br>删除 class_students 记录。 |
| `addCounselor(classId, counselorId)` | `classId, counselorId` | `Promise<void>` | **添加顾问**。<br>插入 class_counselors 表。 |
| `removeCounselor(classId, counselorId)` | `classId, counselorId` | `Promise<void>` | **移除顾问**。<br>删除 class_counselors 记录。 |
| `getClassById(id)` | `UUID` | `Promise<ClassEntity>` | **获取班级详情**。<br>包含导师列表、学生列表、顾问列表。 |

**依赖注入**:
- `ClassRepository`
- `EventEmitter` (发布事件)

---

### 3.2 ClassSessionService (班课课时服务)

**文件**: `src/domains/services/class-sessions/sessions/services/class-session.service.ts`

**核心方法**:

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `createSession(dto)` | `CreateClassSessionDto` | `Promise<ClassSessionEntity>` | **创建课时**。<br>1. 接收 App 层传入的 `meetingId`<br>2. 验证 `classId` 有效性<br>3. 创建 class_sessions 记录<br>Initial Status: `scheduled`。 |
| `updateSession(id, dto)` | `id, UpdateClassSessionDto` | `Promise<ClassSessionEntity>` | **更新课时信息**。<br>支持修改 title、description、scheduled_at、mentor_user_id 等字段。 |
| `cancelSession(id, reason)` | `sessionId, reason` | `Promise<void>` | **取消课时**。<br>1. 更新 status = `cancelled`<br>2. 设置 cancelled_at<br>**注意：Calendar 更新和 Meeting 取消由 Application 层编排**。 |
| `deleteSession(id)` | `sessionId` | `Promise<void>` | **软删除课时**。<br>1. 更新 status = `deleted`<br>2. 设置 deleted_at。 |
| `completeSession(sessionId, payload)` | `sessionId, MeetingLifecycleCompletedPayload` | `Promise<void>` | **事件驱动**（监听器调用）⭐。<br>1. 更新 status = `completed`<br>2. 设置 completed_at<br>3. 登记服务：INSERT service_references（共享主键，service_type='class_session'）<br>4. 发布 SessionCompletedEvent<br>**注意：不需要同步更新 Calendar（通过事件通知）**。 |
| `findByMeetingId(meetingId)` | `UUID` | `Promise<ClassSessionEntity \| null>` | **查询方法**。<br>根据 meeting_id 查找课时（用于事件监听器）。 |
| `getSessionById(id)` | `UUID` | `Promise<ClassSessionEntity>` | **获取课时详情**。<br>包含班级信息、导师信息、学生列表。 |
| `getSessionsByClass(classId, filters)` | `classId, filters` | `Promise<ClassSessionEntity[]>` | **获取班级的所有课时**。<br>支持分页、状态筛选、时间范围筛选。 |

**依赖注入**:
- `ClassSessionRepository`
- `ClassRepository` (验证 classId)
- `ServiceRegistryService` (登记服务)
- `CalendarService` (同步日历)
- `EventEmitter` (发布事件)

**业务规则验证**:
- 创建课时时，必须验证 `mentor_user_id` 在 `class_mentors_prices` 表中存在
- 创建课时时，自动继承 `class_students` 表的学生列表（不需要手动指定）

---

### 3.3 ClassQueryService (班级查询服务)

**文件**: `src/domains/services/class-sessions/classes/services/class-query.service.ts`

**职责**: 班级查询（仅查询 classes 及其关联表）

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `getClasses(filters)` | `ClassFiltersDto` | `Promise<ClassEntity[]>` | 获取班级列表。<br>支持分页、状态筛选、类型筛选、时间范围筛选。 |
| `getClassById(id)` | `UUID` | `Promise<ClassEntity>` | 获取班级详情（含导师、学生、顾问列表）。 |
| `getClassMentors(classId)` | `UUID` | `Promise<ClassMentorPrice[]>` | 获取班级的导师及价格列表。 |
| `getClassStudents(classId)` | `UUID` | `Promise<ClassStudent[]>` | 获取班级的学生列表。 |
| `getClassCounselors(classId)` | `UUID` | `Promise<ClassCounselor[]>` | 获取班级的顾问列表。 |

---

### 3.4 ClassSessionQueryService (课时查询服务)

**文件**: `src/domains/services/class-sessions/sessions/services/class-session-query.service.ts`

**职责**: 课时查询（仅查询 class_sessions 表）

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `getSessionsByClass(classId, filters)` | `UUID, SessionFiltersDto` | `Promise<ClassSessionEntity[]>` | 获取班级的课时列表。<br>支持分页、状态筛选、时间范围筛选。<br>**默认过滤 status != 'deleted'**。 |
| `getMentorSessions(mentorId, filters)` | `UUID, SessionFiltersDto` | `Promise<ClassSessionEntity[]>` | 获取导师的课时列表。<br>**默认过滤 status != 'deleted'**。 |
| `getSessionById(id)` | `UUID` | `Promise<ClassSessionEntity>` | 获取课时详情（含班级信息、学生列表）。 |

**查询优化**:
- 使用复合索引 `(class_id, scheduled_at DESC)` 和 `(mentor_user_id, scheduled_at DESC)`
- 支持 LEFT JOIN classes 表获取班级信息
- 支持 LEFT JOIN meetings 表获取会议 URL

---

## 🎧 4. 事件监听器 (Listeners)

### 4.1 ClassSessionEventListener

**文件**: `src/domains/services/class-sessions/sessions/listeners/class-session-event.listener.ts`

**职责**: 监听 Core Meeting 生命周期事件并更新班课课时状态

**核心逻辑**:

| 事件 | 处理方法 | 功能说明 |
| :--- | :--- | :--- |
| `meeting.lifecycle.completed` | `handleMeetingCompletion()` | **会议完成事件处理**。<br>1. 监听 `MEETING_LIFECYCLE_COMPLETED_EVENT` ⭐<br>2. 根据 `payload.meetingId` 查找对应的 class_session<br>3. 如果找到，调用 `completeSession(sessionId, payload)` 方法：<br>   - 更新状态为 `completed`<br>   - 设置 `completed_at`<br>   - 登记服务到 `service_references`（共享主键）<br>   - 发布 `SessionCompletedEvent`<br>   - **不需要同步更新 Calendar（通过事件通知）** ⭐ |

**事件导入** ⭐:
```typescript
import {
  MeetingLifecycleCompletedPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events';
```

**事件处理流程**:
```
1. Core/Meeting 发布 meeting.lifecycle.completed 事件
   ↓
2. ClassSessionEventListener 监听事件
   ↓
3. 根据 meetingId 查找 class_session
   ↓
4. 如果找到 → completeSession()
   - 更新 class_sessions.status = 'completed'
   - 插入 service_references (共享主键)
   - 发布 SessionCompletedEvent
   ↓
5. 下游模块监听 SessionCompletedEvent
   - Calendar 模块：更新日历状态
   - Financial 模块：生成导师费用
   - Contract 模块：扣减学生合同课时（如果 class.type='session'）
```

---

## 📋 5. DTO 定义

### 5.1 CreateClassDto

**用途**: 创建班级

| 字段 | 类型 | 必须 | 说明 |
| :--- | :--- | :--- | :--- |
| `name` | String | 是 | 班级名称 |
| `type` | String | 是 | 班课类型 Enum: `session`, `enroll` ⭐ |
| `startDate` | Date | 是 | 班级开始时间 |
| `endDate` | Date | 是 | 班级结束时间 |
| `description` | String | 否 | 班课简介 |
| `totalSessions` | Number | 是 | 总课时数 |
| `mentors` | Array | 是 | 导师及价格列表 `[{ mentorUserId, pricePerSession }]` ⭐ |
| `students` | Array | 是 | 学生列表 `[studentUserId1, studentUserId2, ...]` ⭐ |
| `counselors` | Array | 是 | 顾问列表 `[counselorUserId1, counselorUserId2, ...]` ⭐ |

**示例**:
```typescript
{
  "name": "2025 Spring Backend Bootcamp",
  "type": "session",
  "startDate": "2025-03-01T00:00:00Z",
  "endDate": "2025-05-31T23:59:59Z",
  "description": "Spring 学期后端开发训练营",
  "totalSessions": 12,
  "mentors": [
    { "mentorUserId": "uuid-mentor-1", "pricePerSession": 500.00 },
    { "mentorUserId": "uuid-mentor-2", "pricePerSession": 600.00 }
  ],
  "students": ["uuid-student-1", "uuid-student-2", "uuid-student-3"],
  "counselors": ["uuid-counselor-1", "uuid-counselor-2"]
}
```

---

### 5.2 UpdateClassDto

**用途**: 更新班级信息

| 字段 | 类型 | 必须 | 说明 |
| :--- | :--- | :--- | :--- |
| `name` | String | 否 | 班级名称 |
| `startDate` | Date | 否 | 班级开始时间 |
| `endDate` | Date | 否 | 班级结束时间 |
| `description` | String | 否 | 班课简介 |
| `totalSessions` | Number | 否 | 总课时数 |

**说明**:
- 不支持直接修改 `type`（班课类型不可变）
- 不支持直接修改导师/学生/顾问列表（需使用专用方法）

---

### 5.3 CreateClassSessionDto

**用途**: Application Layer 编排时使用

| 字段 | 类型 | 必须 | 说明 |
| :--- | :--- | :--- | :--- |
| `classId` | UUID | 是 | **关联的班级 ID** ⭐ |
| `meetingId` | UUID | 是 | **关联的会议 ID**（由 Step 1 返回）⭐ |
| `sessionType` | String | 是 | 会话类型（固定值 `class_session`）|
| `mentorUserId` | UUID | 是 | **本节课的导师 ID**（必须是该班级已注册的导师）⭐ |
| `title` | String | 是 | 课时标题 |
| `description` | String | 否 | 课时描述 |
| `scheduledAt` | Date | 是 | 预约开始时间 |

**说明** ⭐:
- **不需要** `students` 字段：学生列表自动继承自 `class_students` 表
- **不需要** `sessionTypeId` 字段：班课不需要会话类型下拉选择
- `mentorUserId` 必须在 `class_mentors_prices` 表中存在（业务规则验证）

---

### 5.4 UpdateClassSessionDto

**用途**: 更新课时信息

| 字段 | 类型 | 必须 | 说明 |
| :--- | :--- | :--- | :--- |
| `title` | String | 否 | 课时标题 |
| `description` | String | 否 | 课时描述 |
| `scheduledAt` | Date | 否 | 预约开始时间（改期）|
| `mentorUserId` | UUID | 否 | 更换导师（必须是该班级已注册的导师）|

---

## 🗂️ 6. Service Registry 集成

### 6.1 模块概述与职责

**Service Registry** 是服务注册表模块，负责记录所有已完成的服务，为财务和合同模块提供统一的服务引用。

**职责定位**:
- ✅ 记录所有已完成的班课课时（service_type = 'class_session'）
- ✅ 使用共享主键防止重复计费
- ✅ 为下游模块（Financial、Contract）提供统一数据源
- ✅ 发布 `services.session.completed` 事件通知下游

---

### 6.2 service_references 表设计

**职责**: 记录所有已完成的服务（Immutable，共享主键）

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | PK | - | 主键（来自 class_sessions.id，共享主键）⭐ |
| `service_type` | VARCHAR(50) | NOT NULL | - | 服务类型（固定值 `class_session`）⭐ |
| `student_user_id` | UUID | NOT NULL, FK (users.id) | - | 学生的用户 ID（班课场景可能为空或代表性学生）⭐ |
| `provider_user_id` | UUID | NOT NULL, FK (users.id) | - | 服务提供者的用户 ID（导师 ID）|
| `consumed_units` | DECIMAL(10,2) | NOT NULL | - | 消耗的单位数量（实际时长，小时）|
| `unit_type` | VARCHAR(20) | NOT NULL | - | 单位类型（固定值 `hour`）|
| `completed_time` | TIMESTAMPTZ | NOT NULL | - | 服务完成时间 |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间（无 updated_at，因为不可变）|

**说明** ⭐:
- `student_user_id`：班课是 1:N 场景，此字段可以：
  - 留空（NULL）

---

### 6.3 事件发布：services.session.completed

**事件常量**: `SERVICE_SESSION_COMPLETED_EVENT = "services.session.completed"`

**事件 Payload**: `IServiceSessionCompletedPayload`

**字段说明**:

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| `sessionId` | string | 课时 ID（共享主键）|
| `sessionType` | string | 固定值 `class_session` |
| `classId` | string | 班级 ID ⭐ |
| `classType` | string | 班课类型（`session` or `enroll`）⭐ |
| `mentorId` | string | 导师 ID |
| `refrenceId` | string | 服务引用 ID（同 sessionId）|
| `actualDurationHours` | number | 实际时长（小时）|
| `durationHours` | number | 预定时长（小时）|
| `allowBilling` | boolean | 是否允许计费（固定值 `true`，因为所有课时都需要支付导师费用）⭐ |

**下游消费者**:
- **Financial 模块**: 监听此事件，生成导师费用（根据 class_mentors_prices 表的价格）
- **Contract 模块**: 监听此事件，如果 `classType = 'session'`，扣减学生合同课时

---

### 6.4 防重复计费机制

**多层防护**:

1. **数据库主键约束**（最强保证）⭐
   ```sql
   -- service_references.id 是主键
   -- 重复 INSERT 会抛出主键冲突异常
   INSERT INTO service_references (id, ...) VALUES (sessionId, ...);
   ```

2. **应用层检查**（可选）
   - 在 registerService() 中检查记录是否已存在

3. **幂等性保证**
   - 即使 completeSession() 被多次调用
   - 第二次调用会因为主键冲突而失败
   - 保证一个课时只能登记一次服务

4. **事务边界**
   - 更新课时状态 + 登记服务 + 发布事件，在同一事务内完成

---

## 📊 7. 数据流图

### 7.1 创建班级流程

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. API Layer - POST /api/classes                                │
│    - CreateClassDto                                              │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Application Layer - CreateClassCommand                       │
│    - 验证 DTO 数据                                                │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Domain Layer - ClassService.createClass()                    │
│    - 事务开始                                                     │
│    - 插入 classes 表                                              │
│    - 插入 class_mentors_prices 表（导师及价格）                  │
│    - 插入 class_students 表（学生列表）                          │
│    - 插入 class_counselors 表（顾问列表）                        │
│    - 事务提交                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7.2 创建课时流程

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. API Layer - POST /api/class-sessions                         │
│    - CreateClassSessionDto                                       │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Application Layer - CreateClassSessionCommand                │
│    - Step 1: 调用 Core/Meeting 创建会议（获取 meetingId）       │
│    - Step 2: 调用 ClassSessionService.createSession()           │
│    - Step 3: 调用 Calendar 创建日历条目                          │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Domain Layer - ClassSessionService.createSession()           │
│    - 验证 classId 有效性    
│    - 插入 class_sessions 表                                       │
│    - Status: scheduled                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7.3 课时完成流程 ⭐

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Meeting 完成 (Core Layer)                                     │
│    - MeetingLifecycleCompletedEvent                             │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. ClassSession Listener (Domain Layer)                         │
│    - ClassSessionEventListener.handleMeetingCompletion()        │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. ClassSession Service (Domain Layer)                          │
│    - 根据 meeting_id 查询 class_sessions 表                      │
│    - 如果找到记录：                                              │
│      - completeSession(sessionId, payload)                      │
│      - 更新 class_sessions.status = 'completed'                 │
│    - 如果未找到：跳过（该会议不属于班课）                        │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Service Registry (Domain Layer)                              │
│    - registerService(dto) - 使用共享主键                        │
│    - INSERT service_references (service_type='class_session')   │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. 发布事件 (Domain Layer)                                      │
│    - services.session.completed                                 │
│    - Payload 包含 classId, classType, mentorId 等               │
└────────────────┬────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. 下游消费 (Financial & Contract Layers)                       │
│    - Financial: 生成导师费用（查询 class_mentors_prices）       │
│    - Contract: 如果 classType='session'，扣减学生合同课时       │
│    - Calendar: 更新日历状态                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 8. 设计总结

### 8.1 核心设计模式

- ✅ **CQRS** (Command Query Responsibility Segregation)
- ✅ **Event-Driven Architecture** (事件驱动架构)
- ✅ **Shared Primary Key** (共享主键)
- ✅ **Table-per-Type** (每类型一表)
- ✅ **Domain Events** (领域事件)
- ✅ **Aggregate Root** (聚合根：Class 和 ClassSession)

---

### 8.2 设计哲学

> "职责清晰胜过巧妙抽象，事件驱动实现松耦合，共享主键防止重复计费"

---

### 8.3 与其他 Session 类型的区别

| 特性 | Regular Mentoring / Gap Analysis / AI Career | Class Session |
|:---|:---|:---|
| **教学模式** | 1:1（一对一）| 1:N（一对多）⭐ |
| **学生列表** | 单个学生（student_user_id 字段）| 多个学生（class_students 表）⭐ |
| **导师列表** | 单个导师（mentor_user_id 字段）| 单个导师，但班级有导师池（class_mentors_prices 表）⭐ |
| **会话类型选择** | 需要（session_type_id FK）| 不需要（固定为 class_session）⭐ |
| **班级归属** | 无 | 必须关联班级（class_id FK）⭐ |
| **计费逻辑** | 单个学生消耗课时 | 根据班课类型决定是否消耗课时 ⭐ |
| **创建流程** | 直接创建课时 | 先创建班级，再创建课时 ⭐ |

---

### 8.4 关键设计决策

1. **班级与课时分层管理** ⭐
   - `classes` 表：管理班级元数据（导师池、学生名单、顾问列表）
   - `class_sessions` 表：管理具体课时（单个导师、时间、状态）
   - **优点**：清晰的职责分离，易于扩展

2. **学生列表统一管理** ⭐
   - 学生列表由 `class_students` 表统一管理
   - 创建课时时不需要再次指定学生
   - **优点**：避免数据冗余，保持一致性

3. **导师价格独立配置** ⭐
   - 使用 `class_mentors_prices` 关联表
   - 每位导师可以有不同的课时单价
   - **优点**：灵活的定价策略，便于查询和统计

4. **状态独立管理** ⭐
   - 班级状态（Active/Inactive）与课时状态（scheduled/completed/cancelled/deleted）独立
   - **优点**：互不影响，业务逻辑更清晰

5. **不需要 session_type_id** ⭐
   - 班课类型固定为 `class_session`
   - 不需要从 `session_types` 表选择
   - **优点**：简化创建流程

6. **Service Registry 使用特殊处理** ⭐
   - `student_user_id` 字段可以为 NULL 或特殊标识
   - 学生列表由 `class_students` 表管理
   - **优点**：避免为每个学生插入重复记录

---

## 📚 9. 附录

### 9.1 班课类型说明

| type | 中文名称 | 业务含义 | 合同课时 | 典型场景 |
|:---|:---|:---|:---|:---|
| `session` | 合同班课 | 需要学生合同包含班课课时数 | 消耗 | 付费学员专属班课 |
| `enroll` | 公共班课 | 所有学生都可以参与 | 不消耗 | 免费公开课、讲座 |

---

### 9.2 状态转换图

**班级状态（classes.status）**:
```
Active ←→ Inactive
```

**课时状态（class_sessions.status）**:
```
scheduled → completed
    ↓
cancelled
    ↓
deleted
```

**说明**:
- 班级状态与课时状态独立管理
- 班级 Inactive 时，不影响已创建的课时状态
- 课时的状态转换与其他 session 类型一致

---

### 9.3 核心 SQL 查询示例

**查询班级的所有学生**:
```sql
SELECT u.id, u.name, cs.enrolled_at
FROM class_students cs
JOIN users u ON cs.student_user_id = u.id
WHERE cs.class_id = :classId;
```

**查询班级的所有导师及价格**:
```sql
SELECT u.id, u.name, cmp.price_per_session
FROM class_mentors_prices cmp
JOIN users u ON cmp.mentor_user_id = u.id
WHERE cmp.class_id = :classId;
```

**查询某节课时的学生列表**:
```sql
SELECT cs.student_user_id, u.name
FROM class_students cs
JOIN users u ON cs.student_user_id = u.id
WHERE cs.class_id = (
  SELECT class_id FROM class_sessions WHERE id = :sessionId
);
```

**查询班级的所有课时**:
```sql
SELECT 
  cs.*,
  m.meeting_no,
  m.meeting_url,
  u.name as mentor_name
FROM class_sessions cs
LEFT JOIN meetings m ON cs.meeting_id = m.id
LEFT JOIN users u ON cs.mentor_user_id = u.id
WHERE cs.class_id = :classId
  AND cs.status != 'deleted'
ORDER BY cs.scheduled_at DESC;
```

---

**文档结束** 🎉

