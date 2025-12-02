import { Injectable, Logger, Inject } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  IJobApplicationStatusChangedEvent,
} from "@shared/events/placement-application.events";
import { JOB_APPLICATION_STATUS_CHANGED_EVENT } from "@shared/events/event-constants";
import { MentorPayableService } from "@domains/financial/services/mentor-payable.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import * as schema from "@infrastructure/database/schema";
import { eq } from "drizzle-orm";

/**
 * Placement Application Status Changed Event Listener (安置申请状态变更事件监听器)
 *
 * Responsible for listening to placement application status changed events
 * and performing corresponding financial processing logic
 * (负责监听安置申请状态变更事件，并执行相应的财务处理逻辑)
 *
 * Flow:
 * 1. Check for duplicate events (idempotency)
 * 2. Validate event payload
 * 3. Get job application details to retrieve mentorId and studentId
 * 4. Determine billing eligibility based on status change
 * 5. Get mentor price for the specific placement stage
 * 6. Create placement billing record
 */
@Injectable()
export class PlacementApplicationStatusChangedListener {
  private readonly logger = new Logger(PlacementApplicationStatusChangedListener.name);

  constructor(
    @Inject("IMentorPayableService")
    private readonly mentorPayableService: MentorPayableService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Handle placement application status changed event
   * (处理安置申请状态变更事件)
   *
   * @param event - The placement application status changed event data
   */
  @OnEvent(JOB_APPLICATION_STATUS_CHANGED_EVENT)
  async handlePlacementApplicationStatusChangedEvent(
    event: IJobApplicationStatusChangedEvent,
  ): Promise<void> {
    try {
      this.logger.log(
        `Received placement application status changed event: ${event.id}`,
      );

      const payload = event.payload;

      // Extract required fields from payload
      const {
        applicationId,
        previousStatus,
        newStatus,
        changedAt,
      } = payload || {};

      // Validate payload
      if (!applicationId || !newStatus) {
        this.logger.error(
          `Missing required fields in event payload: applicationId=${applicationId}, newStatus=${newStatus}`,
        );
        return;
      }

      this.logger.log(
        `Processing application: ${applicationId}, status changed from ${previousStatus} to ${newStatus}`,
      );

      // 1. Get job application details to retrieve mentorId and studentId
      const jobApplication = await this.db.query.jobApplications.findFirst({
        where: eq(schema.jobApplications.id, applicationId),
      });

      if (!jobApplication) {
        this.logger.error(
          `Job application not found: ${applicationId}`,
        );
        return;
      }

      const { studentId, jobId } = jobApplication;

      // 2. Determine billing eligibility based on status change
      // Only bill for specific status changes (e.g., recommended, interviewed, hired)
      const billableStatusChanges = [
        "recommended",
        "interviewed",
        "hired",
      ];

      if (!billableStatusChanges.includes(newStatus)) {
        this.logger.log(
          `Status change to ${newStatus} is not billable, skipping billing`,
        );
        return;
      }

      // 3. Get mentorId from job application
      // Note: This assumes the job application has a mentorId field
      // If not, we need to get it from another table (e.g., student_mentor)
      // For now, we'll get it from the student_mentor table
      const studentMentor = await this.db.query.studentMentorTable.findFirst({
        where: eq(schema.studentMentorTable.studentId, studentId),
      });

      if (!studentMentor) {
        this.logger.error(
          `No mentor assigned to student: ${studentId}`,
        );
        return;
      }

      const { mentorId } = studentMentor;

      // 4. Check for duplicate billing (idempotency)
      // Use applicationId as referenceId for idempotency check
      if (await this.mentorPayableService.isDuplicate(applicationId)) {
        this.logger.warn(
          `Duplicate billing detected for application: ${applicationId}, skipping`,
        );
        return;
      }

      // 5. Get mentor price for the specific placement stage
      // Use newStatus as sessionTypeCode to get the corresponding price
      const mentorPrice = await this.mentorPayableService.getMentorPrice(
        mentorId,
        newStatus,
      );

      if (!mentorPrice) {
        this.logger.error(
          `No active price found for mentor: ${mentorId} and placement stage: ${newStatus}`,
        );
        return;
      }

      this.logger.log(
        `Found mentor price: ${mentorPrice.price} ${mentorPrice.currency} for placement stage: ${newStatus}`,
      );

      // 6. Create placement billing record
      await this.mentorPayableService.createPlacementBilling({
        applicationId,
        studentId,
        mentorId,
        sessionTypeCode: newStatus,
        allowBilling: true,
      });

      this.logger.log(
        `Successfully created placement billing for application: ${applicationId}, amount: ${mentorPrice.price} ${mentorPrice.currency}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process placement application status changed event: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Throw error to ensure event is retried if needed
      throw error;
    }
  }
}