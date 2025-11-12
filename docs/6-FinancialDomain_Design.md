# Financial Domain (财务域) 详细设计文档

> 版本：v2.21
> 最后更新：2025-11-12
> 状态：设计完成
> 负责域：**Financial Domain** (AR + AP：Student Account, Payment, Mentor Billing, Settlement)

---

## 📋 文档目录

1. [域职责与架构](#1-域职责与架构)
2. [核心数据模型](#2-核心数据模型)
3. [服务接口清单](#3-服务接口清单)
4. [事件驱动设计](#4-事件驱动设计)
5. [业务流程](#5-业务流程)
6. [附录](#6-附录)

---

## 1. 域职责与架构

### 1.1 域职责划分

Financial Domain 是统一财务管理域，负责平台所有财务往来（学生付款 + 导师结算）。

```
┌────────────────────────────────────────────────────────────────┐
│                    Financial Domain 职责                       │
└────────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Students (AR)   │  │  Mentors (AP)    │  │   Management     │
│  学生应收管理     │  │  导师应付管理     │  │    管理模块       │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│                  │  │                  │  │                  │
│ 🟢 Payment       │  │ 🔴 Billing       │  │ 📊 Stats         │
│   学生支付服务    │  │   导师计费服务    │  │   计费统计        │
│   · Payment      │  │   · Ledger       │  │                  │
│     Service      │  │   · Pricing      │  │                  │
│                  │  │                  │  │                  │
│ 🔵 Student       │  │ 🔴 Settlement    │  │                  │
│   Payment        │  │   导师结算服务    │  │                  │
│   Ledger         │  │   · Settlement   │  │                  │
│   学生支付流水    │  │   · Parameters   │  │                  │
│   · balanceAfter │  │   · Appeals      │  │                  │
│                  │  │                  │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### 1.2 核心数据归属

| 数据实体 | 代码路径 | 职责说明 |
|---------|---------|---------|
| **student_payment_ledgers** | `@domains/financial/payment` | 学生支付流水（财务确认模式，含balanceAfter余额快照）❗用户支付与导师激励是独立的财务流 |
| **mentor_payable_ledgers** | `@domains/financial/mentor-billing` | 导师应付账款流水（Append-only，支持负数调整，作为平台的成本） |
| **mentor_prices** | `@domains/financial/mentor-billing` | 导师定价配置（支持一对一、班课、阶段性三种定价模式） |
| **settlement_ledgers** | `@domains/financial/settlement` | 导师结算记录（含结算方式和手续费，保存完整参数快照） |
| **settlement_parameters** | `@domains/financial/settlement` | 结算参数（汇率、扣除、手续费率，支持每月多版本） |
| **settlement_appeals** | `@domains/financial/settlement` | 结算申诉（异议处理） |

**💡 财务流独立性说明（2025-11-12 决策）：**
- **学生 → 平台**：按合同金额支付（收入），存储在 `student_payment_ledgers`
- **平台 → 导师**：按 `mentor_prices` 支付激励（成本），存储在 `mentor_payable_ledgers`
- 这是两个独立的财务流，平台通过定价差异获取利润，无需记录差额

### 1.3 跨域协作模式


#### 1.3.1 事件驱动协作

**Contract → Financial** (支付触发合同激活)
```
Contract Domain
    │
    │ 发布事件: payment.succeeded
    │──────────────────────────────────────▶
    │                                      Financial Domain
    │                                      监听器处理
    │                                      创建收入记录
```

**Financial (Settlement) → Financial (Billing)** (结算完成更新状态)
```
Settlement Service
    │
    │ 发布事件: settlement.completed
    │──────────────────────────────────────▶
    │                                      Billing Service
    │                                      监听器处理
    │                                      更新 mentor_payable_ledgers.settlement_status
```

---

## 2. 核心数据模型

### 2.1 mentor_payable_ledgers (导师应付账款流水表)

**文件路径：** `src/infrastructure/database/schema/mentor-payable-ledgers.schema.ts`

**域归属：** Financial Domain

**核心特性：**
- **Append-only 模式**：只能 INSERT，禁止 UPDATE/DELETE
- 支持负数调整：处理 appeal 申诉时，可创建金额为负数的记录调整应付金额
- 仅记录导师服务和计费（顾问不参与收益分配）
- **支持两种服务类型**：1对1服务（关联 session）和班课服务（关联 class）

**💡 多服务模式支持（2025-11-12 新增）：**
- **1对1服务**：使用 `sessionId` 字段，关联 Services Domain 的 sessions 表
- **班课服务**：使用 `classId` 字段，关联 Services Domain 的 classes 表
- **互斥约束**：`sessionId` 和 `classId` 只能有一个有值（应用层保证）
- **查询方式不同**：1对1按 `studentId` 查询，班课按 `classId` 查询

```typescript
export const mentorPayableLedgers = pgTable('mentor_payable_ledgers', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 新增：班课关联（跨域引用 Services Domain，注释外键，2025-11-12）
  // 与 sessionId 互斥：班课服务使用 classId，1对1服务使用 sessionId
  classId: uuid('class_id'), // 注释外键：关联 Services Domain 的 classes 表

  // 原有：1对1服务关联
  sessionId: uuid('session_id'), // 注释外键：关联 Services Domain 的 sessions 表

  mentorId: uuid('mentor_id').notNull().references(() => users.id),
  studentId: uuid('student_id').notNull().references(() => users.id),

  // 服务信息
  serviceType: serviceTypeEnum('service_type').notNull(),
  serviceName: varchar('service_name', { length: 500 }),

  // 计费信息
  quantity: integer('quantity').notNull().default(1), // 服务数量（支持负数调整）
  adjustmentReason: varchar('adjustment_reason', { length: 500 }), // quantity为负数时必填

  // 金额字段（遵循精度规范）
  unitPrice: numeric('unit_price', { precision: 12, scale: 1 }).notNull(), // 单价保留1位小数
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(), // 总额保留2位小数
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),

  // 阶段性计费（如内推）
  stageName: varchar('stage_name', { length: 200 }), // 阶段名称

  // 服务状态
  status: serviceStatusEnum('status').notNull().default('pending'),

  // 结算状态（v2.18更新）
  settlementStatus: settlementStatusEnum('settlement_status').notNull().default('pending'),
  settledAt: timestamp('settled_at', { withTimezone: true }),
  settlementId: uuid('settlement_id').references(() => settlement_ledgers.id),

  // 时间
  serviceCompletedAt: timestamp('service_completed_at', { withTimezone: true }).notNull(),

  // 备注
  notes: text('notes'),
  metadata: json('metadata'),

  // 审计字段（Append-only: 无需 updatedAt）
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
});
```

**字段说明：**

| 字段 | 类型 | 说明 |
|-----|------|------|
| `quantity` | integer | 服务数量（正数=正常服务，负数=申诉调整） |
| `unitPrice` | numeric(12,1) | 单价（美元，保留1位小数） |
| `totalAmount` | numeric(12,2) | 总额（美元，精确到分） |
| `settlementStatus` | enum | pending/processing/settled/on_hold/failed |
| `adjustmentReason` | varchar | 调整原因（quantity为负时必填） |

**使用场景：**

1. **服务完成后创建计费记录**
```typescript
// Session 完成时自动创建
{
  sessionId: 'session-uuid-1',
  mentorId: 'mentor-uuid-1',
  studentId: 'student-uuid-1',
  serviceType: 'gap_analysis',
  serviceName: 'GAP分析',
  quantity: 1,  // 正数
  unitPrice: 150.0,  // $150/小时
  totalAmount: 150.00,
  status: 'pending',
  settlementStatus: 'pending',
  serviceCompletedAt: new Date('2025-11-10T14:00:00Z'),
}
```

2. **申诉通过后创建负数调整记录**
```typescript
// Appeal 审核通过后创建
{
  sessionId: 'session-uuid-1',
  mentorId: 'mentor-uuid-1',
  studentId: 'student-uuid-1',
  serviceType: 'gap_analysis',
  serviceName: 'GAP分析',
  quantity: -1,  // 负数，表示扣减
  adjustmentReason: '申诉通过：服务未完成，全额退款',
  unitPrice: 150.0,
  totalAmount: -150.00,  // 负数金额
  status: 'refunded',
  settlementStatus: 'pending',
  serviceCompletedAt: new Date('2025-11-10T14:00:00Z'),
}
```

### 2.2 student_payment_ledgers (学生支付流水表)

**文件路径：** `src/infrastructure/database/schema/student-payment-ledgers.schema.ts`

**核心特性：**
- **财务确认模式**：不对接第三方支付平台
- 学生在第三方系统（银行）完成支付
- 财务在第三方系统确认到账后，在本系统确认
- **余额快照**：balanceAfter 记录每次支付后的剩余欠款（v2.21新增）

```typescript
export const student_payment_ledgers = pgTable('student_payment_ledgers', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 支付编号
  paymentNumber: varchar('payment_number', { length: 100 }).notNull().unique(),

  // 关联信息
  studentId: uuid('student_id').notNull().references(() => users.id),

  // 流水类型 (v2.21)
  ledgerType: paymentLedgerTypeEnum('ledger_type').notNull(),

  // 支付金额
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(), // 支付金额（美元）
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),

  // 余额快照 (v2.21)
  balanceAfter: numeric('balance_after', { precision: 12, scale: 2 }).notNull(),

  // 支付方式
  paymentMethod: paymentMethodEnum('payment_method').notNull(),

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
});
```

**流水类型枚举：**

```typescript
export const paymentLedgerTypeEnum = pgEnum('payment_ledger_type', [
  'initial_payment',   // 首付款
  'installment',       // 分期付款
  'final_payment',     // 尾款
  'top_up',            // 补款
  'refund',            // 退款（负数金额）
  'adjustment',        // 调整（可正可负）
]);
```

**💡 关于平台赠送/贷记的决策（2025-11-12）：**
- ❌ **不支持贷记类型**：`student_payment_ledgers` **不**包含 `credit` 类型
- ✅ **在 Contract 层处理**：如果平台需要赠送金额，直接调整合同金额
- ✅ **保持财务流水纯粹性**：`student_payment_ledgers` 只记录真实的资金流动
- **示例**：合同金额 $10,000，平台赠送 $500 → 合同金额调整为 $9,500

**使用场景：**

1. **合同首付款支付**
```typescript
{
  paymentNumber: "PAY-2025-11-00001",
  studentId: "student-uuid-1",
  ledgerType: "initial_payment",
  amount: 3000.00,  // $3,000
  balanceAfter: 7000.00,  // 支付后剩余 $7,000
  paymentMethod: "bank_transfer",
  status: "succeeded",
  confirmedBy: "finance-staff-uuid-1",
  confirmedAt: new Date("2025-11-03T14:30:00Z"),
}
```

### 2.3 mentor_prices (导师定价配置表)

**文件路径：** `src/infrastructure/database/schema/mentor-prices.schema.ts`

**核心特性：**
- 支持三种定价模式：一对一服务、班课服务、阶段性服务（2025-11-12 决策）
- 按导师 + 服务类型分别定价
- 价格历史版本控制（effectiveFrom/effectiveUntil）

**三种定价模式说明：**

**模式 1：一对一服务**
- 使用 `unitPrice` 字段
- 例如：GAP 分析、简历修改、1对1辅导
- 价格按次计算

**模式 2：班课服务**
- 在创建班课（courses/classes）时为每位导师制定价格
- 我理解需要新增 `class_mentor_prices` 表（请确认）
- 每位导师在班课中的价格可能不同

**模式 3：阶段性服务**
- 使用 `pricingType = 'staged'`
- 每个阶段一条价格记录
- 例如：内推服务（简历提交 $300 + 面试 $500 + Offer $1200）

```typescript
export const mentorPrices = pgTable('mentor_prices', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 关联导师
  mentorId: uuid('mentor_id').notNull().references(() => users.id),

  // 服务类型和定价类型
  serviceType: serviceTypeEnum('service_type').notNull(),
  pricingType: pricingTypeEnum('pricing_type').notNull(), // per_service/package/staged

  // 定价信息（单位价格）
  unitPrice: numeric('unit_price', { precision: 12, scale: 1 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),

  // 服务包计费配置（pricingType = 'package'）
  packageName: varchar('package_name', { length: 200 }),
  packageQuantity: integer('package_quantity'),
  packagePrice: numeric('package_price', { precision: 12, scale: 2 }),

  // 阶段性计费配置（pricingType = 'staged'）
  stageName: varchar('stage_name', { length: 200 }),

  // 状态和时间范围
  isActive: boolean('is_active').notNull().default(true),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }),
  effectiveUntil: timestamp('effective_until', { withTimezone: true }),

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

**定价类型枚举：**

```typescript
export const pricingTypeEnum = pgEnum('pricing_type', [
  'per_service',  // 按次计费
  'package',      // 服务包计费
  'staged',       // 阶段性计费
]);
```

**使用场景：**

1. **按次计费（GAP分析）**
```typescript
{
  mentorId: "mentor-uuid-1",
  serviceType: "gap_analysis",
  pricingType: "per_service",
  unitPrice: 150.0,
  currency: "USD",
  isActive: true,
}
```

2. **服务包计费（简历修改10次包）**
```typescript
{
  mentorId: "mentor-uuid-1",
  serviceType: "resume_review",
  pricingType: "package",
  packageName: "10次包",
  packageQuantity: 10,
  packagePrice: 800.00,  // 平均单价 $80
  unitPrice: 80.0,
  currency: "USD",
  isActive: true,
}
```

3. **阶段性计费（内推三阶段）**
```typescript
// 需要创建3条记录，每条对应一个阶段
{
  mentorId: "mentor-uuid-1",
  serviceType: "internal_referral",
  pricingType: "staged",
  stageName: "简历提交",
  unitPrice: 300.0,
  currency: "USD",
  isActive: true,
}
```

### 2.4 settlement_ledgers (结算记录表)

**文件路径：** `src/infrastructure/database/schema/settlement-ledgers.schema.ts`

**核心特性：**
- **财务确认模式**：财务在第三方系统完成支付后，在本系统确认
- 实时计算应付金额（基于 mentor_payable_ledgers + 结算参数）
- 支持多币种结算（汇率转换）
- 记录结算方式和手续费（v2.18）

```typescript
export const settlementLedgers = pgTable('settlement_ledgers', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 结算编号
  settlementNumber: varchar('settlement_number', { length: 100 }).notNull().unique(),

  // 关联信息
  mentorId: uuid('mentor_id').notNull().references(() => users.id),
  settlementMonth: varchar('settlement_month', { length: 7 }).notNull(), // YYYY-MM

  // 结算金额（原始金额，美元）
  grossAmount: numeric('gross_amount', { precision: 12, scale: 2 }).notNull(),

  // 扣除项（快照）
  platformFee: numeric('platform_fee', { precision: 12, scale: 2 }).notNull(),
  platformFeeRate: numeric('platform_fee_rate', { precision: 5, scale: 4 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 4 }).notNull(),

  // 结算方式和手续费 (v2.18)
  settlementMethod: settlementMethodEnum('settlement_method').notNull(),
  handlingFee: numeric('handling_fee', { precision: 12, scale: 2 }).notNull().default('0'),
  handlingFeeRate: numeric('handling_fee_rate', { precision: 5, scale: 4 }),

  // 实际结算金额（扣除后）
  netAmount: numeric('net_amount', { precision: 12, scale: 2 }).notNull(),

  // 币种转换
  settlementCurrency: varchar('settlement_currency', { length: 3 }).notNull(),
  exchangeRate: numeric('exchange_rate', { precision: 10, scale: 6 }).notNull(),
  settlementAmount: numeric('settlement_amount', { precision: 12, scale: 2 }).notNull(),

  // 关联的服务记录
  billingLedgerIds: json('billing_ledger_ids').$type<string[]>(),

  // 收款账户信息（快照）
  recipientAccount: json('recipient_account').$type<{
    accountType?: string;
    accountNumber?: string;
    accountHolder?: string;
    bankName?: string;
    swiftCode?: string;
    routingNumber?: string;
  }>(),

  // 确认信息
  confirmedBy: uuid('confirmed_by').notNull().references(() => users.id),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull(),
  confirmNotes: text('confirm_notes'),

  // 结算状态
  status: settlementStatusEnum('status').notNull().default('completed'),

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  notes: text('notes'),
});
```

**结算方式枚举（v2.18）：**

```typescript
export const settlementMethodEnum = pgEnum('settlement_method', [
  'domestic_transfer',      // 国内转账
  'channel_payment',        // 渠道一起付
  'gusto',                  // Gusto
  'gusto_international',    // Gusto-International
  'check',                  // 支票
]);
```

**结算状态枚举：**

```typescript
export const settlementStatusEnum = pgEnum('settlement_status', [
  'pending',          // 待结算
  'processing',       // 结算中
  'settled',          // 已结算
  'on_hold',          // 冻结
  'failed',           // 结算失败
]);
```

**结算金额计算示例：**

```typescript
// 示例：导师2025年11月收入 $2,000，选择渠道一起付结算（手续费率2%）
{
  settlementNumber: "STL-2025-11-00001",
  mentorId: "mentor-uuid-1",
  settlementMonth: "2025-11",

  // 原始金额（来自 mentor_payable_ledgers 汇总）
  grossAmount: 2000.00,  // $2,000

  // 扣除项（来自 settlement_parameters 当月参数）
  platformFee: 100.00,       // 平台手续费 = 2000 × 5%
  platformFeeRate: 0.0500,   // 5%平台手续费率（快照）
  taxAmount: 190.00,         // 税费 = (2000 - 100) × 10%
  taxRate: 0.1000,           // 10%税率（快照）

  // 结算方式和手续费
  settlementMethod: 'channel_payment',
  handlingFee: 40.00,        // 手续费 = 2000 × 2%
  handlingFeeRate: 0.0200,   // 2%手续费率（快照）

  // 实际结算金额（美元）= 2000 - 100 - 190 - 40 = 1670
  netAmount: 1670.00,

  // 币种转换（导师选择人民币结算）
  settlementCurrency: "CNY",
  exchangeRate: 7.2000,       // 1 USD = 7.2 CNY
  settlementAmount: 12024.00, // 1670 × 7.2

  // 关联的服务记录
  billingLedgerIds: ["ledger-uuid-1", "ledger-uuid-2", "ledger-uuid-3"],

  // 财务确认
  confirmedBy: "finance-staff-uuid-1",
  confirmedAt: new Date("2025-11-15T15:00:00Z"),
  confirmNotes: "已在第三方系统完成支付，转账参考号：20251115001234567",

  status: "completed",
}
```

### 2.5 settlement_parameters (结算参数表)

**文件路径：** `src/infrastructure/database/schema/settlement-parameters.schema.ts`

**核心特性：**
- 存储每月的结算参数（汇率、扣除比例、手续费率）
- 财务在结算前设置当月参数
- 用于实时计算导师待付金额
- **支持每月多版本**（2025-11-12 决策）：允许月中调整参数

**💡 版本控制设计（2025-11-12 决策）：**
- 采用「每月多版本」模式（选项 C）
- 每次结算默认使用最新版本（`isLatest = true`）
- 允许财务人员新增版本，系统自动将旧版本标记为非最新
- 保证历史结算的参数可追溯性

```typescript
export const settlementParameters = pgTable('settlement_parameters', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 结算月份（格式：YYYY-MM）
  settlementMonth: varchar('settlement_month', { length: 7 }).notNull().unique(),

  // 汇率设置（美元到目标币种）
  exchangeRates: json('exchange_rates').$type<{
    USD_CNY?: number;    // 美元 → 人民币
    USD_EUR?: number;    // 美元 → 欧元
    USD_GBP?: number;    // 美元 → 英镑
    [key: string]: number;
  }>(),

  // 扣除比例
  deductions: json('deductions').$type<{
    platformFeeRate: number;  // 平台手续费率（如 0.05 表示 5%）
    taxRate: number;          // 税费率（如 0.10 表示 10%）
  }>(),

  // 结算方式手续费率配置 (v2.18)
  settlementMethodFeeRates: json('settlement_method_fee_rates').$type<{
    domestic_transfer: number;      // 国内转账手续费率（通常为 0）
    channel_payment: number;        // 渠道一起付手续费率（如 0.02 表示 2%）
    gusto: number;                  // Gusto 手续费率（如 0.03 表示 3%）
    gusto_international: number;    // Gusto-International 手续费率（如 0.05 表示 5%）
    check: number;                  // 支票手续费率（通常为 0）
  }>(),

  // 时间戳
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  notes: text('notes'),
});
```

**使用示例：**

```typescript
// 设置2025年11月的结算参数
{
  settlementMonth: "2025-11",

  // 汇率
  exchangeRates: {
    USD_CNY: 7.2000,      // 1 USD = 7.2 CNY
    USD_EUR: 0.9200,      // 1 USD = 0.92 EUR
    USD_GBP: 0.7800,      // 1 USD = 0.78 GBP
  },

  // 扣除比例
  deductions: {
    platformFeeRate: 0.05,  // 5% 平台手续费
    taxRate: 0.10,          // 10% 税费
  },

  // 结算方式手续费率
  settlementMethodFeeRates: {
    domestic_transfer: 0.00,        // 国内转账: 0%
    channel_payment: 0.02,          // 渠道一起付: 2%
    gusto: 0.03,                    // Gusto: 3%
    gusto_international: 0.05,      // Gusto-International: 5%
    check: 0.00,                    // 支票: 0%
  },

  createdBy: "finance-manager-uuid-1",
  notes: "11月结算参数，汇率按当日中行中间价",
}
```

### 2.6 settlement_appeals (结算申诉表)

**文件路径：** `src/infrastructure/database/schema/settlement-appeals.schema.ts`

**核心特性：**
- 记录导师对结算金额的申诉
- 申诉针对特定的结算记录或服务记录
- 顾问审核申诉，调整结算金额

```typescript
export const settlementAppeals = pgTable('settlement_appeals', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 标题
  title: text('title').notNull(),

  // 关联信息
  settlementId: uuid('settlement_id').notNull().references(() => settlement_ledgers.id),
  billingLedgerId: uuid('billing_ledger_id').references(() => mentor_payable_ledgers.id),

  // 申诉方
  appealedBy: uuid('appealed_by').notNull().references(() => users.id),

  // 申诉信息
  reason: appealReasonEnum('reason').notNull(),
  description: text('description').notNull(),

  // 审核信息
  status: appealStatusEnum('status').notNull().default('pending'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewNotes: text('review_notes'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),

  // 处理结果
  resolution: text('resolution'),
  adjustedAmount: numeric('adjusted_amount', { precision: 12, scale: 2 }),

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

**申诉原因枚举：**

```typescript
export const appealReasonEnum = pgEnum('appeal_reason', [
  'service_not_completed',  // 服务未完成
  'incorrect_amount',       // 金额有误
  'duplicate_charge',       // 重复计费
  'other',                  // 其他
]);
```

**申诉状态枚举：**

```typescript
export const appealStatusEnum = pgEnum('appeal_status', [
  'pending',    // 申诉中
  'approved',   // 通过
  'rejected',   // 拒绝
]);
```

**使用示例：**

```typescript
// 导师对结算金额提出申诉
{
  title: "申诉 tutor-uuid-1 的结算金额",
  settlementId: "settlement-uuid-1",
  billingLedgerId: "ledger-uuid-1",  // 针对具体的服务记录

  appealedBy: "mentor-uuid-1",
  reason: "service_not_completed",
  description: "该次GAP分析服务未完成，学生未出席",

  status: "pending",

  createdAt: new Date("2025-11-16T10:00:00Z"),
}
```

---

## 3. 服务接口清单

### 3.1 PaymentService - 支付服务 (5个方法)

**域归属：** Financial Domain

**说明：**
- 系统不对接第三方支付平台
- 采用财务确认模式
- 支付确认后触发事件

| # | 服务方法 | 方法签名 | 功能 |
|---|---------|---------|------|
| 1 | 创建支付记录 | `create(dto: CreatePaymentDto): Promise<Payment>` | 创建待支付记录 |
| 2 | 查询支付记录 | `search(filter: PaymentFilterDto, pagination?: PaginationDto, sort?: SortDto): Promise<PaginatedResult<Payment>>` | 查询支付历史 |
| 3 | 查询支付详情 | `findById(id: string): Promise<Payment>` | 查看支付详细信息 |
| 4 | 确认支付 | `confirm(paymentId: string, dto: ConfirmPaymentDto): Promise<Payment>` | 财务确认支付已到账 |
| 5 | 申请退款 | `refund(paymentId: string, dto: RefundDto): Promise<Refund>` | 退款处理 |

### 3.2 SettlementService - 结算服务 (10个方法)

**域归属：** Financial Domain

**说明：**
- 实时查询和计算模式，无批次处理
- 财务设置当月参数后，系统实时计算

| # | 服务方法 | 方法签名 | 功能 |
|---|---------|---------|------|
| 1 | 查询待支付明细 | `getPendingLedgers(query: { month: string, mentorId?: string }): Promise<MentorPayableLedger[]>` | 查询指定月份待支付的服务记录 |
| 2 | 计算结算金额 | `calculateSettlement(dto: CalculateSettlementDto): Promise<SettlementCalculation>` | 实时计算应付金额（含汇率、扣除） |
| 3 | 设置结算参数 | `setParameters(dto: SetParametersDto): Promise<SettlementParameters>` | 设置当月汇率和扣除比例 |
| 4 | 确认支付 | `confirmPayment(dto: ConfirmPaymentDto): Promise<Settlement>` | 财务确认已完成导师支付 |
| 5 | 查询结算记录 | `search(filter: SettlementFilterDto, pagination?: PaginationDto, sort?: SortDto): Promise<PaginatedResult<Settlement>>` | 查询结算历史 |
| 6 | 查询结算详情 | `findById(id: string): Promise<Settlement>` | 查看结算详细信息 |
| 7 | 冻结结算 | `holdSettlement(settlementId: string, reason: string): Promise<Settlement>` | 冻结待结算金额 |
| 8 | 解冻结算 | `unholdSettlement(settlementId: string): Promise<Settlement>` | 解冻冻结金额 |
| 9 | 导出结算报表 | `exportSettlementReport(query: SettlementReportQueryDto): Promise<Buffer>` | 导出Excel/PDF结算报表 |
| 10 | 批量确认 | `batchConfirm(dto: BatchConfirmDto): Promise<BatchResult>` | 批量确认多个结算 |

### 3.3 AppealService - 结算申诉服务 (4个方法)

**域归属：** Financial Domain

| # | 服务方法 | 方法签名 | 功能 |
|---|---------|---------|------|
| 1 | 提交申诉 | `createAppeal(dto: CreateAppealDto): Promise<Appeal>` | 对结算金额提出异议 |
| 2 | 查询申诉列表 | `search(filter: AppealFilterDto, pagination?: PaginationDto, sort?: SortDto): Promise<PaginatedResult<Appeal>>` | 查询申诉记录 |
| 3 | 查询申诉详情 | `findById(id: string): Promise<Appeal>` | 查看申诉完整信息 |
| 4 | 审核申诉 | `reviewAppeal(id: string, dto: ReviewAppealDto): Promise<Appeal>` | 批准或拒绝申诉 |

### 3.4 BillingStatsService - 计费统计服务 (2个方法)

**域归属：** Financial Domain

| # | 服务方法 | 方法签名 | 功能 |
|---|---------|---------|------|
| 1 | 查询导师收入统计 | `getMentorStats(mentorId: string, period: DateRange): Promise<MentorStats>` | 统计导师收入 |
| 2 | 查询平台收入统计 | `getPlatformStats(period: DateRange): Promise<PlatformStats>` | 统计平台整体收入 |

### 3.5 MentorPricingService - 导师定价服务 (4个方法)

**域归属：** Financial Domain

| # | 服务方法 | 方法签名 | 功能 |
|---|---------|---------|------|
| 1 | 查询导师价格配置 | `findByMentor(mentorId: string): Promise<MentorPrice[]>` | 查询价格配置 |
| 2 | 设置导师价格 | `upsertPrice(mentorId: string, dto: UpsertPriceDto): Promise<MentorPrice>` | 设置/更新价格 |
| 3 | 检查价格配置 | `checkPricing(mentorId: string, serviceType: string): Promise<PricingCheckResult>` | 检查价格配置是否完整 |
| 4 | 查询价格历史 | `getPriceHistory(mentorId: string, serviceType: string): Promise<PriceHistory[]>` | 查看价格变更历史 |

---

## 4. 事件驱动设计

### 4.1 Financial Domain 发布的事件

**Outbound Events (6个)**

| # | 事件名称 | 订阅者 | 触发时机 | 事件用途 |
|---|---------|--------|---------|---------|
| 1 | `financial.payment.succeeded` | Contract Domain、Notification | 财务确认支付到账 | 触发合同激活、发送通知 |
| 2 | `financial.billing.ledger_created` | Analytics、Contract Domain | 创建导师计费记录 | 数据分析、更新合同统计 |
| 3 | `financial.billing.appeal_created` | Notification | 结算申诉创建（导师发起） | 通知顾问处理 |
| 4 | `financial.billing.appeal_resolved` | Notification | 申诉处理完成（顾问审核后） | 通知导师结果 |
| 5 | `financial.settlement.completed` | Billing Service、Notification | 结算完成（款项已发放） | 更新计费记录状态、通知导师 |
| 6 | `financial.billing.pricing_missing` | 管理界面 | 价格配置缺失 | 提示顾问补全价格配置 |

**事件负载示例：**

1. **payment.succeeded 事件**
```typescript
{
  eventId: string;
  timestamp: Date;
  eventType: 'financial.payment.succeeded';
  payload: {
    paymentId: string;
    paymentNumber: string;
    studentId: string;
    amount: number;
    paymentMethod: string;
    confirmedBy: string;
    confirmedAt: Date;
  };
}
```

2. **settlement.completed 事件**
```typescript
{
  eventId: string;
  timestamp: Date;
  eventType: 'financial.settlement.completed';
  payload: {
    settlementId: string;
    settlementNumber: string;
    mentorId: string;
    settlementMonth: string;
    grossAmount: number;
    netAmount: number;
    settlementMethod: string;
    settlementCurrency: string;
    settlementAmount: number;
    confirmedBy: string;
    confirmedAt: Date;
    billingLedgerIds: string[]; // 关联的计费记录
  };
}
```

### 4.2 Financial Domain 监听的事件

**Inbound Events (7个)**

| # | 事件名称 | 来源域 | 触发时机 | 业务处理 |
|---|---------|--------|---------|---------|
| 1 | `services.session.completed` | Services Domain | 服务完成 | 创建 mentor_payable_ledgers 记录 |
| 2 | `services.session.evaluated` | Services Domain | 导师完成评价 | 处理需要评价的计费 |
| 3 | `placement.referral.resume_submitted` | Placement Domain | 简历提交成功 | 阶段性计费（第1阶段） |
| 4 | `placement.referral.interview_passed` | Placement Domain | 学员通过面试 | 阶段性计费（第2阶段） |
| 5 | `placement.referral.offer_received` | Placement Domain | 学员收到Offer | 阶段性计费（第3阶段） |
| 6 | `contract.contract.signed` | Contract Domain | 合同签署 | 验证价格配置完整性 |
| 7 | `services.class.completed` | Services Domain | 班课完成 | 批量创建计费记录 |

**事件处理流程：**

1. **Session 完成事件处理**
```
services.session.completed 事件到达
    ↓
查询 contract 和 mentor_prices
    ↓
计算计费金额
    ↓
创建 mentor_payable_ledgers 记录
    ↓
发布 financial.billing.ledger_created 事件
```

2. **内推三阶段计费**
```
placement.referral.resume_submitted → 创建第1阶段计费
placement.referral.interview_passed → 创建第2阶段计费
placement.referral.offer_received   → 创建第3阶段计费
```

---

## 5. 业务流程

### 5.1 学生支付流程 (Payment Flow)

```
┌──────────────────────────────────────────────────────────────────┐
│                     学生支付完整流程                               │
└──────────────────────────────────────────────────────────────────┘

Step 1: 创建支付记录（Financial Domain）
   顾问 → 在系统中创建支付记录
        → PaymentService.create(dto: CreatePaymentDto)
        → 生成支付记录（status: pending, ledgerType: initial_payment/installment/final_payment/top_up）
        → balanceAfter 初始计算（欠款余额）

Step 2: 学生在第三方系统完成支付
   学生 → 在第三方系统（银行）完成支付
        → 银行转账 / 现金 / 支票

Step 3: 财务确认支付（Financial Domain）
   财务 → 在第三方系统确认到账后，在本系统确认
        → PaymentService.confirm(paymentId, dto)
        → 更新支付状态为 'succeeded'
        → 更新 balanceAfter（欠款余额快照）
        → 发布 financial.payment.succeeded 事件

Step 4: 合同激活（Contract Domain监听）
   Contract → 监听 financial.payment.succeeded
            → 激活合同状态
            → 初始化服务权益余额
            → 发布 contract.activated 事件

Step 5: 开通服务（Services Domain监听）
   Services → 监听 contract.activated
            → 开通服务预约权限
            → 学生可开始预约服务
```

**关键规则：**
- ✅ balanceAfter 字段记录每次支付后的剩余欠款
- ✅ 支持多种支付方式：bank_transfer, cash, cheque, other
- ✅ 支付确认必须由财务手动操作（财务确认模式）
- ✅ 支付成功后触发合同激活流程

### 5.2 导师结算流程 (Settlement Flow)

```
┌──────────────────────────────────────────────────────────────────┐
│                     导师结算完整流程                               │
└──────────────────────────────────────────────────────────────────┘

Step 1: 服务完成创建计费记录
   Services → 服务完成
            → 发布 services.session.completed

   Financial → 监听器创建 mentor_payable_ledgers
             → status: pending, settlement_status: pending

Step 2: 月度结算前准备
   财务 → 登录结算系统
        → 选择结算月份（如 2025-11）
        → SettlementService.setParameters()
        → 设置当月汇率、扣除比例、手续费率

Step 3: 查询待支付明细
   财务 → SettlementService.getPendingLedgers({ month: '2025-11' })
        → 查询所有 settlement_status = 'pending' 的记录
        → 实时汇总 grossAmount

Step 4: 计算结算金额
   系统 → SettlementService.calculateSettlement()
        → 从 settlement_parameters 获取当月参数
        → 计算 platformFee = grossAmount × platformFeeRate
        → 计算 taxAmount = (grossAmount - platformFee) × taxRate
        → 计算 handlingFee（根据 settlementMethod）
        → netAmount = grossAmount - platformFee - taxAmount - handlingFee
        → settlementAmount = netAmount × exchangeRate

Step 5: 财务在第三方系统支付
   财务 → 根据计算结果，在第三方系统完成支付
        → 国内转账 / 渠道一起付 / Gusto / 支票

Step 6: 确认支付（Financial Domain）
   财务 → SettlementService.confirmPayment()
        → 创建 settlement_ledgers 记录
        → 更新关联的 mentor_payable_ledgers.settlement_status = 'settled'
        → 发布 settlement.completed 事件

Step 7: 通知导师
   Notification → 监听 settlement.completed
                → 发送邮件/短信通知导师
                → 包含结算金额、付款参考号
```

**关键规则：**
- ✅ 实时计算模式，无批次处理
- ✅ 结算前必须先设置当月参数（汇率、扣除比例、手续费率）
- ✅ 所有金额字段保存快照（防止后续参数变更影响历史记录）
- ✅ 支持5种结算方式，每种方式有不同的手续费率
- ✅ 多币种结算，自动汇率转换

### 5.3 申诉处理流程 (Appeal Flow)

```
┌──────────────────────────────────────────────────────────────────┐
│                     结算申诉完整流程                               │
└──────────────────────────────────────────────────────────────────┘

Step 1: 导师提交申诉
   导师 → 查看结算明细
        → 发现金额有误
        → AppealService.createAppeal()
        → 填写申诉原因和描述
        → 上传证据附件
        → status: pending
        → 发布 billing.appeal_created 事件

Step 2: 顾问审核申诉
   顾问 → 收到通知（监听 billing.appeal_created）
        → AppealService.findById() 查看申诉详情
        → 联系导师和学生核实情况
        → 审核证据

Step 3: 做出审核决定
   场景A：申诉通过
      顾问 → AppealService.reviewAppeal(id, { status: 'approved' })
           → 创建负数的 mentor_payable_ledgers 记录
           → 调整结算金额
           → 发布 billing.appeal_resolved 事件

   场景B：申诉拒绝
      顾问 → AppealService.reviewAppeal(id, { status: 'rejected' })
           → 维持原结算金额
           → 发布 billing.appeal_resolved 事件

Step 4: 通知处理结果
   Notification → 监听 billing.appeal_resolved
                → 通知导师审核结果
                → 包含处理说明和调整金额
```

**关键规则：**
- ✅ 申诉针对结算记录或具体的服务记录
- ✅ 申诉通过后创建负数的 mentor_payable_ledgers 记录调整金额
- ✅ 已结算的记录需要先解冻才能调整
- ✅ 保留完整的申诉历史和证据

---

## 6. 附录

### 6.1 金额字段精度规范

| 字段类型 | 精度 | 适用场景 | 示例 |
|---------|------|---------|------|
| `numeric(12, 1)` | 保留1位小数 | **单价字段** | $99.5/小时 |
| `numeric(12, 2)` | 保留2位小数 | **总额字段** | $199.00 |

**设计原因：**
- **单价** (`unitPrice`): 通常不需要精确到分，1位小数足够
- **总额** (`totalAmount`): 必须精确到分，防止累计误差

### 6.2 跨域引用策略（DDD架构）

**1. 不使用外键约束的场景（应用层保证完整性）：**

```typescript
// Contract Domain 引用 Product
contracts.productId → Catalog Domain 的 products (注释外键)

// Financial Domain 引用 Session
mentor_payable_ledgers.sessionId → Services Domain 的 sessions (注释外键)
mentor_payable_ledgers.classId → Services Domain 的 classes (注释外键)

```

**原因：**
- 保持域的独立性和松耦合
- 避免跨域的级联删除影响
- 允许不同域独立演进

**2. 使用外键约束的场景（同域或强一致性）：**


**实现建议：**
- 跨域引用在应用层使用 Service 调用验证
- 关键业务流程使用事件保证最终一致性
- 定期运行数据一致性检查任务

### 6.3 Append-Only 设计模式

**适用范围：**
- `mentor_payable_ledgers` - 导师应付账款流水
- `student_payment_ledgers` - 学生支付流水

**设计特点：**
- ❌ 记录不可修改，无需 `updatedAt` 字段
- ✅ 支持负数调整记录（如退款、申诉调整）
- ✅ 完整审计追踪（所有历史不可篡改）
- ✅ 余额快照设计（支持快速对账）

**应用层保护：**

```typescript
class MentorPayableLedgerService {
  async recordLedger(dto: CreateMentorPayableLedgerDto) {
    // ✅ 只提供 INSERT 方法
    return await this.db.insert(mentorPayableLedgers).values({
      ...dto,
      createdAt: new Date(),
    });
  }

  // ❌ 不提供 update() 方法
  // ❌ 不提供 delete() 方法
}
```

**数据库权限建议：**

```sql
-- 只授予 INSERT 和 SELECT 权限，禁止 UPDATE/DELETE
REVOKE UPDATE, DELETE ON mentor_payable_ledgers FROM mentorx_app_user;
GRANT INSERT, SELECT ON mentor_payable_ledgers TO mentorx_app_user;

REVOKE UPDATE, DELETE ON student_payment_ledgers FROM mentorx_app_user;
GRANT INSERT, SELECT ON student_payment_ledgers TO mentorx_app_user;
```

### 6.4 索引设计建议

**mentor_payable_ledgers 表：**

```sql
-- 按导师查询（导师查看自己的服务记录）
CREATE INDEX idx_mentor_payable_ledgers_mentor ON mentor_payable_ledgers(mentor_id);

-- 按结算状态查询（结算时过滤pending记录）
CREATE INDEX idx_mentor_payable_ledgers_settlement ON mentor_payable_ledgers(settlement_status);

-- 按服务完成时间查询（按月统计）
CREATE INDEX idx_mentor_payable_ledgers_completed ON mentor_payable_ledgers(service_completed_at);
```

**student_payment_ledgers 表：**

```sql
-- 按学生查询（学生查看自己的支付记录）
CREATE INDEX idx_student_payment_ledgers_student ON student_payment_ledgers(student_id);

-- 按状态查询（筛选pending/succeeded）
CREATE INDEX idx_student_payment_ledgers_status ON student_payment_ledgers(status);

-- 按确认时间查询（财务对账）
CREATE INDEX idx_student_payment_ledgers_confirmed ON student_payment_ledgers(confirmed_at);
```

**settlement_ledgers 表：**

```sql
-- 按导师查询
CREATE INDEX idx_settlement_ledgers_mentor ON settlement_ledgers(mentor_id);

-- 按月份查询（统计月度结算）
CREATE INDEX idx_settlement_ledgers_month ON settlement_ledgers(settlement_month);

-- 按状态查询
CREATE INDEX idx_settlement_ledgers_status ON settlement_ledgers(status);
```

### 6.5 版本变更历史

| 版本 | 日期 | 主要变更 | 影响表 |
|------|------|---------|-------|
| v2.21 | 2025-11-12 | 新增班课导师定价表，支持三种定价模式 | class_mentor_prices (新增) |
| v2.21 | 2025-11-12 | mentor_payable_ledgers 新增 classId 字段 | mentor_payable_ledgers (更新) |
| v2.21 | 2025-11-12 | 创建 Financial Domain 详细设计文档 | 所有表 |
| v2.21 | 2025-11-04 | 架构简化：删除冗余表，平衡负债债表 | student_payment_ledgers |
| v2.18 | 2025-11 | 结算方式重构：支持5种方式，含手续费配置 | settlement_ledgers, settlement_parameters |
| v2.18 | 2025-11 | 明确流水表职责，统一命名规范 | mentor_payable_ledgers |
| v2.17 | 2025-11 | 表重命名，术语统一 | 所有流水表 |
| v2.16 | 2025-10 | 合同权益来源追溯 | contract_service_entitlements |
| v2.15 | 2025-09 | Catalog 架构重构 | services, service_packages, products |
| v2.14 | 2025-08 | 归档策略、冷热分离 | service_ledgers_archive |
| v2.13 | 2025-07 | 四域架构确立 | 所有核心表 |

### 2.7 class_mentor_prices (班课导师定价表) 🆕

**文件路径：** `src/infrastructure/database/schema/class-mentor-prices.schema.ts`

**域归属：** Financial Domain

**职责说明：**
- 管理班课中每位导师的服务定价（2025-11-12 新增）
- 班课创建时为导师分配并制定价格
- 按「服务场次」计费，费用与参与学生人数无关
- 价格固定（创建后在整个班课周期不变）

**核心设计说明（基于2025-11-12决策）：**

1. **班课结构**：采用选项 B（courses → classes 两层结构）
   - `courses` 表：课程模板（Services Domain）
   - `classes` 表：具体开班实例（Services Domain）
   - `class_mentor_prices` 关联 `classes` 表（具体班级）

2. **计费粒度**：选项 B（按「服务场次」计费）
   - 每组织一次班课辅导 = 1场次
   - 导师费用 = unitPrice × 1（与学生人数无关）

3. **定价有效期**：班课创建后价格固定
   - 不需要 `effectiveFrom`/`effectiveUntil` 字段
   - 价格在整个班课生命周期保持不变

4. **字段设计**：使用 `serviceType` 而非 `serviceId`
   - 直接关联服务类型枚举，无需查询 services 表
   - 更简洁，查询性能更好

```typescript
import { pgTable, uuid, numeric, varchar, boolean, timestamp, and, eq } from 'drizzle-orm/pg-core';
import { classes } from './classes.schema'; // 注释外键：Services Domain
import { users } from './users.schema';
import { serviceTypeEnum } from './enums/service-type.enum';

export const classMentorPrices = pgTable('class_mentor_prices', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 关联关系（跨域引用，注释外键）
  // ⚠️ classes 表定义在 Services Domain，不使用外键约束
  classId: uuid('class_id').notNull(), // 注释外键：关联 Services Domain 的 classes
  mentorId: uuid('mentor_id').notNull().references(() => users.id),

  // 服务类型（使用枚举(过滤掉 class, group_session)，直接关联，无需查询 services 表）
  // 例如：'gap_analysis', 'resume_review', 'group_session', 'workshop', 'class'
  serviceType: serviceTypeEnum('service_type').notNull(),

  // 定价信息（按场次计费）
  // 金额精度：unitPrice 保留1位小数（如 $99.5/次）
  unitPrice: numeric('unit_price', { precision: 12, scale: 1 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),

  // 状态管理
  isActive: boolean('is_active').notNull().default(true),

  // 备注
  notes: varchar('notes', { length: 500 }),

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
});

// 索引
// CREATE INDEX idx_class_mentor_prices_class ON class_mentor_prices(class_id);
// CREATE INDEX idx_class_mentor_prices_mentor ON class_mentor_prices(mentor_id);
// CREATE INDEX idx_class_mentor_prices_service_type ON class_mentor_prices(service_type);
// CREATE INDEX idx_class_mentor_prices_active ON class_mentor_prices(is_active);

// 唯一约束：同一班级中，同一导师对同一服务只能有一个价格
// CREATE UNIQUE INDEX idx_class_mentor_prices_unique
// ON class_mentor_prices(class_id, mentor_id, service_type);
```

**关联关系说明：**

```
courses (Services Domain)
  └── classes (Services Domain)
        └── class_mentor_prices (Financial Domain)
              ├── classId (注释外键 → classes.id)
              ├── mentorId (外键 → users.id)
              └── serviceType (枚举，直接引用)
```

**使用场景示例：**

```typescript
// 场景：为"求职冲刺班 2025Q4"设置导师价格
// 班课创建时，为每位导师单独定价

// 示例1：为导师 A 设置 GAP 分析价格
{
  classId: "class-uuid-001",        // "求职冲刺班 2025Q4"
  mentorId: "mentor-uuid-001",      // 导师 A
  serviceType: "gap_analysis",      // GAP分析服务
  unitPrice: 120.0,                 // $120/场次
  currency: "USD",
  serviceName: "GAP分析",
  isActive: true,
  createdBy: "counselor-uuid-001",
}

// 示例2：为导师 A 设置简历修改价格
{
  classId: "class-uuid-001",
  mentorId: "mentor-uuid-001",
  serviceType: "resume_review",     // 简历修改服务
  unitPrice: 80.0,                  // $80/场次
  currency: "USD",
  serviceName: "简历修改",
  isActive: true,
  createdBy: "counselor-uuid-001",
}

// 示例3：为导师 B 设置价格（可能比导师 A 高）
{
  classId: "class-uuid-001",
  mentorId: "mentor-uuid-002",      // 导师 B
  serviceType: "gap_analysis",
  unitPrice: 150.0,                 // $150/场次（高于导师 A）
  currency: "USD",
  serviceName: "GAP分析",
  isActive: true,
  createdBy: "counselor-uuid-001",
}
```

**数据完整性说明（DDD原则）：**

```typescript
// ⚠️ 跨域引用策略：
// class_mentor_prices 定义在 Financial Domain
// classes 表定义在 Services Domain
// 跨域引用应注释外键约束，通过应用层保证完整性

// ❌ 不推荐：使用外键约束
// classId: uuid('class_id').references(() => classes.id)

// ✅ 推荐：注释外键，应用层验证
classId: uuid('class_id').notNull(), // 注释外键：关联 Services Domain 的 classes

// 实现方式：
class ClassMentorPriceService {
  async createPrice(dto) {
    // 1. 应用层验证：调用 ClassService 验证 classId 存在
    const classInfo = await classService.findById(dto.classId);
    if (!classInfo) throw new Error('Class not found');

    // 2. 验证 mentorId 存在
    const mentor = await userService.findById(dto.mentorId);
    if (!mentor || mentor.role !== 'mentor') throw new Error('Mentor not found');

    // 3. 创建价格记录
    return await db.insert(classMentorPrices).values(dto);
  }
}
```

**计费流程示例：**

```typescript
// 班课服务完成后，查询导师价格并创建 billing 记录

const price = await db.query.classMentorPrices.findFirst({
  where: and(
    eq(classMentorPrices.classId, classId),
    eq(classMentorPrices.mentorId, mentorId),
    eq(classMentorPrices.serviceType, serviceType),
    eq(classMentorPrices.isActive, true)
  ),
});

if (!price) {
  throw new Error(
    `未找到班课定价：classId=${classId}, mentorId=${mentorId}, serviceType=${serviceType}`
  );
}

// 创建 mentor_payable_ledgers 记录（班课服务）
const billingRecord = {
  classId: classId,           // 关联班课
  sessionId: null,            // 班课不使用 sessionId

  mentorId: mentorId,
  studentId: null,            // 班课按场次计费，不关联具体学生

  serviceType: serviceType,
  serviceName: `班课-${price.serviceName}`,

  quantity: 1,                // 1场次
  unitPrice: price.unitPrice, // 从 class_mentor_prices 查询
  totalAmount: price.unitPrice,

  serviceCompletedAt: new Date(),
  status: 'pending',
  settlementStatus: 'pending',
};

// 如果一个月内导师 A 完成 5 次 GAP 分析
// 总费用 = $120 × 5 = $600（与学生人数无关）
```

**计费规则对比：班课 vs 1对1**

| 对比项 | 班课 (classId) | 1对1 (sessionId) |
|--------|----------------|------------------|
| classId | 有值 | null |
| sessionId | null | 有值 |
| studentId | null（按场次） | 有值（具体学生） |
| quantity | 1（场次） | N（服务次数） |
| 计费方式 | 按场次，与人数无关 | 按次/按小时 |
| 查询价格表 | class_mentor_prices | mentor_prices |
| 结算方式 | 批量结算（按班级） | 单独结算（按学生） |

---

## 8. 跨域协作模式

> ** 讨论日期 **：2025-11-12
> ** 讨论范围 **：class_mentor_prices 和 mentor_payable_ledgers 的跨域引用策略
> ** 核心原则 **：注释外键约束 + 应用层验证 + 事件驱动同步

---

### 8.1 跨域引用策略（DDD 架构）

#### 8.1.1 不使用外键约束的场景

** Financial Domain → Services Domain **

```typescript
// class_mentor_prices 引用 classes（Services Domain）
classMentorPrices = pgTable('class_mentor_prices', {
  classId: uuid('class_id').notNull(),
  // ❌ 注释外键：关联 Services Domain 的 classes
  // 原因：保持域边界清晰，允许独立演进
});

// mentor_payable_ledgers 引用 sessions/classes（Services Domain）
mentorPayableLedgers = pgTable('mentor_payable_ledgers', {
  sessionId: uuid('session_id'), // 注释外键：1对1服务
  classId: uuid('class_id'),     // 注释外键：班课服务
});
```

** 原因说明： **
- ✅ 保持域的独立性和松耦合
- ✅ 避免跨域级联删除影响
- ✅ 允许不同域独立演进（不同发布周期）
- ❌ 牺牲数据库级数据完整性保证

#### 8.1.2 数据完整性保证机制

** 应用层验证（强制） **

```typescript
class ClassMentorPriceService {
  async createPrice(dto: CreateClassMentorPriceDto) {
    // 1. 严格验证：调用 Services Domain 接口
    const classInfo = await classService.findById(dto.classId);

    // 2. ** 决策 **：class 不存在则抛出异常（严格验证）
    if (!classInfo) {
      throw new Error(`Class ${dto.classId} not found`);
    }

    // 3. 验证导师存在
    const mentor = await userService.findById(dto.mentorId);
    if (!mentor || mentor.role !== 'mentor') {
      throw new Error(`Mentor ${dto.mentorId} not found`);
    }

    // 4. 创建价格记录
    return await this.db.insert(classMentorPrices).values(dto);
  }
}
```

** 处理跨域数据删除 **

Services Domain 删除 class 时，发布事件通知 Financial Domain：

```typescript
// Services Domain
class ClassService {
  async deleteClass(classId: string) {
    // 1. 删除 class
    await this.db.delete(classes).where(eq(classes.id, classId));

    // 2. 发布删除事件
    await eventBus.publish('class.deleted', { classId });
  }
}

// Financial Domain 监听事件
@OnEvent('class.deleted')
async handleClassDeleted(event: ClassDeletedEvent) {
  // ** 决策 **：标记为 inactive，而非物理删除
  await this.db.update(classMentorPrices)
    .set({ isActive: false })
    .where(eq(classMentorPrices.classId, event.classId));

  // 标记 mentor_payable_ledgers 为无效（可选）
  await this.db.update(mentorPayableLedgers)
    .set({ metadata: { isValid: false } })
    .where(eq(mentorPayableLedgers.classId, event.classId));
}
```

** 决策总结：**
- **验证**：严格验证，不存在则抛异常
- **删除**：事件通知 + 标记非激活（保留历史记录）
- **更新**：无需同步，快照存储可接受过时

---

### 8.2 跨域查询优化

#### 8.2.1 mentor_payable_ledgers 查询优化

**问题**：查询导师计费记录时，需要区分 1对1 和 班课服务

**决策**：**使用 UNION ALL 查询**（性能优先）

```typescript
// 查询某位导师的所有计费记录（1对1 + 班课）
// **决策：选项 A** - UNION ALL 单查询

async getMentorBilling(mentorId: string, pagination: PaginationDto) {
  const results = await this.db.execute(sql`
    SELECT
      id, session_id, class_id,
      service_type, service_name,
      session_title, student_name, class_name,
      unit_price, total_amount, currency,
      service_completed_at, settlement_status
    FROM mentor_payable_ledgers
    WHERE mentor_id = ${mentorId} AND session_id IS NOT NULL

    UNION ALL

    SELECT
      id, session_id, class_id,
      service_type, service_name,
      session_title, student_name, class_name,
      unit_price, total_amount, currency,
      service_completed_at, settlement_status
    FROM mentor_payable_ledgers
    WHERE mentor_id = ${mentorId} AND class_id IS NOT NULL

    ORDER BY service_completed_at DESC
    LIMIT ${pagination.pageSize} OFFSET ${(pagination.page - 1) * pagination.pageSize}
  `);

  return results;
}

// 索引优化
// CREATE INDEX idx_mentor_payable_session ON mentor_payable_ledgers(mentor_id, session_id) WHERE session_id IS NOT NULL;
// CREATE INDEX idx_mentor_payable_class ON mentor_payable_ledgers(mentor_id, class_id) WHERE class_id IS NOT NULL;
```

**优缺点分析：**
- ✅ 优点：一次查询，性能好；利用数据库优化
- ❌ 缺点：SQL 较复杂；需要维护两个 WHERE 条件

**对比方案（已否决）：**
```typescript
// 选项 B：两个独立查询（代码清晰，但两次查询）
// 选项 C：新增 service_mode 字段（需要额外维护字段）
```

---

### 8.3 快照设计策略

#### 8.3.1 mentor_payable_ledgers 快照字段

**问题**：查询计费记录时，需要显示关联的服务标题、学生姓名等信息

**决策**：**存储快照字段**（选项 B）- 无需跨域查询

```typescript
// mentor_payable_ledgers 新增快照字段
export const mentorPayableLedgers = pgTable('mentor_payable_ledgers', {
  // ... 其他字段

  // 快照字段（创建时存储，便于查询显示）
  sessionTitle: varchar('session_title', { length: 200 }),  // 1对1服务标题
  studentName: varchar('student_name', { length: 200 }),    // 学生姓名（1对1）
  className: varchar('class_name', { length: 200 }),        // 班课名称

  // 创建时同步查询并存储快照
  // 优点：查询性能好，Financial Domain 数据自包含
  // 缺点：快照可能过时（接受，符合审计要求）
});

// 创建时存储快照
async createBillingRecord(dto) {
  // 查询相关信息
  let sessionTitle = null;
  let studentName = null;
  let className = null;

  if (dto.sessionId) {
    const session = await sessionService.findById(dto.sessionId);
    sessionTitle = session.title;
    const student = await userService.findById(session.studentId);
    studentName = student.name;
  }

  if (dto.classId) {
    const classInfo = await classService.findById(dto.classId);
    className = classInfo.name;
  }

  // 创建记录并存储快照
  return await db.insert(mentorPayableLedgers).values({
    ...dto,
    sessionTitle,
    studentName,
    className,
  });
}
```

**决策总结：**
- **存储快照**：sessionTitle, studentName, className
- **创建时存储**：同步查询并存储快照
- **不更新**：接受快照过时（符合审计要求，历史记录应保持创建时状态）

#### 8.3.2 快照 vs 实时查询对比

| 方案 | 实现方式 | 优点 | 缺点 | 决策 |
|------|---------|------|------|------|
| **快照存储** | 创建时存储关联对象名称 | 性能好，无需跨域查询 | 数据可能过时 | ✅ **采用** |
| **实时查询** | 通过 Services 查询 | 数据实时 | 性能差，N+1 问题 | ❌ 否决 |
| **冗余存储** | 存储所有关联字段 | 查询性能好 | 数据冗余，同步复杂 | ❌ 否决 |

** 设计理念：** 历史记录应该保持创建时的状态，而不是实时状态（符合审计和合规要求）

---

### 8.4 查询容错处理

#### 8.4.1 孤儿记录检测

**问题**：如果 class 被删除，class_mentor_prices 和 mentor_payable_ledgers 可能变成孤儿记录

**决策**：**查询时检测并标记异常**（选项 A）

```typescript
// 查询 mentor_payable_ledgers 时检测孤儿记录
async getMentorBilling(mentorId: string, filters: QueryFilters) {
  const billings = await db.query.mentorPayableLedgers.findMany({
    where: and(
      eq(mentorPayableLedgers.mentorId, mentorId),
      gte(mentorPayableLedgers.serviceCompletedAt, filters.startDate),
      lte(mentorPayableLedgers.serviceCompletedAt, filters.endDate)
    ),
    orderBy: desc(mentorPayableLedgers.serviceCompletedAt),
  });

  // 检测班课服务关联的 class 是否存在
  return await Promise.all(
    billings.map(async (billing) => {
      const isOrphan = billing.classId && !(await classService.exists(billing.classId));

      return {
        ...billing,
        _orphan: isOrphan,  // 标记异常
        _warning: isOrphan ? '关联的班课已不存在' : null,
        _metadata: isOrphan ? { orphanReason: 'class_deleted' } : null,
      };
    })
  );
}

// 前端显示
// {
//   id: 'billing-001',
//   amount: 120.00,
//   className: '求职冲刺班 2025Q4',
//   _orphan: true,
//   _warning: '关联的班课已不存在',
// }
```

**决策总结：**
- ✅ **不隐藏问题**：返回数据但标记异常
- ✅ **不删除数据**：保留历史记录，即使关联对象已删除
- ✅ **明确提示**：前端显示警告，提示数据异常
- ✅ **便于排查**：_orphan 标记方便过滤和统计

#### 8.4.2 定期一致性检查（决策：不需要）

**选项对比：**

| 选项 | 检查频率 | 处理方式 | 决策 |
|------|---------|---------|------|
| A | 每日检查 + 告警 | 发送告警，人工处理 | ❌ 否决 |
| B | 每周检查 + 自动修复 | 自动标记或删除 | ❌ 否决 |
| C | 按需检查 | 手动运行脚本 | ✅ **采用** |

**理由：**
- 孤儿记录产生概率低（有事件同步机制）
- 查询时已标记异常，不影响业务
- 定期检查增加系统复杂度
- 按需检查足够（发现问题再处理）

**实现方案：按需检查**
```typescript
// 提供手动检查脚本
// npm run check:integrity

// 脚本功能：
// 1. 检查 class_mentor_prices 的孤儿记录
// 2. 检查 mentor_payable_ledgers 的孤儿记录
// 3. 生成 HTML/JSON 报告
// 4. 不自动修复（需要人工确认）

// 使用示例
const integrityChecker = new CrossDomainIntegrityChecker();
const report = await integrityChecker.check();
console.log('发现 ${report.orphanRecords.length} 条孤儿记录');
await integrityChecker.generateReport(report, './integrity-report.html');
```

---

### 8.5 跨域协作决策汇总

| 议题 | 问题 | 决策 | 实现方式 | 原因 |
|------|------|------|---------|------|
| **1. class_mentor_prices 验证** | classId 不存在如何处理？ | ** 严格验证 ** | 抛出异常 | 防止孤儿记录 |
| ** 2. class 删除处理 ** | 关联记录如何处理？ | ** 事件通知 + 标记非激活 ** | 监听 class.deleted 事件 | 保留历史数据 |
| ** 3. class 变更同步 ** | 快照是否更新？ | ** 不更新 ** | 接受快照过时 | 符合审计要求 |
| ** 4. mentor_payable_ledgers 查询 ** | 1对1 和 班课如何查询？ | ** UNION ALL ** | 单查询，性能优先 | 性能好，利用索引 |
| ** 5. 快照存储 ** | 是否存储快照？ | ** 存储快照 ** | sessionTitle, studentName, className | 无需跨域查询 |
| ** 6. 快照更新 ** | class 变更是否更新快照？ | ** 不更新 ** | 接受快照过时 | 历史记录应保持原样 |
| ** 7. 定期一致性检查 ** | 是否需要定时任务？ | ** 不需要 ** | 按需手动检查 | 复杂度低，足够用 |
| ** 8. 查询容错 ** | 孤儿记录如何处理？ | ** 标记异常 ** | _orphan: true, _warning | 不隐藏问题，便于排查 |

---

## 📌 设计原则总结

### ✅ DO（正确的做法）

1. **权责分离**：Financial Domain 只管理财务数据，不干预业务逻辑
2. **事件驱动**：跨域数据变更使用事件通知，而非直接调用
3. **最终一致性**：通过事件驱动保证各域数据最终一致
4. **Append-Only**：流水表记录不可修改，保证审计追踪完整性
5. **金额精度**：单价保留1位小数，总额保留2位小数
6. **快照设计**：关键金额字段保存快照，防止参数变更影响历史数据
7. **财务确认**：不对接第三方支付，由财务手动确认到账
8. **跨域防腐**：通过参数传入而非直接数据库访问

### ❌ DON'T（错误的做法）

1. **禁止直接修改跨域数据**：Financial 不能直接写 Contract 的表
2. **禁止绕过事件直接更新**：必须通过事件通知让数据拥有者自己更新
3. **禁止跨域事务**：不使用分布式事务，采用 Saga 模式
4. **禁止循环依赖**：避免 A 依赖 B，B 又依赖 A
5. **禁止修改流水记录**：Append-only 表不提供 UPDATE/DELETE 接口
6. **禁止顾问参与收益**：顾问不参与收益分配，不在任何收益相关表中出现

---

**文档维护者：** Claude Code
**最后更新：** 2025-11-12
**关联文档：**
- BILLING_MODULE_DESIGN.md (主设计文档)
- CONTRACT_DOMAIN_DESIGN.md (合同域设计)
- CATALOG_DOMAIN_DESIGN.md (产品域设计)
