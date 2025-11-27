import { Injectable, Logger } from "@nestjs/common";
import { StudentProfileService } from "@domains/identity/student/student-profile.service";
import { UpdateStudentProfileDto } from "@api/dto/request/update-student-profile.dto";

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
        graduationDate: dto.graduationDate ? new Date(dto.graduationDate) : null,
        grades: dto.grades,
      },
      userId, // updatedBy
    );
  }
}

