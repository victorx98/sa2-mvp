import { Injectable } from "@nestjs/common";
import { StudentProfileService } from "@domains/identity/student/student-profile.service";

/**
 * Student Profile Query (Application Layer)
 * 职责：
 * 1. 编排学生档案查询用例
 * 2. 调用 Identity Domain 的聚合查询方法
 * 3. 返回组合后的档案视图
 */
@Injectable()
export class StudentProfileQuery {
  constructor(
    private readonly studentProfileService: StudentProfileService,
  ) {}

  /**
   * 获取当前学生完整档案（User + Student Profile）
   */
  async getProfile(userId: string) {
    const { user, profile } =
      await this.studentProfileService.getAggregateByUserId(userId);

    return {
      // User 基础信息
      id: user.id,
      email: user.email,
      nameEn: user.nameEn,
      nameZh: user.nameZh,
      gender: user.gender,
      status: user.status,
      country: user.country,
      roles: user.roles,
      createdTime: user.createdTime,
      modifiedTime: user.modifiedTime,

      // Student Profile 专有信息
      studentStatus: profile.status,
      highSchool: profile.highSchool,
      underCollege: profile.underCollege,
      underMajor: profile.underMajor,
      graduateCollege: profile.graduateCollege,
      graduateMajor: profile.graduateMajor,
      aiResumeSummary: profile.aiResumeSummary,
      customerImportance: profile.customerImportance,
      graduationDate: profile.graduationDate,
      grades: profile.grades,
    };
  }
}


