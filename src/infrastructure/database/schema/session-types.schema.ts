import { pgTable, uuid, varchar, boolean, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * Session Types Schema
 * 
 * Manages session type metadata configuration (business classification, evaluation templates, billing rules)
 */
export const sessionTypes = pgTable(
  'session_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    templateId: uuid('template_id'),
    isBilling: boolean('is_billing').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    codeIdx: index('idx_session_types_code').on(table.code),
    nameIdx: index('idx_session_types_name').on(table.name),
  }),
);

export type SessionType = typeof sessionTypes.$inferSelect;
export type NewSessionType = typeof sessionTypes.$inferInsert;


