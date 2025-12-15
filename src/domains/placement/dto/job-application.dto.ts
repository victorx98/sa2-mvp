import { ApplicationStatus, ApplicationType } from "../types";

/**
 * DTO for submitting a job application [提交投递申请DTO]
 */
export interface ISubmitApplicationDto {
  studentId: string; // Student ID [学生ID]
  jobId: string; // Job position ID (UUID) [岗位ID（UUID）]
  applicationType: ApplicationType; // Application type [申请类型]
  coverLetter?: string; // Cover letter [求职信]
}

/**
 * DTO for batch recommending referral applications (counselor -> students) [批量内推推荐DTO（顾问 -> 学生）]
 * - All-or-nothing transaction: any failure rolls back all inserts [全成功事务：任一失败则整体回滚]
 */
export interface IRecommendReferralApplicationsBatchDto {
  recommendedBy: string; // Recommender user ID (counselor) [推荐人ID（顾问）]
  studentIds: string[]; // Student IDs [学生ID列表]
  jobIds: string[]; // Recommended job IDs [岗位ID列表]
}

/**
 * DTO for updating application status [更新投递状态DTO]
 */
export interface IUpdateApplicationStatusDto {
  applicationId: string; // Application ID [申请ID]
  newStatus: ApplicationStatus; // New status [新状态]
  changedBy?: string; // Changer ID [变更人ID]
  changeReason?: string; // Change reason [变更原因]
  changeMetadata?: Record<string, unknown>; // Change metadata [变更元数据]
  mentorId?: string; // Mentor assigned to this referral application (optional) [推荐申请的导师ID（可选）]
}

/**
 * Date range filter for recommendation time [推荐时间范围筛选]
 */
export interface IRecommendedAtRangeFilter {
  start?: Date; // Start date [开始日期]
  end?: Date; // End date [结束日期]
}

/**
 * Filter interface for searching job applications [搜索投递申请筛选接口]
 */
export interface IJobApplicationSearchFilter {
  studentId?: string; // Filter by student [按学生筛选]
  jobId?: string; // Filter by job (UUID) [按岗位筛选（UUID）]
  status?: ApplicationStatus; // Filter by status [按状态筛选]
  applicationType?: ApplicationType; // Filter by application type [按申请类型筛选]
  assignedMentorId?: string; // Filter by assigned mentor [按分配的导师筛选]
  recommendedBy?: string; // Filter by recommender [按推荐人筛选]
  recommendedAtRange?: IRecommendedAtRangeFilter; // Filter by recommendation time range [按推荐时间范围筛选]
}

/**
 * DTO for application query [投递查询DTO]
 */
export interface IQueryApplicationsDto {
  studentId?: string; // Filter by student [按学生筛选]
  jobId?: string; // Filter by job (UUID) [按岗位筛选（UUID）]
  status?: ApplicationStatus; // Filter by status [按状态筛选]
  applicationType?: ApplicationType; // Filter by application type [按申请类型筛选]
  offset?: number; // Pagination offset [分页偏移]
  limit?: number; // Page size [每页数量]
}

/**
 * DTO for rolling back application status [回撤投递状态DTO]
 */
export interface IRollbackApplicationStatusDto {
  applicationId: string; // Application ID [申请ID]
  changedBy: string; // User ID who initiated the rollback [发起回撤的用户ID]
  mentorId?: string; // Mentor assigned to this referral application (optional) [推荐申请的导师ID（可选）]
}
