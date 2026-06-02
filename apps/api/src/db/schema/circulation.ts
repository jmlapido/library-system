import { pgTable, uuid, timestamp, integer, numeric, boolean, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { bookInventory, books } from './books.js';

export const checkoutStatusEnum = pgEnum('checkout_status', [
  'checked_out', 'overdue', 'returned', 'lost',
]);

export const holdStatusEnum = pgEnum('hold_status', [
  'pending', 'ready', 'fulfilled', 'expired',
]);

export const checkouts = pgTable('checkouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  bookInventoryId: uuid('book_inventory_id').notNull().references(() => bookInventory.id),
  checkoutDate: timestamp('checkout_date').defaultNow().notNull(),
  dueDate: timestamp('due_date').notNull(),
  returnDate: timestamp('return_date'),
  renewalCount: integer('renewal_count').default(0).notNull(),
  status: checkoutStatusEnum('status').notNull().default('checked_out'),
  lateFee: numeric('late_fee', { precision: 10, scale: 2 }),
  fineAmount: numeric('fine_amount', { precision: 10, scale: 2 }).default('0'),
  finePaid: boolean('fine_paid').default(false),
  fineWaived: boolean('fine_waived').default(false),
  fineWaivedBy: uuid('fine_waived_by').references(() => users.id),
  fineWaivedAt: timestamp('fine_waived_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('checkouts_user_id_idx').on(table.userId),
  index('checkouts_book_inventory_id_idx').on(table.bookInventoryId),
  index('checkouts_status_idx').on(table.status),
]);

export const holds = pgTable('holds', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  bookId: uuid('book_id').notNull().references(() => books.id),
  position: integer('position').notNull(),
  status: holdStatusEnum('status').notNull().default('pending'),
  expirationDate: timestamp('expiration_date'),
  notified: boolean('notified').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('holds_book_position_idx').on(table.bookId, table.position),
  index('holds_user_id_idx').on(table.userId),
]);

export type Checkout = typeof checkouts.$inferSelect;
export type Hold = typeof holds.$inferSelect;
export type NewCheckout = typeof checkouts.$inferInsert;
export type NewHold = typeof holds.$inferInsert;
