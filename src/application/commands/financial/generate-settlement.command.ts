import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import type { ICreateSettlementRequest } from "@api/dto/request/financial/settlement.request.dto";
import type { ISettlementDetailResponse } from "@api/dto/response/financial/settlement.response.dto";
import { SettlementStatus } from "@api/dto/request/financial/settlement.request.dto";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@infrastructure/database/schema";
import { IntegrationEventPublisher, SettlementConfirmedEvent, type SettlementConfirmedPayload } from "@application/events";

/**
 * Generate Settlement Command (Application Layer)
 * [生成结算命令]
 *
 * Orchestrates settlement generation use case
 * [编排结算生成用例]
 */
@Injectable()
export class GenerateSettlementCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly eventPublisher: IntegrationEventPublisher,
  ) {
    super(db);
  }

  /**
   * Execute generate settlement use case
   * [执行生成结算用例]
   *
   * @param input - Generate settlement input
   * @returns Settlement detail response
   */
  async execute(input: {
    request: ICreateSettlementRequest;
    createdBy: string;
  }): Promise<ISettlementDetailResponse> {
    const { mentorId, settlementMonth, exchangeRate, deductionRate } = input.request;

    this.logger.log(
      `Generating settlement for mentor: ${mentorId}, month: ${settlementMonth}`,
    );

    return await this.db.transaction(async (tx) => {
      // 1. Validate input parameters
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

      // 2. Get mentor's active payment info
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

      // 3. Check for existing settlement for this mentor/month
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

      // 4. Atomically claim unpaid payable ledgers with SELECT FOR UPDATE SKIP LOCKED
      const [year, month] = settlementMonth.split("-").map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

      // Use raw SQL with FOR UPDATE SKIP LOCKED to prevent concurrent settlement
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

      // 5. Calculate amounts using integer arithmetic to avoid floating-point precision issues
      // Convert to cents (convert to integer) for accurate calculation, then convert back to dollars
      // First calculate rounded detail amounts, then sum for header

      // Calculate each detail's target amount with rounding
      const detailCalculations = payableLedgers.map((ledger) => {
        // Convert to cents to avoid floating-point precision issues
        const originalAmtCents = Math.round(Number(ledger.amount) * 100);
        const exchangeRateNum = Number(exchangeRate);
        const deductionRateNum = Number(deductionRate);

        // Calculate in cents (in integer)
        const targetAmtCents = Math.round(
          originalAmtCents *
            (1 - deductionRateNum) *
            exchangeRateNum
        );

        return {
          ...ledger,
          originalAmount: originalAmtCents / 100, // Convert back to dollars
          targetAmount: targetAmtCents / 100, // Convert back to dollars
        };
      });

      // Sum original and target amounts from rounded details
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

      // 6. Create settlement record
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
          createdBy: input.createdBy,
        })
        .returning();

      if (!settlement) {
        throw new BadRequestException("Failed to create settlement record: Create returned no result");
      }

      // 7. Create settlement details
      // Use pre-calculated rounded amounts to ensure consistency with header
      const detailRecords = detailCalculations.map((item) => ({
        settlementId: settlement.id,
        mentorPayableId: item.id,
        originalAmount: String(item.originalAmount),
        targetAmount: String(item.targetAmount),
        exchangeRate: String(exchangeRate),
        deductionRate: String(deductionRate),
        createdBy: input.createdBy,
      }));

      await tx.insert(schema.settlementDetails).values(detailRecords);

      // 8. Update all participating ledger records (mark as settled)
      const ledgerIds = payableLedgers.map((ledger) => ledger.id);
      await tx
        .update(schema.mentorPayableLedgers)
        .set({
          settlementId: settlement.id,
          settledAt: new Date(),
        })
        .where(inArray(schema.mentorPayableLedgers.id, ledgerIds));

      // 9. Publish settlement confirmed event
      // Note: Event should be published after settlement record and details are created
      // to ensure data integrity and enable parameter updates for subsequent batches
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
        GenerateSettlementCommand.name,
      );

      this.logger.log(
        `Successfully created settlement: ${settlement.id} with ${detailRecords.length} detail records`,
      );

      // 10. Return settlement details
      return {
        id: settlement.id,
        mentorId: settlement.mentorId,
        settlementMonth: settlement.settlementMonth,
        originalAmount: settlement.originalAmount,
        targetAmount: settlement.targetAmount,
        originalCurrency: settlement.originalCurrency,
        targetCurrency: settlement.targetCurrency,
        exchangeRate: settlement.exchangeRate,
        deductionRate: settlement.deductionRate,
        status: SettlementStatus.CONFIRMED,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        settlementMethod: settlement.settlementMethod as any,
        createdAt: settlement.createdAt.toISOString(),
        createdBy: settlement.createdBy,
      };
    });
  }
}
