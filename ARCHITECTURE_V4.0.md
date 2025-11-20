# System Architecture Design v4.0

**文档版本**: v4.0  
**更新日期**: 2025-11-19  
**核心理念**: 领域驱动设计 (DDD) + Table-per-Type 策略 + 事件驱动架构 (EDA)

---

## 🏗️ 1. 架构概览

本系统采用分层架构，核心是将**通用视频会议能力**与**具体业务场景**进行物理和逻辑上的解耦。

### 1.1 核心分层

| 层级 | 模块 | 职责 | 依赖方向 |
| :--- | :--- | :--- | :--- |
| **Application Layer** | `src/application` | 业务编排、事务控制、Command/Query 处理 | 依赖 Domain & Core |
| **Domain Layer (Business)** | `src/domains/services/*` | 核心业务逻辑 (Mentoring, Interview, GapAnalysis) | 依赖 Core |
| **Core Layer (Infrastructure)** | `src/core/meeting` | 通用会议资源管理、生命周期维护、事件溯源 | 不依赖 Domain |
| **Gateway Layer** | `src/core/webhook` | 外部系统适配、消息接收与标准化 | 依赖 Core |

### 1.2 模块交互图

```mermaid
graph TD
    User[用户/客户端] --> BFF[BFF / API Layer]
    Feishu[飞书/Zoom] --> Webhook[Webhook Gateway]

    subgraph "Application Layer"
        AppService[Booking Application Service]
    end

    subgraph "Domain Layer (Business)"
        Mentoring[Mentoring Domain]
        Interview[Mock Interview Domain]
        Gap[Gap Analysis Domain]
        DB_Domain[(mentoring_sessions table)]
    end

    subgraph "Core Layer (Infrastructure)"
        MeetingCore[Core Meeting Module]
        DB_Meeting[(meetings table)]
        DB_Events[(meeting_events table)]
    end

    BFF --> AppService
    
    %% 约课流程
    AppService --1. Create Meeting (Tx)--> MeetingCore
    MeetingCore --2. Insert & Return ID--> DB_Meeting
    AppService --3. Create Session (Tx)--> Mentoring
    Mentoring --4. Insert with MeetingID--> DB_Domain

    %% 结课流程
    Webhook --1. Raw Event--> MeetingCore
    MeetingCore --2. Write Log--> DB_Events
    MeetingCore --3. Update Status--> DB_Meeting
    
    MeetingCore --4. Publish Event: MeetingCompleted--> Mentoring
    MeetingCore --4. Publish Event: MeetingCompleted--> Interview
```

---

## 💾 2. 数据库架构 (Table-per-Type)

采用 **Table-per-Type** 策略，将会议的“物理属性”与“业务属性”分离。

### 2.1 Core Layer (基座)
所有类型的课时都共享这张表。

*   **`meetings` 表**:
    *   `id` (PK), `meeting_no` (Index)
    *   `provider`, `meeting_url`, `recording_url`
    *   `status` (scheduled/active/ended)
    *   `actual_duration` (物理时长)
    *   `meeting_time_list` (时间段)

### 2.2 Domain Layer (业务扩展)
各业务线维护自己的表，通过 `meeting_id` 关联基座。

*   **`mentoring_sessions` 表**:
    *   `id`, `meeting_id` (FK -> meetings.id)
    *   `student_id`, `mentor_id`
    *   `status` (scheduled/completed/cancelled)
    *   `service_duration` (业务时长)
    *   `feedback`, `rating`

*   **`mock_interview_sessions` 表**:
    *   `id`, `meeting_id` (FK -> meetings.id)
    *   `student_id`, `interviewer_id`
    *   `interview_score`, `report_url`

*   **`gap_analysis_sessions` 表**:
    *   `id`, `meeting_id` (FK -> meetings.id)
    *   `analyst_id`, `report_data`

---

## 🔄 3. 关键业务流程

### 3.1 约课流程 (Booking Flow)
**特点**: 强一致性事务，Application Layer 负责编排。

```mermaid
sequenceDiagram
    participant Client
    participant App as Application Service
    participant Core as Core Meeting Module
    participant Domain as Mentoring Domain
    participant DB as Database (Transaction)

    Client->>App: bookSession(dto)
    App->>DB: Begin Transaction
    
    rect rgb(240, 248, 255)
        Note over App, Core: Step 1: 创建物理会议
        App->>Core: createMeeting(topic, time)
        Core->>Core: Call Feishu/Zoom API
        Core->>DB: INSERT INTO meetings (status='scheduled')
        Core-->>App: return MeetingEntity (id, meeting_no, url)
    end

    rect rgb(255, 250, 240)
        Note over App, Domain: Step 2: 创建业务课时
        App->>Domain: createSession(studentId, mentorId, meetingId)
        Domain->>DB: INSERT INTO mentoring_sessions (meeting_id=...)
        Domain-->>App: return SessionEntity
    end

    App->>DB: Commit Transaction
    App-->>Client: return Success
    App->>App: Publish Event: service.session.booked
```

### 3.2 结课流程 (Completion Flow)
**特点**: 事件驱动，最终一致性，Core Layer 负责判定。

```mermaid
sequenceDiagram
    participant Feishu as Feishu/Zoom
    participant Webhook
    participant Core as Core Meeting Module
    participant Task as Delayed Task
    participant Domain as Mentoring Domain
    participant DB as Database

    Feishu->>Webhook: POST /webhook (meeting.ended)
    Webhook->>Core: recordEvent(payload)
    Core->>DB: INSERT INTO meeting_events
    Core->>Task: Schedule Check (30min delay)

    Note over Task: ... 30 Minutes Later ...

    Task->>Core: executeCompletionCheck()
    Core->>DB: Check for new join events?
    
    alt No new events (Meeting Finally Ended)
        Core->>Core: Calculate Duration
        Core->>DB: UPDATE meetings SET status='ended'
        Core->>Domain: Publish Event: meeting.lifecycle.completed
        
        Note over Domain: Step 3: 业务结算
        Domain->>DB: UPDATE mentoring_sessions SET status='completed'
        Domain->>Domain: Trigger Billing/Feedback
    else Has new events
        Core->>Task: Reschedule Check
    end
```

---

## 📢 4. 事件契约 (Event Contract)

### 4.1 Core -> Domain
**Event Name**: `meeting.lifecycle.completed`

**Payload**:
```json
{
  "meetingId": "uuid-...",
  "meetingNo": "123456789",
  "actualDuration": 3600,
  "recordingUrl": "https://...",
  "endedAt": "2025-11-19T10:00:00Z",
  "timeList": [...]
}
```

### 4.2 Domain -> Notification
**Event Name**: `service.session.booked`

**Payload**:
```json
{
  "sessionId": "uuid-...",
  "studentId": "uuid-...",
  "mentorId": "uuid-...",
  "startTime": "...",
  "meetingUrl": "..."
}
```

---

## 📌 5. 设计原则总结

1.  **关注点分离**: Core 管“连接”，Domain 管“业务”。
2.  **单向依赖**: Domain 依赖 Core，Core 不依赖 Domain。
3.  **数据一致性**: 创建时使用 DB 事务，结束时使用事件驱动。
4.  **开闭原则**: 新增业务类型 (如公开课) 只需新增 Domain 表和 Listener，无需修改 Core 代码。
