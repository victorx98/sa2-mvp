# Mock Interview 模块设计文档

> 基于 comm-session 架构设计的 AI 模拟面试功能模块
> 
> **阅读时间:** 2分钟

---

## 1. 数据库表设计

### 1.1 mock_interviews 表

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | uuid | PRIMARY KEY | random | 主键 |
| session_type | varchar(50) | NOT NULL | 'mock_interview' | 会话类型 |
| student_user_id | uuid | NOT NULL | - | 学生用户ID |
| created_by_counselor_id | uuid | NULL | - | 创建者顾问ID（追踪用） |
| title | varchar(255) | NOT NULL | - | 面试标题 |
| status | varchar(20) | NOT NULL | 'scheduled' | 状态值 |
| scheduled_at | timestamp | NOT NULL | - | 预约开始时间 |
| schedule_duration | integer | NOT NULL | 60 | 时长（分钟） |
| completed_at | timestamp | NULL | - | 完成时间 |
| cancelled_at | timestamp | NULL | - | 取消时间 |
| deleted_at | timestamp | NULL | - | 删除时间 |
| interview_type | varchar(50) | NULL | - | 面试类型 |
| language | varchar(10) | NULL | - | 面试语言 |
| company_name | varchar(255) | NULL | - | 目标公司名称 |
| job_title | varchar(255) | NULL | - | 目标职位名称 |
| job_description | text | NULL | - | 职位描述 |
| resume_text | text | NULL | - | 学生简历文本 |
| student_info | jsonb | NULL | '{}' | 学生信息JSON |
| interview_questions | jsonb | NULL | '[]' | 面试问题列表 |
| interview_instructions | text | NULL | - | 面试说明 |
| system_instruction | text | NULL | - | AI系统指令 |
| service_type | varchar(50) | NULL | - | 服务类型标识 |
| ai_summaries | jsonb | NULL | '[]' | AI面试总结 |
| created_at | timestamp | NOT NULL | now() | 创建时间 |
| updated_at | timestamp | NOT NULL | now() | 更新时间 |

**索引设计:**
```sql
CREATE INDEX idx_mock_interview_student_scheduled ON mock_interviews(student_user_id, scheduled_at);
CREATE INDEX idx_mock_interview_status ON mock_interviews(status);
CREATE INDEX idx_mock_interview_created_by_counselor ON mock_interviews(created_by_counselor_id);
```

**约束:**
```sql
ALTER TABLE mock_interviews ADD CONSTRAINT mock_interviews_status_check 
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'deleted'));
```

**状态流转:**
- `scheduled` → `completed`
- `scheduled` → `cancelled`
- 任何状态 → `deleted`（软删除）
- **注意:** `completed` 状态不允许取消

---

## 2. 目录结构

```
src/
├── infrastructure/database/
│   ├── schema/
│   │   └── mock-interviews.schema.ts          # Drizzle Schema定义
│   └── migrations/
│       └── 00XX_create_mock_interviews.sql    # 数据库迁移文件
│
├── api/
│   ├── controllers/services/mock-interviews/
│   │   └── mock-interview.controller.ts       # HTTP路由控制器
│   └── dto/
│       ├── request/services/mock-interviews/
│       │   ├── mock-interview.request.dto.ts  # 请求DTO
│       │   └── index.ts
│       └── response/services/mock-interviews/
│           ├── mock-interview.response.dto.ts # 响应DTO
│           └── index.ts
│
├── application/commands/services/
│   └── mock-interview.service.ts              # 应用层服务（编排）
│
├── domains/
│   ├── services/mock-interviews/
│   │   ├── entities/
│   │   │   └── mock-interview.entity.ts       # 领域实体
│   │   ├── repositories/
│   │   │   └── mock-interview.repository.interface.ts
│   │   ├── infrastructure/repositories/
│   │   │   └── mock-interview.repository.ts   # 仓储实现
│   │   ├── services/
│   │   │   └── mock-interview-domain.service.ts # 领域服务
│   │   ├── value-objects/
│   │   │   └── interview-status.vo.ts         # 状态值对象
│   │   ├── exceptions/
│   │   │   └── exceptions.ts                  # 领域异常
│   │   ├── mock-interviews.module.ts          # 领域模块
│   │   └── index.ts
│   │
│   └── query/services/
│       └── mock-interview-query.service.ts    # 查询服务（CQRS读模型）
│
└── shared/events/
    └── event-constants.ts                     # 事件常量定义
```

---

## 3. API 层设计

### 3.1 MockInterviewController

**路由前缀:** `/api/services/mock-interviews`

| 方法 | 路径 | 权限 | 功能 | 说明 |
|------|------|------|------|------|
| POST | `/` | counselor/student | 创建模拟面试 | 创建预约并占用学生日历 |
| GET | `/` | counselor/student | 查询面试列表 | 支持按学生、状态等筛选 |
| GET | `/:id` | counselor/student | 获取面试详情 | 返回完整面试信息 |
| PATCH | `/:id` | counselor/student | 更新面试信息 | 更新时间、标题、配置等 |
| POST | `/:id/cancel` | counselor/student | 取消面试 | 取消预约并释放日历 |
| DELETE | `/:id` | counselor | 删除面试 | 软删除 |

### 3.2 Request DTOs

#### CreateMockInterviewRequestDto

| 字段 | 类型 | 必填 | 验证规则 | 说明 |
|------|------|------|----------|------|
| studentId | string | ✓ | UUID | 学生ID |
| title | string | ✓ | min: 1 | 面试标题 |
| scheduledAt | string | ✓ | ISO8601日期 | 预约时间 |
| duration | number | - | min: 15 | 时长（分钟），默认60 |
| interviewType | string | - | - | 面试类型 |
| language | string | - | enum: en/zh | 面试语言 |
| companyName | string | - | - | 公司名称 |
| jobTitle | string | - | - | 职位名称 |
| jobDescription | string | - | - | 职位描述 |
| resumeText | string | - | - | 简历文本 |
| interviewInstructions | string | - | - | 面试说明 |
| systemInstruction | string | - | - | AI系统指令 |

#### UpdateMockInterviewRequestDto

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | - | 面试标题 |
| scheduledAt | string | - | 预约时间 |
| duration | number | - | 时长（分钟） |
| interviewType | string | - | 面试类型 |
| language | string | - | 面试语言 |
| companyName | string | - | 公司名称 |
| jobTitle | string | - | 职位名称 |
| jobDescription | string | - | 职位描述 |
| resumeText | string | - | 简历文本 |
| interviewInstructions | string | - | 面试说明 |

### 3.3 Response DTOs

#### MockInterviewResponseDto

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 面试ID |
| sessionType | string | 会话类型 |
| studentUserId | string | 学生ID |
| studentName | object | 学生姓名 {en, zh} |
| createdByCounselorId | string | 创建者顾问ID |
| createdByCounselorName | object | 创建者顾问姓名 {en, zh} |
| title | string | 面试标题 |
| status | string | 状态 |
| scheduledAt | string | 预约时间 |
| scheduleDuration | number | 时长（分钟） |
| completedAt | string | 完成时间 |
| cancelledAt | string | 取消时间 |
| interviewType | string | 面试类型 |
| language | string | 面试语言 |
| companyName | string | 公司名称 |
| jobTitle | string | 职位名称 |
| jobDescription | string | 职位描述 |
| resumeText | string | 简历文本 |
| studentInfo | object | 学生信息JSON |
| interviewQuestions | array | 面试问题列表 |
| interviewInstructions | string | 面试说明 |
| aiSummaries | array | AI总结 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |

#### CreateMockInterviewResponseDto

| 字段 | 类型 | 说明 |
|------|------|------|
| sessionId | string | 会话ID |
| status | string | 状态 |
| scheduledAt | string | 预约时间 |

---

## 4. Application 层设计

### 4.1 MockInterviewService (应用编排层)

**职责:** 事务管理、日历服务协调、事件发布

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| createInterview | CreateMockInterviewDto | CreateMockInterviewResponseDto | 创建面试预约 |
| updateInterview | sessionId, UpdateMockInterviewDto | MockInterviewResponseDto | 更新面试信息 |
| cancelInterview | sessionId, reason? | MockInterviewResponseDto | 取消面试 |
| deleteInterview | sessionId | {sessionId, status} | 软删除 |
| getInterviewById | sessionId | MockInterviewResponseDto | 获取详情 |

#### createInterview 流程

```typescript
async createInterview(dto: CreateMockInterviewDto) {
  // 1. 开启事务
  await db.transaction(async (tx) => {
    // 2. 创建学生日历占用（仅学生，无导师）
    const studentSlot = await calendarService.createSlotDirect({
      userId: dto.studentId,
      userType: UserType.STUDENT,
      startTime: dto.scheduledAt,
      durationMinutes: dto.duration || 60,
      sessionType: CalendarSessionType.MOCK_INTERVIEW,
      title: dto.title,
    }, tx);
    
    // 检查时间冲突
    if (!studentSlot) {
      throw new TimeConflictException('学生日历冲突');
    }
    
    // 3. 创建 mock_interviews 记录（状态: scheduled）
    const interview = await domainService.createInterview({
      id: randomUUID(),
      ...dto,
      status: 'scheduled', // 直接scheduled，无需pending_meeting
    }, tx);
    
    return interview;
  });
  
  // 4. 发布事件 MOCK_INTERVIEW_CREATED_EVENT（用于通知等）
  eventEmitter.emit(MOCK_INTERVIEW_CREATED_EVENT, {...});
  
  return response;
}
```

**关键差异:**
- ❌ **无会议创建流程**（不调用飞书/Zoom API）
- ❌ **无导师日历占用**（仅学生）
- ✅ **初始状态直接为 `scheduled`**（无 `pending_meeting`）

#### updateInterview 流程

```typescript
async updateInterview(sessionId: string, dto: UpdateMockInterviewDto) {
  // 1. 查询旧数据
  const oldInterview = await queryService.getInterviewById(sessionId);
  
  // 2. 判断是否需要更新日历（时间或时长变化）
  const timeChanged = dto.scheduledAt && dto.scheduledAt !== oldInterview.scheduledAt;
  const durationChanged = dto.duration && dto.duration !== oldInterview.duration;
  
  await db.transaction(async (tx) => {
    if (timeChanged || durationChanged) {
      // 3a. 取消旧日历槽位
      await calendarService.updateSlots(sessionId, { status: 'cancelled' }, tx);
      
      // 3b. 创建新日历槽位（检查冲突）
      const newSlot = await calendarService.createSlotDirect({...}, tx);
      if (!newSlot) throw new TimeConflictException();
    } else if (dto.title) {
      // 3c. 仅更新标题
      await calendarService.updateSlots(sessionId, { title: dto.title }, tx);
    }
    
    // 4. 更新 mock_interviews 记录
    await domainService.updateInterview(sessionId, dto, tx);
  });
  
  // 5. 发布事件 MOCK_INTERVIEW_UPDATED_EVENT
  if (timeChanged || durationChanged) {
    eventEmitter.emit(MOCK_INTERVIEW_UPDATED_EVENT, {...});
  }
  
  return updatedInterview;
}
```

**关键差异:**
- ❌ **无会议更新API调用**

#### cancelInterview 流程

```typescript
async cancelInterview(sessionId: string, reason?: string) {
  // 1. 查询面试信息
  const interview = await queryService.getInterviewById(sessionId);
  
  // 2. 验证状态（只能取消 scheduled，completed 不允许取消）
  if (interview.status !== 'scheduled') {
    throw new Error('只能取消 scheduled 状态的面试');
  }
  
  await db.transaction(async (tx) => {
    // 3. 更新状态为 cancelled
    await domainService.cancelInterview(sessionId, tx);
    
    // 4. 释放日历槽位
    await calendarService.updateSlots(sessionId, { status: 'cancelled' }, tx);
  });
  
  // 5. 发布事件 MOCK_INTERVIEW_CANCELLED_EVENT
  eventEmitter.emit(MOCK_INTERVIEW_CANCELLED_EVENT, {
    sessionId,
    studentId: interview.studentUserId,
    cancelReason: reason,
  });
  
  return cancelledInterview;
}
```

**关键差异:**
- ❌ **无会议取消API调用**

---

## 5. Domain 层设计

### 5.1 MockInterview Entity (领域实体)

**职责:** 封装业务状态和行为，维护业务不变量

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| create | props | MockInterview | 工厂方法：创建新实体 |
| reconstitute | props | MockInterview | 工厂方法：从DB重建 |
| updateInfo | props | void | 更新面试信息 |
| complete | - | void | 完成面试（scheduled → completed） |
| cancel | - | void | 取消面试（scheduled → cancelled） |
| softDelete | - | void | 软删除（→ deleted） |
| canBeCancelled | - | boolean | 检查是否可取消（completed不可取消） |
| canBeUpdated | - | boolean | 检查是否可更新 |

**状态转换规则:**
```
scheduled → completed
scheduled → cancelled
any → deleted (软删除)

注意：completed 状态不允许取消
```

### 5.2 MockInterviewDomainService (领域服务)

**职责:** 纯业务逻辑，无事务、无外部服务调用

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| createInterview | props, tx? | MockInterview | 创建面试实体并保存 |
| updateInterview | sessionId, props, tx? | MockInterview | 更新面试信息 |
| completeInterview | sessionId, tx? | void | 完成面试 |
| cancelInterview | sessionId, tx? | void | 取消面试 |
| deleteInterview | sessionId, tx? | void | 软删除 |
| getInterviewById | sessionId | MockInterview | 查询单个 |

### 5.3 MockInterviewRepository Interface (仓储接口)

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| save | interview, tx? | void | 保存新实体 |
| update | interview, tx? | void | 更新实体 |
| findById | id | MockInterview \| null | 按ID查询 |
| findByStudentId | studentId | MockInterview[] | 按学生查询 |

### 5.4 InterviewStatus Value Object (值对象)

```typescript
enum InterviewStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DELETED = 'deleted',
}

function canTransitionTo(from: InterviewStatus, to: InterviewStatus): boolean;
function canBeCancelled(status: InterviewStatus): boolean; // completed 返回 false
```

---

## 6. Query 层设计 (CQRS读模型)

### 6.1 MockInterviewQueryService

**职责:** 查询优化、数据关联、权限过滤

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| getInterviewById | sessionId | QueryResult | 获取详情（含学生姓名等） |
| getStudentInterviews | studentId, filters? | QueryResult[] | 学生的面试列表 |
| getCounselorInterviews | counselorId, filters? | QueryResult[] | 顾问创建的面试列表 |
| getInterviewsByStudentIds | studentIds[], filters? | QueryResult[] | 批量学生面试 |

**QueryResult 结构:**
```typescript
{
  id: string;
  studentUserId: string;
  studentName: { en: string; zh: string };
  createdByCounselorId?: string;
  createdByCounselorName?: { en: string; zh: string };
  title: string;
  status: string;
  scheduledAt: string;
  scheduleDuration: number;
  // ... 其他字段
}
```

---

## 7. 事件设计

### 7.1 事件常量

| 事件名 | 常量 | 触发时机 |
|--------|------|----------|
| 面试创建 | MOCK_INTERVIEW_CREATED_EVENT | 创建成功后 |
| 面试更新 | MOCK_INTERVIEW_UPDATED_EVENT | 时间/时长变更后 |
| 面试取消 | MOCK_INTERVIEW_CANCELLED_EVENT | 取消成功后 |
| 面试完成 | MOCK_INTERVIEW_COMPLETED_EVENT | 面试完成后 |

### 7.2 事件数据结构

#### MOCK_INTERVIEW_CREATED_EVENT

```typescript
{
  sessionId: string;
  studentId: string;
  createdByCounselorId?: string;
  scheduledAt: string;
  scheduleDuration: number;
  title: string;
  interviewType?: string;
  studentCalendarSlotId: string;
}
```

#### MOCK_INTERVIEW_CANCELLED_EVENT

```typescript
{
  sessionId: string;
  studentId: string;
  createdByCounselorId?: string;
  cancelReason?: string;
  cancelledAt: string;
}
```

---

## 8. 关键技术要点

### 8.1 日历服务集成

```typescript
// 创建学生日历槽位
await calendarService.createSlotDirect({
  userId: studentId,
  userType: UserType.STUDENT,
  startTime: scheduledAt,
  durationMinutes: duration,
  sessionType: CalendarSessionType.MOCK_INTERVIEW, // 新增枚举值
  title: title,
  sessionId: sessionId,
}, tx);
```

**CalendarSessionType 需新增:**
```typescript
export enum SessionType {
  COMM_SESSION = 'comm_session',
  MOCK_INTERVIEW = 'mock_interview', // 新增 ✨
  // ... 其他类型
}
```

### 8.2 状态机设计

```
        ┌─────────────┐
        │  SCHEDULED  │ (初始状态)
        └──────┬──────┘
               │
        ┌──────┴───────┐
        │              │
        ▼              ▼
  ┌──────────┐   ┌──────────┐
  │CANCELLED │   │ COMPLETED│ (终态，不可取消)
  └──────────┘   └──────────┘
```

**业务规则:**
- `scheduled` 可以取消或完成
- `completed` 不允许取消（终态）
- `cancelled` 为终态
- 任何状态都可以软删除（`deleted`）

### 8.3 权限控制

| 操作 | Student | Counselor | Admin |
|------|---------|-----------|-------|
| 创建面试 | ✓ | ✓ | ✓ |
| 查看自己的 | ✓ | - | - |
| 查看学生的 | - | ✓ (仅自己的学生) | ✓ |
| 更新 | ✓ (自己的) | ✓ | ✓ |
| 取消 | ✓ (自己的) | ✓ | ✓ |
| 删除 | - | ✓ | ✓ |

---

## 9. 实现检查清单

### Database Layer
- [ ] 创建 `mock_interviews` Schema (Drizzle ORM)
- [ ] 编写数据库迁移文件
- [ ] 添加索引和约束
- [ ] 在 CalendarSessionType 枚举添加 `MOCK_INTERVIEW`

### Domain Layer
- [ ] MockInterview Entity
- [ ] InterviewStatus Value Object
- [ ] IRepository Interface
- [ ] Repository Implementation (Drizzle)
- [ ] MockInterviewDomainService
- [ ] Domain Exceptions

### Application Layer
- [ ] MockInterviewService (编排层)
- [ ] MockInterviewQueryService (查询层)

### API Layer
- [ ] MockInterviewController
- [ ] Request DTOs + Validation
- [ ] Response DTOs
- [ ] Swagger 文档注解

### Events
- [ ] 添加事件常量到 event-constants.ts
- [ ] Event Listeners (可选，用于通知等)

### Module Registration
- [ ] MockInterviewsModule (Domain)
- [ ] 在 AppModule 注册

### Testing
- [ ] Unit Tests (Entity, Value Object)
- [ ] Integration Tests (Repository)
- [ ] E2E Tests (API)

---

## 10. API 使用示例

### 创建模拟面试

```bash
POST /api/services/mock-interviews
Authorization: Bearer <token>

{
  "studentId": "uuid",
  "title": "Google SWE Mock Interview",
  "scheduledAt": "2025-12-25T10:00:00Z",
  "duration": 60,
  "interviewType": "technical",
  "language": "en",
  "companyName": "Google",
  "jobTitle": "Software Engineer",
  "jobDescription": "...",
  "resumeText": "..."
}
```

### 查询面试列表

```bash
GET /api/services/mock-interviews?studentId=uuid&status=scheduled
Authorization: Bearer <token>
```

### 取消面试

```bash
POST /api/services/mock-interviews/:id/cancel
Authorization: Bearer <token>

{
  "reason": "Schedule conflict"
}
```

---

---

**文档版本:** v1.0  
**创建日期:** 2025-12-23  
**预计工作量:** 3-4 个工作日

