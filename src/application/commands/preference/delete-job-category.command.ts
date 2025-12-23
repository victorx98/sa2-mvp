import { Injectable, Logger } from '@nestjs/common';
import { CommandBase } from '@application/core/command.base';
import { JobCategoryService } from '@domains/preference/services/job-category.service';
import type { JobCategoryEntity } from '@domains/preference/entities/job-category.entity';

/**
 * Delete Job Category Command
 * 删除岗位类别命令(Delete Job Category Command)
 * 职责：处理逻辑删除岗位类别的业务用例
 */
@Injectable()
export class DeleteJobCategoryCommand extends CommandBase {
  protected readonly logger = new Logger(DeleteJobCategoryCommand.name);

  constructor(
    private readonly jobCategoryService: JobCategoryService,
  ) {
    super();
  }

  /**
   * 执行删除岗位类别命令(Execute delete job category command)
   */
  async execute(id: string, userId: string): Promise<JobCategoryEntity> {
    this.logger.log(`Deleting job category: ${id} by user: ${userId}`);

    const result = await this.jobCategoryService.delete(id, userId);

    this.logger.log(`Job category deleted successfully: ${result.id}`);

    return result;
  }
}

