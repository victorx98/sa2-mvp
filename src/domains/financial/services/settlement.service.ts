import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { eq, and, sql } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type { DrizzleDatabase } from "@shared/types/database.types";
import type { ISettlementService } from "../interfaces/settlement.interface";
import type {
  CreateSettlementRequest,
  SettlementQuery,
  SettlementDetailResponse,
  SettlementResponse,
  SettlementDetailItem,
} from "../dto/settlement";
import { SettlementStatus } from "../dto/settlement/settlement.enums";
import { SETTLEMENT_CONFIRMED_EVENT } from "@shared/events/event-constants";
import type { ISettlementConfirmedPayload } from "@shared/events/settlement-confirmed.event";

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
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,
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
    request: CreateSettlementRequest,
    createdBy: string,
  ): Promise<SettlementDetailResponse> {
    try {
      const { mentorId, settlementMonth, exchangeRate, deductionRate } = request;

      this.logger.log(
        `Generating settlement for mentor: ${mentorId}, month: ${settlementMonth}`,
      );

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
        throw new BadRequestException(
          "Deduction rate must be between 0 and 1",
        );
      }

      // 2. Get mentor's active payment info (获取导师的有效支付信息)
      const paymentInfo = await this.db.query.mentorPaymentInfos.findFirst({
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

      // 3. Get unpaid payable ledgers for the mentor (获取导师的未付应付账款)
      // For now, we'll get all payable ledgers for the mentor
      // TODO: Add date range filtering based on settlementMonth when session dates are available
      const payableLedgers = await this.db.query.mentorPayableLedgers.findMany({
        where: and(
          eq(schema.mentorPayableLedgers.mentorId, mentorId),
          // eq(schema.mentorPayableLedgers.originalId, null), // Only original records
        ),
      });

      if (!payableLedgers || payableLedgers.length === 0) {
        throw new BadRequestException(
          `No payable ledgers found for mentor: ${mentorId}`,
        );
      }

      // 4. Calculate amounts (计算金额)
      // Sum up all original amounts
      const originalAmount = payableLedgers.reduce(
        (sum, ledger) => sum + Number(ledger.amount),
        0,
      );

      // Calculate target amount with exchange rate and deduction
      const amountAfterDeduction =
        originalAmount * (1 - Number(deductionRate));
      const targetAmount = amountAfterDeduction * Number(exchangeRate);

      this.logger.log(
        `Calculated settlement: originalAmount=${originalAmount.toFixed(2)}, ` +
          `targetAmount=${targetAmount.toFixed(2)}, exchangeRate=${exchangeRate}, ` +
          `deductionRate=${deductionRate}`,
      );

      // 5. Create settlement record (创建结算记录)
      // Note: Using append-only mode, status is always CONFIRMED
      const [settlement] = await this.db
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
        throw new Error("Failed to create settlement record");
      }

      // 6. Create settlement details (创建结算明细记录)
      const detailRecords = payableLedgers.map((ledger) => ({
        settlementId: settlement.id,
        mentorPayableId: ledger.id,
        createdBy,
      }));

      await this.db.insert(schema.settlementDetails).values(detailRecords);

      // 7. Publish settlement confirmed event (发布结算确认事件)
      // Note: Event should be published after settlement record and details are created
      // to ensure data integrity and enable parameter updates for subsequent batches
      // (注意：应在创建结算记录和明细后发布事件，以确保数据完整性并启用后续批次的参数更新)
      const payload: ISettlementConfirmedPayload = {
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

      this.eventEmitter.emit(SETTLEMENT_CONFIRMED_EVENT, {
        type: SETTLEMENT_CONFIRMED_EVENT,
        payload,
        timestamp: Date.now(),
        source: {
          domain: "financial",
          service: "SettlementService",
        },
      });

      this.logger.log(
        `Successfully created settlement: ${settlement.id} with ${detailRecords.length} detail records`,
      );

      // 8. Return settlement details (返回结算详情)
      return {
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
      };
    } catch (error) {
      this.logger.error(
        `Error generating settlement for mentor: ${request.mentorId}, month: ${request.settlementMonth}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
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
  ): Promise<SettlementDetailResponse | null> {
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
  ): Promise<SettlementDetailResponse | null> {
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
  public async findSettlements(query: SettlementQuery): Promise<{
    data: SettlementResponse[];
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

      if (startDate) {
        conditions.push(
          sql`${schema.settlementLedgers.createdAt} >= ${new Date(startDate)}`,
        );
      }

      if (endDate) {
        conditions.push(
          sql`${schema.settlementLedgers.createdAt} <= ${new Date(endDate)}`,
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

      const data: SettlementResponse[] = settlements.map((settlement) => ({
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
  ): Promise<SettlementDetailItem[]> {
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
