import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { schools } from '../db/schema/schools.js';
import { AppError } from '../utils/errors.js';

// ─── Settings Schema ──────────────────────────────────────────────────────────

export const SchoolSettingsSchema = z.object({
  studentCheckoutDays: z.coerce.number().int().min(1).max(365).default(14),
  teacherCheckoutDays: z.coerce.number().int().min(1).max(365).default(28),
  studentCheckoutLimit: z.coerce.number().int().min(1).max(100).default(5),
  teacherCheckoutLimit: z.coerce.number().int().min(1).max(100).default(15),
  fineEnabled: z.boolean().default(false),
  finePerDay: z.coerce.number().min(0).max(1000).default(0),
  gracePeriodDays: z.coerce.number().int().min(0).max(30).default(0),
  maxFineAmount: z.coerce.number().min(0).max(100000).default(0),
  overdueReminderDays: z.coerce.number().int().min(0).max(30).default(2),
  timezone: z.string().min(1).max(100).default('Asia/Manila'),
  // Notification scheduling
  reminderDaysBefore: z.array(z.coerce.number().int().min(1).max(365)).default([3, 1]),
  overdueRepeatEvery: z.coerce.number().int().min(1).max(30).default(2),
  notificationTime: z.string().regex(/^\d{2}:\d{2}$/).default('08:00'),
  smsSenderId: z.string().max(11).default('LIBRARY'),
  // OAuth SSO
  ssoGoogleEnabled: z.boolean().default(false),
  ssoGoogleClientId: z.string().max(255).default(''),
  ssoGoogleClientSecret: z.string().max(512).default(''),
  ssoMicrosoftEnabled: z.boolean().default(false),
  ssoMicrosoftClientId: z.string().max(255).default(''),
  ssoMicrosoftClientSecret: z.string().max(512).default(''),
  // LDAP/AD SSO
  ldapEnabled: z.boolean().default(false),
  ldapUrl: z.string().max(255).default(''),
  ldapBaseDn: z.string().max(512).default(''),
  ldapBindDn: z.string().max(512).default(''),
  ldapBindPassword: z.string().max(512).default(''),
  ldapSearchFilter: z.string().max(255).default('(mail={{email}})'),
  ldapEmailAttribute: z.string().max(100).default('mail'),
  ldapNameAttribute: z.string().max(100).default('displayName'),
});

export type SchoolSettings = z.infer<typeof SchoolSettingsSchema>;

export const DEFAULT_SETTINGS: SchoolSettings = SchoolSettingsSchema.parse({});

// ─── School Info Schema ───────────────────────────────────────────────────────

export const SchoolInfoSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  location: z.string().max(255).optional(),
});

export type SchoolInfo = z.infer<typeof SchoolInfoSchema>;

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Retrieve a school's merged settings (DB values merged over defaults).
 */
export async function getSchoolSettings(schoolId: string): Promise<{ info: { name: string; location: string | null }; settings: SchoolSettings }> {
  const [school] = await db
    .select({ name: schools.name, location: schools.location, settings: schools.settings })
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);

  if (!school) throw new AppError('SCHOOL_NOT_FOUND', 'School not found');

  const parsed = SchoolSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(school.settings ?? {}) });
  const settings = parsed.success ? parsed.data : DEFAULT_SETTINGS;

  return {
    info: { name: school.name, location: school.location ?? null },
    settings,
  };
}

/**
 * Update a school's info and/or settings.
 * Merges patch over existing settings; validates via Zod.
 */
export async function updateSchoolSettings(
  schoolId: string,
  info: SchoolInfo,
  settingsPatch: Partial<SchoolSettings>,
): Promise<SchoolSettings> {
  const [existing] = await db
    .select({ settings: schools.settings })
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);

  if (!existing) throw new AppError('SCHOOL_NOT_FOUND', 'School not found');

  const merged = { ...DEFAULT_SETTINGS, ...(existing.settings ?? {}), ...settingsPatch };
  const parsed = SchoolSettingsSchema.safeParse(merged);
  if (!parsed.success) {
    throw new AppError('INVALID_SETTINGS', parsed.error.issues[0]?.message ?? 'Invalid settings');
  }

  const updateValues: Record<string, unknown> = { settings: parsed.data };
  if (info.name) updateValues.name = info.name;
  if (info.location !== undefined) updateValues.location = info.location;

  await db.update(schools).set(updateValues).where(eq(schools.id, schoolId));

  return parsed.data;
}
