/**
 * Job Title Query Repository Interface
 * 岗位名称查询仓储接口
 */
import { IPaginatedResult } from '@shared/types/paginated-result';
import { JobTitleReadModel } from '../models/job-title-read.model';
import { ListJobTitlesDto } from '../dto/preference-query.dto';

/**
 * DI Token for Job Title Query Repository
 */
export const JOB_TITLE_QUERY_REPOSITORY = Symbol('JOB_TITLE_QUERY_REPOSITORY');

/**
 * Job Title Query Repository Interface
 */
export interface IJobTitleQueryRepository {
  /**
   * List job titles with filters and pagination
   * 
   * @param dto - Query input
   * @returns Paginated job title results
   */
  listJobTitles(dto: ListJobTitlesDto): Promise<IPaginatedResult<JobTitleReadModel>>;

  /**
   * Find job title by ID
   * 
   * @param id - Job title ID
   * @returns Job title or null
   */
  findById(id: string): Promise<JobTitleReadModel | null>;
}

