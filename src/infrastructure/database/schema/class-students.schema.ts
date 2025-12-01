import { pgTable, uuid, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { classes } from './classes.schema';

export const classStudents = pgTable(
  'class_students',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    studentUserId: uuid('student_user_id').notNull(),
    enrolledAt: timestamp('enrolled_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_class_students_class').on(table.classId),
    index('idx_class_students_student').on(table.studentUserId),
    uniqueIndex('unique_class_student').on(table.classId, table.studentUserId),
  ],
);

export type ClassStudent = typeof classStudents.$inferSelect;

