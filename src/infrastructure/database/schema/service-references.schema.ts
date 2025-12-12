import { pgTable, uuid, varchar, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { userTable } from './user.schema';

/**
 * Service References Schema
 * 
 * Records all completed services (Immutable, Shared Primary Key)
 */
export const serviceReferences = pgTable(
  'service_references',
  {
    id: uuid('id').primaryKey(), // Shared primary key from business tables
    serviceType: varchar('service_type', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }), // Session title from business tables
    studentUserId: uuid('student_user_id')
      .notNull()
      .references(() => userTable.id),
    providerUserId: uuid('provider_user_id')
      .notNull()
      .references(() => userTable.id),
    consumedUnits: decimal('consumed_units', { precision: 10, scale: 2 }).notNull(),
    unitType: varchar('unit_type', { length: 20 }).notNull(),
    completedTime: timestamp('completed_time', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    typeIdx: index('idx_service_ref_type').on(table.serviceType),
    studentIdx: index('idx_service_ref_student').on(table.studentUserId, table.completedTime),
    providerIdx: index('idx_service_ref_provider').on(table.providerUserId, table.completedTime),
    completedTimeIdx: index('idx_service_ref_completed_time').on(table.completedTime),
  }),
);

export type ServiceReference = typeof serviceReferences.$inferSelect;
export type NewServiceReference = typeof serviceReferences.$inferInsert;

