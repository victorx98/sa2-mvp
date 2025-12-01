/**
 * Placement Event Listener for Contract Domain [Contract Domain的投递事件监听器]
 *
 * 负责监听投递相关事件，并执行以下操作：
 * 1. 记录投递申请的权益消耗到台账 (Record application-related entitlement consumption to ledger)
 * 2. 处理投递状态回撤时的权益退款 (Handle entitlement refund when application status is rolled back)
 *
 * 触发时机：
 * - 当投递申请状态变更时 (When job application status changes)
 * - 当投递申请状态回撤时 (When job application status is rolled back)
 */
import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  IJobApplicationStatusChangedEvent,
  IJobApplicationStatusRolledBackEvent,
} from "@shared/events/placement-application.events";
import {
  JOB_APPLICATION_STATUS_CHANGED_EVENT,
  JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT,
} from "@shared/events/event-constants";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DrizzleDatabase } from "@shared/types/database.types";
import { Inject } from "@nestjs/common";
import { eq } from "drizzle-orm";
import * as schema from "@infrastructure/database/schema";
import { getServiceTypeFromApplicationType } from "@domains/contract/utils/application-type-mapper";

@Injectable()
export class PlacementEventListener {
  private readonly logger = new Logger(PlacementEventListener.name);

  constructor(
    private readonly serviceLedgerService: ServiceLedgerService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) { }

  /**
   * 监听投递状态变更事件
   * Listen for job application status changed event
   *
   * @param event 投递状态变更事件数据
   */
  @OnEvent(JOB_APPLICATION_STATUS_CHANGED_EVENT)
  async handleApplicationStatusChangedEvent(
    event: IJobApplicationStatusChangedEvent,
  ): Promise<void> {
    try {
      const {
        applicationId,
        previousStatus,
        newStatus,
        changedBy,
      } = event.payload || {};

      this.logger.log(
        `Processing job application status changed event: ${event.id}, applicationId: ${applicationId}, previousStatus: ${previousStatus}, newStatus: ${newStatus}`,
      );

      if (!applicationId || !newStatus) {
        this.logger.error(
          `Missing required fields in event payload: applicationId=${applicationId}, newStatus=${newStatus}`,
        );
        return;
      }

      // 1. 查询投递申请信息，获取studentId和applicationType
      // 1. Query job application info to get studentId and applicationType
      const jobApplication = await this.db.query.jobApplications.findFirst({
        where: eq(schema.jobApplications.id, applicationId),
        columns: { studentId: true, applicationType: true },
      });

      if (!jobApplication) {
        this.logger.error(
          `Job application not found: applicationId=${applicationId}`,
        );
        return;
      }

      const { studentId, applicationType } = jobApplication;

      // 2. 根据投递类型和状态变更记录权益消耗
      // 2. Record entitlement consumption based on application type and status change
      // 仅在状态变为submitted时消耗权益
      // Only consume entitlement when status changes to submitted
      if (newStatus === 'submitted') {
        this.logger.log(
          `Recording consumption for student: ${studentId}, applicationType: ${applicationType}, applicationId: ${applicationId}`,
        );

        // 调用ServiceLedgerService记录权益消耗
        // Call ServiceLedgerService to record entitlement consumption
        const serviceType = getServiceTypeFromApplicationType(applicationType);
        if (!serviceType) {
          this.logger.log(
            `No entitlement deduction needed for application type: ${applicationType}`,
          );
          return;
        }

        await this.serviceLedgerService.recordConsumption({
          studentId,
          serviceType, // 服务类型：从投递类型映射获取
          quantity: 1, // 消耗数量：1个权益
          relatedBookingId: applicationId, // 关联ID：投递申请ID
          createdBy: changedBy || 'system', // 创建人：事件发起者或系统
        });

        this.logger.log(
          `Successfully recorded consumption for student: ${studentId}, applicationId: ${applicationId}`,
        );
      }

      this.logger.log(
        `Successfully processed job application status changed event: ${event.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process job application status changed event: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * 监听投递状态回撤事件
   * Listen for job application status rolled back event
   *
   * @param event 投递状态回撤事件数据
   */
  @OnEvent(JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT)
  async handleApplicationStatusRolledBackEvent(
    event: IJobApplicationStatusRolledBackEvent,
  ): Promise<void> {
    try {
      const {
        applicationId,
        previousStatus,
        newStatus,
        changedBy,
        rollbackReason,
      } = event.payload || {};

      this.logger.log(
        `Processing job application status rolled back event: ${event.id}, applicationId: ${applicationId}, from ${previousStatus} to ${newStatus}`,
      );

      if (!applicationId) {
        this.logger.error(
          `Missing required fields in event payload: applicationId=${applicationId}`,
        );
        return;
      }

      // 1. 查询投递申请信息，获取studentId
      // 1. Query job application info to get studentId
      const jobApplication = await this.db.query.jobApplications.findFirst({
        where: eq(schema.jobApplications.id, applicationId),
        columns: { studentId: true },
      });

      if (!jobApplication) {
        this.logger.error(
          `Job application not found: applicationId=${applicationId}`,
        );
        return;
      }

      const { studentId } = jobApplication;

      // 2. 根据投递状态回撤记录权益退款
      // 2. Record entitlement refund based on application status rollback
      // 仅在状态从submitted回撤时退款
      // Only refund entitlement when status rolls back from submitted
      if (previousStatus === 'submitted') {
        this.logger.log(
          `Recording refund for student: ${studentId}, applicationId: ${applicationId}, reason: ${rollbackReason}`,
        );

        // 调用ServiceLedgerService记录权益退款（使用adjustment实现对冲）
        // Call ServiceLedgerService to record entitlement refund (using adjustment for offset)
        // 从投递申请中获取applicationType，然后映射到对应的服务类型
        // Get applicationType from job application and map to corresponding service type
        const jobApplication = await this.db.query.jobApplications.findFirst({
          where: eq(schema.jobApplications.id, applicationId),
          columns: { applicationType: true },
        });
        
        if (!jobApplication) {
          this.logger.error(
            `Job application not found: applicationId=${applicationId}`,
          );
          return;
        }
        
        const serviceType = getServiceTypeFromApplicationType(jobApplication.applicationType);
        
        await this.serviceLedgerService.recordAdjustment({
          studentId,
          serviceType, // 服务类型：从投递类型映射获取
          quantity: 1, // 退款数量：1个权益（正数表示增加）
          reason: `Job application status rolled back: ${rollbackReason}`, // 调整原因：包含回滚原因
          createdBy: changedBy || 'system', // 创建人：事件发起者或系统
        });

        this.logger.log(
          `Successfully recorded refund for student: ${studentId}, applicationId: ${applicationId}`,
        );
      }

      this.logger.log(
        `Successfully processed job application status rolled back event: ${event.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process job application status rolled back event: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
