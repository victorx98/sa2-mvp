/**
 * Major Query Adapter
 * 专业查询适配器
 */
import { Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IMajorQueryRepository } from '../../interfaces/identity-query.repository.interface';
import { MajorQueryService } from '@domains/query/services/major-query.service';

@Injectable()
export class MajorQueryAdapter implements IMajorQueryRepository {
  constructor(
    private readonly majorQueryService: MajorQueryService,
  ) {}

  async listMajors(params: any): Promise<IPaginatedResult<any>> {
    const majors = await this.majorQueryService.search(params?.keyword);
    return {
      data: majors,
      total: majors.length,
      page: params?.page || 1,
      pageSize: params?.pageSize || majors.length,
      totalPages: 1
    };
  }
}

