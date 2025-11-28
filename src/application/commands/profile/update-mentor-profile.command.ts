import { Injectable, Logger } from "@nestjs/common";
import { MentorProfileService } from "@domains/identity/mentor/mentor-profile.service";
import { UpdateMentorProfileDto } from "@api/dto/request/update-mentor-profile.dto";

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

    await this.mentorProfileService.update(
      userId,
      {
        status: dto.status,
        type: dto.type,
        company: dto.company,
        companyTitle: dto.companyTitle,
        briefIntro: dto.briefIntro,
        highSchool: dto.highSchool,
        location: dto.location,
        level: dto.level,
        rating: dto.rating,
        underCollege: dto.underCollege,
        underMajor: dto.underMajor,
        graduateCollege: dto.graduateCollege,
        graduateMajor: dto.graduateMajor,
      },
      userId, // updatedBy
    );
  }
}

