# MentorX MVP 计划：顾问约课及自动计费系统

## 📋 文档信息

- **项目**: MentorX Platform MVP
- **版本**: v4.0 (Two-Layer Meeting Architecture)
- **目标**: 实现顾问为学生预约导师课程、自动计费、薪酬结算及会议智能分析的核心流程

---

## 🎯 MVP 范围定义

### 核心功能（Must Have）

```
1. 用户与身份管理 (Identity Domain)
   - 学生注册/登录 (User + StudentProfile)
   - 导师注册/登录 (User + MentorProfile)
   - 顾问注册/登录 (User + CounselorProfile)

2. 导师档案与定价 (Financial Domain)
   - 导师创建个人档案
   - 导师设置服务费率 (MentorPrice)

3. 学生-顾问关系管理
   - 为学生分配顾问
   - 顾问查看自己管理的学生

4. 权益与合同管理 (Contract Domain)
   - 创建服务合同 (基于 Product Snapshot)
   - 学生获得权益 (ContractEntitlement)
   - 权益池化管理 (Student-level Accumulation)

5. 顾问预约课程 (Meeting + Business Domain)
   - 顾问查看学生权益余额 (跨合同聚合)
   - 顾问查看导师可用时间
   - 顾问为学生预约课程:
     * 创建核心 Meeting (统一会议管理)
     * 创建业务实体 (Mentoring/MockInterview/GapAnalysis)
   - 集成会议提供商 (Feishu/Zoom - 通过 Provider Interface)

6. 课程执行与智能分析 (Meeting Core + Business Layer)
   - 会议状态自动同步 (Webhook → Meeting 更新 → Event 发布)
   - 业务层监听事件并处理业务逻辑
   - 录制文件自动获取 (Recording - 存储在 meetings 表)
   - AI 智能总结与分析 (AI Summary - 存储在 meetings 表)

7. 结算与计费 (Financial & Contract Domain)
   - 课程完成自动扣减权益 (Service Ledger - Append Only)
   - 自动生成导师应付账款 (Mentor Payable Ledger)
   - 账单调整与审计 (Adjustment)
```

### 不在 MVP 范围（Future）

```
❌ 复杂的支付集成 (目前仅记录)
❌ 自动打款流程
❌ 评价和反馈系统
❌ 移动端 App
```

---

## 🏗️ v4.0 架构变更：两层会议架构

### 架构演进动机

在之前的设计中，会议管理与业务逻辑耦合在一起，导致：
- 会议提供商（Feishu/Zoom）集成代码分散在各个业务模块
- 业务实体（辅导、面试、分析）重复存储会议通用数据
- 新增业务场景时需要重复实现会议管理逻辑

### 新架构设计

**v4.0 引入两层会议架构**，将会议管理职责清晰分层：

```
┌─────────────────────────────────────────────────────────┐
│           Business Layer (业务层)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Mentoring   │  │Mock Interview│  │ Gap Analysis │  │
│  │   Sessions   │  │              │  │              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│         └──────────────────┴──────────────────┘          │
│                            ↓ (FK)                        │
├─────────────────────────────────────────────────────────┤
│           Core Meeting Layer (核心会议层)                │
│  ┌──────────────────────────────────────────────────┐   │
│  │          Unified Meeting Management              │   │
│  │  (统一会议管理: meetings 表 + MeetingManager)     │   │
│  └──────────────────┬───────────────────────────────┘   │
│                     ↓                                    │
│         ┌───────────────────────┐                        │
│         │  Provider Interface   │                        │
│         ├───────────┬───────────┤                        │
│         │  Feishu   │   Zoom    │                        │
│         └───────────┴───────────┘                        │
└─────────────────────────────────────────────────────────┘
```

### 关键改进

1. **解耦与复用**: 会议管理逻辑集中在核心层，业务层只关注业务特定字段
2. **数据规范化**: 会议通用数据（链接、密码、录制等）存储在 `meetings` 表，业务表通过 FK 引用
3. **事件驱动**: Webhook 更新核心 Meeting → 发布领域事件 → 业务层订阅并处理
4. **易扩展**: 新增业务场景（如 Career Coaching）只需创建新业务表和 Service，无需改动核心层

---

## 📁 核心目录结构 (Implementation Aligned)

```
mentorx-mvp/
├── src/
│   ├── api/                              # API 层
│   │   ├── controllers/                  # Auth, User, Session, Contract, Webhook
│   │   └── dto/
│   │
│   ├── application/                      # 应用服务层
│   │   ├── commands/                     # 业务指令 (Booking, Consumption)
│   │   ├── queries/                      # 业务查询
│   │   └── sagas/                        # 流程编排
│   │
│   ├── core/                             # 核心通用模块
│   │   ├── meeting/                      # 核心会议模块 (Layer 2 - 统一管理所有会议)
│   │   │   ├── meeting.entity.ts         # Meeting 实体定义
│   │   │   ├── meeting.repository.ts     # Meeting 数据访问
│   │   │   ├── meeting-manager.service.ts # 会议管理核心服务
│   │   │   ├── meeting-query.service.ts  # 会议查询服务
│   │   │   ├── provider.interface.ts     # Provider 统一接口
│   │   │   ├── zoom-provider.ts          # Zoom 实现
│   │   │   ├── feishu-provider.ts        # 飞书 实现
│   │   │   ├── meeting.events.ts         # 会议领域事件
│   │   │   └── meeting.types.ts          # 会议类型定义
│   │   ├── webhook/                      # Webhook 处理
│   │   ├── email/                        # 邮件服务
│   │   └── notification/                 # 通知服务
│   │
│   ├── domains/                          # 领域层
│   │   ├── identity/                     # 身份域
│   │   │   ├── user/                     # 用户基础服务
│   │   │   ├── student/                  # 学生档案
│   │   │   ├── mentor/                   # 导师档案
│   │   │   └── counselor/                # 顾问档案
│   │   │
│   │   ├── contract/                     # 合同与权益域 (Core)
│   │   │   ├── services/
│   │   │   │   ├── contract.service.ts       # 合同生命周期
│   │   │   │   ├── service-ledger.service.ts # 权益流水 (Append-only)
│   │   │   │   └── service-hold.service.ts   # 权益预占
│   │   │   └── common/types/             # Snapshot, Entitlement Types
│   │   │
│   │   ├── financial/                    # 财务域 (Core)
│   │   │   ├── services/
│   │   │   │   └── mentor-payable.service.ts # 导师薪酬管理
│   │   │   └── dto/                      # Billing DTOs
│   │   │
│   │   └── services/
│   │       └── meetings/                 # 业务会议模块 (Layer 2 - 管理不同业务场景的会议)
│   │           ├── mentoring/            # 辅导会话实体
│   │           │   ├── mentoring.entity.ts       # 辅导会话实体
│   │           │   ├── mentoring.repository.ts   # 辅导数据访问
│   │           │   ├── mentoring.service.ts      # 辅导业务服务
│   │           │   └── mentoring.events.ts       # 辅导领域事件
│   │           ├── mock-interview/       # 模拟面试实体
│   │           │   ├── mock-interview.entity.ts  # 模拟面试实体
│   │           │   ├── mock-interview.repository.ts # 面试数据访问
│   │           │   ├── mock-interview.service.ts # 面试业务服务
│   │           │   └── mock-interview.events.ts  # 面试领域事件
│   │           ├── gap-analysis/         # 差距分析实体
│   │           │   ├── gap-analysis.entity.ts    # 差距分析实体
│   │           │   ├── gap-analysis.repository.ts # 分析数据访问
│   │           │   ├── gap-analysis.service.ts   # 分析业务服务
│   │           │   └── gap-analysis.events.ts    # 分析领域事件
│   │           └── meetings.types.ts     # 业务会议通用类型
│   │
│   └── infrastructure/                   # 基础设施
│       ├── database/                     # Drizzle ORM, Schema
│       └── auth/                         # Supabase Auth
│
├── infrastructure/database/schema/       # 数据库 Schema 定义
│   ├── contracts.schema.ts               # 合同相关表
│   ├── finance.schema.ts                 # 财务相关表
│   ├── meetings.schema.ts                # 核心会议表 (meetings)
│   ├── mentoring.schema.ts               # 辅导会话表 (mentoring_sessions)
│   ├── mock-interview.schema.ts          # 面试表 (mock_interviews)
│   ├── gap-analysis.schema.ts            # 分析表 (gap_analyses)
│   └── ...
```

---

## 🔄 核心流程设计 (Updated)

### 流程 1: 权益购买与激活 (Contract Domain)

**设计变更**: 引入 `ProductSnapshot` 确保合同不可变性；权益在学生层级聚合，而非单合同隔离。

```
步骤 1: 创建合同
POST /api/contracts
Body: { studentId, productId, productSnapshot... }
  ↓
ContractService.create()
  - 生成唯一 Contract Number
  - 保存 Product Snapshot
  - 状态: SIGNED

步骤 2: 激活合同 (支付成功后)
ContractService.activate(contractId)
  - 状态更新: ACTIVE
  - 解析 Product Snapshot -> 生成 ContractEntitlements
  - 权益累加到学生名下 (Student-level Entitlements)
```

### 流程 2: 预约与权益预占 (Meeting + Business Entity + Contract Domain)

**设计变更**: 
- 预占 (`ServiceHold`) 基于 `studentId` + `serviceType`，支持跨合同扣减
- **两层会议架构**: 先创建核心 Meeting 实体，再创建业务实体 (Mentoring/MockInterview/GapAnalysis)

```
请求: POST /api/bookings
Body: { studentId, mentorId, serviceType, scheduledTime... }

Booking Process:
1. 检查余额: 
   ServiceLedgerService.calculateAvailableBalance(studentId, serviceType)
   - 聚合该学生所有 Active 合同的权益
   - Available = Total - Consumed - Held

2. 创建预占:
   ServiceHoldService.createHold()
   - 创建 ServiceHold 记录
   - 减少可用余额 (触发器或逻辑控制)

3. 创建核心会议 (Core Layer):
   MeetingManagerService.createMeeting()
   - 通过 Provider Interface 调用 Feishu/Zoom
   - 生成会议链接、会议号、密码等
   - 保存到 meetings 表 (Status: SCHEDULED)
   - 返回 meeting_id

4. 创建业务实体 (Business Layer):
   根据 serviceType 创建对应业务实体:
   - MentoringService.create() → mentoring_sessions 表
   - MockInterviewService.create() → mock_interviews 表
   - GapAnalysisService.create() → gap_analyses 表
   - 关联 meeting_id (FK)
   - 关联 Hold ID
```

### 流程 3: 会议执行与事件驱动 (Meeting Core + Business Layer)

**设计变更**: 
- 引入 Webhook 事件驱动的状态流转、录制获取和 AI 分析
- **两层更新机制**: Webhook 更新核心 Meeting 实体，通过领域事件通知业务层

```
Webhook 事件 (Feishu/Zoom):
1. Meeting Started:
   WebhookController -> MeetingManagerService.updateStatus()
   - 更新 meetings 表 (Status: STARTED)
   - 发布 MeetingStartedEvent
   - Business Layer Subscribers 监听事件并更新业务实体状态

2. Meeting Ended:
   WebhookController -> MeetingManagerService.handleMeetingEnded()
   - 更新 meetings 表 (Status: ENDED)
   - 计算实际时长 (从 webhook payload 提取时间段)
   - 发布 MeetingEndedEvent
   - Business Layer Subscribers 处理结算逻辑

3. Recording Ready:
   WebhookController -> MeetingManagerService.appendRecording()
   - 更新 meetings.recordings (JSONB)
   - 发布 RecordingReadyEvent
   - TranscriptPollingService.start() -> 拉取逐字稿
   - AISummaryService.generateSummary() -> 生成 AI 总结并存储
```

### 流程 4: 自动结算与计费 (Financial + Contract Domain)

**设计变更**: 
- **权益扣减**: 使用 Append-only `ServiceLedger`，基于 `studentId`。
- **导师薪酬**: 使用 Immutable `MentorPayableLedger`，调整通过新增记录实现。

```
触发时机: Session Completed (Event / Manual)

1. 扣减权益 (Contract Domain):
   ServiceLedgerService.recordConsumption()
   - 释放 ServiceHold
   - 插入 ServiceLedger (Type: CONSUMPTION, Quantity: -1)
   - 更新 Balance (触发器或计算)

2. 记录薪酬 (Financial Domain):
   MentorPayableService.createPerSessionBilling()
   - 获取 MentorPrice (基于 ServiceType)
   - 计算 Amount (Price * Duration)
   - 插入 MentorPayableLedger (Source: SESSION, Status: PENDING)

3. 薪酬调整 (如需):
   MentorPayableService.adjustPayableLedger()
   - 不修改原记录
   - 插入新记录 (OriginalId -> OldLedger, Amount: +/- Diff)
```

---

## 🗄️ 核心数据模型 (Updated - Two-Layer Architecture)

### Contract Domain
- **contracts**: 合同主表 (Snapshot, Status)
- **contract_service_entitlements**: 权益表 (StudentId, ServiceType, Total, Consumed, Held)
- **service_ledgers**: 权益流水表 (StudentId, Quantity, Type, Immutable)
- **service_holds**: 预占表 (StudentId, Quantity, Expiry)

### Financial Domain
- **mentor_prices**: 导师定价配置
- **mentor_payable_ledgers**: 应付账款流水 (Immutable, SourceEntity: Session/Contract)

### Meeting Domain (Two-Layer Structure)

#### Core Meeting Layer (核心会议层)
- **meetings**: 核心会议表 (统一管理所有会议)
  - `id`: UUID (主键)
  - `title`: 会议标题
  - `start_time`: 开始时间
  - `end_time`: 结束时间
  - `provider`: 'feishu' | 'zoom' (提供商)
  - `provider_meeting_id`: 外部会议ID (Webhook Key)
  - `meeting_link`: 会议链接
  - `meeting_password`: 会议密码
  - `metadata`: JSONB (会议元数据)
  - `status`: enum (scheduled/started/ended/cancelled)
  - `created_at`, `updated_at`: 时间戳

#### Business Meeting Layer (业务会议层)
- **mentoring_sessions**: 辅导会话表
  - `id`: UUID (主键)
  - `meeting_id`: UUID (FK → meetings.id)
  - `student_id`, `mentor_id`, `contract_id`: 业务关联
  - `service_type`: 服务类型
  - `duration_hours`: 时长
  - `status`: 状态
  - `notes`, `mentor_feedback`: 业务字段
  - `completed_at`, `created_at`, `updated_at`

- **mock_interviews**: 模拟面试表
  - `id`: UUID (主键)
  - `meeting_id`: UUID (FK → meetings.id)
  - `student_id`, `interviewer_id`: 业务关联
  - `interview_type`: 面试类型 (technical/behavioral/case)
  - `position_level`, `company_target`: 业务字段
  - `preparation_materials`, `feedback`, `scores`: JSONB
  - `recording_url`: 录制链接
  - `status`, `completed_at`, `created_at`, `updated_at`

- **gap_analyses**: 差距分析表
  - `id`: UUID (主键)
  - `meeting_id`: UUID (FK → meetings.id)
  - `student_id`, `analyst_id`: 业务关联
  - `analysis_focus`: 分析重点 (resume/profile/skills/career)
  - `current_level`, `target_level`: 当前与目标水平
  - `gap_areas`, `strengths`, `weaknesses`: JSONB
  - `action_plan`, `recommendations`: JSONB
  - `status`, `completed_at`, `created_at`, `updated_at`

---

## 📝 关键设计决策回顾

### 1. 学生级权益池 (Student-level Entitlements)
**决策**: 权益不再死锁在单个合同上，而是归集到学生名下的权益池（按服务类型）。
**原因**: 简化扣减逻辑，优先消费旧权益（FIFO）或特定优先级权益，提升用户体验。
**实现**: `ServiceLedger` 和 `ServiceHold` 主要通过 `studentId` 和 `serviceType` 索引。

### 2. 财务数据不可变性 (Immutability)
**决策**: `ServiceLedger` 和 `MentorPayableLedger` 均为 Append-only。
**原因**: 审计要求，确保历史数据可追溯。
**实现**: 调整金额时插入新的 Ledger 记录（`type: adjustment` 或 `originalId` 关联），而不是 Update 原记录。

### 3. 两层会议架构 (Two-Layer Meeting Architecture)
**决策**: 将会议管理分为核心层 (Core Meeting Layer) 和业务层 (Business Meeting Layer)。
**原因**: 
- **解耦**: 会议提供商集成（Feishu/Zoom）与业务逻辑分离，降低耦合度
- **复用**: 核心会议能力可被多种业务场景共享（辅导、面试、分析等）
- **扩展**: 新增业务场景无需修改核心会议模块
- **数据规范化**: 会议通用数据（链接、密码、录制等）集中管理，避免冗余

**实现**: 
- **Core Layer** (`src/core/meeting/`): 
  - 统一的 Meeting 实体和 Repository
  - Provider Interface 抽象 (Feishu/Zoom)
  - Webhook 处理和事件发布
- **Business Layer** (`src/domains/services/meetings/`): 
  - 业务实体 (Mentoring, MockInterview, GapAnalysis)
  - 通过 FK 关联核心 Meeting
  - 订阅核心会议事件，处理业务逻辑

### 4. 会议与 AI 集成
**决策**: 核心会议模块深度集成会议平台和 AI 能力。
**原因**: 自动化业务闭环（自动开始/结束/录制/分析）。
**实现**: 
- `MeetingProvider` 抽象层，统一 Feishu/Zoom 接口
- `Webhook` 异步处理状态变更和录制通知
- `AISummaryService` 调用 LLM 生成会议纪要（存储在 meetings 表）

### 5. 归档策略 (Archive Policy)
**决策**: 支持流水数据的冷热分离（虽 MVP 暂未强制，但设计已就绪）。
**原因**: 随着流水增加，查询性能可能下降。
**实现**: `contracts` 包含归档相关表结构设计。

---

## ✅ MVP 验收标准 (Updated)

### 功能验收

```
✅ 学生/导师/顾问 基础档案流程跑通
✅ 合同创建后，学生权益余额正确增加
✅ 预约时：
   - 权益被正确预占 (Hold)
   - 核心 Meeting 记录创建成功 (meetings 表)
   - 业务实体创建成功 (mentoring_sessions/mock_interviews/gap_analyses)
   - 业务实体正确关联 meeting_id (FK)
✅ 会议结束后：
   - Meeting 状态自动更新为 ENDED (meetings 表)
   - Business Entity 状态自动更新为 COMPLETED
   - 权益自动扣减 (Service Ledger)
   - 导师薪酬记录自动生成 (Mentor Payable)
   - 能够获取到录音文件和 AI 总结 (存储在 meetings 表)
✅ 财务数据调整有完整记录
✅ 核心会议层与业务层正确解耦，事件驱动通信正常
```

### 技术指标

```
✅ 核心业务 (Booking, Billing) 事务一致性
✅ Webhook 处理幂等性
✅ API 响应时间 < 500ms
```