import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { MentorPayableService } from "./services/mentor-payable.service";
import { SettlementService } from "./services/settlement.service";
import { MentorPaymentInfoService } from "./services/mentor-payment-info.service";
import { MentorPaymentParamService } from "./services/mentor-payment-param.service";
import { MentorAppealService } from "./services/mentor-appeal.service";
import { MentorPriceService } from "./services/mentor-price.service";
import { ClassMentorPriceService } from "./services/class-mentor-price.service";
import { ServiceSessionCompletedListener } from "./events/listeners/service-session-completed-listener";
import { SettlementConfirmedListener } from "./events/listeners/settlement-confirmed.listener";
import { PlacementApplicationStatusChangedListener } from "./events/listeners/placement-application-status-changed.listener";
import { PlacementApplicationStatusRolledBackListener } from "./events/listeners/placement-application-status-rolled-back.listener";
import { AppealApprovedListener } from "./events/listeners/appeal-approved.listener";

/**
 * Financial Domain Module(财务领域模块)
 *
 * Core module for financial management including(财务管理核心模块，包括):
 * - Mentor payable management(导师应付管理)
 * - Session billing processing(会话计费处理)
 * - Settlement processing(结算处理)
 * - Payment information management(支付信息管理)
 * - Payment parameter management(支付参数管理)
 * - Mentor appeal management(导师申诉管理)
 * - Class mentor price management(班级导师价格管理)
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
    // Core services - Using custom token for interface-based injection
    MentorPayableService,
    SettlementService,
    MentorPaymentInfoService,
    MentorPaymentParamService,
    MentorAppealService,
    MentorPriceService,
    ClassMentorPriceService,
    {
      provide: "IMentorPayableService",
      useClass: MentorPayableService,
    },
    {
      provide: "ISettlementService",
      useClass: SettlementService,
    },
    {
      provide: "IMentorPaymentInfoService",
      useClass: MentorPaymentInfoService,
    },
    {
      provide: "IMentorPaymentParamService",
      useClass: MentorPaymentParamService,
    },
    {
      provide: "IMentorAppealService",
      useClass: MentorAppealService,
    },
    {
      provide: "IMentorPriceService",
      useClass: MentorPriceService,
    },
    {
      provide: "IClassMentorPriceService",
      useClass: ClassMentorPriceService,
    },
    // Event listeners
    ServiceSessionCompletedListener,
    SettlementConfirmedListener,
    PlacementApplicationStatusChangedListener,
    PlacementApplicationStatusRolledBackListener,
    AppealApprovedListener,
  ],
  exports: [
    // Export services with custom token for interface-based injection
    "IMentorPayableService",
    "ISettlementService",
    "IMentorPaymentInfoService",
    "IMentorPaymentParamService",
    "IMentorAppealService",
    "IMentorPriceService",
    "IClassMentorPriceService",
    // Export concrete service classes for direct injection in commands/queries
    MentorPayableService,
    SettlementService,
    MentorPaymentInfoService,
    MentorPaymentParamService,
    MentorAppealService,
    MentorPriceService,
    ClassMentorPriceService,
  ],
})
export class FinancialModule {}
