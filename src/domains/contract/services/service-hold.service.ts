import { Inject, Injectable } from "@nestjs/common";
import { eq, and, lt, isNotNull } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import {
  DrizzleDatabase,
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";
import {
  ContractException,
  ContractNotFoundException,
} from "../common/exceptions/contract.exception";
import { CreateHoldDto } from "../dto/create-hold.dto";
import type { ServiceHold } from "@infrastructure/database/schema";
import { HoldStatus } from "@shared/types/contract-enums";

@Injectable()
export class ServiceHoldService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) { }

  /**
   * Create hold(v2.16.13 - 重新引入过期机制)
   * - Check available balance(检查可用余额)
   * - Create hold record (supports both automatic expiration and manual release)(创建预占记录(支持自动过期和手动释放))
   * - Trigger automatically updates held_quantity(触发器自动更新预占数量)
   *
   * v2.16.11: relatedBookingId is always null on creation, updated via event (v2.16.11: relatedBookingId在创建时始终为null，通过事件更新)
   * v2.16.12: Removed contractId, expiryHours, and expiryAt fields (v2.16.12: 移除contractId, expiryHours和expiryAt字段)
   * v2.16.13: Re-introduced expiryAt field (v2.16.13: 重新引入expiryAt字段)
   *
   * Supports optional transaction parameter(支持可选的事务参数)
   *
   * @change {v2.16.12} Now queries by studentId + serviceType (aggregates across contracts)
   * @change {v2.16.12} Removed expiryAt (holds no longer expire automatically - manual release only)
   * @change {v2.16.13} Re-introduced expiryAt - supports both automatic expiration and manual release
   */
  async createHold(
    dto: CreateHoldDto,
    tx?: DrizzleTransaction,
  ): Promise<ServiceHold> {
    const { studentId, serviceType, quantity, expiryAt, createdBy } = dto;
    const executor = tx ?? this.db;

    /* 1. Find entitlements for student and check balance (with pessimistic lock)(1. 查找学生权益并检查余额(使用悲观锁)) */
    const entitlements = await executor
      .select()
      .from(schema.contractServiceEntitlements)
      .where(
        and(
          eq(schema.contractServiceEntitlements.studentId, studentId),
          eq(schema.contractServiceEntitlements.serviceType, serviceType),
        ),
      )
      .for("update");

    if (entitlements.length === 0) {
      throw new ContractNotFoundException("NO_ENTITLEMENTS_FOUND");
    }

    /* Sum available quantity across all entitlements(汇总所有权益的可用数量) */
    const totalAvailable = entitlements.reduce(
      (sum, e) => sum + e.availableQuantity,
      0,
    );

    if (totalAvailable < quantity) {
      throw new ContractException("INSUFFICIENT_BALANCE");
    }

    /* 2. Create hold (trigger will update held_quantity automatically)(2. 创建预占(触发器将自动更新预占数量)) */
    /* v2.16.13: Supports both automatic expiration and manual release (v2.16.13: 支持自动过期和手动释放) */
    const [newHold] = await executor
      .insert(schema.serviceHolds)
      .values({
        studentId,
        serviceType: serviceType,
        quantity,
        status: HoldStatus.ACTIVE,
        relatedBookingId: null, // Always null on creation (v2.16.11)
        expiryAt: expiryAt || null, // Set expiryAt if provided, otherwise null (永不过期)
        createdBy,
      })
      .returning();

    return newHold;
  }

  /**
   * Release hold(释放预占)
   * - Update status to released(更新状态为已释放)
   * - Trigger automatically updates held_quantity(触发器自动更新预占数量)
   */
  async releaseHold(
    id: string,
    reason: string,
    tx?: DrizzleTransaction,
  ): Promise<ServiceHold> {
    const executor: DrizzleExecutor = tx ?? this.db;

    /* 1. Find hold(1. 查找预占) */
    const [hold] = await executor
      .select()
      .from(schema.serviceHolds)
      .where(eq(schema.serviceHolds.id, id))
      .limit(1);

    if (!hold) {
      throw new ContractNotFoundException("HOLD_NOT_FOUND");
    }

    /* 2. Validate status(2. 验证状态) */
    if (hold.status !== "active") {
      throw new ContractException("HOLD_NOT_ACTIVE");
    }

    /* 3. Release hold (trigger will update held_quantity automatically)(3. 释放预占(触发器将自动更新预占数量)) */
    const [releasedHold] = await executor
      .update(schema.serviceHolds)
      .set({
        status: HoldStatus.RELEASED,
        releaseReason: reason,
        releasedAt: new Date(),
      })
      .where(eq(schema.serviceHolds.id, id))
      .returning();

    return releasedHold;
  }

  /**
   * Get long-unreleased holds for manual review(v2.16.12 - 学生级权益累积制)
   * - Returns list of active holds created more than 24 hours ago(返回超过24小时前创建的活跃预占列表)
   * - No automatic update - manual review and release only(无自动更新 - 仅人工审核和释放)
   * - Caller should manually review and use releaseHold() to process(调用者应手动审核并使用releaseHold()处理)
   *
   * Purpose: Monitor holds that may need manual intervention(目的：监控可能需要人工干预的预占)
   * Threshold: 24 hours (configurable based on business needs)(阈值：24小时(可根据业务需求配置))
   */
  async getLongUnreleasedHolds(
    hoursOld = 24,
    tx?: DrizzleTransaction,
  ): Promise<ServiceHold[]> {
    const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    const executor: DrizzleExecutor = tx ?? this.db;

    return await executor
      .select()
      .from(schema.serviceHolds)
      .where(
        and(
          eq(schema.serviceHolds.status, HoldStatus.ACTIVE),
          lt(schema.serviceHolds.createdAt, cutoffTime),
        ),
      );
  }

  /**
   * Get active holds for student and service type(v2.16.12 - 学生级权益累积制)
   * - Returns all active holds across ALL contracts for the student and service type(返回学生和服务类型在所有合同中的活跃预占)
   *
   * @change {v2.16.12} Changed from contractId to studentId
   */
  async getActiveHolds(
    studentId: string,
    serviceType: string,
  ): Promise<ServiceHold[]> {
    return await this.db
      .select()
      .from(schema.serviceHolds)
      .where(
        and(
          eq(schema.serviceHolds.studentId, studentId),
          eq(schema.serviceHolds.serviceType, serviceType),
          eq(schema.serviceHolds.status, HoldStatus.ACTIVE),
        ),
      );
  }

  /**
   * Cancel hold(取消预占)
   * - Similar to release but with 'cancelled' reason(类似于释放但使用'cancelled'原因)
   */
  async cancelHold(
    id: string,
    reason: string,
    tx?: DrizzleTransaction,
  ): Promise<ServiceHold> {
    const executor: DrizzleExecutor = tx ?? this.db;

    const [hold] = await executor
      .select()
      .from(schema.serviceHolds)
      .where(eq(schema.serviceHolds.id, id))
      .limit(1);

    if (!hold) {
      throw new ContractNotFoundException("HOLD_NOT_FOUND");
    }

    if (hold.status !== "active") {
      throw new ContractException("HOLD_NOT_ACTIVE");
    }

    const [cancelledHold] = await executor
      .update(schema.serviceHolds)
      .set({
        status: HoldStatus.RELEASED,
        releaseReason: reason || "cancelled",
        releasedAt: new Date(),
      })
      .where(eq(schema.serviceHolds.id, id))
      .returning();

    return cancelledHold;
  }

  /**
   * Release expired holds (v2.16.13 - 重新引入过期机制)
   * - Find and release holds that have passed their expiry time(查找并释放已过期的预占)
   * - Update status to 'expired'(更新状态为'expired')
   * - Trigger automatically updates held_quantity(触发器自动更新预占数量)
   *
   * @param batchSize - Number of holds to process in one batch (一次处理的预占数量)
   * @param sessionId - Optional session ID for tracking (可选的会话ID用于跟踪)
   * @returns Object with counts of processed holds (处理结果计数)
   */
  async releaseExpiredHolds(
    batchSize = 100,
    _sessionId?: string,
  ): Promise<{
    releasedCount: number;
    failedCount: number;
    skippedCount: number;
  }> {
    const now = new Date();
    let releasedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    try {
      // Find expired holds (查找过期的预占)
      const expiredHolds = await this.db
        .select()
        .from(schema.serviceHolds)
        .where(
          and(
            eq(schema.serviceHolds.status, HoldStatus.ACTIVE),
            isNotNull(schema.serviceHolds.expiryAt),
            lt(schema.serviceHolds.expiryAt, now),
          ),
        )
        .limit(batchSize);

      // Process each expired hold (处理每个过期预占)
      for (const hold of expiredHolds) {
        try {
          // Update status to expired (更新状态为过期)
          await this.db
            .update(schema.serviceHolds)
            .set({
              status: HoldStatus.EXPIRED,
              releaseReason: "expired",
              releasedAt: now,
            })
            .where(eq(schema.serviceHolds.id, hold.id));

          releasedCount++;
        } catch (error) {
          console.error(`Failed to release expired hold ${hold.id}:`, error);
          failedCount++;
        }
      }

      // If no expired holds found, increment skipped count (如果没有找到过期预占，增加跳过计数)
      if (expiredHolds.length === 0) {
        skippedCount = 1;
      }
    } catch (error) {
      console.error("Error in releaseExpiredHolds:", error);
      failedCount++;
    }

    return {
      releasedCount,
      failedCount,
      skippedCount,
    };
  }

  /**
   * Manual trigger for expired hold cleanup (v2.16.13 - 重新引入过期机制)
   * - Can be called manually to clean up expired holds(可以手动调用来清理过期预占)
   * - Useful for testing or manual cleanup(适用于测试或手动清理)
   *
   * @param batchSize - Number of holds to process in one batch (一次处理的预占数量)
   * @returns Object with counts of processed holds (处理结果计数)
   */
  async triggerExpiredHoldsRelease(batchSize = 100): Promise<{
    releasedCount: number;
    failedCount: number;
    skippedCount: number;
  }> {
    return await this.releaseExpiredHolds(batchSize, "manual-trigger");
  }

  /**
   * Update related booking ID for a hold (更新 hold 的关联 booking ID)
   * Used to establish relationship between hold and session after session creation
   * (在 session 创建后建立 hold 与 session 的关联关系)
   *
   * @param holdId - The ID of the service hold (服务预留 ID)
   * @param bookingId - The ID of the booking (session, class, etc.) (预约 ID，如 session、class 等)
   * @param tx - Optional transaction (可选的事务)
   */
  async updateRelatedBooking(
    holdId: string,
    bookingId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;

    await executor
      .update(schema.serviceHolds)
      .set({
        relatedBookingId: bookingId,
        updatedAt: new Date(),
      })
      .where(eq(schema.serviceHolds.id, holdId));
  }
}
