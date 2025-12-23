import { Inject, Injectable, BadRequestException, NotFoundException, ForbiddenException } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { IMentorAppeal } from "@domains/financial/interfaces/mentor-appeal.interface";
import { eq } from "drizzle-orm";
import * as schema from "@infrastructure/database/schema";
import { IntegrationEventPublisher, MentorAppealApprovedEvent } from "@application/events";

/**
 * Approve Mentor Appeal Command
 * [批准导师申诉命令]
 *
 * 用于批准导师提交的申诉请求
 */
@Injectable()
export class ApproveMentorAppealCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly eventPublisher: IntegrationEventPublisher,
  ) {
    super(db);
  }

  /**
   * 执行命令
   * [Execute command]
   *
   * @param input 命令输入
   * @returns 执行结果
   */
  async execute(input: {
    id: string;
    approvedBy: string;
    appealAmount?: number;
    currency?: string;
    comments?: string;
  }): Promise<IMentorAppeal> {
    this.logger.log(`Approving appeal: ${input.id} by user: ${input.approvedBy}`);

    try {
      // Find the appeal
      const appeal = await this.db.query.mentorAppeals.findFirst({
        where: eq(schema.mentorAppeals.id, input.id),
      });

      if (!appeal) {
        throw new NotFoundException(`Appeal not found: ${input.id}`);
      }

      // Verify status is PENDING
      if (appeal.status !== "PENDING") {
        throw new BadRequestException(
          `Cannot approve appeal with status: ${appeal.status}. Only PENDING appeals can be approved.`,
        );
      }

      // Verify the approver matches the assigned counselor
      if (appeal.counselorId !== input.approvedBy) {
        throw new ForbiddenException(
          "Only the assigned counselor can approve this appeal",
        );
      }

      // Check if original appeal amount is valid
      const isOriginalAmountValid = appeal.appealAmount && parseFloat(appeal.appealAmount) !== 0;
      let finalAppealAmount = appeal.appealAmount;
      let finalCurrency = appeal.currency;

      // If original amount is invalid, use provided values
      if (!isOriginalAmountValid) {
        // Validate that appealAmount and currency are provided
        if (input.appealAmount === undefined) {
          throw new BadRequestException(
            "appealAmount is required when original appeal amount is invalid",
          );
        }
        if (!input.currency) {
          throw new BadRequestException(
            "currency is required when original appeal amount is invalid",
          );
        }

        // Validate currency format (ISO 4217: 3 letters)
        if (!/^[A-Z]{3}$/.test(input.currency)) {
          throw new BadRequestException(
            "currency must be a valid ISO 4217 3-letter code",
          );
        }

        // Convert number to string for database storage
        finalAppealAmount = input.appealAmount.toString();
        finalCurrency = input.currency;
      }

      // Update status to APPROVED
      const now = new Date();
      const [updatedAppeal] = await this.db
        .update(schema.mentorAppeals)
        .set({
          status: "APPROVED",
          approvedBy: input.approvedBy,
          approvedAt: now,
          appealAmount: finalAppealAmount,
          currency: finalCurrency,
          comments: input.comments,
          rejectionReason: undefined,
          rejectedBy: undefined,
          rejectedAt: undefined,
        })
        .where(eq(schema.mentorAppeals.id, input.id))
        .returning();

      // Publish the approved event
      await this.eventPublisher.publish(
        new MentorAppealApprovedEvent({
          appealId: updatedAppeal.id,
          mentorId: updatedAppeal.mentorId,
          counselorId: updatedAppeal.counselorId,
          appealAmount: updatedAppeal.appealAmount,
          approvedBy: input.approvedBy,
          approvedAt: now,
          currency: updatedAppeal.currency,
        }),
        ApproveMentorAppealCommand.name,
      );

      this.logger.log(`Appeal approved successfully: ${input.id}`);

      return updatedAppeal;
    } catch (error) {
      this.logger.error(
        `Failed to approve appeal ${input.id}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
