import {
  pgTable, uuid, varchar, text, integer, boolean,
  timestamp, pgEnum, numeric,
} from 'drizzle-orm/pg-core';
import { schools } from './schools.js';

export const bookConditionEnum = pgEnum('book_condition', [
  'excellent', 'good', 'fair', 'poor',
]);

export const bookStatusEnum = pgEnum('book_status', [
  'available', 'checked_out', 'returned',
  'being_processed', 'shelved', 'damaged', 'lost',
]);

export const books = pgTable('books', {
  id: uuid('id').primaryKey().defaultRandom(),
  isbn: varchar('isbn', { length: 20 }).unique(),
  title: varchar('title', { length: 500 }).notNull(),
  author: varchar('author', { length: 255 }).notNull(),
  publisher: varchar('publisher', { length: 255 }),
  publicationYear: integer('publication_year'),
  description: text('description'),
  coverUrl: text('cover_url'),
  category: varchar('category', { length: 100 }),
  genre: varchar('genre', { length: 100 }),
  subjectTags: text('subject_tags').array(),
  language: varchar('language', { length: 50 }).default('en').notNull(),
  pageCount: integer('page_count'),
  lexileLevel: integer('lexile_level'),
  readingLevel: varchar('reading_level', { length: 50 }),
  seriesName: varchar('series_name', { length: 255 }),
  seriesNumber: integer('series_number'),
  deweyDecimal: varchar('dewey_decimal', { length: 50 }),
  schoolId: uuid('school_id').notNull().references(() => schools.id),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const bookInventory = pgTable('book_inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookId: uuid('book_id').notNull().references(() => books.id),
  barcode: varchar('barcode', { length: 100 }).notNull().unique(),
  condition: bookConditionEnum('condition'),
  location: varchar('location', { length: 100 }),
  status: bookStatusEnum('status').notNull().default('available'),
  copyNumber: integer('copy_number'),
  schoolId: uuid('school_id').notNull().references(() => schools.id),
  acquisitionDate: timestamp('acquisition_date'),
  purchaseCost: numeric('purchase_cost', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type BookInventory = typeof bookInventory.$inferSelect;
export type NewBookInventory = typeof bookInventory.$inferInsert;
