import {
  ICreateJobPositionDto,
  IMarkJobExpiredDto,
  IJobPositionSearchFilter,
} from "../dto";
import { IPaginationQuery, ISortQuery } from "@shared/types/pagination.types";

/**
 * Service result with event [带事件的服务结果]
 */
export interface IServiceResult<T, E = unknown> {
  data: T; // Main data [主要数据]
  event?: {
    type: string; // Event type [事件类型]
    payload: E; // Event payload [事件载荷]
  }; // Event [事件]
  events?: Array<{
    type: string; // Event type [事件类型]
    payload: E; // Event payload [事件载荷]
  }>; // Multiple events [多个事件]
}

// Re-export for convenience
// 为方便使用重新导出
export type IPaginatedResult<T> = {
  items: T[]; // Result items [结果项]
  total: number; // Total count [总数量]
  offset: number; // Current offset [当前偏移]
  limit: number; // Page size [每页数量]
};

/**
 * Job position service interface [岗位服务接口]
 * Defines operations for job position lifecycle management [定义岗位生命周期管理操作]
 */
export interface IJobPositionService {
  /**
   * Create a new job position [创建新岗位]
   *
   * @param dto - Create job position DTO [创建岗位DTO]
   * @returns Service result with created job and events [带创建岗位和事件的服务结果]
   */
  createJobPosition(
    dto: ICreateJobPositionDto,
  ): Promise<IServiceResult<Record<string, any>, Record<string, any>>>;

  /**
   * Find a job position [查找岗位]
   *
   * @param params - Search parameters [搜索参数]
   * @returns Job position [岗位]
   */
  findOne(params: {
    id?: string;
    [key: string]: any;
  }): Promise<Record<string, any>>;

  /**
   * Search job positions [搜索岗位]
   *
   * @param filter - Search filter criteria [搜索筛选条件]
   * @param pagination - Pagination parameters [分页参数]
   * @param sort - Sorting parameters [排序参数]
   * @returns Paginated job positions [分页岗位列表]
   */
  search(
    filter?: IJobPositionSearchFilter,
    pagination?: IPaginationQuery,
    sort?: ISortQuery,
  ): Promise<IPaginatedResult<Record<string, any>>>;

  /**
   * Mark a job position as expired [标记岗位过期]
   *
   * @param dto - Mark job expired DTO [标记过期DTO]
   * @returns Service result with updated job and events [带更新岗位和事件的服务结果]
   */
  markJobExpired(
    dto: IMarkJobExpiredDto,
  ): Promise<IServiceResult<Record<string, any>, Record<string, any>>>;
}
