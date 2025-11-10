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
      relatedBookingId,
      createdBy,
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
    /* v2.16.9: No expiration time - holds never expire(v2.16.9: 无过期时间 - 预占永不失效) */
    const [newHold] = await executor
      .insert(schema.serviceHolds)
      .values({
        contractId,
        studentId,
        serviceType: serviceType as ServiceType,
        quantity,
        status: "active",
        relatedBookingId,
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
}