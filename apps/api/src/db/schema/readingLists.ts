import {
  pgTable, uuid, varchar, text, boolean,
  timestamp, pgEnum, uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { books } from './books.js';

export const readingListItemStatusEnum = pgEnum('reading_list_item_status', [
  'to_read', 'reading', 'completed',
]);

export const readingLists = pgTable('reading_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  isPublic: boolean('is_public').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('reading_lists_user_id_idx').on(table.userId),
]);

export const readingListItems = pgTable('reading_list_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  listId: uuid('list_id').notNull().references(() => readingLists.id, { onDelete: 'cascade' }),
  bookId: uuid('book_id').notNull().references(() => books.id),
  status: readingListItemStatusEnum('status').default('to_read').notNull(),
  addedAt: timestamp('added_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('reading_list_items_list_book_idx').on(table.listId, table.bookId),
  index('reading_list_items_list_id_idx').on(table.listId),
]);

export type ReadingList = typeof readingLists.$inferSelect;
export type NewReadingList = typeof readingLists.$inferInsert;
export type ReadingListItem = typeof readingListItems.$inferSelect;
export type NewReadingListItem = typeof readingListItems.$inferInsert;
