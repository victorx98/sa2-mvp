import {
  ISubmitApplicationDto,
  IRecommendReferralApplicationsBatchDto,
  IUpdateApplicationStatusDto,
  IJobApplicationSearchFilter,
  IRollbackApplicationStatusDto,
} from "@api/dto/request/placement/placement.index";
import { IPaginatedResult, IServiceResult } from "./job-position.interface";
import { IPaginationQuery, ISortQuery } from "@shared/types/pagination.types";
import { ApplicationStatus, ApplicationType } from "@domains/placement/types";

/**
 * Strict query parameters for finding job applications [投递申请严格查询参数]
 * Defines allowed fields for findOne operations [定义findOne操作允许的字段]
 */
export interface IJobApplicationQueryParams {
  id?: string; // Application ID [申请ID]
  studentId?: string; // Student ID [学生ID]
  jobId?: string; // Job ID [岗位ID]
  status?: ApplicationStatus; // Application status [申请状态]
  applicationType?: ApplicationType; // Application type [申请类型]
}

/**
 * Job application service interface [投递服务接口]
 * Defines operations for job application lifecycle management [定义投递申请生命周期管理操作]
 */
export interface IJobApplicationService {
  /**
   * Submit a job application [提交投递申请]
   *
   * @param dto - Submit application DTO [提交申请DTO]
   * @returns Service result with created application and events [带创建申请和事件的服务结果]
   */
  submitApplication(
    dto: ISubmitApplicationDto,
  ): Promise<IServiceResult<Record<string, unknown>, Record<string, unknown>>>;

  /**
   * Batch recommend referral applications (counselor -> students) [批量内推推荐（顾问 -> 学生）]
   * - All-or-nothing: any validation failure rolls back all inserts [全成功：任一校验失败则整体回滚]
   */
  recommendReferralApplicationsBatch(
    dto: IRecommendReferralApplicationsBatchDto,
  ): Promise<
    IServiceResult<{ items: Record<string, unknown>[] }, Record<string, unknown>>
  >;

  /**
   * Update application status [更新投递状态]
   *
   * @param dto - Update status DTO [更新状态DTO]
   * @returns Service result with updated application and events [带更新申请和事件的服务结果]
   */
  updateApplicationStatus(
    dto: IUpdateApplicationStatusDto,
  ): Promise<IServiceResult<Record<string, unknown>, Record<string, unknown>>>;

  /**
   * Search applications [搜索投递申请]
   *
   * @param filter - Search filter criteria [搜索筛选条件]
   * @param pagination - Pagination parameters [分页参数]
   * @param sort - Sorting parameters [排序参数]
   * @returns Paginated applications [分页投递列表]
   */
  search(
    filter?: IJobApplicationSearchFilter,
    pagination?: IPaginationQuery,
    sort?: ISortQuery,
  ): Promise<IPaginatedResult<IJobApplicationSearchFilter>>;

  /**
   * Get application [获取投递申请]
   *
   * @param params - Query parameters [查询参数]
   * @returns Application [投递申请]
   */
  findOne(params: IJobApplicationQueryParams): Promise<Record<string, unknown>>;

  /**
   * Get application status history [获取投递状态历史]
   *
   * @param applicationId - Application ID [申请ID]
   * @returns Status history [状态历史]
   */
  getStatusHistory(applicationId: string): Promise<Record<string, unknown>[]>;

  /**
   * Rollback application status to previous state [回撤申请状态到上一个状态]
   *
   * @param dto - Rollback application status DTO [回撤状态DTO]
   * @returns Service result with updated application and events [带更新申请和事件的服务结果]
   */
  rollbackApplicationStatus(
    dto: IRollbackApplicationStatusDto,
  ): Promise<IServiceResult<Record<string, unknown>, Record<string, unknown>>>;
}
