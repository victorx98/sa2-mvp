import { Injectable, Logger, Inject, NotFoundException } from "@nestjs/common";
import { eq, and, sql } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DrizzleDatabase } from "@shared/types/database.types";
import { recommendedJobs, jobApplications, applicationHistory } from "@infrastructure/database/schema";
import {
  JOB_APPLICATION_SUBMITTED_EVENT,
  JOB_APPLICATION_STATUS_CHANGED_EVENT,
  MENTOR_SCREENING_COMPLETED_EVENT,
  JobApplicationSubmittedEvent,
  JobApplicationStatusChangedEvent,
  MentorScreeningCompletedEvent,
} from "../events";
import {
  ISubmitApplicationDto,
  IUpdateApplicationStatusDto,
  IQueryApplicationsDto,
} from "../dto";
import { IJobApplicationService, IServiceResult } from "../interfaces";


/**
 * Job Application Service [投递服务]
 * Handles job application lifecycle management [处理投递申请生命周期管理]
 */
@Injectable()
export class JobApplicationService implements IJobApplicationService {
  private readonly logger = new Logger(JobApplicationService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Submit a job application [提交投递申请]
   *
   * @param dto - Submit application DTO [提交申请DTO]
   * @returns Created application and events [创建的申请和事件]
   */
  async submitApplication(
    dto: ISubmitApplicationDto,
  ): Promise<IServiceResult<Record<string, any>, Record<string, any>>> {
    this.logger.log(`Submitting job application: student=${dto.studentId}, job=${dto.jobId}`);

    // Check for duplicate application [检查重复申请]
    await this.checkDuplicateApplication(dto.studentId, dto.jobId);

    // Verify job exists [验证岗位存在]
    const job = await this.db.select().from(recommendedJobs).where(eq(recommendedJobs.id, dto.jobId));
    if (job.length === 0) {
      throw new NotFoundException(`Job position not found: ${dto.jobId}`);
    }

    // Create application record [创建申请记录]
    const [application] = await this.db
      .insert(jobApplications)
      .values({
        studentId: dto.studentId,
        jobId: dto.jobId,
        applicationType: dto.applicationType,
        coverLetter: dto.coverLetter,
        customAnswers: dto.customAnswers,
        status: "submitted",
        isUrgent: dto.isUrgent || false,
      })
      .returning();

    this.logger.log(`Job application submitted: ${application.id}`);

    // Record status change history [记录状态变更历史]
    await this.db.insert(applicationHistory).values({
      applicationId: application.id,
      previousStatus: null,
      newStatus: "submitted",
      changedBy: dto.studentId,
      changedByType: "student",
      changeReason: "Initial submission",
    });

    // Update job application count [更新岗位申请次数]
    await this.db
      .update(recommendedJobs)
      .set({
        applicationCount: sql`${recommendedJobs.applicationCount} + 1`,
      })
      .where(eq(recommendedJobs.id, dto.jobId));

    // Build event [构建事件]
    const event: JobApplicationSubmittedEvent = {
      applicationId: application.id,
      studentId: dto.studentId,
      positionId: dto.jobId,
      applicationType: dto.applicationType,
      submittedAt: application.submittedAt.toISOString(),
    };

    return {
      data: application,
      event: { type: JOB_APPLICATION_SUBMITTED_EVENT, payload: event },
    };
  }

  /**
   * Submit mentor screening [提交内推导师评估]
   *
   * @param dto - Mentor screening DTO [导师评估DTO]
   * @returns Updated application and events [更新的申请和事件]
   */
  async submitMentorScreening(dto: any) {
    this.logger.log(`Submitting mentor screening: application=${dto.applicationId}, mentor=${dto.mentorId}`);

    // Verify application exists and is mentor referral type [验证申请存在且为内推类型]
    const [application] = await this.db
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.id, dto.applicationId));

    if (!application) {
      throw new NotFoundException(`Application not found: ${dto.applicationId}`);
    }

    if (application.applicationType !== "mentor_referral") {
      throw new Error("Mentor screening is only available for mentor referral applications");
    }

    if (application.status !== "submitted") {
      throw new Error("Mentor screening can only be submitted for applications in submitted status");
    }

    // Save mentor screening result [保存导师评估结果]
    const screeningResult = {
      technicalSkills: dto.technicalSkills,
      experienceMatch: dto.experienceMatch,
      culturalFit: dto.culturalFit,
      overallRecommendation: dto.overallRecommendation,
      screeningNotes: dto.screeningNotes,
    };

    const [updatedApplication] = await this.db
      .update(jobApplications)
      .set({
        mentorScreening: screeningResult,
      })
      .where(eq(jobApplications.id, dto.applicationId))
      .returning();

    this.logger.log(`Mentor screening submitted: ${dto.applicationId}`);

    // Build event [构建事件]
    const event: MentorScreeningCompletedEvent = {
      applicationId: dto.applicationId,
      mentorId: dto.mentorId,
      screeningResult,
      evaluatedAt: new Date().toISOString(),
    };

    return {
      data: updatedApplication,
      event: { type: MENTOR_SCREENING_COMPLETED_EVENT, payload: event },
    };
  }

  /**
   * Update application status [更新投递状态]
   *
   * @param dto - Update status DTO [更新状态DTO]
   * @returns Updated application and events [更新的申请和事件]
   */
  async updateApplicationStatus(
    dto: IUpdateApplicationStatusDto,
  ): Promise<IServiceResult<Record<string, any>, Record<string, any>>> {
    this.logger.log(`Updating application status: ${dto.applicationId} -> ${dto.newStatus}`);

    // Get current application status [获取当前申请状态]
    const [application] = await this.db
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.id, dto.applicationId));

    if (!application) {
      throw new NotFoundException(`Application not found: ${dto.applicationId}`);
    }

    const previousStatus = application.status as string;

    // Update application status [更新申请状态]
    const [updatedApplication] = await this.db
      .update(jobApplications)
      .set({
        status: dto.newStatus as any,
        result: this.getResultFromStatus(dto.newStatus) as any,
        resultDate: ["hired", "rejected", "withdrawn", "declined"].includes(dto.newStatus) ? new Date() : null,
      } as any)
      .where(eq(jobApplications.id, dto.applicationId))
      .returning();

    // Record status change history [记录状态变更历史]
    await (this.db.insert(applicationHistory).values as any)({
      applicationId: dto.applicationId,
      previousStatus,
      newStatus: dto.newStatus as any,
      changedBy: dto.changedBy,
      changedByType: dto.changedBy ? "student" : "system",
      changeReason: dto.changeReason,
      changeMetadata: dto.changeMetadata,
    });

    this.logger.log(`Application status updated: ${dto.applicationId}`);

    // Build event [构建事件]
    const event: JobApplicationStatusChangedEvent = {
      applicationId: dto.applicationId,
      previousStatus: previousStatus as any,
      newStatus: dto.newStatus as any,
      changedBy: dto.changedBy,
      changedAt: new Date().toISOString(),
      changeMetadata: dto.changeMetadata,
    };

    return {
      data: updatedApplication,
      event: { type: JOB_APPLICATION_STATUS_CHANGED_EVENT, payload: event },
    };
  }

  /**
   * Query applications [查询投递申请]
   *
   * @param dto - Query criteria [查询条件]
   * @returns Paginated applications [分页投递列表]
   */
  async queryApplications(dto: IQueryApplicationsDto): Promise<{ items: Record<string, any>[]; total: number; offset: number; limit: number }> {
    this.logger.log(`Querying applications: ${JSON.stringify(dto)}`);

    const conditions = [];

    if (dto.studentId) {
      conditions.push(eq(jobApplications.studentId, dto.studentId));
    }

    if (dto.jobId) {
      conditions.push(eq(jobApplications.jobId, dto.jobId));
    }

    if (dto.status) {
      conditions.push(eq(jobApplications.status, dto.status));
    }

    if (dto.applicationType) {
      conditions.push(eq(jobApplications.applicationType, dto.applicationType));
    }

    // Pagination [分页]
    const offset = dto.offset || 0;
    const limit = dto.limit || 20;

    // Build and execute main query [构建并执行主查询]
    const applications = await this.db
      .select()
      .from(jobApplications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(limit)
      .offset(offset);

    // Get total count [获取总数]
    const countResult = await this.db
      .select({ count: sql`count(*)` })
      .from(jobApplications)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const count = countResult[0]?.count || 0;

    return {
      items: applications,
      total: Number(count),
      offset,
      limit,
    };
  }

  /**
   * Get application by ID [根据ID获取投递申请]
   *
   * @param id - Application ID [申请ID]
   * @returns Application [投递申请]
   */
  async findOneById(id: string) {
    const [application] = await this.db.select().from(jobApplications).where(eq(jobApplications.id, id));

    if (!application) {
      throw new NotFoundException(`Application not found: ${id}`);
    }

    return application;
  }

  /**
   * Get application status history [获取投递状态历史]
   *
   * @param applicationId - Application ID [申请ID]
   * @returns Status history [状态历史]
   */
  async getStatusHistory(applicationId: string) {
    return this.db
      .select()
      .from(applicationHistory)
      .where(eq(applicationHistory.applicationId, applicationId))
      .orderBy(applicationHistory.changedAt);
  }

  /**
   * Check for duplicate application [检查重复申请]
   *
   * @param studentId - Student ID [学生ID]
   * @param jobId - Job position ID [岗位ID]
   * @throws Error if duplicate application exists [如果存在重复申请则抛出错误]
   */
  private async checkDuplicateApplication(studentId: string, jobId: string) {
    const [existing] = await this.db
      .select()
      .from(jobApplications)
      .where(and(eq(jobApplications.studentId, studentId), eq(jobApplications.jobId, jobId)));

    if (existing) {
      throw new Error(`Student ${studentId} has already applied for job ${jobId}`);
    }
  }

  /**
   * Get result from status [从状态获取结果]
   *
   * @param status - Application status [申请状态]
   * @returns Result or null [结果或null]
   */
  private getResultFromStatus(status: string): "hired" | "rejected" | "withdrawn" | "declined" | null {
    const resultStatuses = ["hired", "rejected", "withdrawn", "declined"];
    return resultStatuses.includes(status) ? (status as any) : null;
  }
}
