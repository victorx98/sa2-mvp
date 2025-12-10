import { Inject, Injectable } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { MentorAppealService } from "@domains/financial/services/mentor-appeal.service";
import { IMentorAppeal } from "@domains/financial/interfaces/mentor-appeal.interface";

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
    private readonly mentorAppealService: MentorAppealService,
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
    return this.withTransaction(async () => {
      return this.mentorAppealService.rejectAppeal(
        input.id,
        { rejectionReason: input.rejectReason },
        input.rejectedBy,
      );
    });
  }
}
