import { Injectable } from "@nestjs/common";
import { MentorProfileService } from "@domains/identity/mentor/mentor-profile.service";

/**
 * Mentor Profile Query (Application Layer)
 * 职责：
 * 1. 编排导师档案查询用例
 * 2. 调用 Identity Domain 的聚合查询方法
 * 3. 返回组合后的档案视图
 */
@Injectable()
export class MentorProfileQuery {
  constructor(
    private readonly mentorProfileService: MentorProfileService,
  ) {}

  /**
   * 获取当前导师完整档案（User + Mentor Profile）
   */
  async getProfile(userId: string) {
    const { user, profile } =
      await this.mentorProfileService.getAggregateByUserId(userId);

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

      // Mentor Profile 专有信息
      mentorStatus: profile.status,
      type: profile.type,
      company: profile.company,
      companyTitle: profile.companyTitle,
      briefIntro: profile.briefIntro,
      highSchool: profile.highSchool,
      location: profile.location,
      level: profile.level,
      rating: profile.rating,
      underCollege: profile.underCollege,
      underMajor: profile.underMajor,
      graduateCollege: profile.graduateCollege,
      graduateMajor: profile.graduateMajor,
    };
  }
}


