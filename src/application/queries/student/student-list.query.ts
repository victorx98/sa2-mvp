import { Injectable, BadRequestException } from "@nestjs/common";
import { StudentQueryService, StudentCounselorViewItem } from "@domains/query/services/student-query.service";
import { StudentListItem } from "@domains/query/services/student-query.service";
import { User } from "@domains/identity/user/user-interface";
import { IPaginatedResult } from "@shared/types/paginated-result";

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
   * 根据传入的 counselorId 或 mentorId 参数选择查询策略
   * 如果传入了 mentorId，调用 findByMentorId
   * 如果传入了 counselorId，调用 findByCounselorId
   * 如果都没有传入，调用 findAllStudents 查询全部学生
   */
  async find(
    user: User,
    search?: string,
    counselorId?: string,
    mentorId?: string,
  ): Promise<StudentListItem[]> {
    if (mentorId) {
      return this.findByMentorId(mentorId, search);
    }
    
    if (counselorId) {
      return this.findByCounselorId(counselorId, search);
    }
    
    // 如果都没有传入，查询全部学生
    return this.studentQueryService.findAllStudents(search);
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

  /**
   * 获取顾问视图的学生列表（带分页）
   * 关联查询 students、user、schools、majors 表
   * 返回包含学校名称和专业名称的完整信息，支持分页
   */
  async listOfCounselorView(
    counselorId?: string,
    search?: string,
    page: number = 1,
    pageSize: number = 20,
    studentId?: string,
  ): Promise<IPaginatedResult<StudentCounselorViewItem>> {
    return this.studentQueryService.listOfCounselorView(
      counselorId,
      search,
      page,
      pageSize,
      studentId,
    );
  }
}
