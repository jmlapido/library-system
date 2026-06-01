import {
  pgTable, uuid, varchar, text, integer,
  timestamp, date, pgEnum, uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { schools } from './schools.js';
import { users } from './users.js';
import { books } from './books.js';

export const bookClubStatusEnum = pgEnum('book_club_status', [
  'planning', 'active', 'completed', 'cancelled',
]);

export const bookClubMemberRoleEnum = pgEnum('book_club_member_role', [
  'member', 'organizer',
]);

export const bookClubs = pgTable('book_clubs', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => schools.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  bookId: uuid('book_id').references(() => books.id),
  organizerId: uuid('organizer_id').notNull().references(() => users.id),
  startDate: date('start_date'),
  endDate: date('end_date'),
  maxMembers: integer('max_members'),
  status: bookClubStatusEnum('status').default('planning').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('book_clubs_school_id_idx').on(table.schoolId),
  index('book_clubs_organizer_id_idx').on(table.organizerId),
  index('book_clubs_status_idx').on(table.status),
]);

export const bookClubMembers = pgTable('book_club_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  clubId: uuid('club_id').notNull().references(() => bookClubs.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: bookClubMemberRoleEnum('role').default('member').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('book_club_members_club_user_idx').on(table.clubId, table.userId),
  index('book_club_members_user_id_idx').on(table.userId),
]);

export type BookClub = typeof bookClubs.$inferSelect;
export type NewBookClub = typeof bookClubs.$inferInsert;
export type BookClubMember = typeof bookClubMembers.$inferSelect;
export type NewBookClubMember = typeof bookClubMembers.$inferInsert;
