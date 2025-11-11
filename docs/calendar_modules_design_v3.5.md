# Calendar Module API 快速参考

**文档版本**: v3.5  
**更新日期**: 2025-11-11  
**目标受众**: 后端开发、API集成  
**阅读时间**: 5分钟  
**基于实现版本**: calendar.service.ts、create-slot.dto.ts、query-slot.dto.ts

---

## 📁 模块结构

```
src/core/calendar/
├── services/
│   └── calendar.service.ts              # 核心业务服务
├── dto/
│   ├── create-slot.dto.ts               # 创建时间段DTO
│   └── query-slot.dto.ts                # 查询时间段DTO
└── interfaces/
    └── calendar-slot.interface.ts       # 实体接口和枚举定义
```

---

## 📋 CalendarService API

### 核心方法列表

| 方法 | 参数 | 返回值 | 说明 |
|-----|------|------|-----|
| `createSlotDirect(dto, tx?)` | CreateSlotDto, tx?: DrizzleTransaction | ICalendarSlotEntity \| null | 原子操作创建时间段，冲突返回null |
| `isSlotAvailable(userId, userType, startTime, durationMinutes)` | userId: UUID, userType: UserType, startTime: Date, durationMinutes: Integer | boolean | 检查时间段可用性（仅UI用途） |
| `releaseSlot(slotId)` | slotId: UUID | ICalendarSlotEntity | 释放时间段（status → cancelled） |
| `getBookedSlots(dto)` | QuerySlotDto | ICalendarSlotEntity[] | 批量查询用户的已占用时段 |
| `rescheduleSlot(oldSlotId, newStartTime, newDurationMinutes)` | oldSlotId: UUID, newStartTime: Date, newDurationMinutes: Integer | ICalendarSlotEntity \| null | 改期操作（事务：释放旧+占用新） |
| `getSlotById(slotId)` | slotId: UUID | ICalendarSlotEntity \| null | 根据ID查询单个时间段 |
| `getSlotBySessionId(sessionId)` | sessionId: UUID | ICalendarSlotEntity \| null | 根据session_id查询时间段 |
| `blockTimeSlot(userId, userType, startTime, durationMinutes, reason)` | userId: UUID, userType: UserType, startTime: Date, durationMinutes: Integer, reason: String | ICalendarSlotEntity \| null | 用户设置不可用时间 |

---

## 📊 DTO 定义

### CreateSlotDto

**文件**: `src/core/calendar/dto/create-slot.dto.ts`

| 字段 | 类型 | 必填 | 说明 | 验证规则 |
|------|------|------|-----|--------|
| userId | string (UUID) | ✅ | 用户ID | @IsUUID() |
| userType | UserType Enum | ✅ | 用户类型 | @IsEnum(UserType)，值: mentor\|student\|counselor |
| startTime | string (ISO 8601) | ✅ | 开始时间 | @IsDateString() |
| durationMinutes | number | ✅ | 时长（分钟） | @IsInt() @Min(30) @Max(180) |
| sessionId | string (UUID) | ❌ | 关联的会话ID | @IsOptional() @IsUUID() |
| slotType | SlotType Enum | ✅ | 时间段类型 | @IsEnum(SlotType)，值: session\|class_session\|comm_session |
| reason | string | ❌ | 占用/阻止原因 | @IsOptional() @MaxLength(255) |

### QuerySlotDto

**文件**: `src/core/calendar/dto/query-slot.dto.ts`

| 字段 | 类型 | 必填 | 说明 | 验证规则 |
|------|------|------|-----|--------|
| userType | UserType Enum | ✅ | 用户类型 | @IsEnum(UserType) |
| userId | string (UUID) | ✅ | 用户ID | @IsUUID() |
| dateFrom | string (ISO 8601) | ❌ | 查询开始日期 | @IsOptional() @IsDateString() |
| dateTo | string (ISO 8601) | ❌ | 查询结束日期 | @IsOptional() @IsDateString()，默认90天 |

### ICalendarSlotEntity（返回值实体）

**文件**: `src/core/calendar/interfaces/calendar-slot.interface.ts`

| 字段 | 类型 | 说明 |
|------|------|-----|
| id | string | 主键（UUID） |
| userId | string | 用户ID（UUID） |
| userType | UserType | 用户类型（mentor\|student\|counselor） |
| timeRange | ITimeRange | 时间范围对象 `{ start: Date, end: Date }` |
| durationMinutes | number | 时长（分钟） |
| sessionId | string \| null | 关联的会话ID（可为null） |
| slotType | SlotType | 时间段类型（session\|class_session\|comm_session） |
| status | SlotStatus | 状态（booked\|cancelled） |
| reason | string \| null | 占用/阻止原因（可为null） |
| createdAt | Date | 创建时间 |
| updatedAt | Date | 更新时间 |

---

## 📌 枚举定义

### UserType

| 值 | 说明 |
|------|-----|
| mentor | 导师 |
| student | 学生 |
| counselor | 咨询师 |

### SlotType

| 值 | 说明 |
|------|-----|
| session | 一对一约课 |
| class_session | 课程约课 |
| comm_session | 沟通约课 |

### SlotStatus

| 值 | 说明 |
|------|-----|
| booked | 已占用 |
| cancelled | 已取消 |

---

## 📅 数据库表：calendar

**注**: 表名为 `calendar`（非 `calendar_slots`）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|-----|
| id | UUID | PK | 主键 |
| user_id | UUID | NOT NULL, INDEX | 用户ID |
| user_type | VARCHAR(50) | NOT NULL | 用户类型（冗余字段，用于查询优化） |
| time_range | TSTZRANGE | NOT NULL, GIST | 时间范围（半开区间[start, end)） |
| duration_minutes | INTEGER | NOT NULL, CHECK(30-180) | 时长（分钟） |
| session_id | UUID | NULLABLE, INDEX | 关联会话ID |
| type | VARCHAR(50) | NOT NULL | **注**: 字段名为 `type`，非 `slot_type` |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'booked' | 状态（booked\|cancelled） |
| reason | TEXT | NULLABLE | 占用原因 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 更新时间 |

**EXCLUDE 约束**（防止时间冲突）:
```sql
EXCLUDE USING GIST (
  user_id WITH =,
  time_range WITH &&
) WHERE (status = 'booked');
```

**索引**:
- `idx_calendar_user`: (user_id, user_type)
- `idx_calendar_session`: (session_id)
- GIST索引：自动由EXCLUDE约束创建

---

## ⚡ 快速示例

### 创建时间段
```typescript
const dto: CreateSlotDto = {
  userId: 'uuid-user-123',
  userType: UserType.MENTOR,
  startTime: '2025-11-15T14:00:00Z',
  durationMinutes: 60,
  sessionId: 'uuid-session-456',
  slotType: SlotType.SESSION
};

const slot = await calendarService.createSlotDirect(dto);
if (!slot) {
  // 时间段已被占用，冲突返回null
}
```

### 检查可用性（仅UI用途）
```typescript
const isAvailable = await calendarService.isSlotAvailable(
  'uuid-user-123',
  UserType.MENTOR,
  new Date('2025-11-15T14:00:00Z'),
  60
);
```

### 获取用户的已占用时段
```typescript
const slots = await calendarService.getBookedSlots({
  userId: 'uuid-user-123',
  userType: UserType.MENTOR,
  dateFrom: '2025-11-01T00:00:00Z',
  dateTo: '2025-11-30T23:59:59Z'
});
```

### 释放时间段
```typescript
const released = await calendarService.releaseSlot('uuid-slot-123');
```

### 改期操作
```typescript
const newSlot = await calendarService.rescheduleSlot(
  'uuid-slot-old',
  new Date('2025-11-16T14:00:00Z'),
  60
);
if (!newSlot) {
  // 新时间段冲突，改期失败
}
```

---

## 📝 异常处理

### 常见异常类型

| 异常类 | 触发条件 | HTTP状态 |
|------|--------|--------|
| CalendarNotFoundException | 时间段不存在 | 404 Not Found |
| CalendarException | 数据验证失败、业务规则违反 | 400 Bad Request |

### 处理冲突异常
```typescript
try {
  const slot = await calendarService.createSlotDirect(dto);
  if (!slot) {
    // 时间段冲突（SQLSTATE 23P01）- 返回null而非异常
  }
} catch (error) {
  if (error instanceof CalendarException) {
    // 处理其他错误
  }
}
```

---

## ✅ 核心特性

| 特性 | 说明 |
|------|-----|
| **原子性** | 单条INSERT由EXCLUDE约束保护，或事务保证 |
| **并发安全** | PostgreSQL MVCC + EXCLUDE约束自动处理 |
| **无竞态** | 直接INSERT，不需要"先查后写" |
| **时间半开区间** | [start, end) - 相邻槽位不冲突 |
| **冗余字段** | user_type 用于查询优化，不参与约束 |
| **事务支持** | rescheduleSlot 使用数据库事务 |

---

## 🧪 关键测试场景

- [ ] 并发创建相同时间段，仅一个成功
- [ ] 改期失败时旧槽位保持booked状态
- [ ] 已cancelled槽位不阻止新占用
- [ ] 相邻槽位 [10:00,10:30) 与 [10:30,11:00) 不冲突
- [ ] isSlotAvailable 返回结果与INSERT结果可能不一致（竞态）
- [ ] 日期范围查询超过90天返回异常

---

**快速参考结束**
