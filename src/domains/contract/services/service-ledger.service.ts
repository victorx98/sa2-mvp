import { Inject, Injectable } from "@nestjs/common";
import { eq, and, gte, lte, sql, SQL } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type {
  DrizzleDatabase,
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";
import {
  ContractException,
  ContractNotFoundException,
} from "../common/exceptions/contract.exception";
import { validateLedgerQuantity } from "../common/utils/validation.utils";
import type { ServiceLedger } from "@infrastructure/database/schema";
import type {
  IRecordConsumptionDto,
  IRecordAdjustmentDto,
  IBalanceInfo,
} from "../interfaces/service-ledger.interface";

@Injectable()
export class ServiceLedgerService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Record service consumption
   * - Quantity must be negative (consumption)(数量必须为负值(消耗))
   * - Create consumption ledger entry(创建消耗账本条目)
   * - Trigger automatically updates consumed_quantity(触发器自动更新已消耗数量)
   */
  async recordConsumption(
    dto: IRecordConsumptionDto,
    tx?: DrizzleTransaction,
  ): Promise<ServiceLedger> {
    const {
      studentId,
      serviceType,
      quantity,
      relatedBookingId,
      bookingSource,
      createdBy,
    } = dto;

    // Validate: bookingSource is required when relatedBookingId is provided [验证：当relatedBookingId存在时，bookingSource必填]
    if (relatedBookingId && !bookingSource) {
      throw new ContractException(
        "BOOKING_SOURCE_REQUIRED",
        "bookingSource is required when relatedBookingId is provided",
      );
    }

    // 1. Validate quantity (must be negative for consumption)(1. 验证数量(必须为负值表示消耗))
    validateLedgerQuantity("consumption", -quantity);

    // 2. Find entitlements for student and service type (aggregated across contracts)(2. 查找学生的服务类型权益(跨合同聚合))
    const executor: DrizzleExecutor = tx ?? this.db;

    const entitlements = await executor
      .select()
      .from(schema.contractServiceEntitlements)
      .where(
        and(
          eq(schema.contractServiceEntitlements.studentId, studentId),
          eq(schema.contractServiceEntitlements.serviceType, serviceType),
        ),
      );

    if (entitlements.length === 0) {
      throw new ContractNotFoundException("NO_ENTITLEMENTS_FOUND");
    }

    const totalAvailable = entitlements.reduce(
      (sum, e) => sum + e.availableQuantity,
      0,
    );

    // Check sufficient balance(检查足够余额)
    // Note: quantity is positive here (consumption amount), will be stored as negative in ledger [注意：quantity这里是正数（消费数量），将在账本中存储为负数]
    if (totalAvailable < quantity) {
      throw new ContractException("INSUFFICIENT_BALANCE");
    }

    // 3. Create ledger record (trigger will update consumed_quantity)(3. 创建账本记录(触发器将更新已消耗数量))
    const [ledger] = await executor
      .insert(schema.serviceLedgers)
      .values({
        studentId,
        serviceType: serviceType,
        quantity: -quantity, // Negative for consumption(负值表示消耗)
        type: "consumption",
        source: "booking_completed",
        balanceAfter: totalAvailable - quantity,
        relatedBookingId,
        metadata:
          relatedBookingId && bookingSource ? { bookingSource } : undefined, // Store bookingSource in metadata when relatedBookingId exists [当relatedBookingId存在时，在metadata中存储bookingSource]
        createdBy,
      })
      .returning();

    return ledger;
  }

  /**
   * Record manual adjustment
   * - Quantity can be positive (add) or negative (deduct)(数量可以是正值(增加)或负值(扣除))
   * - Reason is required(必须提供原因)
   * - Create adjustment ledger entry(创建调整账本条目)
   */
  async recordAdjustment(
    dto: IRecordAdjustmentDto,
    tx?: DrizzleTransaction,
  ): Promise<ServiceLedger> {
    const { studentId, serviceType, quantity, reason, createdBy } = dto;

    // 1. Validate reason(1. 验证原因)
    if (!reason || reason.trim().length === 0) {
      throw new ContractException("LEDGER_ADJUSTMENT_REQUIRES_REASON");
    }

    // 2. Find entitlements for student and service type (aggregated across contracts)(2. 查找学生的服务类型权益(跨合同聚合))
    const executor: DrizzleExecutor = tx ?? this.db;

    const entitlements = await executor
      .select()
      .from(schema.contractServiceEntitlements)
      .where(
        and(
          eq(schema.contractServiceEntitlements.studentId, studentId),
          eq(schema.contractServiceEntitlements.serviceType, serviceType),
        ),
      );

    if (entitlements.length === 0) {
      throw new ContractNotFoundException("NO_ENTITLEMENTS_FOUND");
    }

    const totalAvailable = entitlements.reduce(
      (sum, e) => sum + e.availableQuantity,
      0,
    );

    // Calculate balance after adjustment [计算调整后的余额]
    const balanceAfter = totalAvailable + quantity;

    // Check balance lower limit (prevent negative balance) [检查余额下限（防止余额为负）]
    if (balanceAfter < 0) {
      throw new ContractException(
        "INSUFFICIENT_BALANCE_FOR_ADJUSTMENT",
        `Adjustment would result in negative balance. Current: ${totalAvailable}, Adjustment: ${quantity}, Result: ${balanceAfter}`,
      );
    }

    // 3. Create ledger record(3. 创建账本记录)
    const [ledger] = await executor
      .insert(schema.serviceLedgers)
      .values({
        studentId,
        serviceType: serviceType,
        quantity,
        type: "adjustment",
        source: "manual_adjustment",
        balanceAfter,
        reason,
        createdBy,
      })
      .returning();

    return ledger;
  }

  /**
   * Calculate available balance
   * - Sum from entitlements table across all contracts(从权利表汇总所有合同)
   * - Returns aggregated balance info(返回聚合余额信息)
   */
  async calculateAvailableBalance(
    studentId: string,
    serviceType: string,
  ): Promise<IBalanceInfo> {
    const entitlements = await this.db
      .select()
      .from(schema.contractServiceEntitlements)
      .where(
        and(
          eq(schema.contractServiceEntitlements.studentId, studentId),
          eq(schema.contractServiceEntitlements.serviceType, serviceType),
        ),
      );

    if (entitlements.length === 0) {
      throw new ContractNotFoundException("NO_ENTITLEMENTS_FOUND");
    }

    // Aggregate balance info(聚合余额信息)
    const balanceInfo: IBalanceInfo = {
      totalQuantity: 0,
      consumedQuantity: 0,
      heldQuantity: 0,
      availableQuantity: 0,
    };

    for (const e of entitlements) {
      balanceInfo.totalQuantity += e.totalQuantity;
      balanceInfo.consumedQuantity += e.consumedQuantity;
      balanceInfo.heldQuantity += e.heldQuantity;
      balanceInfo.availableQuantity += e.availableQuantity;
    }

    return balanceInfo;
  }

  /**
   * Query ledgers
   * - Query main table only(仅查询主表)
   */
  async queryLedgers(
    filter: {
      studentId?: string;
      serviceType?: string;
      startDate?: Date;
      endDate?: Date;
    },
    options?: { limit?: number; offset?: number },
  ): Promise<ServiceLedger[]> {
    const { studentId, serviceType, startDate, endDate } = filter;
    const { limit = 50, offset = 0 } = options || {};

    // Validate at least one filter criteria
    if (!studentId && !serviceType) {
      throw new ContractException(
        "INVALID_QUERY",
        "At least one of studentId or serviceType is required",
      );
    }

    // Build WHERE conditions(构建WHERE条件)
    const conditions: SQL[] = [];
    if (studentId) {
      conditions.push(eq(schema.serviceLedgers.studentId, studentId));
    }
    if (serviceType) {
      conditions.push(eq(schema.serviceLedgers.serviceType, serviceType));
    }
    if (startDate) {
      conditions.push(gte(schema.serviceLedgers.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.serviceLedgers.createdAt, endDate));
    }

    // Query main table only(仅查询主表)
    const result = await this.db
      .select()
      .from(schema.serviceLedgers)
      .where(and(...conditions))
      .orderBy(sql`${schema.serviceLedgers.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    return result;
  }

  /**
   * Reconcile balance at student level
   * - Verify consumed_quantity matches ledger sum across ALL contracts(验证所有合同的已消耗数量与账本总和匹配)
   * - Returns true if balanced(如果平衡则返回true)
   */
  async reconcileBalance(
    studentId: string,
    serviceType: string,
  ): Promise<boolean> {
    // 1. Get total consumed_quantity across all contracts for student and service type
    const entitlements = await this.db
      .select()
      .from(schema.contractServiceEntitlements)
      .where(
        and(
          eq(schema.contractServiceEntitlements.studentId, studentId),
          eq(schema.contractServiceEntitlements.serviceType, serviceType),
        ),
      );

    if (entitlements.length === 0) {
      throw new ContractNotFoundException("NO_ENTITLEMENTS_FOUND");
    }

    const totalConsumed = entitlements.reduce(
      (sum, e) => sum + e.consumedQuantity,
      0,
    );

    // 2. Sum ledger quantities across all contracts for student and service type
    const ledgers = await this.db
      .select()
      .from(schema.serviceLedgers)
      .where(
        and(
          eq(schema.serviceLedgers.studentId, studentId),
          eq(schema.serviceLedgers.serviceType, serviceType),
        ),
      );

    // Calculate consumption and adjustment sums separately [分别计算消费和调整的总和]
    // Consumption quantities are negative, adjustments can be positive or negative [消费数量为负数，调整可以是正数或负数]
    let consumptionSum = 0;
    let adjustmentSum = 0;

    for (const ledger of ledgers) {
      if (ledger.type === "consumption") {
        consumptionSum += ledger.quantity; // Negative values [负值]
      } else if (ledger.type === "adjustment") {
        adjustmentSum += ledger.quantity; // Can be positive or negative [可以是正数或负数]
      }
    }

    // Compare: consumed_quantity should equal absolute value of consumption sum [比较：consumed_quantity应等于消费总和的绝对值]
    // Note: Adjustment sum is not included in consumed_quantity [注意：调整总和不包括在consumed_quantity中]
    return Math.abs(consumptionSum) === totalConsumed;
  }
}
