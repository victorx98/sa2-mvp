import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { ContractService } from "./services/contract.service";
import { ServiceLedgerService } from "./services/service-ledger.service";
import { ServiceHoldService } from "./services/service-hold.service";
import { ServiceLedgerArchiveService } from "./services/service-ledger-archive.service";
import { EventPublisherService } from "./services/event-publisher.service";
import { MockEventPublisher } from "./services/mock-event-publisher";
import { HoldCleanupTask } from "./tasks/hold-cleanup.task";
import { EventPublisherTask } from "./tasks/event-publisher.task";

/**
 * Contract Domain Module
 *
 * Core module for contract management including:
 * - Contract lifecycle management (signed -> active -> completed/terminated)
 * - Service entitlement management
 * - Service ledger tracking (append-only)
 * - Service hold management (TTL mechanism)
 * - Archive and event management
 *
 * Design Patterns:
 * - DDD (Domain-Driven Design)
 * - Anti-Corruption Layer (Product snapshots)
 * - Outbox Pattern (Event publishing)
 * - Append-only Ledger
 * - TTL Hold Mechanism
 *
 * Implemented Services:
 * ✅ ContractService - Contract lifecycle and entitlement management (8 methods)
 * ✅ ServiceLedgerService - Ledger tracking (append-only, 5 methods)
 * ✅ ServiceHoldService - Hold management (TTL, 5 methods)
 * ✅ ServiceLedgerArchiveService - Archive management (cold-hot separation)
 * ✅ EventPublisherService - Event publishing (Outbox pattern)
 * ✅ HoldCleanupTask - Scheduled task (every 5 min)
 * ✅ EventPublisherTask - Scheduled task (every 30 sec + daily stats/cleanup)
 *
 * Implementation Status: ✅ Phase 1-5 Complete
 * - Infrastructure Layer: 13 files (schemas, SQL scripts, types)
 * - Common Layer: 7 files (exceptions, constants, types, utils)
 * - Core Services: 5 services with 20+ methods
 * - Scheduled Tasks: 2 tasks with cron schedules
 * - DTOs: 4 validation DTOs
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
    // Event publisher implementation
    {
      provide: "EVENT_PUBLISHER",
      useClass: MockEventPublisher, // Replace with RabbitMQ/Kafka in production
    },
    // Scheduled tasks
    HoldCleanupTask,
    EventPublisherTask,
  ],
  exports: [
    ContractService,
    ServiceLedgerService,
    ServiceHoldService,
    ServiceLedgerArchiveService,
    EventPublisherService,
  ],
})
export class ContractModule {}
