import { Injectable, Logger } from "@nestjs/common";
import { StudentProfileService } from "@domains/identity/student/student-profile.service";
import { UpdateStudentProfileDto } from "@api/dto/request/update-student-profile.dto";
import type { UpdateStudentProfileAggregateInput } from "@domains/identity/student/student-profile.service";

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
    private readonly studentProfileService: StudentProfileService,
  ) {}

  async execute(
    userId: string,
    dto: UpdateStudentProfileDto,
  ): Promise<void> {
    this.logger.log(`Updating student profile for user: ${userId}`);

    const input: UpdateStudentProfileAggregateInput = {
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

    // Student Profile 信息
    if (dto.status !== undefined) input.profile!.status = dto.status;
    if (dto.highSchool !== undefined) input.profile!.highSchool = dto.highSchool;
    if (dto.underCollege !== undefined)
      input.profile!.underCollege = dto.underCollege;
    if (dto.underMajor !== undefined) input.profile!.underMajor = dto.underMajor;
    if (dto.graduateCollege !== undefined)
      input.profile!.graduateCollege = dto.graduateCollege;
    if (dto.graduateMajor !== undefined)
      input.profile!.graduateMajor = dto.graduateMajor;
    if (dto.aiResumeSummary !== undefined)
      input.profile!.aiResumeSummary = dto.aiResumeSummary;
    if (dto.customerImportance !== undefined)
      input.profile!.customerImportance = dto.customerImportance;
    if (dto.graduationDate !== undefined)
      input.profile!.graduationDate = dto.graduationDate;
    if (dto.grades !== undefined) input.profile!.grades = dto.grades;

    await this.studentProfileService.updateAggregate(userId, input);
  }
}

