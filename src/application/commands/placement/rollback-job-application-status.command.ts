import { Inject, Injectable } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { JobApplicationService } from "@domains/placement/services/job-application.service";
import { IRollbackApplicationStatusDto } from "@domains/placement/dto";

/**
 * Rollback Job Application Status Command
 * [回滚职位申请状态命令]
 *
 * 用于回滚职位申请的状态到上一个状态
 */
@Injectable()
export class RollbackJobApplicationStatusCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly jobApplicationService: JobApplicationService,
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
  async execute(input: { rollbackDto: IRollbackApplicationStatusDto }) {
    return this.withTransaction(async () => {
      const result = await this.jobApplicationService.rollbackApplicationStatus(
        input.rollbackDto,
      );
      return result.data;
    });
  }
}

