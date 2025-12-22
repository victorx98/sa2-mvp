/**
 * Job Application Search Criteria (投递申请查询条件)
 * Defines filtering options for job application search operations (定义投递申请查询操作的过滤选项)
 */

import { JobApplication } from '../entities/job-application.entity';
import { ApplicationStatus } from '../value-objects/application-status.vo';

export interface JobApplicationSearchCriteria {
  /** Filter by student ID (按学生ID过滤) */
  studentId?: string;

  /** Filter by job ID (按岗位ID过滤) */
  jobId?: string;

  /** Filter by status (按状态过滤) */
  status?: string;

  /** Filter by application type (按申请类型过滤) */
  applicationType?: string;

  /** Filter by assigned mentor (按分配的导师过滤) */
  assignedMentorId?: string;

  /** Filter by recommender (按推荐人过滤) */
  recommendedBy?: string;

  /** Filter by submission date range (按提交日期范围过滤) */
  submittedAfter?: Date;

  /** Filter by submission date range (按提交日期范围过滤) */
  submittedBefore?: Date;

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
 * Job Application Search Result (投递申请查询结果)
 * Contains paginated job application data (包含分页的投递申请数据)
 */
export interface JobApplicationSearchResult {
  /** Array of job applications (投递申请数组) */
  data: JobApplication[];

  /** Total number of job applications matching the criteria (符合查询条件的总投递申请数) */
  total: number;

  /** Current page number (当前页码) */
  page: number;

  /** Page size (分页大小) */
  pageSize: number;

  /** Total number of pages (总页数) */
  totalPages: number;
}

/**
 * Dependency Injection Token for IJobApplicationRepository (IJobApplicationRepository的依赖注入令牌)
 */
export const JOB_APPLICATION_REPOSITORY = Symbol('JOB_APPLICATION_REPOSITORY');

/**
 * Job Application Repository Interface (投递申请仓储接口)
 * Defines data access operations for JobApplication aggregate (定义JobApplication聚合的数据访问操作)
 */
export interface IJobApplicationRepository {
  /**
   * Find job application by ID (通过ID查找投递申请)
   *
   * @param id - Application ID (申请ID)
   * @returns JobApplication or null if not found (投递申请实例或null)
   */
  findById(id: string): Promise<JobApplication | null>;

  /**
   * Find job applications by student ID (通过学生ID查找投递申请)
   *
   * @param studentId - Student ID (学生ID)
   * @returns Array of job applications (投递申请数组)
   */
  findByStudentId(studentId: string): Promise<JobApplication[]>;

  /**
   * Find job applications by job ID (通过岗位ID查找投递申请)
   *
   * @param jobId - Job ID (岗位ID)
   * @returns Array of job applications (投递申请数组)
   */
  findByJobId(jobId: string): Promise<JobApplication[]>;

  /**
   * Find job applications by student and job ID (通过学生和岗位ID查找投递申请)
   *
   * @param studentId - Student ID (学生ID)
   * @param jobId - Job ID (岗位ID)
   * @returns JobApplication or null if not found (投递申请实例或null)
   */
  findByStudentAndJob(studentId: string, jobId: string): Promise<JobApplication | null>;

  /**
   * Search job applications by criteria (根据条件搜索投递申请)
   *
   * @param criteria - Search criteria (查询条件)
   * @returns Search result with job applications (包含投递申请的查询结果)
   */
  search(criteria: JobApplicationSearchCriteria): Promise<JobApplicationSearchResult>;

  /**
   * Check if student has already applied to a job (检查学生是否已申请过某岗位)
   *
   * @param studentId - Student ID (学生ID)
   * @param jobId - Job ID (岗位ID)
   * @returns true if application exists (存在申请时返回true)
   */
  existsByStudentAndJob(studentId: string, jobId: string): Promise<boolean>;

  /**
   * Save a new job application (保存新投递申请)
   *
   * @param application - JobApplication to save (要保存的投递申请)
   * @returns Saved job application (已保存的投递申请)
   */
  save(application: JobApplication): Promise<JobApplication>;

  /**
   * Update an existing job application (更新现有投递申请)
   *
   * @param application - JobApplication to update (要更新的投递申请)
   * @returns Updated job application (更新后的投递申请)
   */
  update(application: JobApplication): Promise<JobApplication>;

  /**
   * Execute operations within a transaction (在事务中执行操作)
   *
   * @param fn - Function to execute within transaction (要在事务中执行的函数)
   * @returns Result of the transaction function (事务函数的结果)
   */
  withTransaction<T>(fn: (repo: IJobApplicationRepository) => Promise<T>): Promise<T>;
}
