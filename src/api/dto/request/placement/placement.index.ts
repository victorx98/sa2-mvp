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
export type IUpdateApplicationStatusDto = PlacementJobApplicationUpdateStatusRequestDto;
export type IJobQueryDto = JobQueryDto;
export type IRecommendReferralApplicationsBatchDto = PlacementReferralBatchRecommendRequestDto;
export type ICreateManualJobApplicationDto = PlacementReferralManualCreateRequestDto;
export type IAssignReferralMentorRequestDto = PlacementReferralAssignMentorRequestDto;

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
