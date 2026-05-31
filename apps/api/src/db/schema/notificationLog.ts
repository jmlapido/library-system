import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { schools } from './schools.js';
import { users } from './users.js';
import { checkouts } from './circulation.js';
import {
  notificationTypeEnum,
  notificationChannelEnum,
  notificationStatusEnum,
} from './notificationEnums.js';

export {
  notificationTypeEnum,
  notificationChannelEnum,
  notificationStatusEnum,
} from './notificationEnums.js';

export const notificationLog = pgTable('notification_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  checkoutId: uuid('checkout_id').references(() => checkouts.id, { onDelete: 'set null' }),
  notificationType: notificationTypeEnum('notification_type').notNull(),
  channel: notificationChannelEnum('channel').notNull(),
  status: notificationStatusEnum('status').notNull().default('sent'),
  messagePreview: varchar('message_preview', { length: 200 }),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
}, (table) => [
  index('notification_log_user_id_idx').on(table.userId),
  index('notification_log_sent_at_idx').on(table.sentAt),
  index('notification_log_type_idx').on(table.notificationType),
]);

export type NotificationLog = typeof notificationLog.$inferSelect;
export type NewNotificationLog = typeof notificationLog.$inferInsert;
