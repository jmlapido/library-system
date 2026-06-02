import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { schools } from '../db/schema/schools.js';
import { AppError } from '../utils/errors.js';
import type { School } from '../db/schema/schools.js';

export interface CreateSchoolInput {
  name: string;
  location?: string;
}

/**
 * List all schools in the system ordered by creation date.
 * @returns Array of all school records.
 */
export async function listAllSchools(): Promise<School[]> {
  return db.select().from(schools).orderBy(schools.createdAt);
}

/**
 * Get a single school by its UUID.
 * @param id - The school's UUID.
 * @throws AppError SCHOOL_NOT_FOUND if no school matches.
 */
export async function getSchoolById(id: string): Promise<School> {
  const [school] = await db.select().from(schools).where(eq(schools.id, id));
  if (!school) throw new AppError('SCHOOL_NOT_FOUND', 'School not found');
  return school;
}

/**
 * Create a new school record.
 * @param input - School name (required) and optional location.
 * @throws AppError VALIDATION_ERROR if name is blank.
 */
export async function createSchool(input: CreateSchoolInput): Promise<School> {
  if (!input.name.trim()) throw new AppError('VALIDATION_ERROR', 'School name is required');
  const [school] = await db
    .insert(schools)
    .values({ name: input.name.trim(), location: input.location?.trim(), settings: {} })
    .returning();
  return school!;
}

/**
 * Update a school's name and/or location.
 * @param id - The school's UUID.
 * @param input - Partial update fields (name, location).
 * @throws AppError SCHOOL_NOT_FOUND if no school matches.
 */
export async function updateSchool(id: string, input: Partial<CreateSchoolInput>): Promise<School> {
  const [existing] = await db.select({ id: schools.id }).from(schools).where(eq(schools.id, id));
  if (!existing) throw new AppError('SCHOOL_NOT_FOUND', 'School not found');
  const updates: Partial<{ name: string; location: string }> = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.location !== undefined) updates.location = input.location.trim();
  const [updated] = await db.update(schools).set(updates).where(eq(schools.id, id)).returning();
  return updated!;
}
