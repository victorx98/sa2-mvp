/**
 * DTO for placement job query [岗位查询DTO]
 * Structured to support the job table filtering requirements [结构支持岗位表格筛选需求]
 */
import { IPaginationQuery, ISortQuery } from '@shared/types/pagination.types';

/**
 * Date range filter [日期范围筛选]
 */
export interface IDateRangeFilter {
  start?: Date;
  end?: Date;
}

/**
 * Job query filter interface [岗位查询筛选接口]
 */
export interface IJobQueryFilter {
  // Basic filters [基础筛选]
  locations?: string[]; // Filter by locations [按地点筛选]
  jobTypes?: string[]; // Filter by job types [按职位类型筛选]
  level?: string; // Filter by level (Senior/Entry) [按级别筛选]
  jobTitles?: string[]; // Filter by job titles [按职位标题筛选]
  postDateRange?: IDateRangeFilter; // Filter by post date range [按发布日期范围筛选]
  keyword?: string; // Search keyword for job title or company [职位或公司搜索关键词]
  status?: string; // Filter by job status [按岗位状态筛选]
  
  // Advanced filters [高级筛选]
  h1b?: string; // Filter by H1B visa support [按H1B签证支持筛选]
  usCitizenship?: string; // Filter by US citizenship requirement [按美国公民身份要求筛选]
  jobApplicationTypes?: string[]; // Filter by application types (direct=海投, proxy=代投, referral=内推, bd=BD推荐) [按投递类型筛选]
}

/**
 * Job query parameters [岗位查询参数]
 */
export interface IJobQueryParams extends IJobQueryFilter, IPaginationQuery, ISortQuery {
  // Combines filter, pagination and sorting parameters [组合筛选、分页和排序参数]
}

/**
 * Paginated job results [分页岗位结果]
 */
export interface IPaginatedJobResults {
  items: Record<string, unknown>[]; // Job items [岗位列表]
  total: number; // Total number of jobs [岗位总数]
  page: number; // Current page [当前页码]
  pageSize: number; // Items per page [每页条数]
  totalPages: number; // Total pages [总页数]
}