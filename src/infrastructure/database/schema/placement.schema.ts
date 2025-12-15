import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  timestamp,
  jsonb,
  integer,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
  serial,
} from "drizzle-orm/pg-core";
import { APPLICATION_STATUSES } from "@domains/placement/types/application-status.types";

// Job position status enum [岗位状态枚举]
export const jobStatusEnum = pgEnum("job_status", [
  "active",
  "inactive",
  "expired",
]);

// Application status enum [投递状态枚举]
export const applicationStatusEnum = pgEnum(
  "application_status",
  APPLICATION_STATUSES,
);

// Application type enum [投递类型枚举]
export const applicationTypeEnum = pgEnum("application_type", [
  "direct",
  "proxy",
  "referral",
  "bd",
]);

// Result enum [结果枚举]
export const resultEnum = pgEnum("result_enum", ["rejected"]);

/**
 * Recommended jobs table [推荐岗位表]
 * Stores job position information with JSONB fields for flexibility [使用JSONB字段存储岗位信息，提供灵活性]
 */
export const recommendedJobs = pgTable(
  "recommended_jobs",
  {
    // Primary key - UUID [主键 - UUID]
    id: uuid("id").defaultRandom().primaryKey(), // Unique job ID [唯一岗位ID]

    // External job ID from recruitment website [招聘网站的外部job编号]
    jobId: varchar("job_id", { length: 100 }), // External job ID [外部岗位ID]

    // Job posting link [岗位访问链接]
    jobLink: text("job_link"), // URL to job posting [岗位发布链接]

    // Idempotency key for upsert operations [用于upsert操作的幂等键]
    objectId: varchar("object_id", { length: 50 }).unique(), // Unique object identifier [唯一对象标识符]

    // Normalized job titles for search [用于搜索的标准化职位标题]
    normalizedJobTitles: text("norm_job_titles").array(), // Normalized job titles array [标准化职位标题数组]

    // Job types classification [职位类型分类]
    jobTypes: text("job_types").array(), // Job types array [职位类型数组]

    // Post date [发布日期]
    postDate: timestamp("post_date"), // Job posting date [岗位发布日期]

    // Job status [岗位状态]
    status: varchar("status", { length: 50 }).notNull().default("active"), // Job status (active/inactive/expired) [岗位状态]

    // Job title [岗位标题]
    title: varchar("job_title", { length: 300 }).notNull(), // Job title [岗位标题]

    // Country code [国家代码]
    countryCode: varchar("country_code", { length: 10 }), // Country code (e.g., US, CA) [国家代码]

    // Experience requirement as JSONB object [经验要求JSONB对象]
    experienceRequirement: jsonb("experience_requirement"),

    // Salary details as JSONB object [薪资详情JSONB对象]
    salaryDetails: jsonb("salary_details"),

    // Skills as JSONB array [技能JSONB数组]
    skills: jsonb("skills").default('[]'),

    // Responsibilities as JSONB array [职责JSONB数组]
    jobResponsibilities: jsonb("responsibilities").default('[]'),

    // Matched job titles with scores [匹配职位标题及分数]
    matchedJobTitles: jsonb("matched_titles").default('[]'),

    // Job locations as JSONB array [工作地点JSONB数组]
    jobLocations: jsonb("locations").default('[]'),

    // Job description [岗位描述]
    jobDescription: text("job_description"), // Full job description [完整的岗位描述]

    // Company name [公司名称]
    companyName: varchar("company_name", { length: 300 }).notNull(), // Company name [公司名称]

    // H1B visa support information [H1B签证支持信息]
    h1b: varchar("h1b", { length: 10 }), // H1B visa support status [H1B签证支持状态]

    // US citizenship requirement [美国公民身份要求]
    usCitizenship: varchar("us_citizenship", { length: 10 }), // US citizenship requirement [美国公民身份要求]

    // AI analysis results [AI分析结果]
    aiAnalysis: jsonb("ai_analysis"),

    // Source details [来源详情]
    sourceDetails: jsonb("source_details"),

    // Job application types supported by this position [此岗位支持的投递类型]
    jobApplicationType: text("job_application_type")
      .array()
      .default(sql`ARRAY['direct']`), // Supported application types (direct=海投, proxy=代投, referral=内推, bd=BD推荐) [支持的投递类型]

    // Timestamps [时间戳]
    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(), // Creation time [创建时间]
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull(), // Update time [更新时间]
  },
  (table) => [
    // Regular field indexes [普通字段索引]
    index("idx_recommended_jobs_post_date").on(table.postDate),
    index("idx_recommended_jobs_company").on(table.companyName),
    index("idx_recommended_jobs_status").on(table.status),
    index("idx_recommended_jobs_h1b").on(table.h1b),
    index("idx_recommended_jobs_citizen").on(table.usCitizenship),

    // External job ID index [外部岗位ID索引]
    index("idx_recommended_jobs_job_id").on(table.jobId),

    // New indexes [新增索引]
    index("idx_jobs_ai_analysis").using("gin", table.aiAnalysis),
    index("idx_jobs_normalized_titles").using("gin", table.normalizedJobTitles),
    index("idx_jobs_job_types").using("gin", table.jobTypes),
    index("idx_jobs_active_posted").on(table.status, table.postDate),
    index("idx_jobs_company_title").on(table.companyName, table.title),
    index("idx_jobs_country_code").on(table.countryCode),
    index("idx_gin_job_locations").using("gin", table.jobLocations),
    index("idx_gin_job_responsibilities").using("gin", table.jobResponsibilities),
    index("idx_gin_matched_job_titles").using("gin", table.matchedJobTitles),
    index("idx_gin_skills").using("gin", table.skills),
    index("idx_gin_source_details").using("gin", table.sourceDetails),
    index("idx_recommended_jobs_application_type").using(
      "gin",
      table.jobApplicationType,
    ),

    // JSON type constraints to ensure data integrity [JSON类型约束确保数据完整性]
    // Type check for experience_requirement to ensure it's an object [检查experience_requirement是否为对象]
    sql`CHECK (experience_requirement IS NULL OR jsonb_typeof(experience_requirement) = 'object')`,
    // Type check for salary_details to ensure it's an object [检查salary_details是否为对象]
    sql`CHECK (salary_details IS NULL OR jsonb_typeof(salary_details) = 'object')`,
    // Type check for skills to ensure it's an array [检查skills是否为数组]
    sql`CHECK (jsonb_typeof(skills) = 'array')`,
    // Type check for responsibilities to ensure it's an array [检查responsibilities是否为数组]
    sql`CHECK (jsonb_typeof(responsibilities) = 'array')`,
    // Type check for matched_titles to ensure it's an array [检查matched_titles是否为数组]
    sql`CHECK (jsonb_typeof(matched_titles) = 'array')`,
    // Type check for locations to ensure it's an array [检查locations是否为数组]
    sql`CHECK (jsonb_typeof(locations) = 'array')`,
    // Type check for source_details to ensure it's an object [检查source_details是否为对象]
    sql`CHECK (source_details IS NULL OR jsonb_typeof(source_details) = 'object')`,
    // Type check for ai_analysis to ensure it's an object [检查ai_analysis是否为对象]
    sql`CHECK (ai_analysis IS NULL OR jsonb_typeof(ai_analysis) = 'object')`,
    // Check ai_analysis structure [检查ai_analysis结构]
    sql`CHECK (ai_analysis IS NULL OR ai_analysis ?& ARRAY['required_skills', 'industry', 'domain', 'field'])`,
    // Check post_date is not in the future [检查post_date不超过当前日期]
    sql`CHECK (post_date IS NULL OR post_date <= CURRENT_TIMESTAMP)`,
    // Check status is valid [检查status值合法]
    sql`CHECK (status IN ('active', 'inactive', 'expired'))`,
  ],
);

/**
 * Job applications table [投递申请表]
 * Stores job application records [存储投递申请记录]
 */
export const jobApplications = pgTable(
  "job_applications",
  {
    // Primary key [主键]
    id: uuid("id").defaultRandom().primaryKey(),

    // Basic information [基础信息]
    studentId: varchar("student_id", { length: 36 }).notNull(), // Student ID (string reference) [学生ID]
    jobId: varchar("job_id", { length: 36 }) // Changed from integer to varchar to match recommendedJobs.id type [从integer改为varchar以匹配recommendedJobs.id类型]
      .notNull()
      .references(() => recommendedJobs.id, { onDelete: "cascade" }), // Job ID (foreign key references recommended_jobs) [岗位ID]

    // Application information [申请信息]
    applicationType: applicationTypeEnum("application_type").notNull(), // Application type (direct/counselor/mentor/bd) [申请类型]
    coverLetter: text("cover_letter"), // Cover letter [求职信]
    customAnswers: jsonb("custom_answers"), // Custom question answers [自定义问题回答]

    // Status management [状态管理]
    status: applicationStatusEnum("status").notNull().default("submitted"), // Application status [申请状态]

    // Assigned mentor for referral applications [推荐申请分配的导师ID]
    assignedMentorId: varchar("assigned_mentor_id", { length: 36 }), // Assigned mentor ID for referral applications [内推申请分配的导师ID]

    // Result records [结果记录]
    result: resultEnum("result"), // Application result [申请结果]
    resultReason: text("result_reason"), // Result reason [结果原因]

    // Timestamps [时间戳]
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(), // Submission time [提交时间]
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(), // Update time [更新时间]

    // Business fields [业务字段]
    isUrgent: boolean("is_urgent").default(false).notNull(), // Urgent application flag [加急申请标记]
    notes: text("notes"), // Internal notes [内部备注]
  },
  (table) => [
    // Unique constraint [唯一约束]
    uniqueIndex("idx_student_job").on(table.studentId, table.jobId), // Student+job unique constraint [学生+岗位唯一]

    // Core query indexes [核心查询索引]
    index("idx_job_applications_student").on(table.studentId),
    index("idx_job_applications_job").on(table.jobId),
    index("idx_job_applications_status").on(table.status),
    index("idx_job_applications_type").on(table.applicationType),
    index("idx_job_applications_submitted").on(table.submittedAt),
    index("idx_job_applications_assigned_mentor").on(table.assignedMentorId), // Index for mentor queries [导师查询索引]
  ],
);

/**
 * Application history table [申请历史记录表]
 * Stores status change history [存储状态变更历史]
 */
export const applicationHistory = pgTable(
  "application_history",
  {
    // Primary key [主键]
    id: uuid("id").defaultRandom().primaryKey(),

    // Application information [申请信息]
    applicationId: uuid("application_id")
      .notNull()
      .references(() => jobApplications.id, { onDelete: "cascade" }), // Application ID (foreign key references job_applications) [申请ID]

    // Status change [状态变更]
    previousStatus: applicationStatusEnum("previous_status"), // Previous status [之前状态]
    newStatus: applicationStatusEnum("new_status").notNull(), // New status [新状态]

    // Change information [变更信息]
    changedBy: varchar("changed_by", { length: 36 }), // Changer ID (system or user) [变更人ID]
    changeReason: text("change_reason"), // Change reason [变更原因]
    changeMetadata: jsonb("change_metadata"), // Change metadata [变更元数据]

    // Timestamp [时间戳]
    changedAt: timestamp("changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(), // Change time [变更时间]
  },
  (table) => [
    // Core query indexes [核心查询索引]
    index("idx_application_history_application").on(table.applicationId),
    index("idx_application_history_changed_at").on(table.changedAt),
    index("idx_application_history_status_change").on(
      table.previousStatus,
      table.newStatus,
    ),
  ],
);

/**
 * Creates a partial index for the specified table and column with a WHERE clause
 * [为指定表和列创建带WHERE条件的部分索引]
 */
function _partialIndex<T extends { name: string }>(
  indexName: string,
  column: T,
  value: string,
) {
  return index(indexName)
    .on(column)
    .where(sql`${column} = ${value}`);
}
