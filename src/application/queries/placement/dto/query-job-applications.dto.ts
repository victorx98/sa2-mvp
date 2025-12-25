/**
 * Query Job Applications DTO (Application Layer Internal)
 * 投递申请查询输入DTO（应用层内部）
 * 
 * No validation decorators - validation is done at API layer
 * 不包含校验装饰器 - 校验在 API 层完成
 */

/**
 * Job application query filter
 */
export interface JobApplicationQueryFilter {
  status?: string;
  applicationType?: string;
  studentId?: string;
  assignedMentorId?: string;
  recommendedBy?: string;
  startDate?: string;
  endDate?: string;
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
 * Query Job Applications DTO
 */
export interface QueryJobApplicationsDto {
  filter?: JobApplicationQueryFilter;
  pagination?: PaginationParams;
  sort?: SortParams;
}

