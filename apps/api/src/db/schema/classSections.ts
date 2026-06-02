import { pgTable, uuid, varchar, integer, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
import { schools } from './schools.js';
import { schoolYears } from './schoolYears.js';
import { users } from './users.js';

export const classSections = pgTable('class_sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => schools.id),
  schoolYearId: uuid('school_year_id').notNull().references(() => schoolYears.id),
  name: varchar('name', { length: 100 }).notNull(),
  gradeLevel: integer('grade_level'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('class_sections_school_id_idx').on(t.schoolId),
  index('class_sections_year_id_idx').on(t.schoolYearId),
]);

export const classSectionTeachers = pgTable('class_section_teachers', {
  sectionId: uuid('section_id').notNull().references(() => classSections.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.sectionId, t.userId] }),
]);

export const classSectionStudents = pgTable('class_section_students', {
  sectionId: uuid('section_id').notNull().references(() => classSections.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.sectionId, t.userId] }),
]);

export type ClassSection = typeof classSections.$inferSelect;
export type NewClassSection = typeof classSections.$inferInsert;
