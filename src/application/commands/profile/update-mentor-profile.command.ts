import { Inject, Injectable, Logger } from "@nestjs/common";
import { MentorProfileService } from "@domains/identity/mentor/mentor-profile.service";
import { UpdateMentorProfileDto } from "@api/dto/request/update-mentor-profile.dto";
import {
  IUserService,
  USER_SERVICE,
} from "@domains/identity/user/user-interface";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";

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
    @Inject(USER_SERVICE)
    private readonly userService: IUserService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly mentorProfileService: MentorProfileService,
  ) {}

  async execute(
    userId: string,
    dto: UpdateMentorProfileDto,
  ): Promise<void> {
    this.logger.log(`Updating mentor profile for user: ${userId}`);

    await this.db.transaction(async (tx) => {
      // 1. 更新 user 表（如果有相关字段）
      const userUpdatePayload: Parameters<IUserService["update"]>[1] = {};

      if (dto.nameEn !== undefined) {
        userUpdatePayload.nameEn = dto.nameEn;
      }
      if (dto.nameZh !== undefined) {
        userUpdatePayload.nameZh = dto.nameZh;
      }
      if (dto.gender !== undefined) {
        userUpdatePayload.gender = dto.gender;
      }
      if (dto.country !== undefined) {
        userUpdatePayload.country = dto.country;
      }

      if (Object.keys(userUpdatePayload).length > 0) {
        await this.userService.update(userId, userUpdatePayload, tx);
      }

      // 2. 更新 mentor profile 表
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
        tx,
      );
    });
  }
}

