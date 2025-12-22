import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { recommendedJobs } from "@infrastructure/database/schema";
import { eq } from "drizzle-orm";

/**
 * Interface for marking a job position as expired [标记岗位过期的接口]
 */
interface IMarkJobExpiredDto {
  jobId: string; // Job position ID (UUID) [岗位ID(UUID)]
}

/**
 * Update Job Position Command
 * [更新职位命令]
 *
 * 用于标记职位过期
 * Handles job position status updates directly in the command [直接在命令中处理岗位状态更新]
 */
@Injectable()
export class UpdateJobPositionCommand extends CommandBase {

  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
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
    this.logger.log(`Marking job position as expired: ${input.jobId}`);

    // Check if job exists [检查岗位是否存在]
    const [job] = await this.db
      .select()
      .from(recommendedJobs)
      .where(eq(recommendedJobs.id, input.jobId));

    if (!job) {
      throw new NotFoundException(
        `Job position not found: ${input.jobId}`,
      );
    }

    if (job.status === "expired") {
      throw new BadRequestException(`Job position is already expired: ${input.jobId}`);
    }

    // Update job status [更新岗位状态]
    const [updatedJob] = await this.db
      .update(recommendedJobs)
      .set({
        status: "expired",
        updatedAt: new Date(),
      })
      .where(eq(recommendedJobs.id, input.jobId))
      .returning();

    this.logger.log(`Job position marked as expired: ${input.jobId}`);

    return {
      data: updatedJob,
    };
  }
}
