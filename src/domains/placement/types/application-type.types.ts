/**
 * Application type [投递类型]
 * Represents the type of job application [代表投递申请的类型]
 */
export type ApplicationType = "direct" | "counselor_assisted" | "mentor_referral" | "bd_referral";

/**
 * Application type labels [投递类型标签]
 * Human-readable labels for application types [投递类型的可读标签]
 */
export const APPLICATION_TYPE_LABELS: Record<ApplicationType, string> = {
  direct: "直接投递",
  counselor_assisted: "顾问代投",
  mentor_referral: "导师内推",
  bd_referral: "BD推荐",
};

/**
 * Application type descriptions [投递类型描述]
 * Detailed descriptions for application types [投递类型的详细描述]
 */
export const APPLICATION_TYPE_DESCRIPTIONS: Record<ApplicationType, string> = {
  direct: "学生自主投递，无需权益",
  counselor_assisted: "顾问协助投递，需验证Counselor权益",
  mentor_referral: "导师内部推荐，需导师评估",
  bd_referral: "BD推荐，需验证BD权益",
};
