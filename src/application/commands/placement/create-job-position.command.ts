import { Inject, Injectable, Logger } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { ICreateJobPositionDto } from "@api/dto/request/placement/placement.index";
import { recommendedJobs } from "@infrastructure/database/schema";
import type { IServiceResult } from "@domains/placement/interfaces";

/**
 * Create Job Position Command (Application Layer)
 * [创建职位命令]
 *
 * 职责：
 * 1. 编排职位创建用例
 * 2. 构建职位数据（包括必填和可选字段）
 * 3. 创建职位记录
 * 4. 返回创建的职位
 */
@Injectable()
export class CreateJobPositionCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
  ) {
    super(db);
  }

  /**
   * 执行创建职位用例
   * [Execute create job position use case]
   *
   * @param dto 创建职位DTO [Create job position DTO]
   * @param createdBy 创建人用户ID [User ID who created the job position]
   * @returns 创建的职位
   */
  async execute(
    dto: ICreateJobPositionDto,
    createdBy: string,
  ): Promise<
    IServiceResult<typeof recommendedJobs.$inferSelect, Record<string, unknown>>
  > {
    this.logger.debug(
      `Creating job position: ${dto.jobTitle} at ${dto.companyName}`,
    );

    // 1. 构建职位数据
    const values: Partial<typeof recommendedJobs.$inferInsert> = {
      title: dto.jobTitle,
      companyName: dto.companyName,
      status: dto.status || "active",
    };

    // 2. 添加可选字段
    if (dto.objectId) values.objectId = dto.objectId;
    if (dto.normJobTitles) values.normalizedJobTitles = dto.normJobTitles;
    if (dto.jobTypes) values.jobTypes = dto.jobTypes;
    if (dto.postDate) values.postDate = dto.postDate;
    if (dto.countryCode) values.countryCode = dto.countryCode;
    if (dto.locations) values.jobLocations = dto.locations;
    if (dto.experienceRequirement) values.experienceRequirement = dto.experienceRequirement;
    if (dto.salaryDetails) values.salaryDetails = dto.salaryDetails;
    if (dto.jobDescription) values.jobDescription = dto.jobDescription;
    if (dto.h1b) values.h1b = dto.h1b;
    if (dto.usCitizenship) values.usCitizenship = dto.usCitizenship;

    // 3. 创建职位记录
    const [job] = await this.db
      .insert(recommendedJobs)
      .values(values as typeof recommendedJobs.$inferInsert)
      .returning();

    this.logger.debug(`Job position created: ${job.id}`);

    return {
      data: job,
    };
  }
}
