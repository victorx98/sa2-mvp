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
} from "drizzle-orm/pg-core";
import { APPLICATION_STATUSES } from "@domains/placement/types/application-status.types";

// Job position status enum [岗位状态枚举]
export const jobStatusEnum = pgEnum("job_status", ["active", "inactive", "expired"]);

// Application status enum [投递状态枚举]
export const applicationStatusEnum = pgEnum("application_status", APPLICATION_STATUSES);

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
    companyNameNormalized: varchar("company_name_normalized", { length: 200 }), // Normalized company name [标准化公司名称]
    location: varchar("location", { length: 200 }), // Location [地点]
    salaryRange: varchar("salary_range", { length: 100 }), // Salary range [薪资范围]

    // Job details [岗位详情]
    description: text("description"), // Job description [岗位描述]
    requirements: varchar("requirements").array(), // Job requirements (skills, experience, etc.) [岗位要求]
    benefits: varchar("benefits").array(), // Benefits [福利]
    skillsRequired: varchar("skills_required").array(), // Skills required [所需技能]
    responsibilities: text("responsibilities"), // Job responsibilities [岗位职责]

    // Classification information [分类信息]
    jobType: varchar("job_type", { length: 50 }), // Job type (fulltime/internship/contract) [岗位类型]
    experienceLevel: varchar("experience_level", { length: 50 }), // Experience level (entry/mid/senior/executive) [经验等级]
    industry: varchar("industry", { length: 100 }), // Industry classification [行业分类]
    department: varchar("department", { length: 100 }), // Department [部门]
    employmentType: varchar("employment_type", { length: 50 }), // Employment type [雇佣类型]

    remoteType: varchar("remote_type", { length: 50 }), // Remote type (onsite/remote/hybrid) [远程类型]

    // Business fields [业务字段]
    source: varchar("source", { length: 100 }).notNull(), // Data source [数据来源]
    sourceUrl: text("source_url"), // Original link [原始链接]
    externalId: varchar("external_id", { length: 100 }), // External ID [外部ID]
    status: varchar("status", { length: 50 }).notNull().default("active"), // Job status [岗位状态]
    duplicateCheckStatus: varchar("duplicate_check_status", { length: 50 }), // Duplicate check status [重复检查状态]
    duplicateConfidenceScore: decimal("duplicate_confidence_score", { precision: 3, scale: 2 }), // Duplicate confidence score [重复置信度分数]

    // Timestamps [时间戳]
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), // Creation time [创建时间]
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(), // Update time [更新时间]
    createdBy: uuid("created_by"), // Created by [创建人]
    updatedBy: uuid("updated_by"), // Updated by [更新人]
    version: integer("version").default(1).notNull(), // Version [版本]
  },
  (table) => [
    // Core query indexes [核心查询索引]
    index("idx_recommended_jobs_status").on(table.status),
    index("idx_recommended_jobs_company").on(table.companyName),
    index("idx_recommended_jobs_title").on(table.title),
    index("idx_recommended_jobs_created_at").on(table.createdAt),
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
function _partialIndex<T extends { name: string }>(indexName: string, column: T, value: string) {
  return index(indexName).on(column).where(sql`${column} = ${value}`);
}
