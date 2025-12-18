import { Inject, Injectable } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { JobApplicationService } from "@domains/placement/services/job-application.service";
import { ICreateManualJobApplicationDto } from "@domains/placement/dto";

/**
 * Create Manual Job Application Command [手工创建内推命令]
 * - Handles manual job application creation with mentor assigned status [处理手工创建内推投递记录，状态默认设置为mentor_assigned]
 * - All-or-nothing transaction semantics [全成功事务语义]
 */
@Injectable()
export class CreateManualJobApplicationCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly jobApplicationService: JobApplicationService,
  ) {
    super(db);
  }

  /**
   * Execute command [执行命令]
   */
  async execute(input: { dto: ICreateManualJobApplicationDto }) {
    return this.withTransaction(async () => {
      return this.jobApplicationService.createManualJobApplication(
        input.dto,
      );
    });
  }
}