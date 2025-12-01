/**
 * Import Application Type Enum from placement types [从placement类型导入投递类型枚举]
 */
import { ApplicationType } from "@domains/placement/types/application-type.enum";

/**
 * Re-export ApplicationType for use in shared events [重新导出ApplicationType供共享事件使用]
 */
export { ApplicationType };

/**
 * Job application status changed event [投递状态变更事件]
 * Published when a job application status changes [发布投递状态变更时]
 */
export const JOB_APPLICATION_STATUS_CHANGED_EVENT =
  "placement.application.status_changed";

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
    | "rejected"; // Previous status [之前状态]
  newStatus:
    | "recommended"
    | "interested"
    | "not_interested"
    | "mentor_assigned"
    | "submitted"
    | "interviewed"
    | "got_offer"
    | "rejected"; // New status [新状态]
  changedBy?: string; // Changer ID [变更人ID]
  changedAt: string; // Change time [变更时间]
}

/**
 * Job application status rolled back event [投递状态回撤事件]
 * Published when a job application status is rolled back to a previous state [发布投递状态回撤时]
 */
export const JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT = "placement.application.status_rolled_back";

/**
 * Interface for job application status rolled back event payload [投递状态回撤事件载荷接口]
 */
export interface JobApplicationStatusRolledBackEvent {
  applicationId: string; // Application ID [申请ID]
  previousStatus:
    | "recommended"
    | "interested"
    | "not_interested"
    | "mentor_assigned"
    | "submitted"
    | "interviewed"
    | "got_offer"
    | "rejected"; // Previous status [之前状态]
  newStatus:
    | "recommended"
    | "interested"
    | "not_interested"
    | "mentor_assigned"
    | "submitted"
    | "interviewed"
    | "got_offer"
    | "rejected"; // New status [新状态]
  changedBy: string; // Changer ID [变更人ID]
  changedAt: string; // Change time [变更时间]
  rollbackReason: string; // Rollback reason [回撤原因]
}


