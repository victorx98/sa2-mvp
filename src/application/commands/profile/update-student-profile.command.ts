import { Inject, Injectable, Logger } from "@nestjs/common";
import { StudentProfileService } from "@domains/identity/student/student-profile.service";
import { UpdateStudentProfileDto } from "@api/dto/request/update-student-profile.dto";
import {
  IUserService,
  USER_SERVICE,
} from "@domains/identity/user/user-interface";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";

/**
 * Application Layer - Update Student Profile Command
 * 职责：
 * 1. 编排更新学生档案用例
 * 2. 调用 Domain 层服务
 * 3. 返回业务数据
 */
@Injectable()
export class UpdateStudentProfileCommand {
  private readonly logger = new Logger(UpdateStudentProfileCommand.name);

  constructor(
    @Inject(USER_SERVICE)
    private readonly userService: IUserService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly studentProfileService: StudentProfileService,
  ) {}

  async execute(
    userId: string,
    dto: UpdateStudentProfileDto,
  ): Promise<void> {
    this.logger.log(`Updating student profile for user: ${userId}`);

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

      // 2. 更新 student profile 表
      await this.studentProfileService.update(
        userId,
        {
          status: dto.status,
          highSchool: dto.highSchool,
          underCollege: dto.underCollege,
          underMajor: dto.underMajor,
          graduateCollege: dto.graduateCollege,
          graduateMajor: dto.graduateMajor,
          aiResumeSummary: dto.aiResumeSummary,
          customerImportance: dto.customerImportance,
          graduationDate: dto.graduationDate,
          grades: dto.grades,
        },
        userId, // updatedBy
        tx,
      );
    });
  }
}

