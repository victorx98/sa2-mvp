/**
 * Changed by type [变更人类型]
 * Represents the type of user who made the change [代表进行变更的用户类型]
 */
export type ChangedByType = "system" | "student" | "mentor" | "bd" | "counselor";

/**
 * Changed by type labels [变更人类型标签]
 */
export const CHANGED_BY_TYPE_LABELS: Record<ChangedByType, string> = {
  system: "系统",
  student: "学生",
  mentor: "导师",
  bd: "BD",
  counselor: "顾问",
};
