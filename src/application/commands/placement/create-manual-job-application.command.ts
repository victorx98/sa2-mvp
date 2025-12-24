import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { jobApplications, applicationHistory } from "@infrastructure/database/schema";
import { eq, and } from "drizzle-orm";
import { ApplicationType, ApplicationStatus } from "@domains/placement/types";
import { IntegrationEventPublisher, JobApplicationStatusChangedEvent } from "@application/events";

/**
 * Interface for creating manual job application [手工创建内推的接口]
 */
interface ICreateManualJobApplicationDto {
  studentId: string;
  mentorId: string;
  jobId?: string;
  jobLink?: string;
  jobTitle?: string;
  companyName?: string;
  location?: string;
  jobType?: string[];
  jobCategories?: string[];
  normalJobTitle?: string[];
  level?: string;
  resumeSubmittedDate?: Date;
  createdBy?: string;
}

// Type for database insertion [数据库插入类型]
type InsertJobApplicationValues = {
  studentId: string;
  jobId: string;
  applicationType: ApplicationType;
  status: "mentor_assigned";
  assignedMentorId: string;
  recommendedBy?: string;
  recommendedAt?: Date;
  submittedAt?: Date;
  updatedAt: Date;
  jobType?: string;
  jobTitle?: string;
  jobLink?: string;
  companyName?: string;
  location?: string;
  jobCategories?: string[];
  normalJobTitle?: string;
  level?: string;
};


/**
 * Create Manual Job Application Command [手工创建内推命令]
 * - Handles manual job application creation with mentor assigned status [处理手工创建内推投递记录，状态默认设置为mentor_assigned]
 * - All-or-nothing transaction semantics [全成功事务语义]
 * - Implements business logic directly without service dependency [不依赖服务直接实现业务逻辑]
 */
@Injectable()
export class CreateManualJobApplicationCommand extends CommandBase {

  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly eventPublisher: IntegrationEventPublisher,
  ) {
    super(db);
  }

  /**
   * Execute command [执行命令]
   * - Creates manual job application with validation and duplicate checking [创建手工投递申请，包含验证和重复检查]
   * - Publishes domain events after successful transaction [事务成功后发布领域事件]
   */
  async execute(input: { dto: ICreateManualJobApplicationDto }) {
    const dto = input.dto;

    this.logger.log(
      `Creating manual job application: student=${dto.studentId}, mentor=${dto.mentorId}, jobTitle=${dto.jobTitle}`,
    );

    // Check for duplicate application using studentId and jobId/jobLink [检查学生ID和岗位ID/职位链接的重复申请]
    // Strategy: Always prefer jobLink for duplicate checking when available [策略：当jobLink可用时，始终优先使用jobLink进行重复检查]
    // This avoids UUID type errors when jobId is a non-UUID external ID [这避免了当jobId是非UUID外部ID时的类型错误]
    if (!dto.jobId && !dto.jobLink) {
      throw new BadRequestException(
        "Either jobId or jobLink is required for duplicate checking",
      );
    }

    // Use jobLink as the primary identifier for duplicate checking if available [如果jobLink可用，则将其用作重复检查的主要标识符]
    const identifierForCheck = dto.jobLink || dto.jobId!;
    await this.checkDuplicateApplication(
      dto.studentId,
      identifierForCheck,
      dto.jobLink,
    );

    // Create application in transaction [在事务中创建申请]
    const application = await this.db.transaction(async (tx) => {
      // Create application record [创建申请记录]
      // Convert arrays to strings for database compatibility [将数组转换为字符串以兼容数据库]
      const insertValues: InsertJobApplicationValues = {
        studentId: dto.studentId,
        jobId: dto.jobId,
        applicationType: ApplicationType.REFERRAL,
        status: "mentor_assigned" as const,
        assignedMentorId: dto.mentorId,
        recommendedBy: dto.createdBy,
        recommendedAt: new Date(),
        submittedAt: dto.resumeSubmittedDate,
        updatedAt: new Date(),
        // Manual creation fields [手工创建字段]
        jobType: dto.jobType && dto.jobType.length > 0 ? dto.jobType[0] : undefined, // Take first element or undefined [取第一个元素或undefined]
        jobTitle: dto.jobTitle,
        jobLink: dto.jobLink,
        companyName: dto.companyName,
        location: dto.location,
        jobCategories: dto.jobCategories,
        normalJobTitle: dto.normalJobTitle && dto.normalJobTitle.length > 0 ? dto.normalJobTitle[0] : undefined, // Take first element or undefined [取第一个元素或undefined]
        level: dto.level,
      };

      const [newApplication] = await tx
        .insert(jobApplications)
        .values(insertValues)
        .returning();

      this.logger.log(`Manual job application created: ${newApplication.id}`);

      // Record status change history [记录状态变更历史]
      await tx.insert(applicationHistory).values({
        applicationId: newApplication.id,
        previousStatus: null,
        newStatus: newApplication.status as ApplicationStatus,
        changedBy: dto.createdBy,
        changeReason: "Manual creation by counselor",
      });

      return newApplication;
    });

    // Publish application status changed event AFTER transaction (在事务后发布投递状态变更事件) [在事务成功后发布事件]
    // Event is published after transaction commits to ensure data consistency [事件在事务提交后发布以确保数据一致性]
    const eventPayload = {
      applicationId: application.id,
      previousStatus: null,
      newStatus: application.status,
      changedBy: dto.createdBy,
      changedAt: application.submittedAt.toISOString(),
      assignedMentorId: application.assignedMentorId,
    };
    await this.eventPublisher.publish(
      new JobApplicationStatusChangedEvent(eventPayload),
      CreateManualJobApplicationCommand.name,
    );

    return {
      data: application,
      event: {
        type: JobApplicationStatusChangedEvent.eventType,
        payload: eventPayload,
      },
    };
  }

  /**
   * Check for duplicate application [检查重复申请]
   * - Uses jobLink for duplicate checking when available [当jobLink可用时使用jobLink进行重复检查]
   * - Falls back to jobId for UUID format IDs [对于UUID格式ID回退到jobId]
   * - Skip check for non-UUID jobId without jobLink [对于非UUID jobId且无jobLink跳过检查]
   */
  private async checkDuplicateApplication(
    studentId: string,
    jobId: string,
    jobLink: string | undefined = undefined,
  ) {
    this.logger.debug(
      `checkDuplicateApplication called: studentId=${studentId}, jobId=${jobId}, jobLink=${jobLink}`,
    );

    // Check if jobId is a valid UUID before querying [查询前检查jobId是否为有效UUID]
    const isUuidFormat =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        jobId,
      );

    this.logger.debug(`isUuidFormat: ${isUuidFormat}`);

    // For UUID jobId: check duplicate using studentId + jobId [对于UUID格式的jobId：使用studentId + jobId检查重复]
    if (isUuidFormat) {
      const [existingApplication] = await this.db
        .select()
        .from(jobApplications)
        .where(
          and(
            eq(jobApplications.studentId, studentId),
            eq(jobApplications.jobId, jobId),
          ),
        );

      if (existingApplication) {
        throw new BadRequestException(
          `Student ${studentId} has already applied for job ${jobId}`,
        );
      }
    }
    // For non-UUID jobId (external job IDs): check duplicate using studentId + job_link [对于非UUID格式的jobId（外部职位ID）：使用studentId + job_link检查重复]
    else if (jobLink) {
      const [existingApplication] = await this.db
        .select()
        .from(jobApplications)
        .where(
          and(
            eq(jobApplications.studentId, studentId),
            eq(jobApplications.jobLink, jobLink),
          ),
        );

      if (existingApplication) {
        throw new BadRequestException(
          `Student ${studentId} has already applied for job using the same link: ${jobLink}`,
        );
      }
    }
    // For non-UUID jobId without jobLink: skip duplicate check [对于非UUID格式且没有jobLink的jobId：跳过重复检查]
    else {
      this.logger.warn(
        `Skipping duplicate check for non-UUID jobId without jobLink: ${jobId}`,
      );
    }
  }
}
