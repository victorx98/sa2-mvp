import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import type { IAssignReferralMentorDto } from "@api/dto/request/placement/placement.index";
import { jobApplications, applicationHistory, recommendedJobs } from "@infrastructure/database/schema";
import { eq, and } from "drizzle-orm";
import { ApplicationStatus, ApplicationType, ALLOWED_APPLICATION_STATUS_TRANSITIONS } from "@domains/placement/types";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JOB_APPLICATION_STATUS_CHANGED_EVENT, PLACEMENT_APPLICATION_SUBMITTED_EVENT } from "@shared/events/event-constants";
// Removed - module not found: @shared/events/placement-application-submitted.event

/**
 * Assign Referral Mentor Command [内推指定导师命令]
 * - Separated command for counselor-facing API [为顾问侧API拆分的独立命令]
 * - Updates application status to mentor_assigned with validation [更新申请状态为mentor_assigned并进行验证]
 * - Publishes domain events after successful transaction [事务成功后发布领域事件]
 */
@Injectable()
export class AssignReferralMentorCommand extends CommandBase {

  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(db);
  }

  /**
   * Execute command [执行命令]
   * - Assigns mentor to referral application with status update [为内推申请分配导师并更新状态]
   * - Validates application type and status transitions [验证申请类型和状态转换]
   * - Records history and publishes events [记录历史并发布事件]
   */
  async execute(
    dto: IAssignReferralMentorDto,
    changedBy: string,
  ) {

    this.logger.log(
      `Assigning mentor to application: ${dto.applicationId} -> mentor_assigned`,
    );

    // Get current application (获取当前申请)
    const [application] = await this.db
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.id, dto.applicationId));

    if (!application) {
      throw new NotFoundException(
        `Application not found: ${dto.applicationId}`,
      );
    }

    const previousStatus = application.status as ApplicationStatus;

    // Validate mentor assignment is only for referral applications (验证仅内推申请允许分配导师)
    if (application.applicationType !== ApplicationType.REFERRAL) {
      throw new BadRequestException(
        "mentor assignment is only allowed for referral applications",
      );
    }

    // Validate status transition (验证状态转换)
    const targetStatus: ApplicationStatus = "mentor_assigned";
    const allowedTransitions = ALLOWED_APPLICATION_STATUS_TRANSITIONS[previousStatus];
    if (!allowedTransitions || !allowedTransitions.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${previousStatus} -> ${targetStatus}`,
      );
    }

    // Update application status in transaction (在事务中更新申请状态)
    const updatedApplication = await this.db.transaction(async (tx) => {
      // Update application with mentor assignment (更新申请并分配导师)
      const [app] = await tx
        .update(jobApplications)
        .set({
          status: targetStatus,
          assignedMentorId: dto.mentorId,
          updatedAt: new Date(),
        })
        .where(eq(jobApplications.id, dto.applicationId))
        .returning();

      // Record status change history (记录状态变更历史)
      await tx.insert(applicationHistory).values({
        applicationId: dto.applicationId,
        previousStatus,
        newStatus: targetStatus,
        changedBy: changedBy,
        changeReason: "Mentor assigned",
        changeMetadata: null,
      });

      return app;
    });

    this.logger.log(`Application status updated: ${dto.applicationId}`);

    // Publish status changed event AFTER transaction (在事务后发布状态变更事件)
    const eventPayload = {
      applicationId: updatedApplication.id,
      previousStatus: previousStatus,
      newStatus: "mentor_assigned" as ApplicationStatus,
      changedBy: changedBy,
      changedAt: new Date().toISOString(),
      // Include mentor assignment (包含导师分配)
      assignedMentorId: dto.mentorId,
    };
    this.eventEmitter.emit(JOB_APPLICATION_STATUS_CHANGED_EVENT, eventPayload);

    return {
      data: updatedApplication,
      event: {
        type: JOB_APPLICATION_STATUS_CHANGED_EVENT,
        payload: eventPayload,
      },
    };
  }
}


