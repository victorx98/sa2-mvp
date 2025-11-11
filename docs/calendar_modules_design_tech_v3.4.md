# Calendar Module 详细设计文档

**文档版本**: v3.4  
**更新日期**: 2025-11-11  
**作者**: Architecture Team  
**说明**: 基于 Session Domain v3.3 设计，专门针对 Calendar 模块的详细实现指南，采用 PostgreSQL 排斥约束（EXCLUDE USING GIST）的原子占用方案

---

## 📦 1. 模块概览

### 1.1 模块定位

| 属性 | 说明 |
|------|------|
| **模块名称** | Calendar Module（日历管理模块） |
| **位置路径** | `src/core/calendar/` |
| **架构分层** | 基础设施层（Infrastructure Layer） |
| **核心职责** | 原子时间段占用管理、并发安全保证、时间段冲突防护 |
| **设计模式** | 数据库约束驱动（Database-Constraint-Driven） |
| **关键特性** | 无需应用层竞态控制、自动防止时间冲突、原子性保证 |

### 1.2 核心问题解决

| 问题 | 传统解决方案 | Calendar v3.4 方案 |
|------|-----------|-----------------|
| 时间段冲突检测 | `SELECT COUNT(*)`查询 + `INSERT`（两阶段） | 单条`INSERT`，由数据库EXCLUDE约束判定 |
| 并发安全 | 应用层加锁/分布式锁 | PostgreSQL MVCC + GiST索引自动处理 |
| 失败处理 | 返回`false`或异常 | 捕获`SQLSTATE 23P01`（排斥约束违反） |
| 竞态窗口 | 查询与写入间存在时间窗口 | 无窗口，语句级原子执行 |
| 应用复杂度 | 中等（需锁管理） | 低（数据库兜底） |

---

## 🏗️ 2. 架构设计原理

### 2.1 设计理念

#### 2.1.1 PostgreSQL 排斥约束 vs 应用层控制

**不推荐的做法（竞态风险）**:
```typescript
// ❌ 有竞态窗口：查询与写入间可能有其他请求插入
const available = await isSlotAvailable(userId, startTime, endTime);
if (available) {
  return await createSlot(userId, startTime, endTime);  // 窗口！
}
```

**推荐的做法（原子安全）**:
```typescript
// ✅ 原子安全：单条INSERT，由数据库约束保护
try {
  return await createSlotDirect(dto);  // 单条INSERT，带EXCLUDE约束
} catch (error) {
  if (error.code === '23P01') {  // 排斥约束冲突
    return null;
  }
  throw error;
}
```

#### 2.1.2 核心优势

| 优势 | 详细说明 |
|-----|---------|
| **原子性** | 一条SQL（INSERT/UPDATE）内部完成"可用性检查+占用"，无竞态窗口 |
| **并发安全** | PostgreSQL的MVCC与排斥约束自动处理并发冲突，无需应用层加锁 |
| **性能高效** | 避免SELECT+INSERT两次数据库往返，减少网络延迟 |
| **简洁易维护** | 应用层无需分布式锁或复杂的锁管理逻辑 |
| **数据一致性** | 数据库层面保证，不依赖应用层实现 |
| **时间语义统一** | 全系统统一UTC+半开区间`[start,end)`，避免边界问题 |

#### 2.1.3 半开区间 [start, end) 的优势

- **相邻不冲突**: `[10:00,10:30)` 与 `[10:30,11:00)` **不冲突**
- **避免off-by-one**: 边界值处理简洁，不需要`<=`或`>=`的歧义
- **与编程习惯一致**: 与数组切片等编程概念对齐
- **PostgreSQL原生支持**: TSTZRANGE类型天然支持半开区间

---

## 📁 3. 目录结构

```
src/core/calendar/
├── services/
│   ├── calendar.service.ts              # 高级时间段管理API（核心业务逻辑）
│   └── calendar.service.spec.ts         # 服务单元测试
├── repositories/
│   ├── calendar-slot.repository.ts      # 原子操作数据访问层（数据库交互）
│   └── calendar-slot.repository.spec.ts # 仓库单元测试
├── dto/
│   ├── create-slot.dto.ts               # 创建时间段DTO
│   ├── query-slot.dto.ts                # 查询时间段DTO
│   ├── reschedule-slot.dto.ts           # 改期操作DTO
│   └── create-service-hold-result.dto.ts # 操作结果DTO
├── exceptions/
│   └── calendar.exception.ts            # 日历异常定义
├── interfaces/
│   ├── calendar-slot.interface.ts       # CalendarSlot实体接口
│   └── calendar.repository.interface.ts # 仓库接口定义
├── constants/
│   └── calendar.constant.ts             # 常量定义（类型、状态等）
└── calendar.module.ts                   # NestJS模块定义
```

---

## 🔄 4. 服务层（CalendarService）

### 4.1 文件位置

**路径**: `src/core/calendar/services/calendar.service.ts`

### 4.2 核心方法 API

#### 4.2.1 直接占用时间段

```typescript
/**
 * 直接占用时间段，原子操作
 * 
 * @param dto CreateSlotDto - 时间段信息
 * @returns CalendarSlotEntity | null - 成功返回槽位，冲突返回null
 * @throws Error - 其他数据库错误
 * 
 * @description
 * - 单条INSERT操作，由数据库EXCLUDE约束防护
 * - 若time_range与existing冲突，捕获SQLSTATE 23P01返回null
 * - 调用者: BFF层
 * 
 * @example
 * const slot = await calendarService.createSlotDirect({
 *   userId: 'user-uuid',
 *   userType: 'mentor',
 *   startTime: new Date('2025-11-15T14:00:00Z'),
 *   durationMinutes: 60,
 *   sessionId: 'session-uuid',
 *   slotType: 'session'
 * });
 * 
 * if (!slot) {
 *   // 时间段已被占用，返回冲突
 * }
 */
createSlotDirect(dto: CreateSlotDto): Promise<CalendarSlotEntity | null>
```

#### 4.2.2 查询占用记录

```typescript
/**
 * 根据sessionId查询占用记录
 * 
 * @param sessionId UUID - 会话ID
 * @returns CalendarSlotEntity | null - 找到返回记录，否则返回null
 */
getSlotBySessionId(sessionId: string): Promise<CalendarSlotEntity | null>
```

#### 4.2.3 释放占用

```typescript
/**
 * 取消占用（将status改为cancelled）
 * 
 * @param slotId UUID - 时间槽ID
 * @returns boolean - 成功true，失败false
 * 
 * @description
 * - 将slot的status从'booked'改为'cancelled'
 * - 已取消的槽位不再阻止新的占用（EXCLUDE约束有WHERE条件）
 * - 用于会话取消、改期释放旧槽位等场景
 */
releaseSlot(slotId: string): Promise<boolean>
```

#### 4.2.4 批量查询占用时段

```typescript
/**
 * 批量查询占用时段
 * 
 * @param dto QuerySlotDto - 查询条件
 * @returns CalendarSlotEntity[] - 符合条件的时间段列表
 * 
 * @description
 * - 用于展示用户的日历占用情况
 * - 支持按用户、时间范围、类型筛选
 * - 仅返回status='booked'的记录
 */
getOccupiedSlots(dto: QuerySlotDto): Promise<CalendarSlotEntity[]>
```

#### 4.2.5 检查可用性（仅用于UI预览）

```typescript
/**
 * 查询时间段可用性
 * 
 * @param userId UUID - 用户ID
 * @param userType 'mentor' | 'student' | 'counselor' - 用户类型
 * @param startTime Date - 开始时间
 * @param endTime Date - 结束时间
 * @returns boolean - true表示可用，false表示被占用
 * 
 * @description
 * - 执行SELECT查询，**不参与写操作决策**
 * - 用于前端"实时显示可用性"，最终以写入时的约束为准
 * - **重要**: 不要基于此方法的结果进行条件判断后再写入
 *   因为查询与写入间存在竞态窗口
 * - 仅用于UI反馈、显示目的
 */
isSlotAvailable(
  userId: string,
  userType: string,
  startTime: Date,
  endTime: Date
): Promise<boolean>
```

#### 4.2.6 阻止时间段（用户设置不可用）

```typescript
/**
 * 用户设置不可用时间
 * 
 * @param userId UUID - 用户ID
 * @param userType 'mentor' | 'student' | 'counselor' - 用户类型
 * @param startTime Date - 开始时间
 * @param durationMinutes number - 时长（分钟）
 * @param reason string - 阻止原因（如：休假、会议等）
 * @returns CalendarSlotEntity | null - 成功返回记录，冲突返回null
 * 
 * @description
 * - 创建一条特殊的slot记录，slotType='block'或reason标记
 * - 同样受EXCLUDE约束保护，冲突时返回null
 */
blockTimeSlot(
  userId: string,
  userType: string,
  startTime: Date,
  durationMinutes: number,
  reason: string
): Promise<CalendarSlotEntity | null>
```

#### 4.2.7 改期操作（原子：释放旧+占用新）

```typescript
/**
 * 改期操作：释放旧槽位+占用新槽位
 * 
 * @param rescheduleDto RescheduleSlotDto
 * @returns CalendarSlotEntity | null - 成功返回新槽位，冲突或失败返回null
 * 
 * @description
 * - 在事务中执行：先释放旧槽位，再占用新槽位
 * - 若新时间段冲突，整个事务回滚
 * - 原子操作保证一致性
 * 
 * @example
 * const newSlot = await calendarService.rescheduleSlot({
 *   oldSlotId: 'slot-uuid-old',
 *   userId: 'user-uuid',
 *   newStartTime: new Date('2025-11-15T15:00:00Z'),
 *   durationMinutes: 60
 * });
 */
rescheduleSlot(rescheduleDto: RescheduleSlotDto): Promise<CalendarSlotEntity | null>
```

### 4.3 方法调用关系

```
BFF层 (SessionController/OperationService)
  ├─→ createSlotDirect()        [约课时]
  ├─→ getSlotBySessionId()      [查询时]
  ├─→ releaseSlot()             [取消/改期时]
  ├─→ getOccupiedSlots()        [展示日历时]
  ├─→ isSlotAvailable()         [UI预览时 - 仅查询]
  ├─→ blockTimeSlot()           [用户设置不可用时]
  └─→ rescheduleSlot()          [改期时]
```

---

## 📄 5. DTO 定义

### 5.1 CreateSlotDto（创建时间段）

**文件路径**: `src/core/calendar/dto/create-slot.dto.ts`

```typescript
export interface CreateSlotDto {
  /**
   * 用户ID（关键字段）
   * @type UUID
   * @required true
   * @validation 必须为有效UUID，必须存在于users表
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  userId: string;

  /**
   * 用户类型（冗余字段，用于查询优化）
   * @type 'mentor' | 'student' | 'counselor'
   * @required true
   * @description 每个user_id在系统中只有唯一的身份
   * @example "mentor"
   */
  userType: 'mentor' | 'student' | 'counselor';

  /**
   * 开始时间（UTC）
   * @type Date (ISO 8601)
   * @required true
   * @validation 必须晚于当前时间，必须为UTC时区
   * @example "2025-11-15T14:00:00Z"
   */
  startTime: Date;

  /**
   * 时长（分钟）
   * @type integer
   * @required true
   * @validation 30 <= duration <= 180
   * @example 60
   */
  durationMinutes: number;

  /**
   * 关联的会话ID
   * @type UUID
   * @required false (nullable)
   * @description 若为session占用，必须关联到sessions表记录
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  sessionId?: string;

  /**
   * 时间段类型
   * @type 'session' | 'class_session' | 'comm_session'
   * @required true
   * @description 标记该占用的类型
   * @example "session"
   */
  slotType: 'session' | 'class_session' | 'comm_session';

  /**
   * 备注信息
   * @type string
   * @required false (nullable)
   * @validation 最大255字符
   * @description 用于标记原因，如"导师休假"、"系统维护"等
   * @example "导师休假"
   */
  reason?: string;
}
```

| 字段 | 类型 | 必填 | 说明 | 示例 | 验证规则 |
|------|------|------|-----|-----|--------|
| userId | UUID | ✅ | 用户ID | "550e8400-..." | 必须有效UUID，FK(users.id) |
| userType | Enum | ✅ | 用户类型 | "mentor" | 'mentor'\|'student'\|'counselor' |
| startTime | DateTime | ✅ | 开始时间（UTC） | "2025-11-15T14:00:00Z" | 晚于当前时间 |
| durationMinutes | Integer | ✅ | 时长（分钟） | 60 | 30 <= duration <= 180 |
| sessionId | UUID | ❌ | 关联session_id | "550e8400-..." | FK(sessions.id) |
| slotType | Enum | ✅ | 时间段类型 | "session" | 'session'\|'class_session'\|'comm_session' |
| reason | String | ❌ | 备注信息 | "导师休假" | 最大255字符 |

### 5.2 QuerySlotDto（查询时间段）

**文件路径**: `src/core/calendar/dto/query-slot.dto.ts`

```typescript
export interface QuerySlotDto {
  /**
   * 用户ID（必填）
   * @type UUID
   * @required true
   */
  userId: string;

  /**
   * 用户类型（可选，默认不限制）
   * @type 'mentor' | 'student' | 'counselor'
   * @required false
   */
  userType?: 'mentor' | 'student' | 'counselor';

  /**
   * 时间范围起点（可选）
   * @type Date
   * @required false
   * @description 若提供，查询time_range && [startTime, ∞)
   */
  startTime?: Date;

  /**
   * 时间范围终点（可选）
   * @type Date
   * @required false
   * @description 若提供，查询time_range && (-∞, endTime)
   */
  endTime?: Date;

  /**
   * 时间段类型（可选）
   * @type 'session' | 'class_session' | 'comm_session'
   * @required false
   */
  slotType?: string;

  /**
   * 状态筛选（默认仅返回booked）
   * @type 'booked' | 'cancelled'
   * @required false
   * @default ['booked']
   */
  status?: ('booked' | 'cancelled')[];

  /**
   * 分页：页码（从1开始）
   * @type integer
   * @required false
   * @default 1
   */
  page?: number;

  /**
   * 分页：每页条数
   * @type integer
   * @required false
   * @default 20
   * @max 100
   */
  limit?: number;
}
```

### 5.3 RescheduleSlotDto（改期操作）

**文件路径**: `src/core/calendar/dto/reschedule-slot.dto.ts`

```typescript
export interface RescheduleSlotDto {
  /**
   * 旧槽位ID（需要释放的）
   * @type UUID
   * @required true
   */
  oldSlotId: string;

  /**
   * 用户ID（校验用，必须与oldSlot的userId一致）
   * @type UUID
   * @required true
   */
  userId: string;

  /**
   * 新开始时间
   * @type Date
   * @required true
   * @validation 晚于当前时间
   */
  newStartTime: Date;

  /**
   * 新时长（分钟）
   * @type integer
   * @required true
   * @validation 30 <= duration <= 180
   */
  durationMinutes: number;

  /**
   * 备注（可选，记录改期原因）
   * @type string
   * @required false
   */
  reason?: string;
}
```

### 5.4 CalendarSlotEntity（返回实体）

**文件路径**: `src/core/calendar/interfaces/calendar-slot.interface.ts`

```typescript
export interface CalendarSlotEntity {
  /**
   * 主键
   * @type UUID
   */
  id: string;

  /**
   * 用户ID
   * @type UUID
   */
  userId: string;

  /**
   * 用户类型
   * @type 'mentor' | 'student' | 'counselor'
   */
  userType: 'mentor' | 'student' | 'counselor';

  /**
   * 时间范围（半开区间）
   * @type { start: Date; end: Date }
   * @description 从PostgreSQL的TSTZRANGE类型解析
   */
  timeRange: {
    start: Date;
    end: Date;
  };

  /**
   * 开始时间（便利字段，从timeRange.start解析）
   * @type Date
   */
  startTime: Date;

  /**
   * 结束时间（便利字段，从timeRange.end解析）
   * @type Date
   */
  endTime: Date;

  /**
   * 时长（分钟）
   * @type integer
   */
  durationMinutes: number;

  /**
   * 关联的会话ID（可选）
   * @type UUID | null
   */
  sessionId: string | null;

  /**
   * 时间段类型
   * @type 'session' | 'class_session' | 'comm_session'
   */
  slotType: string;

  /**
   * 预订状态
   * @type 'booked' | 'cancelled'
   */
  status: 'booked' | 'cancelled';

  /**
   * 备注信息（可选）
   * @type string | null
   */
  reason: string | null;

  /**
   * 创建时间
   * @type Date
   */
  createdAt: Date;

  /**
   * 更新时间
   * @type Date
   */
  updatedAt: Date;
}
```

| 字段 | 类型 | 说明 | 示例值 |
|------|------|-----|------|
| id | UUID | 主键 | "550e8400-..." |
| userId | UUID | 用户ID | "user-uuid" |
| userType | Enum | 用户类型 | "mentor" |
| timeRange | Object | 半开区间 | `{ start: Date, end: Date }` |
| startTime | Date | 开始时间 | "2025-11-15T14:00:00Z" |
| endTime | Date | 结束时间 | "2025-11-15T15:00:00Z" |
| durationMinutes | Integer | 时长（分钟） | 60 |
| sessionId | UUID \| null | 关联session_id | "session-uuid" |
| slotType | Enum | 类型 | "session" |
| status | Enum | 状态 | "booked" |
| reason | String \| null | 备注 | "导师休假" |
| createdAt | Date | 创建时间 | "2025-11-05T10:00:00Z" |
| updatedAt | Date | 更新时间 | "2025-11-05T10:00:00Z" |

---

## 🗄️ 6. 数据访问层（CalendarSlotRepository）

### 6.1 文件位置

**路径**: `src/core/calendar/repositories/calendar-slot.repository.ts`

### 6.2 核心 SQL 操作

#### 6.2.1 直接占用（INSERT，带EXCLUDE约束保护）

```sql
-- 直接插入，让数据库EXCLUDE约束防护冲突
INSERT INTO calendar (
  id,
  user_id,
  user_type,
  time_range,
  duration_minutes,
  session_id,
  type,
  status,
  reason,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),    -- $1
  $2,                   -- user_id
  $3,                   -- user_type
  tstzrange($4, $5, '[)'),  -- 半开区间 [start, end)
  $6,                   -- duration_minutes
  $7,                   -- session_id (nullable)
  $8,                   -- type
  'booked',             -- status (always)
  $9,                   -- reason (nullable)
  NOW(),
  NOW()
)
RETURNING *;

-- 若冲突：抛异常 SQLSTATE 23P01（排斥约束违反）
-- 对应PostgreSQL错误: "duplicate key value violates unique constraint"
--                或: "conflicting key value violates exclusion constraint"
```

**捕获方式**:
```typescript
try {
  const result = await this.db.insert(calendarSlots).values(...).returning();
  return result[0];
} catch (error) {
  if (error.code === '23P01') {
    // 排斥约束冲突 - 时间段已被占用
    return null;
  }
  throw error;
}
```

#### 6.2.2 可用性查询（SELECT，仅用于展示）

```sql
-- 检查时间段是否可用（不参与写操作）
SELECT NOT EXISTS (
  SELECT 1 FROM calendar
  WHERE user_id = $1
    AND user_type = $2
    AND status = 'booked'
    AND time_range && tstzrange($3, $4, '[)')  -- && = overlap operator
) AS is_available;
```

**说明**:
- `&&` 是PostgreSQL范围类型的重叠操作符
- 查询结果为`true`表示时间段可用
- **仅用于UI展示**，不用于业务逻辑判断

#### 6.2.3 释放占用（UPDATE）

```sql
-- 将槽位标记为已取消
UPDATE calendar
SET status = 'cancelled', updated_at = NOW()
WHERE id = $1 
  AND status = 'booked'
RETURNING *;

-- 返回更新后的记录，若记录不存在或已被取消返回空
```

#### 6.2.4 按sessionId查询（SELECT）

```sql
-- 根据会话ID查询关联的时间槽
SELECT * FROM calendar
WHERE session_id = $1
  AND status = 'booked'
LIMIT 1;

-- 若不存在返回NULL
```

#### 6.2.5 批量查询占用时段（SELECT）

```sql
-- 按用户和时间范围查询占用时段
SELECT * FROM calendar
WHERE user_id = $1
  AND user_type = $2  -- 可选，用于索引优化
  AND status = $3     -- 通常 'booked'
  AND time_range && tstzrange($4, $5, '[)')  -- 时间范围过滤
ORDER BY time_range
LIMIT $6 OFFSET $7;

-- 支持分页，返回列表
```

#### 6.2.6 改期操作（事务：释放旧+占用新）

```sql
BEGIN;
  -- Step 1: 释放旧槽位
  UPDATE calendar
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = $1
    AND user_id = $2  -- 校验所有权
    AND status = 'booked';

  -- Step 2: 占用新槽位（可能被EXCLUDE约束拒绝）
  INSERT INTO calendar (
    id, user_id, user_type, time_range,
    duration_minutes, session_id, type, status, reason,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    $2,                          -- user_id (same)
    $3,                          -- user_type
    tstzrange($4, $5, '[)'),     -- 新时间范围
    $6,                          -- duration_minutes
    $7,                          -- session_id
    $8,                          -- type
    'booked',
    $9,                          -- reason
    NOW(),
    NOW()
  )
  RETURNING *;

COMMIT;
-- 若Step 2失败则整个事务回滚，Step 1的UPDATE也会被撤销
```

### 6.3 仓库接口

```typescript
export interface ICalendarSlotRepository {
  /**
   * 创建时间槽（原子操作）
   */
  create(dto: CreateSlotDto): Promise<CalendarSlot | null>;

  /**
   * 根据ID查询
   */
  findById(id: string): Promise<CalendarSlot | null>;

  /**
   * 根据sessionId查询
   */
  findBySessionId(sessionId: string): Promise<CalendarSlot | null>;

  /**
   * 检查时间可用性（仅查询）
   */
  checkAvailability(
    userId: string,
    userType: string,
    startTime: Date,
    endTime: Date
  ): Promise<boolean>;

  /**
   * 批量查询
   */
  query(dto: QuerySlotDto): Promise<CalendarSlot[]>;

  /**
   * 更新状态（释放）
   */
  updateStatus(id: string, status: 'booked' | 'cancelled'): Promise<CalendarSlot | null>;

  /**
   * 改期操作（事务）
   */
  reschedule(rescheduleDto: RescheduleSlotDto): Promise<CalendarSlot | null>;
}
```

---

## 🗓️ 7. 数据库表设计

### 7.1 表名和定位

**表名**: `calendar`  
**架构层**: 基础设施层 - 数据库持久化  
**设计特点**: PostgreSQL约束驱动，无需应用层竞态控制

### 7.2 完整 DDL 定义

```sql
CREATE TABLE calendar (
  -- 主键
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 用户标识
  user_id UUID NOT NULL,
  user_type VARCHAR(50) NOT NULL,

  -- 时间范围（关键字段）
  time_range TSTZRANGE NOT NULL,

  -- 时长（便利字段，从time_range计算得出）
  duration_minutes INTEGER NOT NULL 
    CHECK (duration_minutes >= 30 AND duration_minutes <= 180),

  -- 关联关系
  session_id UUID,

  -- 分类
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'booked',

  -- 备注
  reason TEXT,

  -- 审计
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ========== 约束 ==========
  
  -- 用户类型约束
  CHECK (user_type IN ('mentor', 'student', 'counselor')),
  
  -- 时间段类型约束
  CHECK (type IN ('session', 'class_session', 'comm_session')),
  
  -- 状态约束
  CHECK (status IN ('booked', 'cancelled')),
  
  -- 排斥约束：防止时间范围重叠（仅对booked状态生效）
  -- 核心设计：只检查user_id + time_range，user_type不参与
  -- 原因：每个user_id在系统中只有唯一的身份
  EXCLUDE USING GIST (
    user_id WITH =,
    time_range WITH &&
  ) WHERE (status = 'booked'),
  
  -- 外键约束
  CONSTRAINT fk_calendar_session 
    FOREIGN KEY (session_id) REFERENCES sessions (id),
  CONSTRAINT fk_calendar_user 
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- ========== 索引优化 ==========

-- 用户查询索引：加速按用户查询
CREATE INDEX idx_calendar_user 
  ON calendar (user_id, user_type);

-- 会话查询索引：加速按sessionId查询
CREATE INDEX idx_calendar_session 
  ON calendar (session_id);

-- GIST索引：支持EXCLUDE约束和范围查询
-- 由于EXCLUDE约束已经创建，GIST索引会自动被利用
-- 如需显式创建GIST索引用于其他范围查询，可选：
-- CREATE INDEX idx_calendar_timerange 
--   ON calendar USING GIST (time_range);
```

### 7.3 字段详解

| 字段 | 类型 | 说明 | 约束 | 索引 |
|------|------|-----|-----|-----|
| id | UUID | 主键 | PK | - |
| user_id | UUID | 用户ID（mentor/student/counselor） | FK, NOT NULL | INDEX |
| user_type | VARCHAR(50) | 用户类型（冗余字段） | CHECK, NOT NULL | INDEX |
| **time_range** | **TSTZRANGE** | **半开区间时间范围[start,end)** | **NOT NULL** | **GIST** |
| duration_minutes | INTEGER | 时长（分钟） | CHECK 30-180, NOT NULL | - |
| session_id | UUID | 关联的会话ID | FK (nullable) | INDEX |
| type | VARCHAR(50) | 时间段类型 | CHECK, NOT NULL | - |
| status | VARCHAR(50) | 预订状态 | CHECK, DEFAULT 'booked' | - |
| reason | TEXT | 备注信息 | nullable | - |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW(), NOT NULL | - |
| updated_at | TIMESTAMPTZ | 更新时间 | DEFAULT NOW(), NOT NULL | - |

### 7.4 约束设计

#### 7.4.1 排斥约束（EXCLUDE USING GIST）- 核心防护

```sql
EXCLUDE USING GIST (
  user_id WITH =,
  time_range WITH &&
) WHERE (status = 'booked')
```

**工作原理**:
- 对于每条新INSERT或UPDATE语句
- 检查该行的`(user_id, time_range, status)`组合
- 若status='booked'且存在其他'booked'行的user_id相同且time_range相交
- PostgreSQL拒绝操作，抛SQLSTATE 23P01异常

**重要设计决策**:
- ❌ **不包含user_type**: 因为每个user_id在系统中身份唯一
- ✅ **仅包含user_id + time_range**: 约束最小化、索引最高效
- ✅ **WHERE (status = 'booked')**:  已取消(cancelled)的槽位不参与冲突检查

#### 7.4.2 CHECK 约束

```sql
-- 用户类型合法性
CHECK (user_type IN ('mentor', 'student', 'counselor'))

-- 时间段类型合法性
CHECK (type IN ('session', 'class_session', 'comm_session'))

-- 状态合法性
CHECK (status IN ('booked', 'cancelled'))

-- 时长范围
CHECK (duration_minutes >= 30 AND duration_minutes <= 180)
```

#### 7.4.3 外键约束

```sql
-- 确保user_id存在
CONSTRAINT fk_calendar_user 
  FOREIGN KEY (user_id) REFERENCES users (id)

-- 若有sessionId，确保session_id存在
CONSTRAINT fk_calendar_session 
  FOREIGN KEY (session_id) REFERENCES sessions (id)
  ON DELETE SET NULL  -- 会话删除后，session_id置为NULL
```

### 7.5 user_type 冗余字段的价值

| 方面 | 说明 |
|------|------|
| **为何冗余** | 通常user_type可从users表的role字段获取，但冗余存储在calendar表提高查询性能 |
| **查询优化** | SELECT WHERE user_id=? AND user_type=? 可利用联合索引快速定位 |
| **约束中为何不用** | 每个user_id的身份唯一，无需在约束中重复检查 |
| **数据一致性** | 由应用层负责维护，INSERT时必须准确设置user_type |
| **NULL处理** | user_type NOT NULL，必须填充有效值 |

---

## 🔐 8. 异常处理

### 8.1 异常类型

**文件路径**: `src/core/calendar/exceptions/calendar.exception.ts`

```typescript
/**
 * 日历异常基类
 */
export class CalendarException extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'CalendarException';
  }
}

/**
 * 时间段冲突异常
 * - 触发条件: SQLSTATE 23P01 (排斥约束违反)
 * - HTTP状态码: 409 Conflict
 */
export class SlotConflictException extends CalendarException {
  constructor(message = 'Time slot is already occupied') {
    super(message, 'SLOT_CONFLICT');
  }
}

/**
 * 时间段不存在异常
 * - 触发条件: 查询返回null
 * - HTTP状态码: 404 Not Found
 */
export class SlotNotFoundException extends CalendarException {
  constructor(slotId: string) {
    super(`Time slot ${slotId} not found`, 'SLOT_NOT_FOUND');
  }
}

/**
 * 无效的时间段异常
 * - 触发条件: 时间段验证失败
 * - HTTP状态码: 400 Bad Request
 */
export class InvalidSlotException extends CalendarException {
  constructor(message: string) {
    super(message, 'INVALID_SLOT');
  }
}

/**
 * 无效的用户异常
 * - 触发条件: 用户不存在或无权操作
 * - HTTP状态码: 403 Forbidden
 */
export class InvalidUserException extends CalendarException {
  constructor(userId: string) {
    super(`User ${userId} is invalid or unauthorized`, 'INVALID_USER');
  }
}
```

### 8.2 异常处理示例

```typescript
// Service层
async createSlotDirect(dto: CreateSlotDto): Promise<CalendarSlotEntity | null> {
  try {
    return await this.repository.create(dto);
  } catch (error) {
    // 捕获数据库排斥约束异常
    if (error.code === '23P01') {
      throw new SlotConflictException(
        `Time slot already occupied for user ${dto.userId} ` +
        `from ${dto.startTime} to ${new Date(dto.startTime.getTime() + dto.durationMinutes * 60000)}`
      );
    }
    throw error;
  }
}

// Controller层
async createSession(dto: CreateSessionDto) {
  try {
    const slot = await this.calendarService.createSlotDirect(slotDto);
    if (!slot) {
      // 时间段冲突，返回409
      throw new SlotConflictException();
    }
    return slot;
  } catch (error) {
    if (error instanceof SlotConflictException) {
      throw new HttpException(error.message, HttpStatus.CONFLICT);
    }
    throw error;
  }
}
```

---

## ⚠️ 9. 核心设计原则与最佳实践

### 9.1 原则 1：直接插入，让数据库防护

#### ✅ 正确做法

```typescript
// 单条INSERT，让数据库EXCLUDE约束保护
try {
  return await this.calendarService.createSlotDirect(dto);
} catch (error) {
  if (error.code === '23P01') {
    return { success: false, reason: 'TIME_CONFLICT' };
  }
  throw error;
}
```

#### ❌ 错误做法（竞态风险）

```typescript
// 不要这样做！查询与写入间有竞态窗口
const available = await this.calendarService.isSlotAvailable(
  dto.userId,
  dto.userType,
  startTime,
  endTime
);

if (available) {
  // ⚠️ 竞态窗口：其他请求可能在这里插入冲突的槽位
  return await this.calendarService.createSlotDirect(dto);
}
```

### 9.2 原则 2：isSlotAvailable() 仅用于 UI 反馈

- ✅ **用途**: 前端实时显示"该时间段是否可用"
- ❌ **禁用**: 作为条件判断来决定是否进行写操作

```typescript
// ✅ UI展示场景 - 正确
const isAvailable = await calendarService.isSlotAvailable(...);
if (isAvailable) {
  // 仅用于UI展示，显示绿色/可预订
  setUIAvailable(true);
} else {
  // 仅用于UI展示，显示红色/已占用
  setUIAvailable(false);
}

// ❌ 业务逻辑场景 - 禁止
const isAvailable = await calendarService.isSlotAvailable(...);
if (isAvailable) {
  // 竞态风险！最终以写入时的约束为准
  const slot = await calendarService.createSlotDirect(dto);
}
```

### 9.3 原则 3：所有时间采用 UTC + 半开区间 [start, end)

#### 时间语义

- **UTC时区**: 所有时间统一采用UTC+0，避免时区问题
- **半开区间**: `[10:00, 10:30)` 表示10:00起(包含)到10:30前(不包含)
- **相邻不冲突**: `[10:00,10:30)` 与 `[10:30,11:00)` 不冲突

```typescript
// ✅ 正确的时间设置
const startTime = new Date('2025-11-15T14:00:00Z');    // UTC
const endTime = new Date('2025-11-15T15:00:00Z');      // UTC
const duration = (endTime.getTime() - startTime.getTime()) / 60000;  // 60分钟

// ❌ 避免
const startTime = new Date('2025-11-15 14:00:00');     // 无时区信息
const endTime = new Date('2025-11-15 22:00:00 CST');   // 混合时区
```

### 9.4 原则 4：事务一致性

改期操作必须在事务中完成：

```typescript
// 改期操作：释放旧槽位 + 占用新槽位（原子）
async rescheduleSlot(rescheduleDto: RescheduleSlotDto) {
  // 若Step 1成功但Step 2失败，需要回滚Step 1
  // 因此必须在事务中执行
  try {
    const newSlot = await this.repository.reschedule(rescheduleDto);
    if (!newSlot) {
      throw new SlotConflictException('New time slot conflict');
    }
    return newSlot;
  } catch (error) {
    if (error.code === '23P01') {
      throw new SlotConflictException();
    }
    throw error;
  }
}
```

### 9.5 原则 5：权限校验与所有权检查

```typescript
// 释放槽位前必须校验所有权
async releaseSlot(slotId: string, userId: string): Promise<boolean> {
  // 验证当前用户是否为该槽位的所有者
  const slot = await this.repository.findById(slotId);
  if (!slot) {
    throw new SlotNotFoundException(slotId);
  }
  
  if (slot.userId !== userId) {
    throw new InvalidUserException(userId);
  }
  
  return await this.repository.updateStatus(slotId, 'cancelled');
}
```

---

## 📊 10. 典型业务场景

### 10.1 约课流程（简化版）

```
前端请求 createSession
  ↓
┌─────────────────────────────────────────┐
│ BFF层: SessionController.createSession() │
└─────────────────────────────────────────┘
  ↓
  ├─ Step 1: 验证输入 (DTO验证)
  ├─ Step 2: 创建session记录 (SessionService)
  ├─ Step 3: 创建会议室 (MeetingProvider)
  ├─ Step 4: 更新session会议信息 (SessionService)
  ├─ Step 5: 【关键】直接占用日历槽位
  │         CalendarService.createSlotDirect(CreateSlotDto)
  │         ↓
  │         抛SQLSTATE 23P01 → 捕获返回409 Conflict
  │         (其他进程在Step 3-4期间占用了该时间段)
  ├─ Step 6: 生成定时通知 (NotificationService)
  └─ Step 7: 发送邮件 (EmailService)
  ↓
返回前端: { sessionId, meetingUrl, status, slotId, ... }
```

**关键特性**:
- 无Step 0的"先查询可用性"
- 直接INSERT，让DB的EXCLUDE约束防护
- 若失败，整个transaction回滚

### 10.2 改期流程

```
前端请求 rescheduleSession
  ↓
  ├─ 校验权限 (当前用户 == session.counselorId或mentorId)
  ├─ 校验新时间 (晚于当前时间、不超过180分钟)
  ├─ 调用CalendarService.rescheduleSlot()
  │  ↓
  │  BEGIN TRANSACTION
  │    ├─ Step 1: 释放旧槽位 (UPDATE status='cancelled')
  │    ├─ Step 2: 占用新槽位 (INSERT)
  │    │          (可能被EXCLUDE约束拒绝)
  │    └─ COMMIT / ROLLBACK
  │
  ├─ 若改期成功，更新session的时间字段 (SessionService)
  ├─ 发送改期通知邮件 (NotificationService)
  └─ 返回成功响应
```

### 10.3 用户设置不可用时间

```
前端请求 blockTimeSlot
  ↓
  ├─ 验证用户身份 (JWT token)
  ├─ 调用CalendarService.blockTimeSlot()
  │  ↓
  │  INSERT into calendar with:
  │    - type = 'block' 或 reason = '导师休假'
  │    - sessionId = null
  │    - status = 'booked'
  │
  │  若冲突 → 返回409 (现有槽位已占用)
  │
  └─ 返回成功响应
```

---

## 🧪 11. 测试策略

### 11.1 单元测试 - CalendarService

```typescript
// src/core/calendar/services/calendar.service.spec.ts

describe('CalendarService', () => {
  describe('createSlotDirect', () => {
    it('should successfully create slot when time is available', async () => {
      const dto = new CreateSlotDto();
      const result = await service.createSlotDirect(dto);
      expect(result).toBeDefined();
      expect(result.userId).toBe(dto.userId);
    });

    it('should return null when time slot conflicts', async () => {
      // Mock repository to throw SQLSTATE 23P01
      const result = await service.createSlotDirect(dto);
      expect(result).toBeNull();
    });
  });

  describe('rescheduleSlot', () => {
    it('should atomically reschedule when new time is available', async () => {
      const result = await service.rescheduleSlot(rescheduleDto);
      expect(result).toBeDefined();
      
      // Verify old slot is cancelled
      const oldSlot = await repository.findById(rescheduleDto.oldSlotId);
      expect(oldSlot.status).toBe('cancelled');
    });

    it('should rollback on conflict in new time', async () => {
      // New time conflicts - should rollback
      const result = await service.rescheduleSlot(rescheduleDto);
      expect(result).toBeNull();
      
      // Old slot should still be booked (rollback)
      const oldSlot = await repository.findById(rescheduleDto.oldSlotId);
      expect(oldSlot.status).toBe('booked');
    });
  });
});
```

### 11.2 集成测试 - 并发场景

```typescript
// 两个用户同时预订同一时间段
it('should prevent concurrent booking of same slot', async () => {
  const dto = new CreateSlotDto();
  
  // 模拟两个并发请求
  const [result1, result2] = await Promise.all([
    service.createSlotDirect(dto),
    service.createSlotDirect(dto)
  ]);
  
  // 其中一个应返回null（冲突）
  expect((result1 === null) || (result2 === null)).toBe(true);
  
  // 恰好一个成功
  expect((result1 !== null) !== (result2 !== null)).toBe(true);
});
```

---

## 🔍 12. PostgreSQL TSTZRANGE 详解

### 12.1 TSTZRANGE 类型

```sql
-- TSTZRANGE = "Timestamp with Time Zone RANGE"
-- 表示带时区的时间范围

-- 示例
'[2025-11-15 14:00:00+00, 2025-11-15 15:00:00+00)' -- 半开区间

-- 范围边界说明
'['  -- 左闭（start包含）
']'  -- 右闭（end包含）
'('  -- 左开（start不包含）
')'  -- 右开（end不包含）

-- 最常用：'[)' 即 [start, end)
```

### 12.2 范围操作符

```sql
-- 重叠检测 &&
SELECT * FROM calendar
WHERE time_range && '[2025-11-15 14:00:00+00, 2025-11-15 15:00:00+00)'::tstzrange;

-- 包含关系 @>
SELECT * FROM calendar
WHERE time_range @> '2025-11-15 14:30:00+00'::timestamptz;

-- 被包含 <@
SELECT * FROM calendar
WHERE time_range <@ '[2025-11-15 00:00:00+00, 2025-11-15 23:59:59+00)'::tstzrange;

-- 相邻 -|-
SELECT * FROM calendar
WHERE time_range -|- '[2025-11-15 15:00:00+00, 2025-11-15 16:00:00+00)'::tstzrange;

-- 严格左边 <<
SELECT * FROM calendar
WHERE time_range << '[2025-11-15 15:00:00+00, 2025-11-15 16:00:00+00)'::tstzrange;
```

### 12.3 GIST 索引

```sql
-- GiST = Generalized Search Tree
-- 用于支持范围查询和EXCLUDE约束

CREATE INDEX idx_calendar_timerange 
  ON calendar USING GIST (time_range);

-- GIST索引支持以下操作符：
-- && (overlap)   @> (contains)   <@ (contained by)
-- << (strictly left)  >> (strictly right)
```

---

## 📋 13. 核心设计总结表

| 设计要素 | 说明 | 体现 |
|--------|-----|-----|
| **并发安全** | 数据库EXCLUDE约束自动防护 | SQLSTATE 23P01捕获 |
| **原子性** | 单条SQL语句原子执行 | INSERT带约束、事务改期 |
| **职责分离** | Service负责业务、Repository负责SQL | clean architecture |
| **时间语义** | UTC + 半开区间[start,end) | TSTZRANGE使用 |
| **冗余字段** | user_type用于查询优化 | 不参与约束检查 |
| **异常处理** | 异常码SQLSTATE 23P01 | SlotConflictException |
| **权限校验** | 操作前校验所有权 | releaseSlot验证userId |
| **事务一致性** | 改期原子执行 | reschedule事务 |
| **查询优化** | 联合索引 + GIST索引 | 快速定位和范围查询 |

---

## 🚀 14. 最佳实践清单

- [ ] 所有时间转换为UTC，使用ISO 8601格式
- [ ] 创建槽位时直接INSERT，让数据库防护冲突
- [ ] 不要在isSlotAvailable()后条件判断再写入
- [ ] 改期操作必须在事务中完成
- [ ] 释放槽位前校验用户权限
- [ ] 异常处理中区分SQLSTATE 23P01 vs 其他错误
- [ ] 监控数据库排斥约束的触发频率
- [ ] 定期分析calendar表的索引使用情况
- [ ] 日志记录所有冲突事件便于调试
- [ ] 前端UI中使用isSlotAvailable()仅用于显示提示

---

## 📚 参考资源

| 资源 | 位置 | 说明 |
|------|------|-----|
| Session Domain设计 | `session_domain_design_v3.3.md` | Calendar在整体系统中的位置 |
| Schema定义 | `src/infrastructure/database/schema/calendar.schema.ts` | Drizzle ORM表定义 |
| 迁移脚本 | `src/infrastructure/database/migrations/` | GIST索引和EXCLUDE约束DDL |
| PostgreSQL文档 | https://www.postgresql.org/docs/current/rangetypes.html | TSTZRANGE详细文档 |
| Drizzle文档 | https://orm.drizzle.team/docs/overview | ORM使用指南 |

---

**文档结束**

