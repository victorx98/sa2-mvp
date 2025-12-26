/**
 * Major List Use Case
 * 专业列表查询用例
 */
import { Inject, Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IMajorQueryRepository, MAJOR_QUERY_REPOSITORY } from '../interfaces/identity-query.repository.interface';

@Injectable()
export class MajorListUseCase {
  constructor(
    @Inject(MAJOR_QUERY_REPOSITORY)
    private readonly majorQueryRepository: IMajorQueryRepository,
  ) {}

  async listMajors(params: any): Promise<IPaginatedResult<any>> {
    return this.majorQueryRepository.listMajors(params);
  }
}

