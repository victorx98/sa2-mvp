import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { AdjustPayableLedgerRequestDto } from "@api/dto/request/financial/payable-ledger.request.dto";
import { sql } from "drizzle-orm";
import * as schema from "@infrastructure/database/schema";

/**
 * Adjust Payable Ledger Command (Application Layer)
 * [调整应付账款命令]
 *
 * Orchestrates payable ledger adjustment use case
 * [编排应付账款调整用例]
 */
@Injectable()
export class AdjustPayableLedgerCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
  ) {
    super(db);
  }

  /**
   * Execute adjust payable ledger use case
   * [执行调整应付账款用例]
   *
   * @param dto - Adjust payable ledger DTO [调整应付账款的DTO]
   * @param createdBy - User ID who performed the adjustment [执行调整的用户ID]
   */
  async execute(
    dto: AdjustPayableLedgerRequestDto,
    createdBy: string,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Adjusting payable ledger: ${dto.ledgerId}, amount: ${dto.adjustmentAmount}`,
      );

      const { ledgerId: originalLedgerId, adjustmentAmount, reason } = dto;

      this.logger.log(`Adjusting payable ledger: ${originalLedgerId}`);

      try {
        // Use transaction to ensure atomicity and prevent race conditions
        await this.db.transaction(async (tx) => {
          // Use SELECT FOR UPDATE to lock the original ledger and prevent concurrent modifications
          const result = await tx.execute(sql`
            SELECT * FROM mentor_payable_ledgers
            WHERE id = ${originalLedgerId}
            FOR UPDATE
          `);

          const originalLedger = result.rows[0] as
            | (typeof schema.mentorPayableLedgers.$inferSelect)
            | undefined;

          if (!originalLedger) {
            throw new BadRequestException(
              `Original ledger not found: ${originalLedgerId}`,
            );
          }

          // Check if the ledger is already settled
          if (originalLedger.settlementId) {
            throw new BadRequestException(
              "Cannot adjust a settled ledger. Please create a new compensation record.",
            );
          }

          // Create adjustment record
          await tx.insert(schema.mentorPayableLedgers).values({
            referenceId: originalLedger.referenceId,
            mentorId: originalLedger.mentorId,
            studentId: originalLedger.studentId,
            sessionTypeCode: originalLedger.sessionTypeCode,
            price: originalLedger.price,
            amount: String(adjustmentAmount), // Convert to string to match numeric type
            currency: originalLedger.currency,
            originalId: originalLedgerId,
            adjustmentReason: reason,
            createdBy,
          });
        });

        this.logger.debug(
          `Payable ledger adjusted successfully: ${dto.ledgerId}`,
        );
      } catch (error) {
        this.logger.error(
          `Error adjusting payable ledger: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Failed to adjust payable ledger: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

