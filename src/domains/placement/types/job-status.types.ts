/**
 * Job position status type [岗位状态类型]
 * Represents the lifecycle states of a job position [代表岗位的生命周期状态]
 */
export type JobStatus = "active" | "inactive" | "expired";

/**
 * Job status labels [岗位状态标签]
 * Human-readable labels for job statuses [岗位状态的可读标签]
 */
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  expired: "Expired",
};

/**
 * Allowed status transitions for job positions [岗位状态允许转换]
 * Defines valid status transitions for job positions [定义岗位状态的合法转换]
 */
export const ALLOWED_JOB_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  active: ["inactive", "expired"],
  inactive: ["active"],
  expired: ["active"], // Can be reactivated by admin [管理员可重新激活]
};
