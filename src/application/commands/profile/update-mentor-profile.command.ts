import { Injectable, Logger } from "@nestjs/common";
import { MentorProfileService } from "@domains/identity/mentor/mentor-profile.service";
import type { UpdateMentorProfileAggregateInput } from "@domains/identity/mentor/mentor-profile.service";
import { UpdateMentorProfileInput } from "./dto/update-mentor-profile.input";

/**
 * Application Layer - Update Mentor Profile Command
 * 职责：
 * 1. 编排更新导师档案用例
 * 2. 调用 Domain 层服务
 * 3. 返回业务数据
 */
@Injectable()
export class UpdateMentorProfileCommand {
  private readonly logger = new Logger(UpdateMentorProfileCommand.name);

  constructor(
    private readonly mentorProfileService: MentorProfileService,
  ) {}

  async execute(
    userId: string,
    input: UpdateMentorProfileInput,
  ): Promise<void> {
    this.logger.log(`Updating mentor profile for user: ${userId}`);

    const aggregateInput: UpdateMentorProfileAggregateInput = {
      user: {},
      profile: {},
    };

    // User 基础信息
    if (input.nameEn !== undefined) {
      aggregateInput.user!.nameEn = input.nameEn;
    }
    if (input.nameZh !== undefined) {
      aggregateInput.user!.nameZh = input.nameZh;
    }
    if (input.gender !== undefined) {
      aggregateInput.user!.gender = input.gender;
    }
    if (input.country !== undefined) {
      aggregateInput.user!.country = input.country;
    }

    // Mentor Profile 信息
    if (input.status !== undefined) aggregateInput.profile!.status = input.status;
    if (input.type !== undefined) aggregateInput.profile!.type = input.type;
    if (input.company !== undefined) aggregateInput.profile!.company = input.company;
    if (input.companyTitle !== undefined)
      aggregateInput.profile!.companyTitle = input.companyTitle;
    if (input.briefIntro !== undefined)
      aggregateInput.profile!.briefIntro = input.briefIntro;
    if (input.highSchool !== undefined)
      aggregateInput.profile!.highSchool = input.highSchool;
    if (input.location !== undefined) aggregateInput.profile!.location = input.location;
    if (input.level !== undefined) aggregateInput.profile!.level = input.level;
    if (input.rating !== undefined) aggregateInput.profile!.rating = input.rating;
    if (input.underCollege !== undefined)
      aggregateInput.profile!.underCollege = input.underCollege;
    if (input.underMajor !== undefined)
      aggregateInput.profile!.underMajor = input.underMajor;
    if (input.graduateCollege !== undefined)
      aggregateInput.profile!.graduateCollege = input.graduateCollege;
    if (input.graduateMajor !== undefined)
      aggregateInput.profile!.graduateMajor = input.graduateMajor;

    await this.mentorProfileService.updateAggregate(userId, aggregateInput);
  }
}

