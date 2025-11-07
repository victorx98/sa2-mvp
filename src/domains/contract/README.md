# Contract Domain 实现状态

## 已完成（Phase 1-3）

### ✅ 基础设施层（Phase 1）
- **数据库Schema（8个）**：
  - contracts.schema.ts - 合同表
  - contract-service-entitlements.schema.ts - 服务权益表
  - service-ledgers.schema.ts - 服务流水表
  - service-holds.schema.ts - 服务预占表
  - domain-events.schema.ts - 领域事件发件箱
  - service-ledgers-archive.schema.ts - 流水归档表
  - service-ledger-archive-policies.schema.ts - 归档策略表
  - index.ts - 导出文件

- **SQL脚本（4个）**：
  - contract_number_generator.sql - 合同编号生成函数
  - contract_triggers.sql - 触发器（自动同步）
  - contract_indexes.sql - 索引（40+个）
  - contract_constraints.sql - CHECK约束（40+个）

- **类型定义**：
  - database.types.ts - 全局数据库类型

### ✅ Common层（Phase 2）
- **异常类**：
  - contract.exception.ts - 5个异常类 + 60+错误码

- **常量**：
  - contract.constants.ts - 业务常量配置

- **类型**：
  - snapshot.types.ts - 快照类型定义

- **工具类**：
  - date.utils.ts - 日期工具（20+函数）
  - validation.utils.ts - 验证工具（15+函数）

### ✅ 核心接口（Phase 3）
- **服务接口（5个）**：
  - contract.interface.ts - 合同管理服务接口
  - service-ledger.interface.ts - 流水管理服务接口
  - service-hold.interface.ts - 预占管理服务接口
  - archive.interface.ts - 归档服务接口
  - event.interface.ts - 事件服务接口

- **模块**：
  - contract.module.ts - Contract领域模块

## 待实现（需后续补充）

### 🔄 服务实现
以下服务需要完整实现（每个服务约200-500行代码）：

1. **ContractService** - 合同管理服务
   - 12个方法实现
   - 状态机流转逻辑
   - 事件发布

2. **ServiceLedgerService** - 流水管理服务
   - 5个方法实现
   - Append-only逻辑
   - 归档查询（UNION ALL）

3. **ServiceHoldService** - 预占管理服务
   - 5个方法实现
   - TTL机制
   - 清理任务

4. **ServiceLedgerArchiveService** - 归档服务
   - 4个方法实现
   - 冷热分离
   - 策略管理

5. **EventPublisherService** - 事件发布服务
   - 4个方法实现
   - Outbox模式
   - 重试机制

### 🔄 DTO定义
需要创建约20个DTO文件：
- CreateContractDto
- UpdateContractDto
- ContractFilterDto
- ServiceBalanceQuery
- RecordConsumptionDto
- 等等...

### 🔄 定时任务
需要实现2个定时任务：
- HoldCleanupTask - 清理过期预占（每5分钟）
- ArchiveTask - 归档历史流水（每天凌晨2点）
- EventPublisherTask - 发布待发送事件（每30秒）

### 🔄 单元测试
需要创建约10个测试文件：
- contract.service.spec.ts
- service-ledger.service.spec.ts
- service-hold.service.spec.ts
- 等等...

## 架构设计

### 关键设计决策
- ✅ v2.16.7: 移除unit字段，统一按次数计费
- ✅ DDD防腐层：ProductSnapshot隔离Catalog Domain
- ✅ Outbox模式：事件可靠发布
- ✅ Append-only：服务流水只增不改
- ✅ TTL机制：15分钟自动过期预占
- ✅ 触发器同步：自动维护consumed_quantity和held_quantity

### 数据流
```
创建合同 → 激活合同 → 创建预占 → 完成服务 → 记录流水 → 归档历史
   ↓          ↓           ↓          ↓          ↓
 发布事件   发布事件    发布事件   发布事件   发布事件
```

### 状态机
```
Contract: signed → active → suspended/completed/terminated
                      ↓
                   resume → active

Hold: active → released/expired
```

## 使用指南

### 导入模块
```typescript
import { ContractModule } from '@domains/contract/contract.module';

@Module({
  imports: [ContractModule],
})
export class AppModule {}
```

### 使用接口
```typescript
import { IContractService } from '@domains/contract/interfaces';

@Injectable()
export class MyService {
  constructor(
    private readonly contractService: IContractService,
  ) {}
}
```

## 注意事项

1. **服务流水是Append-only**：禁止UPDATE/DELETE操作
2. **触发器自动同步余额**：应用层无需手动计算
3. **归档查询必须提供日期范围**：避免全表扫描
4. **事件发布使用Outbox模式**：确保事务一致性
5. **预占会自动过期**：默认15分钟TTL

## 后续工作

### 优先级P0（必须）
- [ ] 实现ContractService核心方法
- [ ] 实现ServiceLedgerService
- [ ] 实现ServiceHoldService
- [ ] 创建基础DTO定义

### 优先级P1（重要）
- [ ] 实现EventPublisherService
- [ ] 实现定时任务
- [ ] 编写单元测试

### 优先级P2（可选）
- [ ] 实现ServiceLedgerArchiveService
- [ ] 性能优化
- [ ] E2E测试

## 相关文档
- 详细设计：`CONTRACT_DOMAIN_DESIGN.md`
- 数据库Schema：`src/infrastructure/database/schema/`
- SQL脚本：`src/infrastructure/database/migrations/sql/`
