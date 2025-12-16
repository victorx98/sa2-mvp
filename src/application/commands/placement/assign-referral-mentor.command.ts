import { Inject, Injectable } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { JobApplicationService } from "@domains/placement/services/job-application.service";
import type { IUpdateApplicationStatusDto } from "@domains/placement/dto";

/**
 * Assign Referral Mentor Command [内推指定导师命令]
 * - Separated command for counselor-facing API [为顾问侧API拆分的独立命令]
 */
@Injectable()
export class AssignReferralMentorCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly jobApplicationService: JobApplicationService,
  ) {
    super(db);
  }

  /**
   * Execute command [执行命令]
   */
  async execute(input: { updateStatusDto: IUpdateApplicationStatusDto }) {
    return this.withTransaction(async () => {
      return this.jobApplicationService.updateApplicationStatus(
        input.updateStatusDto,
      );
    });
  }
}


