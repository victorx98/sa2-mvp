import { Inject, Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import * as schema from "@infrastructure/database/schema";
import { SettlementMethod } from "@api/dto/request/financial/settlement.request.dto";
import type { IMentorPaymentInfoResponse } from "@api/dto/response/financial/settlement.response.dto";

/**
 * Update Mentor Payment Info Status Command (Application Layer)
 * [更新导师支付信息状态命令]
 *
 * Orchestrates mentor payment info status update use case
 * [编排导师支付信息状态更新用例]
 */
@Injectable()
export class UpdateMentorPaymentInfoStatusCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
  ) {
    super(db);
  }

  /**
   * Execute update mentor payment info status use case
   * [执行更新导师支付信息状态用例]
   *
   * @param input - Update mentor payment info status input
   * @returns Updated mentor payment info response
   */
  async execute(input: {
    id: string;
    status: "ACTIVE" | "INACTIVE";
    updatedBy: string;
  }): Promise<IMentorPaymentInfoResponse> {
    try {
      this.logger.debug(
        `Updating payment info status: ${input.id} -> ${input.status}`,
      );

      if (!input.id) {
        throw new BadRequestException("Payment info ID is required");
      }

      if (!["ACTIVE", "INACTIVE"].includes(input.status)) {
        throw new BadRequestException(
          "Status must be either ACTIVE or INACTIVE",
        );
      }

      this.logger.log(`Updating payment info status: ${input.id} -> ${input.status}`);

      const [updated] = await this.db
        .update(schema.mentorPaymentInfos)
        .set({
          status: input.status,
          updatedAt: new Date(),
          updatedBy: input.updatedBy,
        })
        .where(eq(schema.mentorPaymentInfos.id, input.id))
        .returning();

      if (!updated) {
        throw new NotFoundException(`Payment info not found: ${input.id}`);
      }

      this.logger.log(`Successfully updated payment info status: ${input.id}`);
      this.logger.debug(
        `Payment info status updated successfully: ${input.id}`,
      );

      return {
        id: updated.id,
        mentorId: updated.mentorId,
        paymentCurrency: updated.paymentCurrency,
        paymentMethod: updated.paymentMethod as SettlementMethod,
        paymentDetails: updated.paymentDetails as unknown as IMentorPaymentInfoResponse['paymentDetails'],
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to update mentor payment info status: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

