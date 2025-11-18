# Outbox 模式迁移至 NestJS EventEmitter 实施计划

**版本**: v1.0
**创建日期**: 2025-11-14
**实施周期**: 4 周

---

## 1. 项目概述

### 1.1 迁移目标
废弃 Outbox 模式数据库持久化，全面迁移至 NestJS EventEmitter2 内存事件总线。

**范围**:
- ✅ Contract Domain 事件发布机制
- ✅ EventBus 抽象层移除
- ✅ 监听器重构为 @OnEvent() 装饰器
- ✅ 事件命名标准化
- ❌ Webhook 系统（已使用 EventEmitter，无需修改）
- ❌ 其他域（Catalog、Placement）

### 1.2 关键决策

| 编号 | 决策 | 状态 |
|-----|------|------|
| DEC-001 | 事件命名：`domain.action.v1` 格式 | 已批准 |
| DEC-002 | 废弃 EventBus，使用 @OnEvent() | 已批准 |
| DEC-003 | 全面迁移至 EventEmitter2 | 已批准（高风险） |
| DEC-004 | 死信队列：简化方案（日志+告警） | 已批准 |

---

## 2. 实施策略

采用**分阶段迁移**策略：

**阶段 1**: 监听器重构（1 周）
- 保持 Outbox 发布逻辑
- 监听器迁移到 @OnEvent()
- 测试验证

**阶段 2**: 发布器重构（1 周）
- Contract Service 直接发布到 EventEmitter
- 废弃 domain_events 表写入
- 测试验证

**阶段 3**: 组件移除（1 周）
- 删除 EventPublisher、BackgroundPublisher
- 移除 domain_events 表
- 测试验证

**阶段 4**: 生产验证（1 周）
- 灰度发布
- 监控验证
- 问题修复

---

## 3. 实施计划

### 阶段 1: 监听器重构（Week 1）

**目标**: 监听器迁移到 @OnEvent()，保持 Outbox 发布逻辑不变

**任务分解**:

#### Day 1-2: Financial Domain

**文件**: `src/domains/financial/events/listeners/`

```typescript
// Before: session-completed.listener.ts
export class SessionCompletedListener {
  constructor(private eventPublisher: IEventPublisher) {
    this.eventPublisher.subscribe(
      'services.session.completed',
      this.handleSessionCompleted.bind(this),
    );
  }
}

// After: session-completed.listener.ts
export class SessionCompletedListener {
  @OnEvent('services.session.completed.v1')
  async handleSessionCompleted(event: SessionCompletedEvent): Promise<void> {
    // 业务逻辑不变
  }
}
```

**工作量**: 4 文件 × 2 小时 = 8 小时

| 文件 | 变更 | 测试 |
|-----|------|------|
| session-completed.listener.ts | @OnEvent 装饰器 | ✅ 单元测试 |
| session-evaluated.listener.ts | @OnEvent 装饰器 | ✅ 单元测试 |
| mentor-payable.service.ts | 无变更 | ✅ 集成测试 |
| contract.service.ts | 无变更 | ✅ 集成测试 |

#### Day 3-4: Contract Domain

**文件**: `src/domains/contract/events/listeners/`

相同模式重构

**工作量**: 3 文件 × 2 小时 = 6 小时

#### Day 5: 测试与验证

```bash
# 单元测试
npm test -- src/domains/financial/events/listeners/
npm test -- src/domains/contract/events/listeners/

# 覆盖率要求
- 语句覆盖率: > 90%
- 分支覆盖率: > 85%
```

**验收标准**:
- [ ] 所有监听器使用 @OnEvent() 装饰器
- [ ] 单元测试通过（覆盖率 >90%）
- [ ] 集成测试通过
- [ ] 事件处理逻辑不变

---

### 阶段 2: 发布器重构（Week 2）

**目标**: Contract Service 直接发布到 EventEmitter，废弃 domain_events 表写入

#### Day 1-2: Contract Service 重构

**文件**: `src/domains/contract/services/contract.service.ts`

**变更点**:

```typescript
// Before
async createContract(data: CreateContractDTO) {
  return await this.db.transaction(async (tx) => {
    // 1. 创建合同
    const contract = await tx.insert(contracts).values(data);

    // 2. 写入 Outbox
    await tx.insert(domainEvents).values({
      eventType: 'contract.signed',
      aggregateId: contract.id,
      payload: eventData,
      status: 'pending',
    });
  });
  // 等待 BackgroundPublisher 轮询（30秒延迟）
}

// After
async createContract(data: CreateContractDTO) {
  const contract = await this.db.transaction(async (tx) => {
    return await tx.insert(contracts).values(data);
  });

  // 事务外发布（有风险，参考缓解措施）
  this.eventEmitter.emit('contract.signed.v1', eventData);

  return contract;
}
```

**需要修改的方法**:
1. `createContract()` - 合同创建
2. `activateContract()` - 合同激活
3. `consumeService()` - 服务消耗
4. `completeSession()` - 会话完成

**工作量**: 4 方法 × 4 小时 = 16 小时

#### Day 3: 幂等性增强

由于 EventEmitter 无内置重试，需要加强幂等性检查：

```typescript
// mentor-payable.service.ts
async createPerSessionBilling(dto: CreatePerSessionBillingDTO) {
  // 1. 幂等性检查（加强）
  const existing = await this.findBySessionId(dto.sessionId);
  if (existing) {
    this.logger.warn(`Duplicate billing detected: ${dto.sessionId}`);
    return existing;
  }

  // 2. 业务逻辑
  const ledger = await this.db.transaction(async (tx) => {
    // 创建账单
    const [result] = await tx.insert(mentorPayableLedgers).values(data);
    return result;
  });

  return ledger;
}
```

**工作量**: 4 小时

#### Day 4-5: 测试与验证

**测试重点**:
1. **幂等性测试**: 重复调用不创建重复账单
2. **并发测试**: 100 个并发会话完成
3. **故障测试**: 模拟应用重启，验证事件丢失

```bash
# 并发测试
npm test -- src/domains/financial/test/concurrent-billing.spec.ts

# 故障注入测试
npm test -- src/domains/contract/test/failure-recovery.spec.ts
```

**验收标准**:
- [ ] 所有 Contract Service 方法不再写入 domain_events
- [ ] 直接发布到 EventEmitter
- [ ] 幂等性测试通过（重复调用返回相同结果）
- [ ] 并发测试通过（无重复计费）
- [ ] 故障测试通过（残留影响可接受）

---

### 阶段 3: 组件移除（Week 3）

**目标**: 删除 Outbox 相关组件和表

#### Day 1: 删除 EventPublisher

**删除文件**:
```bash
rm src/domains/contract/services/event-publisher.service.ts
rm src/domains/contract/services/mock-event-publisher.ts
```

**移除引用**:
```typescript
// contract.module.ts
@Module({
  providers: [
    // ❌ 删除
    // EventPublisher,
    // MockEventPublisher,
  ],
})
```

**工作量**: 4 小时

#### Day 2: 删除 BackgroundPublisher

**删除文件**:
```bash
rm src/domains/contract/tasks/event-publisher.task.ts
```

**移除模块引用**:
```typescript
// contract.module.ts
@Module({
  imports: [
    // ❌ 删除 ScheduleModule
  ],
})
```

**工作量**: 2 小时

#### Day 3: 删除 Domain Events Schema

**迁移文件**: `src/infrastructure/database/migrations/`

```sql
-- 创建备份（回滚用）
CREATE TABLE domain_events_backup AS SELECT * FROM domain_events;

-- 删除表
DROP TABLE IF EXISTS domain_events;
```

**删除 schema 文件**:
```bash
rm src/infrastructure/database/schema/domain-events.schema.ts
```

**工作量**: 2 小时

#### Day 4: 模块清理

移除所有相关依赖：

```typescript
// package.json
{
  "dependencies": {
    // ❌ 删除（如果无其他地方使用）
    // "@nestjs/schedule": "^4.0.0",
  }
}
```

更新文档：
```bash
# 更新 API 文档
rm docs/api/event-publisher.md
```

**工作量**: 4 小时

#### Day 5: 回归测试

**全量测试**:
```bash
# 单元测试
npm test

# E2E 测试
npm run test:e2e

# 性能测试（对比基准）
npm run test:perf
```

**验收标准**:
- [ ] domain_events 表已删除
- [ ] EventPublisher 组件已删除
- [ ] BackgroundPublisher 已删除
- [ ] 所有测试通过
- [ ] 无 Outbox 相关代码残留

---

### 阶段 4: 生产验证（Week 4）

**目标**: 灰度发布，监控验证

#### Day 1: 预发布环境部署

**部署**: `staging` 环境

**验证清单**:
- [ ] 服务启动正常
- [ ] 事件发布正常
- [ ] 监听器接收正常
- [ ] 计费流程完整

**监控指标**（Prometheus）：
```yaml
# 必须配置的告警
- alert: EventPublishError
  expr: event_publish_error_total > 5

- alert: BillingDiscrepancy
  expr: billing_discrepancy_total > 0

- alert: ApplicationRestart
  expr: application_restart_total > 2
```

#### Day 2-3: 灰度发布（1% → 10% → 50%）

**发布策略**:

```yaml
# Kubernetes 灰度配置
apiVersion: argoproj.io/v1alpha1
kind: Rollout
spec:
  strategy:
    canary:
      steps:
        - setWeight: 1    # Day 2 Morning
          pause: {duration: 2h}
        - setWeight: 10   # Day 2 Afternoon
          pause: {duration: 4h}
        - setWeight: 50   # Day 3 Morning
          pause: {duration: 8h}
        - setWeight: 100  # Day 3 Afternoon
```

**监控频率**:
- **每 15 分钟**: 检查错误率、事件丢失
- **每小时**: 计费对账
- **每 4 小时**: 完整业务流程测试

**Day 2 Morning (1%)**:
- [ ] 错误率 < 0.1%
- [ ] 无事件丢失
- [ ] 计费准确

**Day 2 Afternoon (10%)**:
- [ ] 错误率 < 0.1%
- [ ] 无事件丢失
- [ ] 计费准确

**Day 3 Morning (50%)**:
- [ ] 错误率 < 0.1%
- [ ] 无事件丢失
- [ ] 计费准确
- [ ] 性能指标正常

**Day 3 Afternoon (100%)**:
- [ ] 全量流量
- [ ] 所有监控指标正常

#### Day 4-5: 生产验证

**持续监控**（48 小时）:

```bash
# 查询事件丢失（日志）
grep "Event published" /var/log/app.log | wc -l
grep "Event processed" /var/log/app.log | wc -l
# 差值 = 丢失事件数

# 计费对账
SELECT
  COUNT(DISTINCT l.session_id) as billed_sessions,
  COUNT(DISTINCT s.id) as completed_sessions,
  COUNT(DISTINCT s.id) - COUNT(DISTINCT l.session_id) as missing_billings
FROM sessions s
LEFT JOIN mentor_payable_ledgers l ON s.id = l.session_id
WHERE s.completed_at > NOW() - INTERVAL '24 hours';
# missing_billings 应该为 0
```

**验收标准**:
- [ ] 48 小时生产运行无严重问题
- [ ] 事件丢失率 < 0.1%
- [ ] 计费对账差异 = 0
- [ ] 客户投诉 < 3 单/天
- [ ] 性能指标（延迟、吞吐量）正常

**回滚决策**:

| 条件 | 阈值 | 行动 |
|-----|------|------|
| 事件丢失率 | > 0.5% | 立即回滚 |
| 计费错误 | > 1% | 立即回滚 |
| 客户投诉 | > 10 单/天 | 立即回滚 |
| 应用崩溃 | > 2 次/天 | 立即回滚 |

---

## 4. 风险缓解

### 4.1 DEC-003 风险缓解措施

全面实施（必须在生产发布前完成）：

#### 1. 优雅关闭

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 优雅关闭
  app.enableShutdownHooks();

  await app.listen(3000);
}

// listeners
@Injectable()
export class SessionCompletedListener {
  private pendingEvents = new Set<string>();

  @OnEvent('services.session.completed.v1')
  async handle(event: SessionCompletedEvent) {
    const eventId = event.id;
    this.pendingEvents.add(eventId);

    try {
      await this.process(event);
    } finally {
      this.pendingEvents.delete(eventId);
    }
  }

  async waitForPendingEvents(timeout = 30000): Promise<void> {
    const startTime = Date.now();
    while (this.pendingEvents.size > 0) {
      if (Date.now() - startTime > timeout) {
        this.logger.error(
          `Timeout waiting for ${this.pendingEvents.size} pending events`,
        );
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
```

#### 2. 事件备份

```typescript
// event-backup.service.ts
@Injectable()
export class EventBackupService {
  constructor(@Inject('DB') private db: Database) {}

  async backupEvent(event: EventData): Promise<void> {
    await this.db.insert(eventBackups).values({
      eventId: event.id,
      eventName: event.name,
      payload: event.payload,
      status: 'pending',
    });
  }

  async markAsProcessed(eventId: string): Promise<void> {
    await this.db
      .update(eventBackups)
      .set({ status: 'processed' })
      .where(eq(eventBackups.eventId, eventId));
  }

  async getPendingEvents(): Promise<EventBackup[]> {
    return await this.db
      .select()
      .from(eventBackups)
      .where(eq(eventBackups.status, 'pending'));
  }
}
```

**表结构**:
```sql
CREATE TABLE event_backups (
  event_id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL, -- pending, processed
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX idx_event_backups_status ON event_backups(status);
```

#### 3. 监控告警

```typescript
// event-metrics.service.ts
@Injectable()
export class EventMetricsService {
  private readonly eventPublishCounter = new Counter({
    name: 'event_published_total',
    labelNames: ['event_type', 'status'],
  });

  private readonly eventProcessCounter = new Counter({
    name: 'event_processed_total',
    labelNames: ['event_type', 'status'],
  });

  private readonly eventDurationHistogram = new Histogram({
    name: 'event_duration_seconds',
    labelNames: ['event_type'],
    buckets: [0.1, 0.5, 1, 2, 5],
  });

  recordPublished(eventType: string, success: boolean): void {
    this.eventPublishCounter.inc({
      event_type: eventType,
      status: success ? 'success' : 'failure',
    });
  }

  recordProcessed(eventType: string, success: boolean, duration: number): void {
    this.eventProcessCounter.inc({
      event_type: eventType,
      status: success ? 'success' : 'failure',
    });
    this.eventDurationHistogram.observe(duration);
  }
}
```

**必须配置的告警**:

```yaml
# Grafana 告警配置
alerts:
  - name: EventLossRateHigh
    expr: |
      rate(event_published_total[5m]) - rate(event_processed_total[5m]) > 0.001
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: Event loss rate is high

  - name: BillingDiscrepancy
    expr: billing_discrepancy_count > 0
    for: 1m
    labels:
      severity: critical

  - name: ApplicationRestart
    expr: increase(application_restart_total[1h]) > 2
    for: 0m
    labels:
      severity: warning
```

#### 4. 补偿机制

**对账脚本**: `scripts/reconciliation.js`

```typescript
#!/usr/bin/env ts-node
import { db } from '@infrastructure/database';

async function reconcileBilling() {
  const discrepancies = await db.query`
    SELECT
      s.id as session_id,
      s.completed_at,
      l.id as ledger_id
    FROM sessions s
    LEFT JOIN mentor_payable_ledgers l ON s.id = l.session_id
    WHERE s.completed_at > NOW() - INTERVAL '24 hours'
      AND l.id IS NULL
  `;

  if (discrepancies.length > 0) {
    await sendAlert({
      severity: 'critical',
      title: `${discrepancies.length} sessions missing billing`,
      sessions: discrepancies.map(d => d.session_id),
    });
  }
}

reconcileBilling();
```

**手动补偿流程**:

```typescript
// admin.controller.ts
@Controller('admin')
export class AdminController {
  @Post('/events/replay/:sessionId')
  async replayEvent(@Param('sessionId') sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    this.eventEmitter.emit('services.session.completed.v1', {
      sessionId: session.id,
      contractId: session.contract_id,
      // ... other fields
    });
    return { success: true };
  }
}
```

---

## 5. 回滚计划

### 5.1 回滚触发条件

| 指标 | 阈值 | 持续时间 | 行动 |
|-----|------|---------|------|
| 事件丢失率 | > 0.5% | 5 分钟 | 立即回滚 |
| 计费错误 | > 1% | 1 分钟 | 立即回滚 |
| 客户投诉 | > 10 单/天 | - | 立即回滚 |
| 应用崩溃 | > 2 次/天 | - | 立即回滚 |

### 5.2 回滚步骤

**估计回滚时间**: 30 分钟

#### 步骤 1: 数据库回滚（5 分钟）

```bash
# 1. 恢复 domain_events 表（从备份）
psql -d $DATABASE_URL -f scripts/restore_domain_events.sql

# 2. 恢复 EventPublisher 状态（如果需要）
 psql -d $DATABASE_URL -c "
  UPDATE domain_events
  SET status = 'pending'
  WHERE status = 'processing'
    AND created_at > NOW() - INTERVAL '1 hour';
"
```

#### 步骤 2: 代码回滚（10 分钟）

```bash
# 1. 切换到回滚分支
git checkout outbox-migration-backup

# 2. 部署
kubectl set image deployment/app app=registry/app:v1.0-outbox

# 3. 验证部署
kubectl rollout status deployment/app
```

#### 步骤 3: 数据修复（15 分钟）

```typescript
// 重新发布丢失事件
async function fixLostEvents() {
  const lostEvents = await db.query`
    SELECT * FROM event_backups
    WHERE status = 'pending'
      AND created_at > NOW() - INTERVAL '24 hours'
  `;

  for (const event of lostEvents) {
    await outboxPublisher.publish(event);
    await eventBackupService.markAsProcessed(event.event_id);
  }
}
```

---

## 6. 资源需求

### 6.1 人员需求

| 角色 | 人数 | 时间 | 职责 |
|-----|------|------|------|
| 后端工程师 | 2 | 全职 4 周 | 代码开发、测试 |
| QA 工程师 | 1 | 全职 2 周 | 测试用例、验证 |
| DevOps 工程师 | 1 | 兼职 2 周 | 部署、监控 |
| 技术负责人 | 1 | 兼职 4 周 | 技术评审、风险管控 |

### 6.2 环境需求

| 环境 | 用途 | 时间 |
|-----|------|------|
| Development | 开发 | 4 周 |
| Staging | 集成测试 | 2 周 |
| Production | 灰度发布 | 1 周 |

---

## 7. 验收标准

### 7.1 功能验收

- [ ] 所有事件通过 EventEmitter 发布
- [ ] 所有监听器使用 @OnEvent() 装饰器
- [ ] 事件命名符合 `domain.action.v1` 格式
- [ ] 无 Outbox 相关代码残留
- [ ] 单元测试覆盖率 > 90%
- [ ] E2E 测试通过

### 7.2 性能验收

| 指标 | 目标 | 测试方法 |
|-----|------|---------|
| 事件发布延迟 | < 100ms | Prometheus 直方图 |
| 事件处理延迟 | < 500ms | Prometheus 直方图 |
| 吞吐量 | > 500 events/s | Load test |
| 内存使用 | < 500MB | Grafana 监控 |

### 7.3 可靠性验收

| 指标 | 目标 | 监控方式 |
|-----|------|---------|
| 事件丢失率 | < 0.1% | 日志分析 |
| 计费准确率 | 100% | 每日对账 |
| 幂等性 | 100% | 重复调用测试 |
| 优雅关闭成功率 | 100% | 模拟重启测试 |

---

## 8. 风险清单

| 编号 | 风险描述 | 概率 | 影响 | 缓解措施 | 负责人 |
|-----|---------|-----|------|---------|--------|
| R-001 | 事件丢失导致计费失败 | 中 | 极高 | 优雅关闭、事件备份 | 技术负责人 |
| R-002 | 事务不一致 | 中 | 高 | 幂等性检查、对账 | 后端工程师 |
| R-003 | 瞬态故障永久失败 | 高 | 中 | 简化死信队列 | 后端工程师 |
| R-004 | 监控盲点 | 低 | 中 | 完整监控告警 | DevOps |
| R-005 | 应用重启数据丢失 | 中 | 中 | 优雅关闭 | 后端工程师 |
| R-006 | 异常阻塞事件总线 | 低 | 中 | 异步处理 | 后端工程师 |

---

## 9. 附录

### 9.1 提交清单

**代码提交**:
```bash
git checkout -b feature/migrate-outbox-to-eventemitter

# Week 1
git add src/domains/financial/events/listeners/
git commit -m "refactor(financial): migrate listeners to @OnEvent()"

# Week 2
git add src/domains/contract/services/contract.service.ts
git commit -m "refactor(contract): publish events directly via EventEmitter"

# Week 3
git rm src/domains/contract/services/event-publisher.service.ts
git rm src/domains/contract/tasks/event-publisher.task.ts
git commit -m "refactor(contract): remove Outbox components"

# Week 4
git tag v2.0-eventemitter
```

### 9.2 部署检查清单

**生产发布前**:
- [ ] 所有测试通过
- [ ] 监控告警配置完成
- [ ] 回滚方案准备就绪
- [ ] 数据备份完成
- [ ] 团队待命
- [ ] 客户通知（如果需要）

**发布后**:
- [ ] 监控指标正常
- [ ] 错误日志无异常
- [ ] 计费对账正常
- [ ] 客户无投诉

---

**文档版本**: v1.0
**批准人**: _______________
**批准日期**: _______________
