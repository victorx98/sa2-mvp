import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { MentorPayableService } from "./services/mentor-payable.service";
import { SessionEvaluatedListener } from "./events/listeners/session-evaluated.listener";
import { SessionCompletedListener } from "./events/listeners/session-completed.listener";

/**
 * Financial Domain Module(财务领域模块)
 *
 * Core module for financial management including(财务管理核心模块，包括):
 * - Mentor payable management(导师应付管理)
 * - Session billing processing(会话计费处理)
 * - Financial event handling(财务事件处理)
 *
 * Design Patterns(设计模式):
 * - DDD (Domain-Driven Design)(领域驱动设计)
 * - Event-driven Architecture(事件驱动架构)
 * - Dependency Injection(依赖注入)
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    // Core services
    {
      provide: "IMentorPayableService",
      useClass: MentorPayableService,
    },
    // Event listeners
    SessionEvaluatedListener,
    SessionCompletedListener,
  ],
  exports: [
    // Export the service interface for dependency injection
    "IMentorPayableService",
  ],
})
export class FinancialModule {}
