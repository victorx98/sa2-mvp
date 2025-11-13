import { Injectable } from "@nestjs/common";
import { StudentQueryService } from "@domains/query/services/student-query.service";
import { StudentListItem } from "@domains/query/services/student-query.service";

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
   * 根据导师ID获取学生列表
   */
  async findByMentorId(mentorId: string): Promise<StudentListItem[]> {
    return this.studentQueryService.findStudentsByMentorId(mentorId);
  }

  /**
   * 根据顾问ID获取学生列表
   */
  async findByCounselorId(counselorId: string): Promise<StudentListItem[]> {
    return this.studentQueryService.findStudentsByCounselorId(counselorId);
  }
}

