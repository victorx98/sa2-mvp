/**
 * US Citizenship Requirement Enum [美国公民身份要求枚举]
 * Values match the actual data in recommended_jobs.us_citizenship column [值与recommended_jobs.us_citizenship列中的实际数据匹配]
 */
export enum USCitizenshipRequirement {
  NO = "no", // US citizenship is not required [不要求美国公民身份]
  PREFERRED = "preferred", // US citizenship is preferred but not required [优先考虑美国公民身份，但不强制]
}

/**
 * US Citizenship Requirement Labels [美国公民身份要求标签]
 */
export const US_CITIZENSHIP_REQUIREMENT_LABELS: Record<USCitizenshipRequirement, string> = {
  [USCitizenshipRequirement.NO]: "不要求",
  [USCitizenshipRequirement.PREFERRED]: "优先考虑",
};

/**
 * US Citizenship Requirement Descriptions [美国公民身份要求描述]
 */
export const US_CITIZENSHIP_REQUIREMENT_DESCRIPTIONS: Record<USCitizenshipRequirement, string> = {
  [USCitizenshipRequirement.NO]: "岗位不要求美国公民身份",
  [USCitizenshipRequirement.PREFERRED]: "岗位优先考虑美国公民身份，但不强制要求",
};

