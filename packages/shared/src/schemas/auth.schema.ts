import { z } from 'zod';

/** Login payload supporting both email+password and student ID+PIN. */
export const LoginSchema = z.object({
  identifier: z.string().min(1),
  credential: z.string().min(1),
});

/** Self-registration payload for staff accounts. */
export const RegisterStaffSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(255).trim(),
  role: z.enum(['teacher', 'librarian', 'library_assistant']),
  schoolId: z.string().uuid(),
});

/** Payload for verifying a staff email address via token. */
export const VerifyEmailSchema = z.object({
  token: z.string().min(64),
});

/** Payload for setting a password using a one-time token. */
export const SetPasswordSchema = z.object({
  token: z.string().min(64),
  password: z.string().min(8).max(128),
});

/** Payload for admin-initiated staff account creation. */
export const CreateStaffByAdminSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  fullName: z.string().min(1).max(255).trim(),
  role: z.enum(['teacher', 'librarian', 'library_assistant']),
  schoolId: z.string().uuid(),
});

/** Payload for requesting a password reset email. */
export const ResetPasswordRequestSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

/** Payload for confirming a password reset with token and new password. */
export const ResetPasswordConfirmSchema = z.object({
  token: z.string().min(64),
  newPassword: z.string().min(8).max(128),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterStaffInput = z.infer<typeof RegisterStaffSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type SetPasswordInput = z.infer<typeof SetPasswordSchema>;
export type CreateStaffByAdminInput = z.infer<typeof CreateStaffByAdminSchema>;
export type ResetPasswordRequestInput = z.infer<typeof ResetPasswordRequestSchema>;
export type ResetPasswordConfirmInput = z.infer<typeof ResetPasswordConfirmSchema>;
