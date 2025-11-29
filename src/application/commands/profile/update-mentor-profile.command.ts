import { Injectable, Logger } from "@nestjs/common";
import { MentorProfileService } from "@domains/identity/mentor/mentor-profile.service";
import { UpdateMentorProfileDto } from "@api/dto/request/update-mentor-profile.dto";
import type { UpdateMentorProfileAggregateInput } from "@domains/identity/mentor/mentor-profile.service";

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
    dto: UpdateMentorProfileDto,
  ): Promise<void> {
    this.logger.log(`Updating mentor profile for user: ${userId}`);

    const input: UpdateMentorProfileAggregateInput = {
      user: {},
      profile: {},
    };

    // User 基础信息
    if (dto.nameEn !== undefined) {
      input.user!.nameEn = dto.nameEn;
    }
    if (dto.nameZh !== undefined) {
      input.user!.nameZh = dto.nameZh;
    }
    if (dto.gender !== undefined) {
      input.user!.gender = dto.gender;
    }
    if (dto.country !== undefined) {
      input.user!.country = dto.country;
    }

    // Mentor Profile 信息
    if (dto.status !== undefined) input.profile!.status = dto.status;
    if (dto.type !== undefined) input.profile!.type = dto.type;
    if (dto.company !== undefined) input.profile!.company = dto.company;
    if (dto.companyTitle !== undefined)
      input.profile!.companyTitle = dto.companyTitle;
    if (dto.briefIntro !== undefined)
      input.profile!.briefIntro = dto.briefIntro;
    if (dto.highSchool !== undefined)
      input.profile!.highSchool = dto.highSchool;
    if (dto.location !== undefined) input.profile!.location = dto.location;
    if (dto.level !== undefined) input.profile!.level = dto.level;
    if (dto.rating !== undefined) input.profile!.rating = dto.rating;
    if (dto.underCollege !== undefined)
      input.profile!.underCollege = dto.underCollege;
    if (dto.underMajor !== undefined)
      input.profile!.underMajor = dto.underMajor;
    if (dto.graduateCollege !== undefined)
      input.profile!.graduateCollege = dto.graduateCollege;
    if (dto.graduateMajor !== undefined)
      input.profile!.graduateMajor = dto.graduateMajor;

    await this.mentorProfileService.updateAggregate(userId, input);
  }
}

