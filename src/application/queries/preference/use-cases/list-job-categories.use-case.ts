/**
 * List Job Categories Use Case
 * 岗位类别列表查询用例
 */
import { Inject, Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IJobCategoryQueryRepository, JOB_CATEGORY_QUERY_REPOSITORY } from '../interfaces/job-category-query.repository.interface';
import { JobCategoryReadModel } from '../models/job-category-read.model';
import { ListJobCategoriesDto } from '../dto/preference-query.dto';

@Injectable()
export class ListJobCategoriesUseCase {
  constructor(
    @Inject(JOB_CATEGORY_QUERY_REPOSITORY)
    private readonly jobCategoryQueryRepository: IJobCategoryQueryRepository,
  ) {}

  async execute(dto: ListJobCategoriesDto): Promise<IPaginatedResult<JobCategoryReadModel>> {
    return this.jobCategoryQueryRepository.listJobCategories(dto);
  }

  async findById(id: string): Promise<JobCategoryReadModel | null> {
    return this.jobCategoryQueryRepository.findById(id);
  }
}

