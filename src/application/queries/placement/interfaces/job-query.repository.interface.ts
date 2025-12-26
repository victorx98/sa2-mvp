/**
 * Job Query Repository Interface
 * 岗位查询仓储接口
 * 
 * Application Layer defines the interface, Infrastructure Layer provides implementation
 * 应用层定义接口，基础设施层提供实现
 */
import { IPaginatedResult } from '@shared/types/paginated-result';
import { JobReadModel } from '../models/job-read.model';
import { QueryJobsDto } from '../dto/query-jobs.dto';

/**
 * DI Token for Job Query Repository
 */
export const JOB_QUERY_REPOSITORY = Symbol('JOB_QUERY_REPOSITORY');

/**
 * Job Query Repository Interface
 */
export interface IJobQueryRepository {
  /**
   * Query jobs with filters, pagination and sorting
   * 带筛选、分页和排序的岗位查询
   * 
   * @param dto - Query input containing filter, pagination and sort
   * @returns Paginated job results with unified pagination structure
   */
  queryJobs(dto: QueryJobsDto): Promise<IPaginatedResult<JobReadModel>>;
}

