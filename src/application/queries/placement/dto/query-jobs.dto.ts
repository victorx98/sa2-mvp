/**
 * Query Jobs DTO (Application Layer Internal)
 * 岗位查询输入DTO（应用层内部）
 * 
 * No validation decorators - validation is done at API layer
 * 不包含校验装饰器 - 校验在 API 层完成
 */

/**
 * Date range filter
 */
export interface DateRangeFilter {
  start?: Date;
  end?: Date;
}

/**
 * Job query filter
 */
export interface JobQueryFilter {
  // Basic filters
  location?: string;
  jobType?: string;
  level?: string;
  jobTitles?: string[];
  postDateRange?: DateRangeFilter;
  keyword?: string;
  status?: string;
  
  // Advanced filters
  h1b?: string;
  usCitizenship?: string;
  jobApplicationType: string; // Required
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/**
 * Sort parameters
 */
export interface SortParams {
  field?: string;
  direction?: 'asc' | 'desc';
}

/**
 * Query Jobs DTO
 */
export interface QueryJobsDto {
  filter?: JobQueryFilter;
  pagination?: PaginationParams;
  sort?: SortParams;
}

