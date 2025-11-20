# 导师应付账款流水表设计

> 版本：v4.0 | 最后更新：2025-11-13 | 架构：事件驱动 + 不可变表

## 设计决策清单

| 编号 | 决策项           | 决策内容                                                       |
| ---- | ---------------- | -------------------------------------------------------------- |
| A-1  | referenceId 关联 | 单 referenceId 关联到 service_references 表的 id               |
| B    | 服务快照         | 保留 mentorId, serviceTypeCode, studentId                      |
| D-1  | billingMode 存储 | 通过 serviceType 隐式确定                                      |
| D-2  | 包计费时机       | 最后一个 session 完成后统一计费                                |
| F-G  | 费用调整         | 负向交易 + 链式调整（支持多次）                                |
| K    | 唯一索引         | 单一索引处理所有场景                                           |
| L    | 服务类型存储     | 使用 service_types 表（非枚举）                                |

---

## 数据模型

### 1.1 service_types（服务类型配置表）

**Schema 文件**：`src/infrastructure/database/schema/service-types.schema.ts`

```typescript
export const serviceTypes = pgTable("service_types", {
  // Primary Key [主键]
  id: uuid("id").defaultRandom().primaryKey(),

  // Basic Information [基本信息]
  code: varchar("code", { length: 50 }).notNull(), // Service type code [服务类型编码]
  name: varchar("name", { length: 255 }).notNull(), // Service type name [服务类型名称]
  description: text("description"), // Service type description [服务类型描述]

  // Status Management [状态管理]
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"), // Service type status [服务类型状态]

  // Audit Fields [审计字段]
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

> **Note**：由管理员在数据库中维护（无管理后台）

---

### 1.2 mentor_payable_ledgers（导师应付账款流水表）

**Schema 文件**：`src/infrastructure/database/schema/mentor-payable-ledgers.schema.ts`

```typescript
export const mentorPayableLedgers = pgTable("mentor_payable_ledgers", {
  // ========== Primary Key & Relations ==========
  id: uuid("id").primaryKey().defaultRandom(),

  /**
   * Reference ID - Links to service_references table
   * References: service_references.id
   */
  referenceId: uuid("reference_id").notNull(),

  // ========== Participants ==========
  /**
   * Mentor ID
   * References: mentor.id
   */
  mentorId: uuid("mentor_id").notNull(),

  /**
   * Student ID (nullable)
   * References: student.id
   * Nullable: Some services may not have students
   */
  studentId: uuid("student_id"),

  // ========== Service Snapshot ==========
  /**
   * Session Type ID - References session_types.id
   * Purpose: Links to session type configuration
   */
  sessionTypeCode: varchar("session_type_code", { length: 50 })
    .notNull(),

  // ========== Price Snapshot ==========
  /**
   * Unit Price - Price per session/hour/package
   * Precision: 12 digits total, 1 decimal place
   */
  price: numeric("price", { precision: 12, scale: 1 }).notNull(),

  /**
   * Total Amount - Calculated amount (may be negative for adjustments)
   * Precision: 12 digits total, 2 decimal places
   */
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),

  /**
   * Currency - ISO 4217 currency code
   * Default: USD
   */
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),

  // ========== Adjustments ==========
  /**
   * Original ID - Points to the adjusted record
   * Used for chain adjustments (supports multiple adjustments)
   * Null for original records
   */
  originalId: uuid("original_id"),

  /**
   * Adjustment Reason - Reason for adjustment
   * Required when original_id is not null
   */
  adjustmentReason: varchar("adjustment_reason", { length: 500 }),

  // ========== Timestamps ==========
  /**
   * Created At - Record creation timestamp (immutable)
   */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  /**
   * Created By - Operator user ID (for audit trail)
   * References: identity.users.id
   */
  createdBy: uuid("created_by"),
});
```

**核心特征**：

- 不可变表（只增不改）
- 防腐层（无实际外键）
- 快照设计（记录服务和价格）
- 链式调整（支持多次）

---

### 1.3 mentor_prices（导师价格配置表）

**Schema 文件**：`src/infrastructure/database/schema/mentor-prices.schema.ts`

```typescript
export const mentorPrices = pgTable("mentor_prices", {
  // ========== Primary Key ==========
  /**
   * Record ID
   */
  id: uuid("id").defaultRandom().primaryKey(),

  // ========== Entity References ==========
  /**
   * Mentor ID
   * References: mentor.id
   */
  mentorId: varchar("mentor_id", { length: 32 })
    .references(() => mentorTable.id, { onDelete: "cascade" })
    .notNull(),

  /**
   * Session Type ID
   * References: session_types.id
   */
  sessionTypeCode: varchar("session_type_code", { length: 50 }) // 使用sessionTypeCode引用session_types.id
    .notNull()
    .references(() => sessionTypes.id, { onDelete: "cascade" }),

  // ========== Pricing Configuration ==========
  /**
   * Package Code - Optional
   */
  packageCode: varchar("package_code", { length: 50 }),

  /**
   * Price amount
   * Precision: 12 digits total, 1 decimal place
   */
  price: decimal("price", { precision: 12, scale: 1 }).notNull(),

  /**
   * Currency code
   * ISO 4217 format
   * Default: USD
   */
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),

  /**
   * Status of the price configuration
   * Values: 'active', 'inactive'
   * Default: active
   */
  status: varchar("status", { length: 20 }).notNull().default("active"),

  /**
   * Updated by user ID
   * References: mentor.id
   * Nullable: Initial creation may not have an updater
   */
  updatedBy: varchar("updated_by", { length: 32 }).references(
    () => mentorTable.id,
  ),

  // ========== Timestamps ==========
  /**
   * Creation timestamp
   */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  /**
   * Last update timestamp
   */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

**索引定义**：

```typescript
(table) => ({
  // 复合索引：导师ID + 会话类型代码 + 状态
  mentorSessionTypeIdx: index("idx_mentor_session_type").on(
    table.mentorId,
    table.sessionTypeCode,
    table.status,
  ),
  // 导师ID索引
  mentorIdx: index("idx_mentor_prices_mentor").on(table.mentorId),
  // 会话类型代码索引
  sessionTypeIdx: index("idx_mentor_prices_session_type").on(
    table.sessionTypeCode,
  ),
  // 状态索引
  statusIdx: index("idx_mentor_prices_status").on(table.status),
}),
```

**设计原则**：

1. 价格配置与导师和服务类型关联
2. 支持多种计费模式
3. 价格历史可追溯

**注意事项**：

1. 价格变更不需要创建新记录，而是更新现有记录
2. 价格变更不需要审批流程
3. 价格变更不需要通知相关方
4. 价格变更需要记录变更人，不需要记录变更原因

---

### 2. 服务会话完成事件（ServiceSessionCompletedEvent）
// services.session.completed
```typescript
export interface IServiceSessionCompletedPayload {
    sessionId?: string;
    studentId: string;
    mentorId?: string;
    referenceId?: string;
    sessionTypeCode: string;
    serviceTypeCode: string; // 关联service_types表中的code字段
    actualDurationHours: number;
    durationHours: number;
    allowBilling: boolean;
}

export const SERVICE_SESSION_COMPLETED_EVENT = "services.session.completed";

export interface IServiceSessionCompletedEvent extends IEvent<IServiceSessionCompletedPayload> {
    type: typeof SERVICE_SESSION_COMPLETED_EVENT;
}
```

**设计原则**：事件包含完整上下文，Financial Domain **无需**跨域查询

---

## 事件消费（Financial Domain）

### 路由处理

```typescript
// ServiceSessionCompletedEvent 处理
@OnEvent('services.session.completed')
async handleSessionCompleted(event: IServiceSessionCompletedEvent) {
  if (await this.isDuplicate(event)) return;
  if (event.payload.allowBilling === false) return; // 不允许计费
  await this.routeBilling(event.payload);
}

// 计费路由
async routeBilling(payload: IServiceSessionCompletedPayload) {
  // 实现计费逻辑
}
```

### 计费逻辑

**说明**: 导师应付账款流水记录主要通过 `services.session.completed` 事件触发创建，同时也支持其他业务场景下的手动调整记录。

```typescript
// 按次计费
async createPerSessionBilling(payload: IServiceSessionCompletedPayload) {
  const price = await db.query.mentorPrices.findFirst({
    where: and(
      eq(mentorPrices.mentorId, payload.mentorId!),
      eq(mentorPrices.sessionTypeCode, payload.sessionTypeCode),
      // 也可以根据需要使用serviceTypeCode进行查询
      // eq(mentorPrices.serviceTypeCode, payload.serviceTypeCode)
    )
  });
  if (!price) throw new PriceNotFoundError();
  
  const referenceId = payload.referenceId || payload.sessionId;
  if (!referenceId) throw new InvalidReferenceIdError();
  
  const amount = price.price * payload.actualDurationHours;
  
  await db.insert(mentorPayableLedgers).values({
    referenceId: referenceId,
    mentorId: payload.mentorId!,
    studentId: payload.studentId,
    sessionTypeCode: payload.sessionTypeCode,
    serviceTypeCode: payload.serviceTypeCode, // 添加serviceTypeCode字段
    price: price.price,
    amount: amount,
    currency: price.currency,
    createdBy: 'system'
  });
}

// 包计费
async createPackageBilling(payload: IServiceSessionCompletedPayload) {
  // 实现包计费逻辑
}
```

**关键点**：

- 使用 `actualDurationHours` 计算实际服务时长
- 使用 `allowBilling` 控制是否允许计费
- 优先使用 `referenceId` 作为关联ID，否则使用 `sessionId`

---

## 费用调整

### 场景示例

**场景 1**：服务单价记录错误，需要退款

```typescript
// 原始记录（金额 $100）
{ id: 'ledger-001', referenceId: 'session-456', amount: 100.0, originalId: null }

// 调整记录：退款 $50
await adjustPayableLedger({
  originalLedgerId: 'ledger-001',
  adjustmentAmount: -50.0,    // 负值表示退款
  reason: '单价记录错误',
  operatorUserId: 'user-789'
});

// 生成调整记录
{ id: 'ledger-002', referenceId: 'session-456', amount: -50.0, originalId: 'ledger-001' }
```

**最终结果**：SUM(amount) = 100 + (-50) = **$50**

**场景 2**：二次调整（第一次调整金额错误）

```typescript
// 二次调整：补扣 $20（第一次应该只退30，不是50）
await adjustPayableLedger({
  originalLedgerId: 'ledger-002',  // 指向上一次调整，不是原始记录
  adjustmentAmount: 20.0,
  reason: '第一次调整金额错误'
});

// 生成二次调整记录
{ id: 'ledger-003', referenceId: 'session-456', amount: 20.0, originalId: 'ledger-002' }
```

**最终追溯链**：`ledger-003 → ledger-002 → ledger-001`

**最终结果**：SUM(amount) = 100 + (-50) + 20 = **$70**

---

## 幂等性实现

```typescript
async isDuplicate(event: IServiceSessionCompletedEvent): boolean {
  const referenceId = event.payload.referenceId || event.payload.sessionId;
  if (!referenceId) return false;
  
  return await db.query.mentorPayableLedgers.findFirst({
    where: and(
      eq(mentorPayableLedgers.referenceId, referenceId),
      isNull(mentorPayableLedgers.originalId)
    )
  }).then(Boolean);
}
```

**底层保障**：唯一索引 `idx_mentor_payable_relation` 和 `idx_mentor_payable_package`

---

## 关键查询场景

```typescript
// 1. 查询某个导师的所有应付账款
await db.query.mentorPayableLedgers.findMany({
    where: eq(mentorPayableLedgers.mentorId, "mentor-123"),
});

// 2. 查询某个会话的所有记录（含调整）
await db.query.mentorPayableLedgers.findMany({
    where: eq(mentorPayableLedgers.referenceId, "session-456"),
});

// 3. 查询某个学生的所有记录
await db.query.mentorPayableLedgers.findMany({
    where: eq(mentorPayableLedgers.studentId, "student-123"),
});

// 4. 查询某笔调整的所有后续调整
await db.query.mentorPayableLedgers.findMany({
    where: eq(mentorPayableLedgers.originalId, "ledger-002"),
});
```

---

## 设计原则总结

| 原则     | 实现                                      | 优势                     |
| -------- | ----------------------------------------- | ------------------------ |
| 不可变表 | 无 `updatedAt`/`updatedBy`，只支持 INSERT | 审计完整，逻辑简单       |
| 防腐层   | 无实际外键，字符串UUID引用                | 减少领域耦合，独立演进   |
| 快照设计 | 记录服务和价格快照                        | 避免跨域查询，数据完整性 |
| 职责分离 | `relationId` vs `sourceEntity`，事件驱动  | 职责清晰，避免跨域查询   |
