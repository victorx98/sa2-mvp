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
  date,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// Job position status enum [岗位状态枚举]
export const jobStatusEnum = pgEnum("job_status", ["active", "inactive", "expired"]);

// Application status enum [投递状态枚举]
export const applicationStatusEnum = pgEnum("application_status", [
  "submitted",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
  "declined",
]);

// Application type enum [投递类型枚举]
export const applicationTypeEnum = pgEnum("application_type", [
  "direct",
  "counselor_assisted",
  "mentor_referral",
  "bd_referral",
]);

// Changed by type enum [变更人类型枚举]
export const changedByTypeEnum = pgEnum("changed_by_type", [
  "system",
  "student",
  "mentor",
  "bd",
  "counselor",
]);

// Overall recommendation enum [整体推荐度枚举]
export const overallRecommendationEnum = pgEnum("overall_recommendation_enum", [
  "strongly_recommend",
  "recommend",
  "neutral",
  "not_recommend",
]);

// Result enum [结果枚举]
export const resultEnum = pgEnum("result_enum", ["hired", "rejected", "withdrawn", "declined"]);

/**
 * Recommended jobs table [推荐岗位表]
 * Stores job position information [存储岗位信息]
 */
export const recommendedJobs = pgTable(
  "recommended_jobs",
  {
    // Primary key [主键]
    id: uuid("id").defaultRandom().primaryKey(),

    // Basic information [基础信息]
    title: varchar("title", { length: 200 }).notNull(), // Job title [岗位标题]
    companyName: varchar("company_name", { length: 200 }).notNull(), // Company name [公司名称]

    // Job details [岗位详情]
    description: text("description"), // Job description [岗位描述]
    requirements: jsonb("requirements"), // Job requirements (skills, experience, etc.) [岗位要求]
    responsibilities: text("responsibilities"), // Job responsibilities [岗位职责]

    // Classification information [分类信息]
    jobType: varchar("job_type", { length: 50 }), // Job type (fulltime/internship/contract) [岗位类型]
    experienceLevel: varchar("experience_level", { length: 50 }), // Experience level (entry/mid/senior/executive) [经验等级]
    industry: varchar("industry", { length: 100 }), // Industry classification [行业分类]

    // Location information [地点信息]
    locations: jsonb("locations"), // Work location list (multiple cities) [工作地点列表]
    /* JSON structure example:
    [
      {
        "city": "New York",
        "state": "NY",
        "country": "USA",
        "address": "123 Broadway, New York, NY 10001",
        "is_primary": true
      }
    ]
    */
    remoteType: varchar("remote_type", { length: 50 }), // Remote type (onsite/remote/hybrid) [远程类型]

    // Salary information [薪资信息]
    salaryMin: decimal("salary_min", { precision: 10, scale: 2 }), // Minimum salary [最低薪资]
    salaryMax: decimal("salary_max", { precision: 10, scale: 2 }), // Maximum salary [最高薪资]
    salaryCurrency: varchar("salary_currency", { length: 10 }), // Salary currency [薪资货币]

    // Status management [状态管理]
    status: jobStatusEnum("status").notNull().default("active"), // Job status [岗位状态]

    // Timestamps [时间戳]
    postedDate: date("posted_date"), // Post date [发布日期]
    expiryDate: date("expiry_date"), // Expiry date [过期日期]
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), // Creation time [创建时间]
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(), // Update time [更新时间]

    // Business fields [业务字段]
    source: varchar("source", { length: 100 }).notNull(), // Data source [数据来源]
    jobSource: varchar("job_source", { length: 20 }).notNull(), // Job source (web/bd) [岗位来源]
    sourceUrl: text("source_url"), // Original link [原始链接]
    sourceJobId: varchar("source_job_id", { length: 100 }), // Original platform job ID [原始平台岗位ID]
    viewCount: integer("view_count").default(0).notNull(), // View count [查看次数]
    applicationCount: integer("application_count").default(0).notNull(), // Application count [申请次数]
    qualityScore: decimal("quality_score", { precision: 3, scale: 2 }), // Job quality score (0-1) [岗位质量评分]

    // AI analysis results [AI分析结果]
    aiAnalysis: jsonb("ai_analysis"), // AI analysis results [AI分析结果]
    /* JSON structure example: {
      "required_skills": [...],
      "h1b": "NA",
      "industry": "Automotive Retail",
      "domain": "Sales / Retail Sales",
      "experience_level": "entry_level"
    } */
  },
  (table) => [
    // Unique constraints [唯一约束]
    uniqueIndex("idx_company_title").on(table.companyName, table.title),
    uniqueIndex("idx_source_job_unique").on(table.source, table.sourceJobId),

    // Core query indexes [核心查询索引]
    index("idx_recommended_jobs_status").on(table.status),
    index("idx_recommended_jobs_company").on(table.companyName),
    index("idx_recommended_jobs_job_source").on(table.jobSource),
    index("idx_recommended_jobs_posted_date").on(table.postedDate),
    _partialIndex("idx_recommended_jobs_status_active", table.status, "active"),
    index("idx_recommended_jobs_quality").on(table.qualityScore),

    // Full-text search index [全文搜索索引]
    index("idx_recommended_jobs_search").using("gin", sql`to_tsvector('english', ${table.title} || ' ' || ${table.description})`),

    // GIN indexes for JSONB fields [JSONB字段的GIN索引]
    index("idx_recommended_jobs_locations").using("gin", table.locations),
    index("idx_recommended_jobs_ai_analysis").using("gin", table.aiAnalysis),
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
    jobId: uuid("job_id")
      .notNull()
      .references(() => recommendedJobs.id), // Job ID (foreign key references recommended_jobs) [岗位ID]

    // Application information [申请信息]
    applicationType: applicationTypeEnum("application_type").notNull(), // Application type (direct/counselor/mentor/bd) [申请类型]
    coverLetter: text("cover_letter"), // Cover letter [求职信]
    customAnswers: jsonb("custom_answers"), // Custom question answers [自定义问题回答]

    // Status management [状态管理]
    status: applicationStatusEnum("status").notNull().default("submitted"), // Application status [申请状态]

    // Mentor screening information (only for mentor referral type) [内推导师评估信息]
    mentorScreening: jsonb("mentor_screening"), // Mentor screening information [导师评估信息]

    // Result records [结果记录]
    result: resultEnum("result"), // Application result [申请结果]
    resultReason: text("result_reason"), // Result reason [结果原因]
    resultDate: date("result_date"), // Result date [结果日期]

    // Timestamps [时间戳]
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(), // Submission time [提交时间]
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(), // Update time [更新时间]

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
      .references(() => jobApplications.id), // Application ID (foreign key references job_applications) [申请ID]

    // Status change [状态变更]
    previousStatus: applicationStatusEnum("previous_status"), // Previous status [之前状态]
    newStatus: applicationStatusEnum("new_status").notNull(), // New status [新状态]

    // Change information [变更信息]
    changedBy: varchar("changed_by", { length: 36 }), // Changer ID (system or user) [变更人ID]
    changedByType: changedByTypeEnum("changed_by_type"), // Changer type [变更人类型]
    changeReason: text("change_reason"), // Change reason [变更原因]
    changeMetadata: jsonb("change_metadata"), // Change metadata [变更元数据]

    // Timestamp [时间戳]
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(), // Change time [变更时间]
  },
  (table) => [
    // Core query indexes [核心查询索引]
    index("idx_application_history_application").on(table.applicationId),
    index("idx_application_history_changed_at").on(table.changedAt),
    index("idx_application_history_status_change").on(table.previousStatus, table.newStatus),
  ],
);

/**
 * Creates a partial index for the specified table and column with a WHERE clause
 * [为指定表和列创建带WHERE条件的部分索引]
 */
function _partialIndex(indexName: string, column: any, value: string) {
  return index(indexName).on(column).where(sql`${column} = ${value}`);
}
