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
import { calculateHoldExpirationDate } from "../common/utils/date.utils";
import type { ServiceHold } from "@infrastructure/database/schema";
import type { ServiceType } from "../common/types/enum.types";

@Injectable()
export class ServiceHoldService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Create hold (v2.16.7: supports optional transaction parameter)
   * - Check available balance
   * - Create hold record with TTL
   * - Trigger automatically updates held_quantity
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

    // 1. Find entitlement and check balance (with pessimistic lock)
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

    // Sum available quantity across all entitlements
    const totalAvailable = entitlements.reduce(
      (sum, e) => sum + e.availableQuantity,
      0,
    );

    if (totalAvailable < quantity) {
      throw new ContractException("INSUFFICIENT_BALANCE");
    }

    // 2. Calculate expiration time
    const expiresAt = calculateHoldExpirationDate();

    // 3. Create hold (trigger will update held_quantity automatically)
    const [newHold] = await executor
      .insert(schema.serviceHolds)
      .values({
        contractId,
        studentId,
        serviceType: serviceType as ServiceType,
        quantity,
        status: "active",
        expiresAt,
        relatedBookingId,
        createdBy,
      })
      .returning();

    return newHold;
  }

  /**
   * Release hold
   * - Update status to released
   * - Trigger automatically updates held_quantity
   */
  async releaseHold(
    id: string,
    reason: string,
    tx?: DrizzleTransaction,
  ): Promise<ServiceHold> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // 1. Find hold
    const [hold] = await executor
      .select()
      .from(schema.serviceHolds)
      .where(eq(schema.serviceHolds.id, id))
      .limit(1);

    if (!hold) {
      throw new ContractNotFoundException("HOLD_NOT_FOUND");
    }

    // 2. Validate status
    if (hold.status !== "active") {
      throw new ContractException("HOLD_NOT_ACTIVE");
    }

    // 3. Release hold (trigger will update held_quantity automatically)
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
   * Expire holds (cleanup task)
   * - Find active holds with expires_at < now
   * - Update status to expired
   * - Trigger automatically updates held_quantity
   * - Returns count of expired holds
   */
  async expireHolds(tx?: DrizzleTransaction): Promise<number> {
    const now = new Date();
    const executor: DrizzleExecutor = tx ?? this.db;

    const expiredHolds = await executor
      .update(schema.serviceHolds)
      .set({
        status: "expired",
        releaseReason: "expired",
        releasedAt: now,
      })
      .where(
        and(
          eq(schema.serviceHolds.status, "active"),
          lt(schema.serviceHolds.expiresAt, now),
        ),
      )
      .returning();

    return expiredHolds.length;
  }

  /**
   * Get active holds for contract and service type
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
   * Cancel hold
   * - Similar to release but with 'cancelled' reason
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
