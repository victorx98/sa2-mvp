import { Injectable, Logger, Inject } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  IServiceSessionCompletedEvent,
  SERVICE_SESSION_COMPLETED_EVENT,
} from "@shared/events/service-session-completed.event";
import { ServiceHoldService } from "@domains/contract/services/service-hold.service";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DrizzleDatabase } from "@shared/types/database.types";
import { eq, and } from "drizzle-orm";
import * as schema from "@infrastructure/database/schema";
import { HoldStatus } from "@shared/types/contract-enums";

/**
 * Service Session Completed Handler
 * 应用层事件处理器：处理服务会话完成后的合同履约逻辑
 */
@Injectable()
export class ServiceSessionCompletedHandler {
  private readonly logger = new Logger(ServiceSessionCompletedHandler.name);

  constructor(
    // 注入领域服务 (Domain Services)
    private readonly serviceHoldService: ServiceHoldService,
    private readonly serviceLedgerService: ServiceLedgerService,
    // 注入基础设施 (Infrastructure)
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  @OnEvent(SERVICE_SESSION_COMPLETED_EVENT)
  async handle(event: IServiceSessionCompletedEvent): Promise<void> {
    const { sessionId, studentId, sessionTypeCode, actualDurationHours } = event.payload || {};
    
    this.logger.log(`[Application] Handling session completed: ${sessionId}`);

    // 1. 纯读取逻辑（可以直接在这里做，也可以封装到 Query Service）
    const activeHolds = await this.db
      .select()
      .from(schema.serviceHolds)
      .where(
        and(
            eq(schema.serviceHolds.studentId, studentId),
            eq(schema.serviceHolds.serviceType, sessionTypeCode),
            eq(schema.serviceHolds.status, HoldStatus.ACTIVE),
            eq(schema.serviceHolds.relatedBookingId, sessionId),
        )
    );

    // 2. 开启事务 (Application 层的职责)
    await this.db.transaction(async (tx) => {
        // 3. 指挥 Domain Service 执行核心业务
        if (activeHolds.length > 0) {
           await this.serviceHoldService.releaseHold(activeHolds[0].id, "completed", tx);
        }
        
        const quantity = Math.ceil(actualDurationHours || 1);
        await this.serviceLedgerService.recordConsumption({
            studentId,
            serviceType: sessionTypeCode,
            quantity,
            relatedBookingId: sessionId,
            bookingSource: "regular_mentoring_sessions",
            createdBy: studentId, 
        }, tx);
    });
  }
}
