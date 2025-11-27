/**
 * DTO for creating a job position [创建岗位DTO]
 */
export interface ICreateJobPositionDto {
  title: string; // Job title [岗位标题]
  companyName: string; // Company name [公司名称]
  description?: string; // Job description [岗位描述]
  requirements?: Record<string, any>; // Job requirements [岗位要求]
  responsibilities?: string; // Job responsibilities [岗位职责]
  jobType?: string; // Job type [岗位类型]
  experienceLevel?: string; // Experience level [经验等级]
  industry?: string; // Industry [行业]
  locations?: Array<Record<string, any>>; // Location list [地点列表]
  remoteType?: string; // Remote type [远程类型]
  salaryMin?: number; // Minimum salary [最低薪资]
  salaryMax?: number; // Maximum salary [最高薪资]
  salaryCurrency?: string; // Salary currency [薪资货币]
  postedDate?: Date; // Post date [发布日期]
  expiryDate?: Date; // Expiry date [过期日期]
  source: string; // Data source [数据来源]
  jobSource: "web" | "bd"; // Job source [岗位来源]
  sourceUrl?: string; // Original link [原始链接]
  sourceJobId?: string; // Original platform job ID [原始平台岗位ID]
  aiAnalysis?: Record<string, any>; // AI analysis results [AI分析结果]
  qualityScore?: number; // Job quality score [岗位质量评分]
  createdBy: string; // Creator ID [创建人ID]
}

/**
 * DTO for searching job positions [搜索岗位DTO]
 */
export interface ISearchJobPositionsDto {
  status?: "active" | "inactive" | "expired"; // Filter by status [按状态筛选]
  companyName?: string; // Filter by company [按公司筛选]
  locations?: string[]; // Filter by location [按地点筛选]
  jobType?: string; // Filter by job type [按岗位类型筛选]
  experienceLevel?: string; // Filter by experience level [按经验等级筛选]
  industry?: string; // Filter by industry [按行业筛选]
  offset?: number; // Pagination offset [分页偏移]
  limit?: number; // Page size [每页数量]
}

/**
 * DTO for marking a job as expired [标记岗位过期DTO]
 */
export interface IMarkJobExpiredDto {
  jobId: string; // Job ID [岗位ID]
  expiredBy: string; // Person who marks expired [过期操作人]
  expiredByType: "student" | "mentor" | "counselor" | "bd"; // Type of person [过期人类型]
  reason?: string; // Expiration reason [过期原因]
}
