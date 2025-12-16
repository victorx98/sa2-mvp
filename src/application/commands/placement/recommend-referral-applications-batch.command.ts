import { Inject, Injectable } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { JobApplicationService } from "@domains/placement/services/job-application.service";
import { IRecommendReferralApplicationsBatchDto } from "@domains/placement/dto";

/**
 * Recommend Referral Applications Batch Command [批量内推推荐命令]
 * - All-or-nothing transaction semantics [全成功事务语义]
 */
@Injectable()
export class RecommendReferralApplicationsBatchCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly jobApplicationService: JobApplicationService,
  ) {
    super(db);
  }

  /**
   * Execute command [执行命令]
   */
  async execute(input: { dto: IRecommendReferralApplicationsBatchDto }) {
    return this.withTransaction(async () => {
      return this.jobApplicationService.recommendReferralApplicationsBatch(
        input.dto,
      );
    });
  }
}


