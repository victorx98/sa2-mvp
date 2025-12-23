import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { IUpdateApplicationStatusDto } from "@api/dto/request/placement/placement.index";
import { jobApplications, applicationHistory, recommendedJobs } from "@infrastructure/database/schema";
import { eq } from "drizzle-orm";
import { ApplicationStatus, ALLOWED_APPLICATION_STATUS_TRANSITIONS } from "@domains/placement/types";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JOB_APPLICATION_STATUS_CHANGED_EVENT, PLACEMENT_APPLICATION_SUBMITTED_EVENT } from "@shared/events/event-constants";
// Removed - module not found: @shared/events/placement-application-submitted.event

/**
 * Update Job Application Status Command
 * [更新职位申请状态命令]
 *
 * 用于更新职位申请的状态
 * Handles application status updates with validation and event publishing [处理申请状态更新，包含验证和事件发布]
 */
@Injectable()
export class UpdateJobApplicationStatusCommand extends CommandBase {

  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(db);
  }

  /**
   * 执行命令
   * [Execute command]
   *
   * @param dto 更新状态DTO [Status update DTO]
   * @param changedBy 执行变更的用户ID [User ID who performed the change]
   * @returns 执行结果
   */
  async execute(
    dto: IUpdateApplicationStatusDto,
    changedBy: string,
  ) {
    this.logger.log(
      `Updating application status: ${dto.applicationId} -> ${dto.status}`,
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

    // Validate status transition (验证状态转换)
    const targetStatus = dto.status as ApplicationStatus;
    const allowedTransitions = ALLOWED_APPLICATION_STATUS_TRANSITIONS[previousStatus];
    if (!allowedTransitions || !allowedTransitions.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${previousStatus} -> ${targetStatus}`,
      );
    }

    // Update application status in transaction (在事务中更新申请状态)
    const updatedApplication = await this.db.transaction(async (tx) => {
      // Update application status (更新申请状态)
      const [app] = await tx
        .update(jobApplications)
        .set({
          status: targetStatus,
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
        changeReason: null,
        changeMetadata: null,
      });

      return app;
    });

    this.logger.log(`Application status updated: ${dto.applicationId}`);

    // Publish status changed event AFTER transaction (在事务后发布状态变更事件)
    // Event is published after transaction commits to ensure data consistency (事件在事务提交后发布以确保数据一致性)
    const eventPayload = {
      applicationId: updatedApplication.id,
      previousStatus: previousStatus,
      newStatus: targetStatus,
      changedBy: changedBy,
      changedAt: new Date().toISOString(),
      // Include mentor assignment if exists (如果存在导师分配则包含)
      ...(updatedApplication.assignedMentorId && {
        assignedMentorId: updatedApplication.assignedMentorId,
      }),
    };
    this.eventEmitter.emit(JOB_APPLICATION_STATUS_CHANGED_EVENT, eventPayload);

    if (targetStatus === "submitted") {
      const [job] = await this.db
        .select({ title: recommendedJobs.title })
        .from(recommendedJobs)
        .where(eq(recommendedJobs.id, application.jobId));

      // Determine provider: use assigned mentor, recommended by, or changed by (确定服务提供者：使用已分配导师、推荐人或操作人)
      const providerCandidate =
        updatedApplication.assignedMentorId ??
        application.recommendedBy ??
        changedBy ??
        updatedApplication.studentId;

      const submittedPayload: any = {
        id: updatedApplication.id,
        service_type: "job_application",
        student_user_id: updatedApplication.studentId,
        provider_user_id: this.isUuid(providerCandidate)
          ? providerCandidate
          : updatedApplication.studentId,
        consumed_units: 1,
        unit_type: "count",
        completed_time: updatedApplication.updatedAt,
        title: job?.title ?? undefined,
      };
      this.eventEmitter.emit(
        PLACEMENT_APPLICATION_SUBMITTED_EVENT,
        submittedPayload,
      );
    }

    return {
      data: updatedApplication,
      event: {
        type: JOB_APPLICATION_STATUS_CHANGED_EVENT,
        payload: eventPayload,
      },
    };
  }

  /**
   * Simple UUID v4-ish validation to protect Service Registry FK constraints (English only) [简单 UUID 校验以保护 Service Registry 外键约束]
   */
  private isUuid(value: string | undefined): value is string {
    return (
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    );
  }
}
