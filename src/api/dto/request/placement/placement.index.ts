/**
 * Placement DTO exports and type aliases
 * (English) Exports all placement-related DTOs for easy importing
 * (中文) 导出所有Placement相关的DTO，便于统一导入
 */

// Import DTO classes
import { CreateJobPositionRequestDto, RollbackJobApplicationStatusRequestDto } from "./job-position.request.dto";

// Type aliases for backward compatibility (类型别名，用于向后兼容)
export type ICreateJobPositionDto = CreateJobPositionRequestDto;
export type IRollbackApplicationStatusDto = RollbackJobApplicationStatusRequestDto;

// Re-export DTO classes from this file's directory
export { CreateJobPositionRequestDto, RollbackJobApplicationStatusRequestDto };

// Import and re-export DTO classes from parent directory
import { PlacementJobApplicationUpdateStatusRequestDto } from "../placement-job-application-update-status.request.dto";
import { JobQueryDto } from "../placement-query.request.dto";
import { PlacementReferralAssignMentorRequestDto } from "../placement-referral-assign-mentor.request.dto";
import { PlacementReferralBatchRecommendRequestDto } from "../placement-referral-batch.request.dto";
import { PlacementReferralManualCreateRequestDto } from "../placement-referral-manual-create.request.dto";

export { PlacementJobApplicationUpdateStatusRequestDto };
export { JobQueryDto };
export { PlacementReferralAssignMentorRequestDto };
export { PlacementReferralBatchRecommendRequestDto };
export { PlacementReferralManualCreateRequestDto };

// Type aliases for backward compatibility
export type IJobQueryDto = JobQueryDto;
export type IRecommendReferralApplicationsBatchDto = PlacementReferralBatchRecommendRequestDto;
export type ICreateManualJobApplicationDto = PlacementReferralManualCreateRequestDto;
export type IAssignReferralMentorRequestDto = PlacementReferralAssignMentorRequestDto;

// Internal DTO interface for updating application status (内部使用的状态更新DTO接口)
// Minimal interface containing only required fields (仅包含必要字段的精简接口)
// applicationId: from URL param, status: from request body
export interface IUpdateApplicationStatusDto {
  applicationId: string;
  status: string;
}

// Internal DTO interface for assigning mentor (内部使用的导师分配DTO接口)
// Extended from status update with mentor-specific fields (从状态更新扩展的导师专用字段)
export interface IAssignReferralMentorDto extends IUpdateApplicationStatusDto {
  mentorId: string;
}

// Interfaces used by Service layer [服务层使用的接口]
export interface IJobPositionSearchFilter {
  status?: string;
  companyName?: string;
  locations?: string[];
}

export interface IMarkJobExpiredDto {
  jobId: string;
  expiredBy?: string;
  expiredByType?: string;
  reason?: string;
}

export interface IJobApplicationSearchFilter {
  status?: string;
  studentId?: string;
  mentorId?: string;
  jobId?: string;
  applicationType?: string;
  assignedMentorId?: string;
  recommendedBy?: string;
  recommendedAtRange?: {
    start?: string;
    end?: string;
  };
}

export interface ISubmitApplicationDto {
  studentId: string;
  jobId: string;
  applicationType?: string;
}
