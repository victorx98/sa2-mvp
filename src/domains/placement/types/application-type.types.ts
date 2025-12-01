import { ApplicationType } from "./application-type.enum";

/**
 * Application type labels [投递类型标签]
 * Human-readable labels for application types [投递类型的可读标签]
 */
export const APPLICATION_TYPE_LABELS: Record<ApplicationType, string> = {
  [ApplicationType.DIRECT]: "直接投递",
  [ApplicationType.PROXY]: "顾问代投",
  [ApplicationType.REFERRAL]: "导师内推",
  [ApplicationType.BD]: "BD推荐",
};

/**
 * Application type descriptions [投递类型描述]
 * Detailed descriptions for application types [投递类型的详细描述]
 */
export const APPLICATION_TYPE_DESCRIPTIONS: Record<ApplicationType, string> = {
  [ApplicationType.DIRECT]: "学生自主投递，无需权益",
  [ApplicationType.PROXY]: "顾问协助投递，需验证Counselor权益",
  [ApplicationType.REFERRAL]: "导师内部推荐，需导师评估",
  [ApplicationType.BD]: "BD推荐，需验证BD权益",
};
