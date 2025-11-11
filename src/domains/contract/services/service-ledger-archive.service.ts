import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, lt, sql, SQL, inArray } from "drizzle-orm";
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
  ContractConflictException,
} from "../common/exceptions/contract.exception";
import {
  ARCHIVE_AFTER_DAYS,
  DELETE_AFTER_ARCHIVE,
  ARCHIVE_MAX_DATE_RANGE_DAYS,
} from "../common/constants/contract.constants";
import type {
  ServiceLedgerArchivePolicy,
  ServiceLedger,
} from "@infrastructure/database/schema";
import type { ServiceType } from "../common/types/enum.types";

/**
 * Service Ledger Archive Service(服务台账归档服务)
 * - Cold-hot data separation for service_ledgers table(服务台账表的冷热数据分离)
 * - Archives old ledgers to service_ledgers_archive table(将旧台账归档到服务台账归档表)
 * - Manages archive policies with priority: contract > service_type > global(管理归档策略，优先级：合同 > 服务类型 > 全局)
 * - Supports querying across both main and archive tables(支持跨主表和归档表查询)
 *
 * Design Decisions:(设计决策：)
 * - v2.16.9: Archive policies with priority-based resolution(基于优先级的归档策略)
 * - v2.16.9: Default archive period: 90 days(默认归档周期：90天)
 * - v2.16.9: Optional deletion after archiving (default: false)(归档后可选删除，默认：false)
 * - v2.16.9: Archive queries limited to 1-year date range(归档查询限制在1年日期范围内)
 */
@Injectable()
export class ServiceLedgerArchiveService {
  private readonly logger = new Logger(ServiceLedgerArchiveService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Archive old ledgers(归档旧台账)
   * - Move ledgers older than archive period to archive table(将超过归档期的台账转移到归档表)
   * - Optionally delete from main table after archiving(可选择归档后从主表删除)
   * - Uses policies to determine archive period(使用策略确定归档周期)
   * - Returns count of archived records(返回归档记录数量)
   *
   * Called by: Scheduled task daily at 2 AM(由每日凌晨2点的定时任务调用)
   */
  async archiveOldLedgers(): Promise<number> {
    this.logger.log("Starting ledger archiving task...");

    try {
      // 1. Get all active archive policies(获取所有活动的归档策略)
      const policies = await this.db
        .select()
        .from(schema.serviceLedgerArchivePolicies)
        .where(eq(schema.serviceLedgerArchivePolicies.enabled, true));

      if (policies.length === 0) {
        // Use global default if no policies configured(如果没有配置策略，使用全局默认值)
        return await this.archiveByGlobalDefault();
      }

      let totalArchived = 0;

      // 2. Process each policy(处理每个策略)
      for (const policy of policies) {
        const archived = await this.archiveByPolicy(policy);
        totalArchived += archived;
      }

      this.logger.log(`Archived ${totalArchived} ledger records`);
      return totalArchived;
    } catch (error) {
      this.logger.error(`Ledger archiving task failed: ${error}`);
      throw error;
    }
  }

  /**
   * Archive ledgers using global default policy(使用全局默认策略归档台账)
   */
  private async archiveByGlobalDefault(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AFTER_DAYS);

    return await this.archiveLedgers(
      null,
      null,
      cutoffDate,
      DELETE_AFTER_ARCHIVE,
    );
  }

  /**
   * Archive ledgers based on policy(基于策略归档台账)
   */
  private async archiveByPolicy(
    policy: ServiceLedgerArchivePolicy,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.archiveAfterDays);

    return await this.archiveLedgers(
      policy.contractId || null,
      policy.serviceType || null,
      cutoffDate,
      policy.deleteAfterArchive,
    );
  }

  /**
   * Archive ledgers matching criteria(归档符合条件的台账)
   */
  private async archiveLedgers(
    contractId: string | null,
    serviceType: string | null,
    cutoffDate: Date,
    deleteAfterArchive: boolean,
    tx?: DrizzleTransaction,
  ): Promise<number> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const conditions: SQL[] = [lt(schema.serviceLedgers.createdAt, cutoffDate)];

    if (contractId) {
      conditions.push(eq(schema.serviceLedgers.contractId, contractId));
    }
    if (serviceType) {
      const serviceTypeTyped = serviceType as ServiceType;
      conditions.push(
        eq(schema.serviceLedgers.serviceType, serviceTypeTyped),
      );
    }

    // 1. Select ledgers to archive(选择要归档的台账)
    const ledgersToArchive = await executor
      .select()
      .from(schema.serviceLedgers)
      .where(and(...conditions));

    if (ledgersToArchive.length === 0) {
      return 0;
    }

    // 2. Insert into archive table(插入到归档表)
    await executor
      .insert(schema.serviceLedgersArchive)
      .values(ledgersToArchive);

    // 3. Optionally delete from main table(可选择从主表删除)
    // NOTE: Using inArray instead of ANY syntax for better Drizzle ORM compatibility
    // (注意: 使用 inArray 而非 ANY 语法，以获得更好的 Drizzle ORM 兼容性)
    if (deleteAfterArchive) {
      const ledgerIds = ledgersToArchive.map((l) => l.id);
      await executor
        .delete(schema.serviceLedgers)
        .where(inArray(schema.serviceLedgers.id, ledgerIds));
    }

    this.logger.log(
      `Archived ${ledgersToArchive.length} ledgers (contractId=${contractId}, serviceType=${serviceType}, delete=${deleteAfterArchive})`,
    );

    return ledgersToArchive.length;
  }

  /**
   * Get archive policy for contract/service type(获取合同/服务类型的归档策略)
   * - Priority: contract > service_type > global(优先级：合同 > 服务类型 > 全局)
   * - Returns effective policy or null if using defaults(返回有效策略，如果使用默认值则返回null)
   */
  async getArchivePolicy(
    contractId?: string,
    serviceType?: string,
  ): Promise<ServiceLedgerArchivePolicy | null> {
    // 1. Try contract-specific policy(尝试合同特定策略)
    if (contractId) {
      const [contractPolicy] = await this.db
        .select()
        .from(schema.serviceLedgerArchivePolicies)
        .where(
          and(
            eq(schema.serviceLedgerArchivePolicies.contractId, contractId),
            eq(schema.serviceLedgerArchivePolicies.enabled, true),
          ),
        )
        .limit(1);

      if (contractPolicy) {
        return contractPolicy;
      }
    }

    // 2. Try service-type-specific policy(尝试服务类型特定策略)
    if (serviceType) {
      const serviceTypeTyped = serviceType as ServiceType;
      const [serviceTypePolicy] = await this.db
        .select()
        .from(schema.serviceLedgerArchivePolicies)
        .where(
          and(
            eq(
              schema.serviceLedgerArchivePolicies.serviceType,
              serviceTypeTyped,
            ),
            sql`${schema.serviceLedgerArchivePolicies.contractId} IS NULL`,
            eq(schema.serviceLedgerArchivePolicies.enabled, true),
          ),
        )
        .limit(1);

      if (serviceTypePolicy) {
        return serviceTypePolicy;
      }
    }

    // 3. Try global policy(尝试全局策略)
    const [globalPolicy] = await this.db
      .select()
      .from(schema.serviceLedgerArchivePolicies)
      .where(
        and(
          sql`${schema.serviceLedgerArchivePolicies.contractId} IS NULL`,
          sql`${schema.serviceLedgerArchivePolicies.serviceType} IS NULL`,
          eq(schema.serviceLedgerArchivePolicies.enabled, true),
        ),
      )
      .limit(1);

    return globalPolicy || null;
  }

  /**
   * Create archive policy(创建归档策略)
   * - Scope: global (both null), service_type (contractId=null), or contract-specific(范围：全局(都为null)、服务类型(contractId=null)或合同特定)
   * - Validates no duplicate policy exists for same scope(验证相同范围不存在重复策略)
   */
  async createPolicy(
    dto: {
      contractId?: string;
      serviceType?: string;
      archiveAfterDays: number;
      deleteAfterArchive: boolean;
      createdBy: string;
    },
    tx?: DrizzleTransaction,
  ): Promise<ServiceLedgerArchivePolicy> {
    const {
      contractId,
      serviceType,
      archiveAfterDays,
      deleteAfterArchive,
      createdBy,
    } = dto;

    // 1. Validate archiveAfterDays(验证归档天数)
    if (archiveAfterDays < 1) {
      throw new ContractException("ARCHIVE_AFTER_DAYS_TOO_SMALL");
    }

    // 2. Check for duplicate policy(检查重复策略)
    const conditions: SQL[] = [
      eq(schema.serviceLedgerArchivePolicies.enabled, true),
    ];

    if (contractId) {
      conditions.push(
        eq(schema.serviceLedgerArchivePolicies.contractId, contractId),
      );
    } else {
      conditions.push(
        sql`${schema.serviceLedgerArchivePolicies.contractId} IS NULL`,
      );
    }

    if (serviceType) {
      const serviceTypeTyped = serviceType as ServiceType;
      conditions.push(
        eq(schema.serviceLedgerArchivePolicies.serviceType, serviceTypeTyped),
      );
    } else {
      conditions.push(
        sql`${schema.serviceLedgerArchivePolicies.serviceType} IS NULL`,
      );
    }

    const executor: DrizzleExecutor = tx ?? this.db;

    const existingPolicies = await executor
      .select()
      .from(schema.serviceLedgerArchivePolicies)
      .where(and(...conditions));

    if (existingPolicies.length > 0) {
      throw new ContractConflictException("ARCHIVE_POLICY_ALREADY_EXISTS");
    }

    // 3. Determine scope(确定范围)
    let scope: "global" | "contract" | "service_type" = "global";
    if (contractId) {
      scope = "contract";
    } else if (serviceType) {
      scope = "service_type";
    }

    // 4. Create policy(创建策略)
    const [newPolicy] = await executor
      .insert(schema.serviceLedgerArchivePolicies)
      .values({
        scope,
        contractId: contractId || null,
        serviceType: (serviceType as ServiceType | null) || null,
        archiveAfterDays,
        deleteAfterArchive,
        enabled: true,
        createdBy: createdBy || null,
      })
      .returning();

    this.logger.log(
      `Created archive policy: ${newPolicy.id} (contractId=${contractId}, serviceType=${serviceType})`,
    );

    return newPolicy;
  }

  /**
   * Update archive policy(更新归档策略)
   * - Can update archiveAfterDays, deleteAfterArchive, isActive(可以更新归档天数、归档后删除、是否激活)
   */
  async updatePolicy(
    id: string,
    updates: {
      archiveAfterDays?: number;
      deleteAfterArchive?: boolean;
      isActive?: boolean;
    },
    tx?: DrizzleTransaction,
  ): Promise<ServiceLedgerArchivePolicy> {
    // 1. Find policy(查找策略)
    const executor: DrizzleExecutor = tx ?? this.db;

    const [policy] = await executor
      .select()
      .from(schema.serviceLedgerArchivePolicies)
      .where(eq(schema.serviceLedgerArchivePolicies.id, id))
      .limit(1);

    if (!policy) {
      throw new ContractNotFoundException("ARCHIVE_POLICY_NOT_FOUND");
    }

    // 2. Validate updates(验证更新)
    if (
      updates.archiveAfterDays !== undefined &&
      updates.archiveAfterDays < 1
    ) {
      throw new ContractException("ARCHIVE_AFTER_DAYS_TOO_SMALL");
    }

    // 3. Update policy(更新策略)
    const [updatedPolicy] = await executor
      .update(schema.serviceLedgerArchivePolicies)
      .set(updates)
      .where(eq(schema.serviceLedgerArchivePolicies.id, id))
      .returning();

    this.logger.log(`Updated archive policy: ${id}`);

    return updatedPolicy;
  }

  /**
   * Query ledgers with archive support(支持归档的台账查询)
   * - Queries both main and archive tables(查询主表和归档表)
   * - Requires date range filter (max 1 year)(需要日期范围过滤器，最大1年)
   * - Returns combined results ordered by createdAt(返回按创建时间排序的合并结果)
   */
  async queryWithArchive(filter: {
    contractId?: string;
    studentId?: string;
    serviceType?: string;
    startDate: Date;
    endDate: Date;
    limit?: number;
  }): Promise<ServiceLedger[]> {
    const {
      contractId,
      studentId,
      serviceType,
      startDate,
      endDate,
      limit = 100,
    } = filter;

    // 1. Validate date range(验证日期范围)
    const daysDiff = Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDiff > ARCHIVE_MAX_DATE_RANGE_DAYS) {
      throw new ContractException("ARCHIVE_DATE_RANGE_TOO_LARGE");
    }

    // 2. Build conditions(构建条件)
    const conditions: SQL[] = [
      sql`created_at >= ${startDate}`,
      sql`created_at <= ${endDate}`,
    ];

    if (contractId) {
      conditions.push(sql`contract_id = ${contractId}`);
    }
    if (studentId) {
      conditions.push(sql`student_id = ${studentId}`);
    }
    if (serviceType) {
      conditions.push(sql`service_type = ${serviceType}`);
    }

    // 3. Query both tables with UNION ALL(使用UNION ALL查询两个表)
    const query = sql`
      (
        SELECT * FROM service_ledgers
        WHERE ${sql.join(conditions, sql` AND `)}
      )
      UNION ALL
      (
        SELECT * FROM service_ledgers_archive
        WHERE ${sql.join(conditions, sql` AND `)}
      )
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    const result = await this.db.execute(query);
    return result.rows as unknown as ServiceLedger[];
  }
}
