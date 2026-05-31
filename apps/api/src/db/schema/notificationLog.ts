import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { schools } from './schools.js';
import { users } from './users.js';
import { checkouts } from './circulation.js';

export const notificationLog = pgTable('notification_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').references(() => schools.id),
  userId: uuid('user_id').references(() => users.id),
  checkoutId: uuid('checkout_id').references(() => checkouts.id),
  notificationType: text('notification_type').notNull(),
  channel: text('channel').notNull(),
  status: text('status').notNull().default('sent'),
  messagePreview: text('message_preview'),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
}, (table) => [
  index('notification_log_user_id_idx').on(table.userId),
  index('notification_log_sent_at_idx').on(table.sentAt),
  index('notification_log_type_idx').on(table.notificationType),
]);

export type NotificationLog = typeof notificationLog.$inferSelect;
export type NewNotificationLog = typeof notificationLog.$inferInsert;
