/**
 * Counselor List Use Case
 * 顾问列表查询用例
 */
import { Inject, Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { ICounselorQueryRepository, COUNSELOR_QUERY_REPOSITORY } from '../interfaces/identity-query.repository.interface';

@Injectable()
export class CounselorListUseCase {
  constructor(
    @Inject(COUNSELOR_QUERY_REPOSITORY)
    private readonly counselorQueryRepository: ICounselorQueryRepository,
  ) {}

  async listCounselors(params: any): Promise<IPaginatedResult<any>> {
    return this.counselorQueryRepository.listCounselors(params);
  }
}

