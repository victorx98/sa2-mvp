/**
 * School Query Adapter
 * 学校查询适配器
 */
import { Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { ISchoolQueryRepository } from '../../interfaces/identity-query.repository.interface';
import { SchoolQueryService } from '@domains/query/services/school-query.service';

@Injectable()
export class SchoolQueryAdapter implements ISchoolQueryRepository {
  constructor(
    private readonly schoolQueryService: SchoolQueryService,
  ) {}

  async listSchools(params: any): Promise<IPaginatedResult<any>> {
    const schools = await this.schoolQueryService.search(params?.keyword);
    return {
      data: schools,
      total: schools.length,
      page: params?.page || 1,
      pageSize: params?.pageSize || schools.length,
      totalPages: 1
    };
  }
}

