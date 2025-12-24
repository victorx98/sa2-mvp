import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandBase } from '@application/core/command.base';
import { JobTitleService } from '@domains/preference/services/job-title.service';
import type { JobTitleEntity } from '@domains/preference/entities/job-title.entity';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';

/**
 * Update Job Title DTO
 * 更新岗位名称请求数据(Update Job Title Request Data)
 */
export interface UpdateJobTitleInput {
  description?: string;
  status?: string;
  jobCategoryId?: string;
}

/**
 * Update Job Title Command
 * 更新岗位名称命令(Update Job Title Command)
 * 职责：处理更新岗位名称的业务用例
 */
@Injectable()
export class UpdateJobTitleCommand extends CommandBase {
  protected readonly logger = new Logger(UpdateJobTitleCommand.name);

  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly jobTitleService: JobTitleService,
  ) {
    super(db);
  }

  /**
   * 执行更新岗位名称命令(Execute update job title command)
   */
  async execute(
    id: string,
    input: UpdateJobTitleInput,
    userId: string,
  ): Promise<JobTitleEntity> {
    this.logger.log(`Updating job title: ${id} by user: ${userId}`);

    const result = await this.jobTitleService.update(id, {
      description: input.description,
      status: input.status,
      jobCategoryId: input.jobCategoryId,
      updatedBy: userId,
    });

    this.logger.log(`Job title updated successfully: ${result.id}`);

    return result;
  }
}

