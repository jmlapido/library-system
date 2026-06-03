import { pgTable, uuid, varchar, timestamp, primaryKey, pgEnum, index } from 'drizzle-orm/pg-core';
import { classSections } from './classSections.js';
import { books } from './books.js';
import { users } from './users.js';

export const assignmentTypeEnum = pgEnum('assignment_type', ['required', 'optional']);

export const sectionBookAssignments = pgTable('section_book_assignments', {
  sectionId: uuid('section_id').notNull().references(() => classSections.id, { onDelete: 'cascade' }),
  bookId: uuid('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  type: assignmentTypeEnum('type').notNull().default('optional'),
  assignedBy: uuid('assigned_by').references(() => users.id),
  note: varchar('note', { length: 500 }),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.sectionId, t.bookId] }),
  index('sba_section_id_idx').on(t.sectionId),
  index('sba_book_id_idx').on(t.bookId),
]);

export type SectionBookAssignment = typeof sectionBookAssignments.$inferSelect;
