/**
 * DTO for creating a job position [创建岗位DTO]
 * Structured to match the new recommended_jobs table schema [结构与新recommended_jobs表结构匹配]
 */
export interface ICreateJobPositionDto {
  // Idempotency key [幂等键]
  objectId?: string; // Unique object identifier for upsert operations [用于upsert操作的唯一对象标识符]

  // Job identification [岗位标识]
  jobTitle: string; // Job title [岗位标题]
  companyName: string; // Company name [公司名称]

  // Job classification [岗位分类]
  normJobTitles?: string[]; // Normalized job titles for search [用于搜索的标准化职位标题]
  jobTypes?: string[]; // Job types classification [职位类型分类]

  // Posting details [发布详情]
  postDate?: Date; // Job posting date [岗位发布日期]
  status?: "active" | "inactive" | "expired"; // Job status [岗位状态]

  // Location [地点]
  countryCode?: string; // Country code (e.g., US, CA) [国家代码]
  locations?: string[]; // Job locations array [工作地点数组]

  // Experience requirement as JSONB object [经验要求JSONB对象]
  experienceRequirement?: {
    min_years?: number; // Minimum years of experience required [最低经验年数]
    max_years?: number; // Maximum years of experience required [最高经验年数]
    unlimited?: boolean; // Whether experience requirement is unlimited [经验要求是否不限]
  };

  // Salary details as JSONB object [薪资详情JSONB对象]
  salaryDetails?: {
    base_salary?: {
      min?: number; // Minimum base salary [最低基本工资]
      max?: number; // Maximum base salary [最高基本工资]
    };
    bonus?: Record<string, unknown>; // Bonus details [奖金详情]
  };

  // Skills as JSONB array [技能JSONB数组]
  skills?: Array<{
    skill: string; // Skill name [技能名称]
    years_of_experience?: number; // Years of experience with this skill [该技能的经验年数]
  }>;

  // Responsibilities as JSONB array [职责JSONB数组]
  responsibilities?: string[]; // Job responsibilities list [岗位职责列表]

  // Matched job titles with scores [匹配职位标题及分数]
  matchedTitles?: Array<{
    job_title: string; // Matched job title [匹配的职位标题]
    score: number; // Matching score [匹配分数]
  }>;

  // Job description [岗位描述]
  jobDescription?: string; // Full job description [完整的岗位描述]

  // Visa and citizenship requirements [签证和公民身份要求]
  h1b?: string; // H1B visa support status [H1B签证支持状态]
  usCitizenship?: string; // US citizenship requirement [美国公民身份要求]

  // Job application types supported by this position [此岗位支持的投递类型]
  jobApplicationType?: ("direct" | "proxy" | "referral" | "bd")[]; // Supported application types (direct=海投, proxy=代投, referral=内推, bd=BD推荐) [支持的投递类型]

  // Metadata (use source for data origin tracking) [元数据（使用source跟踪数据来源）]
  source: "web" | "bd"; // Job source identifier [岗位来源标识]
  createdBy: string; // Creator ID [创建人ID]
}


/**
 * Filter interface for searching job positions [搜索岗位筛选接口]
 */
export interface IJobPositionSearchFilter {
  status?: "active" | "inactive" | "expired"; // Filter by status [按状态筛选]
  companyName?: string; // Filter by company [按公司筛选]
  locations?: string[]; // Filter by location [按地点筛选]
}

/**
 * DTO for searching job positions [搜索岗位DTO]
 */
export interface ISearchJobPositionsDto {
  status?: "active" | "inactive" | "expired"; // Filter by status [按状态筛选]
  companyName?: string; // Filter by company [按公司筛选]
  locations?: string[]; // Filter by location [按地点筛选]
  jobType?: string; // Filter by job type [按岗位类型筛选]
  experienceLevel?: string; // Filter by experience level [按经验等级筛选]
  industry?: string; // Filter by industry [按行业筛选]
  offset?: number; // Pagination offset [分页偏移]
  limit?: number; // Page size [每页数量]
}

/**
 * DTO for marking a job as expired [标记岗位过期DTO]
 */
export interface IMarkJobExpiredDto {
  jobId: string; // Job ID [岗位ID]
  expiredBy: string; // Person who marks expired [过期操作人]
  expiredByType: "student" | "mentor" | "counselor" | "bd"; // Type of person [过期人类型]
  reason?: string; // Expiration reason [过期原因]
}
