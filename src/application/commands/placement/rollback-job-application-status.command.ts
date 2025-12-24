import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { IRollbackApplicationStatusDto } from "@api/dto/request/placement/placement.index";
import { jobApplications, applicationHistory } from "@infrastructure/database/schema";
import { eq, desc } from "drizzle-orm";
import { ApplicationStatus, ALLOWED_APPLICATION_STATUS_TRANSITIONS } from "@domains/placement/types";
import { IntegrationEventPublisher, JobApplicationStatusRolledBackEvent } from "@application/events";

/**
 * Rollback Job Application Status Command
 * [回滚职位申请状态命令]
 *
 * 用于回滚职位申请的状态到上一个状态
 * Handles application status rollback with validation and history tracking [处理申请状态回滚，包含验证和历史记录]
 */
@Injectable()
export class RollbackJobApplicationStatusCommand extends CommandBase {

  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly eventPublisher: IntegrationEventPublisher,
  ) {
    super(db);
  }

  /**
   * 执行命令
   * [Execute command]
   *
   * @param input 命令输入
   * @returns 执行结果
   */
  async execute(
    dto: IRollbackApplicationStatusDto,
    changedBy: string,
  ) {
    this.logger.log(
      `Rolling back status for application: ${dto.applicationId}`,
    );

    // Get current application [获取当前申请]
    const [application] = await this.db
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.id, dto.applicationId));

    if (!application) {
      throw new NotFoundException(
        `Application not found: ${dto.applicationId}`,
      );
    }

    // Get recent status history (last 2 records) [获取最近的状态历史（最后2条记录）]
    const statusHistory = await this.db
      .select()
      .from(applicationHistory)
      .where(eq(applicationHistory.applicationId, dto.applicationId))
      .orderBy(desc(applicationHistory.changedAt))
      .limit(2);

    if (statusHistory.length < 2) {
      throw new BadRequestException(
        `Cannot rollback: Application has insufficient status history`,
      );
    }

    // Validate consistency: latest history record must match current status [验证一致性：最新历史记录必须匹配当前状态]
    const currentStatus = application.status as ApplicationStatus;
    const latestHistoryRecord = statusHistory[0];
    if (latestHistoryRecord.newStatus !== currentStatus) {
      throw new BadRequestException(
        `Status inconsistency: current status is ${currentStatus}, but latest history shows ${latestHistoryRecord.newStatus}`,
      );
    }

    // Get previous status from second-to-last record [从倒数第二条记录获取上一个状态]
    const previousStatusRecord = statusHistory[1];
    const previousStatus = previousStatusRecord.newStatus as ApplicationStatus;

    // Validate status transition [验证状态转换]
    const allowedTransitions =
      ALLOWED_APPLICATION_STATUS_TRANSITIONS[previousStatus];
    if (!allowedTransitions || !allowedTransitions.includes(currentStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${previousStatus} -> ${currentStatus}`,
      );
    }

    // Rollback status in transaction [在事务中回滚状态]
    const updatedApplication = await this.db.transaction(async (tx) => {
      // Build update data [构建更新数据]
      const updateData: {
        status: ApplicationStatus;
        assignedMentorId?: string | null;
        updatedAt: Date;
      } = {
        status: previousStatus,
        updatedAt: new Date(),
      };

      // Only update assignedMentorId if explicitly provided [仅在显式提供时更新assignedMentorId]
      if (dto.mentorId !== undefined) {
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
        previousStatus: currentStatus,
        newStatus: previousStatus,
        changedBy: changedBy,
        changeReason: "Status rolled back",
      } as typeof applicationHistory.$inferInsert);

      return app;
    });

    this.logger.log(
      `Application status rolled back: ${dto.applicationId} from ${currentStatus} to ${previousStatus}`,
    );

    // Publish status rolled back event AFTER transaction (在事务后发布状态回撤事件) [在事务成功后发布事件]
    // Event is published after transaction commits to ensure data consistency [事件在事务提交后发布以确保数据一致性]
    const eventPayload = {
      applicationId: updatedApplication.id,
      previousStatus: currentStatus,
      newStatus: previousStatus,
      changedBy: changedBy,
      changedAt: new Date().toISOString(),
      rollbackReason: "Status rolled back",
      // [新增] Include mentor assignment in event payload [在事件payload中包含导师分配]
      ...(dto.mentorId && { assignedMentorId: dto.mentorId }),
    };
    await this.eventPublisher.publish(
      new JobApplicationStatusRolledBackEvent(eventPayload),
      RollbackJobApplicationStatusCommand.name,
    );

    return {
      data: updatedApplication,
      event: {
        type: JobApplicationStatusRolledBackEvent.eventType,
        payload: eventPayload,
      },
    };
  }
}
