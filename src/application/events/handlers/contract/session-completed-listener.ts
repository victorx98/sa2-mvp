import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { HandlesEvent, ServiceSessionCompletedEvent } from "@application/events";
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
  @OnEvent(ServiceSessionCompletedEvent.eventType)
  @HandlesEvent(ServiceSessionCompletedEvent.eventType, SessionCompletedListener.name)
  async handleServiceSessionCompletedEvent(
    event: ServiceSessionCompletedEvent,
  ): Promise<void> {
    try {
      const { sessionId, studentId, serviceTypeCode, actualDurationMinutes, durationMinutes, sessionTypeCode } =
        event.payload || {};

      this.logger.log(
        `Processing session completed event: ${event.id}, sessionId: ${sessionId}, studentId: ${studentId}, serviceType: ${serviceTypeCode}, duration: ${actualDurationMinutes}min, sessionType: ${sessionTypeCode}`,
      );

      // Validate required fields [验证必填字段]
      if (!sessionId || !studentId || !serviceTypeCode) {
        this.logger.error(
          `Missing required fields in event payload: sessionId=${sessionId}, studentId=${studentId}, serviceType=${serviceTypeCode}`,
        );
        return;
      }

      // Validate sessionTypeCode [验证sessionTypeCode]
      if (!sessionTypeCode) {
        this.logger.error(`Missing sessionTypeCode in event payload for session ${sessionId}`);
        return;
      }

      // 1. 查询该会话的活跃预占 (Query active holds for this session)
      // relatedBookingId 存储 sessionId (relatedBookingId stores sessionId)
      // 使用 FOR UPDATE 加悲观锁，防止并发竞态 (Use FOR UPDATE pessimistic lock to prevent race conditions)
      const activeHolds = await this.db
        .select()
        .from(schema.serviceHolds)
        .where(
          and(
            eq(schema.serviceHolds.studentId, studentId),
            eq(schema.serviceHolds.serviceType, serviceTypeCode),
            eq(schema.serviceHolds.status, HoldStatus.ACTIVE),
            eq(schema.serviceHolds.relatedBookingId, sessionId),
          ),
        )
        .for('update')
        .limit(1);

      if (activeHolds.length === 0) {
        this.logger.warn(
          `No active hold found for session ${sessionId}, student ${studentId}, serviceType ${serviceTypeCode}. Skipping hold release.`,
        );
        // 继续记录消耗，即使没有预占 (Continue to record consumption even without hold)
      } else if (activeHolds.length > 1) {
        this.logger.warn(
          `Multiple active holds (${activeHolds.length}) found for session ${sessionId}. This is unexpected.`,
        );
        // 继续处理第一个预占 (Continue processing the first hold)
      }

      // 2. 幂等性检查：检查是否已记录消耗 (Idempotency check: Check if consumption already recorded)
      const existingConsumption = await this.db
        .select()
        .from(schema.serviceLedgers)
        .where(
          and(
            eq(schema.serviceLedgers.studentId, studentId),
            eq(schema.serviceLedgers.serviceType, serviceTypeCode),
            eq(schema.serviceLedgers.relatedBookingId, sessionId),
            eq(schema.serviceLedgers.type, 'consumption'),
          ),
        )
        .limit(1);

      if (existingConsumption.length > 0) {
        this.logger.warn(
          `Consumption already recorded for session ${sessionId}, skipping duplicate processing`,
        );
        return;
      }

      // 3. 在事务中释放预占并记录消耗 (Release hold and record consumption in transaction)
      await this.db.transaction(async (tx) => {
        // 释放预占 (Release hold if exists)
        if (activeHolds.length > 0) {
          const hold = activeHolds[0];
          await this.serviceHoldService.releaseHold(hold.id, "completed", tx);
          this.logger.log(`Released hold ${hold.id} for session ${sessionId}`);
        }

        // 记录消耗 (Record consumption)
        // 消耗数量 = 实际时长（分钟）转换为小时，向上取整
        // Consumption quantity = actual duration (minutes) converted to hours, rounded up
        // 区分未提供时长（null/undefined）和真实0值 (Distinguish between no duration provided and actual 0 value)
        const consumptionQuantity = actualDurationMinutes == null
          ? Math.ceil((durationMinutes || 60) / 60)  // 使用计划时长 (Use scheduled duration)
          : actualDurationMinutes === 0
            ? 0  // 0分钟不消耗 (0 minutes = no consumption)
            : Math.ceil(actualDurationMinutes / 60);  // 向上取整 (Round up)

        await this.serviceLedgerService.recordConsumption(
          {
            studentId,
            serviceType: serviceTypeCode,
            quantity: consumptionQuantity,
            relatedBookingId: sessionId,
            bookingSource: sessionTypeCode, // Use from event payload [使用事件负载中的值]
            createdBy: studentId, // Use studentId as valid UUID for createdBy field [使用studentId作为有效的UUID]
          },
          tx,
        );

        this.logger.log(
          `Recorded consumption of ${consumptionQuantity} units for session ${sessionId}, student ${studentId}, serviceType ${serviceTypeCode}`,
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
      throw error;
    }
  }
}
