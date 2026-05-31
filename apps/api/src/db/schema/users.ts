import { pgTable, uuid, varchar, integer, boolean, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { schools } from './schools.js';
import { notificationChannelEnum } from './notificationEnums.js';

export const userRoleEnum = pgEnum('user_role', [
  'student',
  'teacher',
  'librarian',
  'library_assistant',
  'admin',
]);

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique(),
  studentId: varchar('student_id', { length: 100 }).unique(),
  pinHash: varchar('pin_hash', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  gradeLevel: integer('grade_level'),
  schoolId: uuid('school_id').notNull().references(() => schools.id),
  isActive: boolean('is_active').default(true).notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  approvalStatus: approvalStatusEnum('approval_status').default('approved').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  notificationChannel: notificationChannelEnum('notification_channel'),
}, (table) => [
  index('users_school_id_idx').on(table.schoolId),
  index('users_role_idx').on(table.role),
  index('users_approval_status_idx').on(table.approvalStatus),
]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
