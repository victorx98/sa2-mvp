# Financial Domain 详细设计文档

## 📋 版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2025-11-10 | Claude | 基于实际代码实现重新设计，移除第三方支付，区分 Student/Mentor 双角色 |

---

## 1. 领域概述

### 1.1 领域定位
Financial Domain 是 SA2-MVP MentorX 平台的核心计费与财务结算领域，基于 Catalog Domain（产品目录）和 Contract Domain（合同）之上构建，负责：
- **合同计费和消费跟踪**
- **服务权益管理**
- **账单生成与对账**
- **财务结算与报表**

### 1.2 核心原则
- **以合同为中心**：所有计费行为围绕合同展开
- **服务台账可追溯**：所有消费记录永久保存，支持审计
- **权益快照机制**：合同签署时冻结服务信息，保证历史一致性
- **双角色分离设计**：Student（学生/客户）和 Mentor（导师/服务提供方）有独立的财务流程

---

## 2. 核心实体设计

### 2.1 合同实体（Contract Aggregate）

#### 实体属性
```typescript
interface Contract {
  id: string;                      // UUID
  contractNumber: string;          // 格式: CONTRACT-YYYY-MM-NNNNN
  studentId: string;               // 学生ID（防腐层：字符串引用）
  mentorId: string;                // 导师ID（防腐层：字符串引用）
  productId: string;               // 产品ID（catalog域）
  productSnapshot: ProductSnapshot; // 产品快照（签署时冻结）

  // 价格信息
  productAmount: number;           // 产品原价
  contractAmount: number;          // 合同成交价（支持覆盖）
  overrideReason?: string;         // 价格覆盖原因
  approvedBy?: string;             // 价格审批人

  // 生命周期状态
  status: 'draft' | 'signed' | 'active' | 'suspended' | 'completed' | 'terminated';

  // 时间属性
  signedAt?: Date;                 // 签署时间
  activatedAt?: Date;              // 激活时间
  expiresAt: Date;                 // 过期时间（基于产品有效期）
  createdAt: Date;
  updatedAt: Date;
}
```

#### 状态机流转
```
draft（草稿）
  ↓ [sign()]
signed（已签署，等待支付）
  ↓ [payment.succeeded事件触发]
active（已激活，服务可用）
  ↓ [suspend()] / [事件触发]
suspended（已暂停）
  ↓ [resume()]
active（恢复）
  ↓ [complete()] / [terminate()]
completed（正常完成） or terminated（提前终止）
```

#### 业务规则
- **合同编号自动生成**：签署时生成，不可重复
- **价格覆盖需审批**：overrideAmount 必须在 [10%, 200%] 范围内，需提供理由和审批人
- **产品快照不可变**：签署后 productSnapshot 冻结，防止产品变更影响历史合同
- **过期时间计算**：activatedAt + product.validityDays

---

## 3. Student 角色财务流程（学生端）

### 3.1 角色定义
**Student（学生/客户）** 是服务购买方，核心财务流程包括：
- 浏览和选择产品
- 签署合同并支付
- 使用服务（消耗权益）
- 查看消费记录和账单

### 3.2 Student 核心业务流程

#### 3.2.1 合同创建与签署流程

**流程图：**
```
学生浏览产品
    ↓
选择产品并提交合同申请
    ↓
系统生成产品快照
    ↓
合同状态 = draft（草稿）
    ↓
学生确认并签署合同
    ↓
合同状态 = signed（已签署）
    ↓
触发 payment.succeeded 事件
    ↓
系统自动激活合同
    ↓
生成服务权益
    ↓
合同状态 = active（已激活）
```

**详细步骤：**

1. **产品选择阶段**
   ```typescript
   // 学生从 Catalog Domain 选择产品
   const product = await catalogService.getProduct(productId);

   // 系统验证产品状态（必须为 active）
   if (product.status !== 'active') {
     throw new Error('Product is not available');
   }
   ```

2. **合同草稿生成**
   ```typescript
   // 生成产品快照（防篡改）
   const productSnapshot = await productService.generateSnapshot(productId);

   // 创建草稿合同
   const contract = await contractRepository.create({
     studentId: currentUser.id,
     mentorId: product.mentorId,  // 产品关联的导师
     productId: product.id,
     productSnapshot,  // 冻结产品信息
     productAmount: product.price,
     contractAmount: overrideAmount || product.price,
     overrideReason,
     approvedBy: overrideAmount ? managerId : null,
     status: 'draft'
   });
   ```

3. **合同签署**
   ```typescript
   // 学生签署合同
   await contractService.sign(contractId, signedBy);

   // 签署后状态变为 signed，等待支付事件
   ```

4. **支付成功触发激活**
   ```typescript
   // PaymentSucceededListener 监听支付事件
   @OnEvent('payment.succeeded')
   async handlePaymentSucceeded(event: PaymentSucceededEvent) {
     const { contractId } = event;

     // 激活合同
     await this.contractService.activate(contractId);

     // 生成服务权益
     await this.entitlementService.createFromProductSnapshot(
       contractId,
       contract.productSnapshot
     );
   }
   ```

**业务规则：**
- 学生只能签署自己创建的合同
- 价格覆盖需要管理员审批，学生无权限
- 合同一旦签署，产品快照不可更改
- 支付必须在 7 天内完成，否则合同自动失效

#### 3.2.2 服务消费流程

**流程图：**
```
学生预约/参加会话
    ↓
会话完成触发预留（可选）
    ↓
系统扣减服务权益
    ↓
生成服务台账记录
    ↓
触发对账流程
    ↓
更新账单
```

**详细步骤：**

1. **会话预约（创建预留）**
   ```typescript
   // 学生预约会话时创建预留
   const hold = await serviceHoldService.create({
     contractId,
     serviceType: 'resume_review',
     quantity: 1,
     sessionId: upcomingSession.id,
     reason: 'session_booking'
   });

   // 预留成功后，权益可用数量减少
   // 但尚未计入实际消耗
   ```

2. **会话完成与消费**
   ```typescript
   // 会话完成事件触发消费
   @OnEvent('session.completed')
   async handleSessionCompleted(event: SessionCompletedEvent) {
     const { sessionId, contractId, serviceType } = event;

     // 查找相关预留（如果有）
     const hold = await serviceHoldService.findBySessionId(sessionId);

     // 执行服务消费
     await contractService.consumeService({
       contractId,
       serviceType,
       quantity: 1,
       sessionId,
       holdId: hold?.id  // 如果有预留，传入以释放
     });
   }
   ```

3. **权益扣减逻辑**
   ```typescript
   // 按优先级扣减权益
   async consumeService(command: ConsumeServiceCommand) {
     const entitlements = await entitlementRepository.findByContractAndType(
       command.contractId,
       command.serviceType
     );

     // 按优先级排序
     const sortedEntitlements = sortByConsumptionPriority(entitlements);
     for (const entitlement of sortedEntitlements) {
       if (remainingQuantity <= 0) break;
       const available = entitlement.totalQuantity - entitlement.consumedQuantity;
       const deductAmount = Math.min(remainingQuantity, available);
       await updateConsumedQuantity(contractId, serviceType, -deductAmount);
     }
   }
   ```

4. **生成台账记录**
   ```typescript
   // 生成不可修改的消费记录
   const ledgerEntry = await serviceLedgerRepository.create({
     contractId,
     holderId: command.studentId,  // 权益持有者
     serviceType: command.serviceType,
     entryType: 'consumption',      // 消费类型
     quantity: -command.quantity,   // 负数表示消耗
     sessionId: command.sessionId,
     metadata: { holdId: command.holdId }
   });
   ```

**业务规则：**
- 消费先使用 product 来源的权益，其次是 addon、promotion、compensation
- 相同服务类型的权益会自动合并计算
- 消耗记录永久保存，不可删除或修改
- 预留不会计入实际消耗，但会影响可用数量

#### 3.2.3 预留管理流程

**场景：会话预约**

```typescript
// 1. 创建预留（预约时）
const hold = await serviceHoldService.createHold({
  contractId: 'contract-001',
  serviceType: 'resume_review',
  quantity: 1,
  sessionId: 'session-001',
  reason: 'session_booking'
});

// 2. 会话取消（手动释放预留）
await serviceHoldService.releaseHold(holdId, 'session_cancelled');

// 3. 会话完成（消费时释放预留）
await contractService.consumeService({ holdId: 'hold-001' });
```

**预留监控：**
```typescript
// 查询长时间未释放的预留（默认 24 小时）
const overdueHolds = await serviceHoldService.findOverdueHolds({
  thresholdHours: 24
});
```

#### 3.2.4 账单查询流程

```typescript
// 查询学生自己的合同和账单
async getStudentBilling(studentId: string) {
  // 1. 查询所有合同
  const contracts = await contractRepository.findByStudentId(studentId);

  // 2. 查询合同权益使用情况
  for (const contract of contracts) {
    const entitlements = await entitlementRepository.findByContractId(contract.id);
    const ledgers = await serviceLedgerRepository.findByContractId(contract.id);

    return {
      contract,
      entitlements,  // 权益详情
      ledgers,       // 消费记录
      summary: {
        totalAmount: contract.contractAmount,
        consumedServices: ledgers.filter(l => l.entryType === 'consumption').length,
        remainingEntitlements: entitlements.map(e => ({
          serviceType: e.serviceType,
          remaining: e.totalQuantity - e.consumedQuantity
        }))
      }
    };
  }
}
```

### 3.3 Student 角色数据模型

#### 3.3.1 合同查询视图
```typescript
interface StudentContractView {
  contractNumber: string;
  productName: string;        // 从快照获取
  contractAmount: number;
  status: string;
  expiresAt: Date;

  // 权益概要
  entitlements: {
    serviceType: string;
    serviceName: string;      // 从快照获取
    totalQuantity: number;
    consumedQuantity: number;
    remainingQuantity: number;
  }[];

  // 消费记录
  recentConsumptions: {
    sessionId: string;
    serviceType: string;
    consumedAt: Date;
    quantity: number;
  }[];
}
```

---

## 4. Mentor 角色财务流程（导师端）

### 4.1 角色定义
**Mentor（导师/服务提供方）** 是服务提供方，核心财务流程包括：
- 创建和管理产品（服务、套餐）
- 查看合同和收入
- 管理财务结算
- 查看服务提供记录

### 4.2 Mentor 核心业务流程

#### 4.2.1 产品创建与管理流程

**流程图：**
```
导师提交产品创建申请
    ↓
产品状态 = draft（草稿）
    ↓
导师提交审核
    ↓
管理员审核通过
    ↓
产品状态 = active（上线可售）
    ↓
学生可看到并购买
```

**详细步骤：**

1. **创建产品（草稿）**
   ```typescript
   // 导师创建产品草稿
   const product = await productService.create({
     name: '简历精修服务',
     code: 'RESUME-PREMIUM',
     description: '专业导师一对一简历修改',
     price: 50000,  // 单位：分
     currency: 'CNY',
     validityDays: 365,  // 有效期 1 年

     // 服务配置
     services: [
       {
         serviceType: 'resume_review',
         name: '简历修改',
         billingMode: 'one_time',  // 单次计费
         quantity: 3  // 包含 3 次服务
       }
     ],

     status: 'draft',  // 初始状态为草稿
     createdBy: mentorId
   });
   ```

2. **添加服务包**
   ```typescript
   // 创建服务包（多个服务的组合）
   const servicePackage = await servicePackageService.create({
     name: '留学申请VIP套餐',
     description: '包含文书修改+推荐信+面试辅导',

     items: [
       {
         serviceType: 'resume_review',
         quantity: 5
       },
       {
         serviceType: 'recommendation_letter',
         quantity: 3
       },
       {
         serviceType: 'interview_prep',
         quantity: 2
       }
     ]
   });
   ```

3. **提交审核**
   ```typescript
   // 导师提交产品审核
   await productService.submitForReview(productId);
   // 状态变为: pending_review
   ```

4. **管理员审核（Mentor 无权限）**
   ```typescript
   // 管理员审核通过
   await productService.approve(productId, { approvedBy: adminId });
   // 状态变为: active（上线可售）
   ```

**业务规则：**
- 只有 mentor 可以创建自己的产品
- 产品必须经过管理员审核才能上线
- 已上线产品不能修改核心信息（价格、服务内容），只能下架
- 产品快照不包含 mentor 分成比例等财务信息（在结算时计算）

#### 4.2.2 收入查看与对账流程

**流程图：**
```
导师登录系统
    ↓
查看合同列表（仅自己产品）
    ↓
查看每个合同的收入
    ↓
查看服务提供记录
    ↓
月度/季度对账
```

**详细步骤：**

1. **查看合同列表**
   ```typescript
   // Mentor 查看自己产品的所有合同
   async getMentorContracts(mentorId: string) {
     // 查询该 mentor 的所有产品
     const products = await productRepository.findByMentorId(mentorId);
     const productIds = products.map(p => p.id);

     // 查询所有相关合同（已签署）
     const contracts = await contractRepository.findByProductIds(productIds);

     return contracts.map(contract => ({
       contractNumber: contract.contractNumber,
       studentId: contract.studentId,
       productName: contract.productSnapshot.name,
       contractAmount: contract.contractAmount,
       status: contract.status,
       signedAt: contract.signedAt,
       activatedAt: contract.activatedAt
     }));
   }
   ```

2. **查看收入明细**
   ```typescript
   // 查看合同收入详情
   async getMentorRevenue(mentorId: string) {
     const products = await productRepository.findByMentorId(mentorId);
     const productIds = products.map(p => p.id);

     // 查询所有已激活的合同
     const activeContracts = await contractRepository.findActiveByProductIds(productIds);

     // 计算总收入
     const totalRevenue = activeContracts.reduce(
       (sum, contract) => sum + contract.contractAmount,
       0
     );

     // 按产品统计
     const revenueByProduct = activeContracts.reduce((acc, contract) => {
       const productId = contract.productId;
       acc[productId] = (acc[productId] || 0) + contract.contractAmount;
       return acc;
     }, {});

     return {
       totalRevenue,
       totalContracts: activeContracts.length,
       revenueByProduct,
       contracts: activeContracts
     };
   }
   ```

3. **服务提供记录查询**
   ```typescript
   // 查询导师的服务提供记录
   async getMentorServiceRecords(mentorId: string, dateRange: DateRange) {
     // 1. 查询该导师的所有产品
     const products = await productRepository.findByMentorId(mentorId);

     // 2. 查询产品的合同
     const contracts = await contractRepository.findByProductIds(productIds);

     // 3. 查询服务台账（消费记录）
     const contractIds = contracts.map(c => c.id);
     const ledgers = await serviceLedgerRepository.findByContractIds(contractIds);

     // 4. 聚合服务提供记录
     return ledgers
       .filter(ledger => ledger.entryType === 'consumption')
       .map(ledger => ({
         contractId: ledger.contractId,
         studentId: ledger.holderId,
         serviceType: ledger.serviceType,
         quantity: Math.abs(ledger.quantity),  // 取正值
         sessionId: ledger.sessionId,
         consumedAt: ledger.createdAt
       }));
   }
   ```

**业务规则：**
- Mentor 只能查看自己产品的合同和收入
- 合同必须在 `active` 状态才计入实际收入
- 收入统计按合同签署价计算，不考虑退款
- 服务提供记录通过服务台账反向查询，确保准确性

#### 4.2.3 财务结算流程（月度/季度）

**流程图：**
```
系统生成结算周期账单
    ↓
计算该周期所有已激活合同
    ↓
按分成比例计算导师应得
    ↓
生成结算单（待确认）
    ↓
导师确认结算单
    ↓
财务审核并打款
    ├─ 自动扣除平台服务费
    ├─ 计算税费
    └─ 生成打款记录
    ↓
标记结算单为已支付
```

**详细步骤：**

1. **生成本期结算单**
   ```typescript
   // 系统定期任务（每月/每季度）
   async generateSettlement(settlementPeriod: SettlementPeriod) {
     const { startDate, endDate } = settlementPeriod;

     // 1. 查询所有 mentor
     const mentors = await userRepository.findByRole('MENTOR');

     for (const mentor of mentors) {
       // 2. 获取该 mentor 的结算数据
       const settlementData = await this.calculateMentorSettlement(
         mentor.id,
         startDate,
         endDate
       );

       // 3. 生成导师结算单
       const settlement = await settlementRepository.create({
         mentorId: mentor.id,
         settlementPeriod: `${startDate.toISOString()}_${endDate.toISOString()}`,
         totalRevenue: settlementData.totalRevenue,
         mentorShare: settlementData.mentorShare,  // 导师分成
         platformFee: settlementData.platformFee,  // 平台费
         status: 'pending_confirmation',  // 待导师确认
         createdAt: new Date()
       });

       // 4. 触发事件通知导师
       this.eventEmitter.emit('settlement.generated', {
         settlementId: settlement.id,
         mentorId: settlement.mentorId,
         amount: settlement.mentorShare
       });
     }
   }
   ```

2. **计算导师结算数据**
   ```typescript
   // 计算单个 mentor 的结算金额
   async calculateMentorSettlement(
     mentorId: string,
     startDate: Date,
     endDate: Date
   ): Promise<{
     totalRevenue: number;
     platformFee: number;
     mentorShare: number;
   }> {
     // 1. 查询导师的所有产品
     const products = await this.productService.getProductsByMentor(mentorId);
     const productIds = products.map(p => p.id);

     if (productIds.length === 0) {
       return {
         totalRevenue: 0,
         platformFee: 0,
         mentorShare: 0
       };
     }

     // 2. 查询产品在结算周期内激活的合同
     const contracts = await this.contractRepository.findByProductAndActivationDate(
       productIds,
       startDate,
       endDate,
       ContractStatus.ACTIVE
     );

     // 3. 计算总收入
     const totalRevenue = contracts.reduce(
       (sum, contract) => sum + contract.contractAmount,
       0
     );

     // 4. 计算平台费和导师分成
     const platformFeeRate = await this.getPlatformFeeRate();
     const platformFee = Math.floor(totalRevenue * platformFeeRate);
     const mentorShare = totalRevenue - platformFee;

     return {
       totalRevenue,
       platformFee,
       mentorShare
     };
   }
   ```

3. **导师确认结算**
   ```typescript
   // Mentor 确认结算单
   async confirmSettlement(settlementId: string, mentorId: string) {
     // 验证结算单属于该 mentor
     const settlement = await settlementRepository.findById(settlementId);
     if (settlement.mentorId !== mentorId) {
       throw new Error('Unauthorized');
     }

     // 确认结算
     settlement.confirm();
     await settlementRepository.update(settlementId, {
       status: 'confirmed',
       confirmedAt: new Date()
     });
   }
   ```

4. **财务支付处理**
   ```typescript
   // 财务处理支付（需财务权限）
   async processPayment(settlementId: string, paymentInfo: PaymentInfo) {
     // 1. 验证结算单已确认
     const settlement = await settlementRepository.findById(settlementId);
     if (settlement.status !== 'confirmed') {
       throw new Error('Settlement not confirmed');
     }

     // 2. 执行支付（集成支付服务）
     const paymentResult = await this.paymentService.transfer({
       recipientId: settlement.mentorId,
       amount: settlement.mentorShare,
       channel: paymentInfo.channel
     });

     // 3. 更新结算单状态
     await settlementRepository.update(settlementId, {
       status: 'paid',
       paymentReference: paymentInfo.reference,
       paymentChannel: paymentInfo.channel,
       paidAt: new Date()
     });
   }
   ```

**业务规则：**
- 平台默认分成比例 20%（可配置）
- 结算单必须由导师确认后才能支付
- 支付后生成永久性支付记录
- 税费计算在导师分成之后（实际支付给导师的金额）

### 4.3 Mentor 角色数据模型

#### 4.3.1 Mentor 收入统计视图
```typescript
interface MentorRevenueView {
  mentorId: string;
  mentorName: string;

  // 收入统计
  stats: {
    totalRevenue: number;           // 合同总金额
    totalContracts: number;         // 合同数量
    avgContractValue: number;       // 平均合同金额
  };

  // 按产品统计
  revenueByProduct: Array<{
    productId: string;
    productName: string;
    revenue: number;
    contractCount: number;
  }>;

  // 最近合同
  recentContracts: Array<{
    contractNumber: string;
    studentId: string;
    amount: number;
    status: string;
    signedAt: Date;
  }>;
}
```

#### 4.3.2 Mentor 结算单视图
```typescript
interface MentorSettlementView {
  settlementId: string;
  settlementPeriod: string;  // 结算周期（月/季度）

  // 结算金额
  totalRevenue: number;      // 总收入
  platformFee: number;       // 平台费
  mentorShare: number;       // 导师分成（实际支付额）

  // 状态
  status: 'pending_confirmation' | 'confirmed' | 'processing' | 'paid';

  // 时间戳
  createdAt: Date;           // 生成时间
  confirmedAt?: Date;        // 导师确认时间
  paidAt?: Date;             // 支付时间

  // 支付信息
  paymentReference?: string;
  paymentChannel?: string;
}
```

---

## 5. Student vs Mentor 对比表

| 维度 | Student（学生） | Mentor（导师） |
|------|-----------------|---------------|
| **核心目标** | 购买和使用服务 | 销售和管理服务 |
| **主要操作** | 浏览产品 → 签署合同 → 使用服务 → 查看账单 | 创建产品 → 管理产品 → 查看收入 → 结算提现 |
| **权限范围** | 只能操作自己的合同 | 只能操作自己的产品 |
| **财务指标** | 消费金额、剩余权益 | 收入金额、分成比例 |
| **计费触发** | 会话完成 → 自动扣费 | N/A（导师是收费方） |
| **数据查看** | 合同、权益、消费记录 | 产品、合同、收入统计 |
| **结算周期** | 按合同支付 | 按月/季度结算 |
| **主要状态** | 合同状态、权益状态 | 产品状态、结算单状态 |
| **通知事件** | 合同签署、权益不足 | 新合同、待结算 |
| **操作限制** | 不能修改合同价格 | 不能绕过审核上线产品 |

---

## 6. 领域事件定义

### 6.1 合同生命周期事件
```typescript
// 合同已创建
interface ContractCreatedEvent {
  contractId: string;
  studentId: string;
  mentorId: string;
  productId: string;
  contractAmount: number;
  createdAt: Date;
}

// 合同已签署
interface ContractSignedEvent {
  contractId: string;
  signedBy: string;
  signedAt: Date;
}

// 合同已激活（从支付事件触发）
interface ContractActivatedEvent {
  contractId: string;
  activatedAt: Date;
  entitlements: Array<{
    serviceType: string;
    quantity: number;
    source: 'product' | 'addon' | 'promotion' | 'compensation';
  }>;
}

// 合同已暂停/恢复
interface ContractSuspendedEvent {
  contractId: string;
  reason: string;
  suspendedAt: Date;
}

interface ContractResumedEvent {
  contractId: string;
  resumedAt: Date;
}

// 合同已完成/终止
interface ContractCompletedEvent {
  contractId: string;
  completedAt: Date;
}

interface ContractTerminatedEvent {
  contractId: string;
  reason: string;
  terminatedAt: Date;
}
```

### 6.2 服务消费事件
```typescript
// 服务已消费
interface ServiceConsumedEvent {
  contractId: string;
  serviceType: string;
  quantity: number;
  sessionId: string;
  holdId?: string;
  consumedAt: Date;
}

// 服务权益已创建
interface EntitlementCreatedEvent {
  contractId: string;
  serviceType: string;
  totalQuantity: number;
  source: 'product' | 'addon' | 'promotion' | 'compensation';
  createdAt: Date;
}

// 服务权益已更新
interface EntitlementUpdatedEvent {
  entitlementId: string;
  oldQuantity: number;
  newQuantity: number;
  reason: string;
  updatedAt: Date;
}

// 服务预留已创建
interface ServiceHoldCreatedEvent {
  holdId: string;
  contractId: string;
  serviceType: string;
  quantity: number;
  sessionId: string;
  reason: 'session_booking' | 'manual' | 'compensation';
  createdAt: Date;
}

// 服务预留已释放
interface ServiceHoldReleasedEvent {
  holdId: string;
  releasedBy: string;
  reason: string;
  releasedAt: Date;
}
```

### 6.3 财务结算事件
```typescript
// 结算单已生成
interface SettlementGeneratedEvent {
  settlementId: string;
  mentorId: string;
  settlementPeriod: string;
  totalRevenue: number;
  mentorShare: number;
  generatedAt: Date;
}

// 结算单已确认
interface SettlementConfirmedEvent {
  settlementId: string;
  mentorId: string;
  confirmedAt: Date;
}

// 结算单已支付
interface SettlementPaidEvent {
  settlementId: string;
  mentorId: string;
  paymentReference: string;
  paymentChannel: string;
  paidAt: Date;
}
```

### 6.4 支付事件
```typescript
// 支付成功（触发合同激活）
interface PaymentSucceededEvent {
  paymentId: string;
  contractId: string;
  studentId: string;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  paidAt: Date;
}

// 支付失败
interface PaymentFailedEvent {
  paymentId: string;
  contractId: string;
  reason: string;
  failedAt: Date;
}
```

---

## 7. API 接口设计

### 7.1 Student API（学生端）

#### 7.1.1 合同管理
```typescript
// POST /api/student/contracts
// 创建合同（草稿）
interface CreateContractDto {
  productId: string;
  overrideAmount?: number;      // 需要审批
  overrideReason?: string;
}

// GET /api/student/contracts
// 查询我的合同列表
interface GetMyContractsQuery {
  status?: string;              // 可选过滤
  page?: number;
  limit?: number;
}

// GET /api/student/contracts/:id
// 查询合同详情（包含快照）

// POST /api/student/contracts/:id/sign
// 签署合同
interface SignContractDto {
  password?: string;            // 验证身份
}

// DELETE /api/student/contracts/:id
// 取消草稿合同（仅限 draft 状态）
```

#### 7.1.2 账单与消费查询
```typescript
// GET /api/student/billing/summary
// 查询账单概览
interface BillingSummary {
  totalSpent: number;           // 总消费金额
  activeContracts: number;      // 有效合同数
  totalServices: number;        // 总服务次数
  consumedServices: number;     // 已使用次数
}

// GET /api/student/entitlements
// 查询我的权益列表

// GET /api/student/consumptions
// 查询消费记录
interface GetConsumptionsQuery {
  contractId?: string;
  serviceType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

// GET /api/student/consumptions/stats
// 消费统计
```

#### 7.1.3 预留管理
```typescript
// GET /api/student/holds
// 查询我的预留
interface GetHoldsQuery {
  contractId?: string;
  status?: 'active' | 'released';
}

// POST /api/student/holds/:id/release
// 手动释放预留（会话取消）
```

### 7.2 Mentor API（导师端）

#### 7.2.1 产品管理
```typescript
// POST /api/mentor/products
// 创建产品（草稿）
interface CreateProductDto {
  name: string;
  code: string;
  description: string;
  price: number;                // 单位：分
  currency: string;             // 默认 CNY
  validityDays: number;
  services: Array<{
    serviceType: string;
    quantity: number;
  }>;
}

// GET /api/mentor/products
// 查询我的产品列表
interface GetMyProductsQuery {
  status?: string;
  visibility?: string;
}

// GET /api/mentor/products/:id
// 查询产品详情

// PUT /api/mentor/products/:id
// 更新产品（仅限 draft 状态）

// POST /api/mentor/products/:id/submit
// 提交审核（状态变为 pending_review）

// DELETE /api/mentor/products/:id
// 删除产品（仅限 draft 状态）

// POST /api/mentor/service-packages
// 创建服务包

// GET /api/mentor/service-packages
// 查询我的服务包
```

#### 7.2.2 收入与结算
```typescript
// GET /api/mentor/revenue/summary
// 收入概览
interface RevenueSummary {
  totalRevenue: number;         // 总收入
  totalContracts: number;       // 合同数量
  avgContractValue: number;     // 平均合同金额
  currentMonthRevenue: number;  // 本月收入
}

// GET /api/mentor/revenue/by-product
// 按产品收入统计

// GET /api/mentor/contracts
// 查看我的产品合同
interface GetMentorContractsQuery {
  productId?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// GET /api/mentor/service-records
// 服务提供记录
interface GetServiceRecordsQuery {
  contractId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// GET /api/mentor/settlements
// 查询结算单
interface GetSettlementsQuery {
  period?: string;
  status?: string;
}

// GET /api/mentor/settlements/:id
// 查询结算单详情

// POST /api/mentor/settlements/:id/confirm
// 确认结算单
```

#### 7.2.3 统计数据
```typescript
// GET /api/mentor/stats/overview
// 数据概览
interface MentorStats {
  totalProducts: number;
  activeProducts: number;
  totalContracts: number;
  activeContracts: number;
  studentsServed: number;        // 服务过的学生数
  totalSessions: number;         // 总会话数
}

// GET /api/mentor/stats/service-distribution
// 服务类型分布

// GET /api/mentor/stats/revenue-trend
// 收入趋势（按月）
```

### 7.3 公共查询接口
```typescript
// GET /api/public/products
// 公开产品列表（学生浏览）

// GET /api/public/products/:id
// 公开产品详情
```

---

## 8. 数据库表设计

### 8.1 核心表结构

#### 8.1.1 contracts 表
```sql
-- 合同表
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number VARCHAR(50) UNIQUE NOT NULL,

  -- 关联关系（防腐层：字符串引用）
  student_id VARCHAR(50) NOT NULL,  -- 学生ID
  mentor_id VARCHAR(50) NOT NULL,   -- 导师ID
  product_id VARCHAR(50) NOT NULL,  -- 产品ID

  -- 产品快照（JSON存储，签署时冻结）
  product_snapshot JSONB NOT NULL,

  -- 价格信息
  product_amount INTEGER NOT NULL,   -- 产品原价（分）
  contract_amount INTEGER NOT NULL,  -- 合同成交价（分）
  override_reason TEXT,              -- 价格覆盖原因
  approved_by VARCHAR(50),           -- 价格审批人

  -- 生命周期状态
  status VARCHAR(20) NOT NULL
    CHECK (status IN ('draft', 'signed', 'active',
                      'suspended', 'completed', 'terminated')),

  -- 时间戳
  signed_at TIMESTAMP,
  activated_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- 索引
  INDEX idx_contracts_student_id (student_id),
  INDEX idx_contracts_mentor_id (mentor_id),
  INDEX idx_contracts_product_id (product_id),
  INDEX idx_contracts_status (status),
  INDEX idx_contracts_expires_at (expires_at)
);
```

#### 8.1.2 contract_service_entitlements 表
```sql
-- 服务权益表
CREATE TABLE contract_service_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id),

  -- 服务信息
  service_type VARCHAR(100) NOT NULL,  -- 服务类型
  service_name VARCHAR(255) NOT NULL,  -- 服务名称

  -- 数量信息
  total_quantity INTEGER NOT NULL,      -- 总数量
  consumed_quantity INTEGER DEFAULT 0,  -- 已消耗数量

  -- 权益来源
  source VARCHAR(20) NOT NULL
    CHECK (source IN ('product', 'addon', 'promotion', 'compensation')),

  -- 排序权重（消费优先级）
  priority INTEGER NOT NULL,  -- product=1, addon=2, promotion=3, compensation=4

  -- 扩展数据（来源ID、规则等）
  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- 索引
  INDEX idx_entitlements_contract_id (contract_id),
  INDEX idx_entitlements_service_type (service_type),
  UNIQUE (contract_id, service_type, source)  -- 同合同同服务同来源只能有一条
);
```

#### 8.1.3 service_ledgers 表
```sql
-- 服务台账表（不可修改的消费记录）
CREATE TABLE service_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id),

  -- 持有者（学生ID）
  holder_id VARCHAR(50) NOT NULL,

  -- 服务类型
  service_type VARCHAR(100) NOT NULL,

  -- 记账类型
  entry_type VARCHAR(20) NOT NULL
    CHECK (entry_type IN ('consumption', 'adjustment', 'refund')),

  -- 数量（消耗为负，调整为正负，退宽为正）
  quantity INTEGER NOT NULL,

  -- 关联会话
  session_id VARCHAR(50),

  -- 扩展数据（预留ID、调整原因等）
  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW(),

  -- 索引
  INDEX idx_ledgers_contract_id (contract_id),
  INDEX idx_ledgers_holder_id (holder_id),
  INDEX idx_ledgers_service_type (service_type),
  INDEX idx_ledgers_session_id (session_id),
  INDEX idx_ledgers_created_at (created_at)
);

-- 历史表（90天后归档）
CREATE TABLE service_ledger_history (LIKE service_ledgers);
CREATE INDEX idx_ledger_history_holder_id ON service_ledger_history(holder_id);
CREATE INDEX idx_ledger_history_created_at ON service_ledger_history(created_at);
```

#### 8.1.4 service_holds 表
```sql
-- 服务预留表
CREATE TABLE service_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id),

  -- 预留信息
  service_type VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL,

  -- 关联业务（会话ID）
  session_id VARCHAR(50) UNIQUE,

  -- 预留原因
  reason VARCHAR(50) NOT NULL
    CHECK (reason IN ('session_booking', 'manual', 'compensation')),

  created_at TIMESTAMP DEFAULT NOW(),

  -- 索引
  INDEX idx_holds_contract_id (contract_id),
  INDEX idx_holds_service_type (service_type),
  INDEX idx_holds_session_id (session_id),
  INDEX idx_holds_created_at (created_at)
);
```

#### 8.1.5 settlements 表
```sql
-- 导师结算表
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_number VARCHAR(50) UNIQUE NOT NULL,

  -- 导师信息
  mentor_id VARCHAR(50) NOT NULL,
  mentor_name VARCHAR(255) NOT NULL,

  -- 结算周期
  settlement_period VARCHAR(100) NOT NULL,  -- YYYY-MM 或 YYYY-QX

  -- 金额信息（单位：分）
  total_revenue INTEGER NOT NULL,    -- 总收入
  platform_fee INTEGER NOT NULL,     -- 平台费
  mentor_share INTEGER NOT NULL,     -- 导师分成

  -- 状态
  status VARCHAR(20) NOT NULL
    CHECK (status IN ('pending_confirmation', 'confirmed',
                      'processing', 'paid', 'rejected')),

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  paid_at TIMESTAMP,

  -- 支付信息（支付后填写）
  payment_reference VARCHAR(100),
  payment_channel VARCHAR(50),

  -- 索引
  INDEX idx_settlements_mentor_id (mentor_id),
  INDEX idx_settlements_period (settlement_period),
  INDEX idx_settlements_status (status)
);
```

#### 8.1.6 payment_records 表
```sql
-- 支付记录表
CREATE TABLE payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联结算单
  settlement_id UUID NOT NULL REFERENCES settlements(id),
  mentor_id VARCHAR(50) NOT NULL,

  -- 支付金额
  amount INTEGER NOT NULL,  -- 单位：分

  -- 支付方式
  payment_method VARCHAR(50) NOT NULL,
  payment_channel VARCHAR(50) NOT NULL,

  -- 支付结果
  status VARCHAR(20) NOT NULL
    CHECK (status IN ('pending', 'completed', 'failed')),

  transaction_id VARCHAR(100),  -- 第三方交易ID
  paid_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),

  -- 索引
  INDEX idx_payments_settlement_id (settlement_id),
  INDEX idx_payments_mentor_id (mentor_id),
  INDEX idx_payments_status (status),
  INDEX idx_payments_paid_at (paid_at)
);
```

---

## 9. 防腐层实现

### 9.1 字符串引用模式

#### Anti-Corruption 原则应用
```typescript
// ✅ 正确：使用字符串 UUID 引用
interface Contract {
  studentId: string;    // 仅存储ID，不关联对象
  mentorId: string;     // 字符串引用
  productId: string;    // 防腐层隔离
}

// ❌ 错误：直接外键关联
interface Contract {
  student: User;        // 跨域依赖，强耦合
  mentor: User;
  product: Product;     // 违反DDD原则
}
```

#### 查询时的跨域集成
```typescript
// Operations Layer 负责跨域数据组装
async getStudentContractView(contractId: string, studentId: string) {
  // 1. 从 Contract Domain 获取合同
  const contract = await contractRepository.findById(contractId);

  // 2. 验证所有权
  if (contract.studentId !== studentId) {
    throw new Error('Unauthorized');
  }

  // 3. 从 Identity Domain 获取学生信息
  const student = await identityService.getUser(contract.studentId);

  // 4. 从 Identity Domain 获取导师信息（仅名称）
  const mentor = await identityService.getUser(contract.mentorId);

  // 5. 组装视图
  return {
    contractNumber: contract.contractNumber,
    productName: contract.productSnapshot.name,
    studentName: student.name,
    mentorName: mentor.name,
    contractAmount: contract.contractAmount,
    status: contract.status,
    // ... 其他字段
  };
}
```

### 9.2 快照模式

#### 产品快照实现
```typescript
// 合同签署时生成产品快照
async generateSnapshot(productId: string): Promise<ProductSnapshot> {
  const product = await productRepository.findById(productId);

  // 包含所有关键信息
  return {
    productId: product.id,
    name: product.name,
    code: product.code,
    description: product.description,
    price: product.price,
    currency: product.currency,
    validityDays: product.validityDays,

    // 包含所有服务和套餐的快照
    items: await this.getProductItemsSnapshot(productId),

    // 元数据
    snapshotVersion: 'v1',
    createdAt: new Date()
  };
}
```

---

## 10. 关键算法与规则

### 10.1 权益合并算法
```typescript
/**
 * 合并同合同同服务的权益（按来源聚合）
 */
function mergeEntitlements(rawEntitlements: Entitlement[]): Entitlement[] {
  const map = new Map<string, EntitlementAggregation>();

  for (const item of rawEntitlements) {
    const key = `${item.contractId}:${item.serviceType}`;

    if (!map.has(key)) {
      map.set(key, {
        contractId: item.contractId,
        serviceType: item.serviceType,
        serviceName: item.serviceName,
        totalQuantity: 0,
        sources: []
      });
    }

    const aggregation = map.get(key)!;
    aggregation.totalQuantity += item.totalQuantity;
    aggregation.sources.push({
      source: item.source,
      quantity: item.totalQuantity
    });
  }

  return Array.from(map.values()).map(agg => ({
    ...agg,
    consumedQuantity: 0,  // 初始消耗为0
    availableQuantity: agg.totalQuantity
  }));
}
```

### 10.2 服务消费优先级规则
```typescript
/**
 * 定义权益消耗优先级（数值越小优先级越高）
 */
const CONSUMPTION_PRIORITY = {
  'product': 1,      // 产品自带权益 - 最高优先级
  'addon': 2,        // 附加服务
  'promotion': 3,    // 促销活动
  'compensation': 4  // 补偿权益 - 最低优先级
};

// 排序同服务类型的权益
function sortByPriority(entitlements: Entitlement[]): Entitlement[] {
  return entitlements.sort((a, b) => {
    const priorityA = CONSUMPTION_PRIORITY[a.source];
    const priorityB = CONSUMPTION_PRIORITY[b.source];
    return priorityA - priorityB;
  });
}
```

### 10.3 自动对账触发器（数据库层面）
```sql
-- 自动对账触发器
CREATE OR REPLACE FUNCTION reconcile_entitlements()
RETURNS TRIGGER AS $$
BEGIN
  -- 检查权益消耗数量是否与台账一致
  UPDATE contract_service_entitlements
  SET consumed_quantity = (
    SELECT COALESCE(SUM(ABS(quantity)), 0)
    FROM service_ledgers
    WHERE service_ledgers.contract_id = NEW.contract_id
      AND service_ledgers.service_type = NEW.service_type
      AND service_ledgers.entry_type = 'consumption'
  )
  WHERE contract_id = NEW.contract_id
    AND service_type = NEW.service_type;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 监听台账插入
CREATE TRIGGER trigger_reconcile_after_ledger_insert
  AFTER INSERT ON service_ledgers
  FOR EACH ROW
  EXECUTE FUNCTION reconcile_entitlements();
```

---

## 11. 性能优化策略

### 11.1 台账归档策略
```sql
-- 90天后的台账自动归档
CREATE OR REPLACE FUNCTION archive_old_ledgers()
RETURNS void AS $$
BEGIN
  -- 将90天前的数据迁移到历史表
  INSERT INTO service_ledger_history
  SELECT * FROM service_ledgers
  WHERE created_at < NOW() - INTERVAL '90 days';

  -- 从主表删除
  DELETE FROM service_ledgers
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- 每周执行一次
SELECT cron.schedule('archive_ledgers', '0 2 * * 0', 'SELECT archive_old_ledgers()');
```

### 11.2 权益查询优化
```typescript
// 使用物化视图加速权益余额查询
@ViewEntity({
  name: 'mv_entitlement_balances',
  expression: `
    SELECT
      contract_id,
      service_type,
      SUM(total_quantity) as total_quantity,
      SUM(consumed_quantity) as consumed_quantity,
      (SUM(total_quantity) - SUM(consumed_quantity)) as available_quantity
    FROM contract_service_entitlements
    GROUP BY contract_id, service_type
  `
})
export class EntitlementBalanceView {
  @ViewColumn() contractId: string;
  @ViewColumn() serviceType: string;
  @ViewColumn() totalQuantity: number;
  @ViewColumn() consumedQuantity: number;
  @ViewColumn() availableQuantity: number;
}
```

---

## 12. 业务约束与校验

### 12.1 合同约束
```typescript
// 价格覆盖范围校验
const MIN_OVERRIDE_RATIO = 0.10;  // 最低 10%
const MAX_OVERRIDE_RATIO = 2.00;  // 最高 200%

function validateOverrideAmount(originalPrice: number, overrideAmount: number) {
  const ratio = overrideAmount / originalPrice;

  if (ratio < MIN_OVERRIDE_RATIO || ratio > MAX_OVERRIDE_RATIO) {
    throw new Error(
      `Override amount must be between ${MIN_OVERRIDE_RATIO * 100}% and ${MAX_OVERRIDE_RATIO * 100}%`
    );
  }

  return true;
}
```

### 12.2 权益约束
```typescript
// 预留给定数量的服务前检查可用性
async function checkEntitlementAvailability(
  contractId: string,
  serviceType: string,
  requestedQuantity: number
): Promise<boolean> {
  const entitlements = await entitlementRepository.findByContractAndType(
    contractId,
    serviceType
  );

  const totalAvailable = entitlements.reduce(
    (sum, entitlement) => sum + (entitlement.totalQuantity - entitlement.consumedQuantity),
    0
  );

  // 还要减去预留中的数量
  const totalReserved = await serviceHoldService.getReservedQuantity(
    contractId,
    serviceType
  );

  const actuallyAvailable = totalAvailable - totalReserved;

  return actuallyAvailable >= requestedQuantity;
}
```

### 12.3 结算约束
```typescript
// 结算周期内不能重复生成
async function ensureNoDuplicateSettlement(
  mentorId: string,
  settlementPeriod: string
): Promise<void> {
  const existing = await settlementRepository.findByMentorAndPeriod(
    mentorId,
    settlementPeriod
  );

  if (existing && existing.status !== 'rejected') {
    throw new Error(
      `Settlement already exists for period ${settlementPeriod}`
    );
  }
}
```

---

## 13. 异常处理与补偿机制

### 13.1 消费失败补偿
```typescript
// 消费失败时回滚预留
async function handleConsumptionFailure(
  contractId: string,
  sessionId: string,
  error: Error
) {
  // 查找相关预留
  const hold = await serviceHoldService.findBySessionId(sessionId);

  if (hold) {
    // 释放预留
    await serviceHoldService.releaseHold(
      hold.id,
      'consumption_failed'
    );
  }

  // 记录错误日志
  await errorLogService.create({
    contractId,
    sessionId,
    operation: 'consume_service',
    error: error.message,
    createdAt: new Date()
  });

  // 通知管理员
  await notificationService.sendToAdmin({
    type: 'CONSUMPTION_FAILED',
    contractId,
    sessionId,
    error: error.message
  });
}
```

### 13.2 结算补偿
```typescript
// 支付失败后重试机制
async function retrySettlementPayment(
  settlementId: string,
  maxRetries: number = 3
) {
  const settlement = await settlementRepository.findById(settlementId);

  if (settlement.status !== 'processing' && settlement.status !== 'paid') {
    return;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await processPayment(settlementId);

      // 成功则退出
      console.log(`Payment succeeded for settlement ${settlementId}`);
      return;

    } catch (error) {
      console.error(
        `Payment failed (attempt ${attempt}/${maxRetries}):`,
        error
      );

      // 最后一次仍然失败
      if (attempt === maxRetries) {
        await settlementRepository.updateStatus(
          settlementId,
          'payment_failed',
          {
            paymentError: error.message,
            paymentFailedAt: new Date()
          }
        );

        // 通知财务人工处理
        await notificationService.sendToFinance({
          type: 'SETTLEMENT_PAYMENT_FAILED',
          settlementId,
          error: error.message
        });
      }

      // 等待后重试（指数退避）
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

---

## 14. 日志与审计

### 14.1 审计字段
```typescript
// 所有财务相关实体的基础审计
interface Auditable {
  createdAt: Date;
  createdBy: string;        // 操作人ID

  updatedAt: Date;
  updatedBy: string;

  // 业务审计
  ipAddress?: string;       // 操作IP
  userAgent?: string;       // 设备信息
}

// 合同审计日志
interface ContractAuditLog {
  id: string;
  contractId: string;
  action: string;           // CREATE, UPDATE, SIGN, ACTIVATE, etc.
  oldValue?: any;
  newValue?: any;
  operatorId: string;
  operatorRole: string;     // STUDENT, MENTOR, ADMIN
  createdAt: Date;
}
```

---

## 15. 未来扩展性

### 15.1 潜在扩展需求
1. **多币种支持**：当前统一为 CNY，未来可扩展多币种
2. **税费计算**：结算时自动计算税费
3. **退款流程**：支持部分或全额退款
4. **积分体系**：消费累积积分，可用于抵扣
5. **优惠券系统**：支持优惠券抵扣合同金额

### 15.2 可扩展点设计
```typescript
// 计费策略接口（支持未来扩展）
interface IBillingStrategy {
  calculateContractAmount(product: Product, overrides?: any): number;
  calculateMentorShare(revenue: number, settlementConfig: any): number;
  calculatePlatformFee(revenue: number): number;
}

// 当前实现
class DefaultBillingStrategy implements IBillingStrategy {
  calculateContractAmount(product: Product, overrides?: any): number {
    if (overrides?.amount) {
      return overrides.amount;
    }
    return product.price;
  }

  calculateMentorShare(revenue: number, settlementConfig: any): number {
    const platformFeeRate = settlementConfig.platformFeeRate || 0.20;
    return revenue * (1 - platformFeeRate);
  }

  calculatePlatformFee(revenue: number): number {
    const platformFeeRate = 0.20;
    return revenue * platformFeeRate;
  }
}
```

---

## 16. 测试策略

### 16.1 单元测试重点
```typescript
// 1. 权益扣减逻辑测试
describe('Entitlement consumption', () => {
  it('should consume from highest priority first', () => {
    // Test consumption priority: product > addon > promotion > compensation
  });

  it('should merge entitlements correctly', () => {
    // Test merging multiple entitlements of same service type
  });
});

// 2. 价格覆盖校验测试
describe('Price override validation', () => {
  it('should reject override < 10%', () => {
    expect(() => validateOverrideAmount(10000, 500)).toThrow();
  });

  it('should reject override > 200%', () => {
    expect(() => validateOverrideAmount(10000, 25000)).toThrow();
  });
});

// 3. 结算计算测试
describe('Settlement calculation', () => {
  it('should calculate mentor share correctly', () => {
    // Test 20% platform fee calculation
  });
});
```

### 16.2 E2E 测试场景
```typescript
// 1. 完整合同流程
//    - 学生选择产品 → 签署 → 支付 → 激活 → 消费
describe('Complete contract lifecycle', () => {
  it('should complete full flow successfully', async () => {
    // E2E test covering all steps
  });
});

// 2. 导师结算流程
//    - 导师创建产品 → 学生购买 → 服务消费 → 生成结算 → 确认 → 支付
describe('Mentor settlement flow', () => {
  it('should generate and pay settlement', async () => {
    // E2E test for settlement process
  });
});
```

---

## 17. 安全与权限

### 17.1 角色权限矩阵

| 操作 | Student | Mentor | Admin |
|------|---------|--------|-------|
| 创建合同 | ✅ | ❌ | ✅ |
| 签署合同 | ✅（自己的）| ❌ | ✅ |
| 查看合同 | ✅（自己的）| ✅（自己产品的）| ✅（所有）|
| 创建产品 | ❌ | ✅ | ✅ |
| 审核产品 | ❌ | ❌ | ✅ |
| 修改合同价格 | ❌ | ❌ | ✅ |
| 确认结算单 | ❌ | ✅（自己的）| ✅ |
| 处理支付 | ❌ | ❌ | ✅（财务）|

### 17.2 关键权限校验
```typescript
// 合同操作权限校验
function checkContractAccess(
  contract: Contract,
  userId: string,
  userRole: string
): boolean {
  switch (userRole) {
    case 'STUDENT':
      return contract.studentId === userId;

    case 'MENTOR':
      return contract.mentorId === userId;

    case 'ADMIN':
      return true;

    default:
      return false;
  }
}

// 产品操作权限校验
function checkProductAccess(
  product: Product,
  userId: string,
  userRole: string
): boolean {
  if (userRole === 'ADMIN') {
    return true;
  }

  if (userRole === 'MENTOR') {
    return product.mentorId === userId;
  }

  return false;  // Student cannot modify products
}
```

---

## 总结

本 Financial Domain 详细设计文档基于实际代码梳理，完整覆盖：

### ✅ 已实现的核心功能
1. **合同全生命周期管理**（草稿 → 签署 → 激活 → 完成/终止）
2. **服务台账系统**（消费、调整、退款，永久记录）
3. **预留系统**（会话预约锁定，手动释放）
4. **自动对账**（触发器保证数据一致性）
5. **双角色财务流程**（Student 消费端 + Mentor 收入端）
6. **快照机制**（合同签署时冻结产品和权益信息）

### ✅ 核心架构优势
1. **DDD 防腐层**：跨域使用字符串引用，零外键依赖
2. **事件驱动**：解耦业务逻辑，支持异步处理
3. **不可变台账**：确保财务数据完整性和审计能力
4. **聚合设计**：权益按优先级自动合并和消耗
5. **层级计费**：支持产品 → 服务包 → 服务的多级销售

### 📊 关键数据指标
- **Student 端**：合同数、剩余权益、消费记录
- **Mentor 端**：收入统计、服务提供记录、结算单
- **平台端**：平台费收入、交易流水、审计日志

该设计已完全适配当前 SA2-MVP 代码库，无需第三方支付支持，清晰区分了 Student 和 Mentor 的双角色财务流程，为 MentorX 教育咨询平台提供健壮的财务基础设施。
