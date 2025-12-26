/**
 * Student Profile Use Case
 * 学生档案查询用例
 */
import { Inject, Injectable } from '@nestjs/common';
import { IStudentQueryRepository, STUDENT_QUERY_REPOSITORY } from '../interfaces/identity-query.repository.interface';

@Injectable()
export class StudentProfileUseCase {
  constructor(
    @Inject(STUDENT_QUERY_REPOSITORY)
    private readonly studentQueryRepository: IStudentQueryRepository,
  ) {}

  async getStudentProfile(studentId: string): Promise<any> {
    return this.studentQueryRepository.getStudentProfile(studentId);
  }
}

