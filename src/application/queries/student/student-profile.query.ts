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
   * 获取当前学生完整档案（User + Student Profile + 关联的 Schools 和 Majors）
   */
  async getProfile(userId: string) {
    const {
      user,
      profile,
      highSchool,
      underCollege,
      graduateCollege,
      underMajor,
      graduateMajor,
    } = await this.studentProfileService.getAggregateWithRelationsByUserId(userId);

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
      highSchool: profile.highSchool
        ? {
            id: profile.highSchool,
            nameZh: highSchool?.nameZh || null,
            nameEn: highSchool?.nameEn || null,
          }
        : null,
      underCollege: profile.underCollege
        ? {
            id: profile.underCollege,
            nameZh: underCollege?.nameZh || null,
            nameEn: underCollege?.nameEn || null,
          }
        : null,
      underMajor: profile.underMajor
        ? {
            id: profile.underMajor,
            nameZh: underMajor?.nameZh || null,
            nameEn: underMajor?.nameEn || null,
          }
        : null,
      graduateCollege: profile.graduateCollege
        ? {
            id: profile.graduateCollege,
            nameZh: graduateCollege?.nameZh || null,
            nameEn: graduateCollege?.nameEn || null,
          }
        : null,
      graduateMajor: profile.graduateMajor
        ? {
            id: profile.graduateMajor,
            nameZh: graduateMajor?.nameZh || null,
            nameEn: graduateMajor?.nameEn || null,
          }
        : null,
      aiResumeSummary: profile.aiResumeSummary,
      customerImportance: profile.customerImportance,
      underGraduationDate: profile.underGraduationDate,
      graduateGraduationDate: profile.graduateGraduationDate,
      grades: profile.grades,
    };
  }
}


