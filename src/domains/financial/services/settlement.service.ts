import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { eq, and, sql, inArray } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { SettlementStatus } from "@shared/types/financial-enums";
import type { CreateSettlementRequestDto } from "@api/dto/request/financial/settlement.request.dto";
import { IntegrationEventPublisher, SettlementConfirmedEvent, type SettlementConfirmedPayload } from "@application/events";
import {
  parseDateToUTC,
  isValidISODateString,
} from "../common/utils/date-time.utils";

/**
 * Internal interfaces for settlement operations (结算操作的内部接口)
 */
interface ISettlementQuery {
  mentorId?: string;
  settlementMonth?: string;
  startDate?: string;
  endDate?: string;
  status?: SettlementStatus;
  page?: number;
  pageSize?: number;
}

interface ISettlementDetailItem {
  id?: string;
  settlementId?: string;
  mentorPayableId?: string;
  sessionId?: string;
  studentId?: string;
  sessionDate?: string;
  serviceType?: string;
  mentorPrice?: string;
  originalAmount?: string;
  targetAmount?: string;
  createdAt?: Date;
  createdBy?: string;
}

interface ISettlementDetailResponse {
  id: string;
  mentorId: string;
  mentorName: string;
  settlementMonth: string;
  originalAmount: number;
  targetAmount: number;
  originalCurrency: string;
  targetCurrency: string;
  exchangeRate: number;
  deductionRate: number;
  status: SettlementStatus;
  settlementMethod: string;
  createdAt: Date;
  createdBy: string;
  details: ISettlementDetailItem[];
}

interface ISettlementResponse {
  id: string;
  mentorId: string;
  settlementMonth: string;
  originalAmount: number;
  targetAmount: number;
  originalCurrency: string;
  targetCurrency: string;
  exchangeRate: number;
  deductionRate: number;
  status: SettlementStatus;
  settlementMethod: string;
  createdAt: Date;
  createdBy: string;
}

interface ISettlementService {
  generateSettlement(request: CreateSettlementRequestDto, createdBy: string): Promise<ISettlementDetailResponse>;
  getSettlementById(id: string): Promise<ISettlementDetailResponse | null>;
  getSettlementByMentorAndMonth(mentorId: string, settlementMonth: string): Promise<ISettlementDetailResponse | null>;
  findSettlements(query: ISettlementQuery): Promise<{ data: ISettlementResponse[]; total: number }>;
  getSettlementDetails(settlementId: string): Promise<ISettlementDetailItem[]>;
}

/**
 * Settlement Service Implementation (结算服务实现)
 *
 * Implementation of settlement-related business logic.
 * Handles settlement generation, queries, and calculations.
 * Uses append-only mode for data integrity.
 *
 * 结算相关业务逻辑的实现。
 * 处理结算生成、查询和计算。
 * 使用append-only模式确保数据完整性。
 */
@Injectable()
export class SettlementService implements ISettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly eventPublisher: IntegrationEventPublisher,
  ) {}

  /**
   * Generate settlement bill (生成结算账单)
   *
   * Creates a settlement record for a mentor based on unpaid payable ledgers for the specified month.
   * Calculates amounts based on exchange rate and deduction rate.
   * Creates settlement detail records linking to payable ledgers.
   * Settlement record is created in CONFIRMED status immediately (append-only mode).
   *
   * 根据指定月份导师的未付应付账款记录创建结算记录。
   * 根据汇率和扣除比率计算金额。
   * 创建链接到应付账款的结算明细记录。
   * 结算记录创建后立即进入CONFIRMED状态(append-only模式)。
   *
   * @param request - Settlement request parameters (结算请求参数)
   * @param createdBy - Creator user ID (创建人用户ID)
   * @returns Settlement record details (结算记录详情)
   */
  public async generateSettlement(
    request: CreateSettlementRequestDto,
    createdBy: string,
  ): Promise<ISettlementDetailResponse> {
    const { mentorId, settlementMonth, exchangeRate, deductionRate } = request;

    this.logger.log(
      `Generating settlement for mentor: ${mentorId}, month: ${settlementMonth}`,
    );

    return await this.db.transaction(async (tx) => {
      // 1. Validate input parameters (验证输入参数)
      if (!mentorId || !settlementMonth) {
        throw new BadRequestException(
          "Mentor ID and settlement month are required",
        );
      }

      // Validate settlement month format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(settlementMonth)) {
        throw new BadRequestException(
          "Settlement month must be in YYYY-MM format",
        );
      }

      if (exchangeRate <= 0) {
        throw new BadRequestException("Exchange rate must be greater than 0");
      }

      if (deductionRate < 0 || deductionRate > 1) {
        throw new BadRequestException("Deduction rate must be between 0 and 1");
      }

      // 2. Get mentor's active payment info (获取导师的有效支付信息)
      const paymentInfo = await tx.query.mentorPaymentInfos.findFirst({
        where: and(
          eq(schema.mentorPaymentInfos.mentorId, mentorId),
          eq(schema.mentorPaymentInfos.status, "ACTIVE"),
        ),
      });

      if (!paymentInfo) {
        throw new BadRequestException(
          `No active payment information found for mentor: ${mentorId}`,
        );
      }

      // 3. [修复] Check for existing settlement for this mentor/month (查询是否已存在该导师/月份的结算)
      // Prevents duplicate settlements before attempting to claim ledgers [在尝试抢占账本前防止重复结算]
      const existingSettlement = await tx.query.settlementLedgers.findFirst({
        where: and(
          eq(schema.settlementLedgers.mentorId, mentorId),
          eq(schema.settlementLedgers.settlementMonth, settlementMonth),
        ),
      });

      if (existingSettlement) {
        throw new BadRequestException(
          `Settlement already exists for mentor ${mentorId} in month ${settlementMonth}. Settlement ID: ${existingSettlement.id}`,
        );
      }

      // 4. [修复] Atomically claim unpaid payable ledgers with SELECT FOR UPDATE SKIP LOCKED
      // 使用SELECT FOR UPDATE SKIP LOCKED防止并发结算问题
      const [year, month] = settlementMonth.split("-").map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

      // Use raw SQL with FOR UPDATE SKIP LOCKED to prevent concurrent settlement
      // 使用原生SQL和FOR UPDATE SKIP LOCKED锁定记录，防止并发结算
      const payableLedgersResult = await tx.execute(sql`
        SELECT * FROM mentor_payable_ledgers
        WHERE mentor_id = ${mentorId}
          AND settlement_id IS NULL
          AND created_at >= ${startOfMonth}
          AND created_at <= ${endOfMonth}
          AND (original_id IS NULL OR original_id IS NOT NULL)
        FOR UPDATE SKIP LOCKED
      `);

      const payableLedgers =
        payableLedgersResult.rows as (typeof schema.mentorPayableLedgers.$inferSelect)[];

      if (!payableLedgers || payableLedgers.length === 0) {
        throw new BadRequestException(
          `No unpaid payable ledgers found for mentor: ${mentorId}`,
        );
      }

      // 4. [修复] Calculate amounts using integer arithmetic to avoid floating-point precision issues (使用整数运算避免浮点数精度问题)
      // Convert to cents (convert to integer) for accurate calculation, then convert back to dollars (转换为分(整数)进行精确计算，然后再转换回元)
      // First calculate rounded detail amounts, then sum for header (先计算四舍五入的明细金额，再求和得到头金额)
      // This ensures header total matches sum of detail totals (这确保头总额与明细总额之和匹配)

      // Calculate each detail's target amount with rounding [计算每个明细的目标金额并四舍五入]
      const detailCalculations = payableLedgers.map((ledger) => {
        // Convert to cents to avoid floating-point precision issues (转换为分以避免浮点数精度问题)
        const originalAmtCents = Math.round(Number(ledger.amount) * 100);
        const exchangeRateNum = Number(exchangeRate);
        const deductionRateNum = Number(deductionRate);

        // Calculate in cents (in integer) (以分为单位进行计算(整数))
        const targetAmtCents = Math.round(
          originalAmtCents *
            (1 - deductionRateNum) *
            exchangeRateNum
        );

        return {
          ...ledger,
          originalAmount: originalAmtCents / 100, // Convert back to dollars (转换回元)
          targetAmount: targetAmtCents / 100, // Convert back to dollars (转换回元)
        };
      });

      // Sum original and target amounts from rounded details [从四舍五入的明细中求和原始和目标金额]
      const originalAmount = detailCalculations.reduce(
        (sum, item) => sum + item.originalAmount,
        0,
      );
      const targetAmount = detailCalculations.reduce(
        (sum, item) => sum + item.targetAmount,
        0,
      );

      this.logger.log(
        `Calculated settlement: originalAmount=${originalAmount.toFixed(2)}, ` +
          `targetAmount=${targetAmount.toFixed(2)}, exchangeRate=${exchangeRate}, ` +
          `deductionRate=${deductionRate}`,
      );

      // 5. Create settlement record (创建结算记录)
      // Note: Using append-only mode, status is always CONFIRMED
      const [settlement] = await tx
        .insert(schema.settlementLedgers)
        .values({
          mentorId,
          settlementMonth,
          originalAmount: String(originalAmount.toFixed(2)),
          targetAmount: String(targetAmount.toFixed(2)),
          originalCurrency: payableLedgers[0].currency || "USD",
          targetCurrency: paymentInfo.paymentCurrency,
          exchangeRate: String(exchangeRate),
          deductionRate: String(deductionRate),
          settlementMethod: paymentInfo.paymentMethod,
          mentorPaymentInfoId: paymentInfo.id,
          createdBy,
        })
        .returning();

      if (!settlement) {
        throw new BadRequestException("Failed to create settlement record: Create returned no result");
      }

      // 6. Create settlement details (创建结算明细记录)
      // [修复] Use pre-calculated rounded amounts to ensure consistency with header [使用预计算的四舍五入金额确保与头一致性]
      const detailRecords = detailCalculations.map((item) => ({
        settlementId: settlement.id,
        mentorPayableId: item.id,
        originalAmount: String(item.originalAmount),
        targetAmount: String(item.targetAmount),
        exchangeRate: String(exchangeRate),
        deductionRate: String(deductionRate),
        createdBy,
      }));

      await tx.insert(schema.settlementDetails).values(detailRecords);

      // 7. [新增] 更新所有参与结算的账款记录（标记为已结算）
      const ledgerIds = payableLedgers.map((ledger) => ledger.id);
      await tx
        .update(schema.mentorPayableLedgers)
        .set({
          settlementId: settlement.id,
          settledAt: new Date(),
        })
        .where(inArray(schema.mentorPayableLedgers.id, ledgerIds));

      // 8. Publish settlement confirmed event (发布结算确认事件)
      // Note: Event should be published after settlement record and details are created
      // to ensure data integrity and enable parameter updates for subsequent batches
      // (注意：应在创建结算记录和明细后发布事件，以确保数据完整性并启用后续批次的参数更新)
      const payload: SettlementConfirmedPayload = {
        settlementId: settlement.id,
        mentorId: settlement.mentorId,
        settlementMonth: settlement.settlementMonth,
        originalAmount: Number(settlement.originalAmount),
        targetAmount: Number(settlement.targetAmount),
        originalCurrency: settlement.originalCurrency,
        targetCurrency: settlement.targetCurrency,
        exchangeRate: Number(settlement.exchangeRate),
        deductionRate: Number(settlement.deductionRate),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        settlementMethod: settlement.settlementMethod as any,
        createdBy: settlement.createdBy,
        createdAt: settlement.createdAt,
        payableLedgerIds: payableLedgers.map((ledger) => ledger.id),
      };

      await this.eventPublisher.publish(
        new SettlementConfirmedEvent(payload),
        SettlementService.name,
      );

      this.logger.log(
        `Successfully created settlement: ${settlement.id} with ${detailRecords.length} detail records`,
      );

      // 9. Return settlement details (返回结算详情)
      return {
        id: settlement.id,
        mentorId: settlement.mentorId,
        mentorName: '', // Will be populated in higher layers
        settlementMonth: settlement.settlementMonth,
        originalAmount: Number(settlement.originalAmount),
        targetAmount: Number(settlement.targetAmount),
        originalCurrency: settlement.originalCurrency,
        targetCurrency: settlement.targetCurrency,
        exchangeRate: Number(settlement.exchangeRate),
        deductionRate: Number(deductionRate),
        status: SettlementStatus.CONFIRMED,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        settlementMethod: settlement.settlementMethod as any,
        createdAt: settlement.createdAt,
        createdBy: settlement.createdBy,
        details: [], // Will be populated in getSettlementDetails or higher layers
      };
    });
  }

  /**
   * Get settlement by ID (根据ID获取结算记录)
   *
   * Retrieves a settlement record by its unique identifier.
   * Returns null if not found.
   *
   * 通过唯一标识符检索结算记录。如果未找到返回null。
   *
   * @param id - Settlement ID (结算ID)
   * @returns Settlement record details or null (结算记录详情，或null)
   */
  public async getSettlementById(
    id: string,
  ): Promise<ISettlementDetailResponse | null> {
    try {
      const settlement = await this.db.query.settlementLedgers.findFirst({
        where: eq(schema.settlementLedgers.id, id),
      });

      if (!settlement) {
        this.logger.warn(`Settlement not found: ${id}`);
        return null;
      }

      return {
        id: settlement.id,
        mentorId: settlement.mentorId,
        mentorName: '', // Will be populated in higher layers
        settlementMonth: settlement.settlementMonth,
        originalAmount: Number(settlement.originalAmount),
        targetAmount: Number(settlement.targetAmount),
        originalCurrency: settlement.originalCurrency,
        targetCurrency: settlement.targetCurrency,
        exchangeRate: Number(settlement.exchangeRate),
        deductionRate: Number(settlement.deductionRate),
        status: SettlementStatus.CONFIRMED,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        settlementMethod: settlement.settlementMethod as any,
        createdAt: settlement.createdAt,
        createdBy: settlement.createdBy,
        details: [], // Will be populated in higher layers
      };
    } catch (error) {
      this.logger.error(
        `Error getting settlement by ID: ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get settlement by mentor and month (根据导师ID和月份获取结算记录)
   *
   * Retrieves a settlement record for a specific mentor and month.
   *
   * 检索特定导师和月份的结算记录。
   *
   * @param mentorId - Mentor ID (导师ID)
   * @param settlementMonth - Settlement month in YYYY-MM format [结算月份 (格式YYYY-MM)]
   * @returns Settlement record details or null (结算记录详情，或null)
   */
  public async getSettlementByMentorAndMonth(
    mentorId: string,
    settlementMonth: string,
  ): Promise<ISettlementDetailResponse | null> {
    try {
      const settlement = await this.db.query.settlementLedgers.findFirst({
        where: and(
          eq(schema.settlementLedgers.mentorId, mentorId),
          eq(schema.settlementLedgers.settlementMonth, settlementMonth),
        ),
      });

      if (!settlement) {
        this.logger.warn(
          `Settlement not found for mentor: ${mentorId}, month: ${settlementMonth}`,
        );
        return null;
      }

      return {
        id: settlement.id,
        mentorId: settlement.mentorId,
        mentorName: '', // Will be populated in higher layers
        settlementMonth: settlement.settlementMonth,
        originalAmount: Number(settlement.originalAmount),
        targetAmount: Number(settlement.targetAmount),
        originalCurrency: settlement.originalCurrency,
        targetCurrency: settlement.targetCurrency,
        exchangeRate: Number(settlement.exchangeRate),
        deductionRate: Number(settlement.deductionRate),
        status: SettlementStatus.CONFIRMED,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        settlementMethod: settlement.settlementMethod as any,
        createdAt: settlement.createdAt,
        createdBy: settlement.createdBy,
        details: [], // Will be populated in higher layers
      };
    } catch (error) {
      this.logger.error(
        `Error getting settlement by mentor and month: mentor=${mentorId}, month=${settlementMonth}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Find settlements with pagination (分页查询结算记录)
   *
   * Queries settlement records based on provided filters.
   *
   * 根据提供的筛选器查询结算记录。
   *
   * @param query - Query parameters including filters and pagination [查询参数，包括筛选器和分页]
   * @returns Paginated settlement records [分页的结算记录]
   */
  public async findSettlements(query: ISettlementQuery): Promise<{
    data: ISettlementResponse[];
    total: number;
  }> {
    try {
      const { mentorId, settlementMonth, startDate, endDate, page, pageSize } =
        query;

      // Build where conditions (构建查询条件)
      const conditions = [];

      if (mentorId) {
        conditions.push(eq(schema.settlementLedgers.mentorId, mentorId));
      }

      if (settlementMonth) {
        conditions.push(
          eq(schema.settlementLedgers.settlementMonth, settlementMonth),
        );
      }

      // [修复] Validate and convert dates to UTC (验证并转换日期为UTC)
      if (startDate) {
        if (!isValidISODateString(startDate)) {
          throw new BadRequestException(
            "Invalid startDate format. Expected ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)",
          );
        }
        const startUTC = parseDateToUTC(startDate);
        conditions.push(
          sql`${schema.settlementLedgers.createdAt} >= ${startUTC}`,
        );
      }

      if (endDate) {
        if (!isValidISODateString(endDate)) {
          throw new BadRequestException(
            "Invalid endDate format. Expected ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)",
          );
        }
        const endUTC = parseDateToUTC(endDate);
        conditions.push(
          sql`${schema.settlementLedgers.createdAt} <= ${endUTC}`,
        );
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count (获取总数)
      const countResult = await this.db
        .select({ count: sql`count(*)` })
        .from(schema.settlementLedgers)
        .where(whereClause);

      const total = Number(countResult[0]?.count || 0);

      // Get paginated data (获取分页数据)
      const settlements = await this.db.query.settlementLedgers.findMany({
        where: whereClause,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      const data: ISettlementResponse[] = settlements.map((settlement) => ({
        id: settlement.id,
        mentorId: settlement.mentorId,
        settlementMonth: settlement.settlementMonth,
        originalAmount: Number(settlement.originalAmount),
        targetAmount: Number(settlement.targetAmount),
        originalCurrency: settlement.originalCurrency,
        targetCurrency: settlement.targetCurrency,
        exchangeRate: Number(settlement.exchangeRate),
        deductionRate: Number(settlement.deductionRate),
        status: SettlementStatus.CONFIRMED,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        settlementMethod: settlement.settlementMethod as any,
        createdAt: settlement.createdAt,
        createdBy: settlement.createdBy,
      }));

      this.logger.log(
        `Found ${total} settlements, returning page ${page} with ${data.length} records`,
      );

      return { data, total };
    } catch (error) {
      this.logger.error(
        `Error finding settlements`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get settlement details (获取结算明细列表)
   *
   * Retrieves all settlement detail records for a specific settlement.
   *
   * 检索特定结算的所有结算明细记录。
   *
   * @param settlementId - Settlement record ID (结算记录ID)
   * @returns Array of settlement detail records (结算明细记录数组)
   */
  public async getSettlementDetails(
    settlementId: string,
  ): Promise<ISettlementDetailItem[]> {
    try {
      const details = await this.db.query.settlementDetails.findMany({
        where: eq(schema.settlementDetails.settlementId, settlementId),
      });

      this.logger.log(
        `Found ${details.length} detail records for settlement: ${settlementId}`,
      );

      return details.map((detail) => ({
        id: detail.id,
        settlementId: detail.settlementId,
        mentorPayableId: detail.mentorPayableId,
        createdAt: detail.createdAt,
        createdBy: detail.createdBy,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting settlement details for settlement: ${settlementId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
