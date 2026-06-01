import {
  pgTable, uuid, varchar, text, integer, boolean,
  timestamp, date, pgEnum, uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { schools } from './schools.js';
import { users } from './users.js';

export const challengeGoalTypeEnum = pgEnum('challenge_goal_type', [
  'books', 'pages', 'genres',
]);

export const challengeStatusEnum = pgEnum('challenge_status', [
  'upcoming', 'active', 'completed',
]);

export const badges = pgTable('badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => schools.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  iconUrl: text('icon_url'),
  criteria: varchar('criteria', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('badges_school_id_idx').on(table.schoolId),
]);

export const userBadges = pgTable('user_badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  badgeId: uuid('badge_id').notNull().references(() => badges.id),
  earnedAt: timestamp('earned_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('user_badges_user_badge_idx').on(table.userId, table.badgeId),
  index('user_badges_user_id_idx').on(table.userId),
]);

export const challenges = pgTable('challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => schools.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  goal: integer('goal').notNull(),
  goalType: challengeGoalTypeEnum('goal_type').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: challengeStatusEnum('status').default('upcoming').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('challenges_school_id_idx').on(table.schoolId),
  index('challenges_status_idx').on(table.status),
]);

export const challengeProgress = pgTable('challenge_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  challengeId: uuid('challenge_id').notNull().references(() => challenges.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  progress: integer('progress').default(0).notNull(),
  completed: boolean('completed').default(false).notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => [
  uniqueIndex('challenge_progress_challenge_user_idx').on(table.challengeId, table.userId),
  index('challenge_progress_user_id_idx').on(table.userId),
]);

export type Badge = typeof badges.$inferSelect;
export type NewBadge = typeof badges.$inferInsert;
export type UserBadge = typeof userBadges.$inferSelect;
export type NewUserBadge = typeof userBadges.$inferInsert;
export type Challenge = typeof challenges.$inferSelect;
export type NewChallenge = typeof challenges.$inferInsert;
export type ChallengeProgress = typeof challengeProgress.$inferSelect;
export type NewChallengeProgress = typeof challengeProgress.$inferInsert;
