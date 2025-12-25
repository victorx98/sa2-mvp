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
    return this.studentQueryService.listStudents(params);
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
    return this.studentQueryService.getStudentItem(studentId);
  }
}

