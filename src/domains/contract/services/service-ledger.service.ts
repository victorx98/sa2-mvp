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
   * Record service consumption(v2.16.12 - 学生级权益累积制)
   * - Quantity must be negative (consumption)(数量必须为负值(消耗))
   * - Create consumption ledger entry(创建消耗账本条目)
   * - Trigger automatically updates consumed_quantity(触发器自动更新已消耗数量)
   *
   * @change {v2.16.12} Now queries by studentId + serviceType (aggregates across contracts)
   */
  async recordConsumption(
    dto: IRecordConsumptionDto,
    tx?: DrizzleTransaction,
  ): Promise<ServiceLedger> {
    const { studentId, serviceType, quantity, relatedBookingId, createdBy } =
      dto;

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
        createdBy,
      })
      .returning();

    return ledger;
  }

  /**
   * Record manual adjustment(v2.16.12 - 学生级权益累积制)
   * - Quantity can be positive (add) or negative (deduct)(数量可以是正值(增加)或负值(扣除))
   * - Reason is required(必须提供原因)
   * - Create adjustment ledger entry(创建调整账本条目)
   *
   * @change {v2.16.12} Now queries by studentId + serviceType (aggregates across contracts)
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

    // 3. Create ledger record(3. 创建账本记录)
    const [ledger] = await executor
      .insert(schema.serviceLedgers)
      .values({
        studentId,
        serviceType: serviceType,
        quantity,
        type: "adjustment",
        source: "manual_adjustment",
        balanceAfter: totalAvailable + quantity,
        reason,
        createdBy,
      })
      .returning();

    return ledger;
  }

  /**
   * Calculate available balance(v2.16.12 - 学生级权益累积制)
   * - Sum from entitlements table across all contracts(从权利表汇总所有合同)
   * - Returns aggregated balance info(返回聚合余额信息)
   *
   * @change {v2.16.12} Now queries by studentId + serviceType (aggregates across contracts)
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
   * Query ledgers with optional archive(v2.16.12 - 学生级权益累积制)
   * - Default: query main table only(默认: 仅查询主表)
   * - includeArchive=true: UNION ALL with archive table(includeArchive=true: 与归档表使用UNION ALL)
   * - Archive queries enforce date range ≤ 1 year (Decision I5)(归档查询强制执行≤1年的日期范围[决策I5])
   *
   * @change {v2.16.12} Removed contractId filter, now primary query is studentId + serviceType
   */
  /**
   * Query ledgers [冷热数据分离已移除]
   * - Simplified to query only main table(简化为仅查询主表)
   * - Removed archive-related logic(移除了归档相关逻辑)
   *
   * @change {v2.16.12} Removed contractId filter, now primary query is studentId + serviceType
   * @change {v2.17.0} Removed includeArchive parameter and archive-related logic
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
   * Reconcile balance at student level (v2.16.12 - 学生级权益累积制)
   * - Verify consumed_quantity matches ledger sum across ALL contracts(验证所有合同的已消耗数量与账本总和匹配)
   * - Returns true if balanced(如果平衡则返回true)
   *
   * @change {v2.16.12} New method for student-level reconciliation
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

    const ledgerSum = ledgers.reduce((sum, l) => sum + l.quantity, 0);

    // 3. Compare (ledger sum is negative, so we take absolute value)
    return Math.abs(ledgerSum) === totalConsumed;
  }
}
