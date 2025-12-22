/**
 * Job Position Search Criteria (岗位查询条件)
 * Defines filtering options for job position search operations (定义岗位查询操作的过滤选项)
 */

import { JobPosition } from '../entities/job-position.entity';
import { JobStatusVO } from '../value-objects/job-status.vo';

export interface JobPositionSearchCriteria {
  /** Filter by status (按状态过滤) */
  status?: string;

  /** Filter by company name containing text (按公司名称包含文本过滤) */
  companyNameContains?: string;

  /** Filter by job title containing text (按岗位标题包含文本过滤) */
  titleContains?: string;

  /** Filter by location (按地点过滤) */
  location?: string;

  /** Filter by job type (按职位类型过滤) */
  jobType?: string;

  /** Filter by H1B status (按H1B状态过滤) */
  h1bStatus?: string;

  /** Filter by country code (按国家代码过滤) */
  countryCode?: string;

  /** Filter by open for applications (只显示可申请) */
  openForApplications?: boolean;

  /** Page number for pagination (分页页码) */
  page?: number;

  /** Page size for pagination (分页大小) */
  pageSize?: number;

  /** Sort field (排序字段) */
  sortBy?: string;

  /** Sort order (ASC/DESC) (排序顺序) */
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Job Position Search Result (岗位查询结果)
 * Contains paginated job position data (包含分页的岗位数据)
 */
export interface JobPositionSearchResult {
  /** Array of job positions (岗位数组) */
  data: JobPosition[];

  /** Total number of job positions matching the criteria (符合查询条件的总岗位数) */
  total: number;

  /** Current page number (当前页码) */
  page: number;

  /** Page size (分页大小) */
  pageSize: number;

  /** Total number of pages (总页数) */
  totalPages: number;
}

/**
 * Dependency Injection Token for IJobPositionRepository (IJobPositionRepository的依赖注入令牌)
 */
export const JOB_POSITION_REPOSITORY = Symbol('JOB_POSITION_REPOSITORY');

/**
 * Job Position Repository Interface (岗位仓储接口)
 * Defines data access operations for JobPosition aggregate (定义JobPosition聚合的数据访问操作)
 */
export interface IJobPositionRepository {
  /**
   * Find job position by ID (通过ID查找岗位)
   *
   * @param id - Job position ID (岗位ID)
   * @returns JobPosition or null if not found (岗位实例或null)
   */
  findById(id: string): Promise<JobPosition | null>;

  /**
   * Find job positions by company name (通过公司名称查找岗位)
   *
   * @param companyName - Company name (公司名称)
   * @returns Array of job positions (岗位数组)
   */
  findByCompanyName(companyName: string): Promise<JobPosition[]>;

  /**
   * Find job positions by job ID (external ID) (通过job ID查找岗位)
   *
   * @param jobId - External job ID (外部岗位ID)
   * @returns JobPosition or null if not found (岗位实例或null)
   */
  findByJobId(jobId: string): Promise<JobPosition | null>;

  /**
   * Find job positions by object ID (通过对象ID查找岗位)
   *
   * @param objectId - Unique object identifier (唯一对象标识符)
   * @returns JobPosition or null if not found (岗位实例或null)
   */
  findByObjectId(objectId: string): Promise<JobPosition | null>;

  /**
   * Search job positions by criteria (根据条件搜索岗位)
   *
   * @param criteria - Search criteria (查询条件)
   * @returns Search result with job positions (包含岗位的查询结果)
   */
  search(criteria: JobPositionSearchCriteria): Promise<JobPositionSearchResult>;

  /**
   * Save a new job position (保存新岗位)
   *
   * @param jobPosition - JobPosition to save (要保存的岗位)
   * @returns Saved job position (已保存的岗位)
   */
  save(jobPosition: JobPosition): Promise<JobPosition>;

  /**
   * Update an existing job position (更新现有岗位)
   *
   * @param jobPosition - JobPosition to update (要更新的岗位)
   * @returns Updated job position (更新后的岗位)
   */
  update(jobPosition: JobPosition): Promise<JobPosition>;

  /**
   * Execute operations within a transaction (在事务中执行操作)
   *
   * @param fn - Function to execute within transaction (要在事务中执行的函数)
   * @returns Result of the transaction function (事务函数的结果)
   */
  withTransaction<T>(fn: (repo: IJobPositionRepository) => Promise<T>): Promise<T>;
}
