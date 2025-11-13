import { Injectable, Logger, OnModuleInit, Inject } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import type { IMentorPayableService } from "@domains/financial/interfaces/mentor-payable.interface";
import { SessionEvaluatedEvent } from "../types/financial-event.types";

/**
 * 会话评价事件监听器
 * Session Evaluated Event Listener
 */
@Injectable()
export class SessionEvaluatedListener implements OnModuleInit {
  private readonly logger = new Logger(SessionEvaluatedListener.name);

  constructor(
    @Inject("IMentorPayableService")
    private readonly mentorPayableService: IMentorPayableService,
  ) {}

  /**
   * 模块初始化时设置事件监听
   * Set up event listeners on module initialization
   */
  onModuleInit(): void {
    this.logger.log("SessionEvaluatedListener initialized");
  }

  /**
   * 处理会话评价完成事件
   * Handle session evaluation completed event
   * @param event 会话评价完成事件
   */
  @OnEvent("services.session.evaluated")
  public async handleSessionEvaluated(
    event: SessionEvaluatedEvent,
  ): Promise<void> {
    try {
      this.logger.log(
        `Processing session evaluated event for session: ${event.sessionId}`,
      );

      // 验证事件数据
      if (!this.validateEventData(event)) {
        const errorMessage = `Invalid session evaluated event data for session: ${event.sessionId}. Required fields missing.`;
        this.logger.warn(errorMessage);
        throw new Error(errorMessage);
      }

      // 检查是否为重复事件
      if (
        await this.mentorPayableService.isDuplicate(
          event.sessionId,
          "services.session.evaluated",
        )
      ) {
        this.logger.warn(
          `Duplicate session evaluated event detected: ${event.sessionId}. Skipping processing.`,
        );
        return;
      }

      // 路由到相应的计费逻辑
      await this.routeBilling(event);

      this.logger.log(
        `Successfully processed session evaluated event: ${event.sessionId}, rating: ${event.rating}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing session evaluated event: ${event.sessionId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * 计费路由 - 根据计费模式路由到相应的计费逻辑
   * Routes billing to appropriate logic based on billing mode
   * @param event 会话评价完成事件
   */
  private async routeBilling(event: SessionEvaluatedEvent): Promise<void> {
    try {
      // 根据是否有服务包ID来判断计费模式
      // 包计费模式：当存在servicePackageId时，使用包计费逻辑
      if (event.servicePackageId) {
        this.logger.log(
          `Routing to package billing mode for package: ${event.servicePackageId}`,
        );
        await this.createPackageBilling(event);
      } else {
        // 按次/按时计费模式：没有服务包ID时，使用单次会话计费逻辑
        this.logger.log(
          `Routing to per-session billing mode for session: ${event.sessionId}`,
        );
        await this.createPerSessionBilling(event);
      }
    } catch (error) {
      this.logger.error(
        `Failed to route billing for session: ${event.sessionId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * 创建按次计费记录
   * Create per-session billing record
   * @param event 会话评价完成事件
   */
  private async createPerSessionBilling(
    event: SessionEvaluatedEvent,
  ): Promise<void> {
    try {
      this.logger.log(
        `Creating per-session billing for evaluated session: ${event.sessionId}`,
      );

      // 准备计费数据 - 确保包含所有必需的接口字段
      const billingDto = {
        sessionId: event.sessionId,
        contractId: event.contractId,
        mentorUserId: event.mentorUserId,
        studentUserId: event.studentUserId,
        serviceTypeCode: event.serviceTypeCode,
        serviceName: event.serviceName,
        durationHours: event.durationHours,
        startTime: event.startTime,
        endTime: event.endTime,
        metadata: {
          sessionId: event.sessionId,
          rating: event.rating,
          ratingComment: event.ratingComment,
        },
      };

      // 创建计费记录
      const ledger =
        await this.mentorPayableService.createPerSessionBilling(billingDto);

      this.logger.log(
        `Successfully created per-session billing for evaluated session: ${ledger.id} for session ${event.sessionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create per-session billing for evaluated session: ${event.sessionId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * 创建包计费记录
   * 仅在最后一个 session 完成后触发
   * @param event 会话评价完成事件
   */
  private async createPackageBilling(
    event: SessionEvaluatedEvent,
  ): Promise<void> {
    try {
      // 检查是否所有会话都已完成
      if (
        !event.packageCompletedSessions ||
        !event.packageTotalSessions ||
        event.packageCompletedSessions < event.packageTotalSessions
      ) {
        this.logger.log(
          `Package ${event.servicePackageId} is not complete yet after evaluation. Completed: ${event.packageCompletedSessions}/${event.packageTotalSessions}`,
        );
        return;
      }

      this.logger.log(
        `Package ${event.servicePackageId} is complete after evaluation. Creating package billing for session: ${event.sessionId}`,
      );

      // 准备计费数据 - 确保包含所有必需的接口字段
      const billingDto = {
        contractId: event.contractId,
        servicePackageId: event.servicePackageId,
        mentorUserId: event.mentorUserId,
        studentUserId: event.studentUserId,
        serviceTypeCode: event.serviceTypeCode,
        serviceName: event.serviceName,
        quantity: 1,
        metadata: {
          sessionId: event.sessionId,
          packageTotalSessions: event.packageTotalSessions,
          rating: event.rating,
        },
      };

      // 创建包计费记录
      const packageBilling =
        await this.mentorPayableService.createPackageBilling(billingDto);

      this.logger.log(
        `Successfully created package billing for evaluated session: ${packageBilling.id} for package ${event.servicePackageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create package billing for evaluated session: ${event.sessionId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * 验证事件数据
   * Validate event data
   * @param event 会话评价完成事件
   * @returns 验证结果
   */
  private validateEventData(event: SessionEvaluatedEvent): boolean {
    return !!(
      event.sessionId &&
      event.contractId &&
      event.mentorUserId &&
      event.studentUserId &&
      event.mentorName &&
      event.studentName &&
      event.serviceTypeCode &&
      event.serviceName &&
      event.durationHours &&
      event.startTime &&
      event.endTime &&
      event.rating !== undefined &&
      event.rating >= 1 &&
      event.rating <= 5
    );
  }
}
