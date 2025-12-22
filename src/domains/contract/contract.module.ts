import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { ContractService } from "./services/contract.service";
import { ServiceLedgerService } from "./services/service-ledger.service";
import { ServiceHoldService } from "./services/service-hold.service";
import { SessionCompletedListener } from "./event-handlers/session-completed-listener";

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
 * - Append-only Ledger(仅追加账本)
 * - Event-driven Architecture(事件驱动架构)
 * - Transactional Event Processing(事务性事件处理)
 *
 * Implementation Status(实现状态): ✅ Phase 1 Complete (阶段1完成)
 * - ContractService moved to Commands (ContractService迁移到Commands)
 * - All lifecycle methods implemented (所有生命周期方法已实现)
 * - Service balance and consumption integrated (服务余额和消费已集成)
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    // Core services
    ContractService,
    ServiceLedgerService,
    ServiceHoldService,
    // Event listeners
    SessionCompletedListener,
  ],
  exports: [ContractService, ServiceLedgerService, ServiceHoldService],
})
export class ContractModule {}
