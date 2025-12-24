import { Injectable, Logger, Inject } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { HandlesEvent, JobApplicationStatusRolledBackEvent } from "@application/events";
import { MentorPayableService } from "@domains/financial/services/mentor-payable.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import * as schema from "@infrastructure/database/schema";
import { eq, and } from "drizzle-orm";

/**
 * Placement Application Status Rolled Back Event Listener (安置申请状态回撤事件监听器)
 *
 * Responsible for listening to placement application status rolled back events
 * and performing corresponding financial adjustment logic
 * (负责监听安置申请状态回撤事件，并执行相应的财务调整逻辑)
 *
 * Flow:
 * 1. Check for duplicate events (idempotency)
 * 2. Validate event payload
 * 3. Get job application details
 * 4. Retrieve previously created billing records
 * 5. Adjust or reverse billing records
 * 6. Create adjustment record in mentor_payable_ledgers
 */
@Injectable()
export class PlacementApplicationStatusRolledBackListener {
  private readonly logger = new Logger(
    PlacementApplicationStatusRolledBackListener.name,
  );

  constructor(
    @Inject("IMentorPayableService")
    private readonly mentorPayableService: MentorPayableService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Handle placement application status rolled back event
   * (处理安置申请状态回撤事件)
   *
   * @param event - The placement application status rolled back event data
   */
  @OnEvent(JobApplicationStatusRolledBackEvent.eventType)
  @HandlesEvent(JobApplicationStatusRolledBackEvent.eventType, PlacementApplicationStatusRolledBackListener.name)
  async handlePlacementApplicationStatusRolledBackEvent(
    event: JobApplicationStatusRolledBackEvent,
  ): Promise<void> {
    try {
      this.logger.log(
        `Received placement application status rolled back event: ${event.id}`,
      );

      const payload = event.payload;

      // Extract required fields from payload
      const {
        applicationId,
        previousStatus,
        newStatus,
        changedBy,
        rollbackReason,
      } = payload || {};

      // Validate payload
      if (!applicationId || !previousStatus || !newStatus) {
        this.logger.error(
          `Missing required fields in event payload: applicationId=${applicationId}, previousStatus=${previousStatus}, newStatus=${newStatus}`,
        );
        return;
      }

      this.logger.log(
        `Processing application: ${applicationId}, status rolled back from ${previousStatus} to ${newStatus}, reason: ${rollbackReason}`,
      );

      // 1. Get job application details
      const jobApplication = await this.db.query.jobApplications.findFirst({
        where: eq(schema.jobApplications.id, applicationId),
      });

      if (!jobApplication) {
        this.logger.error(`Job application not found: ${applicationId}`);
        return;
      }

      // 2. Retrieve previously created billing records for this application and status
      // Find the original billing record that needs to be adjusted
      const originalBillingRecords =
        await this.db.query.mentorPayableLedgers.findMany({
          where: and(
            eq(schema.mentorPayableLedgers.referenceId, applicationId),
            eq(schema.mentorPayableLedgers.sessionTypeCode, previousStatus),
            eq(schema.mentorPayableLedgers.originalId, null), // Only adjust original records, not adjustments
          ),
        });

      if (originalBillingRecords.length === 0) {
        this.logger.warn(
          `No original billing records found for application: ${applicationId}, status: ${previousStatus}`,
        );
        return;
      }

      // 3. Adjust each billing record
      for (const originalRecord of originalBillingRecords) {
        this.logger.log(
          `Adjusting billing record: ${originalRecord.id} for application: ${applicationId}`,
        );

        // Calculate adjustment amount (negative of original amount to reverse it)
        const originalAmount = Number(originalRecord.amount);
        const adjustmentAmount = -originalAmount;

        // Create adjustment record
        await this.mentorPayableService.adjustPayableLedger({
          originalLedgerId: originalRecord.id,
          adjustmentAmount: adjustmentAmount,
          reason: `Placement application status rolled back: ${rollbackReason}`,
          createdBy: changedBy || originalRecord.createdBy,
        });

        this.logger.log(
          `Successfully adjusted billing record: ${originalRecord.id}, adjustment amount: ${adjustmentAmount}`,
        );
      }

      this.logger.log(
        `Successfully processed placement application status rolled back event: ${event.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process placement application status rolled back event: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Throw error to ensure event is retried if needed
      throw error;
    }
  }
}
