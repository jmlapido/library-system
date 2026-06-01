import { pgTable, uuid, text, varchar, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { schools } from './schools.js';

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  fcmToken: text('fcm_token').notNull(),
  deviceName: varchar('device_name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('push_subscriptions_user_token_unique').on(table.userId, table.fcmToken),
  index('push_subscriptions_user_id_idx').on(table.userId),
]);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
