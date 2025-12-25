/**
 * Job Application Query Repository Interface
 * 投递申请查询仓储接口
 * 
 * Application Layer defines the interface, Infrastructure Layer provides implementation
 * 应用层定义接口，基础设施层提供实现
 */
import { IPaginatedResult } from '@shared/types/paginated-result';
import { JobApplicationReadModel } from '../models/job-application-read.model';
import { QueryJobApplicationsDto } from '../dto/query-job-applications.dto';

/**
 * DI Token for Job Application Query Repository
 */
export const JOB_APPLICATION_QUERY_REPOSITORY = Symbol('JOB_APPLICATION_QUERY_REPOSITORY');

/**
 * Job Application Query Repository Interface
 */
export interface IJobApplicationQueryRepository {
  /**
   * Query job applications with filters, pagination and sorting
   * 带筛选、分页和排序的投递申请查询
   * 
   * @param dto - Query input containing filter, pagination and sort
   * @returns Paginated job application results with unified pagination structure
   */
  queryJobApplications(dto: QueryJobApplicationsDto): Promise<IPaginatedResult<JobApplicationReadModel>>;
}

