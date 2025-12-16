/**
 * H1B Status Enum [H1B签证状态枚举]
 * Values match the actual data in recommended_jobs.h1b column [值与recommended_jobs.h1b列中的实际数据匹配]
 */
export enum H1BStatus {
  YES = "yes", // H1B visa is supported [支持H1B签证]
  MAYBE = "maybe", // H1B visa support is uncertain [H1B签证支持不确定]
  NO = "no", // H1B visa is not supported [不支持H1B签证]
}

/**
 * H1B Status Labels [H1B状态标签]
 */
export const H1B_STATUS_LABELS: Record<H1BStatus, string> = {
  [H1BStatus.YES]: "支持",
  [H1BStatus.MAYBE]: "不确定",
  [H1BStatus.NO]: "不支持",
};

/**
 * H1B Status Descriptions [H1B状态描述]
 */
export const H1B_STATUS_DESCRIPTIONS: Record<H1BStatus, string> = {
  [H1BStatus.YES]: "岗位支持H1B签证",
  [H1BStatus.MAYBE]: "岗位H1B签证支持情况不确定",
  [H1BStatus.NO]: "岗位不支持H1B签证",
};

