import { z } from 'zod';

export const LoginSchema = z.object({
  identifier: z.string().min(1),
  credential: z.string().min(1),
});

export const RegisterStaffSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(255),
  role: z.enum(['teacher', 'librarian', 'library_assistant']),
  schoolId: z.string().uuid(),
});

export const ResetPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterStaffInput = z.infer<typeof RegisterStaffSchema>;
