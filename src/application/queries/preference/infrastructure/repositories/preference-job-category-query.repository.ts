/**
 * Preference Job Category Query Repository Implementation
 * 参考数据-岗位类别查询仓储实现
 * 
 * Delegates to domain repository for data access
 */
import { Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IJobCategoryQueryRepository } from '../../interfaces/job-category-query.repository.interface';
import { JobCategoryReadModel } from '../../models/job-category-read.model';
import { ListJobCategoriesDto } from '../../dto/preference-query.dto';
import { JobCategoryService } from '@domains/preference/services/job-category.service';

@Injectable()
export class PreferenceJobCategoryQueryRepository implements IJobCategoryQueryRepository {
  constructor(
    private readonly jobCategoryService: JobCategoryService,
  ) {}

  async listJobCategories(dto: ListJobCategoriesDto): Promise<IPaginatedResult<JobCategoryReadModel>> {
    const result = await this.jobCategoryService.findAll({
      status: dto.status,
      keyword: dto.keyword,
      page: dto.page,
      pageSize: dto.pageSize,
      sortBy: dto.sortBy,
      sortOrder: dto.sortOrder,
    });

    // Map to Read Model (in this case, the entity already matches the read model structure)
    const data: JobCategoryReadModel[] = result.data.map(entity => ({
      id: entity.id,
      nameZh: entity.nameZh,
      nameEn: entity.nameEn,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy,
      deletedAt: entity.deletedAt,
      deletedBy: entity.deletedBy,
    }));

    return {
      data,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async findById(id: string): Promise<JobCategoryReadModel | null> {
    const entity = await this.jobCategoryService.findById(id);
    if (!entity) {
      return null;
    }

    return {
      id: entity.id,
      nameZh: entity.nameZh,
      nameEn: entity.nameEn,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy,
      deletedAt: entity.deletedAt,
      deletedBy: entity.deletedBy,
    };
  }
}

