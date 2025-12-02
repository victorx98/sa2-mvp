import { Injectable } from '@nestjs/common';
import { CommandBase } from '@application/core/command.base';
import { JobApplicationService } from '@domains/placement/services/job-application.service';
import { IUpdateApplicationStatusDto } from '@domains/placement/dto';

/**
 * Update Job Position Command
 * [更新职位命令]
 * 
 * 用于更新职位信息
 */
@Injectable()
export class UpdateJobPositionCommand extends CommandBase {
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
    id: string;
    updateStatusDto: IUpdateApplicationStatusDto;
  }) {
    return this.withTransaction(async () => {
      return this.jobApplicationService.updateApplicationStatus(
        input.updateStatusDto
      );
    });
  }
}
