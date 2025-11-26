import { Injectable, Logger, Inject } from "@nestjs/common";
import { eq, and, notInArray } from "drizzle-orm";
import { randomUUID } from "crypto";

import { IMassApplicationService } from "../interfaces/mass-application-service.interface";
import {
  MassApplicationBaseDto,
  CreateMassApplicationDto,
  CreateBatchMassApplicationDto,
  ProcessApplicationRejectionDto,
  UpdateApplicationStatusDto,
  BatchOperationResult,
} from "../dto/mass-application.dto";
import { ApplicationStatus } from "../types/application-status.enum";
import { ApplicationReference, NewApplicationReference, applicationReferences, massApplications } from "@infrastructure/database/schema";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DrizzleDatabase } from "@shared/types/database.types";

/**
 * Mass Application Service [海投申请服务]
 * Implements business logic for mass job applications
 * [实现海投岗位申请的业务逻辑]
 */
@Injectable()
export class MassApplicationService implements IMassApplicationService {
  private readonly logger = new Logger(MassApplicationService.name);
  private readonly APPLICATION_TYPE = "mass";
  private readonly JOB_TABLE_TYPE = "indeed";

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async createApplication(dto: CreateMassApplicationDto): Promise<MassApplicationBaseDto> {
    // Validate unique application [验证唯一性]
    await this.validateUniqueApplication(dto.studentId, dto.indeedJobId);

    // Create application record [创建申请记录]
    const application = await this.db.transaction(async (tx) => {
      // 1. Create mass application record
      const [newApp] = await tx
        .insert(massApplications)
        .values({
          studentId: dto.studentId,
          indeedJobId: dto.indeedJobId,
          jobId: dto.jobId,
          appliedAt: dto.appliedAt || new Date(),
        } as any)
        .returning();

      // 2. Create application reference (shared primary key design)
      const [reference] = await tx
        .insert(applicationReferences)
        .values({
          id: newApp.id,
          applicationType: this.APPLICATION_TYPE,
          studentId: dto.studentId,
          jobId: randomUUID(), // Generate UUID for jobId [为岗位ID生成UUID]
          jobTableType: this.JOB_TABLE_TYPE,
          applicationStatus: ApplicationStatus.SUBMITTED,
        } as NewApplicationReference)
        .returning();

      return newApp;
    });

    this.logger.log(`Created mass application: ${application.id}`);
    return this.mapToDto(application);
  }

  async createBatchApplications(dto: CreateBatchMassApplicationDto): Promise<BatchOperationResult> {
    const result: BatchOperationResult = {
      batchId: this.generateBatchId(),
      totalCount: dto.applications.length,
      successCount: 0,
      failedCount: 0,
      applications: [],
      failures: [],
    };

    // Process each application independently [独立处理每个申请]
    for (const appData of dto.applications) {
      try {
        // Validate and create each application [验证并创建申请]
        await this.validateUniqueApplication(dto.studentId, appData.indeedJobId);

        const application = await this.createSingleApplication(dto.studentId, appData);
        result.applications.push(application);
        result.successCount++;

      } catch (error) {
        result.failures.push({
          indeedJobId: appData.indeedJobId,
          reason: error.message,
        });
        result.failedCount++;

        this.logger.warn(
          `Batch application failed for job ${appData.indeedJobId}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Batch operation completed: ${result.successCount} success, ${result.failedCount} failed`,
    );
    return result;
  }

  async updateApplicationStatus(dto: UpdateApplicationStatusDto): Promise<MassApplicationBaseDto> {
    // Validate status transition [验证状态流转]
    const [application] = await this.db
      .select()
      .from(massApplications)
      .where(eq(massApplications.id, dto.applicationId));

    if (!application) {
      throw new Error(`Application not found: ${dto.applicationId}`);
    }

    // Check valid transition
    const valid = this.isValidStatusTransition(
      application.applicationStatus as ApplicationStatus,
      dto.newStatus,
    );
    if (!valid) {
      throw new Error(
        `Invalid status transition from ${application.applicationStatus} to ${dto.newStatus}`,
      );
    }

    // Update both tables [更新两个表]
    const [updated] = await this.db.transaction(async (tx) => {
      await tx
        .update(massApplications)
        .set({
          applicationStatus: dto.newStatus,
          updatedAt: new Date(),
        } as any)
        .where(eq(massApplications.id, dto.applicationId));

      await tx
        .update(applicationReferences)
        .set({
          applicationStatus: dto.newStatus,
          updatedAt: new Date(),
        } as any)
        .where(eq(applicationReferences.id, dto.applicationId));

      return tx
        .select()
        .from(massApplications)
        .where(eq(massApplications.id, dto.applicationId));
    });

    return this.mapToDto(updated as any);
  }

  async getApplicationById(applicationId: string): Promise<MassApplicationBaseDto> {
    const [application] = await this.db
      .select()
      .from(massApplications)
      .where(eq(massApplications.id, applicationId));

    if (!application) {
      throw new Error(`Application not found: ${applicationId}`);
    }

    return this.mapToDto(application);
  }

  async queryApplications(query: any): Promise<any> {
    // Simplified implementation - filter by studentId [简化实现 - 按学生ID筛选]
    const whereConditions = [];

    if (query.studentId) {
      whereConditions.push(eq(massApplications.studentId, query.studentId));
    }

    if (query.status) {
      whereConditions.push(eq(massApplications.applicationStatus, query.status));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const applications = await this.db
      .select()
      .from(massApplications)
      .where(whereClause)
      .limit(query.limit || 20)
      .offset(query.offset || 0);

    return {
      items: applications.map((app) => this.mapToDto(app)),
      total: applications.length, // Simplified total count - should count separately in production [简化总数 - 生产环境应单独计算]
      limit: query.limit || 20,
      offset: query.offset || 0,
    };
  }

  async getApplicationStats(studentId: string): Promise<any> {
    const applications = await this.db
      .select()
      .from(massApplications)
      .where(eq(massApplications.studentId, studentId));

    const statusBreakdown = {
      [ApplicationStatus.SUBMITTED]: 0,
      [ApplicationStatus.INTERVIEWED]: 0,
      [ApplicationStatus.OFFERED]: 0,
      [ApplicationStatus.REJECTED]: 0,
      [ApplicationStatus.EXPIRED]: 0,
    };

    applications.forEach((app) => {
      const status = app.applicationStatus as ApplicationStatus;
      statusBreakdown[status]++;
    });

    return {
      studentId,
      totalApplications: applications.length,
      statusBreakdown,
      recentApplications: applications
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5)
        .map((app) => this.mapToDto(app)),
    };
  }

  async processApplicationRejection(dto: ProcessApplicationRejectionDto): Promise<any> {
    return this.updateApplicationStatus({
      applicationId: dto.applicationId,
      newStatus: ApplicationStatus.REJECTED,
      updatedBy: dto.rejectedBy,
    });
  }

  async processInterviewInvitation(dto: any): Promise<any> {
    // Implementation would include interview scheduling logic [实现将包含面试安排逻辑]
    return this.updateApplicationStatus({
      applicationId: dto.applicationId,
      newStatus: ApplicationStatus.INTERVIEWED,
      updatedBy: dto.invitedBy,
    });
  }

  async processOfferReceived(dto: any): Promise<any> {
    return this.updateApplicationStatus({
      applicationId: dto.applicationId,
      newStatus: ApplicationStatus.OFFERED,
      updatedBy: dto.offeredBy,
    });
  }

  async expireApplication(dto: any): Promise<any> {
    return this.updateApplicationStatus({
      applicationId: dto.applicationId,
      newStatus: ApplicationStatus.EXPIRED,
      updatedBy: dto.expiredBy,
    });
  }

  async applicationExists(applicationId: string): Promise<boolean> {
    const [application] = await this.db
      .select()
      .from(massApplications)
      .where(eq(massApplications.id, applicationId));
    return !!application;
  }

  async canApply(studentId: string, indeedJobId: string): Promise<boolean> {
    try {
      await this.validateUniqueApplication(studentId, indeedJobId);
      return true;
    } catch {
      return false;
    }
  }

  // ==================== Private Helper Methods [私有辅助方法] ====================

  private async validateUniqueApplication(studentId: string, indeedJobId: string): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(massApplications)
      .where(
        and(
          eq(massApplications.studentId, studentId),
          eq(massApplications.indeedJobId, indeedJobId),
          notInArray(massApplications.applicationStatus, [ApplicationStatus.EXPIRED]),
        ),
      );

    if (existing) {
      throw new Error(
        `Student ${studentId} has already applied for job ${indeedJobId}`,
      );
    }
  }

  private async createSingleApplication(
    studentId: string,
    appData: any,
  ): Promise<MassApplicationBaseDto> {
    const newApp = await this.db.transaction(async (tx) => {
      // Create mass application record
      const [app] = await tx
        .insert(massApplications)
        .values({
          studentId,
          indeedJobId: appData.indeedJobId,
          jobId: appData.jobId,
          appliedAt: appData.appliedAt || new Date(),
        } as any)
        .returning();

      // Create application reference (shared primary key design)
      await tx
        .insert(applicationReferences)
        .values({
          id: app.id,
          applicationType: this.APPLICATION_TYPE,
          studentId,
          jobId: randomUUID(), // Generate UUID for jobId [为岗位ID生成UUID]
          jobTableType: this.JOB_TABLE_TYPE,
          applicationStatus: ApplicationStatus.SUBMITTED,
        } as NewApplicationReference)
        .returning();

      return app;
    });

    return this.mapToDto(newApp);
  }

  private mapToDto(app: any): MassApplicationBaseDto {
    return {
      id: app.id,
      studentId: app.studentId,
      indeedJobId: app.indeedJobId,
      jobId: app.jobId,
      status: app.applicationStatus as ApplicationStatus,
      appliedAt: app.appliedAt,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
  }

  private isValidStatusTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
    const allowed = {
      [ApplicationStatus.SUBMITTED]: [ApplicationStatus.INTERVIEWED, ApplicationStatus.REJECTED, ApplicationStatus.EXPIRED],
      [ApplicationStatus.INTERVIEWED]: [ApplicationStatus.OFFERED, ApplicationStatus.REJECTED],
      [ApplicationStatus.OFFERED]: [],
      [ApplicationStatus.REJECTED]: [],
      [ApplicationStatus.EXPIRED]: [],
    };
    return allowed[from]?.includes(to) || false;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export default MassApplicationService;
