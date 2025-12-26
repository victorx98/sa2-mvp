/**
 * Job Category Query Repository Interface
 * 岗位类别查询仓储接口
 */
import { IPaginatedResult } from '@shared/types/paginated-result';
import { JobCategoryReadModel } from '../models/job-category-read.model';
import { ListJobCategoriesDto } from '../dto/preference-query.dto';

/**
 * DI Token for Job Category Query Repository
 */
export const JOB_CATEGORY_QUERY_REPOSITORY = Symbol('JOB_CATEGORY_QUERY_REPOSITORY');

/**
 * Job Category Query Repository Interface
 */
export interface IJobCategoryQueryRepository {
  /**
   * List job categories with filters and pagination
   * 
   * @param dto - Query input
   * @returns Paginated job category results
   */
  listJobCategories(dto: ListJobCategoriesDto): Promise<IPaginatedResult<JobCategoryReadModel>>;

  /**
   * Find job category by ID
   * 
   * @param id - Job category ID
   * @returns Job category or null
   */
  findById(id: string): Promise<JobCategoryReadModel | null>;
}

