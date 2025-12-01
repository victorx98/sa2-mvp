import {
  ISubmitApplicationDto,
  ISubmitMentorScreeningDto,
  IUpdateApplicationStatusDto,
  IJobApplicationSearchFilter,
} from "../dto";
import { IPaginatedResult, IServiceResult } from "./job-position.interface";
import { IPaginationQuery, ISortQuery } from "@shared/types/pagination.types";

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
  ): Promise<IServiceResult<Record<string, any>, Record<string, any>>>;

  /**
   * Submit mentor screening [提交内推导师评估]
   *
   * @param dto - Mentor screening DTO [导师评估DTO]
   * @returns Service result with updated application and events [带更新申请和事件的服务结果]
   */
  submitMentorScreening(
    dto: ISubmitMentorScreeningDto,
  ): Promise<IServiceResult<Record<string, any>, Record<string, any>>>;

  /**
   * Update application status [更新投递状态]
   *
   * @param dto - Update status DTO [更新状态DTO]
   * @returns Service result with updated application and events [带更新申请和事件的服务结果]
   */
  updateApplicationStatus(
    dto: IUpdateApplicationStatusDto,
  ): Promise<IServiceResult<Record<string, any>, Record<string, any>>>;

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
  ): Promise<IPaginatedResult<Record<string, any>>>;

  /**
   * Get application [获取投递申请]
   *
   * @param params - Search parameters [搜索参数]
   * @returns Application [投递申请]
   */
  findOne(params: {
    id?: string;
    [key: string]: any;
  }): Promise<Record<string, any>>;

  /**
   * Get application status history [获取投递状态历史]
   *
   * @param applicationId - Application ID [申请ID]
   * @returns Status history [状态历史]
   */
  getStatusHistory(applicationId: string): Promise<Array<Record<string, any>>>;

  /**
   * Rollback application status to previous state [回撤申请状态到上一个状态]
   *
   * @param applicationId - Application ID [申请ID]
   * @param changedBy - User ID who initiated the rollback [发起回撤的用户ID]
   * @returns Service result with updated application and events [带更新申请和事件的服务结果]
   */
  rollbackApplicationStatus(
    applicationId: string,
    changedBy: string,
  ): Promise<IServiceResult<Record<string, any>, Record<string, any>>>;
}
