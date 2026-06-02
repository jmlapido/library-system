import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { CheckoutInputSchema, ReturnInputSchema, AdvanceStageInputSchema, RenewInputSchema, PlaceHoldInputSchema } from 'shared';
import {
  checkout, returnBook, advanceReturnStage, renewCheckout,
  placeHold, cancelHold, getUserCheckouts, getUserHolds, getShelvingQueue,
} from '../services/circulation.service.js';
import { manualExpireHold } from '../services/holdExpiry.service.js';
import { AppError } from '../utils/errors.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

function parseBody(c: Context) {
  return c.req.json().catch(() => { throw new HTTPException(400, { message: 'Invalid JSON' }); });
}

function handleAppError(err: unknown, c: Context) {
  if (err instanceof AppError) {
    const status = ['COPY_NOT_FOUND', 'CHECKOUT_NOT_FOUND', 'BOOK_NOT_FOUND', 'HOLD_NOT_FOUND'].includes(err.code) ? 404
      : ['COPY_NOT_AVAILABLE', 'NOT_CHECKED_OUT', 'CHECKOUT_NOT_ACTIVE', 'INVALID_STAGE'].includes(err.code) ? 409
      : 422;
    return c.json({ success: false, error: err.message, code: err.code }, status);
  }
  throw err;
}

/** POST /api/v1/circulation/checkout */
export async function checkoutController(c: Context) {
  const body = await parseBody(c);
  const parsed = CheckoutInputSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);

  const user = c.get('user') as AccessTokenPayload;
  if (parsed.data.userId && !['librarian', 'admin', 'library_assistant'].includes(user.role)) {
    return c.json({ success: false, error: 'Only staff can checkout for other users', code: 'FORBIDDEN' }, 403);
  }
  try {
    const record = await checkout(parsed.data, user);
    return c.json({ success: true, data: record, message: 'Checkout successful' }, 201);
  } catch (err) { return handleAppError(err, c); }
}

/** POST /api/v1/circulation/return */
export async function returnController(c: Context) {
  const body = await parseBody(c);
  const parsed = ReturnInputSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  const user = c.get('user') as AccessTokenPayload;
  try {
    const result = await returnBook(parsed.data, user.schoolId!);
    return c.json({ success: true, data: result, message: 'Return processed' });
  } catch (err) { return handleAppError(err, c); }
}

/** POST /api/v1/circulation/return/advance */
export async function advanceStageController(c: Context) {
  const body = await parseBody(c);
  const parsed = AdvanceStageInputSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  const user = c.get('user') as AccessTokenPayload;
  try {
    const result = await advanceReturnStage(parsed.data, user.schoolId!);
    return c.json({ success: true, data: result, message: 'Stage advanced' });
  } catch (err) { return handleAppError(err, c); }
}

/** POST /api/v1/circulation/renew */
export async function renewController(c: Context) {
  const body = await parseBody(c);
  const parsed = RenewInputSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  const user = c.get('user') as AccessTokenPayload;
  try {
    const record = await renewCheckout(parsed.data, user);
    return c.json({ success: true, data: record, message: 'Checkout renewed' });
  } catch (err) { return handleAppError(err, c); }
}

/** POST /api/v1/circulation/holds */
export async function placeHoldController(c: Context) {
  const body = await parseBody(c);
  const parsed = PlaceHoldInputSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  const user = c.get('user') as AccessTokenPayload;
  try {
    const hold = await placeHold(parsed.data, user);
    return c.json({ success: true, data: hold, message: 'Hold placed' }, 201);
  } catch (err) { return handleAppError(err, c); }
}

/** DELETE /api/v1/circulation/holds/:holdId */
export async function cancelHoldController(c: Context) {
  const holdId = c.req.param('holdId')!;
  const user = c.get('user') as AccessTokenPayload;
  try {
    await cancelHold(holdId, user);
    return c.json({ success: true, data: null, message: 'Hold cancelled' });
  } catch (err) { return handleAppError(err, c); }
}

/** GET /api/v1/circulation/my/checkouts */
export async function myCheckoutsController(c: Context) {
  const user = c.get('user') as AccessTokenPayload;
  const records = await getUserCheckouts(user.sub);
  return c.json({ success: true, data: records, message: 'Checkouts retrieved' });
}

/** GET /api/v1/circulation/my/holds */
export async function myHoldsController(c: Context) {
  const user = c.get('user') as AccessTokenPayload;
  const records = await getUserHolds(user.sub);
  return c.json({ success: true, data: records, message: 'Holds retrieved' });
}

/** GET /api/v1/circulation/shelving-queue */
export async function shelvingQueueController(c: Context) {
  const user = c.get('user') as AccessTokenPayload;
  const items = await getShelvingQueue(user.schoolId!);
  return c.json({ success: true, data: items, message: 'Shelving queue retrieved' });
}

/** DELETE /api/v1/circulation/holds/:id/expire — manually expire a hold (librarian+). */
export async function expireHoldController(c: Context) {
  const holdId = c.req.param('id')!;
  const user = c.get('user') as AccessTokenPayload;
  try {
    await manualExpireHold(holdId, user.schoolId!);
    return c.json({ success: true, data: { holdId, status: 'expired' }, message: 'Hold expired' });
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'HOLD_NOT_FOUND' ? 404 : 422;
      return c.json({ success: false, error: err.message, code: err.code }, status);
    }
    throw err;
  }
}
