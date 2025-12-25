/**
 * School List Use Case
 * 学校列表查询用例
 */
import { Inject, Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { ISchoolQueryRepository, SCHOOL_QUERY_REPOSITORY } from '../interfaces/identity-query.repository.interface';

@Injectable()
export class SchoolListUseCase {
  constructor(
    @Inject(SCHOOL_QUERY_REPOSITORY)
    private readonly schoolQueryRepository: ISchoolQueryRepository,
  ) {}

  async listSchools(params: any): Promise<IPaginatedResult<any>> {
    return this.schoolQueryRepository.listSchools(params);
  }
}

