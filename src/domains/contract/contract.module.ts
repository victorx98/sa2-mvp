import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { ContractService } from "./services/contract.service";
import { ServiceLedgerService } from "./services/service-ledger.service";
import { ServiceHoldService } from "./services/service-hold.service";
import { ServiceLedgerArchiveService } from "./services/service-ledger-archive.service";
import { EventPublisherService } from "./services/event-publisher.service";
import { MockEventPublisher } from "./services/mock-event-publisher";
import { EventBusService } from "./events/event-bus.service";
import { EventPublisherTask } from "./tasks/event-publisher.task";
import { PaymentSucceededListener } from "./events/listeners/payment-succeeded.listener";
import { SessionCompletedListener } from "./events/listeners/session-completed.listener";
import { SessionCancelledListener } from "./events/listeners/session-cancelled.listener";

/**
 * Contract Domain Module(合约领域模块)
 *
 * Core module for contract management including(合约管理核心模块，包括):
 * - Contract lifecycle management (draft -> signed -> active -> completed/terminated/suspended)(合约生命周期管理：草稿 -> 已签署 -> 激活 -> 完成/终止/暂停)
 * - Service entitlement management(服务权益管理)
 * - Service ledger tracking (append-only)(服务账本追踪，仅追加)
 * - Service hold management (manual release, no TTL)(服务预占管理，手动释放，无过期时间)
 * - Archive and event management(归档和事件管理)
 * - Event listeners for cross-domain integration(跨域集成的事件监听器)
 *
 * Design Patterns(设计模式):
 * - DDD (Domain-Driven Design)(领域驱动设计)
 * - Anti-Corruption Layer (Product snapshots)(防腐层，产品快照)
 * - Outbox Pattern (Event publishing)(发件箱模式，事件发布)
 * - Append-only Ledger(仅追加账本)
 * - Event-driven Architecture(事件驱动架构)
 * - Transactional Event Processing(事务性事件处理)
 *
 * Implemented Services(已实现的服务):
 * ✅ ContractService - Contract lifecycle and entitlement management (12 methods)(合约生命周期和权益管理，12个方法)
 * ✅ ServiceLedgerService - Ledger tracking (append-only, 5 methods)(账本追踪，仅追加，5个方法)
 * ✅ ServiceHoldService - Hold management (manual release, 5 methods)(预占管理，手动释放，5个方法)
 * ✅ ServiceLedgerArchiveService - Archive management (cold-hot separation)(归档管理，冷热分离)
 * ✅ EventPublisherService - Event publishing (Outbox pattern)(事件发布，发件箱模式)
 * ✅ HoldCleanupTask - @deprecated v2.16.9 (replaced by manual release)(已废弃v2.16.9，由手动释放替代)
 * ✅ EventPublisherTask - Scheduled task (every 30 sec + daily stats/cleanup)(定时任务，每30秒+每日统计/清理)
 * ✅ PaymentSucceededListener - Auto-activates contracts on payment(支付成功时自动激活合约)
 * ✅ SessionCompletedListener - Auto-consumes services on session completion(会话完成时自动消费服务)
 * ✅ SessionCancelledListener - Auto-releases holds on session cancellation(会话取消时自动释放预占)
 *
 * Implementation Status(实现状态): ✅ Phase 1-7 Complete (D1-D7)(阶段1-7完成)
 * - Infrastructure Layer: 14 files (schemas, SQL scripts, types)(基础设施层：14个文件)
 * - Common Layer: 7 files (exceptions, constants, types, utils)(公共层：7个文件)
 * - Core Services: 5 services with 25+ methods(核心服务：5个服务，25+方法)
 * - Event Listeners: 3 listeners for cross-domain integration(事件监听器：3个跨域监听器)
 * - Scheduled Tasks: 2 tasks with cron schedules(定时任务：2个cron任务)
 * - DTOs: 6 validation DTOs(DTO：6个验证DTO)
 */
@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot()],
  providers: [
    // Core services
    ContractService,
    ServiceLedgerService,
    ServiceHoldService,
    ServiceLedgerArchiveService,
    EventPublisherService,
    // Event bus (local EventEmitter implementation)
    EventBusService,
    // Event publisher implementation
    {
      provide: "EVENT_PUBLISHER",
      useClass: MockEventPublisher, // Replace with RabbitMQ/Kafka in production
    },
    // Event listeners
    PaymentSucceededListener,
    SessionCompletedListener,
    SessionCancelledListener,
    // Scheduled tasks
    EventPublisherTask,
  ],
  exports: [
    ContractService,
    ServiceLedgerService,
    ServiceHoldService,
    ServiceLedgerArchiveService,
    EventPublisherService,
    // @deprecated v2.16.9 - HoldCleanupTask removed from exports
  ],
})
export class ContractModule {}
