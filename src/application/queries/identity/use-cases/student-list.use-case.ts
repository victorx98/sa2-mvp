/**
 * Student List Use Case
 * 学生列表查询用例
 */
import { Inject, Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IStudentQueryRepository, STUDENT_QUERY_REPOSITORY } from '../interfaces/identity-query.repository.interface';

@Injectable()
export class StudentListUseCase {
  constructor(
    @Inject(STUDENT_QUERY_REPOSITORY)
    private readonly studentQueryRepository: IStudentQueryRepository,
  ) {}

  async listStudents(params: any): Promise<IPaginatedResult<any>> {
    return this.studentQueryRepository.listStudents(params);
  }

  async listOfCounselorView(
    counselorId?: string,
    search?: string,
    page?: number,
    pageSize?: number,
    studentId?: string
  ): Promise<IPaginatedResult<any>> {
    return this.studentQueryRepository.listOfCounselorView(counselorId, search, page, pageSize, studentId);
  }
}

