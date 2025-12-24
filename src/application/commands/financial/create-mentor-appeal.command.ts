import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import * as schema from "@infrastructure/database/schema";
import { IntegrationEventPublisher, MentorAppealCreatedEvent } from "@application/events";

/**
 * Create Mentor Appeal Command (Application Layer)
 * [创建导师申诉命令]
 *
 * 职责：
 * 1. 编排导师申诉创建用例
 * 2. 调用 Financial Domain 的 Mentor Appeal Service
 * 3. 返回创建的导师申诉
 */
@Injectable()
export class CreateMentorAppealCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly eventPublisher: IntegrationEventPublisher,
  ) {
    super(db);
  }

  /**
   * 执行创建导师申诉用例
   * [Execute create mentor appeal use case]
   *
   * @param input 创建导师申诉输入参数
   * @returns 创建的导师申诉
   */
  async execute(input: {
    mentorId: string;
    counselorId: string;
    studentId: string;
    mentorPayableId?: string;
    title?: string;
    appealType: string;
    appealAmount?: string;
    currency?: string;
    reason: string;
    createdBy: string;
  }) {
    try {
      this.logger.debug(`Creating mentor appeal for mentor: ${input.mentorId}`);

      const dto = input;
      const createdByUserId = input.createdBy;

      // Validate that mentorId matches createdByUserId (mentorId is from JWT)
      // [验证mentorId与createdByUserId一致（mentorId来自JWT）]
      if (dto.mentorId !== createdByUserId) {
        throw new BadRequestException(
          "Mentor ID must match the creator's user ID",
        );
      }

      // Create the appeal record
      // [创建申诉记录，settlementId在创建时不需要]
      const [appeal] = await this.db
        .insert(schema.mentorAppeals)
        .values({
          mentorId: dto.mentorId,
          counselorId: dto.counselorId,
          studentId: dto.studentId,
          mentorPayableId: dto.mentorPayableId,
          settlementId: undefined, // Not provided at creation time
          title: dto.title,
          appealType: dto.appealType,
          appealAmount: dto.appealAmount,
          currency: dto.currency,
          reason: dto.reason,
          status: "PENDING",
          createdBy: createdByUserId,
        })
        .returning();

      // Publish the created event
      await this.eventPublisher.publish(
        new MentorAppealCreatedEvent({
          appealId: appeal.id,
          mentorId: appeal.mentorId,
          counselorId: appeal.counselorId,
          appealAmount: appeal.appealAmount,
          appealType: appeal.appealType,
          currency: appeal.currency,
          createdAt: appeal.createdAt,
        }),
        CreateMentorAppealCommand.name,
      );

      this.logger.log(`Appeal created successfully: ${appeal.id}`);
      this.logger.debug(`Mentor appeal created successfully: ${appeal.id}`);
      return appeal;
    } catch (error) {
      this.logger.error(
        `Failed to create mentor appeal: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
