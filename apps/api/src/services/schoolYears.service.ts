import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { schoolYears } from '../db/schema/index.js';
import { z } from 'zod';

export const CreateSchoolYearSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

export const UpdateSchoolYearSchema = CreateSchoolYearSchema.partial();

/**
 * Lists all school years for a school, newest first.
 */
export async function listSchoolYears(schoolId: string) {
  return db
    .select()
    .from(schoolYears)
    .where(eq(schoolYears.schoolId, schoolId))
    .orderBy(desc(schoolYears.createdAt));
}

/**
 * Creates a new school year. Does not auto-activate.
 */
export async function createSchoolYear(
  schoolId: string,
  data: z.infer<typeof CreateSchoolYearSchema>
) {
  const [year] = await db
    .insert(schoolYears)
    .values({ schoolId, ...data })
    .returning();
  return year;
}

/**
 * Updates a school year's name or dates.
 */
export async function updateSchoolYear(
  id: string,
  schoolId: string,
  data: z.infer<typeof UpdateSchoolYearSchema>
) {
  const [year] = await db
    .update(schoolYears)
    .set(data)
    .where(and(eq(schoolYears.id, id), eq(schoolYears.schoolId, schoolId)))
    .returning();
  return year;
}

/**
 * Sets the given school year as active, deactivating all others in the school.
 */
export async function activateSchoolYear(id: string, schoolId: string) {
  await db
    .update(schoolYears)
    .set({ isActive: false })
    .where(eq(schoolYears.schoolId, schoolId));
  const [year] = await db
    .update(schoolYears)
    .set({ isActive: true })
    .where(and(eq(schoolYears.id, id), eq(schoolYears.schoolId, schoolId)))
    .returning();
  return year;
}

/**
 * Deletes a school year. Cascades to class sections.
 */
export async function deleteSchoolYear(id: string, schoolId: string) {
  await db
    .delete(schoolYears)
    .where(and(eq(schoolYears.id, id), eq(schoolYears.schoolId, schoolId)));
}
