import { Inject, Injectable } from "@nestjs/common";
import { eq, and, gte, lte, sql } from "drizzle-orm";
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
import type { ServiceType } from "../common/types/enum.types";

@Injectable()
export class ServiceLedgerService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Record service consumption(记录服务消耗)
   * - Quantity must be negative (consumption)(数量必须为负值(消耗))
   * - Create consumption ledger entry(创建消耗账本条目)
   * - Trigger automatically updates consumed_quantity(触发器自动更新已消耗数量)
   */
  async recordConsumption(
    dto: IRecordConsumptionDto,
    tx?: DrizzleTransaction,
  ): Promise<ServiceLedger> {
    const {
      contractId,
      studentId,
      serviceType,
      quantity,
      relatedBookingId,
      createdBy,
    } = dto;

    // 1. Validate quantity (must be negative for consumption)(1. 验证数量(必须为负值表示消耗))
    validateLedgerQuantity("consumption", -quantity);

    // 2. Find entitlement to get current balance(2. 查找权利以获得当前余额)
    const executor: DrizzleExecutor = tx ?? this.db;

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
      );

    if (entitlements.length === 0) {
      throw new ContractNotFoundException("ENTITLEMENT_NOT_FOUND");
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
        contractId,
        studentId,
        serviceType: serviceType as ServiceType,
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
   * Record manual adjustment(记录手动调整)
   * - Quantity can be positive (add) or negative (deduct)(数量可以是正值(增加)或负值(扣除))
   * - Reason is required(必须提供原因)
   * - Create adjustment ledger entry(创建调整账本条目)
   */
  async recordAdjustment(
    dto: IRecordAdjustmentDto,
    tx?: DrizzleTransaction,
  ): Promise<ServiceLedger> {
    const { contractId, studentId, serviceType, quantity, reason, createdBy } =
      dto;

    // 1. Validate reason(1. 验证原因)
    if (!reason || reason.trim().length === 0) {
      throw new ContractException("LEDGER_ADJUSTMENT_REQUIRES_REASON");
    }

    // 2. Find entitlement(2. 查找权利)
    const executor: DrizzleExecutor = tx ?? this.db;

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
      );

    if (entitlements.length === 0) {
      throw new ContractNotFoundException("ENTITLEMENT_NOT_FOUND");
    }

    const totalAvailable = entitlements.reduce(
      (sum, e) => sum + e.availableQuantity,
      0,
    );

    // 3. Create ledger record(3. 创建账本记录)
    const [ledger] = await executor
      .insert(schema.serviceLedgers)
      .values({
        contractId,
        studentId,
        serviceType: serviceType as ServiceType,
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
   * Calculate available balance(计算可用余额)
   * - Sum from entitlements table(从权利表汇总)
   * - Returns balance info(返回余额信息)
   */
  async calculateAvailableBalance(
    contractId: string,
    serviceType: string,
  ): Promise<IBalanceInfo> {
    const entitlements = await this.db
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
      );

    if (entitlements.length === 0) {
      throw new ContractNotFoundException("ENTITLEMENT_NOT_FOUND");
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
   * Query ledgers with optional archive(查询账本[可选包含归档])
   * - Default: query main table only(默认: 仅查询主表)
   * - includeArchive=true: UNION ALL with archive table(includeArchive=true: 与归档表使用UNION ALL)
   * - Archive queries enforce date range ≤ 1 year (Decision I5)(归档查询强制执行≤1年的日期范围[决策I5])
   */
  async queryLedgers(
    filter: {
      contractId?: string;
      studentId?: string;
      serviceType?: string;
      startDate?: Date;
      endDate?: Date;
    },
    options?: { includeArchive?: boolean; limit?: number; offset?: number },
  ): Promise<ServiceLedger[]> {
    const { contractId, studentId, serviceType } = filter;
    let { startDate, endDate } = filter;
    const { includeArchive = false, limit = 50, offset = 0 } = options || {};

    // Validate date range for archive queries (Decision I5)(验证归档查询的日期范围[决策I5])
    if (includeArchive) {
      // Require date range when querying archive(查询归档时需要日期范围)
      if (!startDate && !endDate) {
        throw new ContractException("ARCHIVE_QUERY_REQUIRES_DATE_RANGE");
      }

      // Auto-complete missing boundary (set to 1 year range)(自动补全缺失的边界[设置为1年范围])
      const now = new Date();

      if (!startDate && endDate) {
        // Only endDate provided: set startDate to 1 year before endDate(仅提供结束日期: 将开始日期设置为结束日期前1年)
        startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
      } else if (startDate && !endDate) {
        // Only startDate provided: set endDate to 1 year after startDate (max: now)(仅提供开始日期: 将结束日期设置为开始日期后1年 [最大: 当前时间])
        const oneYearAfterStart = new Date(
          startDate.getTime() + 365 * 24 * 60 * 60 * 1000,
        );
        endDate = oneYearAfterStart < now ? oneYearAfterStart : now;
      }

      // Validate range does not exceed 1 year(验证范围不超过1年)
      if (startDate && endDate) {
        const daysDiff =
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 365) {
          throw new ContractException("ARCHIVE_DATE_RANGE_TOO_LARGE");
        }
        if (daysDiff < 0) {
          throw new ContractException(
            "INVALID_QUERY",
            "startDate must be before endDate",
          );
        }
      }
    }

    // Build WHERE conditions(构建WHERE条件)
    const conditions: any[] = [];
    if (contractId) {
      conditions.push(eq(schema.serviceLedgers.contractId, contractId));
    }
    if (studentId) {
      conditions.push(eq(schema.serviceLedgers.studentId, studentId));
    }
    if (serviceType) {
      conditions.push(
        eq(schema.serviceLedgers.serviceType, serviceType as ServiceType),
      );
    }
    if (startDate) {
      conditions.push(gte(schema.serviceLedgers.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.serviceLedgers.createdAt, endDate));
    }

    // Query main table(查询主表)
    const query = this.db
      .select()
      .from(schema.serviceLedgers)
      .where(and(...conditions))
      .orderBy(sql`${schema.serviceLedgers.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    // If includeArchive is false, just query main table(如果includeArchive为false, 仅查询主表)
    if (!includeArchive) {
      return await query;
    }

    // includeArchive = true: Use UNION ALL to query both main and archive tables(includeArchive = true: 使用UNION ALL查询主表和归档表)
    // Build SQL conditions for UNION ALL query(为UNION ALL查询构建SQL条件)
    const sqlConditions: any[] = [];
    if (contractId) {
      sqlConditions.push(sql`contract_id = ${contractId}`);
    }
    if (studentId) {
      sqlConditions.push(sql`student_id = ${studentId}`);
    }
    if (serviceType) {
      sqlConditions.push(sql`service_type = ${serviceType}`);
    }
    if (startDate) {
      sqlConditions.push(sql`created_at >= ${startDate}`);
    }
    if (endDate) {
      sqlConditions.push(sql`created_at <= ${endDate}`);
    }

    // If no conditions, use a default condition (always true)(如果没有条件, 使用默认条件[始终为真])
    const whereClause =
      sqlConditions.length > 0 ? sql.join(sqlConditions, sql` AND `) : sql`1=1`;

    // UNION ALL query combining main and archive tables(结合主表和归档表的UNION ALL查询)
    const unionQuery = sql`
      (
        SELECT * FROM service_ledgers
        WHERE ${whereClause}
      )
      UNION ALL
      (
        SELECT * FROM service_ledgers_archive
        WHERE ${whereClause}
      )
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const result = await this.db.execute(unionQuery);
    return result.rows as ServiceLedger[];
  }

  /**
   * Reconcile balance(对账余额)
   * - Verify consumed_quantity matches ledger sum(验证已消耗数量与账本总和匹配)
   * - Returns true if balanced(如果平衡则返回true)
   */
  async reconcileBalance(
    contractId: string,
    serviceType: string,
  ): Promise<boolean> {
    // 1. Get entitlement consumed_quantity(1. 获取权利已消耗数量)
    const entitlements = await this.db
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
      );

    if (entitlements.length === 0) {
      throw new ContractNotFoundException("ENTITLEMENT_NOT_FOUND");
    }

    const totalConsumed = entitlements.reduce(
      (sum, e) => sum + e.consumedQuantity,
      0,
    );

    // 2. Sum ledger quantities(2. 汇总账本数量)
    const ledgers = await this.db
      .select()
      .from(schema.serviceLedgers)
      .where(
        and(
          eq(schema.serviceLedgers.contractId, contractId),
          eq(schema.serviceLedgers.serviceType, serviceType as ServiceType),
        ),
      );

    const ledgerSum = ledgers.reduce((sum, l) => sum + l.quantity, 0);

    // 3. Compare (ledger sum is negative, so we take absolute value)(3. 比较[账本总和为负值, 因此我们取绝对值])
    return Math.abs(ledgerSum) === totalConsumed;
  }
}
