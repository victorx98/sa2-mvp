import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandBase } from '@application/core/command.base';
import { JobTitleService } from '@domains/preference/services/job-title.service';
import type { JobTitleEntity } from '@domains/preference/entities/job-title.entity';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';

/**
 * Delete Job Title Command
 * 删除岗位名称命令(Delete Job Title Command)
 * 职责：处理逻辑删除岗位名称的业务用例
 */
@Injectable()
export class DeleteJobTitleCommand extends CommandBase {
  protected readonly logger = new Logger(DeleteJobTitleCommand.name);

  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly jobTitleService: JobTitleService,
  ) {
    super(db);
  }

  /**
   * 执行删除岗位名称命令(Execute delete job title command)
   */
  async execute(id: string, userId: string): Promise<JobTitleEntity> {
    this.logger.log(`Deleting job title: ${id} by user: ${userId}`);

    const result = await this.jobTitleService.delete(id, userId);

    this.logger.log(`Job title deleted successfully: ${result.id}`);

    return result;
  }
}

