/**
 * Mass Application Service Interface [海投申请服务接口]
 * Defines the contract for mass application operations in the placement domain
 * [定义投岗域中海投申请操作的契约]
 */

import { ApplicationStatus } from "../types/application-status.enum";
import {
  MassApplicationBaseDto,
  CreateMassApplicationDto,
  CreateBatchMassApplicationDto,
  UpdateApplicationStatusDto,
  ProcessApplicationRejectionDto,
  ProcessInterviewInvitationDto,
  ProcessOfferDto,
  ExpireApplicationDto,
  QueryMassApplicationsDto,
  PaginatedResult,
  BatchOperationResult,
  ApplicationStatsDto,
} from "../dto/mass-application.dto";

/**
 * Interface for mass application service [海投申请服务接口]
 */
export interface IMassApplicationService {
  /**
   * Create a single mass application [创建单条海投申请]
   *
   * @param dto - Create application DTO [创建申请DTO]
   * @returns Created application [创建成功的申请]
   */
  createApplication(dto: CreateMassApplicationDto): Promise<MassApplicationBaseDto>;

  /**
   * Create batch mass applications [批量创建海投申请]
   *
   * @param dto - Batch creation DTO [批量创建DTO]
   * @returns Batch operation result [批量操作结果]
   */
  createBatchApplications(dto: CreateBatchMassApplicationDto): Promise<BatchOperationResult>;

  /**
   * Update application status [更新申请状态]
   *
   * @param dto - Update status DTO [状态更新DTO]
   * @returns Updated application [更新后的申请]
   */
  updateApplicationStatus(dto: UpdateApplicationStatusDto): Promise<MassApplicationBaseDto>;

  /**
   * Get application by ID [根据ID获取申请]
   *
   * @param applicationId - Application ID [申请ID]
   * @returns Application details [申请详情]
   */
  getApplicationById(applicationId: string): Promise<MassApplicationBaseDto>;

  /**
   * Query applications with filters [查询申请列表（带筛选）]
   *
   * @param query - Query parameters [查询参数]
   * @returns Paginated results [分页结果]
   */
  queryApplications(query: QueryMassApplicationsDto): Promise<PaginatedResult<MassApplicationBaseDto>>;

  /**
   * Get application statistics [获取申请统计]
   *
   * @param studentId - Student ID [学生ID]
   * @returns Application statistics [申请统计]
   */
  getApplicationStats(studentId: string): Promise<ApplicationStatsDto>;

  /**
   * Process application rejection [处理申请拒绝]
   *
   * @param dto - Rejection DTO [拒绝DTO]
   * @returns Updated application [更新后的申请]
   */
  processApplicationRejection(dto: ProcessApplicationRejectionDto): Promise<MassApplicationBaseDto>;

  /**
   * Process interview invitation [处理面试邀请]
   *
   * @param dto - Interview invitation DTO [面试邀请DTO]
   * @returns Updated application [更新后的申请]
   */
  processInterviewInvitation(dto: ProcessInterviewInvitationDto): Promise<MassApplicationBaseDto>;

  /**
   * Process offer received [处理收到offer]
   *
   * @param dto - Offer DTO [Offer DTO]
   * @returns Updated application [更新后的申请]
   */
  processOfferReceived(dto: ProcessOfferDto): Promise<MassApplicationBaseDto>;

  /**
   * Expire application [使申请过期]
   *
   * @param dto - Expiration DTO [过期DTO]
   * @returns Updated application [更新后的申请]
   */
  expireApplication(dto: ExpireApplicationDto): Promise<MassApplicationBaseDto>;

  /**
   * Check if application exists [检查申请是否存在]
   *
   * @param applicationId - Application ID [申请ID]
   * @returns boolean indicating existence [布尔值表示是否存在]
   */
  applicationExists(applicationId: string): Promise<boolean>;

  /**
   * Validate if a student can apply to a job [验证学生是否可以申请某岗位]
   *
   * @param studentId - Student ID [学生ID]
   * @param indeedJobId - Indeed job ID [Indeed岗位ID]
   * @returns boolean indicating if application is allowed [布尔值表示是否可以申请]
   */
  canApply(studentId: string, indeedJobId: string): Promise<boolean>;
}

export default IMassApplicationService;
