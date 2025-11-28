import { Injectable } from "@nestjs/common";
import {
  MentorQueryService,
  MentorListItem,
} from "@domains/query/services/mentor-query.service";

/**
 * Mentor List Query (Application Layer)
 * 职责：
 * 1. 编排导师列表查询用例
 * 2. 根据参数选择查询策略
 * 3. 调用 Query Domain 的 Mentor Query Service
 */
@Injectable()
export class MentorListQuery {
  constructor(private readonly mentorQueryService: MentorQueryService) {}

  /**
   * 查询导师列表
   * - 如果只有 text 或没有参数，则在 mentor 表上查询
   * - 如果有 studentId，则关联 student_mentor 表查询该学生的导师
   */
  async execute(text?: string, studentId?: string): Promise<MentorListItem[]> {
    if (studentId) {
      // 如果有 studentId，关联 student_mentor 表查询
      return this.mentorQueryService.findByStudentId(studentId, text);
    }
    
    // 如果只有 text 或没有参数，在 mentor 表上查询
    return this.mentorQueryService.findAll(text);
  }
}

