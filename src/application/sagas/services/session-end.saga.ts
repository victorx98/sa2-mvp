import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { and, eq } from "drizzle-orm";
import { CalendarService, SlotStatus } from "@core/calendar";
import { ServiceHoldService } from "@domains/contract/services/service-hold.service";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
import { MentorPayableService } from "@domains/financial/services/mentor-payable.service";
import {
  HandlesEvent,
  IntegrationEventPublisher,
  ServiceSessionCompletedEvent,
} from "@application/events";
import { SagaBase } from "@application/core/saga.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import * as schema from "@infrastructure/database/schema";
import { HoldStatus } from "@shared/types/contract-enums";
import { BadRequestException } from "@nestjs/common";

/**
 * SessionEndSaga 类型定义 (SessionEndSaga type definitions)
 */
type CompensationResult = {
  requireManualIntervention: boolean;
  compensationErrors: string[];
};

type SessionEndSteps = {
  calendarUpdated: boolean;
  holdReleased: boolean;
  consumptionRecorded: boolean;
  billingCreated: boolean;
};

/**
 * Session End Saga (会话结束流程编排器)
 *
 * 职责：
 * 1. 监听ServiceSessionCompletedEvent事件
 * 2. 按顺序协调三个领域的操作（Calendar、Contract、Financial）
 * 3. 确保跨领域事务的一致性
 * 4. 提供失败补偿机制
 *
 * 设计原则：
 * - 集中式编排（vs分布式监听器）
 * - 顺序执行（保证一致性）
 * - 显式补偿（失败回滚）
 * - 幂等性保证（支持重试）
 *
 * 流程：
 * Step 1: 更新日历槽位为completed
 * Step 2: 释放服务预占 + 记录服务消耗
 * Step 3: 创建导师计费记录
 *
 * 失败处理：
 * - 任一步骤失败，执行补偿逻辑回滚已完成的步骤
 * - 记录详细错误日志
 * - 支持人工介入
 *
 * @version 2.0
 * @since 2024-12-26
 */
@Injectable()
export class SessionEndSaga extends SagaBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    eventPublisher: IntegrationEventPublisher,
    private readonly calendarService: CalendarService,
    private readonly serviceHoldService: ServiceHoldService,
    private readonly serviceLedgerService: ServiceLedgerService,
    @Inject("IMentorPayableService")
    private readonly mentorPayableService: MentorPayableService,
  ) {
    super(db, eventPublisher);
  }

  /**
   * 处理服务会话完成事件 (Handle service session completed event)
   *
   * @param event ServiceSessionCompletedEvent
   */
  @OnEvent(ServiceSessionCompletedEvent.eventType)
  @HandlesEvent(ServiceSessionCompletedEvent.eventType, SessionEndSaga.name)
  async handleServiceSessionCompleted(
    event: ServiceSessionCompletedEvent,
  ): Promise<void> {
    const payload = event.payload;
    const {
      sessionId,
      studentId,
      mentorId,
      referenceId,
      serviceTypeCode,
      sessionTypeCode,
      actualDurationMinutes,
      durationMinutes,
      allowBilling,
    } = payload;

    this.logger.log(
      `[SessionEndSaga] Processing session end: sessionId=${sessionId}, student=${studentId}, mentor=${mentorId}`,
    );

    // 跟踪已完成的步骤，用于补偿 (Track completed steps for compensation)
    const completedSteps: SessionEndSteps = {
      calendarUpdated: false,
      holdReleased: false,
      consumptionRecorded: false,
      billingCreated: false,
    };

    try {
      // ==================== 验证必填字段 (Validate required fields) ====================
      if (!sessionId || !studentId || !serviceTypeCode || !sessionTypeCode) {
        throw new BadRequestException(
          `Missing required fields: sessionId=${sessionId}, studentId=${studentId}, serviceTypeCode=${serviceTypeCode}, sessionTypeCode=${sessionTypeCode}`,
        );
      }

      // ==================== Step 1: 更新日历槽位 (Update calendar slots) ====================
      this.logger.debug(`[SessionEndSaga] Step 1: Updating calendar slots for session ${sessionId}`);

      // 查询关联的meetingId (Query associated meetingId)
      const sessionRecord = await this.db.query.regularMentoringSessions.findFirst({
        where: (sessions, { eq }) => eq(sessions.id, sessionId),
        columns: { meetingId: true },
      });

      if (sessionRecord?.meetingId) {
        const updatedCount = await this.calendarService.updateStatusByMeetingId(
          sessionRecord.meetingId,
          SlotStatus.COMPLETED,
        );
        this.logger.log(
          `[SessionEndSaga] Updated ${updatedCount} calendar slot(s) to completed for meeting ${sessionRecord.meetingId}`,
        );
        completedSteps.calendarUpdated = true;
      } else {
        this.logger.warn(
          `[SessionEndSaga] No meetingId found for session ${sessionId}, skipping calendar update`,
        );
      }

      // ==================== Step 2: Contract领域处理 (Contract domain processing) ====================
      this.logger.debug(`[SessionEndSaga] Step 2: Processing contract operations for session ${sessionId}`);

      await this.processContractOperations(
        sessionId,
        studentId,
        serviceTypeCode,
        sessionTypeCode,
        actualDurationMinutes,
        durationMinutes,
        completedSteps,
      );

      // ==================== Step 3: Financial领域处理 (Financial domain processing) ====================
      if (mentorId && allowBilling) {
        this.logger.debug(`[SessionEndSaga] Step 3: Processing financial operations for session ${sessionId}`);

        await this.processFinancialOperations(
          payload,
          mentorId,
          referenceId,
          sessionTypeCode,
          completedSteps,
        );
      } else {
        this.logger.log(
          `[SessionEndSaga] Skipping billing: mentorId=${mentorId}, allowBilling=${allowBilling}`,
        );
      }

      // ==================== 成功完成 (Success) ====================
      this.logger.log(
        `[SessionEndSaga] Successfully completed session end processing for ${sessionId}`,
      );

    } catch (error) {
      // ==================== 失败补偿 (Failure compensation) ====================
      this.logger.error(
        `[SessionEndSaga] Failed to process session end for ${sessionId}: ${this.stringifyError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      const compensation = await this.compensateSessionEnd(
        sessionId,
        studentId,
        serviceTypeCode,
        completedSteps,
      );

      // 记录补偿结果 (Log compensation result)
      if (compensation.requireManualIntervention) {
        this.logger.error(
          `[SessionEndSaga] Manual intervention required for session ${sessionId}. Errors: ${compensation.compensationErrors.join(" | ")}`,
        );
      }

      // 重新抛出错误，触发事件重试 (Rethrow error to trigger event retry)
      throw error;
    }
  }

  /**
   * 处理Contract领域操作 (Process contract domain operations)
   *
   * @param sessionId 会话ID
   * @param studentId 学生ID
   * @param serviceTypeCode 服务类型代码
   * @param sessionTypeCode 会话类型代码
   * @param actualDurationMinutes 实际时长（分钟）
   * @param durationMinutes 计划时长（分钟）
   * @param completedSteps 已完成步骤跟踪
   */
  private async processContractOperations(
    sessionId: string,
    studentId: string,
    serviceTypeCode: string,
    sessionTypeCode: string,
    actualDurationMinutes: number,
    durationMinutes: number,
    completedSteps: SessionEndSteps,
  ): Promise<void> {
    // 幂等性检查：检查是否已记录消耗 (Idempotency check: Check if consumption already recorded)
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
        `[SessionEndSaga] Consumption already recorded for session ${sessionId}, skipping contract operations`,
      );
      completedSteps.consumptionRecorded = true;
      return;
    }

    // 查询活跃预占 (Query active holds)
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
        `[SessionEndSaga] No active hold found for session ${sessionId}, continuing with consumption recording`,
      );
    } else if (activeHolds.length > 1) {
      this.logger.warn(
        `[SessionEndSaga] Multiple active holds (${activeHolds.length}) found for session ${sessionId}`,
      );
    }

    // 在事务中释放预占并记录消耗 (Release hold and record consumption in transaction)
    await this.withTransaction(async (tx) => {
      // 释放预占 (Release hold if exists)
      if (activeHolds.length > 0) {
        const hold = activeHolds[0];
        await this.serviceHoldService.releaseHold(hold.id, "completed", tx);
        this.logger.log(`[SessionEndSaga] Released hold ${hold.id} for session ${sessionId}`);
        completedSteps.holdReleased = true;
      }

      // 记录消耗 (Record consumption)
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
          bookingSource: sessionTypeCode,
          createdBy: studentId,
        },
        tx,
      );

      this.logger.log(
        `[SessionEndSaga] Recorded consumption of ${consumptionQuantity} units for session ${sessionId}`,
      );
      completedSteps.consumptionRecorded = true;
    });
  }

  /**
   * 处理Financial领域操作 (Process financial domain operations)
   *
   * @param payload 事件payload
   * @param mentorId 导师ID
   * @param referenceId 引用ID
   * @param sessionTypeCode 会话类型代码
   * @param completedSteps 已完成步骤跟踪
   */
  private async processFinancialOperations(
    payload: any,
    mentorId: string,
    referenceId: string | null,
    sessionTypeCode: string,
    completedSteps: SessionEndSteps,
  ): Promise<void> {
    // 幂等性检查 (Idempotency check)
    if (referenceId && await this.mentorPayableService.isDuplicate(referenceId)) {
      this.logger.warn(
        `[SessionEndSaga] Billing already exists for referenceId ${referenceId}, skipping`,
      );
      completedSteps.billingCreated = true;
      return;
    }

    // 获取导师定价 (Get mentor pricing)
    const mentorPrice = await this.mentorPayableService.getMentorPrice(
      mentorId,
      sessionTypeCode,
    );

    if (!mentorPrice) {
      throw new BadRequestException(
        `No active price found for mentor: ${mentorId} and session type: ${sessionTypeCode}`,
      );
    }

    this.logger.log(
      `[SessionEndSaga] Found mentor price: ${mentorPrice.price} ${mentorPrice.currency}`,
    );

    // 创建按次计费记录 (Create per-session billing)
    await this.mentorPayableService.createPerSessionBilling(payload);
    completedSteps.billingCreated = true;

    this.logger.log(
      `[SessionEndSaga] Successfully created billing for session ${payload.sessionId}`,
    );
  }

  /**
   * 补偿会话结束流程失败 (Compensate session end failure)
   *
   * @param sessionId 会话ID
   * @param studentId 学生ID
   * @param serviceTypeCode 服务类型代码
   * @param completedSteps 已完成的步骤
   * @returns 补偿结果
   */
  private async compensateSessionEnd(
    sessionId: string,
    studentId: string,
    serviceTypeCode: string,
    completedSteps: SessionEndSteps,
  ): Promise<CompensationResult> {
    const errors: string[] = [];

    this.logger.warn(
      `[SessionEndSaga] Starting compensation for session ${sessionId}. Completed steps: ${JSON.stringify(completedSteps)}`,
    );

    // 注意：日历槽位更新和hold释放通常不需要回滚
    // 因为它们代表了实际发生的事情（会议确实结束了）
    // Note: Calendar slot updates and hold releases typically don't need rollback
    // because they represent things that actually happened (meeting did end)

    // 如果消耗记录成功但计费失败，我们不回滚消耗
    // 因为服务确实被消耗了，只是计费失败需要重试
    // If consumption recorded but billing failed, we don't rollback consumption
    // because service was indeed consumed, only billing needs retry

    // 补偿主要用于记录失败详情和触发告警
    // Compensation is mainly for logging failure details and triggering alerts
    if (completedSteps.consumptionRecorded && !completedSteps.billingCreated) {
      errors.push(
        `Consumption recorded but billing failed for session ${sessionId}. Manual billing may be required.`,
      );
    }

    if (completedSteps.holdReleased && !completedSteps.consumptionRecorded) {
      errors.push(
        `Hold released but consumption not recorded for session ${sessionId}. Data inconsistency detected.`,
      );
    }

    return {
      requireManualIntervention: errors.length > 0,
      compensationErrors: errors,
    };
  }

  /**
   * 辅助方法：将错误转换为字符串 (Helper: Convert error to string)
   */
  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
