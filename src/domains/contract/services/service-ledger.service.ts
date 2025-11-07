import { Inject, Injectable } from "@nestjs/common";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { DrizzleDatabase } from "@shared/types/database.types";
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
   * Record service consumption
   * - Quantity must be negative (consumption)
   * - Create consumption ledger entry
   * - Trigger automatically updates consumed_quantity
   */
  async recordConsumption(dto: IRecordConsumptionDto): Promise<ServiceLedger> {
    const {
      contractId,
      studentId,
      serviceType,
      quantity,
      sessionId,
      createdBy,
    } = dto;

    // 1. Validate quantity (must be negative for consumption)
    validateLedgerQuantity("consumption", -quantity);

    // 2. Find entitlement to get current balance
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

    const totalAvailable = entitlements.reduce(
      (sum, e) => sum + e.availableQuantity,
      0,
    );

    // Check sufficient balance
    if (totalAvailable < quantity) {
      throw new ContractException("INSUFFICIENT_BALANCE");
    }

    // 3. Create ledger record (trigger will update consumed_quantity)
    const [ledger] = await this.db
      .insert(schema.serviceLedgers)
      .values({
        contractId,
        studentId,
        serviceType: serviceType as ServiceType,
        quantity: -quantity, // Negative for consumption
        type: "consumption",
        source: "booking_completed",
        balanceAfter: totalAvailable - quantity,
        relatedBookingId: sessionId,
        createdBy,
      })
      .returning();

    return ledger;
  }

  /**
   * Record manual adjustment
   * - Quantity can be positive (add) or negative (deduct)
   * - Reason is required
   * - Create adjustment ledger entry
   */
  async recordAdjustment(dto: IRecordAdjustmentDto): Promise<ServiceLedger> {
    const { contractId, studentId, serviceType, quantity, reason, createdBy } =
      dto;

    // 1. Validate reason
    if (!reason || reason.trim().length === 0) {
      throw new ContractException("LEDGER_ADJUSTMENT_REQUIRES_REASON");
    }

    // 2. Find entitlement
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

    const totalAvailable = entitlements.reduce(
      (sum, e) => sum + e.availableQuantity,
      0,
    );

    // 3. Create ledger record
    const [ledger] = await this.db
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
   * Calculate available balance
   * - Sum from entitlements table
   * - Returns balance info
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

    // Aggregate balance info
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
   * Query ledgers with optional archive
   * - Default: query main table only
   * - includeArchive=true: UNION ALL with archive table
   * - Archive queries enforce date range ≤ 1 year (Decision I5)
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

    // Validate date range for archive queries (Decision I5)
    if (includeArchive) {
      // Require date range when querying archive
      if (!startDate && !endDate) {
        throw new ContractException("ARCHIVE_QUERY_REQUIRES_DATE_RANGE");
      }

      // Auto-complete missing boundary (set to 1 year range)
      const now = new Date();

      if (!startDate && endDate) {
        // Only endDate provided: set startDate to 1 year before endDate
        startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
      } else if (startDate && !endDate) {
        // Only startDate provided: set endDate to 1 year after startDate (max: now)
        const oneYearAfterStart = new Date(
          startDate.getTime() + 365 * 24 * 60 * 60 * 1000,
        );
        endDate = oneYearAfterStart < now ? oneYearAfterStart : now;
      }

      // Validate range does not exceed 1 year
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

    // Build WHERE conditions
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

    // Query main table
    const query = this.db
      .select()
      .from(schema.serviceLedgers)
      .where(and(...conditions))
      .orderBy(sql`${schema.serviceLedgers.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    // If includeArchive is false, just query main table
    if (!includeArchive) {
      return await query;
    }

    // includeArchive = true: Use UNION ALL to query both main and archive tables
    // Build SQL conditions for UNION ALL query
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

    // If no conditions, use a default condition (always true)
    const whereClause =
      sqlConditions.length > 0 ? sql.join(sqlConditions, sql` AND `) : sql`1=1`;

    // UNION ALL query combining main and archive tables
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
   * Reconcile balance
   * - Verify consumed_quantity matches ledger sum
   * - Returns true if balanced
   */
  async reconcileBalance(
    contractId: string,
    serviceType: string,
  ): Promise<boolean> {
    // 1. Get entitlement consumed_quantity
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

    // 2. Sum ledger quantities
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

    // 3. Compare (ledger sum is negative, so we take absolute value)
    return Math.abs(ledgerSum) === totalConsumed;
  }
}
