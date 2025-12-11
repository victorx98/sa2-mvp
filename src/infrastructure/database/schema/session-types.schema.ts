import { pgTable, uuid, varchar, boolean, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { serviceTypes } from './service-types.schema';

/**
 * Session Types Schema
 * 
 * Manages session type metadata configuration (business classification, evaluation templates, billing rules)
 */
export const sessionTypes = pgTable(
  'session_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    serviceTypeCode: varchar('service_type_code', { length: 50 }).notNull().references(() => serviceTypes.code),
    templateId: uuid('template_id'),
    isBilling: boolean('is_billing').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    codeIdx: index('idx_session_types_code').on(table.code),
    nameIdx: index('idx_session_types_name').on(table.name),
    serviceTypeCodeIdx: index('idx_session_types_service_type_code').on(table.serviceTypeCode),
    uniqueServiceTypeCode: unique('uq_session_types_service_type_code_code').on(table.serviceTypeCode, table.code),
  }),
);

export type SessionType = typeof sessionTypes.$inferSelect;
export type NewSessionType = typeof sessionTypes.$inferInsert;


