import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

/**
 * Job Category Schema
 * 岗位类别(Job Category)表定义
 */
export const jobCategoryTable = pgTable("job_category", {
  id: varchar("id", { length: 255 }).primaryKey(),
  description: varchar("description"),
  status: varchar("status", { length: 50 }),
  createdTime: timestamp("created_time", { withTimezone: true, mode: "date" })
    .defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: varchar("created_by", { length: 255 }),
  updatedBy: varchar("updated_by", { length: 255 }),
});

export type JobCategory = typeof jobCategoryTable.$inferSelect;
export type InsertJobCategory = typeof jobCategoryTable.$inferInsert;

