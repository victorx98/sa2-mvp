/**
 * Counselor Query Adapter
 * 顾问查询适配器
 */
import { Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { ICounselorQueryRepository } from '../../interfaces/identity-query.repository.interface';
import { CounselorQueryService } from '@domains/query/services/counselor-query.service';

@Injectable()
export class CounselorQueryAdapter implements ICounselorQueryRepository {
  constructor(
    private readonly counselorQueryService: CounselorQueryService,
  ) {}

  async listCounselors(params: any): Promise<IPaginatedResult<any>> {
    const counselors = await this.counselorQueryService.findAll(params?.keyword);
    return {
      data: counselors,
      total: counselors.length,
      page: params?.page || 1,
      pageSize: params?.pageSize || counselors.length,
      totalPages: 1
    };
  }
}

