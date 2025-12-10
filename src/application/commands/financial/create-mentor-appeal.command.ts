import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { MentorAppealService } from "@domains/financial/services/mentor-appeal.service";

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
    private readonly mentorAppealService: MentorAppealService,
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
  async execute(input: any) {
    try {
      this.logger.debug(`Creating mentor appeal for mentor: ${input.mentorId}`);
      const appeal = await this.mentorAppealService.createAppeal(
        input,
        input.createdBy,
      );
      this.logger.debug(`Mentor appeal created successfully: ${appeal.id}`);
      return appeal;
    } catch (error) {
      this.logger.error(
        `Failed to create mentor appeal: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
