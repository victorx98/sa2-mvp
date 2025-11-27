/**
 * Application status type [投递状态类型]
 * Represents the lifecycle states of a job application [代表投递申请的生命周期状态]
 */
export type ApplicationStatus =
  | "submitted"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn"
  | "declined";

/**
 * Application status labels [投递状态标签]
 * Human-readable labels for application statuses [投递状态的可读标签]
 */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "已提交",
  screening: "筛选中",
  interview: "面试中",
  offer: "Offer中",
  hired: "已录用",
  rejected: "已拒绝",
  withdrawn: "已撤回",
  declined: "已拒绝Offer",
};

/**
 * Allowed status transitions for applications [投递状态允许转换]
 */
export const ALLOWED_APPLICATION_STATUS_TRANSITIONS: Partial<
  Record<ApplicationStatus, ApplicationStatus[]>
> = {
  submitted: ["screening"],
  screening: ["interview", "rejected"],
  interview: ["offer", "rejected"],
  offer: ["hired", "declined"],
};
