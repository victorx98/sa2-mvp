# Session Domain 详细设计文档

**文档版本**: v3.3
**更新日期**: 2025-11-10
**作者**: Architecture Team
**说明**: 基于v3.2版本优化，Calendar模块改采用PostgreSQL排斥约束（EXCLUDE USING GIST）的原子占用方案，无需应用层竞态控制

---

## 📦 1. 模块总览

| 模块名称 | 位置路径 | 核心职责 | 架构定位 | 依赖关系 |
|---------|--------|--------|--------|--------|
| Session Domain | src/domains/services/session/ | Session记录CRUD、生命周期管理、录制管理 | 核心业务域 | 依赖: Calendar, MeetingProviders, Notification |
| Calendar Module | src/core/calendar/ | 原子时间段占用（数据库约束驱动）| 基础设施层 | 被依赖: Session Domain |
| Meeting Providers | src/core/meeting-providers/ | 飞书/Zoom会议集成、工厂模式 | 基础设施层 | 被依赖: Session Domain |
| Webhook Module | src/core/webhook/ | 接收飞书/Zoom事件、签名验证、事件分发 | 基础设施层 | 调用: Session Domain |
| Notification Module | src/core/notification/ | 邮件发送服务、定时通知队列 | 基础设施层 | 被依赖: Session Domain, BFF Layer |
| Feishu Auth | src/core/auth/feishu/ | 飞书扫码登录、OAuth 2.0授权 | 基础设施层 | 独立模块 |
| Feishu Bot | src/core/feishu/bot/ | 飞书卡片消息发送、Bot管理 | 基础设施层 | 被依赖: Notification Module |
| Email Service | src/core/email/ | 邮件发送、模板管理 | 基础设施层 | 被依赖: Notification Module |
| BFF Layer | src/operations/*/ | 流程编排、聚合调用、DTO转换 | 业务编排层 | 调用: 所有Domain和Infrastructure模块 |

---

## 🏗️ 2. 架构设计原则

### 2.1 核心设计变更

| 层级 | 职责 | 示例 | 特点 |
|-----|-----|-----|-----|
| BFF层（Business Flow Facade） | 流程编排、聚合调用、事务控制 | SessionController.createSession() 依次调用多个Service | 控制业务流程，不包含业务逻辑 |
| Domain层 | 提供原子操作，返回Plain Object | SessionService.createSession() 仅创建记录 | 单一职责，可独立测试 |
| Infrastructure层 | 提供基础能力服务 | CalendarService（数据库约束驱动） | 技术性服务，可被多个Domain复用 |

### 2.2 设计优势

| 优势 | 说明 |
|-----|-----|
| 职责清晰 | 每个Domain Service只负责自己的核心业务，不涉及跨域调用 |
| 易于测试 | 可以单独mock每个Service，测试粒度更细 |
| 易于理解 | 流程在BFF层一目了然，不需要追踪事件链路 |
| 性能更好 | 减少事件发布/订阅的开销，同步调用更直接 |
| 易于扩展 | 新增业务流程只需在BFF层编排，不影响Domain层 |

---

[... Sections 3 remains identical until section 4 ...]

## 🗓️ 4. Calendar Module（PostgreSQL 约束驱动方案）

**位置**: `src/core/calendar/`

**核心原理**: 使用 PostgreSQL 排斥约束（EXCLUDE USING GIST）在数据库层面自动防止时间段重叠，无需应用层竞态控制

### 4.1 设计理念

#### 4.1.1 与传统方案对比

| 维度 | 旧方案（应用层控制） | 新方案（数据库约束） |
|-----|----------------|----------------|
| 冲突检测 | `SELECT COUNT(*)`查询 + `INSERT` | 单条 `INSERT`，由EXCLUDE约束判定 |
| 并发安全 | 应用层加锁/分布式锁 | PostgreSQL MVCC + GiST索引自动处理 |
| 失败处理 | 返回 `false` 或异常 | 捕获 `SQLSTATE 23P01`（排斥约束违反） |
| 竞态风险 | 查询与写入间存在时间窗口 | 无窗口，语句级原子执行 |
| 应用复杂度 | 中等（需要锁管理）| 低（数据库兜底） |

####  4.1.2 核心优势

✅ **原子性**: 一条SQL（INSERT/UPDATE）内部完成"可用性检查+占用"，无竞态窗口
✅ **并发安全**: PostgreSQL的MVCC与排斥约束自动处理并发冲突  
✅ **简洁高效**: 应用层无需分布式锁或复杂的锁管理，仅需处理插入失败（SQLSTATE 23P01）
✅ **时间语义**: 统一UTC+半开区间`[start,end)`，相邻时间段不冲突

### 4.2 目录结构

```
calendar/
├── services/
│   └── calendar.service.ts                # 高级时间段管理API
├── repositories/
│   └── calendar-slot.repository.ts        # 原子操作数据访问层
├── dto/
│   ├── create-slot.dto.ts                 # 创建时间段DTO
│   ├── query-slot.dto.ts                  # 查询时间段DTO
│   └── create-service-hold-result.dto.ts  # 操作结果DTO
├── exceptions/
│   └── calendar.exception.ts              # 日历异常定义
└── interfaces/
    └── calendar-slot.interface.ts         # CalendarSlot接口定义
```

### 4.3 CalendarService API

**文件路径**: `src/core/calendar/services/calendar.service.ts`

#### 4.3.1 核心方法

| 方法 | 参数 | 返回值 | 功能说明 | 调用者 |
|-----|-----|------|--------|------|
| `createSlotDirect(dto)` | CreateSlotDto | CalendarSlotEntity \| null | 直接占用时间段，冲突返回null（SQLSTATE 23P01） | BFF层 |
| `getSlotBySessionId(sessionId)` | sessionId: UUID | CalendarSlotEntity \| null | 根据session_id查询占用记录 | BFF层 |
| `releaseSlot(slotId)` | slotId: UUID | boolean | 取消占用（status → cancelled） | BFF层 |
| `getOccupiedSlots(dto)` | QuerySlotDto | CalendarSlotEntity[] | 批量查询占用时段 | BFF层 |
| `isSlotAvailable(...)` | 用户ID、用户类型、时间 | boolean | 查询时间段可用性（仅用于UI预览） | BFF层 |
| `blockTimeSlot(...)` | 用户ID、用户类型、时间、原因 | CalendarSlotEntity \| null | 用户设置不可用时间 | BFF层 |
| `rescheduleSlot(...)` | 旧槽位ID、新时间 | CalendarSlotEntity \| null | 改期（原子：释放旧+占用新） | BFF层 |

#### 4.3.2 设计原则

**原则1：直接插入，让数据库防护**

❌ 不要这样做（有竞态风险）:
```typescript
const available = await isSlotAvailable(...);
if (available) {
  return await createSlot(...);  // 竞态窗口
}
```

✅ 应该这样做（原子安全）:
```typescript
try {
  return await createSlotDirect(dto);  // 单条INSERT，带EXCLUDE约束
} catch (error) {
  if (error.code === '23P01') {  // 排斥约束冲突
    return null;
  }
  throw error;
}
```

**原则2：isSlotAvailable() 仅用于UI反馈**

- 该方法执行SELECT查询，**不参与写操作决策**
- 用于前端"实时显示可用性"，但**最终以写入时的约束为准**
- 避免应用层自作聪明的"先查再写"

**原则3：所有时间采用UTC+半开区间[start,end)**

- 相邻时间段`[10:00,10:30)`与`[10:30,11:00)`**不冲突**
- 避免边界off-by-one误判

### 4.4 DTO定义

#### 4.4.1 CreateSlotDto

**文件路径**: `src/core/calendar/dto/create-slot.dto.ts`

| 字段名 | 类型 | 必填 | 说明 | 示例值 | 验证规则 |
|------|-----|-----|-----|------|--------|
| userId | UUID | 是 | 用户ID | "uuid-user-123" | 必须为有效UUID，必须存在于user表 |
| userType | Enum | 是 | 用户类型 | "mentor" | 'mentor' \| 'student' \| 'counselor' |
| startTime | DateTime | 是 | 开始时间（UTC） | "2025-11-10T14:00:00Z" | 必须晚于当前时间 |
| durationMinutes | Integer | 是 | 时长（分钟） | 60 | 30 <= duration <= 180 |
| sessionId | UUID | 否 | 关联的session_id | "uuid-session-123" | - |
| slotType | Enum | 是 | 时间段类型 | "session" | 'session' \| 'class_session' |
| reason | String | 否 | 备注信息 | "导师休假" | 最大255字符 |

#### 4.4.2 CalendarSlotEntity

**文件路径**: `src/core/calendar/interfaces/calendar-slot.interface.ts`

| 字段名 | 类型 | 说明 | 示例值 |
|------|-----|-----|------|
| id | UUID | 主键 | "uuid-slot-123" |
| userId | UUID | 用户ID | "uuid-user-123" |
| userType | String | 用户类型 | "mentor" \| "student" \| "counselor" |
| timeRange | TSTZRANGE | 半开区间时间范围 | `[2025-11-10 14:00:00+00, 2025-11-10 15:00:00+00)` |
| startTime | DateTime | 开始时间（从timeRange解析） | "2025-11-10T14:00:00Z" |
| endTime | DateTime | 结束时间（从timeRange解析） | "2025-11-10T15:00:00Z" |
| durationMinutes | Integer | 时长（分钟） | 60 |
| sessionId | UUID \| null | 关联的session_id | "uuid-session-123" |
| slotType | String | 时间段类型 | "session" \| "class_session" |
| status | String | 预订状态 | "booked" \| "cancelled" |
| reason | String \| null | 备注信息 | "导师休假" |
| createdAt | DateTime | 创建时间 | "2025-11-05T10:00:00Z" |
| updatedAt | DateTime | 更新时间 | "2025-11-05T10:00:00Z" |

### 4.5 CalendarRepository（原子操作层）

**文件路径**: `src/core/calendar/repositories/calendar-slot.repository.ts`

#### 4.5.1 核心SQL操作

**直接占用（INSERT，带约束保护）**:
```sql
INSERT INTO calendar_slots (
  user_id, user_type, time_range,
  duration_minutes, session_id, slot_type, status, reason
) VALUES (
  $1, $2, tstzrange($3, $4, '[)'),  -- 半开区间
  $5, $6, $7, 'booked', $8
)
RETURNING *;
-- 若冲突：抛异常SQLSTATE 23P01（排斥约束违反）
```

**可用性查询（SELECT，仅用于展示）**:
```sql
-- 注：user_type 在查询中保留用于二级过滤和索引优化
-- 但数据库约束（EXCLUDE）只使用 user_id + time_range
SELECT NOT EXISTS (
  SELECT 1 FROM calendar_slots
  WHERE user_id = $1
    AND user_type = $2
    AND status = 'booked'
    AND time_range && tstzrange($3, $4, '[)')
) AS is_free;
```

**释放占用（UPDATE）**:
```sql
UPDATE calendar_slots
SET status = 'cancelled', updated_at = NOW()
WHERE id = $1 AND status = 'booked'
RETURNING *;
```

**改期操作（事务：释放旧+占用新）**:
```sql
BEGIN;
  -- Step 1: 释放旧槽位
  UPDATE calendar_slots
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = $1;
  
  -- Step 2: 占用新槽位（可能被EXCLUDE约束拒绝）
  INSERT INTO calendar_slots (...)
  VALUES (...)
  RETURNING *;
COMMIT;
```

---

## 📊 11. 数据库表设计

### 11.3 calendar_slots表（关键变更）

**表名**: `calendar_slots`

**新设计：基于PostgreSQL TSTZRANGE + EXCLUDE约束，专注用户日历管理**

| 字段名 | 类型 | 说明 | 索引 | 约束 |
|------|-----|-----|-----|-----|
| id | UUID | 主键 | PK | NOT NULL |
| user_id | UUID | 用户ID（mentor/student/counselor） | INDEX | NOT NULL, FK(users.id) |
| user_type | VARCHAR(30) | 用户类型 | - | NOT NULL, CHECK IN ('mentor', 'student', 'counselor') |
| **time_range** | **TSTZRANGE** | **半开区间时间范围[start,end)** | **GIST** | **NOT NULL** |
| duration_minutes | INTEGER | 时长（分钟） | - | NOT NULL, CHECK 30-180 |
| session_id | UUID | 关联session | INDEX | NULLABLE, FK(sessions.id) |
| slot_type | VARCHAR(30) | 时间段类型 | - | NOT NULL, CHECK IN ('session', 'class_session') |
| status | VARCHAR(20) | 预订状态 | - | NOT NULL, DEFAULT 'booked', CHECK IN ('booked', 'cancelled') |
| reason | VARCHAR(255) | 备注信息 | - | NULLABLE |
| created_at | TIMESTAMP | 创建时间 | - | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP | 更新时间 | - | NOT NULL, DEFAULT NOW() |

**原子冲突防护约束**:
```sql
-- 关键：排斥约束，自动防止同一用户时间段重叠
-- 注：user_type 在约束中被移除，因为每个 user_id 在系统中只有唯一的身份
-- 在 users 表的 role/type 字段中维护用户身份，calendar_slots 中的 user_type
-- 仅作为冗余字段用于查询优化，不参与冲突检查
EXCLUDE USING GIST (
  user_id WITH =,
  time_range WITH &&
) WHERE (status = 'booked');
-- 说明: 同一用户(user_id)的status='booked'时间段不允许相交
--      已取消的(status='cancelled')记录不参与冲突检查
--      user_type 是冗余字段，用于提高查询性能
```

**完整DDL**:
```sql
CREATE TABLE calendar_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type VARCHAR(50) NOT NULL,
  time_range TSTZRANGE NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 30 AND duration_minutes <= 180),
  session_id UUID,
  slot_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'booked',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 用户类型约束
  CHECK (user_type IN ('mentor', 'student', 'counselor')),
  
  -- slot_type约束
  CHECK (slot_type IN ('session', 'class_session')),
  
  -- status约束
  CHECK (status IN ('booked', 'cancelled')),
  
  -- 排斥约束：防止时间范围重叠（仅对booked状态生效）
  -- 注：每个user_id只有唯一的身份，无需在约束中包含user_type
  EXCLUDE USING GIST (
    user_id WITH =,
    time_range WITH &&
  ) WHERE (status = 'booked'),
  
  -- 外键约束
  CONSTRAINT fk_session_id FOREIGN KEY (session_id) REFERENCES sessions (id),
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users (id)
);

-- 性能索引
CREATE INDEX idx_calendar_user ON calendar_slots (user_id, user_type);
CREATE INDEX idx_calendar_timerange ON calendar_slots USING GIST (time_range);
CREATE INDEX idx_calendar_session ON calendar_slots (session_id);
```

**原理说明**:

- **TSTZRANGE**: PostgreSQL原生的"带时区时间范围"类型
- **半开区间[start,end)**: 相邻时间段`[10:00,10:30)`和`[10:30,11:00)`**不冲突**
- **GiST索引**: 支持范围相交查询(`&&`操作符)和排斥约束
- **EXCLUDE约束**: 若新INSERT的time_range与某个existing占用时段相交，PostgreSQL直接拒绝，错误码SQLSTATE 23P01
- **WHERE条件**: 只对status='booked'生效，已取消(cancelled)记录不再阻止新占用

**user_type 在约束中的处理**:

- **为什么移除 user_type？** 每个 user_id 在系统中只有唯一的身份（mentor/student/counselor），无需在约束中包含 user_type
- **EXCLUDE 约束优化**: 仅包含 `user_id + time_range` 两列，约束更简洁、GiST 索引更高效
- **user_type 仍保留**: 在 SELECT 查询中作为二级过滤条件，可利用索引提高查询速度
- **冗余字段的价值**: user_type 字段冗余存储来自 users 表，用于避免 JOIN 开销和提高查询性能

---

## 🔄 12. 约课业务流程（更新版）

### 12.1 创建约课流程（简化）

```
前端请求
  ↓
┌─────────────────────────────────────────┐
│ BFF层: SessionController.createSession() │
└─────────────────────────────────────────┘
  ↓
  │ Step 1: 创建session记录
  │ SessionService.createSession(CreateSessionDto)
  ↓
  │ Step 2: 创建会议室
  │ provider.createMeeting(...)
  ↓
  │ Step 3: 更新session会议信息
  │ SessionService.updateMeetingInfo(...)
  ↓
  │ Step 4: 直接占用日历（让DB防护）
  │ CalendarService.createSlotDirect(CreateSlotDto)
  │ 若冲突(SQLSTATE 23P01) → 回滚transaction
  ↓
  │ Step 5: 生成定时通知
  │ NotificationQueueService.enqueue(...)
  ↓
  │ Step 6: 发送邮件
  │ NotificationService.sendSessionCreatedEmail(...)
  ↓
返回前端: { sessionId, meetingUrl, status, ... }
```

**关键变化**: 无需Step 0的"先查询可用性"，直接INSERT，让DB的EXCLUDE约束防护

---

## ✅ 13. 核心设计原则总结

| 原则 | 说明 | 体现 |
|-----|-----|-----|
| BFF层编排 | 流程控制在BFF层，Domain层提供原子操作 | SessionController编排创建约课的6个步骤 |
| 职责分离 | 每个Service职责单一，不跨域调用 | SessionService只负责session记录CRUD |
| 依赖倒置 | 依赖抽象而非具体实现 | IMeetingProvider接口，工厂模式 |
| **数据库防护** | **数据库层面保证数据一致性** | **EXCLUDE约束自动防止时间冲突，无竞态** |
| 事件溯源 | 单一数据源，支持重新计算 | 时长统计从session_event溯源计算 |
| Webhook集中管理 | 统一入口、签名验证、事件分发 | src/core/webhook统一管理第三方回调 |
| DTO明确定义 | 所有输入输出参数类型明确 | 本文档详细定义所有DTO结构 |
| 类型安全 | 避免使用Plain Object，明确返回类型 | SessionEntity、CalendarSlotEntity等 |
| 主键统一 | 所有表主键统一使用id | session.id、user.id、contract.id等 |

---

## 📚 参考资源

本设计方案的详细技术说明，参见: `/calendar_postgres_design.md`

该文档包含:
- PostgreSQL排斥约束的完整原理
- 并发竞争演示（两窗口演示脚本）
- 常见误区与对策
- 运维与工程实践清单

---

**文档结束**
