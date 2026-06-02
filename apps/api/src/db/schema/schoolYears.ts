import { pgTable, uuid, varchar, date, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { schools } from './schools.js';

export const schoolYears = pgTable('school_years', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => schools.id),
  name: varchar('name', { length: 100 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('school_years_school_id_idx').on(t.schoolId),
  index('school_years_is_active_idx').on(t.isActive),
]);

export type SchoolYear = typeof schoolYears.$inferSelect;
export type NewSchoolYear = typeof schoolYears.$inferInsert;
