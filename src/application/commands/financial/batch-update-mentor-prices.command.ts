import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { UpdateMentorPriceDto } from "@api/dto/request/financial/mentor-price.request.dto";
import {
  validateMentorPrice,
  validateCurrency,
  validateStatus,
} from "@domains/financial/common/utils/validation.utils";
import {
  FinancialException,
  FinancialNotFoundException,
} from "@domains/financial/common/exceptions/financial.exception";
import * as schema from "@infrastructure/database/schema";
import type { MentorPrice } from "@infrastructure/database/schema";

/**
 * Batch Update Mentor Prices Command (Application Layer)
 * [批量更新导师价格命令]
 *
 * Orchestrates batch mentor price update use case
 * [编排批量导师价格更新用例]
 */
@Injectable()
export class BatchUpdateMentorPricesCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
  ) {
    super(db);
  }

  /**
   * Execute batch update mentor prices use case
   * [执行批量更新导师价格用例]
   *
   * @param input - Batch update mentor prices input
   * @returns Array of updated mentor price records
   */
  async execute(input: {
    updates: Array<{ id: string; dto: UpdateMentorPriceDto }>;
    updatedBy?: string;
  }): Promise<MentorPrice[]> {
    try {
      this.logger.debug(
        `Batch updating ${input.updates.length} mentor prices`,
      );

      if (!input.updates || input.updates.length === 0) {
        return [];
      }

      // Validate all update DTOs first
      for (const update of input.updates) {
        const { dto } = update;
        if (dto.price !== undefined) {
          validateMentorPrice(dto.price);
        }
        if (dto.currency) {
          validateCurrency(dto.currency);
        }
        if (dto.status) {
          validateStatus(dto.status);
        }
      }

      // Use transaction to ensure atomicity
      const updatedPrices = await this.db.transaction(async (tx) => {
        const results: MentorPrice[] = [];

        for (const update of input.updates) {
          const { id, dto } = update;

          // Check if mentor price exists
          const existingPrice = await tx.query.mentorPrices.findFirst({
            where: eq(schema.mentorPrices.id, id),
          });

          if (!existingPrice) {
            throw new FinancialNotFoundException(
              "MENTOR_PRICE_NOT_FOUND",
              `Mentor price not found: ${id}`,
            );
          }

          // Update the mentor price
          const [updatedPrice] = await tx
            .update(schema.mentorPrices)
            .set({
              price:
                dto.price !== undefined
                  ? String(dto.price)
                  : existingPrice.price,
              currency: dto.currency ?? existingPrice.currency,
              status: dto.status ?? existingPrice.status,
              packageCode: dto.packageCode ?? existingPrice.packageCode,
              updatedBy: input.updatedBy,
              updatedAt: new Date(),
            })
            .where(eq(schema.mentorPrices.id, id))
            .returning();

          results.push(updatedPrice);
        }

        return results;
      });

      this.logger.log(`Bulk updated ${updatedPrices.length} mentor prices`);
      this.logger.debug(
        `Batch updated ${updatedPrices.length} mentor prices successfully`,
      );
      return updatedPrices;
    } catch (error) {
      if (error instanceof FinancialException) {
        throw error;
      }
      this.logger.error(
        `Failed to batch update mentor prices: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new FinancialException(
        "BULK_OPERATION_FAILED",
        error instanceof Error
          ? error.message
          : "Failed to bulk update mentor prices",
      );
    }
  }
}

