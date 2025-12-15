/**
 * Job Type Enum [职位类型枚举]
 * Valid values for job_types array in recommended_jobs table [recommended_jobs表中job_types数组的有效值]
 */
export enum JobType {
  FULL_TIME = "Full-time", // Full-time position [全职岗位]
  INTERNSHIP = "Internship", // Internship position [实习岗位]
  BOTH = "Both", // Both full-time and internship positions [同时支持全职和实习]
}

/**
 * Job Type Labels [职位类型标签]
 */
export const JOB_TYPE_LABELS: Record<JobType, string> = {
  [JobType.FULL_TIME]: "全职",
  [JobType.INTERNSHIP]: "实习",
  [JobType.BOTH]: "全职/实习",
};

/**
 * Job Type Descriptions [职位类型描述]
 */
export const JOB_TYPE_DESCRIPTIONS: Record<JobType, string> = {
  [JobType.FULL_TIME]: "全职岗位",
  [JobType.INTERNSHIP]: "实习岗位",
  [JobType.BOTH]: "同时支持全职和实习的岗位",
};

