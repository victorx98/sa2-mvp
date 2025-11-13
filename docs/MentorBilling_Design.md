# 导师计费服务设计

## 1. 核心数据模型

### 1.1 导师应付账款流水表（mentor_payable_ledgers）

**表定义：**

```typescript
export const mentorPayableLedgers = pgTable('mentor_payable_ledgers', {
  id: uuid('id').primaryKey().defaultRandom(),
  mentorId: uuid('mentor_id').notNull(),
  month: varchar('month', { length: 7 }).notNull(), // 格式: YYYY-MM, 使用 insert 触发时自动填充

  // 服务信息
  class_id: uuid('class_id').default(null), // 班课时的班课ID
  packageId: uuid('package_id').default(null), // 服务包计费时的服务包ID，与 sessionId 互斥
  sessionId: uuid('session_id').default(null), // 会话计费时的会话ID，与 packageId 互斥
  billingMode: enum('billing_mode', ['one_time', 'per_session', 'package', 'stage']).notNull(),
  stage: varchar('stage', { length: 100 }).default(null), // 阶段性计费时的阶段名称

  // 金额信息
  unitPrice: decimal('unit_price', { precision: 10, scale: 1 }).notNull(), // 单价
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(), // 总额
  currency: varchar('currency', { length: 3 }).default('USD'), // 货币类型

  // 结算状态
  settlementStatus: enum('settlement_status', ['pending', 'settled', 'appealed']).default('pending'),

  // 元数据，用于存储额外的快照信息数据，如：课程名称、学生名称、班课名称等
  metadata: json('metadata'),

  // 时间信息
  serviceCompletedAt: timestamp('service_completed_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

**关键特性：**

- 支持按次计费（one_time）、按会话计费（per_session）、服务包计费（package）、阶段性计费（stage）
- 阶段性计费时，需要记录阶段名称
- 按包计费时，需要记录服务包ID，和包的报价(记录在 unitPrice 字段中)
- 金额计算：unitPrice（单价，1位小数）和totalAmount（总额，2位小数）
- 结算状态管理：pending（待结算）、settled（已结算）、appealed（已申诉）
- 快照存储：存储关联对象名称，避免跨域查询

### 1.2 导师定价配置表（mentor_prices）

**定价模式：**

1. **按次计费（one_time）**

    ```typescript
    { mode: 'one_time', unitPrice: 120.0 }
    ```

2. **服务包计费（package）**

    ```typescript
    {
      mode: 'package',
      packagePrice: 3600.0,
      sessionCount: 30,
      unitPrice: 120.0
    }
    ```

3. **阶段性计费（stage）**
    ```typescript
    {
      mode: 'stage',
      stages: [
        { name: '基础', hours: 10, unitPrice: 100.0 },
        { name: '进阶', hours: 20, unitPrice: 120.0 },
        { name: '高级', hours: 50, unitPrice: 150.0 }
      ]
    }
    ```

### 1.3 结算记录表（settlement_ledgers）

**表定义：**

```typescript
export const settlementLedgers = pgTable('settlement_ledgers', {
  id: uuid('id').primaryKey().defaultRandom(),
  mentorId: uuid('mentor_id').notNull(),

  // 金额信息
  originalAmount: decimal('original_amount', { precision: 10, scale: 2 }).notNull(), // 原始应付金额
  deductionAmount: decimal('deduction_amount', { precision: 10, scale: 2 }).default('0'), // 扣除项总和
  feeAmount: decimal('fee_amount', { precision: 10, scale: 2 }).default('0'), // 结算方式手续费
  actualAmount: decimal('actual_amount', { precision: 10, scale: 2 }).notNull(), // 实际结算金额

  // 结算信息
  settlementPeriod: varchar('settlement_period', { length: 7 }).notNull(), // YYYY-MM格式
  settlementMethod: enum('settlement_method', ['bank_transfer', 'alipay', 'wechat']).default('bank_transfer'),

  // 状态管理
  status: enum('status', ['calculated', 'confirmed', 'paid', 'failed', 'canceled']).default('calculated'),

  // 时间信息
  calculatedAt: timestamp('calculated_at').defaultNow(),
  confirmedAt: timestamp('confirmed_at'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

## 2. 服务接口

### 2.1 SettlementService 主要方法

```typescript
interface SettlementService {
    // 创建导师结算单
    createSettlement(mentorId: string, period: string): Promise<SettlementDto>;

    // 确认结算单
    confirmSettlement(settlementId: string): Promise<SettlementDto>;

    // 更新结算状态为已支付
    markAsPaid(settlementId: string): Promise<SettlementDto>;

    // 计算导师待结算金额
    calculatePendingSettlement(mentorId: string, period: string): Promise<{ totalAmount: number }>;

    // 查询导师结算记录
    getMentorSettlements(mentorId: string, pagination: PaginationDto): Promise<PaginatedResult<SettlementDto>>;
}
```

## 3. 业务流程

### 3.1 导师结算流程

1. **触发条件**：每月固定日期或手动触发
2. **执行步骤**：
    - 系统筛选指定周期内已完成服务但未结算的 `mentor_payable_ledgers` 记录
    - 根据 `settlement_parameters` 计算扣除项（平台服务费、退款等）
    - 创建 `settlement_ledgers` 记录，状态为 `calculated`
    - 财务确认结算单，更新状态为 `confirmed`
    - 财务确认支付完成，更新状态为 `paid`
3. **结果更新**：
    - 更新相关 `mentor_payable_ledgers` 记录状态为 `settled`

## 4. 技术实现要点

### 4.1 查询优化

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

## 5. 设计原则

- **权责分离**：Financial Domain 只管理财务数据，不干预业务逻辑
- **事件驱动**：跨域数据变更使用事件通知
- **Append-Only**：流水表记录不可修改，保证审计追踪完整性
- **金额精度**：单价保留1位小数，总额保留2位小数
- **快照设计**：关键信息保存快照，防止参数变更影响历史数据
- **最终一致性**：通过事件驱动保证各域数据最终一致
