/**
 * Application Status [申请状态]
 * Represents the lifecycle states of a job application in the placement domain
 * [代表投岗域中求职申请的生命周期状态]
 */
export enum ApplicationStatus {
  SUBMITTED = "submitted", // 已提交（初始状态）[Submitted (initial state)]
  INTERVIEWED = "interviewed", // 已完成面试 [Interview completed]
  OFFERED = "offered", // 已收到offer [Offer received]
  REJECTED = "rejected", // 已拒绝 [Rejected]
  EXPIRED = "expired", // 已过期 [Expired]
}

/**
 * Mass Application Status Labels [海投申请状态标签]
 * Human-readable labels for application statuses
 * [用于申请状态的可读标签]
 */
export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  [ApplicationStatus.SUBMITTED]: "已投递",
  [ApplicationStatus.INTERVIEWED]: "已面试",
  [ApplicationStatus.OFFERED]: "已发offer",
  [ApplicationStatus.REJECTED]: "已拒绝",
  [ApplicationStatus.EXPIRED]: "已过期",
};

/**
 * Allowed Status Transitions [允许的状态流转]
 * Defines valid status transitions for mass applications
 * [定义海投申请的合法状态流转]
 */
export const ALLOWED_STATUS_TRANSITIONS: Map<ApplicationStatus, ApplicationStatus[]> = new Map([
  [ApplicationStatus.SUBMITTED, [ApplicationStatus.INTERVIEWED, ApplicationStatus.REJECTED, ApplicationStatus.EXPIRED]],
  [ApplicationStatus.INTERVIEWED, [ApplicationStatus.OFFERED, ApplicationStatus.REJECTED]],
  [ApplicationStatus.OFFERED, []], // Terminal state [终止状态]
  [ApplicationStatus.REJECTED, []], // Terminal state [终止状态]
  [ApplicationStatus.EXPIRED, []], // Terminal state [终止状态]
]);

/**
 * Validate Status Transition [验证状态流转]
 * Check if a status transition is valid
 * [检查状态流转是否合法]
 *
 * @param fromStatus Current status [当前状态]
 * @param toStatus Target status [目标状态]
 * @returns boolean indicating if transition is valid [返回布尔值表示流转是否合法]
 */
export function isValidStatusTransition(fromStatus: ApplicationStatus, toStatus: ApplicationStatus): boolean {
  const allowedTargets = ALLOWED_STATUS_TRANSITIONS.get(fromStatus);
  return allowedTargets ? allowedTargets.includes(toStatus) : false;
}
