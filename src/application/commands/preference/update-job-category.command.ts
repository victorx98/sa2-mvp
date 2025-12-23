import { Injectable, Logger } from '@nestjs/common';
import { CommandBase } from '@application/core/command.base';
import { JobCategoryService } from '@domains/preference/services/job-category.service';
import type { JobCategoryEntity } from '@domains/preference/entities/job-category.entity';

/**
 * Update Job Category DTO
 * 更新岗位类别请求数据(Update Job Category Request Data)
 */
export interface UpdateJobCategoryInput {
  description?: string;
  status?: string;
}

/**
 * Update Job Category Command
 * 更新岗位类别命令(Update Job Category Command)
 * 职责：处理更新岗位类别的业务用例
 */
@Injectable()
export class UpdateJobCategoryCommand extends CommandBase {
  protected readonly logger = new Logger(UpdateJobCategoryCommand.name);

  constructor(
    private readonly jobCategoryService: JobCategoryService,
  ) {
    super();
  }

  /**
   * 执行更新岗位类别命令(Execute update job category command)
   */
  async execute(
    id: string,
    input: UpdateJobCategoryInput,
    userId: string,
  ): Promise<JobCategoryEntity> {
    this.logger.log(`Updating job category: ${id} by user: ${userId}`);

    const result = await this.jobCategoryService.update(id, {
      description: input.description,
      status: input.status,
      updatedBy: userId,
    });

    this.logger.log(`Job category updated successfully: ${result.id}`);

    return result;
  }
}

