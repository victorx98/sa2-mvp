# contract_service_entitlements 表变更途径分析

## 概述

`contract_service_entitlements` 表采用**学生级权益累积制**，每个学生每种服务类型只有一条记录（唯一约束：`student_id + service_type`）。该表的变更主要通过**数据库触发器**自动维护，应用层禁止直接 UPDATE/DELETE（除初始创建外）。

## 变更途径分类

### 1. 应用层直接写入（INSERT/UPSERT）

#### 1.1 合同创建时初始化权益
- **业务场景**：创建新合同
- **代码路径**：`ContractService.create()` → `createEntitlementsFromSnapshot()`
- **文件位置**：`src/domains/contract/services/contract.service.ts:114-187`
- **操作类型**：`INSERT ... ON CONFLICT DO UPDATE`
- **更新字段**：
  - `total_quantity`：累加（如果记录已存在）
  - `available_quantity`：重新计算
- **触发条件**：合同创建时，从 `productSnapshot.items` 提取服务类型和数量

```typescript
// 代码位置：contract.service.ts:166-179
await tx
  .insert(schema.contractServiceEntitlements)
  .values(insertValues)
  .onConflictDoUpdate({
    target: [
      schema.contractServiceEntitlements.studentId,
      schema.contractServiceEntitlements.serviceType,
    ],
    set: {
      totalQuantity: sql`${schema.contractServiceEntitlements.totalQuantity} + EXCLUDED.total_quantity`,
      availableQuantity: sql`(${schema.contractServiceEntitlements.totalQuantity} + EXCLUDED.total_quantity) - ${schema.contractServiceEntitlements.consumedQuantity} - ${schema.contractServiceEntitlements.heldQuantity}`,
      updatedAt: new Date(),
    },
  });
```

---

### 2. 数据库触发器自动更新

#### 2.1 触发器 1：contract_amendment_ledgers → total_quantity

- **触发器名称**：`trigger_ledger_update`
- **触发时机**：`AFTER UPDATE ON contract_amendment_ledgers`
- **函数名称**：`sync_amendment_ledger_to_entitlement()`
- **更新字段**：
  - `total_quantity`：累加 `quantity_diff`（NEW.quantity_changed - OLD.quantity_changed）
  - `available_quantity`：重新计算
- **业务场景**：
  - **权益增加（加赠/促销/补偿）**：`ContractService.addAmendmentLedger()`
    - 代码路径：`src/domains/contract/services/contract.service.ts:769-863`
    - 操作：INSERT `contract_amendment_ledgers` → UPDATE `contract_amendment_ledgers.quantity_changed` → 触发器执行
    - 注意：触发器只监听 UPDATE，所以需要先 INSERT 再 UPDATE `quantity_changed` 字段

```sql
-- 触发器定义（从 Supabase 查询）
CREATE TRIGGER trigger_ledger_update 
AFTER UPDATE ON contract_amendment_ledgers 
FOR EACH ROW 
EXECUTE FUNCTION sync_amendment_ledger_to_entitlement();
```

---

#### 2.2 触发器 2：service_ledgers → consumed_quantity / total_quantity

- **触发器名称**：`trigger_service_ledger_insert`
- **触发时机**：`AFTER INSERT ON service_ledgers`
- **函数名称**：`sync_ledger_to_entitlement()`
- **更新逻辑**（根据 `type` 字段）：
  - `consumption`：`consumed_quantity += (-quantity)`，`available_quantity` 减少
  - `refund`：`consumed_quantity = GREATEST(0, consumed_quantity - quantity)`，`available_quantity` 增加
  - `adjustment`：`total_quantity += quantity`，`available_quantity` 重新计算
  - `initial`：`total_quantity += quantity`，`available_quantity` 增加
  - `expiration`：`total_quantity += quantity`（负数），`available_quantity` 重新计算
- **业务场景**：

  **2.2.1 服务消费（会话完成）**
  - 代码路径：`SessionCompletedListener.handleServiceSessionCompletedEvent()`
  - 文件位置：`src/domains/contract/events/listeners/session-completed-listener.ts:45-133`
  - 调用链：
    1. 会话完成 → 发出 `SERVICE_SESSION_COMPLETED_EVENT`
    2. `SessionCompletedListener` 监听事件
    3. `ServiceLedgerService.recordConsumption()` → INSERT `service_ledgers` (type='consumption', quantity<0)
    4. 触发器自动更新 `consumed_quantity`
  - 涉及的会话类型：
    - Regular Mentoring：`RegularMentoringService.completeSession()` → 发出事件
    - Gap Analysis：`GapAnalysisService.completeSession()` → 发出事件
    - AI Career：`AiCareerService.completeSession()` → 发出事件
    - Comm Session：类似流程
    - Class Session：类似流程

  **2.2.2 投递申请消耗**
  - 代码路径：`PlacementEventListener.handleApplicationStatusChangedEvent()`
  - 文件位置：`src/domains/contract/events/listeners/placement-event.listener.ts:46-124`
  - 触发条件：投递申请状态变为 `submitted`
  - 操作：`ServiceLedgerService.recordConsumption()` → INSERT `service_ledgers` (type='consumption')

  **2.2.3 手动调整**
  - 代码路径：`ServiceLedgerService.recordAdjustment()`
  - 文件位置：`src/domains/contract/services/service-ledger.service.ts:114-176`
  - 操作：INSERT `service_ledgers` (type='adjustment', quantity 可正可负)
  - 业务场景：
    - 管理员手动调整权益
    - 投递申请退款：`PlacementEventListener.handleApplicationStatusRolledBackEvent()` → `recordAdjustment()` (quantity=1)

```sql
-- 触发器定义
CREATE TRIGGER trigger_service_ledger_insert 
AFTER INSERT ON service_ledgers 
FOR EACH ROW 
EXECUTE FUNCTION sync_ledger_to_entitlement();
```

---

#### 2.3 触发器 3：service_holds → held_quantity

- **触发器名称**：`trigger_hold_change`
- **触发时机**：`AFTER INSERT OR UPDATE ON service_holds`
- **函数名称**：`sync_hold_to_entitlement()`
- **更新逻辑**：
  - **INSERT 且 status='active'**：`held_quantity += quantity`，`available_quantity` 减少
  - **UPDATE 且 status 从 'active' 变为其他**：`held_quantity -= OLD.quantity`，`available_quantity` 增加
- **业务场景**：

  **2.3.1 创建预占（预约创建）**
  - 代码路径：`ServiceHoldService.createHold()`
  - 文件位置：`src/domains/contract/services/service-hold.service.ts:35-84`
  - 调用场景：
    - `BookSessionCommand.execute()` → 预约会话时创建预占
    - 其他预约流程（目前大部分代码中已注释，但接口保留）
  - 操作：INSERT `service_holds` (status='active') → 触发器自动更新 `held_quantity`

  **2.3.2 释放预占（会话完成/取消/过期）**
  - **会话完成释放**：
    - 代码路径：`SessionCompletedListener.handleServiceSessionCompletedEvent()`
    - 操作：`ServiceHoldService.releaseHold()` → UPDATE `service_holds` (status='released', reason='completed')
  - **手动释放**：
    - 代码路径：`ServiceHoldService.releaseHold()`
    - 操作：UPDATE `service_holds` (status='released')
  - **取消预占**：
    - 代码路径：`ServiceHoldService.cancelHold()`
    - 操作：UPDATE `service_holds` (status='released', reason='cancelled')
  - **过期释放**：
    - 代码路径：`ServiceHoldService.releaseExpiredHolds()`
    - 文件位置：`src/domains/contract/services/service-hold.service.ts:228-303`
    - 操作：批量 UPDATE `service_holds` (status='expired', reason='expired')
    - 注意：需要定时任务或手动触发（目前未发现自动定时任务）

```sql
-- 触发器定义
CREATE TRIGGER trigger_hold_change 
AFTER INSERT OR UPDATE ON service_holds 
FOR EACH ROW 
EXECUTE FUNCTION sync_hold_to_entitlement();
```

---

#### 2.4 触发器 4：contracts → available_quantity（冻结）

- **触发器名称**：`trigger_contract_terminated`
- **触发时机**：`AFTER UPDATE OF status ON contracts`（当 status 变为 'terminated'）
- **函数名称**：`freeze_entitlements_on_contract_termination()`
- **更新字段**：
  - `available_quantity = 0`（冻结该学生的所有权益）
- **业务场景**：
  - **合同终止**：`ContractService.updateStatus(TERMINATED)`
  - 代码路径：`src/domains/contract/services/contract.service.ts:612-630`
  - 操作：UPDATE `contracts` (status='terminated') → 触发器自动冻结权益

```sql
-- 触发器定义
CREATE TRIGGER trigger_contract_terminated 
AFTER UPDATE OF status ON contracts 
FOR EACH ROW 
WHEN (NEW.status = 'terminated' AND OLD.status != 'terminated') 
EXECUTE FUNCTION freeze_entitlements_on_contract_termination();
```

---

## 业务线/场景汇总

### 合同管理业务线

| 业务场景 | 变更途径 | 更新字段 | 代码位置 |
|---------|---------|---------|---------|
| 创建合同 | 应用层 INSERT/UPSERT | `total_quantity`, `available_quantity` | `ContractService.create()` |
| 权益增加（加赠/促销/补偿） | `contract_amendment_ledgers.UPDATE` → 触发器 | `total_quantity`, `available_quantity` | `ContractService.addAmendmentLedger()` |
| 合同终止 | `contracts.UPDATE(status='terminated')` → 触发器 | `available_quantity=0` | `ContractService.updateStatus(TERMINATED)` |

### 服务消费业务线

| 业务场景 | 变更途径 | 更新字段 | 代码位置 |
|---------|---------|---------|---------|
| 会话完成（Regular Mentoring） | `service_ledgers.INSERT(type='consumption')` → 触发器 | `consumed_quantity`, `available_quantity` | `RegularMentoringService.completeSession()` → `SessionCompletedListener` |
| 会话完成（Gap Analysis） | `service_ledgers.INSERT(type='consumption')` → 触发器 | `consumed_quantity`, `available_quantity` | `GapAnalysisService.completeSession()` → `SessionCompletedListener` |
| 会话完成（AI Career） | `service_ledgers.INSERT(type='consumption')` → 触发器 | `consumed_quantity`, `available_quantity` | `AiCareerService.completeSession()` → `SessionCompletedListener` |
| 会话完成（Comm Session） | `service_ledgers.INSERT(type='consumption')` → 触发器 | `consumed_quantity`, `available_quantity` | 类似流程 |
| 会话完成（Class Session） | `service_ledgers.INSERT(type='consumption')` → 触发器 | `consumed_quantity`, `available_quantity` | 类似流程 |
| 投递申请提交 | `service_ledgers.INSERT(type='consumption')` → 触发器 | `consumed_quantity`, `available_quantity` | `PlacementEventListener.handleApplicationStatusChangedEvent()` |
| 手动调整权益 | `service_ledgers.INSERT(type='adjustment')` → 触发器 | `total_quantity` 或 `consumed_quantity`, `available_quantity` | `ServiceLedgerService.recordAdjustment()` |
| 投递申请退款 | `service_ledgers.INSERT(type='adjustment')` → 触发器 | `total_quantity`, `available_quantity` | `PlacementEventListener.handleApplicationStatusRolledBackEvent()` |

### 服务预占业务线

| 业务场景 | 变更途径 | 更新字段 | 代码位置 |
|---------|---------|---------|---------|
| 预约创建（创建预占） | `service_holds.INSERT(status='active')` → 触发器 | `held_quantity`, `available_quantity` | `BookSessionCommand.execute()` → `ServiceHoldService.createHold()` |
| 会话完成（释放预占） | `service_holds.UPDATE(status='released')` → 触发器 | `held_quantity`, `available_quantity` | `SessionCompletedListener` → `ServiceHoldService.releaseHold()` |
| 预约取消（取消预占） | `service_holds.UPDATE(status='released')` → 触发器 | `held_quantity`, `available_quantity` | `ServiceHoldService.cancelHold()` |
| 预占过期（自动释放） | `service_holds.UPDATE(status='expired')` → 触发器 | `held_quantity`, `available_quantity` | `ServiceHoldService.releaseExpiredHolds()`（需手动/定时触发） |

---

## 数据约束

### 唯一约束
- `uk_contract_service_entitlements_student_service`：`(student_id, service_type)` 唯一

### CHECK 约束
- `chk_available_quantity_non_negative`：`available_quantity >= 0`
- `chk_balance_consistency`：`available_quantity = total_quantity - consumed_quantity - held_quantity`
- `chk_quantities_non_negative`：`total_quantity >= 0 AND consumed_quantity >= 0 AND held_quantity >= 0`
- `chk_consumed_plus_held_not_exceed_total`：`consumed_quantity + held_quantity <= total_quantity`

---

## 注意事项

1. **应用层禁止直接 UPDATE/DELETE**：除初始创建外，所有更新都通过触发器自动维护
2. **权益增加的特殊处理**：`contract_amendment_ledgers` 触发器只监听 UPDATE，需要先 INSERT 再 UPDATE `quantity_changed` 字段
3. **预占过期机制**：`releaseExpiredHolds()` 需要定时任务或手动触发，目前未发现自动定时任务配置
4. **合同终止冻结**：终止合同会冻结该学生的**所有服务类型**的权益（`available_quantity=0`），但 `total_quantity`、`consumed_quantity`、`held_quantity` 保持不变
5. **学生级累积制**：多个合同的同类型服务权益自动累加，合同终止后权益继续保留（只是被冻结）

---

## 数据库触发器完整列表

| 触发器名称 | 表名 | 触发时机 | 函数名称 | 影响字段 |
|-----------|------|---------|---------|---------|
| `trigger_ledger_update` | `contract_amendment_ledgers` | AFTER UPDATE | `sync_amendment_ledger_to_entitlement()` | `total_quantity`, `available_quantity` |
| `trigger_service_ledger_insert` | `service_ledgers` | AFTER INSERT | `sync_ledger_to_entitlement()` | `consumed_quantity` / `total_quantity`, `available_quantity` |
| `trigger_hold_change` | `service_holds` | AFTER INSERT OR UPDATE | `sync_hold_to_entitlement()` | `held_quantity`, `available_quantity` |
| `trigger_contract_terminated` | `contracts` | AFTER UPDATE OF status | `freeze_entitlements_on_contract_termination()` | `available_quantity=0` |

---

## 验证查询

```sql
-- 验证权益余额一致性
SELECT
  student_id,
  service_type,
  total_quantity,
  consumed_quantity,
  held_quantity,
  available_quantity,
  (total_quantity - consumed_quantity - held_quantity) AS calculated_available
FROM contract_service_entitlements
WHERE available_quantity != (total_quantity - consumed_quantity - held_quantity);
-- 预期结果: 0 行

-- 验证唯一约束（每个学生每种服务应该只有一条记录）
SELECT
  student_id,
  service_type,
  COUNT(*) as count
FROM contract_service_entitlements
GROUP BY student_id, service_type
HAVING COUNT(*) > 1;
-- 预期结果: 0 行
```

---

## 总结

`contract_service_entitlements` 表的变更主要通过 **4 个数据库触发器**自动维护，涉及以下业务线：

1. **合同管理**：创建合同、权益增加、合同终止
2. **服务消费**：会话完成、投递申请、手动调整
3. **服务预占**：预约创建、预占释放、预占过期

所有变更都遵循**学生级权益累积制**，确保数据一致性和业务正确性。

