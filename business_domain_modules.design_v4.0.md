# Business Domain Modules 设计文档 v4.0

**文档版本**: v4.0  
**更新日期**: 2025-11-19  
**模块路径**: `src/domains/services`  
**定位**: 业务领域层 (Domain Layer) - 负责具体业务场景的逻辑实现，通过聚合根管理业务状态，并响应 Core 层的生命周期事件。  
**依赖关系**: 依赖 `src/core/meeting` (仅通过 ID 引用和事件订阅)，被 `src/application` 层调用。

---

## 📂 1. 目录结构

```text
src/domains/services/
├── mentoring/                        # 【导师辅导】业务域
│   ├── entities/
│   │   └── mentoring-session.entity.ts
│   ├── services/
│   │   └── mentoring.service.ts      # 核心业务逻辑
│   ├── listeners/
│   │   └── mentoring-event.listener.ts # 监听 meeting.lifecycle.completed
│   └── dto/
│       └── create-mentoring.dto.ts
│       └── update-mentoring.dto.ts
│
├── mock-interview/                   # 【模拟面试】业务域
│   ├── entities/
│   │   └── mock-interview-session.entity.ts
│   ├── services/
│   │   └── mock-interview.service.ts
│   ├── listeners/
│   │   └── interview-event.listener.ts
│   └── dto/
│       └── create-interview.dto.ts
│
├── gap-analysis/                     # 【差距分析】业务域
│   ├── entities/
│   │   └── gap-analysis-session.entity.ts
│   ├── services/
│   │   └── gap-analysis.service.ts
│   ├── listeners/
│   │   └── gap-event.listener.ts
│   └── dto/
│       └── create-gap-analysis.dto.ts
│
└── communication/                    # 【免费沟通】业务域 (CommSession)
    ├── entities/
    ├── services/
    └── listeners/
```

---

## 💾 2. 数据库设计

**设计原则**: 所有业务表都通过 `meeting_id` (FK) 关联到 Core 层的 `meetings` 表。**不冗余存储** `meeting_no` 等 Core 层字段，保持数据归一化。

### 2.1 mentoring_sessions 表 (导师辅导)

| 字段名 | 类型 | 用途 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | 主键 | - |
| `meeting_id` | UUID | 外键 | 关联 `meetings.id`，唯一索引 (1:1) |
| `student_id` | UUID | 业务主体 | 学生 ID |
| `mentor_id` | UUID | 业务主体 | 导师 ID |
| `status` | VARCHAR | 业务状态 | `scheduled`, `completed`, `cancelled`, `deleted` |
| `service_duration` | INTEGER | 计费时长 | 单位：秒。通常等于会议物理时长，可应用业务规则修正 |
| `feedback` | TEXT | 业务数据 | 导师反馈 |
| `rating` | INTEGER | 业务数据 | 学生评分 (1-5) |
| `created_at` | TIMESTAMPTZ | - | - |
| `deleted_at` | TIMESTAMPTZ | 软删除 | - |

### 2.2 mock_interview_sessions 表 (模拟面试)

| 字段名 | 类型 | 用途 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | 主键 | - |
| `meeting_id` | UUID | 外键 | 关联 `meetings.id` |
| `student_id` | UUID | 业务主体 | 学生 ID |
| `interviewer_id` | UUID | 业务主体 | 面试官 ID |
| `interview_type` | VARCHAR | 业务分类 | `behavioral`, `technical`, `system_design` |
| `score` | JSONB | 业务数据 | 面试评分详情 |
| `report_url` | TEXT | 业务产物 | 面试报告链接 |
| `status` | VARCHAR | 业务状态 | `scheduled`, `completed`, `cancelled`, `deleted` |

---

## 🛠️ 3. 核心 Services 设计

### 3.1 MentoringService
**文件**: `src/domains/services/mentoring/services/mentoring.service.ts`

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `createSession(dto)` | `CreateMentoringDto` | `Promise<MentoringEntity>` | **事务内操作**。<br>接收 App 层传入的 `meetingId`，创建业务记录。<br>Initial Status: `scheduled`。 |
| `updateSession(id, dto)` | `id, UpdateMentoringDto` | `Promise<MentoringEntity>` | **改期/修改信息**。<br>如果涉及时间修改，需同步更新业务字段。 |
| `deleteSession(id)` | `id` | `Promise<void>` | **软删除**。<br>更新 status = `deleted`，设置 `deleted_at`。 |
| `completeSession(event)` | `MeetingLifecycleCompletedEvent` | `Promise<void>` | **事件驱动**。<br>1. 更新 status = `completed`<br>2. 更新 service_duration = event.actualDuration<br>3. 触发计费/结算逻辑。 |
| `cancelSession(id, reason)` | `sessionId, reason` | `Promise<void>` | **业务操作**。<br>更新 status = `cancelled`。<br>(可选) 调用 Core 取消会议。 |

### 3.2 MockInterviewService
**文件**: `src/domains/services/mock-interview/services/mock-interview.service.ts`

| 方法 | 参数 | 返回值 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `createInterview(dto)` | `CreateInterviewDto` | `Promise<InterviewEntity>` | 创建面试记录。 |
| `submitScore(id, score)` | `interviewId, scoreData` | `Promise<void>` | 面试官提交评分。 |
| `generateReport(id)` | `interviewId` | `Promise<string>` | 基于评分生成 PDF 报告。 |

---

## 🎧 4. 事件监听器 (Listeners)

### 4.1 MentoringEventListener
**文件**: `src/domains/services/mentoring/listeners/mentoring-event.listener.ts`

```typescript
@Injectable()
export class MentoringEventListener {
  constructor(private readonly mentoringService: MentoringService) {}

  @OnEvent('meeting.lifecycle.completed')
  async handleMeetingCompletion(event: MeetingLifecycleCompletedEvent) {
    // 1. 根据 meetingId (UUID) 查找属于 Mentoring 域的记录
    // 这是最精准的查找方式，不存在重复问题
    const session = await this.mentoringService.findByMeetingId(event.meetingId);
    
    if (session) {
      // 2. 找到了，说明这个会议是 Mentoring Session
      await this.mentoringService.completeSession(session.id, event);
    }
    // 3. 没找到？说明这个会议可能属于 Interview 或其他域，忽略即可
  }
}
```

---

## 📋 5. DTO 定义

### 5.1 CreateMentoringDto
**用途**: Application Layer 编排时使用。

| 字段 | 类型 | 必须 | 说明 |
| :--- | :--- | :--- | :--- |
| `meetingId` | UUID | 是 | **关联的核心会议ID** (由 Step 1 返回) |
| `studentId` | UUID | 是 | - |
| `mentorId` | UUID | 是 | - |
| `startTime` | Date | 是 | 业务上的开始时间 |
| `topic` | String | 否 | 业务主题 |

---

## 🔄 6. 业务状态流转

### 6.1 正常履约流程
1.  **Scheduled**: 创建时默认状态。
2.  **Completed**: 收到 `meeting.lifecycle.completed` 事件后自动流转。

### 6.2 异常/取消流程
1.  **Cancelled**: 学生/导师主动取消。
2.  **Deleted**: 管理员或系统逻辑进行的软删除。

---

**设计总结**: 
各 Business Domain 模块专注于**“人”和“业务结果”**的管理，而将**“音视频连接”**和**“时长统计”**完全委托给 Core Meeting 模块。两者通过 ID 关联和 Event 交互，实现了完美的松耦合。
