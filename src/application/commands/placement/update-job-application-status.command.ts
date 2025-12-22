import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { IUpdateApplicationStatusDto } from "@api/dto/request/placement/placement.index";
import { jobApplications, applicationHistory, recommendedJobs } from "@infrastructure/database/schema";
import { eq } from "drizzle-orm";
import { ApplicationStatus, ApplicationType, ALLOWED_APPLICATION_STATUS_TRANSITIONS } from "@domains/placement/types";
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

    // ✅ Validate mentor assignment scenario [新增：分配导师场景验证]
    if (dto.status === 'mentor_assigned') {
      const mentorId = dto.mentorId as string | undefined;
      if (!mentorId) {
        throw new BadRequestException(
          'mentorId is required when assigning mentor',
        );
      }

      // Business rule: mentor assignment is only valid for referral applications [业务规则：仅内推申请允许分配导师]
      if (application.applicationType !== "referral") {
        throw new BadRequestException(
          "mentor_assigned is only allowed for referral applications",
        );
      }
    }

    // Mentor handoff -> submission validation [导师交接 -> 已提交校验]
    // - The API may choose not to send mentorId/screeningResult for status-only updates [API 可能仅做状态更新，不传 mentorId/评估结果]
    // - When mentorId is omitted, we infer it from assignedMentorId [未传 mentorId 时从 assignedMentorId 推导]
    if (previousStatus === "mentor_assigned" && dto.status === "submitted") {
      const effectiveMentorId =
        (dto.mentorId as string | undefined) ?? application.assignedMentorId;

      if (!effectiveMentorId) {
        throw new BadRequestException(
          "assignedMentorId is required when submitting after mentor assignment",
        );
      }

      // Security check: verify mentor is assigned when mentorId is explicitly provided [当显式传 mentorId 时校验其必须为已分配导师]
      if (dto.mentorId && application.assignedMentorId !== dto.mentorId) {
        throw new BadRequestException(
          `Only the assigned mentor (${application.assignedMentorId}) can submit screening results. Provided: ${dto.mentorId}`,
        );
      }
    }

    // Validate status transition [验证状态转换]
    const allowedTransitions =
      ALLOWED_APPLICATION_STATUS_TRANSITIONS[previousStatus];
    if (!allowedTransitions || !allowedTransitions.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition: ${previousStatus} -> ${dto.status}`,
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

      // Only update assignedMentorId when explicitly provided [仅在显式提供时更新assignedMentorId]
      if (dto.status === "mentor_assigned") {
        // mentor_assigned status requires mentorId [mentor_assigned状态需要mentorId]
        updateData.assignedMentorId = dto.mentorId as string;
      } else if (dto.mentorId !== undefined) {
        // Other statuses: only update if mentorId is explicitly provided [其他状态：仅在显式提供mentorId时更新]
        updateData.assignedMentorId = dto.mentorId || null;
      }
      // If mentorId is undefined, keep the existing value [如果mentorId未定义，保持原值]

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
        changeReason: dto.changeReason,
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
      // [新增] Include mentor assignment in event payload [在事件payload中包含导师分配]
      ...(updatedApplication.assignedMentorId && {
        assignedMentorId: updatedApplication.assignedMentorId,
      }),
    };
    this.eventEmitter.emit(JOB_APPLICATION_STATUS_CHANGED_EVENT, eventPayload);

    if (dto.status === "submitted") {
      const [job] = await this.db
        .select({ title: recommendedJobs.title })
        .from(recommendedJobs)
        .where(eq(recommendedJobs.id, application.jobId));

      const providerCandidate =
        dto.mentorId ??
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
