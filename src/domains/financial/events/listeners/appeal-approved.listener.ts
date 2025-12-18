import { Injectable, Logger, Inject, BadRequestException } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { MentorPayableService } from "@domains/financial/services/mentor-payable.service";
import { MENTOR_APPEAL_APPROVED_EVENT } from "@shared/events/event-constants";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import * as schema from "@infrastructure/database/schema";
import { eq, and } from "drizzle-orm";

/**
 * Appeal Approved Listener (申诉批准事件监听器)[Appeal Approved Event Listener]
 *
 * Automatically creates adjustment records when a mentor appeal is approved
 * to ensure mentors receive proper compensation.
 * (当导师申诉被批准时自动创建调整记录，确保导师获得适当补偿)
 *
 * Problem: Previously, when an appeal was approved, only the appeal status was updated,
 * but no automatic adjustment was made to the mentor's payable ledger.
 * This resulted in mentors not receiving the adjusted compensation.
 * (问题：之前申诉被批准后只更新了申诉状态，但没有自动调整导师的应付账款，导致导师无法获得调整后的报酬)
 *
 * Solution: This listener automatically creates adjustment entries in the payable ledger
 * when an appeal is approved, ensuring compensation accuracy.
 * (解决方案：此监听器在申诉被批准时自动在应付账款中创建调整记录，确保报酬准确性)
 */
@Injectable()
export class AppealApprovedListener {
  private readonly logger = new Logger(AppealApprovedListener.name);

  constructor(
    private readonly mentorPayableService: MentorPayableService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Handle mentor appeal approved event
   * (处理导师申诉批准事件)
   *
   * @param event - The appeal approved event payload
   * Automatically creates adjustment record for the approved appeal amount
   */
  @OnEvent(MENTOR_APPEAL_APPROVED_EVENT)
  async handleAppealApproved(event: {
    appealId: string;
    mentorId: string;
    counselorId: string;
    appealAmount: string;
    approvedBy: string;
    approvedAt: Date;
    currency: string;
  }): Promise<void> {
    this.logger.log(`Processing approved appeal: ${event.appealId}`);

    try {
      // 1. Query appeal details to get mentorPayableId
      const appeal = await this.db.query.mentorAppeals.findFirst({
        where: eq(schema.mentorAppeals.id, event.appealId),
      });

      if (!appeal) {
        this.logger.error(`Appeal not found: ${event.appealId}`);
        throw new BadRequestException(`Appeal not found: ${event.appealId}`);
      }

      // Check if mentorPayableId exists
      if (!appeal.mentorPayableId) {
        this.logger.warn(
          `No mentorPayableId for appeal ${event.appealId}. Skipping auto-adjustment.`,
        );
        return;
      }

      // [修复] Idempotency check - ensure the same appeal doesn't create multiple adjustments (幂等性检查 - 确保同一申诉不会创建多个调整)
      const existingAdjustment = await this.db.query.mentorPayableLedgers.findFirst({
        where: and(
          eq(schema.mentorPayableLedgers.originalId, appeal.mentorPayableId),
          eq(schema.mentorPayableLedgers.adjustmentReason, `Appeal approved: ${event.appealId}`)
        )
      });

      if (existingAdjustment) {
        this.logger.warn(
          `Adjustment already exists for appeal ${event.appealId}. Skipping duplicate adjustment creation.`
        );
        return;
      }

      // 2. Create adjustment record
      const adjustmentAmount = Number(event.appealAmount);

      if (isNaN(adjustmentAmount) || adjustmentAmount === 0) {
        this.logger.warn(
          `Invalid appeal amount for appeal ${event.appealId}: ${event.appealAmount}`,
        );
        return;
      }

      await this.mentorPayableService.adjustPayableLedger({
        originalLedgerId: appeal.mentorPayableId,
        adjustmentAmount: adjustmentAmount,
        reason: `Appeal approved: ${event.appealId}`,
        createdBy: event.approvedBy,
      });

      this.logger.log(
        `Successfully created adjustment for appeal ${event.appealId}, amount: ${adjustmentAmount}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process approved appeal ${event.appealId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Re-throw to retry if needed
      throw error;
    }
  }
}
