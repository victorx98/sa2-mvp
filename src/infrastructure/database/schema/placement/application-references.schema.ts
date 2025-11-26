import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Application Type Enum [申请类型枚举]
 * Defines the type of application for shared primary key design
 * [定义申请类型，用于共享主键设计]
 */
export const applicationTypeEnum = [
  "mass", // 海投申请 [Mass application]
  "proxy", // 代投申请 [Proxy application]
  "referral", // 内推申请 [Referral application]
  "bd", // BD推荐申请 [BD recommendation application]
] as const;

export type ApplicationType = (typeof applicationTypeEnum)[number];

/**
 * Job Table Type Enum [岗位表类型枚举]
 * Defines which job table the application references
 * [定义申请关联的岗位表]
 */
export const jobTableTypeEnum = [
  "indeed", // Indeed岗位表 [Indeed jobs table]
  "referral", // 内推岗位表 [Referral jobs table]
  "bd", // BD岗位表 [BD jobs table]
] as const;

export type JobTableType = (typeof jobTableTypeEnum)[number];

/**
 * Application References Table [申请引用表]
 * Central table for shared primary key design across all application types
 * [所有申请类型的中心表，用于共享主键设计]
 */
export const applicationReferences = pgTable(
  "application_references",
  {
    // Shared Primary Key [共享主键]
    id: uuid("id").defaultRandom().primaryKey(),

    // Application Type [申请类型]
    applicationType: varchar("application_type", { length: 50 }).notNull(), // mass/proxy/referral/bd

    // Student Information [学生信息]
    studentId: uuid("student_id").notNull(), // Student ID [学生ID]

    // Job Information [岗位信息]
    jobId: uuid("job_id").notNull(), // Job record ID [岗位记录ID]
    jobTableType: varchar("job_table_type", { length: 50 }).notNull(), // indeed/referral/bd

    // Application Status [申请状态]
    applicationStatus: varchar("application_status", { length: 50 }).notNull(),

    // Timeline [时间线]
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Query optimization indexes [查询优化索引]
    idxApplicationType: index("idx_app_ref_type").on(table.applicationType),
    idxStudent: index("idx_app_ref_student").on(table.studentId),
    idxJob: index("idx_app_ref_job").on(table.jobId, table.jobTableType),
    idxStatus: index("idx_app_ref_status").on(table.applicationStatus),
    idxStudentType: index("idx_app_ref_student_type").on(table.studentId, table.applicationType),
  }),
);

export type ApplicationReference = typeof applicationReferences.$inferSelect;
export type NewApplicationReference = typeof applicationReferences.$inferInsert;

export default applicationReferences;
