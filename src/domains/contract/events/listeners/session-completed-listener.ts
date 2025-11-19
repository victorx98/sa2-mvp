import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  IServiceSessionCompletedEvent,
  SERVICE_SESSION_COMPLETED_EVENT,
} from "@shared/events/service-session-completed.event";
import { ServiceHoldService } from "@domains/contract/services/service-hold.service";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
import { eq, and } from "drizzle-orm";
import * as schema from "@infrastructure/database/schema";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DrizzleDatabase } from "@shared/types/database.types";
import { Inject } from "@nestjs/common";
import { HoldStatus } from "@shared/types/contract-enums";

/**
 * Session Completed Listener for Contract Domain [Contract Domain的会话完成监听器]
 *
 * 负责监听服务会话完成事件，并执行以下操作：
 * 1. 释放相关的服务预占 (Release related service hold)
 * 2. 记录服务消耗到台账 (Record service consumption to ledger)
 *
 * 触发时机：当服务会话完成时（学生参加了咨询会话）
 * Triggered when: When a service session completes (student attended counseling session)
 *
 * @change v2.16.13 - 添加自动释放预占和记录消耗功能
 */
@Injectable()
export class SessionCompletedListener {
  private readonly logger = new Logger(SessionCompletedListener.name);

  constructor(
    private readonly serviceHoldService: ServiceHoldService,
    private readonly serviceLedgerService: ServiceLedgerService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * 监听服务会话完成事件
   * Listen for service session completed event
   *
   * @param event 服务会话完成事件数据
   */
  @OnEvent(SERVICE_SESSION_COMPLETED_EVENT)
  async handleServiceSessionCompletedEvent(
    event: IServiceSessionCompletedEvent,
  ): Promise<void> {
    try {
      const {
        sessionId,
        studentId,
        sessionType,
        actualDurationHours,
      } = event.payload || {};

      this.logger.log(
        `Processing session completed event: ${event.id}, sessionId: ${sessionId}, studentId: ${studentId}, sessionType: ${sessionType}, duration: ${actualDurationHours}h`,
      );

      if (!sessionId || !studentId || !sessionType) {
        this.logger.error(
          `Missing required fields in event payload: sessionId=${sessionId}, studentId=${studentId}, sessionType=${sessionType}`,
        );
        return;
      }

      // 1. 查询该会话的活跃预占 (Query active holds for this session)
      // relatedBookingId 存储 sessionId (relatedBookingId stores sessionId)
      const activeHolds = await this.db
        .select()
        .from(schema.serviceHolds)
        .where(
          and(
            eq(schema.serviceHolds.studentId, studentId),
            eq(schema.serviceHolds.serviceType, sessionType),
            eq(schema.serviceHolds.status, HoldStatus.ACTIVE),
            eq(schema.serviceHolds.relatedBookingId, sessionId),
          ),
        );

      if (activeHolds.length === 0) {
        this.logger.warn(
          `No active hold found for session ${sessionId}, student ${studentId}, serviceType ${sessionType}. Skipping hold release.`,
        );
        // 继续记录消耗，即使没有预占 (Continue to record consumption even without hold)
      } else if (activeHolds.length > 1) {
        this.logger.warn(
          `Multiple active holds (${activeHolds.length}) found for session ${sessionId}. This is unexpected.`,
        );
        // 继续处理第一个预占 (Continue processing the first hold)
      }

      // 2. 在事务中释放预占并记录消耗 (Release hold and record consumption in transaction)
      await this.db.transaction(async (tx) => {
        // 释放预占 (Release hold if exists)
        if (activeHolds.length > 0) {
          const hold = activeHolds[0];
          await this.serviceHoldService.releaseHold(
            hold.id,
            "completed",
            tx,
          );
          this.logger.log(
            `Released hold ${hold.id} for session ${sessionId}`,
          );
        }

        // 记录消耗 (Record consumption)
        // 消耗数量 = 实际时长（转换为整数单位）
        // Consumption quantity = actual duration (converted to integer units)
        const consumptionQuantity = Math.ceil(actualDurationHours || 1);

        await this.serviceLedgerService.recordConsumption(
          {
            studentId,
            serviceType: sessionType,
            quantity: consumptionQuantity,
            relatedBookingId: sessionId,
            createdBy: "system", // 系统自动记录 (System auto-record)
          },
          tx,
        );

        this.logger.log(
          `Recorded consumption of ${consumptionQuantity} units for session ${sessionId}, student ${studentId}, serviceType ${sessionType}`,
        );
      });

      this.logger.log(
        `Successfully processed session completed event: ${event.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process session completed event: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // 根据业务需求决定是否需要重新抛出错误
      // Rethrow or handle based on business requirements
      // throw error;
    }
  }
}
