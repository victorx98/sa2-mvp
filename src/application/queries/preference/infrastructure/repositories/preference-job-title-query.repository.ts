/**
 * Preference Job Title Query Repository Implementation
 * 参考数据-岗位名称查询仓储实现
 * 
 * Delegates to domain repository for data access
 */
import { Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IJobTitleQueryRepository } from '../../interfaces/job-title-query.repository.interface';
import { JobTitleReadModel } from '../../models/job-title-read.model';
import { ListJobTitlesDto } from '../../dto/preference-query.dto';
import { JobTitleService } from '@domains/preference/services/job-title.service';

@Injectable()
export class PreferenceJobTitleQueryRepository implements IJobTitleQueryRepository {
  constructor(
    private readonly jobTitleService: JobTitleService,
  ) {}

  async listJobTitles(dto: ListJobTitlesDto): Promise<IPaginatedResult<JobTitleReadModel>> {
    const result = await this.jobTitleService.findAll({
      status: dto.status,
      search: dto.keyword,
      page: dto.page,
      pageSize: dto.pageSize,
      sortBy: dto.sortBy,
      sortOrder: dto.sortOrder,
    });

    // Map to Read Model
    const data: JobTitleReadModel[] = result.data.map(entity => ({
      id: entity.id,
      nameZh: '',
      nameEn: '',
      status: entity.status,
      createdAt: entity.createdTime,
      updatedAt: entity.modifiedTime,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy,
      deletedAt: null,
      deletedBy: null,
    }));

    return {
      data,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async findById(id: string): Promise<JobTitleReadModel | null> {
    const entity = await this.jobTitleService.findById(id);
    if (!entity) {
      return null;
    }

    return {
      id: entity.id,
      nameZh: '',
      nameEn: '',
      status: entity.status,
      createdAt: entity.createdTime,
      updatedAt: entity.modifiedTime,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy,
      deletedAt: null,
      deletedBy: null,
    };
  }
}

