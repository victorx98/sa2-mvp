import { pgTable, uuid, varchar, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { serviceTypes } from './service-types.schema';

/**
 * Recommendation Letter Types Schema
 * 
 * Manages recommendation letter type configurations with hierarchical relationships
 * Supports cascading types (e.g., Package -> Online/Offline options)
 */
export const recommLetterTypes = pgTable(
  'recomm_letter_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    typeCode: varchar('type_code', { length: 50 }).notNull().unique(),
    typeName: varchar('type_name', { length: 100 }).notNull(),
    serviceTypeCode: varchar('service_type_code', { length: 50 }).notNull().references(() => serviceTypes.code),
    parentId: uuid('parent_id'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    typeCodeIdx: index('idx_recomm_letter_types_type_code').on(table.typeCode),
    serviceTypeCodeIdx: index('idx_recomm_letter_types_service_type_code').on(table.serviceTypeCode),
    parentIdIdx: index('idx_recomm_letter_types_parent_id').on(table.parentId),
  }),
);

export type RecommLetterType = typeof recommLetterTypes.$inferSelect;
export type NewRecommLetterType = typeof recommLetterTypes.$inferInsert;

