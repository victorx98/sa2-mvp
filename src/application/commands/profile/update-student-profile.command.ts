import { Injectable, Logger } from "@nestjs/common";
import { StudentProfileService } from "@domains/identity/student/student-profile.service";
import type { UpdateStudentProfileAggregateInput } from "@domains/identity/student/student-profile.service";
import { UpdateStudentProfileInput } from "./dto/update-student-profile.input";

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
    input: UpdateStudentProfileInput,
  ): Promise<void> {
    this.logger.log(`Updating student profile for user: ${userId}`);

    const aggregateInput: UpdateStudentProfileAggregateInput = {
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

    // Student Profile 信息
    if (input.status !== undefined) aggregateInput.profile!.status = input.status;
    if (input.highSchool !== undefined) aggregateInput.profile!.highSchool = input.highSchool;
    if (input.underCollege !== undefined)
      aggregateInput.profile!.underCollege = input.underCollege;
    if (input.underMajor !== undefined) aggregateInput.profile!.underMajor = input.underMajor;
    if (input.graduateCollege !== undefined)
      aggregateInput.profile!.graduateCollege = input.graduateCollege;
    if (input.graduateMajor !== undefined)
      aggregateInput.profile!.graduateMajor = input.graduateMajor;
    if (input.aiResumeSummary !== undefined)
      aggregateInput.profile!.aiResumeSummary = input.aiResumeSummary;
    if (input.customerImportance !== undefined)
      aggregateInput.profile!.customerImportance = input.customerImportance;
    if (input.underGraduationDate !== undefined)
      aggregateInput.profile!.underGraduationDate = input.underGraduationDate;
    if (input.graduateGraduationDate !== undefined)
      aggregateInput.profile!.graduateGraduationDate = input.graduateGraduationDate;
    if (input.grades !== undefined) aggregateInput.profile!.grades = input.grades;

    await this.studentProfileService.updateAggregate(userId, aggregateInput);
  }
}

