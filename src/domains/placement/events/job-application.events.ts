/**
 * Job application submitted event [投递申请事件]
 * Published when a job application is submitted [发布投递申请时]
 */
export const JOB_APPLICATION_SUBMITTED_EVENT = "placement.application.submitted";

/**
 * Interface for job application submitted event payload [投递申请事件载荷接口]
 */
export interface JobApplicationSubmittedEvent {
  applicationId: string; // Application ID [申请ID]
  studentId: string; // Student ID [学生ID]
  positionId: string; // Position ID [岗位ID]
  applicationType: "direct" | "counselor_assisted" | "mentor_referral" | "bd_referral"; // Application type [申请类型]
  submittedAt: string; // Submission time [提交时间]
}

/**
 * Job application status changed event [投递状态变更事件]
 * Published when a job application status changes [发布投递状态变更时]
 */
export const JOB_APPLICATION_STATUS_CHANGED_EVENT = "placement.application.status_changed";

/**
 * Interface for job application status changed event payload [投递状态变更事件载荷接口]
 */
export interface JobApplicationStatusChangedEvent {
  applicationId: string; // Application ID [申请ID]
  previousStatus:
    | "recommended"
    | "interested"
    | "not_interested"
    | "mentor_assigned"
    | "submitted"
    | "interviewed"
    | "got_offer"
    | "rejected"
    | "withdrawn"; // Previous status [之前状态]
  newStatus:
    | "recommended"
    | "interested"
    | "not_interested"
    | "mentor_assigned"
    | "submitted"
    | "interviewed"
    | "got_offer"
    | "rejected"
    | "withdrawn"; // New status [新状态]
  changedBy?: string; // Changer ID [变更人ID]
  changedAt: string; // Change time [变更时间]
  changeMetadata?: {
    interviewDate?: string;
    interviewLocation?: string;
    offerDetails?: {
      salary?: string;
      startDate?: string;
      offerExpiryDate?: string;
    };
    rejectionReason?: string;
    withdrawalReason?: string;
  }; // Change metadata [变更元数据]
}

/**
 * Mentor screening completed event [内推导师评估完成事件]
 * Published when mentor screening is completed [发布内推导师评估完成时]
 */
export const MENTOR_SCREENING_COMPLETED_EVENT = "placement.mentor_screening.completed";

/**
 * Interface for mentor screening completed event payload [内推导师评估完成事件载荷接口]
 */
export interface MentorScreeningCompletedEvent {
  applicationId: string; // Application ID [申请ID]
  mentorId: string; // Mentor ID [导师ID]
  screeningResult: {
    technicalSkills: number; // Technical skills score (1-5) [技术技能评分]
    experienceMatch: number; // Experience match score (1-5) [经验匹配度评分]
    culturalFit: number; // Cultural fit score (1-5) [文化适应度评分]
    overallRecommendation: "strongly_recommend" | "recommend" | "neutral" | "not_recommend"; // Overall recommendation level [整体推荐度]
    screeningNotes?: string; // Screening notes [评估备注]
  };
  evaluatedAt: string; // Evaluation time [评估时间]
}
