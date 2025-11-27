import {
  ISubmitApplicationDto,
  ISubmitMentorScreeningDto,
  IUpdateApplicationStatusDto,
  IQueryApplicationsDto,
} from "../dto";
import { IPaginatedResult } from "./job-position.interface";

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
  ): Promise<
    IServiceResult<
      Record<string, any>,
      Record<string, any>
    >
  >;

  /**
   * Submit mentor screening [提交内推导师评估]
   *
   * @param dto - Mentor screening DTO [导师评估DTO]
   * @returns Service result with updated application and events [带更新申请和事件的服务结果]
   */
  submitMentorScreening(
    dto: ISubmitMentorScreeningDto,
  ): Promise<
    IServiceResult<
      Record<string, any>,
      Record<string, any>
    >
  >;

  /**
   * Update application status [更新投递状态]
   *
   * @param dto - Update status DTO [更新状态DTO]
   * @returns Service result with updated application and events [带更新申请和事件的服务结果]
   */
  updateApplicationStatus(
    dto: IUpdateApplicationStatusDto,
  ): Promise<
    IServiceResult<
      Record<string, any>,
      Record<string, any>
    >
  >;

  /**
   * Query applications [查询投递申请]
   *
   * @param dto - Query criteria [查询条件]
   * @returns Paginated applications [分页投递列表]
   */
  queryApplications(dto: IQueryApplicationsDto): Promise<IPaginatedResult<Record<string, any>>>;

  /**
   * Get application by ID [根据ID获取投递申请]
   *
   * @param id - Application ID [申请ID]
   * @returns Application [投递申请]
   */
  findOneById(id: string): Promise<Record<string, any>>;

  /**
   * Get application status history [获取投递状态历史]
   *
   * @param applicationId - Application ID [申请ID]
   * @returns Status history [状态历史]
   */
  getStatusHistory(applicationId: string): Promise<Array<Record<string, any>>>;
}
