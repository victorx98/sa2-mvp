import { Inject, Injectable, BadRequestException, NotFoundException, ForbiddenException } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { IMentorAppeal } from "@domains/financial/interfaces/mentor-appeal.interface";
import { eq } from "drizzle-orm";
import * as schema from "@infrastructure/database/schema";
import { IntegrationEventPublisher, MentorAppealRejectedEvent } from "@application/events";

/**
 * Reject Mentor Appeal Command
 * [拒绝导师申诉命令]
 *
 * 用于拒绝导师提交的申诉请求
 */
@Injectable()
export class RejectMentorAppealCommand extends CommandBase {
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
    rejectedBy: string;
    rejectReason: string;
  }): Promise<IMentorAppeal> {
    this.logger.log(`Rejecting appeal: ${input.id} by user: ${input.rejectedBy}`);

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
          `Cannot reject appeal with status: ${appeal.status}. Only PENDING appeals can be rejected.`,
        );
      }

      // Verify the rejector matches the assigned counselor
      if (appeal.counselorId !== input.rejectedBy) {
        throw new ForbiddenException(
          "Only the assigned counselor can reject this appeal",
        );
      }

      // Update status to REJECTED
      const now = new Date();
      const [updatedAppeal] = await this.db
        .update(schema.mentorAppeals)
        .set({
          status: "REJECTED",
          rejectionReason: input.rejectReason,
          rejectedBy: input.rejectedBy,
          rejectedAt: now,
          approvedBy: undefined,
          approvedAt: undefined,
        })
        .where(eq(schema.mentorAppeals.id, input.id))
        .returning();

      // Publish the rejected event
      await this.eventPublisher.publish(
        new MentorAppealRejectedEvent({
          appealId: updatedAppeal.id,
          mentorId: updatedAppeal.mentorId,
          counselorId: updatedAppeal.counselorId,
          rejectionReason: input.rejectReason,
          rejectedBy: input.rejectedBy,
          rejectedAt: now,
        }),
        RejectMentorAppealCommand.name,
      );

      this.logger.log(`Appeal rejected successfully: ${input.id}`);

      return updatedAppeal;
    } catch (error) {
      this.logger.error(
        `Failed to reject appeal ${input.id}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
