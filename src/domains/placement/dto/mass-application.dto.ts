import { ApplicationStatus } from "../types/application-status.enum";

/**
 * Base DTO for mass application operations [海投操作基础DTO]
 */
export interface MassApplicationBaseDto {
  id: string; // Application ID [申请ID]
  studentId: string; // Student ID [学生ID]
  indeedJobId: string; // Normalized Indeed job ID [清洗后的Indeed岗位ID]
  jobId?: string; // Original platform job ID [招聘平台原始岗位编号]
  status: ApplicationStatus; // Application status [申请状态]
  appliedAt: Date; // Application submission time [投递时间]
  createdAt: Date; // Record creation time [创建时间]
  updatedAt: Date; // Record update time [更新时间]
}

/**
 * DTO for single mass application creation [单条海投申请创建DTO]
 */
export interface CreateMassApplicationDto {
  studentId: string; // Student ID [学生ID]
  indeedJobId: string; // Normalized Indeed job ID [清洗后的Indeed岗位ID]
  jobId?: string; // Original platform job ID [招聘平台原始岗位编号]
  appliedAt?: Date; // Application submission time [投递时间]
}

/**
 * DTO for batch mass application creation [批量海投申请创建DTO]
 */
export interface CreateBatchMassApplicationDto {
  studentId: string; // Student ID [学生ID]
  applications: Array<{
    indeedJobId: string; // Normalized Indeed job ID [清洗后的Indeed岗位ID]
    jobId?: string; // Original platform job ID [招聘平台原始岗位编号]
    appliedAt?: Date; // Application submission time [投递时间]
  }>;
}

/**
 * DTO for updating application status [更新申请状态DTO]
 */
export interface UpdateApplicationStatusDto {
  applicationId: string; // Application ID [申请ID]
  newStatus: ApplicationStatus; // Target status [目标状态]
  updatedBy: string; // User performing the update [更新操作人]
}

/**
 * DTO for application rejection [申请拒绝DTO]
 */
export interface ProcessApplicationRejectionDto {
  applicationId: string; // Application ID [申请ID]
  rejectionReason?: string; // Reason for rejection [拒绝原因]
  rejectedBy: string; // User performing the rejection [拒绝操作人]
}

/**
 * DTO for interview invitation [面试邀请DTO]
 */
export interface ProcessInterviewInvitationDto {
  applicationId: string; // Application ID [申请ID]
  interviewDate: Date; // Interview date [面试日期]
  interviewLocation?: string; // Interview location [面试地点]
  interviewNotes?: string; // Additional notes [备注信息]
  invitedBy: string; // User sending the invitation [邀请操作人]
}

/**
 * DTO for offer processing [Offer处理DTO]
 */
export interface ProcessOfferDto {
  applicationId: string; // Application ID [申请ID]
  offerDetails?: {
    salary?: string; // Salary information [薪资信息]
    startDate?: Date; // Start date [入职日期]
    offerExpiryDate?: Date; // Offer expiry date [Offer过期日期]
  };
  offeredBy: string; // User processing the offer [操作人]
}

/**
 * DTO for application expiration [申请过期DTO]
 */
export interface ExpireApplicationDto {
  applicationId: string; // Application ID [申请ID]
  expiryReason: string; // Reason for expiration [过期原因]
  expiredBy: string; // User performing the expiration [过期操作人]
}

/**
 * DTO for application query results [申请查询结果DTO]
 */
export interface QueryMassApplicationsDto {
  studentId?: string; // Filter by student [按学生筛选]
  status?: ApplicationStatus; // Filter by status [按状态筛选]
  limit?: number; // Maximum number of records [最大记录数]
  offset?: number; // Pagination offset [分页偏移量]
}

/**
 * DTO for paginated results [分页结果DTO]
 */
export interface PaginatedResult<T> {
  items: T[]; // Result items [结果项]
  total: number; // Total count [总数量]
  limit: number; // Page size [每页数量]
  offset: number; // Current offset [当前偏移]
}

/**
 * DTO for batch operation results [批量操作结果DTO]
 */
export interface BatchOperationResult {
  batchId: string; // Batch operation ID [批次ID]
  totalCount: number; // Total number of applications [总申请数]
  successCount: number; // Number of successful applications [成功数]
  failedCount: number; // Number of failed applications [失败数]
  applications: MassApplicationBaseDto[]; // Successful applications [成功申请列表]
  failures: Array<{
    indeedJobId: string; // Failed job ID [失败岗位ID]
    reason: string; // Failure reason [失败原因]
  }>; // Failed applications [失败申请列表]
}

/**
 * DTO for application statistics [申请统计DTO]
 */
export interface ApplicationStatsDto {
  studentId: string; // Student ID [学生ID]
  totalApplications: number; // Total number of applications [总申请数]
  statusBreakdown: Record<ApplicationStatus, number>; // Breakdown by status [按状态统计]
  recentApplications: MassApplicationBaseDto[]; // Recent applications [最近申请]
}
