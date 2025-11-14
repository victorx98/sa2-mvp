# 导师应付账款流水表设计

> 版本：v4.0 | 最后更新：2025-11-13 | 架构：事件驱动 + 不可变表

## 设计决策清单

| 编号 | 决策项           | 决策内容                                                       |
| ---- | ---------------- | -------------------------------------------------------------- |
| A-1  | relationId 关联  | 单 relationId + sourceEntity 区分来源                          |
| B    | 服务快照         | 保留 mentorUserId, serviceTypeCode, serviceName, studentUserId |
| D-1  | billingMode 存储 | 通过 serviceType 隐式确定                                      |
| D-2  | 包计费时机       | 最后一个 session 完成后统一计费                                |
| F-G  | 费用调整         | 负向交易 + 链式调整（支持多次）                                |
| I    | 结算字段         | 独立 settlement 表处理                                         |
| K    | 唯一索引         | 两个索引分别处理按次和按包                                     |
| L    | 服务类型存储     | 使用 service_types 表（非枚举）                                |
| M    | 评价后计费       | requiredEvaluation 标记                                        |

---

## 数据模型

### 1.1 service_types（服务类型配置表）

**Schema 文件**：`src/infrastructure/database/schema/service-types.schema.ts`

```typescript
export const serviceTypes = pgTable("service_types", {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull().unique(), // 服务类型代码（如：session）
    name: varchar("name", { length: 200 }).notNull(), // 服务名称
    requiredEvaluation: boolean("required_evaluation").notNull().default(false), // 是否评价后计费
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

> **Note**：由管理员在数据库中维护（无管理后台）

---

### 1.2 mentor_payable_ledgers（导师应付账款流水表）

**Schema 文件**：`src/infrastructure/database/schema/mentor-payable-ledgers.schema.ts`

```typescript
export const mentorPayableLedgers = pgTable("mentor_payable_ledgers", {
    id: uuid("id").primaryKey().defaultRandom(),
    relationId: uuid("relation_id").notNull(), // 关联服务记录ID（如：session.id）
    sourceEntity: varchar("source_entity", { length: 50 }).notNull(), // 来源表（session/internal_referral）
    mentorUserId: uuid("mentor_user_id").notNull(), // 导师ID
    studentUserId: uuid("student_user_id"), // 学生ID（可为空）
    serviceTypeCode: varchar("service_type_code", { length: 50 }).notNull(), // 服务类型Code（快照）
    serviceName: varchar("service_name", { length: 500 }), // 服务名称快照
    price: numeric("price", { precision: 12, scale: 1 }).notNull(), // 单价
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), // 总金额（调整可为负）
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    originalId: uuid("original_id"), // 被调整的原始记录ID（链式调整）
    adjustmentReason: varchar("adjustment_reason", { length: 500 }), // 调整原因
    servicePackageId: uuid("service_package_id"), // 服务包ID（包计费模式）
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"), // 操作人ID
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
    id: uuid("id").primaryKey().defaultRandom(),
    mentorUserId: uuid("mentor_user_id").notNull(), // 导师ID
    serviceTypeCode: varchar("service_type_code", { length: 50 }).notNull(), // 服务类型Code
    price: numeric("price", { precision: 12, scale: 1 }).notNull(), // 单价
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    status: varchar("status", { length: 20 }).notNull().default("active"), // active/inactive
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid(updated_by),
});
```

---

## 唯一索引（幂等性保证）

```sql
-- 1. 按次计费（原始记录）
CREATE UNIQUE INDEX idx_mentor_payable_relation
  ON mentor_payable_ledgers(relation_id, source_entity)
  WHERE original_id IS NULL;

-- 2. 按包计费（原始记录）
CREATE UNIQUE INDEX idx_mentor_payable_package
  ON mentor_payable_ledgers(service_package_id, relation_id, source_entity)
  WHERE original_id IS NULL
    AND service_package_id IS NOT NULL;
```

---

## 事件定义

### SessionCompletedEvent
// services.session.completed
```typescript
export interface SessionCompletedEvent {
    sessionId: string;
    mentorUserId: string;
    studentUserId: string | null;
    mentorName: string;
    studentName: string;
    serviceTypeCode: string; // 服务类型 code
    serviceName: string; // 服务名称
    durationHours?: number; // 服务时长（小时）
    completedAt: Date; // 完成时间
    requiredEvaluation: boolean; // 是否评价后计费
    // 包模式（可选）
    servicePackageId?: string;
    packageTotalSessions?: number;
    packageCompletedSessions?: number;
}
```

### SessionEvaluatedEvent
// services.session.evaluated
```typescript
export interface SessionEvaluatedEvent {
    sessionId: string;
    mentorUserId: string;
    studentUserId: string;
    mentorName: string;
    studentName: string;
    serviceTypeCode: string; // 服务类型 code
    serviceName: string; // 服务名称
    durationHours?: number; // 服务时长（小时）
    reviewedAt: Date; // 评价完成时间
    // 包模式（可选）
    servicePackageId?: string;
    packageTotalSessions?: number;
    packageCompletedSessions?: number;
}
```

**设计原则**：事件包含完整上下文，Financial Domain **无需**跨域查询

---

## 事件消费（Financial Domain）

### 路由处理

```typescript
// SessionCompletedEvent 处理
@OnEvent('services.session.completed')
async handleSessionCompleted(event: SessionCompletedEvent) {
  if (await this.isDuplicate(event)) return;
  if (event.requiredEvaluation) return; // 等待评价
  await this.routeBilling(event);
}

// SessionEvaluatedEvent 处理
@OnEvent('services.session.evaluated')
async handleSessionEvaluated(event: SessionEvaluatedEvent) {
  if (await this.isDuplicate(event)) return;
  await this.routeBilling(event);
}

// 计费路由
async routeBilling(event: SessionCompletedEvent | SessionEvaluatedEvent) {
  if (event.servicePackageId) {
    await this.createPackageBilling(event);
  } else {
    await this.createPerSessionBilling(event);
  }
}
```

### 计费逻辑

```typescript
// 按次计费
async createPerSessionBilling(event) {
  const price = await db.query.mentorPrices.findFirst({
    where: and(
      eq(mentorPrices.mentorUserId, event.mentorUserId),
      eq(mentorPrices.serviceTypeCode, event.serviceTypeCode)
    )
  });
  if (!price) throw new PriceNotFoundError();
  const amount = price.billingMode === 'per_hour'
    ? price.price * event.durationHours
    : price.price;
  await db.insert(mentorPayableLedgers).values({
    relationId: event.sessionId,
    sourceEntity: 'session',
    mentorUserId: event.mentorUserId,
    studentUserId: event.studentUserId,
    serviceTypeCode: event.serviceTypeCode,
    serviceName: event.serviceName,
    price: price.price,
    amount: amount,
    currency: price.currency,
    createdBy: 'system'
  });
}

// 包计费
async createPackageBilling(event) {
  if (event.packageCompletedSessions! < event.packageTotalSessions!) return; // 未完成
  const price = await db.query.mentorPrices.findFirst({
    where: and(
      eq(mentorPrices.mentorUserId, event.mentorUserId),
      eq(mentorPrices.serviceTypeCode, event.serviceTypeCode),
      eq(mentorPrices.servicePackageId, event.servicePackageId!)
    )
  });
  await db.insert(mentorPayableLedgers).values({
    relationId: event.sessionId,           // 最后一个 session ID
    sourceEntity: 'session',
    servicePackageId: event.servicePackageId,
    mentorUserId: event.mentorUserId,
    studentUserId: event.studentUserId,
    serviceTypeCode: event.serviceTypeCode,
    serviceName: event.serviceName,
    price: price.price,
    amount: price.price,
    currency: price.currency,
    createdBy: 'system'
  });
}
```

**关键点**：

- 包计费只在最后一个 session 完成后触发
- `relationId` 使用最后一个 session 的 ID用于追溯
- 金额 = 包总价（固定，不按实际完成次数变化）

---

## 费用调整

### 场景示例

**场景 1**：服务单价记录错误，需要退款

```typescript
// 原始记录（金额 $100）
{ id: 'ledger-001', relationId: 'session-456', amount: 100.0, originalId: null }

// 调整记录：退款 $50
await adjustPayableLedger({
  originalLedgerId: 'ledger-001',
  adjustmentAmount: -50.0,    // 负值表示退款
  reason: '单价记录错误',
  operatorUserId: 'user-789'
});

// 生成调整记录
{ id: 'ledger-002', relationId: 'session-456', amount: -50.0, originalId: 'ledger-001' }
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
{ id: 'ledger-003', relationId: 'session-456', amount: 20.0, originalId: 'ledger-002' }
```

**最终追溯链**：`ledger-003 → ledger-002 → ledger-001`

**最终结果**：SUM(amount) = 100 + (-50) + 20 = **$70**

---

## 幂等性实现

```typescript
async isDuplicate(event: SessionCompletedEvent): boolean {
  if (event.servicePackageId) {
    return await db.query.mentorPayableLedgers.findFirst({
      where: and(
        eq(mentorPayableLedgers.servicePackageId, event.servicePackageId!),
        eq(mentorPayableLedgers.relationId, event.sessionId),
        eq(mentorPayableLedgers.sourceEntity, 'session'),
        isNull(mentorPayableLedgers.originalId)
      )
    }).then(Boolean);
  }

  return await db.query.mentorPayableLedgers.findFirst({
    where: and(
      eq(mentorPayableLedgers.relationId, event.sessionId),
      eq(mentorPayableLedgers.sourceEntity, 'session'),
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
    where: eq(mentorPayableLedgers.mentorUserId, "mentor-123"),
});

// 2. 查询某个会话的所有记录（含调整）
await db.query.mentorPayableLedgers.findMany({
    where: and(eq(mentorPayableLedgers.relationId, "session-456"), eq(mentorPayableLedgers.sourceEntity, "session")),
});

// 3. 查询某个包的计费记录
await db.query.mentorPayableLedgers.findFirst({
    where: eq(mentorPayableLedgers.servicePackageId, "package-123"),
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
