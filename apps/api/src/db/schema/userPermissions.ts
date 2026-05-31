import { pgTable, uuid, varchar, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const userPermissions = pgTable(
  'user_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: varchar('permission', { length: 100 }).notNull(),
    grantedBy: uuid('granted_by').references(() => users.id),
    grantedAt: timestamp('granted_at').defaultNow().notNull(),
  },
  (table) => [unique('uq_user_permission').on(table.userId, table.permission)]
);

export type UserPermission = typeof userPermissions.$inferSelect;
export type NewUserPermission = typeof userPermissions.$inferInsert;
