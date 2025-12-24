import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandBase } from '@application/core/command.base';
import { JobCategoryService } from '@domains/preference/services/job-category.service';
import type { JobCategoryEntity } from '@domains/preference/entities/job-category.entity';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';

/**
 * Create Job Category DTO
 * 创建岗位类别请求数据(Create Job Category Request Data)
 */
export interface CreateJobCategoryInput {
  id: string;
  description?: string;
}

/**
 * Create Job Category Command
 * 创建岗位类别命令(Create Job Category Command)
 * 职责：处理创建岗位类别的业务用例
 */
@Injectable()
export class CreateJobCategoryCommand extends CommandBase {
  protected readonly logger = new Logger(CreateJobCategoryCommand.name);

  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly jobCategoryService: JobCategoryService,
  ) {
    super(db);
  }

  /**
   * 执行创建岗位类别命令(Execute create job category command)
   */
  async execute(input: CreateJobCategoryInput, userId: string): Promise<JobCategoryEntity> {
    this.logger.log(`Creating job category: ${input.id} by user: ${userId}`);

    const result = await this.jobCategoryService.create({
      id: input.id,
      description: input.description,
      createdBy: userId,
    });

    this.logger.log(`Job category created successfully: ${result.id}`);

    return result;
  }
}

