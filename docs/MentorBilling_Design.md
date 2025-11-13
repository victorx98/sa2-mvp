# 导师计费服务设计

> 版本：v2.22
> 最后更新：2025-11-13
> 状态：设计完成
> 关联文档：6-FinancialDomain_Design.md

## 1. 核心数据模型

### 1.1 导师应付账款流水表（mentor_payable_ledgers）

**表定义：**

```typescript
export const mentorPayableLedgers = pgTable('mentor_payable_ledgers', {
  id: uuid('id').primaryKey().defaultRandom(),

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

  // 快照字段（避免跨域查询）
  sessionTitle: varchar('session_title', { length: 200 }), // 1对1服务标题
  studentName: varchar('student_name', { length: 200 }), // 学生姓名（1对1）
  className: varchar('class_name', { length: 200 }), // 班课名称

  // 备注
  notes: text('notes'),
  metadata: json('metadata'),

  // 审计字段（软 Append-only：允许更新 settlementStatus/status）
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(), // 用于状态更新
});
```

**字段说明：**

| 字段 | 类型 | 说明 |
|-----|------|------|
| `quantity` | integer | 服务数量（正数=正常服务，负数=申诉调整） |
| `unitPrice` | numeric(12,1) | 单价（美元，保留1位小数） |
| `totalAmount` | numeric(12,2) | 总额（美元，精确到分） |
| `settlementStatus` | enum | settlement_status_enum: pending/settled/appealed/appeal_rejected |
| `adjustmentReason` | varchar | 调整原因（quantity为负时必填） |
| `sessionTitle` | varchar | 服务标题快照（创建时存储） |
| `studentName` | varchar | 学生姓名快照（创建时存储） |
| `className` | varchar | 班课名称快照（创建时存储） |

**关键特性：**

- **多服务模式**：支持 1对1 服务（sessionId）和班课服务（classId）
- **软 Append-only**：仅允许更新 settlementStatus、status 等状态字段，核心财务数据不可修改
- **settlementStatus 状态**：
  - `pending`：待结算（默认状态）
  - `settled`：已结算（完成支付）
  - `appealed`：申诉中（不参与结算，通过申诉表处理）
  - `appeal_rejected`：申诉被拒绝（恢复为待结算状态）
- **快照设计**：sessionTitle、studentName、className 在创建时存储，避免跨域查询
- **负数调整**：quantity 为负数时表示申诉调整或退款，adjustmentReason 必填

### 1.2 导师定价配置表（mentor_prices）

**表定义：**

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
  createdBy: uuid('created_by').references(() => users.id),
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

**三种定价模式示例：**

**模式 1：按次计费（GAP分析）**
```typescript
{
  mentorId: "mentor-uuid-1",
  serviceType: "gap_analysis",
  pricingType: "per_service",
  unitPrice: 150.0,  // $150/次
  currency: "USD",
  isActive: true,
}
```

**模式 2：服务包计费（简历修改10次包）**
```typescript
{
  mentorId: "mentor-uuid-1",
  serviceType: "resume_review",
  pricingType: "package",
  packageName: "10次包",
  packageQuantity: 10,
  packagePrice: 800.00,  // 总价 $800
  unitPrice: 80.0,       // 平均单价 $80/次
  currency: "USD",
  isActive: true,
}
```

**模式 3：阶段性计费（内推三阶段）**
```typescript
// 需要创建3条记录，每条对应一个阶段
{
  mentorId: "mentor-uuid-1",
  serviceType: "internal_referral",
  pricingType: "staged",
  stageName: "简历提交阶段",
  unitPrice: 300.0,
  currency: "USD",
  isActive: true,
}
```

**关键特性：**

- **统一支持三种模式**：按次计费、服务包计费、阶段性计费全部在一张表实现
- **价格版本控制**：通过 effectiveFrom/effectiveUntil 管理价格历史
- **灵活配置**：package 和 staged 模式使用专用字段存储配置信息
- **整数 quantity**：所有模式都使用 quantity 字段表示服务数量


### 1.4 班课导师定价配置表（class_mentor_prices）

**表定义：**

```typescript
export const classMentorPrices = pgTable('class_mentor_prices', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 关联关系（跨域引用，注释外键）
  // ⚠️ classes 表定义在 Services Domain，不使用外键约束
  classId: uuid('class_id').notNull(), // 注释外键：关联 Services Domain 的 classes
  mentorId: uuid('mentor_id').notNull().references(() => users.id),

  // 服务类型（使用枚举，直接关联，无需查询 services 表）
  serviceType: serviceTypeEnum('service_type').notNull(),

  // 定价信息（按场次、按学生、按小时三种模式）
  unitPrice: numeric('unit_price', { precision: 12, scale: 1 }).notNull(), // 单价
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),

  // 计费模式（决定如何计算总费用）
  billingMode: billingModeEnum('billing_mode').notNull(), // per_session/by_student/hourly

  // 状态管理
  isActive: boolean('is_active').notNull().default(true),

  // 备注
  notes: varchar('notes', { length: 500 }),

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
});

// 唯一约束：同一班级中，同一导师对同一服务只能有一条定价
// CREATE UNIQUE INDEX idx_class_mentor_prices_unique
// ON class_mentor_prices(class_id, mentor_id, service_type);
```

**计费模式（billingMode）：**

```typescript
export const billingModeEnum = pgEnum('billing_mode', [
  'per_session',  // 按场次计费（固定费用，与学生数无关）
  'by_student',   // 按学生计费（单价 × 学生人数）
  'hourly',       // 按小时计费（单价 × 小时数）
]);
```

**三种计费模式示例：**

**模式 1：按场次计费（固定费用）**
```typescript
// 导师组织一次班课辅导，固定收费 $120（不管多少个学生）
{
  classId: "class-uuid-001",    // "求职冲刺班 2025Q4"
  mentorId: "mentor-uuid-001",
  serviceType: "gap_analysis",

  billingMode: "per_session",
  unitPrice: 120.0,              // $120/场次
  currency: "USD",

  isActive: true,
}

// 服务完成后创建 billing 记录
totalAmount = unitPrice × 1 = $120  // 与学生人数无关
```

**模式 2：按学生计费（按人头分成）**
```typescript
// 班课有5个学生，导师收费 = $30 × 5 = $150
{
  classId: "class-uuid-001",
  mentorId: "mentor-uuid-001",
  serviceType: "resume_review",

  billingMode: "by_student",
  unitPrice: 30.0,               // $30/学生
  currency: "USD",

  isActive: true,
}

// 服务完成后创建 billing 记录（需要传入学生数量）
totalAmount = unitPrice × studentCount = $30 × 5 = $150
```

**模式 3：按小时计费（按时间收费）**
```typescript
{
  classId: "class-uuid-001",
  mentorId: "mentor-uuid-001",
  serviceType: "workshop",

  billingMode: "hourly",
  unitPrice: 100.0,              // $100/小时
  currency: "USD",

  isActive: true,
}

// 服务完成后创建 billing 记录（需要传入服务时长）
totalAmount = unitPrice × hours = $100 × 2 = $200  // 2小时工作坊
```

**关键特性：**

- **混合计费模式**：支持按场次、按学生、按小时三种计费方式
- **跨域引用**：classId 注释外键，通过应用层验证（调用 ClassService）
- **价格固定**：班课创建后价格固定，无版本控制（effective period）
- **查询优化**：在 mentor_payable_ledgers 中存储 className 快照，避免 JOIN

**计费流程：**

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

// 根据计费模式计算费用
let totalAmount: number;
if (price.billingMode === 'per_session') {
  totalAmount = price.unitPrice;  // 固定费用
} else if (price.billingMode === 'by_student') {
  totalAmount = price.unitPrice * studentCount;  // 单价 × 学生人数
} else if (price.billingMode === 'hourly') {
  totalAmount = price.unitPrice * hours;  // 单价 × 小时数
}

// 创建 mentor_payable_ledgers 记录（班课服务）
await db.insert(mentorPayableLedgers).values({
  classId: classId,
  sessionId: null,
  mentorId: mentorId,
  studentId: null,  // 班课按场次计费，不关联具体学生

  serviceType: serviceType,
  serviceName: `班课-${classInfo.name}`,

  quantity: 1,  // 1场次
  unitPrice: price.unitPrice,
  totalAmount: totalAmount,

  serviceCompletedAt: new Date(),
  status: 'pending',
  settlementStatus: 'pending',

  // 存储快照
  className: classInfo.name,
});
```


**关键特性**


## 2. 计费触发机制

### 2.1 事件驱动模式

```
服务完成（Services Domain）
    ↓
发布领域事件（event bus）
    ↓
Financial Domain 监听事件
    ↓
自动创建 mentor_payable_ledgers
    ↓
发布 billing.ledger_created 事件
```

**监听的事件清单：**

| 事件名称 | 来源域 | 业务场景 | 处理逻辑 |
|---------|--------|---------|---------|
| `services.session.completed` | Services | 1对1服务完成 | 查询 mentor_prices，创建计费记录 |
| `services.class.completed` | Services | 班课服务完成 | 查询 class_mentor_prices，创建计费记录 |
| `placement.referral.resume_submitted` | Placement | 内推-简历提交 | 查询 mentor_prices，创建第1阶段计费 |
| `placement.referral.interview_passed` | Placement | 内推-面试通过 | 查询 mentor_prices，创建第2阶段计费 |
| `placement.referral.offer_received` | Placement | 内推-Offer接收 | 查询 mentor_prices，创建第3阶段计费 |

**事件处理示例（Services.session.completed）：**

```typescript
@OnEvent('services.session.completed', { async: true })
async handleSessionCompleted(event: SessionCompletedEvent) {
  const { sessionId, mentorId, studentId, serviceType, duration } = event.payload;

  // 1. 查询价格配置
  const price = await this.db.query.mentorPrices.findFirst({
    where: and(
      eq(mentorPrices.mentorId, mentorId),
      eq(mentorPrices.serviceType, serviceType),
      eq(mentorPrices.isActive, true)
    ),
    orderBy: desc(mentorPrices.effectiveFrom),
  });

  if (!price) {
    // 发布价格缺失告警事件
    await this.eventBus.publish('financial.billing.pricing_missing', {
      mentorId,
      serviceType,
    });
    throw new Error(`Price not found for mentor ${mentorId}, service ${serviceType}`);
  }

  // 2. 查询关联信息（用于快照）
  const session = await this.sessionService.findById(sessionId);
  const student = await this.userService.findById(studentId);

  // 3. 计算费用
  const totalAmount = price.unitPrice * (duration || 1);

  // 4. 幂等性检查：防止重复创建
  const existing = await this.db.query.mentorPayableLedgers.findFirst({
    where: eq(mentorPayableLedgers.sessionId, sessionId),
  });

  if (existing) {
    this.logger.warn(`Billing record already exists for session ${sessionId}`);
    return existing;
  }

  // 5. 创建计费记录（存储快照）
  const [billing] = await this.db.insert(mentorPayableLedgers).values({
    sessionId,
    mentorId,
    studentId,
    classId: null,

    serviceType: serviceType,
    serviceName: session.title,
    quantity: 1,

    unitPrice: price.unitPrice,
    totalAmount: totalAmount,
    currency: price.currency,

    status: 'pending',
    settlementStatus: 'pending',
    serviceCompletedAt: new Date(),

    // 快照字段
    sessionTitle: session.title,
    studentName: student.name,

    notes: `Auto-generated from session completion`,
  }).returning();

  // 6. 发布计费记录创建事件
  await this.eventBus.publish('financial.billing.ledger_created', {
    billingLedgerId: billing.id,
    mentorId: billing.mentorId,
    totalAmount: billing.totalAmount,
  });

  return billing;
}
```

**幂等性保证：**

```typescript
// 使用 ON CONFLICT 或前置检查防止重复
CREATE UNIQUE INDEX idx_mentor_payable_session
ON mentor_payable_ledgers(session_id)
WHERE session_id IS NOT NULL;

CREATE UNIQUE INDEX idx_mentor_payable_class
ON mentor_payable_ledgers(class_id)
WHERE class_id IS NOT NULL;
```

### 2.2 事件处理失败补偿

```typescript
// 定时任务：扫描未计费的服务记录（每天凌晨执行）@Cron('0 2 * * *')
async compensateMissingLedgers() {
  // 查询最近3天已完成但无计费记录的服务
  const sessionsWithoutBilling = await this.db.execute(sql` SELECT s.id, s.mentor_id, s.service_type FROM sessions s LEFT JOIN mentor_payable_ledgers m ON s.id = m.session_id WHERE s.status = 'completed' AND m.id IS NULL AND s.completed_at > ${subDays(new Date(), 3)} `);

  // 自动补录
  for (const session of sessionsWithoutBilling) {
    try {
      await this.handleSessionCompleted({
        payload: { sessionId: session.id, ... }
      });
    } catch (error) {
      this.logger.error(`Failed to compensate billing for session ${session.id}`, error);
      // 发送告警通知
    }
  }
}
```


## 3. 费用计算逻辑

### 3.1 实时计算 + 快照存储

**核心原则：** 不在 mentor_payable_ledgers 中存储价格引用，而是**事件触发时实时计算并存储金额快照**。

```
服务完成事件到达
    ↓
查询 mentor_prices（实时价格）
    ↓
实时计算费用 totalAmount = unitPrice × quantity
    ↓
创建 mentor_payable_ledgers 记录
    ↓
存储 unitPrice、totalAmount 快照
    ↓
后续价格变更不影响已创建记录
```

**为什么需要快照：**

| 场景 | 无快照（实时查询） | 有快照 |
|-----|-------------------|--------|
| 导师调价（$150 → $160） | 历史记录金额会变化 ❌ | 历史记录保持原价 ✅ |
| 结算时对账 | 无法追溯到原始金额 ❌ | 金额与签约时一致 ✅ |
| 审计要求 | 不符合财务规范 ❌ | 符合审计要求 ✅ |

### 3.2 不同服务类型的计算逻辑

**1对1服务（session）：**
```typescript
// 查询导师价格
const price = await mentorPriceService.findByMentorAndService(mentorId, serviceType);

// 计算费用
const totalAmount = price.unitPrice * duration;  // duration 为服务时长（小时）

// 创建记录
await mentorPayableLedgersRepo.create({
  sessionId,
  classId: null,
  mentorId,
  studentId,
  unitPrice: price.unitPrice,      // 存储快照
  totalAmount: totalAmount,        // 存储快照
  quantity: duration,
});
```

**班课服务（class）：**
```typescript
// 查询班课定价
const price = await classMentorPriceService.findByClassAndMentor(classId, mentorId, serviceType);

// 根据计费模式计算
let totalAmount: number;
if (price.billingMode === 'per_session') {
  totalAmount = price.unitPrice;  // 固定费用
} else if (price.billingMode === 'by_student') {
  totalAmount = price.unitPrice * studentCount;  // 单价 × 学生数
} else if (price.billingMode === 'hourly') {
  totalAmount = price.unitPrice * hours;  // 单价 × 小时数
}

// 创建记录
await mentorPayableLedgersRepo.create({
  sessionId: null,
  classId,
  mentorId,
  studentId: null,  // 班课不关联具体学生
  unitPrice: price.unitPrice,      // 存储快照
  totalAmount: totalAmount,        // 存储快照
  quantity: 1,  // 1场次
});
```

**阶段性服务（staged）：**
```typescript
// 内推三阶段，每个阶段独立计费
// placement.referral.resume_submitted → stageName='简历提交'
// placement.referral.interview_passed → stageName='面试通过'
// placement.referral.offer_received → stageName='Offer接收'

const price = await mentorPriceService.findByStage(
  mentorId,
  'internal_referral',
  stageName
);

await mentorPayableLedgersRepo.create({
  sessionId: null,
  classId: null,
  mentorId,
  studentId,
  stageName: price.stageName,
  unitPrice: price.unitPrice,
  totalAmount: price.unitPrice,    // 每个阶段固定费用
  quantity: 1,
});
```


## 4. 服务接口

## 5. 业务流程

### 5.1 导师结算流程

1. **触发条件**：每月固定日期或手动触发
2. **执行步骤**：
    - 系统筛选指定周期内已完成服务但未结算的 `mentor_payable_ledgers` 记录
    - 根据 `settlement_parameters` 计算扣除项（平台服务费、退款等）
    - 创建 `settlement_ledgers` 记录，状态为 `calculated`
    - 财务确认结算单，更新状态为 `confirmed`
    - 财务确认支付完成，更新状态为 `paid`
3. **结果更新**：
    - 更新相关 `mentor_payable_ledgers` 记录状态为 `settled`

## 6. 技术实现要点

### 6.1 查询优化

**使用 UNION ALL 单查询获取导师账单：**

```typescript
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
```

**索引优化：**

```sql
CREATE INDEX idx_mentor_payable_session ON mentor_payable_ledgers(mentor_id, session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_mentor_payable_class ON mentor_payable_ledgers(mentor_id, class_id) WHERE class_id IS NOT NULL;
```

### 4.2 快照设计

- **存储策略**：创建 `mentor_payable_ledgers` 记录时同步查询并存储关联服务标题、学生姓名等信息
- **不更新策略**：历史记录应保持创建时的状态，不随关联对象变更而更新
- **目的**：提高查询性能，避免跨域查询，符合审计要求

### 4.3 查询容错处理

**孤儿记录检测：**

```typescript
async getMentorBilling(mentorId: string, filters: QueryFilters) {
  // 查询账单记录
  const billings = await db.query.mentorPayableLedgers.findMany({/*...*/});

  // 检测并标记异常记录
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
```

## 7. 版本变更历史

| 版本 | 日期 | 主要变更 | 影响表 | 决策说明 |
|------|------|---------|-------|---------|
| v2.22 | 2025-11-13 | 新增计费触发机制章节 | - | 采用事件驱动 + 补偿机制 |
| v2.22 | 2025-11-13 | 新增费用计算逻辑章节 | mentor_payable_ledgers | 采用实时计算 + 快照存储 |
| v2.22 | 2025-11-13 | 更新 mentor_payable_ledgers 表结构 | mentor_payable_ledgers | 软 Append-only，新增快照字段 |
| v2.22 | 2025-11-13 | 更新 mentor_prices 表结构 | mentor_prices | 统一支持三种定价模式 |
| v2.22 | 2025-11-13 | 更新 class_mentor_prices 表结构 | class_mentor_prices | 支持三种计费模式（per_session/by_student/hourly） |
| v2.22 | 2025-11-13 | 创建 MentorBilling_Design.md | All | 将计费设计独立成文档 |


## 8. 设计原则

- **权责分离**：Financial Domain 只管理财务数据，不干预业务逻辑
- **事件驱动**：跨域数据变更使用事件通知，而非直接调用
- **软 Append-only**：仅允许更新状态字段，核心财务数据不可修改
- **金额精度**：单价保留1位小数，总额保留2位小数（符合财务规范）
- **快照设计**：关键金额字段保存快照，防止参数变更影响历史数据
- **实时计算**：事件触发时实时查询价格并计算，保证准确性
- **最终一致性**：通过事件驱动保证各域数据最终一致
- **幂等性**：防止重复创建计费记录（唯一索引 + 前置检查）
