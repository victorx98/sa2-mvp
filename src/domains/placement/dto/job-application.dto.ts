import { ApplicationStatus, ApplicationType } from '../types';

/**
 * DTO for submitting a job application [提交投递申请DTO]
 */
export interface ISubmitApplicationDto {
  studentId: string; // Student ID [学生ID]
  jobId: string; // Job position ID [岗位ID]
  applicationType: ApplicationType; // Application type [申请类型]
  coverLetter?: string; // Cover letter [求职信]
  customAnswers?: Record<string, any>; // Custom question answers [自定义问题回答]
  isUrgent?: boolean; // Urgent application flag [加急申请标记]
}

/**
 * DTO for mentor screening [内推导师评估DTO]
 */
export interface ISubmitMentorScreeningDto {
  applicationId: string; // Application ID [申请ID]
  mentorId: string; // Mentor ID [导师ID]
  technicalSkills: number; // Technical skills score (1-5) [技术技能评分]
  experienceMatch: number; // Experience match score (1-5) [经验匹配度评分]
  culturalFit: number; // Cultural fit score (1-5) [文化适应度评分]
  overallRecommendation: "strongly_recommend" | "recommend" | "neutral" | "not_recommend"; // Overall recommendation level [整体推荐度]
  screeningNotes?: string; // Screening notes [评估备注]
}

/**
 * DTO for updating application status [更新投递状态DTO]
 */
export interface IUpdateApplicationStatusDto {
  applicationId: string; // Application ID [申请ID]
  newStatus: ApplicationStatus; // New status [新状态]
  changedBy?: string; // Changer ID [变更人ID]
  changeReason?: string; // Change reason [变更原因]
  changeMetadata?: Record<string, any>; // Change metadata [变更元数据]
}

/**
 * Filter interface for searching job applications [搜索投递申请筛选接口]
 */
export interface IJobApplicationSearchFilter {
  studentId?: string; // Filter by student [按学生筛选]
  jobId?: string; // Filter by job [按岗位筛选]
  status?: ApplicationStatus; // Filter by status [按状态筛选]
  applicationType?: ApplicationType; // Filter by application type [按申请类型筛选]
}

/**
 * DTO for application query [投递查询DTO]
 */
export interface IQueryApplicationsDto {
  studentId?: string; // Filter by student [按学生筛选]
  jobId?: string; // Filter by job [按岗位筛选]
  status?: ApplicationStatus; // Filter by status [按状态筛选]
  applicationType?: ApplicationType; // Filter by application type [按申请类型筛选]
  offset?: number; // Pagination offset [分页偏移]
  limit?: number; // Page size [每页数量]
}
