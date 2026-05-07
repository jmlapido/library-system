import type { Context } from 'hono';
import * as staffService from '../services/staff.service.js';
import { AppError } from '../services/auth.service.js';
import {
  RegisterStaffSchema,
  VerifyEmailSchema,
  SetPasswordSchema,
  CreateStaffByAdminSchema,
} from 'shared';
import type { AccessTokenPayload } from '../lib/jwt.js';

const APP_ERRORS_TO_HTTP: Record<string, number> = {
  EMAIL_ALREADY_EXISTS: 409,
  TOKEN_INVALID: 400,
  STAFF_NOT_FOUND: 404,
  EMAIL_SEND_FAILED: 502,
};

/**
 * Maps an AppError or unknown error to a JSON response with the appropriate HTTP status.
 * @param c - Hono context.
 * @param err - The caught error.
 */
function errorResponse(c: Context, err: unknown) {
  if (err instanceof AppError) {
    const status = (APP_ERRORS_TO_HTTP[err.code] ?? 400) as 400 | 404 | 409 | 502;
    return c.json({ success: false, error: err.message, code: err.code }, status);
  }
  return c.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
}

/**
 * POST /api/v1/auth/register
 * Self-registration for staff accounts (teacher, librarian, library_assistant).
 */
export async function register(c: Context) {
  const body = await c.req.json();
  const parsed = RegisterStaffSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation error', code: 'VALIDATION_ERROR' }, 422);
  }
  try {
    await staffService.registerStaff(parsed.data);
    return c.json({ success: true, message: 'Registration submitted. Await admin approval.' }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
}

/**
 * POST /api/v1/auth/verify-email
 * Verify a staff email address using a one-time token.
 */
export async function verifyEmailHandler(c: Context) {
  const body = await c.req.json();
  const parsed = VerifyEmailSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation error', code: 'VALIDATION_ERROR' }, 422);
  }
  try {
    await staffService.verifyEmail(parsed.data.token);
    return c.json({ success: true, message: 'Email verified. You can now log in.' });
  } catch (err) {
    return errorResponse(c, err);
  }
}

/**
 * POST /api/v1/auth/set-password
 * Set a password using a one-time staff invite token.
 */
export async function setPasswordHandler(c: Context) {
  const body = await c.req.json();
  const parsed = SetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation error', code: 'VALIDATION_ERROR' }, 422);
  }
  try {
    await staffService.setPasswordFromInvite(parsed.data.token, parsed.data.password);
    return c.json({ success: true, message: 'Password set. You can now log in.' });
  } catch (err) {
    return errorResponse(c, err);
  }
}

/**
 * GET /api/v1/admin/staff/pending
 * List all pending staff accounts for the admin's school.
 */
export async function listPending(c: Context) {
  const user = c.get('user') as AccessTokenPayload;
  try {
    const data = await staffService.listPendingStaff(user.schoolId);
    return c.json({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
}

/**
 * POST /api/v1/admin/staff/:id/approve
 * Approve a pending staff account and send a verification email.
 */
export async function approve(c: Context) {
  const userId = c.req.param('id');
  try {
    await staffService.approveStaff(userId);
    return c.json({ success: true, message: 'Staff approved. Verification email sent.' });
  } catch (err) {
    return errorResponse(c, err);
  }
}

/**
 * POST /api/v1/admin/staff/:id/reject
 * Reject a pending staff account and notify the applicant.
 */
export async function reject(c: Context) {
  const userId = c.req.param('id');
  try {
    await staffService.rejectStaff(userId);
    return c.json({ success: true, message: 'Staff account rejected.' });
  } catch (err) {
    return errorResponse(c, err);
  }
}

/**
 * POST /api/v1/admin/staff
 * Admin-create a staff account and send an invite link for password setup.
 */
export async function createByAdmin(c: Context) {
  const body = await c.req.json();
  const parsed = CreateStaffByAdminSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation error', code: 'VALIDATION_ERROR' }, 422);
  }
  try {
    const result = await staffService.createStaffByAdmin(parsed.data);
    return c.json({ success: true, data: result }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
}
