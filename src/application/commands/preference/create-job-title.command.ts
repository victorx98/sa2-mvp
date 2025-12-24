import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandBase } from '@application/core/command.base';
import { JobTitleService } from '@domains/preference/services/job-title.service';
import type { JobTitleEntity } from '@domains/preference/entities/job-title.entity';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';

/**
 * Create Job Title DTO
 * 创建岗位名称请求数据(Create Job Title Request Data)
 */
export interface CreateJobTitleInput {
  id: string;
  description?: string;
  jobCategoryId?: string;
}

/**
 * Create Job Title Command
 * 创建岗位名称命令(Create Job Title Command)
 * 职责：处理创建岗位名称的业务用例
 */
@Injectable()
export class CreateJobTitleCommand extends CommandBase {
  protected readonly logger = new Logger(CreateJobTitleCommand.name);

  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly jobTitleService: JobTitleService,
  ) {
    super(db);
  }

  /**
   * 执行创建岗位名称命令(Execute create job title command)
   */
  async execute(input: CreateJobTitleInput, userId: string): Promise<JobTitleEntity> {
    this.logger.log(`Creating job title: ${input.id} by user: ${userId}`);

    const result = await this.jobTitleService.create({
      id: input.id,
      description: input.description,
      jobCategoryId: input.jobCategoryId,
      createdBy: userId,
    });

    this.logger.log(`Job title created successfully: ${result.id}`);

    return result;
  }
}

