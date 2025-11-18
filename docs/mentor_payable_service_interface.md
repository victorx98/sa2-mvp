# Mentor-Payable 服务接口文档

## 1. 概述

Mentor-Payable 服务是 Financial Domain 的核心组件，负责管理导师应付账款流水，支持按次计费和按包计费两种模式，并提供费用调整和查询功能。服务采用事件驱动架构，通过消费外部事件触发计费流程，保证了领域间的低耦合。

## 2. 数据模型

### 2.1 服务类型配置表 (service_types)

| 字段名 | 数据类型 | 描述 | 约束 |
|-------|---------|------|------|
| id | uuid | 主键 | 自生成 |
| code | varchar(50) | 服务类型代码 | 非空，唯一 |
| name | varchar(200) | 服务名称 | 非空 |
| requiredEvaluation | boolean | 是否评价后计费 | 非空，默认 false |
| createdAt | timestamp | 创建时间 | 非空，默认 now() |
| updatedAt | timestamp | 更新时间 | 非空，默认 now() |

### 2.2 导师应付账款流水表 (mentor_payable_ledgers)

| 字段名 | 数据类型 | 描述 | 约束 |
|-------|---------|------|------|
| id | uuid | 主键 | 自生成 |
| relationId | uuid | 关联服务记录ID | 非空 |
| sourceEntity | varchar(50) | 来源表 | 非空 |
| mentorUserId | uuid | 导师ID | 非空 |
| studentUserId | uuid | 学生ID | 可为空 |
| serviceTypeCode | varchar(50) | 服务类型Code | 非空 |
| serviceName | varchar(500) | 服务名称快照 | 可为空 |
| price | numeric(12,1) | 单价 | 非空 |
| amount | numeric(12,2) | 总金额 | 非空（调整可为负） |
| currency | varchar(3) | 货币 | 非空，默认 USD |
| originalId | uuid | 被调整的原始记录ID | 可为空 |
| adjustmentReason | varchar(500) | 调整原因 | 可为空 |
| servicePackageId | uuid | 服务包ID | 可为空 |
| createdAt | timestamp | 创建时间 | 非空，默认 now() |
| createdBy | uuid | 操作人ID | 可为空 |

### 2.3 导师价格配置表 (mentor_prices)

| 字段名 | 数据类型 | 描述 | 约束 |
|-------|---------|------|------|
| id | uuid | 主键 | 自生成 |
| mentorUserId | uuid | 导师ID | 非空 |
| serviceTypeCode | varchar(50) | 服务类型Code | 非空 |
| price | numeric(12,1) | 单价 | 非空 |
| currency | varchar(3) | 货币 | 非空，默认 USD |
| status | varchar(20) | 状态 | 非空，默认 active |
| createdAt | timestamp | 创建时间 | 非空，默认 now() |
| createdBy | uuid | 创建人ID | 可为空 |
| updatedAt | timestamp | 更新时间 | 非空，默认 now() |
| updatedBy | uuid | 更新人ID | 可为空 |

## 3. 事件定义

### 3.1 SessionCompletedEvent

**事件名称**: `services.session.completed`

| 字段名 | 数据类型 | 描述 | 约束 |
|-------|---------|------|------|
| sessionId | string | 会话ID | 非空 |
| mentorUserId | string | 导师ID | 非空 |
| studentUserId | string | 学生ID | 可为空 |
| mentorName | string | 导师姓名 | 非空 |
| studentName | string | 学生姓名 | 非空 |
| serviceTypeCode | string | 服务类型代码 | 非空 |
| serviceName | string | 服务名称 | 非空 |
| durationHours | number | 服务时长（小时） | 可选 |
| completedAt | Date | 完成时间 | 非空 |
| requiredEvaluation | boolean | 是否评价后计费 | 非空 |
| servicePackageId | string | 服务包ID | 可选 |
| packageTotalSessions | number | 包中总课时数 | 可选 |
| packageCompletedSessions | number | 已完成课时数 | 可选 |

### 3.2 SessionEvaluatedEvent

**事件名称**: `services.session.evaluated`

| 字段名 | 数据类型 | 描述 | 约束 |
|-------|---------|------|------|
| sessionId | string | 会话ID | 非空 |
| mentorUserId | string | 导师ID | 非空 |
| studentUserId | string | 学生ID | 非空 |
| mentorName | string | 导师姓名 | 非空 |
| studentName | string | 学生姓名 | 非空 |
| serviceTypeCode | string | 服务类型代码 | 非空 |
| serviceName | string | 服务名称 | 非空 |
| durationHours | number | 服务时长（小时） | 可选 |
| reviewedAt | Date | 评价完成时间 | 非空 |
| servicePackageId | string | 服务包ID | 可选 |
| packageTotalSessions | number | 包中总课时数 | 可选 |
| packageCompletedSessions | number | 已完成课时数 | 可选 |

## 4. 服务接口

### 4.1 事件处理器

#### 4.1.1 handleSessionCompleted

**描述**: 处理会话完成事件，根据是否需要评价决定是否触发计费

**参数**:
- event: SessionCompletedEvent - 会话完成事件

**返回值**: Promise<void>

**处理流程**:
1. 检查是否重复处理
2. 如果需要评价后计费，则等待评价
3. 否则，根据计费模式路由到相应的计费逻辑

#### 4.1.2 handleSessionEvaluated

**描述**: 处理会话评价完成事件，触发计费

**参数**:
- event: SessionEvaluatedEvent - 会话评价完成事件

**返回值**: Promise<void>

**处理流程**:
1. 检查是否重复处理
2. 根据计费模式路由到相应的计费逻辑

### 4.2 计费服务

#### 4.2.1 createPerSessionBilling

**描述**: 按次计费逻辑，为单次会话创建应付账款记录

**参数**:
- event: SessionCompletedEvent | SessionEvaluatedEvent - 会话事件

**返回值**: Promise<void>

**处理流程**:
1. 查询导师对应服务类型的价格配置
2. 如果未找到价格配置，抛出异常
3. 根据计费模式（按次/按时）计算金额
4. 创建应付账款记录

#### 4.2.2 createPackageBilling

**描述**: 按包计费逻辑，当包中所有会话完成后创建应付账款记录

**参数**:
- event: SessionCompletedEvent | SessionEvaluatedEvent - 会话事件

**返回值**: Promise<void>

**处理流程**:
1. 检查是否所有会话已完成
2. 查询导师对应服务包的价格配置
3. 创建应付账款记录（使用最后一个会话的ID作为关联）

### 4.3 费用调整服务

#### 4.3.1 adjustPayableLedger

**描述**: 调整应付账款记录，支持多次链式调整

**参数**:
- originalLedgerId: string - 原始记录ID
- adjustmentAmount: number - 调整金额（负值表示退款）
- reason: string - 调整原因
- operatorUserId: string - 操作人ID

**返回值**: Promise<MentorPayableLedger>

**处理流程**:
1. 查询原始记录
2. 创建新的调整记录，关联到原始记录
3. 返回新创建的调整记录

### 4.4 辅助服务

#### 4.4.1 isDuplicate

**描述**: 检查事件是否已处理，确保幂等性

**参数**:
- event: SessionCompletedEvent | SessionEvaluatedEvent - 会话事件

**返回值**: Promise<boolean> - 是否已处理

**处理流程**:
1. 根据是否有服务包ID选择不同的查询条件
2. 检查数据库中是否已存在对应的记录

## 5. 关键查询接口

### 5.1 查询导师所有应付账款

**描述**: 查询指定导师的所有应付账款记录

**参数**:
- mentorUserId: string - 导师ID

**返回值**: Promise<MentorPayableLedger[]>

### 5.2 查询会话所有记录

**描述**: 查询指定会话的所有应付账款记录（包括调整）

**参数**:
- sessionId: string - 会话ID

**返回值**: Promise<MentorPayableLedger[]>

### 5.3 查询服务包计费记录

**描述**: 查询指定服务包的计费记录

**参数**:
- servicePackageId: string - 服务包ID

**返回值**: Promise<MentorPayableLedger | null>

### 5.4 查询调整记录链

**描述**: 查询某笔记录的所有后续调整记录

**参数**:
- originalLedgerId: string - 原始记录ID

**返回值**: Promise<MentorPayableLedger[]>

## 6. 数据一致性保障

### 6.1 幂等性索引

```sql
-- 按次计费（原始记录）唯一索引
CREATE UNIQUE INDEX idx_mentor_payable_relation
  ON mentor_payable_ledgers(relation_id, source_entity)
  WHERE original_id IS NULL;

-- 按包计费（原始记录）唯一索引
CREATE UNIQUE INDEX idx_mentor_payable_package
  ON mentor_payable_ledgers(service_package_id, relation_id, source_entity)
  WHERE original_id IS NULL
    AND service_package_id IS NOT NULL;
```

### 6.2 不可变设计

- 应付账款流水表采用不可变设计，只允许插入新记录，不允许修改或删除现有记录
- 费用调整通过创建新的调整记录实现，保持完整的审计跟踪

## 7. 错误处理

| 错误类型 | 描述 | 处理方式 |
|---------|------|---------|
| PriceNotFoundError | 未找到导师价格配置 | 抛出异常，需要先配置导师价格 |
| DuplicateRecordError | 重复处理同一事件 | 幂等性检查自动跳过 |
| InvalidParameterError | 参数验证失败 | 抛出异常，返回详细错误信息 |
| DatabaseError | 数据库操作失败 | 事务回滚，记录错误日志 |

## 8. 设计原则

- **事件驱动**: 通过消费事件触发计费，减少领域间直接耦合
- **不可变表**: 保证数据完整性和审计追踪
- **防腐层**: 无实际外键，通过UUID引用减少耦合
- **快照设计**: 记录服务和价格快照，避免跨域查询
- **职责分离**: 明确区分不同来源和计费模式
- **幂等性**: 通过唯一索引和代码检查确保重复事件不会导致错误