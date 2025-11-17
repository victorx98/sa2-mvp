/**
 * Session Completed Event Listener(会话完成事件监听器)
 *
 * 基于 NestJS EventEmitter2 的会话完成事件监听器
 * 监听会话完成事件并路由到相应的计费逻辑
 * 支持按次计费和包计费两种模式，并处理评价后计费场景
 */

import { Injectable, Logger, OnModuleInit, Inject } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { IMentorPayableService } from "@domains/financial/interfaces/mentor-payable.interface";
import {
  SessionCompletedEvent,
  SessionEvaluatedEvent,
} from "../types/financial-event.types";

/**
 * 会话完成事件监听器
 * Session Completed Event Listener
 */
@Injectable()
export class SessionCompletedListener implements OnModuleInit {
  private readonly logger = new Logger(SessionCompletedListener.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @Inject("IMentorPayableService")
    private readonly mentorPayableService: IMentorPayableService,
  ) {}

  /**
   * 模块初始化时设置事件监听
   * Set up event listeners on module initialization
   */
  onModuleInit(): void {
    this.logger.log("SessionCompletedListener initialized");
  }

  /**
   * 处理会话完成事件
   * Handle session completed event
   * @param event 会话完成事件
   */
  @OnEvent("services.session.completed")
  public async handleSessionCompleted(
    event: SessionCompletedEvent,
  ): Promise<void> {
    try {
      this.logger.log(
        `Processing session completed event for session: ${event.sessionId}`,
      );

      // 验证事件数据
      if (!this.validateEventData(event)) {
        throw new Error(
          `Invalid session completed event data for session: ${event.sessionId}. Required fields missing.`,
        );
      }

      // 如果需要评价后计费，则等待评价事件
      if (event.requiredEvaluation) {
        this.logger.log(
          `Session ${event.sessionId} requires evaluation before billing. Waiting for evaluation event.`,
        );
        return;
      }

      // 路由到相应的计费逻辑
      await this.routeBilling(event);

      this.logger.log(
        `Successfully processed session completed event: ${event.sessionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing session completed event: ${event.sessionId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
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
      if (!this.validateEvaluatedEventData(event)) {
        throw new Error(
          `Invalid session evaluated event data for session: ${event.sessionId}. Required fields missing.`,
        );
      }

      // 路由到相应的计费逻辑
      await this.routeEvaluatedBilling(event);

      this.logger.log(
        `Successfully processed session evaluated event: ${event.sessionId}`,
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
   * @param event 会话完成事件
   */
  private async routeBilling(event: SessionCompletedEvent): Promise<void> {
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
   * 评价事件计费路由
   * Routes billing for evaluated event to appropriate logic
   * @param event 会话评价完成事件
   */
  private async routeEvaluatedBilling(
    event: SessionEvaluatedEvent,
  ): Promise<void> {
    try {
      // 根据是否有服务包ID来判断计费模式
      if (event.servicePackageId) {
        this.logger.log(
          `Routing evaluated event to package billing mode for package: ${event.servicePackageId}`,
        );
        await this.createEvaluatedPackageBilling(event);
      } else {
        // 按次/按时计费模式
        this.logger.log(
          `Routing evaluated event to per-session billing mode for session: ${event.sessionId}`,
        );
        await this.createEvaluatedPerSessionBilling(event);
      }
    } catch (error) {
      this.logger.error(
        `Failed to route evaluated billing for session: ${event.sessionId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * 创建按次计费记录
   * Create per-session billing record
   * @param event 会话完成事件
   */
  private async createPerSessionBilling(
    event: SessionCompletedEvent,
  ): Promise<void> {
    try {
      this.logger.log(
        `Creating per-session billing for session: ${event.sessionId}`,
      );

      // 准备计费数据
      const billingDto = {
        contractId: `${event.sessionId}-contract`,
        sessionId: event.sessionId,
        mentorUserId: event.mentorUserId,
        studentUserId: event.studentUserId,
        serviceTypeId: event.serviceTypeId, // Updated field name from serviceTypeCode
        serviceName: event.serviceName,
        durationHours: event.durationHours || 0,
        startTime: event.completedAt,
        endTime: event.completedAt,
        metadata: {
          eventType: "services.session.completed",
          mentorName: event.mentorName,
          studentName: event.studentName,
          completedAt: event.completedAt,
        },
      };

      // 创建计费记录
      const ledger =
        await this.mentorPayableService.createPerSessionBilling(billingDto);

      this.logger.log(
        `Successfully created per-session billing: ${ledger.id} for session ${event.sessionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create per-session billing for session: ${event.sessionId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * 创建评价事件的按次计费记录
   * Create per-session billing record for evaluated event
   * @param event 会话评价完成事件
   */
  private async createEvaluatedPerSessionBilling(
    event: SessionEvaluatedEvent,
  ): Promise<void> {
    try {
      this.logger.log(
        `Creating per-session billing for evaluated session: ${event.sessionId}`,
      );

      // 准备计费数据
      const billingDto = {
        sessionId: event.sessionId,
        mentorUserId: event.mentorUserId,
        studentUserId: event.studentUserId,
        serviceTypeId: event.serviceTypeId, // Updated field name from serviceTypeCode
        serviceName: event.serviceName,
        durationHours: event.durationHours || 0,
        metadata: {
          eventType: "services.session.evaluated",
          mentorName: event.mentorName,
          studentName: event.studentName,
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
   * @param event 会话完成事件
   */
  private async createPackageBilling(
    event: SessionCompletedEvent,
  ): Promise<void> {
    try {
      // 检查是否所有会话都已完成
      if (
        !event.packageCompletedSessions ||
        !event.packageTotalSessions ||
        event.packageCompletedSessions < event.packageTotalSessions
      ) {
        this.logger.log(
          `Package ${event.servicePackageId} is not complete yet. Completed: ${event.packageCompletedSessions}/${event.packageTotalSessions}`,
        );
        return;
      }

      this.logger.log(
        `Package ${event.servicePackageId} is complete. Creating package billing for final session: ${event.sessionId}`,
      );

      // 准备计费数据
      const billingDto = {
        contractId: `${event.servicePackageId}-contract`,
        servicePackageId: event.servicePackageId,
        mentorUserId: event.mentorUserId,
        studentUserId: event.studentUserId,
        serviceTypeId: event.serviceTypeId, // Updated field name from serviceTypeCode
        serviceName: event.serviceName,
        quantity: 1,
        metadata: {
          eventType: "services.session.completed",
          mentorName: event.mentorName,
          studentName: event.studentName,
          completedAt: event.completedAt,
          packageTotalSessions: event.packageTotalSessions,
          packageCompletedSessions: event.packageCompletedSessions,
        },
      };

      // 创建包计费记录
      const packageBilling =
        await this.mentorPayableService.createPackageBilling(billingDto);

      this.logger.log(
        `Successfully created package billing: ${packageBilling.id} for package ${event.servicePackageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create package billing for session: ${event.sessionId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * 创建评价事件的包计费记录
   * Create package billing record for evaluated event
   * @param event 会话评价完成事件
   */
  private async createEvaluatedPackageBilling(
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
          `Package ${event.servicePackageId} is not complete yet. Completed: ${event.packageCompletedSessions}/${event.packageTotalSessions}`,
        );
        return;
      }

      this.logger.log(
        `Package ${event.servicePackageId} is complete. Creating package billing for evaluated session: ${event.sessionId}`,
      );

      // 准备计费数据
      const billingDto = {
        servicePackageId: event.servicePackageId,
        mentorUserId: event.mentorUserId,
        studentUserId: event.studentUserId,
        serviceTypeId: event.serviceTypeId, // Updated field name from serviceTypeCode
        serviceName: event.serviceName,
        quantity: 1,
        metadata: {
          eventType: "services.session.evaluated",
          mentorName: event.mentorName,
          studentName: event.studentName,
          packageTotalSessions: event.packageTotalSessions,
          packageCompletedSessions: event.packageCompletedSessions,
        },
      };

      // 创建包计费记录
      const packageBilling =
        await this.mentorPayableService.createPackageBilling(billingDto);

      this.logger.log(
        `Successfully created package billing for evaluated package: ${packageBilling.id} for package ${event.servicePackageId}`,
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
   * 验证会话完成事件数据
   * Validate session completed event data
   * @param event 会话完成事件
   * @returns 是否有效
   */
  private validateEventData(event: SessionCompletedEvent): boolean {
    const {
      sessionId,
      mentorUserId,
      serviceTypeId, // Still using serviceTypeId in event validation
      serviceName,
      completedAt,
      requiredEvaluation,
    } = event;

    // 检查必要字段
    if (
      !sessionId ||
      !mentorUserId ||
      !serviceTypeId || // Replaced serviceTypeCode with serviceTypeId
      !serviceName ||
      !completedAt ||
      requiredEvaluation === undefined
    ) {
      return false;
    }

    // 包计费模式下需要验证相关字段
    if (event.servicePackageId) {
      if (!event.packageTotalSessions || !event.packageCompletedSessions) {
        return false;
      }
    }

    return true;
  }

  /**
   * 验证会话评价完成事件数据
   * Validate session evaluated event data
   * @param event 会话评价完成事件
   * @returns 是否有效
   */
  private validateEvaluatedEventData(event: SessionEvaluatedEvent): boolean {
    const {
      sessionId,
      mentorUserId,
      studentUserId,
      serviceTypeId, // Still using serviceTypeId in event validation
      serviceName,
      durationHours,
    } = event;

    // 检查必要字段
    if (
      !sessionId ||
      !mentorUserId ||
      !studentUserId ||
      !serviceTypeId || // Replaced serviceTypeCode with serviceTypeId
      !serviceName ||
      durationHours === undefined
    ) {
      return false;
    }

    // 包计费模式下需要验证相关字段
    if (event.servicePackageId) {
      if (!event.packageTotalSessions || !event.packageCompletedSessions) {
        return false;
      }
    }

    return true;
  }
}
