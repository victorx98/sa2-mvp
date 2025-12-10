import { Inject, Injectable } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { JobPositionService } from "@domains/placement/services/job-position.service";
import { ICreateJobPositionDto } from "@domains/placement/dto";

/**
 * Create Job Position Command
 * [创建职位命令]
 *
 * 用于创建新的职位
 */
@Injectable()
export class CreateJobPositionCommand extends CommandBase {
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
  async execute(input: { createJobPositionDto: ICreateJobPositionDto }) {
    return this.withTransaction(async () => {
      return this.jobPositionService.createJobPosition(
        input.createJobPositionDto,
      );
    });
  }
}
