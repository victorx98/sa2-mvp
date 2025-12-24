import { pgTable, varchar, timestamp, text } from "drizzle-orm/pg-core";

/**
 * Job Title Schema
 * 岗位名称(Job Title)表定义
 */
export const jobTitleTable = pgTable("job_title", {
  id: varchar("id", { length: 255 }).primaryKey(),
  description: text("description"),
  status: varchar("status", { length: 50 }),
  jobCategoryId: varchar("job_category_id", { length: 255 }),
  createdTime: timestamp("created_time", { withTimezone: true, mode: "date" })
    .defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: varchar("created_by", { length: 255 }),
  updatedBy: varchar("updated_by", { length: 255 }),
});

export type JobTitle = typeof jobTitleTable.$inferSelect;
export type InsertJobTitle = typeof jobTitleTable.$inferInsert;

