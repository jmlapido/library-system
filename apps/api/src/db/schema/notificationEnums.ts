import { pgEnum } from 'drizzle-orm/pg-core';

export const notificationTypeEnum = pgEnum('notification_type_enum', [
  'due_reminder',
  'overdue_notice',
  'fine_notice',
  'hold_ready',
  'hold_expired',
]);

export const notificationChannelEnum = pgEnum('notification_channel_enum', [
  'email',
  'sms',
  'both',
]);

export const notificationStatusEnum = pgEnum('notification_status_enum', [
  'sent',
  'failed',
  'opted_out',
]);
