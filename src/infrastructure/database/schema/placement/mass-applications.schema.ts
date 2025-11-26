import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Application Status Enum [申请状态枚举]
 * Represents the lifecycle states of a job application
 * [代表岗位申请的生命周期状态]
 */
export const applicationStatusEnum = pgEnum("application_status", [
  "submitted", // 已提交（初始状态）[Submitted (initial state)]
  "interviewed", // 已完成面试 [Interview completed]
  "offered", // 已收到offer [Offer received]
  "rejected", // 已拒绝 [Rejected]
  "expired", // 已过期 [Expired]
]);

/**
 * Mass Applications Table [海投申请表]
 * Tracks mass application records in placement domain
 * [在投岗域跟踪海投申请记录]
 */
export const massApplications = pgTable(
  "mass_applications",
  {
    // Primary Key [主键]
    id: uuid("id").defaultRandom().primaryKey(),

    // Student Information [学生信息]
    studentId: uuid("student_id").notNull(), // Student ID (anti-corruption layer) [学生ID（防腐层）]

    // Job Information [岗位信息]
    indeedJobId: varchar("indeed_job_id", { length: 255 }).notNull(), // Normalized Indeed job ID [清洗后的Indeed岗位ID]
    jobId: varchar("job_id", { length: 100 }), // Original platform job ID [招聘平台原始岗位编号]

    // Application Status [申请状态]
    applicationStatus: varchar("application_status", { length: 50 })
      .notNull()
      .default("submitted"),

    // Timeline [时间线]
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(), // Application submission time [投递时间]
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), // Record creation time [创建时间]
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), // Record update time [更新时间]
  },
  (table) => ({
    // Unique constraint: one student can only apply once per job [唯一约束：同一学生对同一岗位只能申请一次]
    ukStudentJob: uniqueIndex("uk_student_indeed_job").on(
      table.studentId,
      table.indeedJobId,
    ),

    // Query optimization indexes [查询优化索引]
    idxStudentStatus: index("idx_mass_app_student_status").on(
      table.studentId,
      table.applicationStatus,
    ),
    idxJobStatus: index("idx_mass_app_job_status").on(
      table.indeedJobId,
      table.applicationStatus,
    ),
    idxAppliedAt: index("idx_mass_app_applied_at").on(table.appliedAt),
  }),
);

export type MassApplication = typeof massApplications.$inferSelect;
export type NewMassApplication = typeof massApplications.$inferInsert;

export default massApplications;
