# Calendar Module Design v5.3

**文档版本**: v5.3  
**更新日期**: 2025-11-24  
**所属系统**: SA2 MVP  
**模块定位**: Core Layer - 时间占位 + 冲突检测 + 日历查询  
**基于实现**: calendar.service.ts (v3.5) + 新增 v5.3 需求

---

## 📐 1. 模块概述

| 维度 | 说明 |
|:---|:---|
| **核心职责** | 时间占位、冲突检测、日历视图、状态同步 |
| **架构层级** | Core Layer（核心基础设施层）|
| **技术特性** | Read Model + GIST 排他约束 + 事件监听 |
| **一致性模型** | 最终一致性（事件驱动同步 < 100ms）|
| **查询性能** | 单表查询 < 50ms |

**设计原则**:
- ✅ 事件驱动更新（监听 `services.session.completed` 事件）
- ✅ 单表查询优化（冗余字段 title, scheduled_start_time）
- ✅ 数据库级别冲突检测（EXCLUDE 约束）
- ❌ 不承担业务逻辑
- ❌ 不作为权威数据源

---

## 📊 2. 数据库设计

### 2.1 表结构：calendar

| 字段名 | 类型 | 约束 | 默认值 | 说明 | 版本 |
|:---|:---|:---|:---|:---|:---|
| id | UUID | PK | uuid_generate_v4() | 主键 | v3.5 ✅ |
| user_id | UUID | NOT NULL, FK | - | 用户 ID（导师/学生/顾问）| v3.5 ✅ |
| user_type | VARCHAR(20) | NOT NULL | - | `mentor`, `student`, `counselor` | v3.5 ✅ |
| time_range | TSTZRANGE | NOT NULL | - | 时间范围 `[start, end)` | v3.5 ✅ |
| duration_minutes | INT | NOT NULL | - | 时长（30-180 分钟）| v3.5 ✅ |
| session_id | UUID | NULLABLE | - | 关联的会话 ID | v3.5 ✅ |
| type | VARCHAR(50) | NOT NULL | - | slot 类型（待废弃）| v3.5 ⚠️ |
| **session_type** | VARCHAR(50) | **NOT NULL** | - | **会话类型**（5 种）| v5.3 🆕 |
| **title** | VARCHAR(255) | **NOT NULL** | - | **课程标题** | v5.3 🆕 |
| **scheduled_start_time** | TIMESTAMPTZ | **NOT NULL** | - | **预约开始时间**（冗余，查询优化）| v5.3 🆕 |
| status | VARCHAR(20) | NOT NULL | `booked` | `booked`, `completed`, `cancelled` | v3.5 ✅ |
| **metadata** | JSONB | | `'{}'` | **快照数据**（otherPartyName, meetingUrl）| v5.3 🆕 |
| reason | TEXT | NULLABLE | - | 占用/阻止原因 | v3.5 ✅ |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 | v3.5 ✅ |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 | v3.5 ✅ |

**字段演进说明：**
- v3.5 字段：完全保留，向后兼容
- v5.3 新增字段：支持多类型课时、查询优化、快照数据
- `type` 字段：保留但标记为待废弃，后续迁移到 `session_type`

---

### 2.2 枚举值定义

| 枚举类型 | 可选值 | 说明 |
|:---|:---|:---|
| **user_type** | `mentor` | 导师 |
| | `student` | 学生 |
| | `counselor` | 顾问 |
| **session_type** 🆕 | `regular_mentoring` | 常规辅导 |
| | `gap_analysis` | Gap 分析 |
| | `ai_career` | AI 职业测评 |
| | `comm_session` | 沟通课 |
| | `class_session` | 班课 |
| **type** (数据库字段，待废弃) ⚠️ | `session` | 一对一约课（仅数据库保留）|
| | `class_session` | 课程约课（仅数据库保留）|
| | `comm_session` | 沟通约课（仅数据库保留）|
| **status** | `booked` | 已预约（参与冲突检测）|
| | `completed` | 已完成（不参与冲突检测）|
| | `cancelled` | 已取消（不参与冲突检测）|

**重要说明：**
- ✅ 应用层统一使用 `session_type`（5 种类型）
- ⚠️ 数据库表保留 `type` 字段（向后兼容），但 DTO/Entity 中已删除
- 🔄 后续迁移时，将数据从 `type` 迁移到 `session_type`，然后删除 `type` 列

---

### 2.3 索引设计

| 索引名称 | 字段 | 类型 | 用途 |
|:---|:---|:---|:---|
| idx_calendar_user_scheduled | (user_id, scheduled_start_time DESC) | B-tree | 用户日程列表查询（高频）|
| idx_calendar_session | (session_id) | B-tree | 会话反查（通过 session_id 查询 calendar）|
| idx_calendar_status | (status) | B-tree | 状态过滤 |
| idx_calendar_time_range | (time_range) | GIST | 时间范围查询、冲突检测 |

**注意：** `idx_calendar_user_scheduled` 使用 v5.3 新增的 `scheduled_start_time` 字段优化查询性能

---

### 2.4 约束设计

| 约束类型 | 约束名称 | 定义 | 说明 |
|:---|:---|:---|:---|
| **排他约束** ⭐ | exclude_calendar_time_overlap | `EXCLUDE USING GIST (user_id WITH =, time_range WITH &&) WHERE (status = 'booked')` | 防止同一用户时间重叠（核心功能）|
| **CHECK** | check_calendar_user_type | `user_type IN ('mentor', 'student', 'counselor')` | 用户类型校验 |
| **CHECK** | check_calendar_session_type 🆕 | `session_type IN ('regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session')` | 会话类型校验 |
| **CHECK** | check_calendar_status | `status IN ('booked', 'completed', 'cancelled')` | 状态校验 |
| **CHECK** | check_calendar_duration | `duration_minutes >= 30 AND <= 180` | 时长范围校验 |
| **外键** | fk_calendar_user | `user_id REFERENCES users(id) ON DELETE CASCADE` | 用户关联 |

**排他约束说明：**
- ⚠️ **UPDATE 时会重新触发约束检查**（修改 time_range 时自动检测冲突）
- ✅ 如果新时间段与其他 `booked` 记录冲突，UPDATE 会失败并抛出 `23P01` 错误
- ✅ `cancelled` 或 `completed` 状态的记录不参与冲突检测

---

### 2.5 JSONB Metadata 结构

| 字段名 | 类型 | 说明 | 同步策略 |
|:---|:---|:---|:---|
| otherPartyName | string | 对方姓名（导师/学生）| ❌ 不同步（历史快照）|
| meetingUrl | string | 会议入会链接 | ✅ 同步（权威数据）|

**示例数据**:
```json
{
  "otherPartyName": "张三",
  "meetingUrl": "https://meetings.feishu.cn/j/123456789"
}
```

---

## 🔄 3. 核心业务场景

### 3.1 场景汇总表

| 场景 | 触发时机 | 操作类型 | 同步方式 | 涉及函数 |
|:---|:---|:---|:---|:---|
| **约课创建** | 顾问约课 | INSERT | 事务内 | `createSlot()` |
| **冲突检测** | INSERT/UPDATE | 自动 | 排他约束 | EXCLUDE 约束 |
| **关联 session** | 创建课时后 | UPDATE | 事务内 | `updateSlotSessionId()` |
| **修改信息** | 顾问编辑（标题/时间/metadata）| UPDATE | 事务内 | `updateSlot()` ⭐ |
| **完成课时** | Session 完成 | UPDATE | 事件驱动 | `updateSlot()` + Listener ⭐ |
| **取消课时** | 用户取消 | UPDATE | 直接调用 | `cancelSlot()` |
| **日历查询** | 用户浏览 | SELECT | - | `getCalendarEvents()` |
| **列表查询** | 用户查看 | SELECT | - | `getBookedSlots()` |

---

### 3.2 数据一致性策略

| 字段 | 一致性级别 | 同步时机 | 同步方式 | 理由 |
|:---|:---|:---|:---|:---|
| **title** | 强一致 | 编辑标题时 | 事务内 `updateSlot()` | 频繁编辑，用户可见 |
| **time_range** | 强一致 | 修改时间时 | 事务内 `updateSlot()` | 影响冲突检测 |
| **scheduled_start_time** | 强一致 | 修改时间时 | 事务内 `updateSlot()` | 查询优化字段，需同步 |
| **status** | 最终一致 | 完成/取消时 | 事件驱动 `updateSlot()`（< 100ms）| 影响业务流程 |
| **metadata.meetingUrl** | 强一致 | 修改时间时 | 事务内 `updateSlot()` | 影响用户入会 |
| **metadata.otherPartyName** | 弱一致 | - | ❌ 不同步 | 历史快照，允许过期 |

---

## 🏗️ 4. 代码结构设计

### 4.1 目录结构

```
src/core/calendar/
├── entities/
│   └── calendar.entity.ts
├── dto/
│   ├── create-slot.dto.ts               # v3.5 ✅ + v5.3 扩展
│   ├── update-slot.dto.ts               # v5.3 🆕
│   └── query-slot.dto.ts                # v3.5 ✅ + v5.3 扩展
├── interfaces/
│   └── calendar-slot.interface.ts       # v3.5 ✅ + v5.3 扩展
├── services/
│   ├── calendar.service.ts              # 写入服务 (v3.5 ✅ + v5.3 优化)
│   └── calendar-query.service.ts        # 查询服务 (v5.3 🆕)
├── listeners/
│   └── session-completed.listener.ts    # 事件监听 (v5.3 🆕)
├── exceptions/
│   └── calendar.exception.ts            # v3.5 ✅
└── calendar.module.ts                    # v3.5 ✅
```

---

### 4.2 CalendarService（写入服务）

| 方法 | 参数 | 返回值 | 说明 | 版本 |
|:---|:---|:---|:---|:---|
| **createSlotDirect** | dto: CreateSlotDto, tx?: DrizzleTransaction | Calendar \| null | 创建时间段，直接 INSERT，冲突返回 null | v3.5 ✅ |
| **updateSlot** ⭐ | id: string, dto: UpdateSlotDto, tx?: DrizzleTransaction | Calendar \| null | **通用更新**（任意字段），冲突返回 null | v5.3 🆕 |
| **updateSlotSessionId** | id: string, sessionId: string, tx?: DrizzleTransaction | Calendar | 快捷关联 session_id（高频优化）| v3.5 ✅ |
| **cancelSlot** | id: string | Calendar | 取消时间段（status → cancelled）| v3.5 ✅（原 releaseSlot）|

**方法名说明：**
- `createSlotDirect` 中的 "Direct" 强调：
  - ✅ 直接 INSERT，不做预查询（避免 "先查后写" 反模式）
  - ✅ 依赖 EXCLUDE 约束自动检测冲突
  - ✅ 原子性操作，并发安全

**废弃的方法：**

| 方法 | 替代方案 | 废弃理由 |
|:---|:---|:---|
| ~~`completeSlot()`~~ | `updateSlot(id, { status: 'completed' })` | 无需独立方法，通用更新即可 |
| ~~`rescheduleSlot()`~~ | `updateSlot(id, { scheduledStartTime, durationMinutes })` | 通用更新已覆盖改期场景 |

---

### 4.3 updateSlot() 方法详细设计 ⭐

**核心特性：**
- ✅ 支持部分更新（只传入需要修改的字段）
- ✅ 自动处理 `23P01` 冲突错误（time_range 更新时）
- ✅ 自动同步 `scheduled_start_time`（从 time_range 提取）
- ✅ 支持事务（可选 tx 参数）

**参数：UpdateSlotDto**

| 字段 | 类型 | 必填 | 说明 |
|:---|:---|:---|:---|
| title | string | ❌ | 课程标题 |
| scheduledStartTime | Date | ❌ | 预约开始时间 |
| durationMinutes | number | ❌ | 时长（分钟）|
| metadata | Partial\<CalendarMetadata\> | ❌ | 快照数据（部分更新）|
| sessionType | SessionType | ❌ | 会话类型 |
| status | SlotStatus | ❌ | 状态（booked/completed/cancelled）|

**返回值：**
- `Calendar` - 更新成功，返回更新后的记录
- `null` - 时间冲突（SQLSTATE 23P01），UPDATE 失败

**使用场景示例：**

| 场景 | 调用示例 | 说明 |
|:---|:---|:---|
| **修改标题** | `updateSlot(id, { title: '新标题' })` | 仅更新标题字段 |
| **修改时间** | `updateSlot(id, { scheduledStartTime, durationMinutes })` | 更新时间范围，自动检测冲突 |
| **修改会议链接** | `updateSlot(id, { metadata: { meetingUrl: 'https://...' } })` | 部分更新 metadata |
| **完成课时** | `updateSlot(id, { status: 'completed' })` | 替代 completeSlot() |
| **改期** | `updateSlot(id, { scheduledStartTime, durationMinutes })` | 替代 rescheduleSlot() |
| **同时修改多个** | `updateSlot(id, { title, scheduledStartTime, metadata })` | 批量更新 |

**23P01 冲突处理：**

```typescript
const result = await calendarService.updateSlot(slotId, {
  scheduledStartTime: new Date('2025-11-25T14:00:00Z'),
  durationMinutes: 60
});

if (!result) {
  // 新时间段与其他 booked 记录冲突
  throw new ConflictException('该时间段已被占用');
}
```

---

### 4.4 CalendarQueryService（查询服务）

| 方法 | 参数 | 返回值 | 说明 | 版本 |
|:---|:---|:---|:---|:---|
| **getSlotById** | id: string | Calendar \| null | 根据 ID 查询 | v3.5 ✅ |
| **getSlotBySessionId** | sessionId: string | Calendar \| null | 根据 session_id 查询 | v3.5 ✅ |
| **getSlotsBySessionId** 🆕 | sessionId: string | Calendar[] | 根据 session_id 查询**多条**（导师+学生）| v5.3 🆕 |
| **getBookedSlots** | dto: QuerySlotDto | Calendar[] | 按用户和时间范围查询 | v3.5 ✅ |
| **isSlotAvailable** | userId, userType, startTime, duration | boolean | 冲突检测（仅 UI 用）| v3.5 ✅ |
| **getCalendarEvents** 🆕 | userId, startDate, endDate | CalendarEventDto[] | 日历视图查询（格式优化）| v5.3 🆕 |

**注意：** `getSlotsBySessionId()` 返回数组，因为一个 session 对应多条 calendar 记录（导师 + 学生）

---

### 4.5 Event Listener（事件监听）

**监听事件：** `services.session.completed`

**事件结构：** 

```typescript
interface IServiceSessionCompletedPayload {
  sessionId?: string;           // ⭐ 核心字段
  studentId: string;
  mentorId?: string;
  sessionTypeCode: string;
  actualDurationHours: number;
  durationHours: number;
  allowBilling: boolean;
}
```

**Listener 实现逻辑：**

| 步骤 | 操作 | 说明 |
|:---|:---|:---|
| 1 | 提取 `sessionId` | 从事件 payload 获取 |
| 2 | 查询 calendar 记录 | `getSlotsBySessionId(sessionId)` |
| 3 | 批量更新状态 | `updateSlot(slot.id, { status: 'completed' })` |
| 4 | 幂等性保障 | UPDATE 语句天然幂等（多次执行结果相同）|

**幂等性处理：**

```typescript
@OnEvent('services.session.completed')
async handleSessionCompleted(event: IServiceSessionCompletedEvent) {
  const { sessionId } = event.payload;
  
  if (!sessionId) {
    this.logger.warn('Session ID missing in event');
    return;
  }
  
  // 查询所有关联的 calendar 记录（导师 + 学生）
  const slots = await this.calendarQueryService.getSlotsBySessionId(sessionId);
  
  if (!slots || slots.length === 0) {
    this.logger.warn(`No calendar slots found for session ${sessionId}`);
    return;
  }
  
  // 批量更新（天然幂等，已 completed 的记录不会重复更新）
  for (const slot of slots) {
    await this.calendarService.updateSlot(slot.id, { 
      status: 'completed' 
    });
  }
}
```

---

## 🎯 5. DTO 设计

### 5.1 CreateSlotDto（扩展 v3.5）

| 字段 | 类型 | 必填 | 验证规则 | 版本 |
|:---|:---|:---|:---|:---|
| userId | string (UUID) | ✅ | @IsUUID() | v3.5 ✅ |
| userType | UserType | ✅ | @IsEnum(UserType) | v3.5 ✅ |
| startTime | Date | ✅ | @IsDateString() | v3.5 ✅ |
| durationMinutes | number | ✅ | @IsInt() @Min(30) @Max(180) | v3.5 ✅ |
| sessionId | string (UUID) | ❌ | @IsOptional() @IsUUID() | v3.5 ✅ |
| **sessionType** | **SessionType** | **✅** | **@IsEnum(SessionType)** | v5.3 🆕 |
| **title** | **string** | **✅** | **@IsString() @MaxLength(255)** | v5.3 🆕 |
| **metadata** | **CalendarMetadata** | **❌** | **@IsOptional() @IsObject()** | v5.3 🆕 |
| reason | string | ❌ | @IsOptional() @MaxLength(255) | v3.5 ✅ |

**字段变更说明：**
- ❌ 删除 `slotType` 字段（v3.5 遗留，已被 `sessionType` 替代）

---

### 5.2 UpdateSlotDto（新增 v5.3）⭐

| 字段 | 类型 | 必填 | 验证规则 | 说明 |
|:---|:---|:---|:---|:---|
| title | string | ❌ | @IsOptional() @IsString() @MaxLength(255) | 课程标题 |
| scheduledStartTime | Date | ❌ | @IsOptional() @IsDate() | 预约开始时间 |
| durationMinutes | number | ❌ | @IsOptional() @IsInt() @Min(30) @Max(180) | 时长（分钟）|
| metadata | Partial\<CalendarMetadata\> | ❌ | @IsOptional() @IsObject() | 快照数据（部分更新）|
| sessionType | SessionType | ❌ | @IsOptional() @IsEnum(SessionType) | 会话类型 |
| status | SlotStatus | ❌ | @IsOptional() @IsEnum(SlotStatus) | 状态 |

**特性：**
- ✅ 所有字段可选（部分更新）
- ✅ 只传入需要修改的字段
- ✅ 未传入的字段保持不变

---

### 5.3 QuerySlotDto（扩展 v3.5）

| 字段 | 类型 | 必填 | 验证规则 | 版本 |
|:---|:---|:---|:---|:---|
| userId | string (UUID) | ✅ | @IsUUID() | v3.5 ✅ |
| userType | UserType | ✅ | @IsEnum(UserType) | v3.5 ✅ |
| dateFrom | Date | ❌ | @IsOptional() @IsDateString() | v3.5 ✅ |
| dateTo | Date | ❌ | @IsOptional() @IsDateString() | v3.5 ✅ |
| **status** | **SlotStatus** | **❌** | **@IsOptional() @IsEnum(SlotStatus)** | v5.3 🆕 |
| **sessionType** | **SessionType** | **❌** | **@IsOptional() @IsEnum(SessionType)** | v5.3 🆕 |

---

### 5.4 输出 DTO

#### ICalendarSlotEntity（v3.5 实体 + v5.3 扩展）

| 字段 | 类型 | 说明 | 版本 |
|:---|:---|:---|:---|
| id | string | 主键（UUID）| v3.5 ✅ |
| userId | string | 用户 ID（UUID）| v3.5 ✅ |
| userType | UserType | 用户类型 | v3.5 ✅ |
| timeRange | ITimeRange | 时间范围对象 `{ start: Date, end: Date }` | v3.5 ✅ |
| durationMinutes | number | 时长（分钟）| v3.5 ✅ |
| sessionId | string \| null | 关联的会话 ID | v3.5 ✅ |
| **sessionType** | **SessionType** | **会话类型** | v5.3 🆕 |
| **title** | **string** | **课程标题** | v5.3 🆕 |
| **scheduledStartTime** | **Date** | **预约开始时间** | v5.3 🆕 |
| status | SlotStatus | 状态 | v3.5 ✅ |
| **metadata** | **CalendarMetadata** | **快照数据** | v5.3 🆕 |
| reason | string \| null | 占用/阻止原因 | v3.5 ✅ |
| createdAt | Date | 创建时间 | v3.5 ✅ |
| updatedAt | Date | 更新时间 | v3.5 ✅ |

**字段变更说明：**
- ❌ 删除 `slotType` 字段（v3.5 遗留，已被 `sessionType` 替代）
- ⚠️ 数据库表中的 `type` 字段仍然保留（标记为待迁移），但不映射到 Entity

---

#### CalendarEventDto（v5.3 新增，用于日历视图）

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| id | string | Calendar ID |
| sessionId | string | 会话 ID |
| sessionType | SessionType | 会话类型 |
| title | string | 课程标题 |
| startTime | Date | 开始时间 |
| endTime | Date | 结束时间 |
| duration | number | 时长（分钟）|
| status | SlotStatus | 状态 |
| otherPartyName | string | 对方姓名 |
| meetingUrl | string | 会议链接 |
| color | string | 前端展示颜色（根据 sessionType 映射）|

---

## 📐 6. 技术要点

### 6.1 PostgreSQL 特性使用

| 特性 | 用途 | 优势 |
|:---|:---|:---|
| **TSTZRANGE** | 时间范围类型 | 原生支持范围操作（`&&`, `@>`）|
| **GIST 索引** | time_range 字段索引 | 优化范围查询、支持排他约束 |
| **排他约束** | 防止时间重叠 | 数据库级别保证，并发安全 |
| **JSONB** | metadata 存储 | 灵活结构，支持部分更新 |

---

### 6.2 23P01 冲突处理机制 ⭐

**触发场景：**

| 操作 | 触发条件 | 处理方式 |
|:---|:---|:---|
| `createSlot()` | INSERT 时 time_range 与已有 booked 记录重叠 | 捕获异常，返回 null |
| `updateSlot()` | UPDATE time_range 时与其他 booked 记录重叠 | 捕获异常，返回 null |

**代码实现模式：**

```typescript
try {
  // 执行 INSERT 或 UPDATE
  const result = await db.execute(sql`...`);
  return mapToEntity(result.rows[0]);
} catch (error) {
  // 提取 PostgreSQL 错误码
  const pgError = extractPgError(error);
  
  // 检查是否为 EXCLUDE 约束冲突
  if (
    pgError?.code === '23P01' || 
    pgError?.constraint === 'exclude_calendar_time_overlap'
  ) {
    return null; // 冲突，返回 null
  }
  
  // 其他错误抛出
  throw new CalendarException(`Database error: ${pgError?.message}`);
}
```

**关键点：**
- ✅ UPDATE 操作会重新触发 EXCLUDE 约束检查
- ✅ 如果新 time_range 与其他 booked 记录冲突，UPDATE 失败
- ✅ 应用层统一处理：冲突返回 null，调用方判断

---

### 6.3 JSONB 部分更新

| 操作 | SQL 示例 | 说明 |
|:---|:---|:---|
| **查询字段** | `metadata->>'otherPartyName'` | 提取字符串值 |
| **部分更新** | `jsonb_set(metadata, '{meetingUrl}', '"https://..."')` | 更新单个字段 |
| **合并更新** | `metadata \|\| '{"key":"value"}'::jsonb` | 合并多个字段 |

**updateSlot() 中的 metadata 更新策略：**

```sql
-- 如果传入 metadata: { meetingUrl: 'https://...' }
-- 只更新 meetingUrl，保留 otherPartyName
UPDATE calendar
SET metadata = metadata || '{"meetingUrl":"https://..."}'::jsonb
WHERE id = $1
```

---

## 🔍 7. 查询场景示例

### 7.1 常用查询 SQL

| 场景 | SQL 模板 | 说明 |
|:---|:---|:---|
| **日历视图** | `SELECT * FROM calendar WHERE user_id = $1 AND time_range && tstzrange($2, $3) ORDER BY scheduled_start_time` | 使用 v5.3 新增的 scheduled_start_time 排序 |
| **即将开始** | `SELECT * FROM calendar WHERE user_id = $1 AND status = 'booked' AND scheduled_start_time >= NOW() ORDER BY scheduled_start_time LIMIT $2` | 利用 scheduled_start_time 索引 |
| **历史课时** | `SELECT * FROM calendar WHERE user_id = $1 AND status = 'completed' ORDER BY scheduled_start_time DESC LIMIT $2` | 按时间倒序 |
| **根据 session 查询** | `SELECT * FROM calendar WHERE session_id = $1` | 返回多条（导师 + 学生）|

---

## ✅ 8. 模块职责边界

### 8.1 职责清单

| 职责类型 | Calendar 应该做 ✅ | Calendar 不应该做 ❌ |
|:---|:---|:---|
| **数据管理** | 时间占位、冲突检测、状态同步 | 业务规则判断、权威数据源 |
| **查询支持** | 日历视图、快速列表、基础信息 | 详细业务信息、复杂统计 |
| **数据一致性** | 强一致（title, time_range）、弱一致（otherPartyName）| 所有字段强一致性 |
| **事件处理** | 监听 Session 事件被动更新 | 触发业务逻辑、主动调用 Session |

---

### 8.2 查询决策

| 查询需求 | 推荐表 | 理由 |
|:---|:---|:---|
| 日历视图 | Calendar | 单表查询，性能最优 |
| 即将开始的课时 | Calendar | metadata 快照足够 |
| 快速浏览列表 | Calendar | 基础信息完整 |
| 课时详情页 | Sessions + Meetings | 需要完整业务信息 |
| 课时统计报表 | Sessions | 需要聚合计算 |
| 搜索功能 | Sessions | 需要搜索业务字段 |

---

## 📋 9. 数据库迁移

### 9.1 迁移 SQL（从 v3.5 到 v5.3）

```sql
-- Phase 1: 新增字段（保留现有字段）
ALTER TABLE calendar 
  ADD COLUMN session_type VARCHAR(50),
  ADD COLUMN title VARCHAR(255),
  ADD COLUMN scheduled_start_time TIMESTAMPTZ,
  ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

-- Phase 2: 从现有数据填充新字段
UPDATE calendar 
SET scheduled_start_time = lower(time_range),  -- 从 time_range 提取开始时间
    title = COALESCE(reason, 'Untitled');       -- 临时填充（需要业务层补充）

-- Phase 3: 设置 NOT NULL 约束（数据填充后）
ALTER TABLE calendar 
  ALTER COLUMN session_type SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN scheduled_start_time SET NOT NULL;

-- Phase 4: 新增 CHECK 约束
ALTER TABLE calendar 
ADD CONSTRAINT check_calendar_session_type
CHECK (session_type IN (
  'regular_mentoring', 
  'gap_analysis', 
  'ai_career', 
  'comm_session', 
  'class_session'
));

-- Phase 5: 创建新索引
CREATE INDEX idx_calendar_user_scheduled 
  ON calendar(user_id, scheduled_start_time DESC);

-- Phase 6: 删除旧索引（如果需要）
-- DROP INDEX idx_calendar_user; -- 保留或根据实际情况决定
```

**注意事项：**
- ⚠️ 现有数据的 `title` 需要业务层补充（从 Session 表同步）
- ⚠️ `session_type` 需要根据 `type` 字段映射填充
- ⚠️ 建议分阶段执行，确保向后兼容

---

### 9.2 完整建表 SQL（v5.3）

```sql
-- 创建表
CREATE TABLE calendar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_type VARCHAR(20) NOT NULL,
  time_range TSTZRANGE NOT NULL,
  duration_minutes INT NOT NULL,
  session_id UUID,
  type VARCHAR(50) NOT NULL,                    -- 待废弃
  session_type VARCHAR(50) NOT NULL,            -- v5.3 新增
  title VARCHAR(255) NOT NULL,                  -- v5.3 新增
  scheduled_start_time TIMESTAMPTZ NOT NULL,    -- v5.3 新增
  status VARCHAR(20) NOT NULL DEFAULT 'booked',
  metadata JSONB DEFAULT '{}'::jsonb,           -- v5.3 新增
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_calendar_user_scheduled ON calendar(user_id, scheduled_start_time DESC);
CREATE INDEX idx_calendar_session ON calendar(session_id);
CREATE INDEX idx_calendar_status ON calendar(status);
CREATE INDEX idx_calendar_time_range ON calendar USING GIST(time_range);

-- 排他约束
ALTER TABLE calendar ADD CONSTRAINT exclude_calendar_time_overlap
EXCLUDE USING GIST (user_id WITH =, time_range WITH &&) WHERE (status = 'booked');

-- CHECK 约束
ALTER TABLE calendar ADD CONSTRAINT check_calendar_user_type
CHECK (user_type IN ('mentor', 'student', 'counselor'));

ALTER TABLE calendar ADD CONSTRAINT check_calendar_session_type
CHECK (session_type IN ('regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session'));

ALTER TABLE calendar ADD CONSTRAINT check_calendar_status
CHECK (status IN ('booked', 'completed', 'cancelled'));

ALTER TABLE calendar ADD CONSTRAINT check_calendar_duration
CHECK (duration_minutes >= 30 AND duration_minutes <= 180);
```

---

## 🎉 10. 总结

### 10.1 核心价值

| 价值点 | 说明 |
|:---|:---|
| **冲突检测** | 数据库级别排他约束，并发安全，零业务逻辑 |
| **查询优化** | 单表查询 < 50ms，冗余字段加速（title, scheduled_start_time）|
| **事件驱动** | 监听 Session 事件，解耦业务逻辑，最终一致性 |
| **灵活更新** | 通用 updateSlot() 方法，支持任意字段部分更新 |

---

### 10.2 设计亮点

| 特性 | 技术实现 |
|:---|:---|
| 排他约束 | PostgreSQL GIST 索引 + EXCLUDE 约束，UPDATE 自动检测冲突 |
| 时间范围 | TSTZRANGE 类型，原生范围操作 |
| 快照数据 | JSONB 存储，部分更新支持 |
| 弱一致性 | 历史快照允许过期，降低维护成本 |
| 事件驱动 | 监听 `services.session.completed`，解耦 Session 和 Calendar |
| 通用更新 | updateSlot() 统一处理所有更新场景，替代多个专用方法 |

---

### 10.3 v3.5 → v5.3 演进路径

| 维度 | v3.5 现状 | v5.3 增强 |
|:---|:---|:---|
| **表结构** | 基础字段（time_range, session_id, type）| 新增 session_type, title, scheduled_start_time, metadata |
| **DTO/Entity** | 包含 slotType 字段 | ❌ 删除 slotType，统一使用 sessionType |
| **写入服务** | createSlotDirect, releaseSlot, rescheduleSlot, updateSlotSessionId | 统一为 createSlotDirect, updateSlot, updateSlotSessionId, cancelSlot |
| **查询服务** | getSlotById, getBookedSlots | 拆分独立 QueryService，新增 getCalendarEvents |
| **事件监听** | ❌ 不存在 | ✅ 新增 SessionCompletedListener |
| **更新策略** | 多个专用方法 | 通用 updateSlot() + 高频快捷方法 |

---

**文档结束** 🎉

**版本**: v5.3  
**模块**: Calendar  
**最后更新**: 2025-11-24  
**基于实现**: calendar.service.ts (v3.5) + v5.3 架构升级
