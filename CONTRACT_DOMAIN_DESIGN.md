# MentorX 平台 Contract Domain 详细设计文档

> **版本：** v2.16.12
> **创建日期：** 2025-11-05
> **最后更新：** 2025-11-11
> **状态：** ✅ **架构重构设计完成 + 所有决策已确认**
> **负责域：** Contract Domain（合同域）
> **更新内容：** 架构重大重构 - 权益累积制 + 触发器驱动一致性
> **文档编号：** CONTRACT-DOMAIN-2025-11-11
> **决策状态：** 4/4 决策已完成 ✅

> ⚠️ **重要提示**：本文档描述 Contract Domain 的架构重构设计，v2.16.12 版本对核心表结构和数据流进行了重大调整。
>
> ✅ **决策完成**：2025-11-11 已完成所有架构设计决策（D-NEW-1 至 D-NEW-4），详见第 8 节

---

## 📋 目录

- [1. 核心架构重构](#1-核心架构重构)
- [2. 数据模型设计](#2-数据模型设计)
- [3. 触发器机制](#3-触发器机制)
- [4. 业务流程与数据流](#4-业务流程与数据流)
- [5. 领域服务接口](#5-领域服务接口)
- [6. DTO 定义](#6-dto-定义)
- [7. 业务规则](#7-业务规则)
- [8. 实施检查清单](#8-实施检查清单)

---

## 1. 核心架构重构

### 1.1 架构演进概述

**v2.16.12 重大重构**：从"合同级别权益管理"转变为"学生级别权益累积制"

#### 1.1.1 架构前（v2.16.10 及之前）

```
contracts (1) ←→ (∞) contract_service_entitlements（按合同）
   ↓
service_ledgers（记录 contract_id）
service_holds（记录 contract_id）
```

**问题**：
- 权益按合同隔离，无法跨合同使用
- 合同终止后权益无法继续使用
- 学生无法累积多个合同的权益

#### 1.1.2 架构后（v2.16.12）

```
students (1) ←→ (∞) contract_service_entitlements（按学生+服务类型累积）
   ↓                              ↑
   ├─→ contracts（记录初始权益）  │
   ├─→ contract_amendment_ledgers（记录额外权益）
   ├─→ service_holds（更新 held_quantity）
   └─→ service_ledgers（更新 consumed_quantity）
```

**优势**：
- ✅ 学生权益跨合同累积
- ✅ 合同终止不影响已累积权益
- ✅ 查询性能优化（单表查询）
- ✅ 职责清晰分离

---

### 1.2 核心设计原则

#### 原则 1：学生级权益累积制

```typescript
contract_service_entitlements 表键值：
PRIMARY KEY (student_id, service_type)

含义：
- 每个学生每种服务只有一条累积记录
- 多个合同的同类型服务权益自动累加
- 合同终止后权益继续保留
```

**示例**：
```typescript
// 学生 stu-001 购买多个合同
合同1：+5次 session
合同2：+3次 session
顾问赠送：+2次 session（addon）

contract_service_entitlements:
{
  studentId: 'stu-001',
  serviceType: 'session',
  totalQuantity: 10,        // 5 + 3 + 2
  consumedQuantity: 4,
  heldQuantity: 1,
  availableQuantity: 5      // 10 - 4 - 1
}
```

#### 原则 2：触发器驱动数据一致性

```
contract_service_entitlements 表由触发器维护：

❌ 应用层禁止直接 UPDATE/DELETE
✅ 仅允许触发器自动更新

触发器来源：
1. contract_amendment_ledgers.INSERT → total_quantity +=
2. service_ledgers.INSERT → consumed_quantity +=
3. service_holds.INSERT/UPDATE → held_quantity +=/-
```

**优势**：
- 数据库层面保证一致性
- 避免应用层并发问题
- 代码简洁（无需手动同步）

#### 原则 3：职责清晰分离

| 表名 | 职责 | 维护方式 |
|------|------|----------|
| contracts | 合同生命周期、财务信息 | 应用层直接操作 |
| contract_service_entitlements | 学生权益余额（只读） | 触发器自动维护 |
| contract_amendment_ledgers | 额外权益审计流水 | 应用层 INSERT |
| service_ledgers | 消费流水（只增） | 应用层 INSERT |
| service_holds | 服务预占 | 应用层 INSERT/UPDATE |

#### 原则 4：完整的审计追溯

```typescript
// 完整的数据追溯链

初始权益来源：
contracts.product_snapshot → 记录合同包含的服务项
  └─→ Application Layer → 初始化 contract_service_entitlements

额外权益来源：
contract_amendment_ledgers → 记录 who/when/what/why
  └─→ 触发器 → 更新 contract_service_entitlements.total_quantity

消费来源：
service_ledgers → 记录每次服务消费
  └─→ 触发器 → 更新 contract_service_entitlements.consumed_quantity
```

---

### 1.3 数据表职责矩阵

| 表名 | CREATE | READ | UPDATE | DELETE | 触发器 |
|------|--------|------|--------|--------|--------|
| **contracts** | ✅ 应用层 | ✅ 应用层 | ✅ 应用层 | ❌ | ❌ 无 |
| **contract_service_entitlements** | ✅ 应用层 | ✅ 应用层 | ❌ **禁止** | ❌ **禁止** | ✅ 3个触发器 |
| **contract_amendment_ledgers** | ✅ 应用层 | ✅ 应用层 | ❌ | ❌ | ✅ 1个触发器 |
| **service_ledgers** | ✅ 应用层 | ✅ 应用层 | ❌ | ❌ | ✅ 1个触发器 |
| **service_holds** | ✅ 应用层 | ✅ 应用层 | ✅ 应用层 | ❌ | ✅ 1个触发器 |

**关键规则**：
- contract_service_entitlements 表不允许应用层 UPDATE/DELETE
- 所有状态变更通过触发器自动完成
- 应用层只能通过 INSERT 到相关表来间接更新

---

## 2. 数据模型设计

### 2.1 contract_service_entitlements（学生服务权益表）

**表定义**（drizzle schema）> **版本：** v2.16.12 架构重构
```typescript
export const contractServiceEntitlements = pgTable(
  'contract_service_entitlements',
  {
    // 主键：学生ID + 服务类型（累积制）
    studentId: varchar('student_id', { length: 32 })
      .notNull()
      .references(() => users.id),
    serviceType: varchar('service_type', { length: 100 })
      .notNull()
      .references(() => serviceTypeEnum.serviceType),

    // 权益数量（触发器自动维护）
    totalQuantity: integer('total_quantity')
      .notNull()
      .default(0), // 总权益（初始 + 额外）
    consumedQuantity: integer('consumed_quantity')
      .notNull()
      .default(0), // 已消费
    heldQuantity: integer('held_quantity')
      .notNull()
      .default(0), // 预占
    availableQuantity: integer('available_quantity')
      .notNull()
      .default(0), // 可用 = total - consumed - held

    // 过期时间
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // 审计字段
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: varchar('created_by', { length: 32 })
      .references(() => users.id),
  },
  (table) => {
    // 复合主键：学生 + 服务类型（累积制）
    return {
      pk: primaryKey({
        columns: [table.studentId, table.serviceType],
        name: 'pk_contract_service_entitlements',
      }),
    };
  }
);
```

**约束定义**：
```sql
-- CHECK 约束：可用数量必须 >= 0
ALTER TABLE contract_service_entitlements
ADD CONSTRAINT chk_available_quantity_non_negative
CHECK (available_quantity >= 0);

-- CHECK 约束：余额一致性
ALTER TABLE contract_service_entitlements
ADD CONSTRAINT chk_balance_consistency
CHECK (available_quantity = total_quantity - consumed_quantity - held_quantity);

-- CHECK 约束：各数量字段非负
ALTER TABLE contract_service_entitlements
ADD CONSTRAINT chk_quantities_non_negative
CHECK (
  total_quantity >= 0 AND
  consumed_quantity >= 0 AND
  held_quantity >= 0
);

-- CHECK 约束：消费 + 预占不超过总量
ALTER TABLE contract_service_entitlements
ADD CONSTRAINT chk_consumed_plus_held_not_exceed_total
CHECK (consumed_quantity + held_quantity <= total_quantity);
```

**索引定义**：
```sql
-- 复合索引：按学生查询所有权益
CREATE INDEX idx_entitlements_by_student
ON contract_service_entitlements(student_id, service_type);

-- 复合索引：按学生 + 可用余额过滤
CREATE INDEX idx_entitlements_available_balance
ON contract_service_entitlements(student_id, service_type, available_quantity)
WHERE available_quantity > 0;

-- 索引：按服务类型统计
CREATE INDEX idx_entitlements_by_service_type
ON contract_service_entitlements(service_type, student_id);
```

**维护规则**：

| 字段 | 更新来源 | 触发器 | 说明 |
|------|----------|--------|------|
| totalQuantity | contract_amendment_ledgers.INSERT | ✅ 触发器 | ledger新增时累加 |
| consumedQuantity | service_ledgers.INSERT | ✅ 触发器 | 消费流水新增时累加 |
| heldQuantity | service_holds.INSERT/UPDATE | ✅ 触发器 | 预占状态变更时更新 |
| availableQuantity | 自动计算 | ✅ CHECK约束 | total - consumed - held |

**重要说明**：
- ❌ **应用层禁止直接 UPDATE 这些字段**
- ✅ 只能通过触发器间接更新
- ✅ 应用层可以 INSERT 新记录（初始化权益）

**初始权益初始化（D-NEW-2 决策）：** 创建合同时，应用层直接从 `product_snapshot` 解析权益并 INSERT 到本表：
```typescript
// 示例：创建合同1 - 初始权益
INSERT INTO contract_service_entitlements (student_id, service_type, total_quantity, consumed_quantity, held_quantity, available_quantity)
VALUES ('stu-001', 'session', 5, 0, 0, 5);

// 权益累积场景：学生已有同类型权益（来自其他合同）
// 应用层先查询记录是否存在，然后 UPDATE（批量处理）
UPDATE contract_service_entitlements
SET total_quantity = existing.total_quantity + 3,
    available_quantity = existing.available_quantity + 3
WHERE student_id = 'stu-001' AND service_type = 'session';

// 结果：total_quantity = 8, available_quantity = 8
```

**额外权益添加（触发器自动执行）：**
```typescript
// 应用层插入到 ledgers 表（D-NEW-1 决策）
INSERT INTO contract_amendment_ledgers (student_id, service_type, quantity_changed, ...)
VALUES ('stu-001', 'session', 2, ...);

// 触发器自动执行：UPDATE contract_service_entitlements SET total += 2, available += 2
// 结果：total_quantity = 10, available_quantity = 10
```

---

### 2.2 contract_amendment_ledgers（额外权益流水表）

**职责**：
- 仅记录"额外添加"的服务权益（addon/promotion/compensation）
- 合同初始权益不记录在此表
- Append-only 设计，不可修改

**表定义**（drizzle schema）
```typescript
// 额外权益类型枚举
export const entitlementLedgerTypeEnum = pgEnum('entitlement_ledger_type', [
  'addon',           // 促成签约
  'promotion',       // 促销活动
  'compensation',    // 补偿
]);

export const contractEntitlementLedgers = pgTable(
  'contract_amendment_ledgers',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // 关联学生（不关联合同，按学生累积）
    studentId: varchar('student_id', { length: 32 })
      .notNull()
      .references(() => users.id),

    // 服务类型
    serviceType: varchar('service_type', { length: 100 })
      .notNull()
      .references(() => serviceTypeEnum.serviceType),

    // 变更类型（仅允许额外添加）
    ledgerType: entitlementLedgerTypeEnum('ledger_type')
      .notNull(),

    // 变更数量（正数）
    quantityChanged: integer('quantity_changed')
      .notNull()
      .check(sql`quantity_changed > 0`),

    // 变更原因和说明
    reason: text('reason').notNull(),              // 原因（必填，审计）
    description: text('description'),              // 详细说明
    attachments: json('attachments').$type<string[]>(), // 附件URL数组

    // 操作人
    createdBy: varchar('created_by', { length: 32 })
      .notNull()
      .references(() => users.id),

    // 时间戳
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    // 快照信息（可选，包含 contract_id 用于审计）
    snapshot: json('snapshot').$type<{
      contractId?: string;
      contractNumber?: string;
      serviceSnapshot?: any;
      productSnapshot?: any;
    }>(),
  }
);
```

**约束定义**：
```sql
-- CHECK 约束：quantity_changed 必须为正数
ALTER TABLE contract_amendment_ledgers
ADD CONSTRAINT chk_quantity_changed_positive
CHECK (quantity_changed > 0);

-- CHECK 约束：reason 不能为空
ALTER TABLE contract_amendment_ledgers
ADD CONSTRAINT chk_reason_required
CHECK (reason IS NOT NULL AND length(reason) > 0);
```

**索引定义**：
```sql
-- 复合索引：按学生查询权益变更历史
CREATE INDEX idx_ledger_by_student
ON contract_amendment_ledgers(student_id, service_type, created_at DESC);

-- 复合索引：按类型查询（统计促销活动）
CREATE INDEX idx_ledger_by_type
ON contract_amendment_ledgers(ledger_type, student_id, created_at DESC);

-- 索引：按创建时间（支持时间范围查询）
CREATE INDEX idx_ledger_created_at
ON contract_amendment_ledgers(created_at DESC);

-- 复合索引：操作人审计（查询某人操作记录）
CREATE INDEX idx_ledger_by_created_by
ON contract_amendment_ledgers(created_by, created_at DESC);
```

**特性说明**：
- **Append-only**：仅允许 INSERT，不允许 UPDATE/DELETE
- **立即生效**：插入后触发器立即更新权益余额（无审批）
- **审计目的**：用于统计、报表、合规审计
- **记录内容**：仅记录额外添加的权益（addon/promotion/compensation）

**示例数据**：
```typescript
// 示例1：促销活动赠送-额外权益
{
  id: 'ledger-001',
  studentId: 'stu-001',
  serviceType: 'session',
  ledgerType: 'promotion',
  quantityChanged: 2,         // +2次
  reason: '双十一促销活动赠送',
  createdBy: 'counselor-001',
  createdAt: '2025-11-11T00:00:00Z',
  snapshot: {
    contractId: 'contract-123',
    contractNumber: 'CONTRACT-2025-11-00001',
    serviceSnapshot: { /* ... */ }
  }
}

// 触发器执行后：contract_service_entitlements.total_quantity += 2
```

---

### 2.3 service_holds（服务预占表）- 移除 contract 关联

**表定义**（drizzle schema）
```typescript
export const serviceHolds = pgTable('service_holds', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 关联学生（移除 contract_id，只关联学生）
  studentId: varchar('student_id', { length: 32 })
    .notNull()
    .references(() => users.id),

  // 服务类型
  serviceType: varchar('service_type', { length: 100 })
    .notNull()
    .references(() => serviceTypeEnum.serviceType),

  // 预占数量
  quantity: integer('quantity')
    .notNull()
    .default(1)
    .check(sql`quantity > 0`),

  // 状态管理
  status: holdStatusEnum('status')
    .notNull()
    .default('active'), // active/released/cancelled

  // 关联预约
  relatedBookingId: uuid('related_booking_id'),

  // 释放信息
  releasedAt: timestamp('released_at', { withTimezone: true }),
  releaseReason: varchar('release_reason', { length: 100 }), // 'completed' | 'cancelled' | 'admin_manual'

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: varchar('created_by', { length: 32 })
    .notNull()
    .references(() => users.id),
});
```

**约束定义**：
```sql
-- CHECK 约束：quantity 必须为正数
ALTER TABLE service_holds
ADD CONSTRAINT chk_hold_quantity_positive
CHECK (quantity > 0);

-- CHECK 约束：released 状态必须设置时间
ALTER TABLE service_holds
ADD CONSTRAINT chk_released_at_required
CHECK (
  (status != 'released') OR
  (released_at IS NOT NULL AND release_reason IS NOT NULL)
);
```

**索引定义**：
```sql
-- 复合索引：查询学生的活跃预占
CREATE INDEX idx_holds_by_student_active
ON service_holds(student_id, service_type, status)
WHERE status = 'active';

-- 索引：按预约查询
CREATE INDEX idx_holds_by_booking
ON service_holds(related_booking_id);
```

**状态流转**：
```
active → released（服务完成）
active → cancelled（用户取消）
```

**变更说明**：
- ❌ 移除了 `contract_id` 字段
- ✅ 仅通过 `student_id` 关联学生
- ✅ 触发器更新 `contract_service_entitlements.held_quantity`

---

### 2.4 service_ledgers（服务消费流水表）

**表定义**（drizzle schema）
```typescript
export const serviceLedgers = pgTable('service_ledgers', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 关联学生
  studentId: varchar('student_id', { length: 32 })
    .notNull()
    .references(() => users.id),

  // 关联权益记录（新增 contract_service_entitlement_id）
  contractServiceEntitlementId: uuid('contract_service_entitlement_id')
    .notNull()
    .references(() => contractServiceEntitlements.studentId), // 实际关联复合主键

  // 服务类型
  serviceType: varchar('service_type', { length: 100 })
    .notNull()
    .references(() => serviceTypeEnum.serviceType),

  // 数量变化（负数=消费，正数=退款/调整）
  quantity: integer('quantity')
    .notNull()
    .check(sql`quantity != 0`), // 不能为0

  // 流水类型
  type: serviceLedgerTypeEnum('type')
    .notNull(), // consumption/refund/adjustment

  // 来源
  source: serviceLedgerSourceEnum('source')
    .notNull(),

  // 余额快照（操作后的余额）
  balanceAfter: integer('balance_after')
    .notNull()
    .check(sql`balance_after >= 0`),

  // 关联记录
  relatedHoldId: uuid('related_hold_id')
    .references(() => serviceHolds.id),
  relatedBookingId: uuid('related_booking_id'),

  // 审计字段
  reason: text('reason'),                        // 调整原因（adjustment必填）
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: varchar('created_by', { length: 32 })
    .notNull()
    .references(() => users.id),

  // 元数据
  metadata: json('metadata').$type<{
    originalBalance?: number;
    operationIp?: string;
    device?: string;
  }>(),
});
```

**类型枚举**：
```typescript
// 流水类型
export const serviceLedgerTypeEnum = pgEnum('service_ledger_type', [
  'consumption',     // 服务消费（quantity < 0）
  'refund',         // 退款增加（quantity > 0）
  'adjustment',     // 手动调整（quantity 可正可负）
]);

// 流水来源
export const serviceLedgerSourceEnum = pgEnum('service_ledger_source', [
  'booking_completed',    // 预约完成
  'booking_cancelled',    // 预约取消
  'manual_adjustment',    // 手动调整
]);
```

**约束定义**：
```sql
-- CHECK 约束：balance_after 必须非负
ALTER TABLE service_ledgers
ADD CONSTRAINT chk_balance_after_non_negative
CHECK (balance_after >= 0);

-- CHECK 约束：quantity 不能为0
ALTER TABLE service_ledgers
ADD CONSTRAINT chk_quantity_not_zero
CHECK (quantity != 0);

-- CHECK 约束：类型与quantity符号校验
-- consumption → quantity < 0
ALTER TABLE service_ledgers
ADD CONSTRAINT chk_consumption_quantity_negative
CHECK (type != 'consumption' OR quantity < 0);

-- refund → quantity > 0
ALTER TABLE service_ledgers
ADD CONSTRAINT chk_refund_quantity_positive
CHECK (type != 'refund' OR quantity > 0);

-- adjustment → reason 必填
ALTER TABLE service_ledgers
ADD CONSTRAINT chk_adjustment_reason_required
CHECK (type != 'adjustment' OR (reason IS NOT NULL AND length(reason) > 0));
```

**索引定义**：
```sql
-- 复合索引：按学生 + 服务类型查询
CREATE INDEX idx_ledgers_by_student_service
ON service_ledgers(student_id, service_type, created_at DESC);

-- 复合索引：按权益记录查询所有流水
CREATE INDEX idx_ledgers_by_entitlement
ON service_ledgers(contract_service_entitlement_id, created_at DESC);

-- 复合索引：按服务类型统计
CREATE INDEX idx_ledgers_by_service_type
ON service_ledgers(service_type, student_id, created_at DESC);

-- 索引：按创建时间查询
CREATE INDEX idx_ledgers_created_at
ON service_ledgers(created_at DESC);
```

**重要变更**：
- ❌ 移除了 `contract_id` 字段
- ✅ 新增 `contract_service_entitlement_id` 字段
- ✅ 关联到 `contract_service_entitlements` 表（复合主键）
- ✅ 触发器更新 `contract_service_entitlements.consumed_quantity`

---

### 2.5 contracts（合同表）- 保持不变

**表定义**（drizzle schema）
```typescript
export const contracts = pgTable('contracts', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 关联方
  studentId: varchar('student_id', { length: 32 })
    .notNull()
    .references(() => users.id),
  counselorId: varchar('counselor_id', { length: 32 })
    .references(() => users.id),

  // 合同信息
  contractNumber: varchar('contract_number', { length: 100 })
    .notNull()
    .unique(),
  title: varchar('title', { length: 500 }),
  description: text('description'),

  // 产品快照（保留，用于初始化权益）
  productId: uuid('product_id').notNull(),
  productSnapshot: json('product_snapshot')
    .$type<IProductSnapshot>()
    .notNull(),

  // 财务信息
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 })
    .notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  currency: varchar('currency', { length: 3 })
    .notNull()
    .default('USD'),

  // 有效期
  validityDays: integer('validity_days'), // null = 永久有效
  signedAt: timestamp('signed_at', { withTimezone: true }),
  effectiveAt: timestamp('effective_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }), // null = 永久有效

  // 状态
  status: contractStatusEnum('status')
    .notNull()
    .default('draft'),

  // 暂停/终止信息
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  suspensionReason: text('suspension_reason'),
  suspensionCount: integer('suspension_count')
    .notNull()
    .default(0),
  terminatedAt: timestamp('terminated_at', { withTimezone: true }),
  terminationReason: text('termination_reason'),

  // 元数据
  metadata: json('metadata').$type<{
    pdfUrl?: string;
    attachments?: string[];
    terms?: Record<string, any>;
    pricingNote?: string; // 价格覆盖说明
    pricingOverrideApprovedBy?: string; // 价格覆盖批准人
  }>(),

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: varchar('created_by', { length: 32 })
    .references(() => users.id),
});
```

**关键说明**：
- ✅ 保留 `productSnapshot` 字段（v2.16.4 决策 #3）
- ✅ 初始化权益时从 `productSnapshot.items` 读取服务项
- ❌ **不创建触发器**（应用层通过代码初始化权益）
- ✅ 专注合同生命周期管理（状态流转、财务、有效期）

---

## 2.6 表关系图（新架构）

```
┌─────────────────┐
│     users       │  学生
└────────┬────────┘
         │ 1:N
         │
    ┌────▼──────────────────────────────┐
    │  contract_service_entitlements   │  ← 核心权益表（学生级累积）
    │  PK: (student_id, service_type) │
    └────┬──────────────────────────────┘
         │                                 ▲
         │ 1:N                             │ 1:N
         │                                 │
    ┌────▼──────────────┐      ┌──────────▼──────────────┐
    │ service_holds     │      │ service_ledgers         │
    │ (预约预占)         │      │ (消费流水)              │
    │                   │      │                         │
    │ - student_id      │      │ - student_id            │
    │ - service_type    │      │ - service_type          │
    │ - quantity        │      │ - quantity              │
    │ - status          │      │ - balance_after         │
    └───────────────────┘      └─────────────────────────┘
         │                              │
         │                              │ 1:N
         │                              │
         └────────────┬─────────────────┘
                      │
                      │ 1:N
                      │
            ┌─────────▼──────────────────┐
            │  contract_amendment_ledgers│  ← 额外权益流水（只记录 addon）
            │  Append-only                 │
            │                            │
            │ - student_id               │
            │ - service_type             │
            │ - ledger_type              │
            │ - quantity_changed         │
            │ - reason                   │
            └────────────────────────────┘

┌─────────────────┐
│   contracts     │  合同生命周期管理（保持原结构）
└────────┬────────┘
         │ 1:N
         │
    ┌────▼─────────────────┐
    │  service_ledgers     │  消费流水关联（通过 entitlement_id）
    └──────────────────────┘
```

**关键关联**：
1. **查询关联**：通过 `student_id + service_type` 关联
2. **触发器关联**：
   - `contract_amendment_ledgers.INSERT` → 更新 `contract_service_entitlements.total_quantity`
   - `service_ledgers.INSERT` → 更新 `contract_service_entitlements.consumed_quantity`
   - `service_holds.INSERT/UPDATE` → 更新 `contract_service_entitlements.held_quantity`
3. **引用完整性**：不强制外键约束（复合主键），通过代码保证

---

## 3. 触发器机制

> **版本：** v2.16.12 架构重构
> **触发器数量：** 3个核心触发器
> **触发器位置：** 数据库层面（PostgreSQL functions）

### 3.1 触发器机制概述

**设计目标**：
- ✅ 数据库层面保证数据一致性
- ✅ 应用层无需手动同步权益数量
- ✅ 原子性操作（触发器在事务内执行）
- ✅ 性能优化（避免应用层多次数据库访问）

### 3.2 触发器 1：contract_amendment_ledgers → contract_service_entitlements

**触发时机**：`contract_amendment_ledgers` 表 INSERT 操作后

**功能**：将额外添加的权益自动累加到学生总权益

#### SQL 函数定义

⚠️ **v2.16.12 更新 (D-NEW-1 决策)**：移除 INSERT 分支，仅执行 UPDATE

```sql
-- ============================================================================
-- 函数：sync_ledger_to_entitlement()
-- 描述：contract_amendment_ledgers 新增时，自动累加 total_quantity
-- 触发时机：AFTER INSERT
-- 影响表：contract_service_entitlements
-- 版本：v2.16.12
-- 决策：仅执行 UPDATE，记录不存在时抛异常（D-NEW-1 方案A）
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_ledger_to_entitlement()
RETURNS TRIGGER AS $$
BEGIN
  -- 仅处理 INSERT 操作
  IF TG_OP = 'INSERT' THEN
    -- ⚠️ D-NEW-1 决策：只执行 UPDATE，不执行 INSERT
    -- 如果记录不存在，抛异常（确保初始权益已存在）
    UPDATE contract_service_entitlements AS cse
    SET
      total_quantity = cse.total_quantity + NEW.quantity_changed,
      available_quantity = cse.total_quantity + NEW.quantity_changed
                         - cse.consumed_quantity
                         - cse.held_quantity,
      updated_at = NOW()
    WHERE cse.student_id = NEW.student_id
      AND cse.service_type = NEW.service_type;

    -- 验证更新成功（记录必须存在）
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Entitlement not found for student_id=%, service_type=%. '
                      'Initial entitlement must be created before adding ledger entries.',
        NEW.student_id, NEW.service_type;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 触发器绑定
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_ledger_insert ON contract_amendment_ledgers;

CREATE TRIGGER trigger_ledger_insert
  AFTER INSERT
  ON contract_amendment_ledgers
  FOR EACH ROW
  EXECUTE FUNCTION sync_ledger_to_entitlement();
```

**重要变更说明（D-NEW-1 决策）：**
- ❌ 移除 INSERT 分支（不再创建新记录）
- ✅ 仅执行 UPDATE（累加 total_quantity）
- ✅ 如果记录不存在，抛异常并提示"必须先创建初始权益"
- ✅ 强制业务规则：先初始化 → 后累加额外权益

#### 图解

```
contract_amendment_ledgers.INSERT (quantity_changed = +2)
    ↓
触发器自动执行
    ↓
IF (student_id, service_type) 存在 THEN
  UPDATE contract_service_entitlements
  SET
    total_quantity = total_quantity + 2,
    available_quantity = (total_quantity + 2) - consumed - held
ELSE
  INSERT new record (
    total_quantity = 2,
    available_quantity = 2
  )
```

#### 示例

```typescript
// 场景：学生 stu-001 获得 2 次额外 session
┌─────────────────────────────────────────┐
│ INSERT INTO contract_amendment_ledgers│
├─────────────────────────────────────────┤
│ student_id      = 'stu-001'             │
│ service_type    = 'session'             │
│ ledger_type     = 'promotion'           │
│ quantity_changed = 2                    │
│ reason          = '双十一活动'          │
└─────────────────────────────────────────┘
                      ↓
              触发器自动执行
                      ↓
┌─────────────────────────────────────────┐
│ UPDATE contract_service_entitlements    │
├─────────────────────────────────────────┤
│ SET                                     │
│   total_quantity += 2,                  │
│   available_quantity += 2               │
│ WHERE                                   │
│   student_id = 'stu-001'                │
│   service_type = 'session'              │
└─────────────────────────────────────────┘
```

---

### 3.3 触发器 2：service_ledgers → contract_service_entitlements

**触发时机**：`service_ledgers` 表 INSERT 操作后

**功能**：服务消费时自动累加已消费数量

#### SQL 函数定义

```sql
-- ============================================================================
-- 函数：sync_consumption_to_entitlement()
-- 描述：service_ledgers 新增时，自动累加 consumed_quantity
-- 触发时机：AFTER INSERT
-- 影响表：contract_service_entitlements
-- 版本：v2.16.12
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_consumption_to_entitlement()
RETURNS TRIGGER AS $$
BEGIN
  -- 仅处理 INSERT 操作
  IF TG_OP = 'INSERT' THEN
    UPDATE contract_service_entitlements
    SET
      -- quantity 为负数（消费），取反后累加
      consumed_quantity = consumed_quantity + (-NEW.quantity),

      -- 重新计算可用余额
      -- available = total - (consumed + NEW.quantity) - held
      available_quantity = total_quantity
                         - (consumed_quantity + (-NEW.quantity))
                         - held_quantity,

      updated_at = NOW()
    WHERE student_id = NEW.student_id
      AND service_type = NEW.service_type;

    -- 验证更新成功
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Entitlement not found for student_id=%, service_type=%',
        NEW.student_id, NEW.service_type;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 触发器绑定
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_service_ledger_insert ON service_ledgers;

CREATE TRIGGER trigger_service_ledger_insert
  AFTER INSERT
  ON service_ledgers
  FOR EACH ROW
  EXECUTE FUNCTION sync_consumption_to_entitlement();
```

#### 图解

```
service_ledgers.INSERT (quantity = -1, 表示消费1次)
    ↓
触发器自动执行
    ↓
UPDATE contract_service_entitlements
SET
  consumed_quantity = consumed_quantity + 1,
  available_quantity = total - (consumed + 1) - held
```

---

### 3.4 触发器 3：service_holds → contract_service_entitlements

**触发时机**：`service_holds` 表 INSERT 和 UPDATE 操作后

**功能**：服务预占创建和释放时自动更新预占数量

#### SQL 函数定义

```sql
-- ============================================================================
-- 函数：sync_hold_to_entitlement()
-- 描述：service_holds 状态变更时，自动更新 held_quantity
-- 触发时机：AFTER INSERT OR UPDATE
-- 影响表：contract_service_entitlements
-- 版本：v2.16.12
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_hold_to_entitlement()
RETURNS TRIGGER AS $$
BEGIN
  -- 场景 1：创建新预占 (INSERT 且 status = 'active')
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE contract_service_entitlements
    SET
      held_quantity = held_quantity + NEW.quantity,

      -- 可用余额减少
      available_quantity = total_quantity
                         - consumed_quantity
                         - (held_quantity + NEW.quantity),

      updated_at = NOW()
    WHERE student_id = NEW.student_id
      AND service_type = NEW.service_type;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Entitlement not found for student_id=%, service_type=%',
        NEW.student_id, NEW.service_type;
    END IF;

    RETURN NEW;
  END IF;

  -- 场景 2：释放预占 (UPDATE 且 status 从 'active' 变为其他)
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'active'
     AND NEW.status != 'active' THEN

    UPDATE contract_service_entitlements
    SET
      held_quantity = held_quantity - OLD.quantity,

      -- 可用余额增加
      available_quantity = total_quantity
                         - consumed_quantity
                         - (held_quantity - OLD.quantity),

      updated_at = NOW()
    WHERE student_id = OLD.student_id
      AND service_type = OLD.service_type;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Entitlement not found for student_id=%, service_type=%',
        OLD.student_id, OLD.service_type;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 触发器绑定
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_hold_change ON service_holds;

CREATE TRIGGER trigger_hold_change
  AFTER INSERT OR UPDATE
  ON service_holds
  FOR EACH ROW
  EXECUTE FUNCTION sync_hold_to_entitlement();
```

#### 图解

```
场景 A：创建预占 (INSERT, status='active')
=====================================
service_holds.INSERT (quantity = 1, status = 'active')
    ↓
触发器自动执行
    ↓
UPDATE contract_service_entitlements
SET
  held_quantity = held_quantity + 1,
  available_quantity = total - consumed - (held + 1)


场景 B：释放预占 (UPDATE, status='active' → 'released')
====================================================
service_holds.UPDATE (status changed)
    ↓
触发器自动执行
    ↓
UPDATE contract_service_entitlements
SET
  held_quantity = held_quantity - 1,
  available_quantity = total - consumed - (held - 1)
```

---

### 3.5 触发器执行流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                    触发器执行流程总览                            │
└─────────────────────────────────────────────────────────────────┘

                          ┌────────────────────┐
                          │  应用层业务操作     │
                          └──────────┬─────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
┌────────────────────┐  ┌───────────────────┐  ┌──────────────────┐
│ 额外权益添加        │  │ 服务消费           │  │ 服务预占/释放     │
│ (addon/promotion)  │  │ (consumption)     │  │ (hold/release)  │
└──────────┬─────────┘  └─────────┬─────────┘  └─────────┬────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌────────────────────┐  ┌───────────────────┐  ┌──────────────────┐
│ INSERT INTO        │  │ INSERT INTO       │  │ INSERT/UPDATE    │
│ contract_entitle.. │  │ service_ledgers   │  │ service_holds    │
└──────────┬─────────┘  └─────────┬─────────┘  └─────────┬────────┘
           │                      │                      │
           └──────────────────────┼──────────────────────┘
                                  │
           ┌──────────────────────▼──────────────────────┐
           │   触发器自动执行（同一事务内）               │
           └──────────────────────┬──────────────────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
            ▼                     ▼                     ▼
┌────────────────────┐  ┌───────────────────┐  ┌──────────────────┐
│ UPDATE total_      │  │ UPDATE consumed_  │  │ UPDATE held_     │
│ quantity +=        │  │  quantity +=      │  │ quantity +=/-    │
└────────────────────┘  └───────────────────┘  └──────────────────┘
            │                     │                     │
            └─────────────────────┼─────────────────────┘
                                  │
            ┌─────────────────────▼─────────────────────┐
            │  contract_service_entitlements 自动更新    │
            │                                           │
            │  - total_quantity（累计增加）            │
            │  - consumed_quantity（消费累加）         │
            │  - held_quantity（预占变更）             │
            │  - available_quantity（自动计算）        │
            └───────────────────────────────────────────┘
```

**重要特性**：
- 触发器在 **同一数据库事务** 内执行
- 应用层插入记录后，触发器立即执行
- 如果触发器失败（如违反CHECK约束），整个事务回滚
- 确保数据强一致性

> **审查日期：** 2025-11-11
> **审查版本：** v2.16.10
> **状态：** ✅ 所有差异已决策（7 项）

| 编号 | 问题 | 决策结果 | 优先级 | 实施状态 |
|------|------|----------|--------|----------|
| **D1** | 合同状态差异 | ✅ **方案A**：增加 `draft` 状态（draft → signed → active） | 🔴 高 | 待实施 |
| **D2** | 合同状态管理方法缺失 | ✅ **方案A**：实现 `suspend()`, `resume()`, `complete()` | 🔴 高 | 待实施 |
| **D3** | 权益修改表名 | ✅ **方案B**：表名为 `contract_amendment_ledgers` | 🟡 中 | 文档已更新 |
| **D4** | DTO字段命名 | ✅ **方案B**：采用代码字段名（reason, sessionId 等） | 🟡 中 | 文档已更新 |
| **D5** | 事件监听器缺失 | ✅ **方案A**：实现 `payment.succeeded`, `session.completed` 监听器 | 🔴 高 | 待实施 |
| **D6** | 事务支持 | ✅ **方案B**：保持现状 | 🟢 低 | 无需实施 |
| **D7** | 状态验证 | ✅ **方案B**：保持现状 | 🟢 低 | 无需实施 |

> **详细决策记录**：参见 [Section 9: 差异分析](#9-设计文档与代码实现差异分析)

### 实施优先级

**🔴 高优先级（必须修复）：** D1, D2, D5

**🟡 中优先级（建议实施）：** D6（保持现状）

**🟢 低优先级（无需代码变更）：** D3, D4, D7（文档已更新）

### 关键实施要点

#### 1. 数据库类型定义
```typescript
// src/shared/types/database.types.ts
export type DrizzleDatabase = NodePgDatabase<typeof schema>;
export type DrizzleTransaction = PgTransaction<typeof schema, any, Record<string, never>>;
export type DrizzleExecutor = DrizzleDatabase | DrizzleTransaction;
```

#### 2. SQL 脚本文件结构
- `contract_number_generator.sql` - 合同编号生成函数
- `contract_triggers.sql` - 触发器（自动同步数量）
- `contract_indexes.sql` - 索引（性能优化）
- `contract_constraints.sql` - CHECK 约束（数据完整性）

#### 3. Event Publisher 配置
- 轮询频率：30 秒
- 重试次数：5 次
- 批量大小：100 条
- 使用 Advisory Lock 防止多实例冲突

---

## 0. 核心设计约束

> **审查完成日期：** 2025-11-06
> **当前版本：** v2.16.7
> **状态：** ✅ 设计完成，所有待决策问题已解决（共 15 个：4 关键 + 6 重要 + 5 次要）

本章节总结实施时必须遵守的核心设计约束和关键决策。

---

### 0.1 架构约束

#### DDD 防腐层原则
- ✅ Contract Domain 不直接导入 Catalog Domain 的 Schema
- ✅ 通过 ProductSnapshot 快照机制实现域隔离
- ✅ `productId` 仅作为 UUID 引用，不建立外键

#### 服务接口完整性
- ✅ ContractService 必须包含：`create()`, `activate()`, `suspend()`, `resume()`, `complete()`, `terminate()`
- ✅ `consumeService()` 使用 `ConsumeServiceDto` 参数（包含审计字段）
- ✅ `getServiceBalance()` 支持多种查询条件（contractId / studentId / serviceType）

---

### 0.2 数据模型约束

#### 服务单位统一
- ✅ **单位设计**：所有服务统一按次数计费（v2.16.7：移除 unit 字段和 ServiceUnit 枚举）
- ✅ 时长/周期信息在服务定义中说明，不影响计费逻辑

#### 唯一约束与合并逻辑
- ✅ **contract_service_entitlements 唯一约束**：`(contract_id, service_type, expires_at, source)`
- ✅ 相同服务类型权益按上述键合并，`originItems` 数组保留所有来源追溯

#### 合同编号生成
- ✅ **格式**：`CONTRACT-YYYY-MM-NNNNN`（月度序列）
- ✅ 使用 PostgreSQL Sequence + Advisory Lock 保证并发安全
- ✅ 每月自动重置，达到 99999 上限抛异常

#### Schema 类型一致性
- ✅ `originItems.productItemType` 使用 `ProductItemType` 类型别名
- ✅ 不使用字符串字面量，保持类型统一

---

### 0.3 业务规则约束

#### 权益过期处理
- ✅ **权益过期时间**：统一继承合同 `expiresAt`，不支持服务级别独立过期
- ✅ **查询时过滤**：所有查询活跃合同/权益时，动态过滤 `expiresAt`（无需定时任务）
- ✅ **消费验证**：消费服务时验证合同和权益未过期

#### 服务消费优先级
- ✅ **优先级顺序**：product > addon > promotion > compensation
- ✅ **同优先级排序**：按 `createdAt ASC`（先创建的先消费）
- ✅ **扣减策略**：逐条扣减，直到满足消费数量

#### 价格覆盖验证
- ✅ **免费合同（$0）**：必须提供 `overrideApprovedBy`（超级管理员 ID）
- ✅ **价格覆盖**：必须记录 `metadata.pricingNote`（原因说明）
- ✅ **价格范围**：$0 - 产品价格 × 200%，最大折扣 90%

#### 归档查询保护
- ✅ **强制验证**：`includeArchive=true` 必须提供 `dateRange` 参数
- ✅ **异常处理**：未提供抛出 `ARCHIVE_QUERY_REQUIRES_DATE_RANGE` 异常

---

### 0.4 并发与性能约束

#### 并发控制
- ✅ **consumeService()**：使用 `SELECT ... FOR UPDATE` 悲观锁 + 数据库事务
- ✅ **合同编号生成**：PostgreSQL Advisory Lock 防止重复
- ✅ **权益合并**：`ON CONFLICT DO UPDATE` 处理并发插入

#### 数据完整性
- ✅ **availableQuantity 同步**：使用数据库触发器自动计算
- ✅ **Append-only 流水**：service_ledgers 只增不改，调整通过新记录
- ✅ **事务原子性**：所有写操作使用数据库事务包裹

#### 性能优化
- ✅ **复合索引**：5 个关键索引覆盖所有查询场景（预期性能提升 40-95%）
- ✅ **预占批量清理**：批量 UPDATE + 触发器（性能提升 40 倍）
- ✅ **查询优化**：提供 Helper Functions 简化常见查询

---

### 0.5 事件与集成约束

#### 事件发布机制
- ✅ **Outbox 模式**：在同一事务中将事件写入 `domain_events` 表
- ✅ **异步发布器**：独立进程定期轮询并发布事件
- ✅ **重试机制**：指数退避 + 死信队列

#### 事件载荷定义
- ✅ 所有事件包含：`eventType`, `aggregateId`, `occurredAt`, `payload`
- ✅ 已定义 6 种事件载荷：contract.signed, activated, completed, terminated, suspended, resumed

---

### 0.6 实施简化约束

#### MVP 范围
- ✅ **单一币种**：仅支持 USD
- ✅ **无分区表**：MVP 依赖索引优化，后续根据数据量决定
- ✅ **权限控制**：推迟到实施阶段（后续使用 `@Roles()` 装饰器）
- ✅ **余额对账**：推迟到实施阶段（MVP 依赖触发器保证一致性）

---

### 0.7 命名与约定

#### 命名规范
- ✅ **数据库列名**：snake_case（service_type, created_at）
- ✅ **TypeScript/DTO**：camelCase（serviceType, createdAt）
- ✅ **枚举类型**：PascalCase（ServiceType, ContractStatus）
- ✅ Drizzle ORM 自动处理转换

#### 错误码定义
- ✅ 使用枚举：`ContractErrorCode`
- ✅ 异常类：`ContractException`（包含 errorCode, message, statusCode）

---

## 📝 版本更新日志

### v2.16.10 (2025-11-11)

**权益审计机制重大简化**

v2.16.10 简化 `contract_amendment_ledgers` 表，从"版本管理系统"改为"审计日志系统"。

**核心变更：**

1. **移除审批流程**
   - 所有权益变更立即生效，无需管理员审批
   - 移除 `status`, `requiresApproval`, `approvedBy`, `approvedAt` 字段
   - 移除 `approveRevision()`, `rejectRevision()` 方法

2. **简化版本管理**
   - 移除 `revisionNumber` 字段，按 `createdAt` 排序
   - 从 21 个字段减少到 15 个字段（精简 28.6%）
   - 从 9 个索引减少到 5 个索引（精简 44.4%）

3. **DTO字段对齐**
   - `addOnReason` → `reason`（与代码实现一致）

**近期演进：**
- **v2.16.9**：移除服务预占TTL机制，预占永不过期
- **v2.16.7**：统一按次数计费，移除 unit 字段
- **v2.16.6**：ServiceUnit 简化为单一值 'times'

---

## 1. 领域概述

### 1.1 核心职责 / Core Responsibilities

合同域是 MentorX 平台核心业务域，负责管理教育咨询服务的合同生命周期和服务权益管理。

**核心职责：**

- **合同生命周期管理** - 管理合同的全生命周期（创建、激活、终止、暂停）
- **服务权益余额管理** - 管理合同服务权益余额和变更
- **服务消费追踪** - 追踪服务消费流水（Service Ledger - Append-only）
- **服务预占机制** - 管理服务预占防止超额预约
- **额外权益支持** - 支持促成签约、促销、补偿的服务增加
- **查询与验证** - 提供服务余额查询和验证
- **流水归档** - 支持历史流水归档和冷热分离
- **事件发布** - 发布合同相关业务事件

**不负责职责：**
- **产品定义** - 目录域负责产品配置
- **支付处理** - 财务域负责支付流程
- **服务预约** - 服务域负责预约管理
- **导师计费** - 财务域处理费用结算
- **财务结算** - 财务域负责最终结算
- **导师权益** - 不负责处理任何与导师权益相关的业务逻辑，包括但不限于导师权益的定义、计算、调整及分配机制
- **交易记录** - 不管理、存储或维护任何形式的交易记录，包括但不限于交易流水、支付记录、结算记录等财务相关数据

### 1.2 领域特性 / Domain Characteristics

**核心业务域特性：**

- **事件驱动** - 发布和监听业务事件，驱动跨域协作
- **状态管理** - 合同状态机流转（draft → active → completed/terminated）
- **Append-only 流水** - 服务流水只能追加，不可修改，保证审计完整性
- **服务预占机制** - 防止超额预约，需人工释放（v2.16.9：移除自动过期）
- **冷热分离** - 历史流水归档，保持查询性能
- **合同-产品一对一绑定** - 每个合同仅关联一个产品，产品信息通过快照固化

**核心业务约束（v2.16.6）：**

- **合同与产品的一对一关系** - 每个合同仅能绑定一个产品，产品信息在合同创建时固化，合同创建后不可更换产品（保证合同的确定性和审计追溯性）

- **服务单位统一为次数** - 所有服务权益的单位（`unit`）统一为 `'times'`（次数），不支持其他单位（如 hours, days, sessions），原因：简化计费模型，避免单位转换复杂度

**v2.16 新增特性：**
- **额外权益添加** - 支持促成签约、促销活动、补偿等场景的服务增加
- **权益来源追溯** - 区分产品标准权益 vs 额外添加权益
- **灵活权益管理** - 同一服务类型可多次添加额外权益

### 1.3 跨域协作 / Cross-Domain Collaboration

**协作模式：事件驱动 + 服务调用**

**协作关系：**
- **Catalog Domain → Contract Domain**：创建合同时查询产品（通过快照机制单向依赖）
- **Financial Domain → Contract Domain**：通过事件驱动（`payment.succeeded` 激活合同，发布 `contract.activated`）
- **Services Domain → Contract Domain**：通过事件驱动（`session.completed` 消费记录，发布 `service.consumed`）
- **Financial Domain 不查询 Contract Domain**（决策 #9）- 保持域独立性，避免循环依赖

**关键协作原则：**
- 业务数据通过事件传递，而非服务调用查询
- 保持单向依赖，避免循环引用
- 事件驱动保证业务解耦和最终一致性

### 1.4 产品快照机制 / Product Snapshot Mechanism

**快照机制（Snapshot Mechanism）概述：**

合同域通过产品快照机制，在合同创建时捕获产品信息的历史状态，避免产品目录变更影响已创建合同。

**核心特性：**

- **历史锁定**：合同创建时锁定产品信息和价格，后续产品变更不影响已创建合同
- **完全展开**：service_package 递归展开为具体services，无需二次查询
- **批量优化**：内部使用批量查询避免N+1性能问题
- **数据完整**：包含价格、有效期、服务类型等所有必要字段
- **单向依赖**：Catalog Domain → Contract Domain 通过快照机制实现松耦合

**快照数据流结构：**

```
ProductService.generateSnapshot(productId)
  → IProductSnapshot (完整产品快照)
    ├─ 产品基本信息：productId, productName, price, currency, validityDays
    ├─ 产品项目（完全展开）：items[]
    │  ├─ 直接服务项（type='service'）
    │  └─ 服务包项（type='service_package'）→ 递归展开为services
    └─ 快照时间：snapshotAt

Contract Domain → 解构快照数据 → contracts + contract_service_entitlements
```

**快照核心价值：**
- 保证历史合同数据一致性和可追溯性
- 支持产品演进优化，不影响现有合同
- 简化计费逻辑，避免复杂时间点判断
- 通过反腐败层实现域间解耦

**快照关键数据结构（简版）：**

```typescript
IProductSnapshot = {
  // 产品基本信息
  productId, productName, price, currency, validityDays?: number,
  // 产品项目（完全展开）
  items: IProductSnapshotItem[],
  snapshotAt: Date
}

IProductSnapshotItem = {
  type: 'service' | 'service_package',
  quantity: number,  // 所有服务统一按次数计费
  sortOrder: number,
  serviceSnapshot?: IServiceSnapshot,     // 直接服务
  servicePackageSnapshot?: {             // 服务包（已展开）
    packageId, packageName,
    items: IServicePackageSnapshotItem[]  // 内层具体服务列表
  }
}

IServiceSnapshot = {
  serviceId, serviceName, serviceCode,
  serviceType,  // 🔑 用于创建 contract_service_entitlements
  snapshotAt: Date
}
```

**映射关系（合同表字段来源）：**

| Contract Domain 表/字段 | 来源字段 | 说明 |
|------------------------|---------|------|
| `contracts` 表：|
| `productId` | `productSnapshot.productId` | 产品引用（非外键） |
| `totalAmount` | `productSnapshot.price` | 合同总额（快照锁定） |
| `currency` | `productSnapshot.currency` | 币种 |
| `validityDays` | `productSnapshot.validityDays` | 有效期 |
| `contract_service_entitlements` 表：|
| `serviceType` | `serviceSnapshot.serviceType` | 服务类型 |
| `totalQuantity` | 展开计算：item.quantity × package内数量 | 数量（次数计费） |
| `serviceSnapshot` | 构造快照对象 | 服务快照信息 |
**合同时序数据流：**

```
Catalog(获取产品快照) → Contract(解构快照) → 存储权益
```

**快照核心价值：**
- 保证历史合同数据一致性和可追溯性
- 支持产品演进优化，不影响现有合同
- 简化计费逻辑，避免复杂时间点判断
- 通过反腐败层实现域间解耦

---

## 2. 核心概念与架构

### 2.1 核心概念

#### 2.1.1 Contract（合同）

**定义：** 合同是学生与平台签订的服务购买协议，基于产品（Product）创建，包含服务权益和财务信息。

**特点：**

- **基于产品创建**：合同引用 Catalog Domain 的产品
- **签约时不确定导师**：导师在预约服务时才确定
- **包含财务信息**：总额、已付金额、币种、有效期
- **状态流转**：draft → active → completed/terminated/suspended

**合同状态（Contract Status）：**

```typescript
enum ContractStatus {
  DRAFT = 'draft',           // 草稿（未支付）
  ACTIVE = 'active',         // 生效中（已支付首付，服务可用）
  COMPLETED = 'completed',   // 已完成（服务已消费完毕或过期）
  TERMINATED = 'terminated', // 已终止（提前终止合同）
  SUSPENDED = 'suspended',   // 已暂停（临时暂停服务）
}
```

**关键字段：**

- `productId`: 引用的产品ID（来自 Catalog Domain）
- `totalAmount`: 合同总额（美元）
- `paidAmount`: 已支付金额（美元）
- `validityDays`: 服务有效期（天）
- `expiresAt`: 过期时间（计算：signedAt + validityDays）

#### 2.1.2 Contract Service Entitlement（合同服务权益）

**定义：** 服务权益是合同中包含的各类服务的数量和使用情况记录。

**特点：**

- **按服务类型管理**：每种服务类型独立管理余额
- **三种余额状态**：总量（total）、已消费（consumed）、预占中（held）
- **可用余额计算**：available = total - consumed - held
- **v2.16 新增**：区分权益来源（产品标准 vs 额外添加）

**权益来源（Entitlement Source）：**

```typescript
enum EntitlementSource {
  PRODUCT = 'product',           // 来自产品定义（标准权益）
  ADDON = 'addon',              // 额外添加（促成签约）
  PROMOTION = 'promotion',      // 促销活动赠送
  COMPENSATION = 'compensation', // 补偿（服务质量问题、系统故障等）
}
```

**余额管理公式：**

```
availableQuantity = totalQuantity - consumedQuantity - heldQuantity

- totalQuantity: 购买总量
- consumedQuantity: 已消费（服务完成）
- heldQuantity: 预留中（已预约未完成）
- availableQuantity: 可用（可以预约）
```

**示例：**

```
学生购买产品：包含 5 次简历修改

初始状态：
- totalQuantity = 5
- consumedQuantity = 0
- heldQuantity = 0
- availableQuantity = 5

预约服务后：
- totalQuantity = 5
- consumedQuantity = 0
- heldQuantity = 1  （预占1次）
- availableQuantity = 4

服务完成后：
- totalQuantity = 5
- consumedQuantity = 1  （完成1次）
- heldQuantity = 0  （释放预占）
- availableQuantity = 4
```

#### 2.1.3 Service Ledger（服务流水）

**定义：** 服务流水是学生服务消费和调整的完整追踪记录，采用 Append-only 模式。

**核心设计原则：**

1. **Append-only**：只能 INSERT，禁止 UPDATE/DELETE
2. **正负数记账**：quantity 可正可负，但 balanceAfter 必须 >= 0
3. **余额快照**：每次操作记录 balanceAfter，便于对账审计
4. **冷热分离**：定期归档历史数据到 service_ledgers_archive

**流水类型（Service Ledger Type）：**

```typescript
enum ServiceLedgerType {
  CONSUMPTION = 'consumption',   // 服务消费（quantity < 0）
  REFUND = 'refund',            // 退款增加（quantity > 0）
  ADJUSTMENT = 'adjustment',    // 手动调整（quantity 可正可负）
  INITIAL = 'initial',          // 初始化（quantity > 0）
  EXPIRATION = 'expiration',    // 过期扣减（quantity < 0）
}
```

**流水来源（Service Ledger Source）：**

```typescript
enum ServiceLedgerSource {
  BOOKING_COMPLETED = 'booking_completed',    // 预约完成
  BOOKING_CANCELLED = 'booking_cancelled',    // 预约取消
  MANUAL_ADJUSTMENT = 'manual_adjustment',    // 手动调整
}
```

**关键字段：**

- `quantity`: 数量变化（负数=消费，正数=增加）
- `balanceAfter`: 操作后余额（快照，用于对账）
- `type`: 流水类型
- `source`: 流水来源
- `reason`: 调整原因（manual_adjustment 时必填）

#### 2.1.4 Service Hold（服务预占）

**定义：** 服务预占是防止超额预约的临时锁，需人工操作释放（v2.16.9：移除TTL过期机制）。

**特点：**

- **手动释放**：必须通过 releaseHold() 或 cancelHold() 释放（v2.16.9）
- **永不过期**：无自动过期机制，减少系统复杂度
- **状态管理**：active（生效中）、released（已释放）、cancelled（已取消）
- **粒度控制**：按服务类型预占，不涉及具体导师时间段

**预占状态（Hold Status）：**

```typescript
enum HoldStatus {
  ACTIVE = 'active',       // 生效中（未释放）
  RELEASED = 'released',   // 已释放（服务完成或管理员手动释放）
  CANCELLED = 'cancelled', // 已取消（用户取消预约）
}
```

**预占流程（v2.16.9）：**

```
1. 学生选择服务 → 检查可用余额
2. 创建预占记录 → heldQuantity += 1, availableQuantity -= 1（永不过期）
3. 服务确认 → 释放预占 → 生成消费流水
4. 或用户取消 → 取消预占 → 释放权益

注：v2.16.9 移除了 TTL 机制，预占不会自动过期
```

### 2.2 架构设计

#### 2.2.1 核心模块架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Contract Domain 架构                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Contract Management（合同管理层）                  │
│  - ContractService: 合同CRUD、状态流转                       │
│  - ContractEntitlementService: 权益管理                      │
│  - 发布事件：contract.signed, contract.activated            │
└─────────────────────────────────────────────────────────────┘
                              ↓ 管理
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Service Ledger（服务流水层）                       │
│  - ServiceLedgerService: 流水记录（Append-only）             │
│  - ServiceLedgerArchiveService: 归档管理                     │
│  - 提供余额对账和审计功能                                     │
└─────────────────────────────────────────────────────────────┘
                              ↓ 支撑
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Service Hold（服务预占层）                         │
│  - ServiceHoldService: 预占管理（TTL机制）                   │
│  - 定时任务清理过期预占                                       │
│  - 计算可用余额（总余额 - 活跃预占）                          │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2.2 数据流向

```
┌──────────────┐
│ 顾问/学生     │
└──────┬───────┘
       │ 1. 创建合同（基于产品）
       ▼
┌──────────────────┐
│ Contract         │  ──────┐ 发布 contract.signed
│ (draft)          │        │
└──────┬───────────┘        │
       │ 2. 监听 payment.succeeded    │
       ▼                              ▼
┌──────────────────┐          ┌─────────────┐
│ Contract         │          │ Event Bus   │
│ (active)         │          └─────────────┘
└──────┬───────────┘
       │ 3. 初始化服务权益
       ▼
┌────────────────────────┐
│ ContractServiceEntitlement │
│ - resume_review: 3 次    │
│ - session: 5 次          │
└──────┬─────────────────┘
       │ 4. 学生预约服务
       ▼
┌────────────────────────┐
│ ServiceHold            │
│ - quantity: 1          │
│ - expiresAt: +15min    │
└──────┬─────────────────┘
       │ 5. 服务完成（监听 session.completed）
       ▼
┌────────────────────────┐
│ ServiceLedger          │
│ - quantity: -1         │
│ - balanceAfter: 2      │
└────────────────────────┘
```

#### 2.2.3 服务权益生命周期

```
签约阶段：
  ┌───────────────────────────────────────────────────┐
  │ 1. 从 Product 派生标准权益                         │
  │    - 查询 product_items                           │
  │    - 展开 service_packages                        │
  │    - 创建 contract_service_entitlements          │
  │    - source = 'product'                          │
  └───────────────────────────────────────────────────┘
                     ↓
  ┌───────────────────────────────────────────────────┐
  │ 2. 可选：添加额外权益                              │
  │    - 促成签约：额外赠送服务                        │
  │    - 促销活动：限时赠送                            │
  │    - 补偿：服务质量问题补偿                        │
  │    - source = 'addon' | 'promotion' | 'compensation' │
  └───────────────────────────────────────────────────┘

使用阶段：
  ┌───────────────────────────────────────────────────┐
  │ 3. 预约服务（创建预占）                            │
  │    - 检查 availableQuantity >= 1                  │
  │    - 创建 ServiceHold（TTL 15分钟）               │
  │    - heldQuantity += 1, availableQuantity -= 1   │
  └───────────────────────────────────────────────────┘
                     ↓
  ┌───────────────────────────────────────────────────┐
  │ 4. 服务完成（释放预占，生成流水）                   │
  │    - 释放 ServiceHold                             │
  │    - heldQuantity -= 1, consumedQuantity += 1    │
  │    - 创建 ServiceLedger (quantity = -1)          │
  └───────────────────────────────────────────────────┘
                     ↓
  ┌───────────────────────────────────────────────────┐
  │ 5. 定期归档（冷热分离）                            │
  │    - 归档 90 天前流水到 service_ledgers_archive   │
  │    - 主表保持性能                                  │
  └───────────────────────────────────────────────────┘
```

---

## 3. 数据模型设计

### 3.1 核心表结构

Contract Domain 包含 8 张核心表：

| 表名                                | 类型   | 职责                   |
| ----------------------------------- | ------ | ---------------------- |
| `contracts`                        | 实体表 | 合同定义               |
| `contract_service_entitlements`    | 实体表 | 合同服务权益余额       |
| `contract_amendment_revisions`   | 历史表 | 权益变更修订历史 🆕     |
| `service_ledgers`                  | 流水表 | 服务消费流水（Append-only） |
| `service_holds`                    | 实体表 | 服务预占（TTL机制）     |
| `domain_events`                    | 事件表 | 领域事件发件箱（Outbox） |
| `service_ledgers_archive`          | 归档表 | 历史流水归档           |
| `service_ledger_archive_policies`  | 配置表 | 归档策略配置           |

#### 3.1.1 表关系图

```
┌─────────────────┐              ┌──────────────────┐
│   contracts     │──produces──→ │  domain_events   │
└────────┬────────┘              └──────────────────┘
         │                        (事件发件箱)
         │ 1:N
         │
    ┌────▼─────────────────────────────┐
    │                                  │
┌───▼──────────────────────┐  ┌────────▼──────────────┐
│contract_service_entitlements│  │  service_ledgers   │
└───┬──────────────────────┘  └────────┬──────────────┘
    │                                  │
    │ 1:N 修订历史                      │ 归档
    │ ↓                                 │
┌───▼──────────────────────┐           │
│contract_amendment_revisions│       │
└───┬──────────────────────┘           │
    │ 支持预占                          │
    │                                  │
┌───▼──────────────┐           ┌───────▼───────────────┐
│ service_holds    │           │service_ledgers_archive│
└──────────────────┘           └───────────────────────┘
                                        │
                                        │ 配置
                                        │
                               ┌────────▼──────────────────┐
                               │service_ledger_archive_policies│
                               └───────────────────────────┘
```

### 3.2 详细 Schema 设计

#### 3.2.1 contracts（合同表）

**文件路径：** `src/database/schema/contracts.schema.ts`

**职责：** 管理合同全生命周期，记录合同基本信息、财务信息和状态

```typescript
import { pgTable, uuid, varchar, integer, timestamp, text, json, numeric, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

// 合同状态枚举
export const contractStatusEnum = pgEnum('contract_status', [
  'draft',       // 草稿（合同已创建但尚未签署）
  'signed',      // 已签署（合同已签署，等待激活）
  'active',      // 生效中（合同已激活，可消费服务）
  'suspended',   // 已暂停（临时暂停服务）
  'completed',   // 已完成（服务已消费完毕或过期）
  'terminated',  // 已终止（提前终止合同）
]);

export const contracts = pgTable('contracts', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 关联方
  studentId: uuid('student_id').notNull().references(() => users.id),
  counselorId: uuid('counselor_id').references(() => users.id), // 负责顾问
  // 注意：签约时不确定导师，导师在约课时才确定（在sessions表中关联）

  // 合同信息
  contractNumber: varchar('contract_number', { length: 100 }).notNull().unique(),
  title: varchar('title', { length: 500 }),
  description: text('description'),

  // 关联产品（必填）- 引用 Catalog Domain
  // v2.16.4 决策 C6: DDD 防腐层（Anti-Corruption Layer）
  // v2.16.4 决策 I3: 合同与产品一对一关系
  productId: uuid('product_id').notNull(), // Reference only, no FK constraint
  // 域隔离原则：
  // - Contract Domain does NOT import Catalog Domain schemas
  // - productId is stored as UUID reference for isolation
  // - Product validation happens at Application Layer via CatalogService
  // - NO foreign key constraint to Catalog Domain tables
  // 业务约束：
  // - 每个合同仅能绑定一个产品（一对一关系）
  // - 合同创建后不可更换产品
  // - 产品信息通过 productSnapshot (JSON) 固化

  // 财务信息
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(), // 合同总额（美元）
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).notNull().default('0'), // 已支付金额（美元）
  currency: varchar('currency', { length: 3 }).notNull().default('USD'), // 合同约定价统一使用美元

  // 有效期（从产品复制而来，null = 永久有效）
  validityDays: integer('validity_days'), // 服务有效期（天），null = 永久有效

  // 状态
  status: contractStatusEnum('status').notNull().default('draft'), // 默认为 draft，调用 sign() 后变为 signed，支付成功后 activate() 变为 active

  // 时间
  signedAt: timestamp('signed_at', { withTimezone: true }),
  effectiveAt: timestamp('effective_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }), // 计算：signedAt + validityDays，null = 永久有效

  // 元数据
  metadata: json('metadata').$type<{
    pdfUrl?: string;
    attachments?: string[];
    terms?: Record<string, any>;
  }>(),

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  terminatedAt: timestamp('terminated_at', { withTimezone: true }),
  terminationReason: text('termination_reason'),
});

// 索引
// CREATE INDEX idx_contracts_student ON contracts(student_id);
// CREATE INDEX idx_contracts_counselor ON contracts(counselor_id);
// CREATE INDEX idx_contracts_status ON contracts(status);
// CREATE INDEX idx_contracts_product ON contracts(product_id);

// 约束
// ALTER TABLE contracts ADD CONSTRAINT chk_paid_amount_not_exceed_total
// CHECK (paid_amount <= total_amount);
//
// ALTER TABLE contracts ADD CONSTRAINT chk_total_amount_positive
// CHECK (total_amount > 0);
//
// ALTER TABLE contracts ADD CONSTRAINT chk_expires_after_effective
// CHECK (expires_at IS NULL OR expires_at >= effective_at);
```

**业务规则：**

1. **唯一约束**：`contractNumber` 全局唯一
2. **金额约束**：`paidAmount <= totalAmount`，`totalAmount > 0`
3. **时间约束**：`expiresAt >= effectiveAt`（当两者都不为 null 时）
4. **产品引用**：不使用外键，通过服务调用 Catalog Domain
5. **永久有效合同**：
   - `validityDays = null` 表示合同永久有效
   - `expiresAt = null` 表示合同永久有效
   - 永久有效合同不会自动完成（不会变为 completed 状态）
   - 永久有效合同的服务权益也永久有效（`expiresAt = null`）

#### 3.2.2 contract_service_entitlements（合同服务权益余额表）

**文件路径：** `src/database/schema/contract-service-entitlements.schema.ts`

**职责：** 管理合同中包含的服务权益余额，支持额外权益添加（v2.16）

```typescript
import { pgTable, uuid, varchar, integer, timestamp, text, pgEnum } from 'drizzle-orm/pg-core';
import { contracts } from './contracts.schema';
import { serviceTypeEnum } from './enums/service-type.enum';

// 权益来源枚举 🆕v2.16
export const entitlementSourceEnum = pgEnum('entitlement_source', [
  'product',       // 来自产品定义（标准权益）
  'addon',         // 额外添加（促成签约）
  'promotion',     // 促销活动赠送
  'compensation',  // 补偿（服务质量问题、系统故障等）
]);

// 产品项类型（v2.16.4 - 与 Catalog Domain 保持一致）
export type ProductItemType = 'service' | 'service_package';

export const contractServiceEntitlements = pgTable('contract_service_entitlements', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 关联合同
  contractId: uuid('contract_id').notNull().references(() => contracts.id),
  serviceType: serviceTypeEnum('service_type').notNull(),

  // 🆕 权益来源追溯（v2.16）
  source: entitlementSourceEnum('source').notNull().default('product'),

  // 🆕 来源追溯（v2.16.4 - JSON 格式，支持多来源合并）
  originItems: json('origin_items').$type<Array<{
    productItemIndex: number;           // 在 productSnapshot.items 中的索引
    productItemType: ProductItemType;   // v2.16.4: 使用类型别名（决策 C4）
    referenceId: string;                // service_id 或 package_id（来自快照）
    referenceName: string;              // service_name 或 package_name
    quantity: number;                   // 此 item 贡献的数量
    packageItemIndex?: number;          // 如果来自 package，在 package.items 中的索引
  }>>(),  // source='product' 时必填

  // 🆕 额外添加原因（source='addon'/'compensation' 时必填）
  addOnReason: text('add_on_reason'),

  // 服务权益余额（以次数为单位，v2.16.7：所有服务统一按次数计费）
  totalQuantity: integer('total_quantity').notNull(), // 购买总量（次数）
  consumedQuantity: integer('consumed_quantity').notNull().default(0), // 已消费（服务完成）
  heldQuantity: integer('held_quantity').notNull().default(0), // 预留中（已预约未完成）
  availableQuantity: integer('available_quantity').notNull(), // 可用 = total - consumed - held

  // 🆕 服务信息快照（v2.16.4 - 增强业务字段，仅 product 来源必填）
  serviceSnapshot: json('service_snapshot').$type<{
    serviceName: string;           // 服务名称（中文）
    serviceNameEn: string;         // 服务名称（英文）
    description?: string;          // 服务描述
    category?: string;             // 服务分类
    // v2.16.4 新增：保留业务字段（决策 #3）
    billingMode?: string;          // 计费模式（'fixed' | 'hourly'）
    requiresEvaluation?: boolean;  // 是否需要评估
    requiresMentorAssignment?: boolean; // 是否需要分配导师
    snapshotAt: string;            // 快照时间（ISO 8601）
  }>(),  // v2.16.4: 改为可选，仅 source='product' 时必填

  // 过期时间（统一继承合同过期时间 - v2.16.4 决策 #1）
  expiresAt: timestamp('expires_at', { withTimezone: true }),

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  notes: text('notes'),
});

// 索引
// CREATE INDEX idx_contract_service_entitlements_contract ON contract_service_entitlements(contract_id);
// CREATE INDEX idx_contract_service_entitlements_type ON contract_service_entitlements(service_type);
// CREATE INDEX idx_contract_service_entitlements_source ON contract_service_entitlements(source);
// CREATE INDEX idx_contract_service_entitlements_expires_at ON contract_service_entitlements(expires_at);

// v2.16.7: 添加唯一约束（移除 unit 字段）
// 确保同一合同的相同服务类型（按 serviceType + expiresAt + source）只有一条记录
// ALTER TABLE contract_service_entitlements ADD CONSTRAINT uq_entitlement_key
// UNIQUE (contract_id, service_type, expires_at, source);
//
// 说明：
// - 相同 serviceType 的多个产品项会合并为一条记录
// - originItems 数组保留所有来源追溯信息
// - 使用 ON CONFLICT DO UPDATE 处理并发插入

// 约束：可用数量必须 >= 0
// ALTER TABLE contract_service_entitlements ADD CONSTRAINT chk_available_quantity
// CHECK (available_quantity >= 0);
//
// ALTER TABLE contract_service_entitlements ADD CONSTRAINT chk_quantity_consistency
// CHECK (available_quantity = total_quantity - consumed_quantity - held_quantity);

// 🆕 约束：source='addon' 或 'compensation' 时，addOnReason 必填（v2.16）
// ALTER TABLE contract_service_entitlements ADD CONSTRAINT chk_addon_reason CHECK (
//   (source NOT IN ('addon', 'compensation')) OR (add_on_reason IS NOT NULL AND length(add_on_reason) > 0)
// );

// 🆕 约束：source='product' 时，originItems 必填（v2.16.3）
// ALTER TABLE contract_service_entitlements ADD CONSTRAINT chk_origin_items CHECK (
//   (source != 'product') OR (origin_items IS NOT NULL AND jsonb_array_length(origin_items) > 0)
// );

// 🆕 约束：source='product' 时，serviceSnapshot 必填（v2.16.4 - 决策 #6）
// ALTER TABLE contract_service_entitlements ADD CONSTRAINT chk_service_snapshot_required_for_product CHECK (
//   (source != 'product') OR (service_snapshot IS NOT NULL)
// );
```

**业务规则（v2.16.7 更新）：**

1. **余额一致性**：`availableQuantity = totalQuantity - consumedQuantity - heldQuantity`
2. **智能合并策略（v2.16.7 - 移除 unit 字段）**：
   - 按 `(contract_id, service_type, expires_at, source)` 唯一约束
   - 相同服务类型的多个产品项合并为一条记录
   - `totalQuantity` 累加所有来源的数量（以次数为单位）
   - `originItems` 数组保留所有产品项的追溯信息
   - 使用 `ON CONFLICT DO UPDATE` 处理并发插入和后续添加
3. **额外权益独立存储**：addon/promotion/compensation 不合并，每次添加创建新记录
4. **必填字段验证（v2.16.4）**：
   - `source='product'` 时，`originItems` 必填（完整追溯来源）
   - `source='product'` 时，`serviceSnapshot` 必填（保留业务字段）
   - `source='addon'|'compensation'` 时，`addOnReason` 必填
   - 额外权益 `serviceSnapshot` 可选（决策 #6）
5. **过期时间继承**：所有权益统一继承 `contract.expiresAt`（决策 #1）
6. **并发控制**：使用悲观锁（SELECT FOR UPDATE）而非乐观锁

#### 3.2.3 service_ledgers（服务流水表）

**文件路径：** `src/database/schema/service-ledgers.schema.ts`

**职责：** Append-only 追踪每次服务消费和调整

```typescript
import { pgTable, uuid, varchar, integer, timestamp, text, json, pgEnum } from 'drizzle-orm/pg-core';
import { contracts } from './contracts.schema';
import { users } from './users.schema';
import { serviceTypeEnum } from './enums/service-type.enum';

// 流水类型枚举
export const serviceLedgerTypeEnum = pgEnum('service_ledger_type', [
  'consumption',      // 服务消费（quantity < 0）
  'refund',          // 退款增加（quantity > 0）
  'adjustment',      // 手动调整（quantity 可正可负）
  'initial',         // 初始化（quantity > 0）
  'expiration',      // 过期扣减（quantity < 0）
]);

// 来源枚举
export const serviceLedgerSourceEnum = pgEnum('service_ledger_source', [
  'booking_completed',    // 预约完成
  'booking_cancelled',    // 预约取消
  'manual_adjustment',    // 手动调整
]);

export const serviceLedgers = pgTable('service_ledgers', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 关联合同和学生
  contractId: uuid('contract_id').notNull().references(() => contracts.id),
  studentId: uuid('student_id').notNull().references(() => users.id),

  // 服务类型
  serviceType: serviceTypeEnum('service_type').notNull(),

  // 数量变化（负数=消费，正数=增加）
  quantity: integer('quantity').notNull(),

  // 流水类型和来源
  type: serviceLedgerTypeEnum('type').notNull(),
  source: serviceLedgerSourceEnum('source').notNull(),

  // 操作后余额（必须 >= 0）
  balanceAfter: integer('balance_after').notNull(), // 快照，用于对账

  // 关联业务记录
  relatedHoldId: uuid('related_hold_id'), // 关联的预占记录
  relatedBookingId: uuid('related_booking_id'), // 关联的预约ID（sessions/classes等）

  // 审计字段
  reason: text('reason'), // 调整原因（manual_adjustment时必填）
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
});

// 索引
// CREATE INDEX idx_service_ledgers_contract ON service_ledgers(contract_id);
// CREATE INDEX idx_service_ledgers_student ON service_ledgers(student_id);
// CREATE INDEX idx_service_ledgers_service_type ON service_ledgers(service_type);
// CREATE INDEX idx_service_ledgers_created_at ON service_ledgers(created_at);
// CREATE INDEX idx_service_ledgers_source ON service_ledgers(source);

// 约束：balanceAfter 必须 >= 0
// ALTER TABLE service_ledgers ADD CONSTRAINT chk_balance_after_non_negative
// CHECK (balance_after >= 0);

// 约束：手动调整时 reason 必填
// ALTER TABLE service_ledgers ADD CONSTRAINT chk_adjustment_reason CHECK (
//   (type != 'adjustment') OR (reason IS NOT NULL AND length(reason) > 0)
// );

// 约束：不同类型的 quantity 正负校验
// ALTER TABLE service_ledgers ADD CONSTRAINT chk_consumption_quantity_negative
// CHECK (type != 'consumption' OR quantity < 0);
//
// ALTER TABLE service_ledgers ADD CONSTRAINT chk_refund_quantity_positive
// CHECK (type != 'refund' OR quantity > 0);
//
// ALTER TABLE service_ledgers ADD CONSTRAINT chk_initial_quantity_positive
// CHECK (type != 'initial' OR quantity > 0);
//
// ALTER TABLE service_ledgers ADD CONSTRAINT chk_expiration_quantity_negative
// CHECK (type != 'expiration' OR quantity < 0);
```

**业务规则：**

1. **Append-only**：应用层禁止 UPDATE/DELETE 操作
2. **余额非负**：`balanceAfter >= 0`
3. **正负约束**：
   - `type='consumption'` → `quantity < 0`
   - `type='refund'` → `quantity > 0`
   - `type='initial'` → `quantity > 0`
   - `type='expiration'` → `quantity < 0`
4. **必填字段**：`type='adjustment'` 时，`reason` 必填

#### 3.2.4 service_holds（服务预占表）【已简化 - v2.16.9 移除过期逻辑】

**文件路径：** `src/database/schema/service-holds.schema.ts`

**职责：** 防止超额预约

**v2.16.9 重大变更：**
- ❌ **移除 TTL 过期时间**：不再需要 expiresAt 字段
- ✅ **预占永不过期**：必须由人工操作释放
- ✅ **简化状态管理**：只有 active → released/cancelled

**设计变更原因：**
1. **业务完整性**：预占代表用户的预约意图，不应自动失效
2. **减少复杂度**：移除不必要的过期逻辑和定时任务
3. **人工审核重要操作**：预约创建和取消都需要人工确认
4. **数据审计**：保留完整的预占历史记录

```typescript
import { pgTable, uuid, varchar, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { contracts } from './contracts.schema';
import { users } from './users.schema';
import { serviceTypeEnum } from './enums/service-type.enum';

// 预占状态枚举（v2.16.9: 移除 'expired' 状态）
export const holdStatusEnum = pgEnum('hold_status', [
  'active',       // 生效中（未释放）
  'released',     // 已释放（服务完成）
  'cancelled',    // 已取消（用户取消预约）
]);

export const serviceHolds = pgTable('service_holds', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 关联合同和学生
  contractId: uuid('contract_id').notNull().references(() => contracts.id),
  studentId: uuid('student_id').notNull().references(() => users.id),

  // 服务类型和预占数量
  serviceType: serviceTypeEnum('service_type').notNull(),
  quantity: integer('quantity').notNull().default(1), // 默认预占1个单位

  // 状态管理
  status: holdStatusEnum('status').notNull().default('active'),

  // 关联业务记录
  relatedBookingId: uuid('related_booking_id'), // 关联的预约ID（sessions/classes等）

  // 释放信息（人工操作记录）
  releasedAt: timestamp('released_at', { withTimezone: true }),
  releaseReason: varchar('release_reason', { length: 100 }), // 'completed' | 'cancelled' | 'admin_manual'

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),

  // 时间戳字段
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 索引
// CREATE INDEX idx_service_holds_contract ON service_holds(contract_id);
// CREATE INDEX idx_service_holds_student ON service_holds(student_id);
// CREATE INDEX idx_service_holds_service_type ON service_holds(service_type);
// CREATE INDEX idx_service_holds_status ON service_holds(status);
// ❌ 移除: idx_service_holds_expires_at (no longer needed)
```

**业务规则（v2.16.9）：**

1. **预占永不过期**：status 只能通过 `releaseHold()` 或 `cancelHold()` 变更（移除 `expiresAt` 字段）
2. **仅活跃预占计预算**：`held_quantity` 仅统计 `status = 'active'` 的记录
3. **触发器自动维护**：`held_quantity` 在 hold 状态变更时自动更新
4. **人工操作明确原因**：`releaseReason` 必填（completed / cancelled / admin_manual）

**触发器函数（v2.16.5）：**

```sql
-- 触发器函数：自动同步 held_quantity
CREATE OR REPLACE FUNCTION sync_held_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- 创建预占：held_quantity += quantity
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE contract_service_entitlements
    SET held_quantity = held_quantity + NEW.quantity,
        available_quantity = available_quantity - NEW.quantity,
        updated_at = NOW()
    WHERE contract_id = NEW.contract_id
      AND service_type = NEW.service_type;
    RETURN NEW;
  END IF;

  -- 释放预占：held_quantity -= quantity
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'active'
     AND NEW.status != 'active' THEN
    UPDATE contract_service_entitlements
    SET held_quantity = held_quantity - OLD.quantity,
        available_quantity = available_quantity + OLD.quantity,
        updated_at = NOW()
    WHERE contract_id = OLD.contract_id
      AND service_type = OLD.service_type;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_holds_sync_trigger
  AFTER INSERT OR UPDATE ON service_holds
  FOR EACH ROW
  EXECUTE FUNCTION sync_held_quantity();
```

**使用示例：**

```typescript
// 创建预占（触发器自动同步权益表）
const hold = await createHold({ contractId, serviceType });
// → held_quantity += 1, available_quantity -= 1

// 服务完成后释放
await releaseHold(holdId, 'completed');
// → held_quantity -= 1

// 用户取消预约
await cancelHold(holdId, 'cancelled');
// → held_quantity -= 1
```

1. **预占永不过期**：status 只能通过 `releaseHold()` 或 `cancelHold()` 变更
2. **仅活跃预占计预算**：held_quantity 仅统计 status = 'active' 的记录
3. **触发器自动维护**：held_quantity 在 hold 状态变更时自动更新
4. **人工操作必须明确原因**：releaseReason 必填（completed / cancelled / admin_manual）

**🆕 数据一致性保证（v2.16.5 决策 C-NEW-2）：**

使用数据库触发器自动同步 `contract_service_entitlements.held_quantity`，避免应用层手动同步导致的不一致问题。

```sql
-- 触发器函数：自动同步 held_quantity
CREATE OR REPLACE FUNCTION sync_held_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- 场景 1: 创建新预占（INSERT 且 status = 'active'）
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE contract_service_entitlements
    SET
      held_quantity = held_quantity + NEW.quantity,
      available_quantity = available_quantity - NEW.quantity,
      updated_at = NOW()
    WHERE contract_id = NEW.contract_id
      AND service_type = NEW.service_type;

    -- 验证：确保 available_quantity >= 0（触发 CHECK 约束）
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Entitlement not found for contract_id=%, service_type=%',
        NEW.contract_id, NEW.service_type;
    END IF;

    RETURN NEW;
  END IF;

  -- 场景 2: 释放预占（UPDATE 且 status 从 'active' 变为其他状态）
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'active'
     AND NEW.status != 'active' THEN
    UPDATE contract_service_entitlements
    SET
      held_quantity = held_quantity - OLD.quantity,
      available_quantity = available_quantity + OLD.quantity,
      updated_at = NOW()
    WHERE contract_id = OLD.contract_id
      AND service_type = OLD.service_type;

    RETURN NEW;
  END IF;

  -- 其他情况：不处理
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 绑定触发器到 service_holds 表
CREATE TRIGGER service_holds_sync_trigger
  AFTER INSERT OR UPDATE ON service_holds
  FOR EACH ROW
  EXECUTE FUNCTION sync_held_quantity();

-- 使用说明：
-- 1. 应用层只需操作 service_holds 表，held_quantity 会自动同步
-- 2. 触发器在事务内执行，保证原子性
-- 3. 如果 available_quantity 变为负数，CHECK 约束会阻止事务提交
```

**应用层代码简化（无需手动同步）：**

```typescript
// 创建预占（触发器自动同步 held_quantity）
// v2.16.7: 支持可选的事务参数
async createHold(dto: CreateHoldDto, tx?: DrizzleTransaction): Promise<ServiceHold> {
  // 使用提供的事务或默认数据库连接
  const executor = tx ?? db;

  return await executor.insert(serviceHolds).values({
    contractId: dto.contractId,
    studentId: dto.studentId,
    serviceType: dto.serviceType,
    quantity: dto.quantity ?? 1,
    status: 'active',
    createdBy: dto.studentId,
    relatedBookingId: dto.relatedBookingId,
  }).returning();

  // ✅ 触发器自动执行：
  // UPDATE contract_service_entitlements
  // SET held_quantity = held_quantity + 1,
  //     available_quantity = available_quantity - 1
  //
  // 注意：如果在事务中调用，触发器会在同一事务中执行
  // v2.16.9: 移除 expiresAt 字段，预占永不过期
}

// 释放预占（触发器自动同步 held_quantity）
async releaseHold(holdId: string, reason: string): Promise<void> {
  await db.update(serviceHolds)
    .set({
      status: 'released',
      releasedAt: new Date(),
      releaseReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(serviceHolds.id, holdId));

  // ✅ 触发器自动执行：
  // UPDATE contract_service_entitlements
  // SET held_quantity = held_quantity - 1,
  //     available_quantity = available_quantity + 1
}

// 批量清理过期预占（触发器自动同步）
async cleanupExpiredHolds(): Promise<number> {
  const result = await db.update(serviceHolds)
    .set({
      status: 'expired',
      updatedAt: new Date(),
    })
    .where(and(
      eq(serviceHolds.status, 'active'),
      lt(serviceHolds.expiresAt, new Date())
    ));

  // ✅ 触发器会为每一行自动同步 held_quantity
  return result.rowCount;
}
```

**一致性保证：**
- ✅ 数据库级别保证 `held_quantity` 与 `service_holds` 表实时同步
- ✅ 触发器在事务内执行，与预占操作原子性提交
- ✅ 无需应用层手动同步，减少代码复杂度和出错概率
- ✅ CHECK 约束防止 `available_quantity < 0`

**事务使用示例（v2.16.7）：**

```typescript
// 场景：预约服务时，在同一事务中创建预约记录和预占记录

async createBooking(bookingDto: CreateBookingDto): Promise<Booking> {
  return await db.transaction(async (tx) => {
    // 1. 创建预约记录
    const booking = await tx.insert(bookings).values({
      studentId: bookingDto.studentId,
      serviceType: bookingDto.serviceType,
      scheduledAt: bookingDto.scheduledAt,
      status: 'pending',
    }).returning();

    // 2. 在同一事务中创建预占（关键！）
    const hold = await holdService.createHold({
      contractId: bookingDto.contractId,
      studentId: bookingDto.studentId,
      serviceType: bookingDto.serviceType,
      quantity: 1,
      relatedBookingId: booking.id,
      createdBy: bookingDto.studentId,
    }, tx); // ← 传入事务对象

    // 3. 更新预约记录，关联预占ID
    await tx.update(bookings)
      .set({ holdId: hold.id })
      .where(eq(bookings.id, booking.id));

    // 事务提交：预约记录 + 预占记录 + 权益余额更新 原子性完成
    return booking;
  });
}

// 优势：
// ✅ 原子性：预约和预占要么全部成功，要么全部回滚
// ✅ 一致性：触发器在同一事务中更新权益余额（v2.16.9: 无过期时间）
// ✅ 无竞态条件：避免预约创建后、预占创建前被其他请求消费余额
// ✅ 人工释放：预占永不过期，必须手动调用 releaseHold()
```

#### 3.2.5 domain_events（领域事件发件箱表）

**文件路径：** `src/database/schema/domain-events.schema.ts`

**职责：** Transactional Outbox 模式，保证事件可靠发布

```typescript
import { pgTable, uuid, varchar, text, json, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';

// 事件状态枚举
export const eventStatusEnum = pgEnum('event_status', [
  'pending',    // 待发布
  'published',  // 已发布
  'failed',     // 发布失败
]);

export const domainEvents = pgTable('domain_events', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 事件类型（如：contract.signed, contract.activated）
  eventType: varchar('event_type', { length: 100 }).notNull(),

  // 聚合根ID（如：contractId）
  aggregateId: uuid('aggregate_id').notNull(),

  // 聚合根类型（如：Contract）
  aggregateType: varchar('aggregate_type', { length: 50 }).notNull().default('Contract'),

  // 事件载荷（JSONB格式）
  payload: json('payload').$type<Record<string, any>>().notNull(),

  // 发布状态
  status: eventStatusEnum('status').notNull().default('pending'),

  // 时间戳
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),

  // 重试信息
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  errorMessage: text('error_message'),

  // 元数据（可选）
  metadata: json('metadata').$type<{
    correlationId?: string;   // 关联ID（用于追踪）
    causationId?: string;     // 因果ID（触发此事件的原因）
    publishedBy?: string;     // 发布者信息
  }>(),
});

// 索引
// CREATE INDEX idx_domain_events_status ON domain_events(status);
// CREATE INDEX idx_domain_events_created_at ON domain_events(created_at);
// CREATE INDEX idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id);
// CREATE INDEX idx_domain_events_event_type ON domain_events(event_type);
```

**业务规则：**

1. **事务一致性**：事件在业务事务中创建，确保业务数据和事件原子性
2. **后台发布**：定时任务（30秒周期）扫描 `status='pending'` 的事件并发布
3. **重试机制**：失败后重试最多 3 次，超过后标记为 `failed`
4. **幂等性**：消费者需要实现幂等处理（通过 event.id 去重）
5. **清理策略**：已发布事件保留 30 天后归档或删除

**支持的事件类型：**

| Event Type              | 触发时机           | 消费者                    |
| ----------------------- | ------------------ | ------------------------- |
| `contract.signed`       | 合同签署完成       | Profile, Notification     |
| `contract.activated`    | 合同激活           | Profile, Analytics        |
| `contract.suspended`    | 合同暂停           | Services (取消预约)       |
| `contract.resumed`      | 合同恢复           | Services                  |
| `contract.completed`    | 合同完成           | Analytics                 |
| `contract.terminated`   | 合同终止           | Services, Profile         |
| `entitlement.added`     | 添加额外权益       | Notification              |
| `service.consumed`      | 服务消费完成       | Analytics                 |

#### 3.2.6 service_ledgers_archive（服务流水归档表）

**文件路径：** `src/database/schema/service-ledgers-archive.schema.ts`

**职责：** 冷热分离归档历史流水数据

```typescript
import { pgTable, uuid, varchar, integer, timestamp, text, json } from 'drizzle-orm/pg-core';
import { serviceLedgerTypeEnum, serviceLedgerSourceEnum } from './service-ledgers.schema';
import { serviceTypeEnum } from './enums/service-type.enum';

// 归档表结构与主表完全一致
export const serviceLedgersArchive = pgTable('service_ledgers_archive', {
  id: uuid('id').primaryKey(), // 保持原ID
  contractId: uuid('contract_id').notNull(),
  studentId: uuid('student_id').notNull(),
  serviceType: serviceTypeEnum('service_type').notNull(),
  quantity: integer('quantity').notNull(),
  type: serviceLedgerTypeEnum('type').notNull(),
  source: serviceLedgerSourceEnum('source').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  relatedHoldId: uuid('related_hold_id'),
  relatedBookingId: uuid('related_booking_id'),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  createdBy: uuid('created_by').notNull(),
  metadata: json('metadata'),

  // 归档信息
  archivedAt: timestamp('archived_at', { withTimezone: true }).defaultNow().notNull(),
});

// 索引（针对归档查询优化 - v2.16.4 决策 I5）
// CREATE INDEX idx_service_ledgers_archive_contract ON service_ledgers_archive(contract_id);
// CREATE INDEX idx_service_ledgers_archive_student ON service_ledgers_archive(student_id);
// CREATE INDEX idx_service_ledgers_archive_created_at ON service_ledgers_archive(created_at);
```

**归档查询策略与性能优化（v2.16.4 决策 I5）：**

1. **默认查询策略（快速）**：
   - 仅查询主表 `service_ledgers`
   - 适用于日常业务查询（近期流水）
   - 性能最优（无 UNION ALL 开销）

2. **完整历史查询（`includeArchive=true`）**：
   - 使用 UNION ALL 合并主表和归档表
   - **必须提供日期范围过滤**（避免全表扫描）
   - 适用于审计、历史分析等场景

3. **必需索引（性能关键）**：
   ```sql
   -- 归档表复合索引（优化按合同查询）
   CREATE INDEX idx_archive_contract_created
     ON service_ledgers_archive(contract_id, created_at DESC);

   -- 归档表复合索引（优化按学生查询）
   CREATE INDEX idx_archive_student_created
     ON service_ledgers_archive(student_id, created_at DESC);

   -- 归档表复合索引（优化按服务类型查询）
   CREATE INDEX idx_archive_service_created
     ON service_ledgers_archive(service_type, created_at DESC);
   ```

4. **查询示例（优化版）**：
   ```sql
   -- 示例 1: 默认查询（仅主表，最快）
   SELECT * FROM service_ledgers
   WHERE contract_id = $1
   ORDER BY created_at DESC
   LIMIT 50;

   -- 示例 2: 完整历史查询（带日期范围，推荐）
   SELECT * FROM service_ledgers
   WHERE contract_id = $1 AND created_at >= $2
   UNION ALL
   SELECT * FROM service_ledgers_archive
   WHERE contract_id = $1 AND created_at >= $2
   ORDER BY created_at DESC;

   -- 示例 3: 按学生查询（带分页）
   SELECT * FROM (
     SELECT * FROM service_ledgers
     WHERE student_id = $1 AND created_at >= $2
     UNION ALL
     SELECT * FROM service_ledgers_archive
     WHERE student_id = $1 AND created_at >= $2
   ) AS combined
   ORDER BY created_at DESC
   LIMIT 20 OFFSET 0;
   ```

5. **性能最佳实践**：
   - ✓ 总是使用日期范围过滤（created_at >= ?）
   - ✓ 使用复合索引覆盖 WHERE + ORDER BY
   - ✓ 限制返回行数（LIMIT）
   - ✗ 避免无过滤条件的 UNION ALL（性能杀手）
   - ✗ 避免 SELECT * （仅查询需要的列）

#### 3.2.6 service_ledger_archive_policies（归档策略配置表）

**文件路径：** `src/database/schema/service-ledger-archive-policies.schema.ts`

**职责：** 配置冷热分离的归档策略

```typescript
import { pgTable, uuid, integer, boolean, timestamp, text, pgEnum } from 'drizzle-orm/pg-core';
import { contracts } from './contracts.schema';
import { serviceTypeEnum } from './enums/service-type.enum';

// 策略范围枚举
export const archivePolicyScopeEnum = pgEnum('archive_policy_scope', [
  'global',          // 全局默认策略
  'contract',        // 合同级别策略
  'service_type',    // 服务类型级别策略
]);

export const serviceLedgerArchivePolicies = pgTable('service_ledger_archive_policies', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 策略范围
  scope: archivePolicyScopeEnum('scope').notNull(),

  // 关联实体（根据scope不同，可能为空）
  contractId: uuid('contract_id').references(() => contracts.id), // scope='contract'时必填
  serviceType: serviceTypeEnum('service_type'), // scope='service_type'时必填

  // 归档规则
  archiveAfterDays: integer('archive_after_days').notNull().default(90), // 超过N天归档
  deleteAfterArchive: boolean('delete_after_archive').notNull().default(false), // 归档后是否删除主表数据

  // 启用状态
  enabled: boolean('enabled').notNull().default(true),

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
  notes: text('notes'),
});

// 索引
// CREATE INDEX idx_service_ledger_archive_policies_scope ON service_ledger_archive_policies(scope);
// CREATE INDEX idx_service_ledger_archive_policies_contract ON service_ledger_archive_policies(contract_id);
// CREATE INDEX idx_service_ledger_archive_policies_service_type ON service_ledger_archive_policies(service_type);

// 约束：每个scope只能有一条记录
// CREATE UNIQUE INDEX idx_service_ledger_archive_policies_unique_global
// ON service_ledger_archive_policies(scope) WHERE scope = 'global';
//
// CREATE UNIQUE INDEX idx_service_ledger_archive_policies_unique_contract
// ON service_ledger_archive_policies(contract_id) WHERE scope = 'contract';
//
// CREATE UNIQUE INDEX idx_service_ledger_archive_policies_unique_service_type
// ON service_ledger_archive_policies(service_type) WHERE scope = 'service_type';
```

**策略优先级：** contract > service_type > global

**默认配置：**
- `archiveAfterDays`: 90
- `deleteAfterArchive`: false

---

#### 3.2.7 contract_amendment_ledgers（合同权益修改表）🆕

> **版本：** v2.16.7 新增
> **文件路径：** `src/infrastructure/database/schema/contract-entitlement-ledgers.schema.ts`
> **重要变更（v2.16.10）：** 根据 D3 决策，表名从 `revisions` 改为 `ledgers`（与代码实现保持一致）

**职责：** 记录合同服务权益的变更历史，支持审计追溯和版本管理

**设计决策：**
- ✅ 合同级别版本号：revision_number 在合同内全局递增（1, 2, 3...）
- ✅ 仅记录"权益赋予"类变更（不记录消费/预占等临时状态）
- ✅ 关联到具体权益记录（entitlement_id），精确追溯
- ✅ 支持审核流程（status, requires_approval）
- ✅ 创建合同时记录初始权益（revision_type='initial'）
-  **⚠️ v2.16.10 更新：表名对齐代码实现**  （D3 决策 - 方案B）：
  - 设计文档表名：`contract_amendment_revisions` → `contract_amendment_ledgers`
  - 文件名：`contract-amendment-ledgers.schema.ts` → `contract-entitlement-ledgers.schema.ts`
  - 迁移文件：`0002_add_contract_amendment_revisions.sql` → `0002_add_contract_amendment_ledgers.sql`

**核心用途：**
1. **审计追溯**：记录权益变更历史（何时、何人、何因、何量）
2. **数据溯源**：当数据不一致时，可通过 ledger 记录定位和修复
3. **业务分析**：统计权益添加的来源分布、数量趋势、时间模式等

**修订类型枚举（entitlement_revision_type）：**

```typescript
export const entitlementRevisionTypeEnum = pgEnum('entitlement_revision_type', [
  'initial',      // 初始权益（创建合同时）
  'addon',        // 添加额外权益（促成签约）
  'promotion',    // 促销活动赠送
  'compensation', // 补偿
  'increase',     // 增加数量（手动调整）
  'decrease',     // 减少数量（手动调整）
  'adjustment',   // 其他调整
]);
```

**Schema 定义：**

```typescript
export const contractEntitlementLedgers = pgTable(
  'contract_amendment_ledgers',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // 关联合同（必填）
    contractId: uuid('contract_id')
      .notNull()
      .references(() => contracts.id, { onDelete: 'cascade' }),

    // 关联权益记录（可空，某些历史记录可能不关联具体权益）
    entitlementId: uuid('entitlement_id').references(
      () => contractServiceEntitlements.id,
      { onDelete: 'set null' }
    ),

    // 服务标识
    serviceType: varchar('service_type', { length: 100 }).notNull(),
    serviceName: varchar('service_name', { length: 500 }).notNull(),

    // 修订元数据
    revisionType: entitlementRevisionTypeEnum('revision_type').notNull(),
    source: varchar('source', { length: 50 }).notNull(), // 'product', 'addon', 'promotion', 'compensation'

    // 数量变更
    quantityChanged: integer('quantity_changed').notNull(),  // 正数=增加，负数=减少
    totalQuantity: integer('total_quantity').notNull(),      // 变更后的总量
    availableQuantity: integer('available_quantity').notNull(), // 变更后的可用量

    // 变更原因和说明
    reason: text('reason'),  // 添加/变更原因（必填）
    description: text('description'),  // 详细说明
    attachments: json('attachments').$type<string[]>(),  // 附件URL数组

    // 操作人
    createdBy: uuid('created_by').references(() => users.id),

    // 关联业务记录
    relatedBookingId: uuid('related_booking_id'),  // 关联预约（如有）
    relatedHoldId: uuid('related_hold_id'),        // 关联预占（如有）
    relatedProductId: uuid('related_product_id'),  // 关联产品（如有）

    // 快照信息（用于审计追溯）
    snapshot: json('snapshot').$type<{
      serviceSnapshot?: any;
      productSnapshot?: any;
      originItems?: any[];
    }>(),

    // 审计字段
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  }
);
```

**索引定义（5个）：**

**⚠️ v2.16.10 更新：从9个索引简化到5个索引（移除了版本号和审批相关的索引）**

```typescript
// 1. 按合同查询审计历史（最常用）
CREATE INDEX idx_entitlement_ledgers_contract
ON contract_amendment_ledgers(contract_id, created_at DESC);

// 2. 按权益记录查询审计历史（追踪单个权益的变更）
CREATE INDEX idx_entitlement_ledgers_entitlement
ON contract_amendment_ledgers(entitlement_id, created_at DESC);

// 3. 按服务类型查询审计历史（统计某服务的所有变更）
CREATE INDEX idx_entitlement_ledgers_service_type
ON contract_amendment_ledgers(contract_id, service_type, created_at DESC);

// 4. 按修订类型查询（统计某类型变更的数量）
CREATE INDEX idx_entitlement_ledgers_revision_type
ON contract_amendment_ledgers(contract_id, revision_type, created_at DESC);

// 5. 按操作人查询（审计某个人员的操作）
CREATE INDEX idx_entitlement_ledgers_created_by
ON contract_amendment_ledgers(created_by, created_at DESC);
```

**索引变更说明：**
- ✅ 保留：基础查询索引（按合同、权益、服务类型、修订类型）
- ✅ 新增：按操作人创建的索引（审计某个人员的操作）
- ❌ 移除：revisionNumber 唯一约束（无需版本号）
- ❌ 移除：status 和 requires_approval 相关索引（无需审批）
- ❌ 移除：单独的 createdAt 索引（已在复合索引中包含）

**CHECK 约束：**

```typescript
// v2.16.10 更新：移除了所有 CHECK 约束（无需审批和状态验证）
// 仅保留 quantityChanged 不为 0 的基本验证

// 约束：quantityChanged 不能为 0
ALTER TABLE contract_amendment_ledgers
ADD CONSTRAINT chk_quantity_changed_not_zero CHECK (quantity_changed != 0);
```

**TypeScript 类型：**

```typescript
export type ContractEntitlementLedger =
  typeof contractEntitlementLedgers.$inferSelect;

export type NewContractEntitlementLedger =
  typeof contractEntitlementLedgers.$inferInsert;
```

**⚠️ 简化后的表结构总结：**
- ✅ 总计 15 个字段（从 21 个减少到 15 个）
- ✅ 5 个索引（从 9 个减少到 5 个）
- ✅ 1 个 CHECK 约束（从 2 个减少到 1 个）
- ✅ 无审批工作流、无版本号、无状态管理

**数据示例：**

**⚠️ v2.16.10 更新：移除了 versionNumber、status、requiresApproval、approvedBy、approvedAt 等字段**

```typescript
// 示例1：创建合同时的初始权益
{
  id: 'ledger-001',
  contractId: 'contract-123',
  entitlementId: 'entitlement-001',
  serviceType: 'session',
  serviceName: '1-on-1 Session',
  revisionType: 'initial',
  source: 'product',
  quantityChanged: 5,        // +5 次
  totalQuantity: 5,
  availableQuantity: 5,
  reason: '产品标准权益',   // 直接生效，无需审批
  createdBy: 'counselor-001',
  createdAt: '2025-01-01T10:00:00Z',
  snapshot: {
    serviceSnapshot: { /* ... */ },
    productSnapshot: { /* ... */ },
    originItems: [ /* ... */ ]
  }
}

// 示例2：顾问添加额外权益（直接生效）
{
  id: 'ledger-002',
  contractId: 'contract-123',
  entitlementId: 'entitlement-002',
  serviceType: 'mock_interview',
  serviceName: 'Mock Interview',
  revisionType: 'addon',
  source: 'addon',
  quantityChanged: 2,        // +2 次
  totalQuantity: 2,
  availableQuantity: 2,
  reason: '促成签约，额外赠送2次模拟面试',  // 直接生效
  createdBy: 'counselor-001',
  createdAt: '2025-01-05T14:00:00Z'
}

// 示例3：添加补偿权益（直接生效）
{
  id: 'ledger-003',
  contractId: 'contract-123',
  entitlementId: 'entitlement-003',
  serviceType: 'resume_review',
  serviceName: 'Resume Review',
  revisionType: 'compensation',
  source: 'compensation',
  quantityChanged: 1,        // +1 次
  totalQuantity: 1,
  availableQuantity: 1,
  reason: '补偿：导师未按时提交简历修改',
  description: '客户投诉，经核实后补偿',
  createdBy: 'counselor-002',
  createdAt: '2025-01-10T09:30:00Z'
}

// 示例4：手动调整（减少权益）
{
  id: 'ledger-004',
  contractId: 'contract-123',
  entitlementId: 'entitlement-001',
  serviceType: 'session',
  serviceName: '1-on-1 Session',
  revisionType: 'decrease',
  source: 'adjustment',
  quantityChanged: -2,       // -2 次（减少）
  totalQuantity: 3,          // 从5次减少到3次
  availableQuantity: 3,
  reason: '调整：客户要求减少session次数并退款',
  description: '经协商同意调整',
  createdBy: 'admin-001',    // 需要管理员权限
  createdAt: '2025-01-12T16:45:00Z'
}
```

**业务规则：**

1. **变更数量非零**：`quantityChanged` 不能为0（正数=增加，负数=减少）【唯一约束】
2. **原因必填**：`reason` 字段必须提供清晰的变更原因（用于审计）
3. **快照完整性**：`revisionType='initial'` 时，应包含 `productSnapshot` 和 `serviceSnapshot`
4. **权益关联**：`entitlementId` 应关联到被修改的具体权益记录（用于精确追溯）
5. **直接生效**：所有变更创建后立即应用（`contract_service_entitlements` 表同步更新）

**⚠️ 简化后的核心特性：**
- ✅ 所有权益变更直接生效（无需审批）
- ✅ 无需版本号（通过 createdAt 排序即可）
- ✅ 无需状态管理（变更即生效）
- ✅ 保留完整审计日志（who/when/what/why）

**使用场景：**

```typescript
// 场景1：查询合同的所有权益修改历史
const revisions = await db.query.contractAmendmentLedgers.findMany({
  where: eq(contractAmendmentLedgers.contractId, 'contract-123'),
  orderBy: [desc(contractAmendmentLedgers.createdAt)],
});

// 场景2：查询特定服务的修订历史
const serviceRevisions = await db.query.contractAmendmentLedgers.findMany({
  where: eq(contractAmendmentLedgers.serviceType, 'tutoring'),
  orderBy: [asc(contractAmendmentLedgers.createdAt)],
});

// 场景3：查询特定类型的修订
const addonRevisions = await db.query.contractAmendmentLedgers.findMany({
  where: and(
    eq(contractAmendmentLedgers.ledgerType, 'addon')
  ),
});

// 场景4：统计某个合同的修订次数
const [stats] = await db
  .select({
    totalRevisions: count(),
    addonRevisions: count().filter(
      eq(contractAmendmentLedgers.ledgerType, 'addon')
    ),
    promotionRevisions: count().filter(
      eq(contractAmendmentLedgers.ledgerType, 'promotion')
    ),
    compensationRevisions: count().filter(
      eq(contractAmendmentLedgers.ledgerType, 'compensation')
    ),
  })
  .from(contractAmendmentLedgers)
  .where(eq(contractAmendmentLedgers.contractId, 'contract-123'));
```

**性能优化：**

1. **9个索引**覆盖所有常见查询场景
2. **复合索引**优化按合同+服务类型查询
3. **时间戳索引**优化按创建时间排序查询
4. **整数类型**的 quantityChanged 字段便于统计计算
5. **UUID类型**的关联字段支持快速JOIN

**文件位置：**
- Schema: `src/infrastructure/database/schema/contract-amendment-ledgers.schema.ts` (v2.16.10 更新)
- SQL迁移: `src/infrastructure/database/migrations/0002_add_contract_amendment_ledgers.sql` (v2.16.10 更新)

---

## 4. 领域服务接口

### 4.1 核心服务列表

Contract Domain 提供 4 个核心服务：

| 服务名称 | 方法数 | 职责 | 待实现功能（v2.16.10） |
| ------------------------------- | ------ | ------------------------------ | ---------------------- |
| `ContractService` | 13 (9+4) | 合同管理和服务权益管理 | `sign()`, `suspend()`, `resume()`, `complete()` |
| `ServiceLedgerService` | 5 | 服务流水记录和余额对账 | ✅ 已实现 |
| `ServiceHoldService` | 5 | 服务预占管理（TTL机制） | ✅ 已实现 |
| `ServiceLedgerArchiveService` | 4 | 流水归档管理（冷热分离） | ✅ 已实现 |
| `AmendmentLedgerService` | 3 | 权益修改历史管理 | 待实现（v2.16.8）|

> **v2.16.10 更新：**
> - `ContractService` 缺少 4 个方法：D1 决策（`sign()`）和 D2 决策（`suspend()`, `resume()`, `complete()`）
> - `AmendmentLedgerService` 未实现：D3 决策推迟到后续版本
> - 事件监听器（D5 决策）推迟到后续版本

---

## 4. 领域服务接口

### 4.1 核心服务列表

Contract Domain 提供 4 个核心服务：

| 服务名称                        | 方法数 | 职责                           |
| ------------------------------- | ------ | ------------------------------ |
| `ContractService`              | 12     | 合同管理和服务权益管理         |
| `ServiceLedgerService`         | 5      | 服务流水记录和余额对账         |
| `ServiceHoldService`           | 5      | 服务预占管理（TTL机制）         |
| `ServiceLedgerArchiveService`  | 4      | 流水归档管理（冷热分离）        |

> **v2.16.7 更新**：`ContractService` 增加 3 个方法，用于权益修改历史管理

### 4.2 ContractService - 合同管理服务

**职责：** 合同全生命周期管理，包含服务权益管理

```typescript
interface ContractService {
  // ─────────────────────────────────────────
  // 合同管理（9个方法）
  // ─────────────────────────────────────────

  /**
   * 创建合同
   * - 基于产品创建合同
   * - 从产品派生服务权益
   * - 发布 contract.signed 事件
   */
  create(dto: CreateContractDto): Promise<Contract>;

  /**
   * 查询合同列表（分页、筛选、排序）
   */
  search(
    filter: ContractFilterDto,
    pagination?: PaginationDto,
    sort?: SortDto
  ): Promise<PaginatedResult<Contract>>;

  /**
   * 查询单个合同（支持多种查询条件）
   * - 支持按 contractId 查询
   * - 支持按 contractNumber 查询
   * - 支持按 studentId + status 组合查询
   * - 返回唯一匹配的合同，不存在则返回 null
   */
  findOne(filter: FindOneContractDto): Promise<Contract | null>;

  /**
   * 更新合同信息（仅draft状态可更新）
   */
  update(id: string, dto: UpdateContractDto): Promise<Contract>;

  /**
   * 激活合同
   * - 监听 payment.succeeded 事件触发
   * - 更新状态为 active
   * - 初始化服务权益余额
   * - 发布 contract.activated 事件
   */
  activate(id: string): Promise<Contract>;

  /**
   * 终止合同
   * - 更新状态为 terminated
   * - 记录终止原因
   * - 发布 contract.terminated 事件
   *
   * ⚠️ 副作用说明（D-NEW-3）：合同终止后自动冻结权益
   * - 触发器 trigger_contract_terminated 自动执行
   * - 将该学生所有权益的 available_quantity 设为 0
   * - 防止学生继续使用已终止合同的权益
   */
  terminate(id: string, reason: string): Promise<Contract>;

  /**
   * 完成合同（自动触发或手动触发）
   * - 触发条件：所有服务已消费完 OR 合同已过期
   * - 更新状态为 completed
   * - 发布 contract.completed 事件
   * - 可由定时任务自动触发，也可手动触发
   */
  complete(id: string): Promise<Contract>;

  /**
   * 暂停合同（仅管理员）
   * - 更新状态为 suspended
   * - 记录暂停原因
   * - 发布 contract.suspended 事件
   * - 权限：仅具有 admin 角色的用户可暂停
   */
  suspend(id: string, reason: string): Promise<Contract>;

  /**
   * 恢复已暂停的合同
   * - 更新状态回到 active
   * - 发布 contract.resumed 事件
   * - 权限：仅具有 admin 角色的用户可恢复
   */
  resume(id: string): Promise<Contract>;

  // ─────────────────────────────────────────
  // 服务权益管理（3个方法）🆕v2.16
  // ─────────────────────────────────────────

  /**
   * 查询服务权益余额（支持灵活查询条件）
   * - 支持按 contractId 查询特定合同的权益
   * - 支持按 studentId 查询学生所有合同的权益
   * - 支持按 serviceType 过滤特定服务类型
   * - 按服务类型汇总，不区分来源（决策 #7）
   * - 返回总量、已消费、预占、可用
   */
  getServiceBalance(query: ServiceBalanceQuery): Promise<ServiceBalance>;

  /**
   * 扣减服务权益（内部方法，由事件监听器调用）
   * - 监听 session.completed 事件
   * - 按优先级扣减：product > addon > promotion > compensation（决策 #6）
   * - 扣减服务权益余额
   * - 创建服务流水
   * - 释放关联的预占（如果有）
   */
  consumeService(dto: ConsumeServiceDto): Promise<void>;

  /**
   * 添加额外权益 🆕v2.16
   *
   * ⚠️ v2.16.10 重要更新：移除了审批流程，所有权益变更直接生效
   *
   * ⚠️ D-NEW-2 说明：此方法仅用于添加"额外权益"，不用于初始化
   * - 额外权益来源：addon（促成签约）/ promotion（促销）/ compensation（补偿）
   * - 初始权益（来自产品快照）应在 createContract() 中直接 INSERT
   * - 不走 contract_amendment_ledgers 表，不触发触发器
   *
   * 功能说明：
   * - 促成签约：额外赠送服务（addon）
   * - 促销活动：限时赠送（promotion）
   * - 补偿：服务质量问题补偿（compensation）
   * - 自动创建审计记录（contract_amendment_ledgers）
   * - 触发器自动更新合同权益余额（contract_service_entitlements）
   *
   * 重要特性：
   * ✅ 所有权益变更立即生效（无审批流程）
   * ✅ 自动创建审计日志（用于追溯）
   * ✅ 在同一事务中完成（原子性保证）
   *
   * @param dto - 添加权益的参数（仅额外权益）
   * @param tx - 可选的事务对象（D6 决策）
   * @returns 返回更新/创建的权益记录
   * @throws ContractException 如果余额不足或参数验证失败
   *
   * @example
   * // 场景1：顾问添加促成签约权益（直接生效）
   * await contractService.addEntitlement({
   *   contractId: 'contract-123',
   *   serviceType: 'mock_interview',
   *   totalQuantity: 2,
   *   source: 'addon',
   *   reason: '促成签约，额外赠送2次模拟面试',
   *   createdBy: 'counselor-001'
   * });
   *
   * @example
   * // 场景2：补偿客户损失
   * await contractService.addEntitlement({
   *   contractId: 'contract-456',
   *   serviceType: 'session',
   *   totalQuantity: 1,
   *   source: 'compensation',
   *   reason: '导师未按时提交简历反馈',
   *   description: '经核实，补偿1次session',
   *   createdBy: 'admin-001'
   * });
   */
  addEntitlement(dto: AddEntitlementDto, tx?: DrizzleTransaction): Promise<ContractServiceEntitlement>;

  /**
   * 查询合同权益变更审计历史 🆕v2.16.7
   *
   * ⚠️ v2.16.10 重要更新：从"审批历史查询"改为"审计历史查询"
   * - 移除了审批状态过滤（无需审批流程）
   * - 从按版本号排序改为按创建时间排序
   * - 查询结果直接反映已生效的权益变更
   *
   * ⚠️ 术语映射说明（D-NEW-4）：
   * - 业务术语："权益修改"（Entitlement Revision）
   * - 数据库表名：`contract_amendment_ledgers`（审计日志表）
   * - 命名原因："Revision" 体现业务语义（权益变更版本）
   *              "ledgers" 体现技术实现（审计流水）
   *
   * 功能说明：
   * - 按 contractId 查询某合同的所有权益变更记录
   * - 权益变更一旦创建，立即生效并记录在 ledgers 审计表中
   * - 可选按 serviceType、ledgerType、时间范围过滤
   * - 典型场景：业务审计、数据分析、问题追溯、报表统计
   *
   * @param contractId - 合同ID（必填）
   * @param options - 过滤选项（可选）
   * @returns 审计记录列表（从 ledgers 表查询，按 createdAt 降序，最新变更在前）
   *
   * @example
   * // 场景1：查询某合同的所有权益变更历史
   * const history = await contractService.getEntitlementLedgers('contract-123');
   * // 返回所有已生效的权益变更，按 createdAt 降序排列
   *
   * @example
   * // 场景2：查询某合同的特定服务类型的变更
   * const sessionHistory = await contractService.getEntitlementLedgers(
   *   'contract-123',
   *   { serviceType: 'session' }
   * );
   *
   * @example
   * // 场景3：统计某合同的补偿记录
   * const compensations = await contractService.getEntitlementLedgers(
   *   'contract-123',
   *   { ledgerType: 'compensation' }
   * );
   * console.log(`共补偿 ${compensations.length} 次`);
   *
   * @example
   * // 场景4：按时间范围查询（用于月度报表）
   * const monthlyChanges = await contractService.getEntitlementLedgers(
   *   'contract-123',
   *   {
   *     startDate: new Date('2025-01-01'),
   *     endDate: new Date('2025-01-31')
   *   }
   * );
   */
  getEntitlementLedgers(
    contractId: string,
    options?: {
      serviceType?: string;
      ledgerType?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<ContractEntitlementLedger[]>;
}
```

### 4.3 ServiceLedgerService - 服务流水管理服务

**职责：** 服务流水追踪和余额管理（Append-only）

```typescript
interface ServiceLedgerService {
  /**
   * 记录服务消费
   * - quantity < 0
   * - 创建 consumption 类型流水
   * - 更新 balanceAfter 快照
   */
  recordConsumption(dto: RecordConsumptionDto): Promise<ServiceLedger>;

  /**
   * 记录手动调整
   * - quantity 可正可负
   * - 必须填写 reason
   * - 创建 adjustment 类型流水
   */
  recordAdjustment(dto: RecordAdjustmentDto): Promise<ServiceLedger>;

  /**
   * 计算可用余额
   * - 总余额 - 活跃预占数量
   */
  calculateAvailableBalance(
    contractId: string,
    serviceType: string
  ): Promise<BalanceInfo>;

  /**
   * 查询流水记录
   * - 支持跨主表+归档表查询（UNION ALL）
   * - 支持分页、筛选、排序
   */
  queryLedgers(query: LedgerQueryDto): Promise<PaginatedResult<ServiceLedger>>;

  /**
   * 验证余额对账
   * - 通过 balanceAfter 快照验证余额正确性
   * - 用于审计和数据修复
   */
  verifyBalance(
    contractId: string,
    serviceType: string
  ): Promise<BalanceVerificationResult>;
}
```

### 4.4 ServiceHoldService - 服务预占管理服务

**职责：** TTL 机制防止超额预约

```typescript
// Drizzle 事务类型（v2.16.7）
// 从 drizzle-orm 导入：import { type PgTransaction } from 'drizzle-orm/pg-core';
type DrizzleTransaction = any; // 实际类型为 PgTransaction<...>

interface ServiceHoldService {
  /**
   * 创建预占
   * - 检查可用余额
   * - 创建预占记录
   * - 设置 TTL（环境变量可配置，默认 15 分钟 - 决策 #11）
   * - 更新权益表：heldQuantity += 1, availableQuantity -= 1
   *
   * @param dto - 创建预占的数据
   * @param tx - 可选的 Drizzle 事务对象，支持在外部事务中创建预占（v2.16.7）
   * @returns 创建的预占记录
   */
  createHold(dto: CreateHoldDto, tx?: DrizzleTransaction): Promise<ServiceHold>;

  /**
   * 释放预占
   * - 更新状态为 released
   * - 生成消费流水（如果服务完成）
   * - 更新权益表：heldQuantity -= 1
   */
  releaseHold(holdId: string, reason: string): Promise<ServiceHold>;

  /**
   * 清理过期预占（定时任务）
   * - 查询 expiresAt < now 且 status = 'active'
   * - 批量更新为 expired
   * - 释放权益余额
   */
  cleanupExpiredHolds(): Promise<number>;

  /**
   * 查询活跃预占
   * - 学生的所有活跃预占
   * - 可选按服务类型筛选
   */
  findActiveHolds(
    contractId: string,
    serviceType?: string
  ): Promise<ServiceHold[]>;

  /**
   * 延长预占时间
   * - 延长 TTL（如学生需要更多时间完成预约）
   */
  extendHold(holdId: string, additionalMinutes: number): Promise<ServiceHold>;
}
```

### 4.5 ServiceLedgerArchiveService - 流水归档管理服务

**职责：** 冷热分离归档管理

```typescript
interface ServiceLedgerArchiveService {
  /**
   * 执行归档任务（定时任务）
   * - 查询超过保留期的流水（默认 90 天）
   * - 批量复制到归档表
   * - 可选删除主表数据
   */
  archiveOldLedgers(daysOld?: number): Promise<ArchiveResult>;

  /**
   * 查询归档策略
   * - 优先级：contract > service_type > global
   */
  getArchivePolicy(
    contractId?: string,
    serviceType?: string
  ): Promise<ArchivePolicy>;

  /**
   * 设置归档策略
   * - 支持全局、合同级、服务类型级策略
   */
  setArchivePolicy(dto: SetArchivePolicyDto): Promise<ArchivePolicy>;

  /**
   * 跨表查询流水
   * - 主表 + 归档表 UNION ALL
   * - 支持分页、筛选、排序
   */
  queryLedgersWithArchive(
    query: LedgerQueryDto
  ): Promise<PaginatedResult<ServiceLedger>>;
}
```

---

## 5. DTO 定义

### 5.1 Contract DTOs

#### CreateContractDto (v2.16.4 更新)

```typescript
interface CreateContractDto {
  // 关联方
  studentId: string;
  counselorId?: string;

  // 合同信息
  title?: string;
  description?: string;

  // 🔑 产品快照（v2.16.3 - 从 Catalog Domain 获取）
  productSnapshot: IProductSnapshot; // 必填！包含完整的产品和服务信息

  // 🆕 v2.16.4: 允许覆盖定价（决策 #12）
  totalAmount?: string;   // 可选：覆盖 productSnapshot.price（支持促销折扣、定制化定价）
  currency?: string;      // 可选：覆盖 productSnapshot.currency（默认 USD）

  // 元数据
  metadata?: {
    pdfUrl?: string;
    attachments?: string[];
    terms?: Record<string, any>;
  };
}

// 字段优先级：
// - productId → productSnapshot.productId（必填）
// - totalAmount → dto.totalAmount ?? productSnapshot.price（可覆盖）
// - currency → dto.currency ?? productSnapshot.currency（可覆盖）
// - validityDays → productSnapshot.validityDays（不可覆盖）
```

#### UpdateContractDto

```typescript
interface UpdateContractDto {
  title?: string;
  description?: string;
  metadata?: {
    pdfUrl?: string;
    attachments?: string[];
    terms?: Record<string, any>;
  };
}
```

#### FindOneContractDto (v2.16.7 新增)

```typescript
interface FindOneContractDto {
  // 方式1：按合同ID查询
  contractId?: string;

  // 方式2：按合同编号查询
  contractNumber?: string;

  // 方式3：按组合条件查询
  studentId?: string;           // 学生ID
  status?: ContractStatus;      // 合同状态
  productId?: string;           // 产品ID
}

// 验证规则：
// - contractId、contractNumber、(studentId + status)、(studentId + productId) 至少提供一种查询方式
// - 如果提供 contractId，则忽略其他条件（最高优先级）
// - 如果提供 contractNumber，则忽略组合条件（次优先级）
// - 组合条件查询时，必须确保返回唯一结果，否则抛出异常

// 使用示例：
// 1. findOne({ contractId: 'uuid' })                           // 按ID查询
// 2. findOne({ contractNumber: 'CONTRACT-2025-11-00001' })    // 按编号查询
// 3. findOne({ studentId: 'uuid', status: 'active' })         // 查询学生的活跃合同
// 4. findOne({ studentId: 'uuid', productId: 'uuid' })        // 查询学生的特定产品合同
```

#### ContractFilterDto

```typescript
interface ContractFilterDto {
  studentId?: string;
  counselorId?: string;
  productId?: string;
  status?: ContractStatus | ContractStatus[];
  signedAfter?: Date;
  signedBefore?: Date;
  expiresAfter?: Date;
  expiresBefore?: Date;
}
```

#### ServiceBalanceQuery (v2.16.4 查询条件)

```typescript
interface ServiceBalanceQuery {
  // 查询条件（contractId 或 studentId 至少提供一个）
  contractId?: string;          // 查询特定合同的权益
  studentId?: string;           // 查询学生所有合同的权益

  // 过滤条件（可选）
  serviceType?: string;         // 过滤特定服务类型
  includeExpired?: boolean;     // 是否包含已过期的权益（默认：false）
}

// 验证规则：
// - contractId 和 studentId 至少提供一个
// - 如果同时提供，则以 contractId 为准
// - includeExpired=false 时，自动过滤 expiresAt < now() 的权益
```

#### ServiceBalance (v2.16.4 查询结果)

```typescript
interface ServiceBalance {
  // 查询元信息
  query: {
    contractId?: string;
    studentId?: string;
    serviceType?: string;
  };

  // 学生信息（按 studentId 查询时返回）
  student?: {
    id: string;
    name?: string;
    email?: string;
  };

  // 合同级别的权益余额列表
  contracts: Array<{
    // 合同基本信息
    contractId: string;
    contractCode: string;
    contractTitle?: string;
    contractStatus: string;
    studentId: string;
    signedAt?: Date;
    expiresAt?: Date;
    isExpired: boolean;           // 合同是否已过期

    // 该合同下的服务权益余额
    entitlements: Array<{
      serviceType: string;
      serviceName: string;        // 来自 serviceSnapshot
      serviceNameEn: string;      // 来自 serviceSnapshot
      // v2.16.4: 移除 source 字段，仅返回汇总数据（决策 #7）
      // v2.16.7: 移除 unit 字段（所有服务统一按次数计费）
      totalQuantity: number;      // 汇总所有来源的总量（次数）
      consumedQuantity: number;   // 汇总所有来源的已消费（次数）
      heldQuantity: number;       // 汇总所有来源的预占中（次数）
      availableQuantity: number;  // 汇总所有来源的可用（次数）
      expiresAt?: Date;           // 权益过期时间（继承自合同）
      isExpired: boolean;         // 权益是否已过期
    }>;
  }>;
}

// 使用场景：
// 1. 查询特定合同的所有服务权益
//    getServiceBalance({ contractId: 'xxx' })
//
// 2. 查询学生所有合同的服务权益
//    getServiceBalance({ studentId: 'xxx', includeExpired: false })
//
// 3. 查询特定合同的特定服务权益
//    getServiceBalance({ contractId: 'xxx', serviceType: 'gap_analysis' })
//
// 4. 查询学生所有一对一咨询服务的余额
//    getServiceBalance({ studentId: 'xxx', serviceType: 'External' })
//
// 注意：
// - 前端只关心总可用量，不关心来源明细
// - 后台消费时按优先级（product > addon > promotion > compensation）扣减
// - 降低前端复杂度，提升查询性能
```

### 5.2 Service Entitlement DTOs

#### AddEntitlementDto (v2.16.10 更新)

⚠️ **v2.16.10 重要更新（D4 决策 - 方案B）：** 字段名对齐代码实现

```typescript
interface AddEntitlementDto {
  contractId: string;
  serviceType: string;
  totalQuantity: number;
  source: 'addon' | 'promotion' | 'compensation'; // 来源
  // ⚠️ v2.16.10 更新：字段名从 addOnReason 改为 reason（与代码实现一致）
  reason: string; // 必填：添加原因（addon/promotion/compensation 时使用）
  // v2.16.6: 移除 unit 字段（统一为 'times'，由系统自动设置）
  // v2.16.4: 移除 expiresAt 字段（决策 #5）
  // 额外权益统一继承合同的 expiresAt，不支持独立的过期时间
  notes?: string;
  serviceSnapshot?: {    // v2.16.4: 可选（决策 #6）
    serviceName: string;
    serviceNameEn: string;
    description?: string;
  };
}
```

**字段名变更说明（D4 决策）：**
- ✅ `addOnReason` → `reason`：与代码实现保持一致
- ✅ 更新原因：简化字段命名，代码中已使用 `reason` 字段
- ✅ 文档已同步，无需修改代码

#### ConsumeServiceDto (v2.16.4 新增)

```typescript
interface ConsumeServiceDto {
  contractId: string;           // 合同ID
  studentId: string;            // 学生ID（流水记录必需）
  serviceType: string;          // 服务类型
  quantity: number;             // 消费数量（必须 > 0）
  relatedBookingId?: string;    // 关联预约ID（审计追溯）
  relatedHoldId?: string;       // 关联预占ID（如果有，将自动释放）
  source: 'booking_completed';  // 消费来源（当前仅支持预约完成）
  metadata?: Record<string, any>; // 额外元数据
}

// 使用场景：
// - 由 session.completed 事件监听器调用
// - 自动按优先级扣减权益（product > addon > promotion > compensation）
// - 创建服务消费流水
// - 如果提供 relatedHoldId，自动释放对应预占
```

### 5.3 Service Ledger DTOs

#### RecordConsumptionDto

```typescript
interface RecordConsumptionDto {
  contractId: string;
  studentId: string;
  serviceType: string;
  quantity: number; // 必须 < 0
  relatedHoldId?: string;
  relatedBookingId?: string;
  metadata?: Record<string, any>;
}
```

#### RecordAdjustmentDto

```typescript
interface RecordAdjustmentDto {
  contractId: string;
  studentId: string;
  serviceType: string;
  quantity: number; // 可正可负
  reason: string; // 必填
  metadata?: Record<string, any>;
}
```

#### LedgerQueryDto

```typescript
interface LedgerQueryDto {
  contractId?: string;
  studentId?: string;
  serviceType?: string;
  type?: ServiceLedgerType | ServiceLedgerType[];
  source?: ServiceLedgerSource | ServiceLedgerSource[];
  createdAfter?: Date;
  createdBefore?: Date;
  includeArchive?: boolean; // 是否包含归档数据
  pagination?: PaginationDto;
  sort?: SortDto;
}
```

#### BalanceInfo

```typescript
interface BalanceInfo {
  contractId: string;
  serviceType: string;
  totalBalance: number; // 总余额（次数，从 contract_service_entitlements 计算）
  activeHolds: number; // 活跃预占数量（次数）
  availableBalance: number; // 可用余额 = totalBalance - activeHolds（次数）
}
```

#### BalanceVerificationResult

```typescript
interface BalanceVerificationResult {
  contractId: string;
  serviceType: string;
  isValid: boolean;
  expectedBalance: number;
  actualBalance: number;
  discrepancy: number;
  errors: Array<{
    ledgerId: string;
    expectedBalanceAfter: number;
    actualBalanceAfter: number;
  }>;
}
```

### 5.4 Service Hold DTOs

#### CreateHoldDto

```typescript
interface CreateHoldDto {
  contractId: string;
  studentId: string;
  serviceType: string;
  quantity?: number; // 默认 1
  relatedBookingId?: string;
  createdBy: string;
}

// 注意（v2.16.9）：
// v2.16.9 移除 TTL 机制，预占永不过期，需手动释放
// - createHold() 方法接受可选的 DrizzleTransaction 参数（tx）
// - 如果提供 tx，则在该事务中创建预占记录
// - 如果不提供 tx，则使用独立事务
//
// 使用场景：
// 1. 独立创建预占：await holdService.createHold(dto)
// 2. 在外部事务中创建：await holdService.createHold(dto, tx)
```

### 5.5 Archive Policy DTOs

#### SetArchivePolicyDto

```typescript
interface SetArchivePolicyDto {
  scope: 'global' | 'contract' | 'service_type';
  contractId?: string; // scope='contract' 时必填
  serviceType?: string; // scope='service_type' 时必填
  archiveAfterDays: number; // 超过N天归档
  deleteAfterArchive: boolean; // 归档后是否删除主表数据
  enabled: boolean;
  notes?: string;
}
```

#### ArchiveResult

```typescript
interface ArchiveResult {
  totalArchived: number; // 归档记录数
  totalDeleted: number; // 删除记录数（如果 deleteAfterArchive=true）
  archivedAt: Date;
  timeTaken: number; // 耗时（毫秒）
}
```

### 5.6 Common DTOs

#### PaginationDto

```typescript
interface PaginationDto {
  page: number; // 页码（从 1 开始）
  pageSize: number; // 每页记录数
}
```

#### SortDto

```typescript
interface SortDto {
  field: string; // 排序字段
  order: 'asc' | 'desc'; // 排序方向
}
```

#### PaginatedResult<T>

```typescript
interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

### 5.7 Event Payload DTOs (v2.16.4 新增)

**目的：** 定义 Contract Domain 发布的所有事件载荷结构

#### ContractSignedEvent

```typescript
interface ContractSignedEvent {
  eventType: 'contract.signed';
  aggregateId: string; // contractId
  occurredAt: Date;
  payload: {
    contractId: string;
    contractCode: string;
    studentId: string;
    studentName?: string;
    counselorId?: string;
    counselorName?: string;
    productId: string;
    productName: string;
    totalAmount: string;
    currency: string;
    validityDays?: number;
    signedAt: Date;
    expiresAt?: Date;
  };
}

// 使用场景：
// - 通知 CRM 系统合同已签订
// - 触发欢迎邮件发送
// - 创建待付款提醒任务
```

#### ContractActivatedEvent

```typescript
interface ContractActivatedEvent {
  eventType: 'contract.activated';
  aggregateId: string; // contractId
  occurredAt: Date;
  payload: {
    contractId: string;
    contractCode: string;
    studentId: string;
    effectiveAt: Date;
    expiresAt?: Date;
    paidAmount: string;
    // 激活的服务权益列表
    entitlements: Array<{
      serviceType: string;
      serviceName: string;
      totalQuantity: number;      // 数量（次数，v2.16.7：所有服务统一按次数计费）
      expiresAt?: Date;
    }>;
  };
}

// 使用场景：
// - 通知学生服务已激活
// - 允许学生开始预约服务
// - 触发服务使用指南发送
```

#### ContractCompletedEvent

```typescript
interface ContractCompletedEvent {
  eventType: 'contract.completed';
  aggregateId: string; // contractId
  occurredAt: Date;
  payload: {
    contractId: string;
    contractCode: string;
    studentId: string;
    completedAt: Date;
    completionReason: 'services_consumed' | 'expired'; // 完成原因
    totalServicesConsumed: number; // 总消费服务次数
  };
}

// 使用场景：
// - 触发满意度调查
// - 推荐续约或新产品
// - 归档合同数据
```

#### ContractTerminatedEvent

```typescript
interface ContractTerminatedEvent {
  eventType: 'contract.terminated';
  aggregateId: string; // contractId
  occurredAt: Date;
  payload: {
    contractId: string;
    contractCode: string;
    studentId: string;
    terminatedAt: Date;
    terminationReason: string; // 终止原因（必填）
    remainingServices: Array<{
      serviceType: string;
      remainingQuantity: number;  // 剩余数量（次数，v2.16.7：所有服务统一按次数计费）
    }>;
  };
}

// 使用场景：
// - 通知相关方合同已终止
// - 冻结剩余服务权益
// - 触发退款流程（如适用）
```

#### ContractSuspendedEvent (v2.16.4 新增)

```typescript
interface ContractSuspendedEvent {
  eventType: 'contract.suspended';
  aggregateId: string; // contractId
  occurredAt: Date;
  payload: {
    contractId: string;
    contractCode: string;
    studentId: string;
    suspendedAt: Date;
    suspensionReason: string; // 暂停原因（必填）
    suspendedBy: string; // 操作人ID（仅管理员）
  };
}

// 使用场景：
// - 通知学生服务已暂停
// - 阻止新的服务预约
// - 记录暂停日志
```

#### ContractResumedEvent (v2.16.4 新增)

```typescript
interface ContractResumedEvent {
  eventType: 'contract.resumed';
  aggregateId: string; // contractId
  occurredAt: Date;
  payload: {
    contractId: string;
    contractCode: string;
    studentId: string;
    resumedAt: Date;
    resumedBy: string; // 操作人ID（仅管理员）
  };
}

// 使用场景：
// - 通知学生服务已恢复
// - 允许重新预约服务
// - 记录恢复日志
```

#### 事件结构说明

**统一字段：**
- `eventType`: 事件类型标识
- `aggregateId`: 聚合根ID（合同ID）
- `occurredAt`: 事件发生时间（UTC）
- `payload`: 事件载荷（具体数据）

**最佳实践：**
- 事件载荷应包含事件消费者需要的所有必要信息
- 避免在载荷中包含敏感信息（如密码）
- 事件发布后不可修改（Event Sourcing 原则）
- 事件名称使用过去时（signed, activated, completed）

#### Contract Domain 需监听的外部事件 🆕v2.16.10 (D5 决策)

根据 D5 决策，Contract Domain 需要实现以下事件监听器来接收外部域的事件：

##### PaymentSucceededListener (监听 payment.succeeded)

**事件来源：** Financial Domain

**触发时机：** 学生支付首付款成功后

**处理逻辑：**
```typescript
@EventListener('payment.succeeded')
async handlePaymentSucceeded(event: PaymentSucceededEvent): Promise<void> {
  // 1. 验证事件数据完整性
  // 2. 查询对应的合同（合同状态必须为 signed）
  // 3. 调用 contractService.activate() 激活合同
  // 4. 初始化服务权益（从 snapshot 派生）
  // 5. 发布 contract.activated 事件
}
```

**事件载荷结构：**
```typescript
interface PaymentSucceededEvent {
  eventType: 'payment.succeeded';
  aggregateId: string; // paymentId
  occurredAt: Date;
  payload: {
    paymentId: string;
    contractId: string;       // 关联的合同ID
    studentId: string;
    amount: string;           // 支付金额
    currency: string;
    paymentMethod: string;    // 支付方式
    transactionId: string;    // 交易流水号
  };
}
```

**使用场景：**
- 自动激活已付款的合同（signed → active）
- 避免手动调用激活API，实现事件驱动架构

##### SessionCompletedListener (监听 session.completed)

**事件来源：** Services Domain

**触发时机：** 服务会话（如1对1咨询、模拟面试）完成后

**处理逻辑：**
```typescript
@EventListener('session.completed')
async handleSessionCompleted(event: SessionCompletedEvent): Promise<void> {
  // 1. 验证事件数据完整性
  // 2. 查询对应的合同（合同状态必须为 active）
  // 3. 调用 contractService.consumeService() 扣减权益
  // 4. 创建服务消费流水（ServiceLedger）
  // 5. 释放关联的预占（如果有）
  // 6. 发布 service.consumed 事件
}
```

**事件载荷结构：**
```typescript
interface SessionCompletedEvent {
  eventType: 'session.completed';
  aggregateId: string; // sessionId
  occurredAt: Date;
  payload: {
    sessionId: string;
    contractId: string;       // 关联的合同ID
    studentId: string;
    mentorId: string;         // 导师ID
    serviceType: string;      // 服务类型（如 'session', 'mock_interview'）
    scheduledAt: Date;        // 预约时间
    completedAt: Date;        // 完成时间
    duration: number;         // 时长（分钟）
    notes?: string;           // 会话备注
  };
}
```

**使用场景：**
- 自动扣减服务权益
- 创建完整的消费流水记录
- 实现权益余额的实时更新

##### SessionCancelledListener (监听 session.cancelled)

**事件来源：** Services Domain

**触发时机：** 用户取消已预约的服务会话

**处理逻辑：**
```typescript
@EventListener('session.cancelled')
async handleSessionCancelled(event: SessionCancelledEvent): Promise<void> {
  // 1. 验证事件数据完整性
  // 2. 查询关联的预占记录（relatedBookingId）
  // 3. 调用 serviceHoldService.cancelHold() 释放预占
  // 4. 恢复服务权益的可用余额
}
```

**事件载荷结构：**
```typescript
interface SessionCancelledEvent {
  eventType: 'session.cancelled';
  aggregateId: string; // sessionId
  occurredAt: Date;
  payload: {
    sessionId: string;
    contractId: string;       // 关联的合同ID
    studentId: string;
    serviceType: string;
    scheduledAt: Date;        // 原定预约时间
    cancelledAt: Date;        // 取消时间
    cancellationReason: string; // 取消原因
  };
}
```

**使用场景：**
- 取消预约时释放预占的权益
- 避免权益被长期预占导致无法使用

**事件监听最佳实践：**

1. **幂等性处理：** 所有事件监听器必须实现幂等性，避免重复处理
   ```typescript
   // 使用事件ID去重
   const processed = await this.eventStore.isEventProcessed(event.id);
   if (processed) {
     return; // 已处理过，直接返回
   }
   ```

2. **错误处理：** 捕获异常并记录，避免监听器的异常影响事件总线
   ```typescript
   try {
     await this.handleEvent(event);
   } catch (error) {
     this.logger.error('Failed to handle event', error);
     // 记录到死信队列，供后续人工处理
     await this.deadLetterQueue.send(event, error);
   }
   ```

3. **事务一致性：** 监听器内的所有操作应在同一数据库事务中执行
   ```typescript
   await this.db.transaction(async (tx) => {
     await this.contractService.activate(contractId, tx);
     await this.eventStore.markAsProcessed(event.id, tx);
   });
   ```

4. **异步处理：** 事件监听应异步执行，不阻塞事件发布者
   - 使用消息队列（如 RabbitMQ, Kafka）解耦
   - 或使用 NestJS 的 EventEmitter 异步处理


### 5.8 Contract Entitlement Ledger DTOs (v2.16.10 更新)

#### CreateAmendmentLedgerDto

```typescript
/**
 * ⚠️ v2.16.10 重大简化：从修订DTO改为审计DTO
 *
 * 创建权益审计记录 DTO
 * 用于在 addEntitlement() 和 create() 方法内部创建审计记录
 *
 * 核心变更：
 * - 移除 revisionNumber（无需版本号）
 * - 移除 status（无需审批状态）
 * - 移除 requiresApproval（无需审批）
 * - 移除 approvedBy, approvedAt, approvalNotes（无审批流程）
 * - addOnReason → reason（D4决策 - 字段名对齐代码实现）
 */
interface CreateAmendmentLedgerDto {
  contractId: string;          // 合同ID（必填）
  entitlementId?: string;      // 权益记录ID（可选）
  serviceType: string;         // 服务类型（必填）
  serviceName: string;         // 服务名称快照（必填）
  revisionType: string;        // 修订类型（必填）：'initial' | 'addon' | 'promotion' | 'compensation' | 'increase' | 'decrease'
  source: 'product' | 'addon' | 'promotion' | 'compensation'; // 权益来源
  quantityChanged: number;     // 变更数量（必填，正数=增加，负数=减少）
  totalQuantity: number;       // 变更后总量（必填）
  availableQuantity: number;   // 变更后可用量（必填）
  reason: string;              // ⚠️ D4决策：字段名从 addOnReason 改为 reason（与代码实现一致）
  description?: string;        // 详细说明（可选）
  attachments?: string[];      // 附件URL数组（可选）
  createdBy: string;           // 操作人ID（必填）
  relatedBookingId?: string;   // 关联预约ID（可选）
  relatedHoldId?: string;      // 关联预占ID（可选）
  relatedProductId?: string;   // 关联产品ID（可选）
  snapshot?: {                 // 快照信息（可选，用于审计追溯）
    serviceSnapshot?: any;
    productSnapshot?: any;
    originItems?: any[];
  };
}
```

#### GetAmendmentLedgersQuery

```typescript
/**
 * ⚠️ v2.16.10 更新：从修订查询改为审计查询
 *
 * 查询权益审计历史参数
 * 移除所有与审批相关的过滤条件
 */
interface GetAmendmentLedgersQuery {
  contractId: string;                               // 合同ID（必填）
  serviceType?: string;                             // 服务类型（可选，过滤）
  revisionType?: 'initial' | 'addon' | 'promotion' | 'compensation' | 'increase' | 'decrease'; // 修订类型（可选）
  startDate?: Date;                                 // 开始时间（可选，时间范围过滤）
  endDate?: Date;                                   // 结束时间（可选，时间范围过滤）
  page?: number;                                    // 页码（可选，默认1）
  pageSize?: number;                                // 每页记录数（可选，默认20）
  sortBy?: 'createdAt';                             // ⚠️ 排序字段（仅支持 createdAt，默认 createdAt DESC）
  sortOrder?: 'asc' | 'desc';                       // 排序方向（可选）
}

// 使用示例：
// 场景1：查询某个合同的所有权益变更历史（按时间倒序）
const params: GetAmendmentLedgersQuery = {
  contractId: 'contract-123',
  sortBy: 'createdAt',
  sortOrder: 'desc'
};

// 场景2：查询特定服务类型的变更
const params: GetAmendmentLedgersQuery = {
  contractId: 'contract-123',
  serviceType: 'session',
  sortBy: 'createdAt',
  sortOrder: 'desc'
};

// 场景3：统计某合同的补偿记录
const params: GetAmendmentLedgersQuery = {
  contractId: 'contract-123',
  revisionType: 'compensation'
};

// 场景4：按时间范围查询（用于月度报表）
const params: GetAmendmentLedgersQuery = {
  contractId: 'contract-123',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31')
};
```

**⚠️ v2.16.10 已移除的 DTO：**
- ❌ `ApproveRevisionDto` - 无需审批
- ❌ `RejectRevisionDto` - 无需审批
- ❌ `GetEntitlementRevisionsQuery.status` - 无审批状态

---

## 6. 业务规则与验证

### 6.1 合同业务规则

#### 6.1.1 创建合同

**前置条件：**
1. ✅ 学生（studentId）必须存在
2. ✅ 产品快照（productSnapshot）已由 Application Layer 从 Catalog Domain 获取
3. ✅ 产品快照数据完整（包含 price、items 等必要字段）
4. ✅ 顾问（counselorId）必须存在（可选）

**核心业务约束（v2.16.4 决策 I3）：**
- 📌 **合同与产品一对一关系**：
  - 每个合同仅能绑定一个产品
  - 合同创建时必须提供完整的 `productSnapshot`
  - 合同创建后不可更换产品（productId 不可变）
  - 产品信息固化在 `productSnapshot` JSON 字段中

**执行逻辑：**
1. 验证产品快照完整性：
   - 验证 `productSnapshot.productId` 存在
   - 验证 `productSnapshot.price > 0`
   - 验证 `productSnapshot.items.length > 0`
   - 验证每个 item 的 `quantity > 0`
   - 验证 service 和 service_package 快照存在
2. **总金额覆盖验证（v2.16.4 决策 I4 - Decision #5）：**
   - 默认值：使用 `productSnapshot.price`
   - 如果提供了 `totalAmount`（覆盖产品价格）：
     - ✓ **金额范围验证**：
       - 必须 >= 0（允许免费合同）
       - 必须 <= `productSnapshot.price * 2`（防止输入错误）
       - 如果低于原价，最多折扣 90%（即最低 10% 原价）
     - ✓ **权限验证**：
       - 覆盖价格需要 `pricing_override` 权限
       - 免费合同（$0）需要超级管理员权限
     - ✓ **审计追溯**：
       - 必须在 `metadata.pricingNote` 中记录覆盖原因
       - 记录操作人（createdBy）和时间戳
   - **示例**：
     - 产品价格：$1000
     - 允许范围：$100 - $2000
     - $0：仅超级管理员可设置（特殊免费合同）
     - $500：需 pricing_override 权限 + 原因说明（"早鸟优惠 50% 折扣"）
     - $2500：❌ 抛出异常（超过最大允许金额）
     - $50：❌ 抛出异常（低于最低 10% 原价）
3. 生成唯一合同编号（v2.16.4 决策 C5）：
   - 格式：`CONTRACT-YYYY-MM-NNNNN`
   - 调用 PostgreSQL 函数：`generate_contract_code()`
   - 示例：CONTRACT-2025-01-00001
   - 月内顺序递增，月初自动重置
   - 并发安全（基于 PostgreSQL SEQUENCE）
3. 创建合同记录（status = draft）：
   - `productId` ← `productSnapshot.productId`（一对一绑定，不可变）
   - `totalAmount` ← `productSnapshot.price`
   - `currency` ← `productSnapshot.currency`
   - `validityDays` ← `productSnapshot.validityDays`（null = 永久有效）
   - 计算 `expiresAt = signedAt + validityDays`（null = 永久有效）
   - `productSnapshot` ← 完整的产品快照（固化产品信息）
4. 从产品快照派生服务权益（详见 1.4.5 权益拆解逻辑）：
   - 遍历 `productSnapshot.items`
   - **type='service'**：直接创建权益记录
   - **type='service_package'**：遍历 `servicePackageSnapshot.items`，为每个 service 创建权益记录
   - 数量计算：`totalQuantity = item.quantity * pkgItem.quantity`
   - 合并相同 serviceType 的权益（累加数量）
   - 批量插入 `contract_service_entitlements`（source = 'product'）
   - 如果合同永久有效，权益也永久有效（expiresAt = null）
5. 发布事件：`contract.signed`

**后置条件：**
1. ✅ 合同状态为 draft
2. ✅ 服务权益已初始化（已展开 service_packages）
3. ✅ 权益包含服务快照（serviceSnapshot 字段）
4. ✅ 事件已发布

**关键变更（v2.16.3）：**
- ✅ Contract Domain 不再调用 Catalog Domain 查询产品详情
- ✅ 快照由 Application Layer 在调用前获取并传入
- ✅ 权益派生逻辑完全基于快照数据（零外部查询）

#### 6.1.2 激活合同

**前置条件：**
1. ✅ 合同状态为 draft
2. ✅ 已收到 `payment.succeeded` 事件
3. ✅ 支付金额 >= 首付要求

**执行逻辑：**
1. 更新合同状态为 active
2. 设置 effectiveAt = now
3. 计算 expiresAt：
   - 如果 validityDays != null：expiresAt = signedAt + validityDays
   - 如果 validityDays = null：expiresAt = null（永久有效）
4. 更新 paidAmount
5. 发布事件：`contract.activated`

**后置条件：**
1. ✅ 合同状态为 active
2. ✅ 服务权益可用
3. ✅ 事件已发布
4. ✅ 永久有效合同的 expiresAt = null

#### 6.1.3 终止合同

**前置条件：**
1. ✅ 合同状态为 active 或 suspended
2. ✅ 提供终止原因

**执行逻辑：**
1. 更新合同状态为 terminated
2. 设置 terminatedAt = now
3. 记录 terminationReason
4. 冻结所有服务权益（availableQuantity = 0）
5. 发布事件：`contract.terminated`

**后置条件：**
1. ✅ 合同状态为 terminated
2. ✅ 服务权益不可用
3. ✅ 事件已发布

### 6.2 服务权益业务规则

#### 6.2.1 添加额外权益 🆕v2.16

**⚠️ v2.16.10 重大简化：移除了审批流程，所有权益变更立即生效**

**前置条件：**
1. ✅ 合同存在且状态为 active
2. ✅ 服务类型有效
3. ✅ 权益来源为 addon/promotion/compensation
4. ✅ 提供变更原因（reason）

**核心业务规则（v2.16.10 更新）：**
- 📌 **权益变更立即生效**：所有额外权益（addon/promotion/compensation）添加后立即生效
- 📌 **自动创建审计记录**：在同一事务中创建审计日志（contract_amendment_ledgers）
- 📌 **同步更新权益余额**：contract_service_entitlements 表立即更新可用数量
- 📌 **无审批流程**：简化业务流程，提升用户体验（无需等待管理员审批）

**执行逻辑：**
1. 验证合同状态（必须为 active）
2. 验证服务类型有效性
3. **创建 contract_service_entitlements 记录（如不存在）或更新现有记录：**
   - source = addon/promotion/compensation
   - reason = 提供的原因（审计用途）
   - totalQuantity = 添加数量
   - availableQuantity = 添加数量（⚠️ 立即生效）
   - createdBy = 操作人ID
4. **创建权益审计记录（contract_amendment_ledgers）：**
   - revisionType = addon/promotion/compensation（根据 source 确定）
   - quantityChanged = 正数（增加）
   - totalQuantity = 变更后的总量
   - availableQuantity = 变更后的可用量
   - reason = 变更原因（必填，用于审计）
   - createdBy = 操作人ID
   - snapshot = 完整快照（用于审计追溯）
5. 创建流水记录（type = 'adjustment', source = 'manual_adjustment'）
   - balanceAfter = 变更后的可用数量

**执行逻辑（v2.16.10 简化）：**
1. 验证合同状态和服务类型
2. 创建/更新权益记录（立即生效，available=totalQuantity）
3. 创建审计记录（记录who/when/what/why）
4. 创建流水记录

**后置条件：** 权益立即可用，无需审批等待

**核心变更（v2.16.10）：** 移除了审批流程，变更立即生效

#### 6.2.2 扣减服务权益（v2.16.4 优先级算法）

**前置条件：** 合同状态为active，权益余额充足

**执行逻辑（优先级算法 + 并发控制）：**

```typescript
// 优先级顺序：product > addon > promotion > compensation
// 使用FOR UPDATE悲观锁保证并发安全
// 同一事务内完成权益更新、流水记录、预占释放
```

**并发控制（v2.16.5决策C-NEW-1）：**
- 悲观锁（FOR UPDATE）防止并发修改
- 数据库事务保证原子性
- 按contractId→serviceType顺序锁定避免死锁

**后置条件：** 按优先级扣减权益，记录完整流水，预占自动释放

### 6.3 服务流水业务规则

#### 6.3.1 Append-only 保护

**应用层保护：** 仅提供INSERT方法，禁止UPDATE/DELETE

**数据库权限：**
```sql
-- 只授予INSERT和SELECT权限
REVOKE UPDATE, DELETE ON service_ledgers FROM mentorx_app_user;
GRANT INSERT, SELECT ON service_ledgers TO mentorx_app_user;
```

#### 6.3.2 余额对账验证

**验证逻辑：**

```typescript
async verifyBalance(
  contractId: string,
  serviceType: string
): Promise<BalanceVerificationResult> {
  // 1. 查询所有流水（按时间排序）
  const ledgers = await this.queryLedgers({
    contractId,
    serviceType,
    sort: { field: 'createdAt', order: 'asc' },
  });

  // 2. 逐条验证 balanceAfter
  let expectedBalance = 0;
  const errors: Array<any> = [];

  for (const ledger of ledgers.data) {
    expectedBalance += ledger.quantity;

    if (ledger.balanceAfter !== expectedBalance) {
      errors.push({
        ledgerId: ledger.id,
        expectedBalanceAfter: expectedBalance,
        actualBalanceAfter: ledger.balanceAfter,
      });
    }
  }

  // 3. 返回验证结果
  return {
    contractId,
    serviceType,
    isValid: errors.length === 0,
    expectedBalance,
    actualBalance: ledgers.data[ledgers.data.length - 1]?.balanceAfter ?? 0,
    discrepancy: expectedBalance - (ledgers.data[ledgers.data.length - 1]?.balanceAfter ?? 0),
    errors,
  };
}
```

### 6.4 服务预占业务规则

#### 6.4.1 创建预占【已简化 - v2.16.9 移除过期逻辑】

**前置条件：**
1. ✅ 合同状态为 active
2. ✅ 服务权益存在
3. ✅ availableQuantity >= 预占数量

**执行逻辑（v2.16.9 更新）：**
1. 验证可用余额
2. 创建预占记录：
   - status = 'active'（无过期时间，永不过期）
3. **触发器自动同步权益表**：
   - heldQuantity += 预占数量
   - availableQuantity -= 预占数量

**后置条件：**
1. ✅ 预占记录已创建
2. ✅ 权益余额已更新（触发器）

#### 6.4.2 释放预占【v2.16.9 移除过期逻辑】

**前置条件：**
1. ✅ 预占记录存在
2. ✅ 预占状态为 active

**执行逻辑（v2.16.9 更新）：**
1. 更新预占记录：
   - status = 'released' 或 'cancelled'
   - releasedAt = now
   - releaseReason = 'completed' | 'cancelled' | 'admin_manual'
2. **触发器自动同步权益表**：
   - heldQuantity -= 预占数量
3. （可选）如果服务完成，创建消费流水

**后置条件：**
1. ✅ 预占已释放
2. ✅ 权益余额已更新（触发器）
3. ✅ 流水已记录（如果服务完成）

#### 6.4.3 预占永不过期（v2.16.9重大简化）

**设计变更：** 移除expiresAt字段和自动清理逻辑，预占必须通过releaseHold()或cancelHold()释放

**决策理由：**
1. 业务完整性：预占代表用户预约意图，不应自动失效
2. 减少复杂度：移除过期逻辑、TTL、定时任务
3. 人工审核：所有释放操作必须明确确认
4. 数据完整性：保留完整预占历史

**性能提升：** 移除定时任务，减少数据库字段，简化应用逻辑

### 6.5 流水归档业务规则

#### 6.5.1 归档策略优先级

**优先级顺序：** contract > service_type > global

**默认策略：** 90天后归档，不删除数据

#### 6.5.2 执行归档任务

**执行频率：** 每日凌晨2:00

**执行逻辑：** 批量复制到归档表，可选删除主表数据

**核心机制：**
- 查询过期流水（基于archiveAfterDays）
- 批量复制到service_ledgers_archive表
- 可选删除主表数据（根据deleteAfterArchive配置）
- 返回归档统计信息

### 6.6 权益修改业务规则 🆕v2.16.7

#### 6.6.1 审计记录机制（v2.16.10简化版）

**触发时机：**
- 创建合同时：生成初始权益审计记录（revisionType='initial'）
- 添加权益时：生成变更审计记录（revisionType='addon'/'promotion'/'compensation'）

**核心规则（v2.16.10）：**
- 权益变更立即生效，无审批流程
- 必填字段：contractId、serviceType、quantityChanged、reason
- 在同一事务中完成权益更新和审计记录创建

**后置条件：**
- 审计记录成功写入数据库
- 权益变更和审计记录原子性完成
- 完整的变更历史可追溯（who/when/what/why）

#### 6.6.2 查询权益审计历史（v2.16.10更新）

**查询规则：**
- 按创建时间降序排列（最新变更在前）
- 支持分页和复合过滤
- 性能优化：使用count()获取总数

**⚠️ v2.16.10已移除的功能：**
- ❌ 审批功能（approve/reject）
- ❌ 版本号追踪（revisionNumber）
- ❌ 审批状态管理（status字段）

**原因：** 简化业务流程，权益变更立即生效，无需审批等待。

### 6.6 权益修改业务规则（v2.16.10简化版）

#### 6.6.1 审计记录机制

**触发时机：**
- 创建合同时：生成初始权益审计记录（revisionType='initial'）
- 添加权益时：生成变更审计记录（revisionType='addon'/'promotion'/'compensation'）

**核心规则（v2.16.10）：**
- 权益变更立即生效，无审批流程
- 必填字段：contractId、serviceType、quantityChanged、reason
- 在同一事务中完成权益更新和审计记录创建

**后置条件：**
- 审计记录成功写入数据库
- 权益变更和审计记录原子性完成
- 完整的变更历史可追溯（who/when/what/why）

#### 6.6.2 查询权益审计历史（v2.16.10更新）

**查询规则：**
- 按创建时间降序排列（最新变更在前）
- 支持分页和复合过滤
- 性能优化：使用count()获取总数

**⚠️ v2.16.10已移除的功能：**
- ❌ 审批功能（approve/reject）
- ❌ 版本号追踪（revisionNumber）
- ❌ 审批状态管理（status字段）

**原因：** 简化业务流程，权益变更立即生效，无需审批等待。

**注：** 原 6.6.2-6.6.7已完全移除，简化审计记录机制直接生效，无审批环节。

## 7. 状态机设计

### 7.1 合同状态机

```
┌─────────┐
│  draft  │ 草稿（初始状态 - 合同已创建但尚未签署）
└────┬────┘
     │
     │ sign() ← 合同签署完成（创建合同时自动执行）
     │ 当 createdAt 被设置且合同基本信息已确认
     │
     ▼
┌─────────┐
│ signed  │ 已签署（合同已签署，等待支付激活）
└────┬────┘
     │
     │ activate() ← 监听 payment.succeeded 事件
     │ 首付款支付成功后触发
     │
     ▼
┌─────────┐
│ active  │ 生效中（合同已激活，可消费服务）
└────┬────┘
     │
     ├────────────────────────────┐
     │                            │
     │ terminate(reason)          │ suspend(reason)
     │ 管理员操作                   │ 管理员操作
     │                            │
     ▼                            ▼
┌────────────┐              ┌────────────┐
│ terminated │              │ suspended  │
│ 已终止      │              │ 已暂停      │
└────────────┘              └──────┬─────┘
    （不可恢复）                    │
                                   │ resume()
                                   │ 管理员操作
                                   ▼
                              ┌─────────┐
                              │ active  │
                              └─────────┘
                                   │
                                   │ complete() ← 自动触发（服务消费完毕或过期）
                                   │ 定时任务检测自动完成
                                   │
                                   ▼
                              ┌───────────┐
                              │ completed │
                              │ 已完成     │
                              └───────────┘
```

**状态转换规则（v2.16.4 明确）：**

| 当前状态 | 事件/操作 | 目标状态 | 条件 | 触发方式 | 说明 |
|----------|-----------|----------|------|----------|------|
| draft | sign() | signed | 合同创建完成 | 自动触发 | 合同基本信息已确定 |
| signed | activate() | active | payment.succeeded | 事件监听 | 首付款支付成功后 |
| active | terminate(reason) | terminated | 提供终止原因 | 管理员操作 | 从 active 或 suspended 均可终止 |
| active | suspend(reason) | suspended | 提供暂停原因 | **仅管理员** | 临时暂停服务 |
| active | complete() | completed | **服务消费完毕 OR 已过期** | 自动触发 | 定时任务检测自动完成 |
| suspended | resume() | active | 恢复服务 | 管理员操作 | 从暂停状态恢复 |
| suspended | terminate(reason) | terminated | 提供终止原因 | 管理员操作 | 暂停期间也可终止 |

**状态转换详细说明：**

1. **创建合同（draft → signed）**
   - 触发时机：调用 `create()` 方法创建合同时自动完成
   - 执行操作：设置 `signedAt` 时间戳，发布 `contract.signed` 事件
   - 状态含义：合同已签署，等待学生支付首付款

2. **激活合同（signed → active）**
   - 触发时机：监听 `payment.succeeded` 事件（决策 #13）
   - 前置条件：首付款已成功支付
   - 执行操作：设置 `activatedAt`，从产品快照创建服务权益，发布 `contract.activated` 事件
   - 状态含义：合同已激活，学生可开始预约和消费服务

3. **暂停合同（active → suspended）**
   - 触发：管理员手动操作（决策 #13）
   - 前置条件：提供暂停原因
   - 执行操作：设置 `suspendedAt`，增加 `suspensionCount`，发布 `contract.suspended` 事件
   - 状态含义：临时暂停服务，学生不可预约新服务

4. **恢复合同（suspended → active）**
   - 触发：管理员手动操作
   - 执行操作：清空 `suspendedAt`，发布 `contract.resumed` 事件
   - 状态含义：恢复服务，学生可继续预约

5. **完成合同（active → completed）**
   - 触发：自动定时任务检测（决策 #13）
   - 条件：满足以下任一条件
     - ✅ 所有服务权益已消费完毕（`availableQuantity = 0`）
     - ✅ 合同已过期（`expiresAt < now()`）
   - 执行操作：设置 `completedAt`，发布 `contract.completed` 事件
   - 状态含义：合同正常结束，服务交付完成

6. **终止合同（active/suspended → terminated）**
   - 触发：管理员手动操作
   - 前置条件：提供终止原因
   - 执行操作：设置 `terminatedAt`，冻结所有权益（`availableQuantity = 0`），发布 `contract.terminated` 事件
   - 状态含义：合同提前终止，不再提供服务
| suspended  | terminate(reason)   | terminated | 提供终止原因                 | 管理员操作 |

**关键状态转换说明（v2.16.10）：**

1. **签署合同（draft → signed）**
   - 触发：调用 `create()` 方法创建合同时自动执行
   - 操作：设置 `signedAt` 时间戳，发布 `contract.signed` 事件（决策 D5）
   - 状态含义：合同基本信息已确定，等待学生支付首付款

2. **激活合同（signed → active）**
   - 触发：监听 `payment.succeeded` 事件（决策 D5）
   - 条件：首付款已成功支付
   - 操作：设置 `effectiveAt`、计算 `expiresAt`、初始化服务权益，发布 `contract.activated` 事件

3. **完成条件（active → completed）**
   - 触发：自动定时任务检测（决策 #13）
   - 条件：满足以下**任一条件**即自动完成
     - ✅ 所有服务权益已消费完毕（`availableQuantity = 0`）
     - ✅ 合同已过期（`expiresAt < now`）
   - 操作：更新状态为 `completed`

3. **暂停权限（active → suspended）**
   - 触发：管理员手动操作（决策 #13）
   - 条件：**仅管理员**有权限暂停合同
   - 目的：临时暂停服务（如学生请假、纠纷处理等）
   - 影响：暂停期间不可预约服务，但时间仍在流逝

**不允许的转换：**

- ❌ terminated → active（终止后不可恢复）
- ❌ completed → active（完成后不可恢复）
- ❌ draft → completed（草稿不能直接完成）

### 7.2 预占状态机【v2.16.9 重大简化 - 移除过期逻辑】

```
┌─────────┐
│ active  │ 生效中（初始状态）
└────┬────┘
     │
     ├────────────────────────────┐
     │                            │
     │ release('completed')       │ cancel('cancelled')
     │                            │
     ▼                            ▼
┌─────────────────┐    ┌─────────────────┐
│    released     │    │    cancelled    │
│ (服务已完成)    │    │ (用户已取消)    │
└─────────────────┘    └─────────────────┘
```

**状态转换规则（v2.16.9 更新）：**

| 当前状态 | 事件/操作                  | 目标状态 | 条件/说明                  |
| -------- | -------------------------- | -------- | -------------------------- |
| active   | release('completed')      | released | 服务完成                   |
| active   | cancel('cancelled')       | cancelled | 用户取消预约               |
| active   | release('admin_manual')   | released | 管理员手动释放（异常处理） |

**v2.16.9 重大变更：**
- ❌ **移除 `expired` 状态**（不再自动过期）
- ❌ **移除 TTL 机制**（不再需要 expiresAt 字段）
- ✅ **预占永不过期**：必须通过 releaseHold() 或 cancelHold() 释放
- ✅ **所有状态转换均为人工触发**
- ✅ `cancelled` 状态用于区分取消操作

**不允许的转换：**
- ❌ released → active（释放后不可恢复）
- ❌ cancelled → active（取消后不可恢复）
- ❌ active → active（重复释放抛异常）

**对比：before → after**

```
Before (v2.16.8):
┌─────────┐
│ active  │ ← expiresAt = createdAt + 15min
└────┬────┘
     ├─→ released  (人工)
     ├─→ cancelled (人工)
     └─→ expired   (定时任务)

After (v2.16.9):
┌─────────┐
│ active  │ ← 永不过期
└────┬────┘
     ├─→ released  (人工)
     └─→ cancelled (人工)

     // 没有 expired 状态，没有定时任务
```

---

## 8. 实施指南

### 8.1 命名约定（Naming Conventions）

**目的：** 提高编码准确性和团队理解一致性

#### 8.1.1 数据库命名规范

**表名和列名：** snake_case（小写下划线）

```sql
-- 表名
contracts
contract_service_entitlements
service_ledgers

-- 列名
contract_id
service_type
created_at
updated_at
expires_at
```

**枚举类型：** snake_case

```sql
-- 枚举类型名称
contract_status
entitlement_source
service_unit

-- 枚举值
'draft', 'active', 'completed', 'terminated', 'suspended'
'product', 'addon', 'promotion', 'compensation'
'times', 'hours', 'sessions', 'days', 'minutes'
```

#### 8.1.2 TypeScript 命名规范

**接口和类型：** PascalCase

```typescript
interface Contract { ... }
interface ContractServiceEntitlement { ... }
type ProductItemType = 'service' | 'service_package';
enum ContractStatus { ... }
```

**变量和属性：** camelCase

```typescript
const contractId = '...';
const serviceType = 'External'; // 引用 service_types.code
const createdAt = new Date();

// DTO 属性
interface CreateContractDto {
  studentId: string;
  productSnapshot: IProductSnapshot;
  totalAmount?: string;
}
```

**常量和枚举值：** UPPER_SNAKE_CASE 或 PascalCase（枚举）

```typescript
const MAX_CONTRACT_AMOUNT = 100000;
// const DEFAULT_TTL_MINUTES = 15;  // v2.16.9: 已废弃，移除TTL机制

enum ContractStatus {
  Draft = 'draft',
  Active = 'active',
  Completed = 'completed',
}
```

#### 8.1.3 Drizzle ORM 自动转换

Drizzle ORM 会自动处理数据库和 TypeScript 之间的命名转换：

```typescript
// Schema 定义（数据库：snake_case）
export const contracts = pgTable('contracts', {
  serviceType: varchar('service_type', { length: 100 }),  // 数据库列名
  createdAt: timestamp('created_at'),                      // 数据库列名
});

// TypeScript 使用（代码：camelCase）
const contract = await db.query.contracts.findFirst({
  where: (c) => eq(c.serviceType, 'gap_analysis'),  // TypeScript 属性名
});

console.log(contract.serviceType);  // camelCase
console.log(contract.createdAt);    // camelCase
```

#### 8.1.4 文件命名规范

**Schema 文件：** kebab-case + `.schema.ts`

```
contracts.schema.ts
contract-service-entitlements.schema.ts
service-ledgers.schema.ts
service-type.enum.ts
```

**Service 文件：** kebab-case + `.service.ts`

```
contract.service.ts
service-ledger.service.ts
service-hold.service.ts
```

**DTO 文件：** kebab-case + `.dto.ts`

```
create-contract.dto.ts
service-balance-query.dto.ts
consume-service.dto.ts
```

#### 8.1.5 重要提醒

⚠️ **数据库 vs TypeScript 的对应关系：**

| 数据库（SQL）      | TypeScript（代码） | 说明                     |
|-------------------|-------------------|-------------------------|
| `service_type`    | `serviceType`     | Drizzle 自动转换        |
| `created_at`      | `createdAt`       | Drizzle 自动转换        |
| `expires_at`      | `expiresAt`       | Drizzle 自动转换        |
| `contract_status` | `ContractStatus`  | 枚举类型（PascalCase）  |

✅ **最佳实践：**
- Schema 定义时：使用数据库命名（snake_case）
- TypeScript 代码中：使用 camelCase 访问属性
- 类型和接口：使用 PascalCase
- 文件命名：使用 kebab-case

---

---

## 8. 架构设计决策清单（v2.16.12 重构）

> **审查日期：** 2025-11-11
> **状态：** ✅ **所有决策已完成（4/4）**
> **优先级：** 🔴 高（影响数据一致性）

### ⚠️ 新发现的问题（需要立即决策）

#### **D-NEW-1: 触发器 INSERT 分支可能导致数据不一致** 🔴 ✅ 已决策

**问题描述：**
`trigger_ledger_insert` 触发器的 INSERT 分支（当 contract_service_entitlements 记录不存在时）会创建新记录，但初始值 `consumed_quantity=0, held_quantity=0` 可能导致数据不一致。如果学生已有来自其他合同的权益（已有消费或预占），这些数据会丢失。

**场景示例：**
```sql
-- 合同1初始权益（应用层创建）
contract_service_entitlements:
  student_id='stu-001', service_type='session',
  total_quantity=5, consumed_quantity=2, held_quantity=1,
  available_quantity=2

-- 合同2额外权益（应用层插入到 ledgers）
-- 如果触发器 INSERT 新记录：
contract_service_entitlements:
  student_id='stu-001', service_type='session',
  total_quantity=3, consumed_quantity=0, held_quantity=0,  -- ❌ 数据丢失！
  available_quantity=3
```

**两个解决方案：**
- ✅ **方案A：** 触发器只执行 UPDATE，不执行 INSERT。如果记录不存在，抛异常
  - ✅ 强制要求：初始权益必须通过应用层显式创建
  - ✅ 强制要求：额外权益只能在初始权益之后添加
  - ⚠️ 增加应用层负担（必须先查询记录是否存在）
  - **决策结果：已采纳** ✅

- **方案B：** 触发器创建记录前，查询现有消费和预占数量
  - ❌ 性能开销大（需要 JOIN 查询）
  - ❌ 逻辑复杂（需要聚合所有相关记录）

**影响：** 需要在触发器中移除 INSERT 分支，仅保留 UPDATE 逻辑
**后续行动：** 更新触发器 SQL 定义（见 3.2 节）

---

#### **D-NEW-2: 初始权益如何初始化？** 🟡 ✅ 已决策

**问题描述：**
v2.16.10 决策：ledgers 表只记录"额外权益"（addon/promotion/compensation），不记录初始权益。
那么初始权益（从 product_snapshot 派生）如何初始化？

**两个方案：**
- ✅ **方案A：** 应用层直接 INSERT 到 contract_service_entitlements
  - ✅ 职责清晰：ledgers 只记录额外变更
  - ✅ 避免触发器复杂性
  - ✅ 初始化逻辑在应用层，易于调试
  - **决策结果：已采纳** ✅

- **方案B：** 走 ledgers 表，ledger_type = 'initial'
  - ✅ 所有权益变更都通过统一入口
  - ✅ 完整的审计追溯（包括初始权益）
  - ❌ 与 v2.16.10 决策冲突（ledgers 只记录额外权益）

**实施说明：**
- 创建合同时，应用层直接从 `product_snapshot` 派生权益并 INSERT 到 `contract_service_entitlements`
- **不**通过 `contract_amendment_ledgers` 表（ledgers 仅记录后续额外添加的权益）
- 后续通过 `addEntitlement()` 添加额外权益时，才 INSERT 到 ledgers 表并触发触发器

**示例流程：**
```
1. 创建合同
   → 应用层解析 product_snapshot
   → INSERT INTO contract_service_entitlements (total=5, available=5)
   → ✅ 触发器不执行（未操作 ledgers 表）

2. 后续添加额外权益
   → 应用层调用 addEntitlement()
   → INSERT INTO contract_amendment_ledgers (quantity_changed=2)
   → 触发器自动执行
   → UPDATE contract_service_entitlements SET total += 2, available += 2
```

---

---

#### **D-NEW-3: 合同终止后权益是否保留？** 🔴 ✅ 已决策

**问题描述：**
新架构（学生级累积制）中，合同终止后权益继续保留在 contract_service_entitlements 表中，只是不再增加新权益。

**需要确认：**
- 业务上是否接受合同终止后学生仍能使用剩余权益？
- 是否需要区分主动终止（违约）和正常完成（completed）的权益处理方式？
- 是否需要管理员手动冻结权益？

**示例场景：**
- 学生购买5次服务，使用3次后违约终止合同
- 剩余2次权益是否应该保留？还是可以继续使用？

**两个方案：**
- **方案A：** 合同终止后权益继续保留（当前设计）
  - ✅ 架构简单
  - ✅ 学生体验好（已付费的权益可继续使用）
  - ⚠️ 可能需要业务规则限制（如限制服务类型）

- ✅ **方案B：** 合同终止后冻结所有权益（available_quantity = 0）
  - ✅ 符合合同终止的严格定义
  - ✅ 防止权益滥用（特别是违约情况）
  - ✅ 区分 terminated（终止）和 completed（完成）的状态处理
  - ❌ 需要对 contract_service_entitlements 增加触发器（监听 contracts 状态变更）
  - ❌ 增加系统复杂度
  - **决策结果：已采纳** ✅

**实施说明（方案B）：**
添加触发器监听 `contracts` 表状态变更：
```sql
-- 触发器：合同终止时冻结权益
CREATE TRIGGER trigger_contract_terminated
  AFTER UPDATE OF status ON contracts
  FOR EACH ROW
  WHEN (NEW.status = 'terminated' AND OLD.status != 'terminated')
  EXECUTE FUNCTION freeze_entitlements_on_termination();

-- 函数：冻结该合同学生的所有权益
CREATE FUNCTION freeze_entitlements_on_termination()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contract_service_entitlements
  SET
    available_quantity = 0,  -- 冻结权益
    updated_at = NOW()
  WHERE student_id = NEW.student_id;

  -- 记录冻结日志（可选）
  INSERT INTO entitlement_freeze_logs (student_id, contract_id, frozen_at, reason)
  VALUES (NEW.student_id, NEW.id, NOW(), 'contract_terminated');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**状态处理差异：**
| 合同状态 | 权益处理 | 说明 |
|----------|----------|------|
| `completed` | 无需处理（权益已用完） | 正常完成，权益自然耗尽 |
| `terminated` | 冻结权益（available=0） | 违约/提前终止，防止继续消费 |
| `expired` | 由业务规则决定（可配置） | 可清零、可延期、可转化 |

**业务流程示例：**
```
1. 学生违约，管理员终止合同
   → 调用 terminate() 方法
   → 更新 contracts.status = 'terminated'
   → 触发器自动执行：冻结所有权益（available=0）

2. 后续处理
   → 财务域处理退款（如有）
   → 学生无法继续使用服务（余额已为0）
   → 审计日志记录冻结操作
```

**业务规则说明：**
- 合同 `terminated` 状态表示违约或提前终止，学生不应继续享受服务
- 已付费但未使用的权益，由财务域根据退款政策处理
- 合同 `completed` 状态表示正常完成，权益自然用完，无需特殊处理

**后续行动：**
1. 添加触发器 `trigger_contract_terminated`
2. 创建冻结日志表 `entitlement_freeze_logs`（可选，用于审计）
3. 在 `terminate()` 方法中添加触发器调用说明

---

#### **D-NEW-4: 触发器 vs 应用层：平衡选择？** 🟡 ✅ 已决策

**问题描述：**
当前设计重度依赖触发器，虽然保证了数据一致性，但带来以下问题：

**触发器的缺点：**
- ❌ 调试困难（黑盒操作）
- ❌ 业务逻辑分散（数据库 + 应用层）
- ❌ 性能开销（每次 INSERT 都触发）
- ❌ 测试复杂（需要真实数据库环境）
- ❌ 版本控制困难（SQL 脚本与代码分离）

**触发器的优点：**
- ✅ 强一致性保证（原子性）
- ✅ 避免应用层忘记同步
- ✅ 性能优化（减少网络往返）

**备选方案：**
在应用层使用 Repository 模式 + 事务封装：
```typescript
async addEntitlement(dto) {
  return await db.transaction(async (tx) => {
    // 1. 查询现有权益（FOR UPDATE 锁定）
    const entitlement = await tx.query...

    // 2. 插入 ledger 记录
    await tx.insert(contractEntitlementLedgers).values(...)

    // 3. 更新权益余额
    await tx.update(contractServiceEntitlements)
      .set({
        totalQuantity: entitlement.totalQuantity + dto.quantity,
        availableQuantity: entitlement.availableQuantity + dto.quantity
      })

    // 4. 事务提交（全部成功或全部回滚）
  })
}
```

**优缺点对比：**
- ✅ 逻辑集中在应用层，易于调试和维护
- ✅ 代码审查更容易
- ✅ 单元测试可以 mock 数据库
- ❌ 需要开发者记住每次都调用更新方法
- ❌ 可能有性能损失（需要 SELECT）

**三个方案：**
- ✅ **方案A：** 保持当前纯触发器方案
  - ✅ 强一致性保证，不会遗漏
  - ⚠️ 调试困难，逻辑分散
  - **决策结果：已采纳** ✅

- **方案B：** 改用应用层事务 + Repository 模式
  - ✅ 逻辑集中，易调试
  - ❌ 容易因开发者疏忽导致数据不一致

- **方案C：** 混合方案（关键路径用触发器，其他用应用层）
  - ⚠️ 增加复杂度，两种模式并存

**决策理由（方案A）：**
1. **核心优势**：触发器保证强一致性，开发者无法绕过数据同步
2. **D-NEW-1 已解决**：移除 INSERT 分支，避免数据不一致问题
3. **性能更优**：避免额外的 SELECT 查询和网络往返
4. **可靠性高**：数据库层面保证，不受应用层 Bug 影响
5. **缺点缓解**：完善的测试、监控、文档可以弥补调试困难

**实施建议：**
- 保持纯触发器方案（已在 3.1-3.3 节定义）
- 编写完整的触发器测试用例
- 添加触发器执行监控（执行次数、错误率）
- 文档中明确触发器逻辑和业务规则

**后续行动：**
1. 完善触发器单元测试
2. 添加执行监控
3. 编写触发器调试指南

---

### **📋 决策总结**

所有 v2.16.12 重构相关的架构决策已完成：

| 编号 | 决策项 | 选择方案 | 影响 | 状态 |
|------|--------|----------|------|------|
| **D-NEW-1** | 触发器 INSERT 分支问题 | ✅ 方案A：仅 UPDATE，抛异常 | 数据一致性 | 已决策 |
| **D-NEW-2** | 初始权益初始化 | ✅ 方案A：应用层 INSERT | 职责清晰 | 已决策 |
| **D-NEW-3** | 合同终止后权益处理 | ✅ 方案B：冻结权益 | 业务合规 | 已决策 |
| **D-NEW-4** | 触发器 vs 应用层 | ✅ 方案A：保持触发器 | 架构稳定 | 已决策 |

**所有决策已达成一致，设计文档更新完成！**

**后续实施重点：**
1. 更新触发器 SQL 脚本（移除 INSERT 分支）
2. 添加合同终止触发器（冻结权益）
3. 完善单元测试和集成测试
4. 配置触发器执行监控

---

## 9. 设计文档与代码实现差异分析

> **版本：** v2.16.12
> **审查日期：** 2025-11-11
> **状态：** ⚠️ **发现新问题，需要追加决策**
```
src/infrastructure/database/
├── migrations/
│   ├── sql/                          # 独立 SQL 脚本（⭐️ 选项 A - 推荐）
│   │   ├── contract_number_generator.sql          # 合同编号生成函数（Sequence + Advisory Lock）
│   │   │   - 函数名称：generate_contract_code()
│   │   │   - 格式：CONTRACT-YYYY-MM-NNNNN
│   │   │   - 使用：SELECT generate_contract_code()
│   │   │   - 特性：Monthly reset, Advisory Lock 保证并发安全
│   │   │
│   │   ├── contract_triggers.sql                     # 数据库触发器
│   │   │   - sync_held_quantity()                    # 同步预占数量（v2.16.5 决策 C-NEW-2）
│   │   │   - sync_consumed_quantity()                # 同步消费数量（如有需要）
│   │   │   - 触发器绑定：service_holds 表 (INSERT/UPDATE)
│   │   │
│   │   ├── contract_indexes.sql                      # 索引（约 30 个）
│   │   │   - 覆盖所有高频查询场景
│   │   │   - 包含复合索引、partial index
│   │   │   - 命名规范：idx_<表名>_<字段1>_<字段2>
│   │   │
│   │   ├── contract_constraints.sql                  # CHECK 约束（约 20 个）
│   │   │   - 命名规范：chk_<表名>_<字段>_<类型>
│   │   │   - 示例：chk_contracts_paid_amount_not_exceed_total
│   │   │
│   │   ├── contract_amendment_revisions_indexes.sql      # 修订表索引（9个）🆕v2.16.8
│   │   └── contract_amendment_revisions_constraints.sql  # 修订表CHECK约束（2个）🆕v2.16.8
│   │
│   ├── 0000_initial.sql                      # Drizzle 自动生成的表结构迁移
│   ├── 0001_contract_tables.sql              # contract 相关表
│   └── 0002_add_contract_amendment_revisions.sql  # 修订表迁移
│
└── schema/                                   # TypeScript Schema 定义
    ├── contracts.schema.ts
    ├── contract-service-entitlements.schema.ts
    ├── contract-amendment-ledgers.schema.ts  # 🆕v2.16.8
    └── ...
```

**实施方式（决策 I7 - 选项 A）：**

| 实施步骤 | 工具/命令 | 说明 |
|---------|----------|------|
| 1. 生成表结构迁移 | `npm run db:generate` | Drizzle Kit 自动生成 |
| 2. 创建 SQL 脚本 | 手动创建 | 按照上述文件结构 |
| 3. 执行 SQL 脚本 | `psql -d db -f script.sql` | 手动逐一执行 |
| 4. 运行迁移 | `npm run db:migrate` | 执行 Drizzle 迁移 |

**为什么选择独立 SQL 文件（选项 A）：**

✅ **优势：**
1. **职责清晰**：函数、触发器、索引、约束与表结构分离
2. **版本控制**：SQL 文件独立版本控制，DBA 可以直接审核
3. **易于维护**：DBA 可以单独修改 SQL 脚本，无需理解 TypeScript 代码
4. **审核友好**：安全审计时，DBA 只需审核 SQL 文件
5. **部署灵活**：可以单独部署函数和约束，不影响表结构迁移
6. **语法高亮**：SQL 文件在编辑器中有完整语法高亮和验证

⚠️ **注意事项：**
1. **部署顺序**：必须先执行表结构迁移，再执行 SQL 脚本（函数、索引、约束）
2. **人为错误**：需要手动执行 SQL 脚本，可能遗漏
3. **自动化**：建议编写部署脚本，自动化执行所有 SQL 文件

**自动化部署脚本示例：**
```bash
#!/bin/bash
# deploy-contract-db.sh

echo "🚀 部署 Contract Domain 数据库..."

# 1. 运行 Drizzle 迁移（表结构）
echo "📦 执行表结构迁移..."
npm run db:migrate

# 2. 执行 SQL 脚本（函数、触发器、索引、约束）
echo "🔧 执行 SQL 脚本..."

SQL_DIR="src/infrastructure/database/migrations/sql"

# 合同编号生成函数
echo "  - 合同编号生成函数..."
psql -d mentorx -f "$SQL_DIR/contract_number_generator.sql"

# 触发器
echo "  - 触发器..."
psql -d mentorx -f "$SQL_DIR/contract_triggers.sql"

# 索引
echo "  - 索引..."
psql -d mentorx -f "$SQL_DIR/contract_indexes.sql"

# CHECK 约束
echo "  - CHECK 约束..."
psql -d mentorx -f "$SQL_DIR/contract_constraints.sql"

# 修订表索引（v2.16.8）
echo "  - 修订表索引..."
psql -d mentorx -f "$SQL_DIR/contract_amendment_revisions_indexes.sql"

# 修订表约束（v2.16.8）
echo "  - 修订表约束..."
psql -d mentorx -f "$SQL_DIR/contract_amendment_revisions_constraints.sql"

echo "✅ 部署完成！"
```

**使用方式：**
```bash
# 一键部署
./scripts/deploy-contract-db.sh
```

---

### 8.2 环境变量配置（v2.16.4 决策 M3）

**目的：** 定义 Contract Domain 所需的环境变量

#### 8.2.1 服务预占（Service Holds）

```bash
# 预占过期时间（分钟）
CONTRACT_HOLD_TTL_MINUTES=15

# 预占清理任务（Cron 表达式）
# 每 5 分钟执行一次清理任务，释放过期预占
CONTRACT_HOLD_CLEANUP_CRON='*/5 * * * *'
```

**说明（v2.16.9）：**
- ❌ `CONTRACT_HOLD_TTL_MINUTES`: **已废弃** - 服务预占不再自动过期
- ❌ `CONTRACT_HOLD_CLEANUP_CRON`: **已废弃** - 移除自动清理任务
- ✅ **手动释放**：所有预占必须通过 `releaseHold()` 或 `cancelHold()` 显式释放
- ✅ **监控建议**：建议实现监控任务，定期检查长时间未释放的预占（如超过24小时）

#### 8.2.2 流水归档（Ledger Archive）

```bash
# 流水归档任务（Cron 表达式）
# 每天凌晨 2 点执行归档任务
CONTRACT_ARCHIVE_CRON='0 2 * * *'

# 归档阈值（天数）
# 超过 90 天的流水自动归档
CONTRACT_ARCHIVE_THRESHOLD_DAYS=90
```

**说明：**
- `CONTRACT_ARCHIVE_CRON`: 流水归档的定时任务
  - 建议在业务低峰期执行（凌晨 2-4 点）
  - 将超过阈值的流水移动到 `service_ledgers_archive` 表

- `CONTRACT_ARCHIVE_THRESHOLD_DAYS`: 归档阈值天数
  - 默认 90 天（3 个月）
  - 可根据数据量和性能需求调整

#### 8.2.3 合同编号生成

```bash
# 合同编号前缀
CONTRACT_NUMBER_PREFIX='CONTRACT'

# 合同编号格式
# 支持的格式变量：{PREFIX}-{YYYY}-{MM}-{NNNNN}
CONTRACT_NUMBER_FORMAT='{PREFIX}-{YYYY}-{MM}-{NNNNN}'
```

**说明：**
- `CONTRACT_NUMBER_PREFIX`: 合同编号前缀（默认 'CONTRACT'）
- `CONTRACT_NUMBER_FORMAT`: 合同编号格式（默认月度序列）
  - v2.16.4 决策 C5：采用 `CONTRACT-YYYY-MM-NNNNN` 格式
  - 月初自动重置序列号

#### 8.2.4 业务规则配置

```bash
# 总金额覆盖的最大折扣比例（百分比）
CONTRACT_MAX_DISCOUNT_PERCENTAGE=90

# 总金额覆盖的最大倍数
CONTRACT_MAX_PRICE_MULTIPLIER=2.0

# 是否允许免费合同（$0）
CONTRACT_ALLOW_FREE_CONTRACTS=false
```

**说明：**
- `CONTRACT_MAX_DISCOUNT_PERCENTAGE`: 最大折扣比例（默认 90%，即最低 10% 原价）
- `CONTRACT_MAX_PRICE_MULTIPLIER`: 最大价格倍数（默认 2.0，即最高 200% 原价）
- `CONTRACT_ALLOW_FREE_CONTRACTS`: 是否允许免费合同（默认 false，需要特殊权限）

#### 8.2.5 完整配置示例

```bash
# Contract Domain Environment Variables

# === Service Holds ===
CONTRACT_HOLD_TTL_MINUTES=15
CONTRACT_HOLD_CLEANUP_CRON='*/5 * * * *'

# === Ledger Archive ===
CONTRACT_ARCHIVE_CRON='0 2 * * *'
CONTRACT_ARCHIVE_THRESHOLD_DAYS=90

# === Contract Number Generation ===
CONTRACT_NUMBER_PREFIX='CONTRACT'
CONTRACT_NUMBER_FORMAT='{PREFIX}-{YYYY}-{MM}-{NNNNN}'

# === Business Rules ===
CONTRACT_MAX_DISCOUNT_PERCENTAGE=90
CONTRACT_MAX_PRICE_MULTIPLIER=2.0
CONTRACT_ALLOW_FREE_CONTRACTS=false
```

---

### 8.3 开发任务清单

#### Phase 1: 核心模块开发

- [ ] **创建 Contract Domain 目录结构**
  ```
  src/domains/sales/contract/
  ├── contract/                  # 合同管理
  │   ├── contract.service.ts
  │   ├── contract.repository.ts
  │   ├── contract.controller.ts
  │   └── dto/
  ├── service-entitlement/       # 服务权益管理
  │   ├── service-entitlement.service.ts
  │   └── dto/
  ├── service-ledger/            # 服务流水管理
  │   ├── service-ledger.service.ts
  │   ├── service-ledger.repository.ts
  │   └── dto/
  ├── service-hold/              # 服务预占管理
  │   ├── service-hold.service.ts
  │   ├── service-hold.repository.ts
  │   └── dto/
  ├── archive/                   # 归档管理
  │   ├── service-ledger-archive.service.ts
  │   └── dto/
  ├── amendment-ledger/      # 权益修改历史管理 🆕v2.16.8
  │   ├── entitlement-revision.service.ts
  │   └── dto/
  ├── events/                    # 事件监听器
  │   ├── listeners/
  │   └── handlers/
  └── contract.module.ts
  ```} .guist/system_sandbox/tool_use/Edit:0{

- [ ] **创建数据库 Schema**
  - [ ] `src/database/schema/contracts.schema.ts`
  - [ ] `src/database/schema/contract-service-entitlements.schema.ts`
  - [ ] `src/database/schema/service-ledgers.schema.ts`
  - [ ] `src/database/schema/service-holds.schema.ts`
  - [ ] `src/database/schema/service-ledgers-archive.schema.ts`
  - [ ] `src/database/schema/service-ledger-archive-policies.schema.ts`
  - [ ] `src/database/schema/enums/service-type.enum.ts`（统一枚举）

- [ ] **生成数据库迁移**
  ```bash
  npm run db:generate
  npm run db:migrate
  ```

- [ ] **实现 ContractService**
  - [ ] `create()` - 创建合同
  - [ ] `search()` - 查询合同列表
  - [ ] `findOne()` - 查询单个合同（支持多种查询条件）🆕v2.16.7
  - [ ] `update()` - 更新合同信息
  - [ ] `activate()` - 激活合同
  - [ ] `terminate()` - 终止合同
  - [ ] `suspend()` - 暂停合同 🆕v2.16.4
  - [ ] `resume()` - 恢复合同 🆕v2.16.4
  - [ ] `complete()` - 完成合同 🆕v2.16.4
  - [ ] `getServiceBalance()` - 查询服务权益余额
  - [ ] `consumeService()` - 扣减服务权益
  - [ ] `addEntitlement()` - 添加额外权益 🆕v2.16 (自动记录修订历史)
  - [ ] `getAmendmentLedgers()` - 查询权益修改历史 🆕v2.16.8

- [ ] **实现 ServiceLedgerService**
  - [ ] `recordConsumption()` - 记录服务消费
  - [ ] `recordAdjustment()` - 记录手动调整
  - [ ] `calculateAvailableBalance()` - 计算可用余额
  - [ ] `queryLedgers()` - 查询流水记录
  - [ ] `verifyBalance()` - 验证余额对账

- [ ] **实现 ServiceHoldService**
  - [ ] `createHold()` - 创建预占
  - [ ] `releaseHold()` - 释放预占
  - [ ] `cleanupExpiredHolds()` - 清理过期预占（定时任务）
  - [ ] `findActiveHolds()` - 查询活跃预占
  - [ ] `extendHold()` - 延长预占时间

- [ ] **实现 ServiceLedgerArchiveService**
  - [ ] `archiveOldLedgers()` - 执行归档任务
  - [ ] `getArchivePolicy()` - 查询归档策略
  - [ ] `setArchivePolicy()` - 设置归档策略
  - [ ] `queryLedgersWithArchive()` - 跨表查询流水

#### Phase 2: 事件集成

- [ ] **实现事件监听器**
  - [ ] `PaymentSucceededListener` - 监听 payment.succeeded，激活合同
  - [ ] `SessionCompletedListener` - 监听 session.completed，扣减权益
  - [ ] `SessionCancelledListener` - 监听 session.cancelled，释放预占

- [ ] **实现事件发布**
  - [ ] `contract.signed` - 合同签订
  - [ ] `contract.activated` - 合同激活
  - [ ] `contract.terminated` - 合同终止
  - [ ] `service.consumed` - 服务消费

#### Phase 3: 定时任务

- [ ] **实现定时任务**
  - [ ] 清理过期预占（每 5 分钟）
  - [ ] 归档历史流水（每天凌晨 2:00）
  - [ ] 自动完成过期合同（每天凌晨 3:00）

#### Phase 4: 测试

- [ ] **单元测试**
  - [ ] ContractService 测试（13个方法）
  - [ ] ServiceLedgerService 测试
  - [ ] ServiceHoldService 测试
  - [ ] ServiceLedgerArchiveService 测试
  - [ ] AmendmentLedgerService 测试 🆕v2.16.8

- [ ] **集成测试**
  - [ ] 合同创建 → 激活 → 服务消费 → 完成（完整流程）
  - [ ] 额外权益添加测试（无审批，立即生效）🆕v2.16
  - [ ] 预占释放测试（手动释放）
  - [ ] 流水归档测试
  - [ ] 余额对账测试
  - [ ] 初始权益记录测试（应用层 INSERT）🆕v2.16.8
  - [ ] 额外权益修改记录测试（触发器自动更新）🆕v2.16.8
  - [ ] 权益修改历史查询测试（ledgers 表）🆕v2.16.8
  - [ ] 合同终止冻结权益测试（触发器）🆕v2.16.12 D-NEW-3

- [ ] **E2E 测试**
  - [ ] 顾问创建合同
  - [ ] 学生支付首付
  - [ ] 学生预约服务
  - [ ] 导师完成服务
  - [ ] 学生查询余额

---

## 9. 设计文档与代码实现差异分析

> **版本：** v2.16.10
> **审查日期：** 2025-11-11
> **状态：** ✅ **所有差异已决策（7 项）**
> **重要更新：** v2.16.10 大幅简化 `contract_amendment_ledgers` 表，移除审批流程和版本号追踪

本章节记录在代码实现过程中与设计文档的差异，并总结 D1-D7 决策结果。

---

### 9.1 核心差异汇总

| 编号 | 差异类型 | 设计文档 | 代码实现 | 优先级 | 决策结果 | 实施状态 |
|------|----------|----------|----------|--------|----------|----------|
| **D1** | 合同状态差异 | `draft` → `active` | `signed` → `active` | 🔴 高 | **方案A** | ⭕ 待实施 |
| **D2** | 方法缺失 | `suspend()`, `resume()`, `complete()` | ❌ 未实现 | 🔴 高 | **方案A** | ⭕ 待实施 |
| **D3** | 修订记录表名 | `contract_amendment_revisions` | `contract_amendment_ledgers` | 🟡 中 | **方案B** | ✅ 文档已更新 |
| **D4** | DTO 字段差异 | `addOnReason` | `reason` | 🟡 中 | **方案B** | ✅ 文档已更新 |
| **D5** | 事件监听器缺失 | `payment.succeeded`, `session.completed` | ❌ 未实现 | 🟡 中 | **方案B** | ⭕ 推迟 |
| **D6** | 事务支持差异 | `createHold(dto, tx?)` | 部分支持 | 🟢 低 | **方案A** | ⭕ 待实施 |
| **D7** | 状态检查差异 | 严格的验证规则 | 实现较宽松 | 🟢 低 | **方案B** | ⭕ 保持现状 |

#### v2.16.10 重大架构简化

| 变更项 | 变更前 (v2.16.9) | 变更后 (v2.16.10) | 影响 |
|--------|------------------|-------------------|------|
| **审批流程** | 需要管理员审批（R6决策） | ❌ **完全移除** | 权益变更立即生效 |
| **版本号追踪** | revisionNumber 全局递增 | ❌ **完全移除** | 无需版本管理 |
| **状态管理** | status: pending/approved/rejected/applied | ❌ **完全移除** | 变更即生效 |
| **制衡机制** | requiresApproval, approvedBy, approvedAt, approvalNotes | ❌ **完全移除** | 简化业务逻辑 |
| **字段数量** | 21个字段 | ✅ **15个字段** | 减少28.6%字段数 |
| **索引数量** | 9个索引 | ✅ **5个索引** | 减少44.4%索引数 |
| **CHECK约束** | 2个约束 | ✅ **1个约束** | 减少50%约束数 |

**核心决策：** 将 `contract_amendment_ledgers` 从"版本管理系统"简化为"审计日志系统"

---

### 9.2 差异修复决策（v2.16.10）

#### 🔴 高优先级（必须修复）

**D1: 合同状态差异** - **方案A（修改代码）**
- 实施方式：增加 `draft` 状态，完善状态机（draft → signed → active）
- 工作量：2-3 天
- 影响：高（需要数据库迁移和代码修改）
- 风险：影响现有业务流程

**D2: 合同状态管理方法缺失** - **方案A（完整实现）**
- 实施方式：实现 `suspend()`, `resume()`, `complete()` 方法
- 工作量：2-3 天
- 影响：高（合同生命周期完整性）
- 依赖：需要 D1 完成后实施

#### 🟡 中优先级（建议修复）

**D6: 事务支持完善** - **方案A（添加 tx 参数）**
- 实施方式：所有关键 Service 方法添加可选事务参数
- 工作量：1 天
- 影响：中（数据一致性）
- 收益：支持原子性操作

**D3 & D4: 代码与文档对齐** - **方案B（文档更新）**
- D3: 表名从 `revisions` → `ledgers`（与代码一致）
- D4: 字段从 `addOnReason` → `reason`（与代码一致）
- 状态：✅ 文档已完成更新

#### 🟢 低优先级（保持现状）

**D7: 状态验证宽松** - **方案B（暂不优化）**
- 决策：保持现有实现，根据测试反馈再决定是否加强验证
- 工作量：0 天
- 理由：当前实现基本可用，过早优化可能增加复杂度

---

### 9.3 实施建议

**阶段一（第 1 周）：核心状态机**
1. 实施 D1：添加 `draft` 状态
2. 实施 D2：实现 `suspend()`, `resume()`, `complete()`

**阶段二（第 2 周）：事务支持**
3. 实施 D6：完善所有 Service 的事务支持
4. 补充相关单元测试

**阶段三（后续版本）：架构优化**
5. 考虑实施 D5：事件监听器（v3.x）
6. 评估 D7：加强状态验证（根据业务需求）

**注意事项：**
- D3 和 D4 已通过文档更新解决，无需代码修改
- D5 推迟到后续版本，降低当前开发复杂度
- D7 保持现状，避免过度工程

