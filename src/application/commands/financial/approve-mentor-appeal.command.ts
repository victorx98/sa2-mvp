import { Injectable } from '@nestjs/common';
import { CommandBase } from '@application/core/command.base';
import { MentorAppealService } from '@domains/financial/services/mentor-appeal.service';
import { IMentorAppeal } from '@domains/financial/interfaces/mentor-appeal.interface';

/**
 * Approve Mentor Appeal Command
 * [批准导师申诉命令]
 * 
 * 用于批准导师提交的申诉请求
 */
@Injectable()
export class ApproveMentorAppealCommand extends CommandBase {
  constructor(
    private readonly mentorAppealService: MentorAppealService,
    ...args: ConstructorParameters<typeof CommandBase>
  ) {
    super(...args);
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
  }): Promise<IMentorAppeal> {
    return this.withTransaction(async () => {
      return this.mentorAppealService.approveAppeal(
        input.id,
        input.approvedBy
      );
    });
  }
}
