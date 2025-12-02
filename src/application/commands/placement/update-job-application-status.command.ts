import { Injectable } from '@nestjs/common';
import { CommandBase } from '@application/core/command.base';
import { JobApplicationService } from '@domains/placement/services/job-application.service';
import { IUpdateApplicationStatusDto } from '@domains/placement/dto';

/**
 * Update Job Application Status Command
 * [更新职位申请状态命令]
 * 
 * 用于更新职位申请的状态
 */
@Injectable()
export class UpdateJobApplicationStatusCommand extends CommandBase {
  constructor(
    private readonly jobApplicationService: JobApplicationService,
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
    updateStatusDto: IUpdateApplicationStatusDto;
  }) {
    return this.withTransaction(async () => {
      return this.jobApplicationService.updateApplicationStatus(
        input.updateStatusDto
      );
    });
  }
}
