import { Injectable, BadRequestException } from "@nestjs/common";
import { StudentQueryService } from "@domains/query/services/student-query.service";
import { StudentListItem } from "@domains/query/services/student-query.service";
import { User } from "@domains/identity/user/user-interface";

/**
 * Student List Query (Application Layer)
 * 职责：
 * 1. 编排学生列表查询用例
 * 2. 调用 Query Domain 的 Student Query Service
 * 3. 返回业务数据（与角色无关）
 */
@Injectable()
export class StudentListQuery {
  constructor(
    private readonly studentQueryService: StudentQueryService,
  ) {}

  /**
   * 根据用户角色自动选择查询策略
   * 如果用户是 mentor，调用 findByMentorId
   * 如果用户是 counselor，调用 findByCounselorId
   */
  async find(
    user: User,
    search?: string,
  ): Promise<StudentListItem[]> {
    const roles = user.roles || [];
    
    if (roles.includes("mentor")) {
      return this.findByMentorId(user.id, search);
    }
    
    if (roles.includes("counselor")) {
      return this.findByCounselorId(user.id, search);
    }
    
    throw new BadRequestException(
      "User must have either 'mentor' or 'counselor' role to search students",
    );
  }

  /**
   * 根据导师ID获取学生列表
   */
  async findByMentorId(
    mentorId: string,
    search?: string,
  ): Promise<StudentListItem[]> {
    return this.studentQueryService.findStudentsByMentorId(mentorId, search);
  }

  /**
   * 根据顾问ID获取学生列表
   */
  async findByCounselorId(
    counselorId: string,
    search?: string,
  ): Promise<StudentListItem[]> {
    return this.studentQueryService.findStudentsByCounselorId(
      counselorId,
      search,
    );
  }
}
