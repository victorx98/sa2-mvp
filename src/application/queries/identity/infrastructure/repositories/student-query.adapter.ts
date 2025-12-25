/**
 * Student Query Adapter
 * 学生查询适配器 - 委托给domain query service
 */
import { Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IStudentQueryRepository } from '../../interfaces/identity-query.repository.interface';
import { StudentQueryService } from '@domains/query/services/student-query.service';

@Injectable()
export class StudentQueryAdapter implements IStudentQueryRepository {
  constructor(
    private readonly studentQueryService: StudentQueryService,
  ) {}

  async listStudents(params: any): Promise<IPaginatedResult<any>> {
    const students = await this.studentQueryService.findAllStudents(params?.keyword);
    return {
      data: students,
      total: students.length,
      page: params?.page || 1,
      pageSize: params?.pageSize || students.length,
      totalPages: 1
    };
  }

  async listOfCounselorView(
    counselorId?: string,
    search?: string,
    page?: number,
    pageSize?: number,
    studentId?: string
  ): Promise<IPaginatedResult<any>> {
    return this.studentQueryService.listOfCounselorView(counselorId, search, page, pageSize, studentId);
  }

  async getStudentProfile(studentId: string): Promise<any> {
    // 使用listOfCounselorView方法获取单个学生详情
    const result = await this.studentQueryService.listOfCounselorView(undefined, undefined, 1, 1, studentId);
    return result.data[0] || null;
  }
}

