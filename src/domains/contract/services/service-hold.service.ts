import { Inject, Injectable } from "@nestjs/common";
import { eq, and, lt } from "drizzle-orm";
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
import type { ServiceType } from "../common/types/enum.types";

@Injectable()
export class ServiceHoldService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Create hold(创建预占)
   * - Check available balance(检查可用余额)
   * - Create hold record with TTL(创建带TTL的预占记录)
   * - Trigger automatically updates held_quantity(触发器自动更新预占数量)
   *
   * v2.16.11: relatedBookingId is always null on creation, updated via event (v2.16.11: relatedBookingId在创建时始终为null，通过事件更新)
   *
   * Supports optional transaction parameter(支持可选的事务参数)
   */
  async createHold(
    dto: CreateHoldDto,
    tx?: DrizzleTransaction,
  ): Promise<ServiceHold> {
    const {
      contractId,
      studentId,
      serviceType,
      quantity,
      createdBy,
      expiryAt,
    } = dto;
    const executor = tx ?? this.db;

    /* 1. Find entitlement and check balance (with pessimistic lock)(1. 查找权益并检查余额(使用悲观锁)) */
    const entitlements = await executor
      .select()
      .from(schema.contractServiceEntitlements)
      .where(
        and(
          eq(schema.contractServiceEntitlements.contractId, contractId),
          eq(
            schema.contractServiceEntitlements.serviceType,
            serviceType as ServiceType,
          ),
        ),
      )
      .for("update");

    if (entitlements.length === 0) {
      throw new ContractNotFoundException("ENTITLEMENT_NOT_FOUND");
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
    /* v2.16.12: Use expiryAt only, removed expiryHours (v2.16.12: 仅使用expiryAt，移除expiryHours) */
    /* ⚠️ Important: null or undefined = no expiry (永不过期); timestamp = specific expiry time (具体过期时间) */
    const calculatedExpiryAt = expiryAt !== undefined ? expiryAt : null; // null or undefined means no expiry (null或undefined表示永不过期)

    const [newHold] = await executor
      .insert(schema.serviceHolds)
      .values({
        contractId,
        studentId,
        serviceType: serviceType as ServiceType,
        quantity,
        status: "active",
        relatedBookingId: null, // Always null on creation (v2.16.11)
        createdBy,
        expiryAt: calculatedExpiryAt,
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
        status: "released",
        releaseReason: reason,
        releasedAt: new Date(),
      })
      .where(eq(schema.serviceHolds.id, id))
      .returning();

    return releasedHold;
  }

  /**
   * Get long-unreleased holds for manual review(v2.16.9)
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
          eq(schema.serviceHolds.status, "active"),
          lt(schema.serviceHolds.createdAt, cutoffTime),
        ),
      );
  }

  /**
   * Get active holds for contract and service type(获取合同和服务类型的活跃预占)
   */
  async getActiveHolds(
    contractId: string,
    serviceType: string,
  ): Promise<ServiceHold[]> {
    return await this.db
      .select()
      .from(schema.serviceHolds)
      .where(
        and(
          eq(schema.serviceHolds.contractId, contractId),
          eq(schema.serviceHolds.serviceType, serviceType as ServiceType),
          eq(schema.serviceHolds.status, "active"),
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
        status: "released",
        releaseReason: reason || "cancelled",
        releasedAt: new Date(),
      })
      .where(eq(schema.serviceHolds.id, id))
      .returning();

    return cancelledHold;
  }

  /**
   * Release expired holds (v2.16.10)
   * - Query for holds that have expired (expiry_at <= now)
   * - Release them in batches to avoid long-running transactions
   * - Return statistics about the release operation
   *
   * Note: This method should be called by scheduled task or manual trigger
   * Each hold release is processed in its own transaction to ensure isolation
   */
  async releaseExpiredHolds(
    batchSize = 100,
    sessionId?: string,
  ): Promise<{
    releasedCount: number;
    failedCount: number;
    skippedCount: number;
  }> {
    const now = new Date();

    /* Query for expired holds (active status, expiry_at <= now, not null expiry_at) */
    const expiredHolds = await this.db.query.serviceHolds.findMany({
      where: (hold, { eq, and, lte, isNotNull, ne }) =>
        and(
          eq(hold.status, "active"),
          isNotNull(hold.expiryAt),
          lte(hold.expiryAt, now),
          /* Skip holds related to the specified ongoing session */
          sessionId ? ne(hold.relatedBookingId, sessionId) : undefined,
        ),
      limit: batchSize,
    });

    let releasedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    /* Process each hold in its own transaction for isolation */
    for (const hold of expiredHolds) {
      try {
        await this.db.transaction(async (tx) => {
          /* Double-check status and expiry in transaction to prevent race conditions */
          const [currentHold] = await tx
            .select()
            .from(schema.serviceHolds)
            .where(eq(schema.serviceHolds.id, hold.id))
            .limit(1);

          if (!currentHold || currentHold.status !== "active") {
            skippedCount++;
            return; // Skip if already released or cancelled
          }

          if (!currentHold.expiryAt || currentHold.expiryAt > now) {
            skippedCount++;
            return; // Skip if not yet expired
          }

          /* Release the hold with 'expired' reason */
          await tx
            .update(schema.serviceHolds)
            .set({
              status: "released",
              releaseReason: "expired",
              releasedAt: new Date(),
            })
            .where(eq(schema.serviceHolds.id, hold.id));

          releasedCount++;
        });
      } catch (error) {
        failedCount++;
        /* Log error but continue processing other holds */
        console.error(`Failed to release expired hold ${hold.id}:`, error);
      }
    }

    return { releasedCount, failedCount, skippedCount };
  }

  /**
   * Manual trigger for immediate expired hold cleanup (v2.16.10)
   * - Calls releaseExpiredHolds with specified batch size
   * - Useful for admin manual intervention or testing
   */
  async triggerExpiredHoldsRelease(batchSize = 100): Promise<{
    releasedCount: number;
    failedCount: number;
    skippedCount: number;
  }> {
    return await this.releaseExpiredHolds(batchSize);
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
