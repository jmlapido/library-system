import { z } from 'zod';

export const UserRoleSchema = z.enum([
  'student',
  'teacher',
  'librarian',
  'library_assistant',
  'admin',
  'super_admin',
]);

export const CreateUserSchema = z.object({
  email: z.string().email().optional(),
  studentId: z.string().max(100).optional(),
  fullName: z.string().min(1).max(255),
  role: UserRoleSchema,
  gradeLevel: z.number().int().min(1).max(12).optional(),
  schoolId: z.string().uuid(),
}).refine(
  (data) => data.email !== undefined || data.studentId !== undefined,
  { message: 'Either email or studentId is required' }
);

export type UserRole = z.infer<typeof UserRoleSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
