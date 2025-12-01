/**
 * Application status values array [投递状态值数组]
 * Single source of truth for application status values [投递状态值的唯一数据源]
 */
export const APPLICATION_STATUSES = [
  "recommended",
  "interested",
  "not_interested",
  "mentor_assigned",
  "submitted",
  "interviewed",
  "got_offer",
  "rejected",
  "withdrawn"
] as const;

/**
 * Application status type [投递状态类型]
 * Represents the lifecycle states of a job application [代表投递申请的生命周期状态]
 * Derived from APPLICATION_STATUSES array [从 APPLICATION_STATUSES 数组派生]
 */
export type ApplicationStatus = typeof APPLICATION_STATUSES[number];

/**
 * Application status labels [投递状态标签]
 * Human-readable labels for application statuses [投递状态的可读标签]
 */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  recommended: "已推荐",
  interested: "感兴趣",
  not_interested: "不感兴趣",
  mentor_assigned: "已转交",
  submitted: "已提交",
  interviewed: "已面试",
  got_offer: "已拿到Offer",
  rejected: "已拒绝",
  withdrawn: "已撤回"
};

/**
 * Allowed status transitions for applications [投递状态允许转换]
 */
export const ALLOWED_APPLICATION_STATUS_TRANSITIONS: Partial<
  Record<ApplicationStatus, ApplicationStatus[]>
> = {
  submitted: [ "interviewed", "rejected"],
  mentor_assigned: ["submitted", "rejected"],
  interviewed: ["got_offer", "rejected"],
  recommended: ["interested", "not_interested"],
  interested: ["mentor_assigned", "withdrawn"],
  not_interested: ["interested", "withdrawn"],
};
