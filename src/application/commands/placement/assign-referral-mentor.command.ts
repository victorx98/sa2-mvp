import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import type { IUpdateApplicationStatusDto } from "@api/dto/request/placement/placement.index";
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
    dto: IUpdateApplicationStatusDto,
    changedBy: string,
  ) {

    this.logger.log(
      `Assigning mentor to application: ${dto.applicationId} -> ${dto.status}`,
    );

    // Get current application status [获取当前申请状态]
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

    // Validate mentor assignment is only for referral applications [验证仅内推申请允许分配导师]
    if (application.applicationType !== ApplicationType.REFERRAL) {
      throw new BadRequestException(
        "mentor assignment is only allowed for referral applications",
      );
    }

    // Validate status transition [验证状态转换]
    const allowedTransitions =
      ALLOWED_APPLICATION_STATUS_TRANSITIONS[previousStatus];
    if (!allowedTransitions || !allowedTransitions.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition: ${previousStatus} -> ${dto.status}`,
      );
    }

    // Ensure mentorId is provided for mentor_assigned status [确保mentor_assigned状态提供mentorId]
    if (dto.status === 'mentor_assigned' && !dto.mentorId) {
      throw new BadRequestException(
        'mentorId is required when assigning mentor',
      );
    }

    // Update application status in transaction [在事务中更新申请状态]
    const updatedApplication = await this.db.transaction(async (tx) => {
      // Build update data [构建更新数据]
      const updateData: {
        status: ApplicationStatus;
        assignedMentorId?: string | null;
        updatedAt: Date;
      } = {
        status: dto.status,
        updatedAt: new Date(),
      };

      // Update assigned mentor ID [更新分配的导师ID]
      if (dto.status === "mentor_assigned") {
        updateData.assignedMentorId = dto.mentorId as string;
      } else if (dto.mentorId !== undefined) {
        updateData.assignedMentorId = dto.mentorId || null;
      }

      // Update application status [更新申请状态]
      const [app] = await tx
        .update(jobApplications)
        .set(updateData)
        .where(eq(jobApplications.id, dto.applicationId))
        .returning();

      // Record status change history [记录状态变更历史]
      await tx.insert(applicationHistory).values({
        applicationId: dto.applicationId,
        previousStatus,
        newStatus: dto.status,
        changedBy: changedBy,
        changeReason: dto.changeReason || "Mentor assigned",
        changeMetadata: dto.changeMetadata,
      });

      return app;
    });

    this.logger.log(`Application status updated: ${dto.applicationId}`);

    // Publish status changed event AFTER transaction (在事务后发布状态变更事件) [在事务成功后发布事件]
    // Event is published after transaction commits to ensure data consistency [事件在事务提交后发布以确保数据一致性]
    const eventPayload = {
      applicationId: updatedApplication.id,
      previousStatus: previousStatus,
      newStatus: dto.status as ApplicationStatus,
      changedBy: changedBy,
      changedAt: new Date().toISOString(),
      changeMetadata: dto.changeMetadata,
      ...(updatedApplication.assignedMentorId && {
        assignedMentorId: updatedApplication.assignedMentorId,
      }),
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


