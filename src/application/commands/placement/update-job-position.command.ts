import { Inject, Injectable } from '@nestjs/common';
import { CommandBase } from '@application/core/command.base';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { JobPositionService } from '@domains/placement/services/job-position.service';
import { IMarkJobExpiredDto } from '@domains/placement/dto';

/**
 * Update Job Position Command
 * [更新职位命令]
 * 
 * 用于标记职位过期
 */
@Injectable()
export class UpdateJobPositionCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly jobPositionService: JobPositionService,
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
  async execute(input: IMarkJobExpiredDto) {
    return this.withTransaction(async () => {
      return this.jobPositionService.markJobExpired(input);
    });
  }
}
