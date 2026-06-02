import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  classSections,
  classSectionTeachers,
  classSectionStudents,
  users,
} from '../db/schema/index.js';
import { z } from 'zod';

export const CreateSectionSchema = z.object({
  schoolYearId: z.string().uuid(),
  name: z.string().min(1).max(100),
  gradeLevel: z.number().int().min(1).max(12).optional(),
});

export const UpdateSectionSchema = CreateSectionSchema.partial();

/**
 * Lists all class sections for a school. If userId + role=teacher, filters to their sections.
 */
export async function listClassSections(
  schoolId: string,
  options?: { teacherId?: string }
) {
  const sections = await db
    .select()
    .from(classSections)
    .where(eq(classSections.schoolId, schoolId));

  if (!options?.teacherId) return sections;

  const teacherLinks = await db
    .select({ sectionId: classSectionTeachers.sectionId })
    .from(classSectionTeachers)
    .where(eq(classSectionTeachers.userId, options.teacherId));

  const sectionIds = teacherLinks.map((l) => l.sectionId);
  return sections.filter((s) => sectionIds.includes(s.id));
}

/**
 * Gets a single section with its teacher and student lists.
 */
export async function getClassSectionDetail(id: string, schoolId: string) {
  const [section] = await db
    .select()
    .from(classSections)
    .where(and(eq(classSections.id, id), eq(classSections.schoolId, schoolId)));
  if (!section) return null;

  const [teacherLinks, studentLinks] = await Promise.all([
    db
      .select({ userId: classSectionTeachers.userId })
      .from(classSectionTeachers)
      .where(eq(classSectionTeachers.sectionId, id)),
    db
      .select({ userId: classSectionStudents.userId, enrolledAt: classSectionStudents.enrolledAt })
      .from(classSectionStudents)
      .where(eq(classSectionStudents.sectionId, id)),
  ]);

  const teacherIds = teacherLinks.map((t) => t.userId);
  const studentIds = studentLinks.map((s) => s.userId);

  const [teacherUsers, studentUsers] = await Promise.all([
    teacherIds.length > 0
      ? db
          .select({ id: users.id, fullName: users.fullName, email: users.email })
          .from(users)
          .where(inArray(users.id, teacherIds))
      : [],
    studentIds.length > 0
      ? db
          .select({ id: users.id, fullName: users.fullName, studentId: users.studentId, gradeLevel: users.gradeLevel })
          .from(users)
          .where(inArray(users.id, studentIds))
      : [],
  ]);

  return { ...section, teachers: teacherUsers, students: studentUsers };
}

/**
 * Creates a class section under the given school + year.
 */
export async function createClassSection(
  schoolId: string,
  data: z.infer<typeof CreateSectionSchema>
) {
  const [section] = await db
    .insert(classSections)
    .values({ schoolId, ...data })
    .returning();
  return section;
}

/**
 * Updates a class section's name or grade level.
 */
export async function updateClassSection(
  id: string,
  schoolId: string,
  data: z.infer<typeof UpdateSectionSchema>
) {
  const [section] = await db
    .update(classSections)
    .set(data)
    .where(and(eq(classSections.id, id), eq(classSections.schoolId, schoolId)))
    .returning();
  return section;
}

/**
 * Deletes a class section (cascades teachers + students).
 */
export async function deleteClassSection(id: string, schoolId: string) {
  await db
    .delete(classSections)
    .where(and(eq(classSections.id, id), eq(classSections.schoolId, schoolId)));
}

/** Adds a teacher to a section. */
export async function addTeacher(sectionId: string, userId: string) {
  await db
    .insert(classSectionTeachers)
    .values({ sectionId, userId })
    .onConflictDoNothing();
}

/** Removes a teacher from a section. */
export async function removeTeacher(sectionId: string, userId: string) {
  await db
    .delete(classSectionTeachers)
    .where(
      and(
        eq(classSectionTeachers.sectionId, sectionId),
        eq(classSectionTeachers.userId, userId)
      )
    );
}

/** Adds a student to a section. */
export async function addStudent(sectionId: string, userId: string) {
  await db
    .insert(classSectionStudents)
    .values({ sectionId, userId })
    .onConflictDoNothing();
}

/** Removes a student from a section. */
export async function removeStudent(sectionId: string, userId: string) {
  await db
    .delete(classSectionStudents)
    .where(
      and(
        eq(classSectionStudents.sectionId, sectionId),
        eq(classSectionStudents.userId, userId)
      )
    );
}
