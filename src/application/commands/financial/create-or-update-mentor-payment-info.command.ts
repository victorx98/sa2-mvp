import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import * as schema from "@infrastructure/database/schema";
import { SettlementMethod } from "@api/dto/request/financial/settlement.request.dto";
import type { ICreateOrUpdateMentorPaymentInfoRequest } from "@api/dto/request/financial/mentor-payment-info.request.dto";
import type { IMentorPaymentInfoResponse } from "@api/dto/response/financial/settlement.response.dto";

/**
 * Create Or Update Mentor Payment Info Command (Application Layer)
 * [创建或更新导师支付信息命令]
 *
 * Orchestrates mentor payment info creation or update use case
 * [编排导师支付信息创建或更新用例]
 */
@Injectable()
export class CreateOrUpdateMentorPaymentInfoCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
  ) {
    super(db);
  }

  /**
   * Execute create or update mentor payment info use case
   * [执行创建或更新导师支付信息用例]
   *
   * @param input - Create or update mentor payment info input
   * @returns Mentor payment info response
   */
  async execute(
    input: ICreateOrUpdateMentorPaymentInfoRequest,
  ): Promise<IMentorPaymentInfoResponse> {
    try {
      this.logger.debug(
        `Creating/updating payment info for mentor: ${input.mentorId}`,
      );

      const { mentorId, paymentCurrency, paymentMethod, paymentDetails } =
        input;

      // 1. Validate request
      if (!mentorId || !paymentCurrency || !paymentMethod) {
        throw new BadRequestException(
          "Mentor ID, payment currency, and payment method are required",
        );
      }

      if (!paymentDetails || Object.keys(paymentDetails).length === 0) {
        throw new BadRequestException("Payment details are required");
      }

      this.logger.log(
        `Creating/updating payment info for mentor: ${mentorId}, method: ${paymentMethod}`,
      );

      // 2. Check for existing payment info
      const existingPaymentInfo =
        await this.db.query.mentorPaymentInfos.findFirst({
          where: eq(schema.mentorPaymentInfos.mentorId, mentorId),
        });

      let result;

      if (existingPaymentInfo) {
        // Update existing record
        this.logger.log(
          `Updating existing payment info: ${existingPaymentInfo.id}`,
        );

        const [updated] = await this.db
          .update(schema.mentorPaymentInfos)
          .set({
            paymentCurrency,
            paymentMethod,
            paymentDetails,
            status: "ACTIVE",
            updatedAt: new Date(),
            updatedBy: mentorId, // Assume mentor updates their own info
          })
          .where(eq(schema.mentorPaymentInfos.id, existingPaymentInfo.id))
          .returning();

        if (!updated) {
          throw new BadRequestException("Failed to update payment info: Update returned no result");
        }

        result = updated;
      } else {
        // Create new record
        this.logger.log(`Creating new payment info for mentor: ${mentorId}`);

        const [created] = await this.db
          .insert(schema.mentorPaymentInfos)
          .values({
            mentorId,
            paymentCurrency,
            paymentMethod,
            paymentDetails,
            status: "ACTIVE",
            createdBy: mentorId,
            updatedBy: mentorId,
          })
          .returning();

        if (!created) {
          throw new BadRequestException("Failed to create payment info: Create returned no result");
        }

        result = created;
      }

      this.logger.debug(
        `Payment info created/updated successfully: ${result.id}`,
      );

      return {
        id: result.id,
        mentorId: result.mentorId,
        paymentCurrency: result.paymentCurrency,
        paymentMethod: result.paymentMethod as SettlementMethod,
        paymentDetails: result.paymentDetails as unknown as IMentorPaymentInfoResponse['paymentDetails'],
        status: result.status,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create/update mentor payment info: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

