import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- DB mock (Drizzle chained query builder) ---
// Paths are relative to the RESOLVED module, not the test file.
// Service imports '../../db/index.js' → resolves to src/db/index.js
// From __tests__ directory that's '../db/index.js'
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
  },
}));

// --- Email provider mock ---
// Service imports './email.provider.js' → resolves to src/services/notifications/email.provider.js
// From __tests__ directory that's '../services/notifications/email.provider.js'
vi.mock('../services/notifications/email.provider.js', () => ({
  sendEmailNotification: vi.fn().mockResolvedValue(undefined),
}));

import { sendNotification } from '../services/notifications/notifications.service.js';
import { db } from '../db/index.js';
import { sendEmailNotification } from '../services/notifications/email.provider.js';
import type { NotificationContext } from '../services/notifications/types.js';

const baseCtx: NotificationContext = {
  userId: 'user-uuid-1',
  schoolId: 'school-uuid-1',
  userFullName: 'Bob Reyes',
  userEmail: 'bob@school.edu',
  userPhone: null,
  userChannel: 'email',
  bookTitle: 'Noli Me Tangere',
  dueDate: new Date('2026-06-15'),
  daysOverdue: 0,
  fineAmount: 0,
  appUrl: 'http://localhost:3000',
};

// Convenience typed accessors (resolved after module mock is applied)
function mockLimit() { return vi.mocked(db.limit); }
function mockValues() { return vi.mocked(db.values); }
function mockSendEmail() { return vi.mocked(sendEmailNotification); }

describe('sendNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset limit to default: no existing log (dedup passes)
    mockLimit().mockResolvedValue([]);
    mockValues().mockResolvedValue(undefined);
    mockSendEmail().mockResolvedValue(undefined);
    // Restore chained mocks after clearAllMocks
    vi.mocked(db.select).mockReturnThis();
    vi.mocked(db.from).mockReturnThis();
    vi.mocked(db.where).mockReturnThis();
    vi.mocked(db.insert).mockReturnThis();
  });

  describe('happy path — email channel', () => {
    it('calls sendEmailNotification when channel is email', async () => {
      const result = await sendNotification('due_reminder', baseCtx);
      expect(mockSendEmail()).toHaveBeenCalledWith('due_reminder', baseCtx);
      expect(result).toEqual({ sent: true });
    });

    it('inserts notification_log with status=sent', async () => {
      await sendNotification('due_reminder', baseCtx);
      expect(db.insert).toHaveBeenCalled();
      expect(mockValues()).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid-1',
          schoolId: 'school-uuid-1',
          notificationType: 'due_reminder',
          channel: 'email',
          status: 'sent',
        })
      );
    });

    it('messagePreview is truncated to 200 chars', async () => {
      const longTitleCtx = {
        ...baseCtx,
        bookTitle: 'A'.repeat(300),
      };
      await sendNotification('due_reminder', longTitleCtx);
      const insertArg = mockValues().mock.calls[0][0] as { messagePreview: string };
      expect(insertArg.messagePreview.length).toBeLessThanOrEqual(200);
    });
  });

  describe('deduplication', () => {
    it('skips send when same type already sent today', async () => {
      mockLimit().mockResolvedValueOnce([{ id: 'existing-log-id' }]);
      const result = await sendNotification('due_reminder', baseCtx);
      expect(mockSendEmail()).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
      expect(result).toEqual({ sent: false, reason: 'already_sent_today' });
    });

    it('proceeds if no existing log found', async () => {
      mockLimit().mockResolvedValueOnce([]);
      const result = await sendNotification('overdue_notice', baseCtx);
      expect(mockSendEmail()).toHaveBeenCalled();
      expect(result).toEqual({ sent: true });
    });
  });

  describe('failed send', () => {
    it('inserts log with status=failed when email throws', async () => {
      const sendErr = new Error('SendGrid unavailable');
      mockSendEmail().mockRejectedValueOnce(sendErr);

      await expect(sendNotification('due_reminder', baseCtx)).rejects.toThrow('SendGrid unavailable');

      expect(mockValues()).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' })
      );
    });

    it('still logs before re-throwing the error', async () => {
      mockSendEmail().mockRejectedValueOnce(new Error('Network error'));
      await expect(sendNotification('hold_ready', baseCtx)).rejects.toThrow();
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('channel=sms', () => {
    it('does not call sendEmailNotification for sms-only channel', async () => {
      const smsCtx = { ...baseCtx, userChannel: 'sms' as const };
      // SMS provider not implemented — dynamic import will fail, silently caught
      await sendNotification('due_reminder', smsCtx);
      expect(mockSendEmail()).not.toHaveBeenCalled();
    });

    it('still logs the attempt for sms channel', async () => {
      const smsCtx = { ...baseCtx, userChannel: 'sms' as const };
      await sendNotification('due_reminder', smsCtx);
      expect(mockValues()).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'sms' })
      );
    });
  });

  describe('channel=both', () => {
    it('calls sendEmailNotification for both channel', async () => {
      const bothCtx = { ...baseCtx, userChannel: 'both' as const };
      await sendNotification('overdue_notice', bothCtx);
      expect(mockSendEmail()).toHaveBeenCalled();
    });

    it('logs channel=both in notification_log', async () => {
      const bothCtx = { ...baseCtx, userChannel: 'both' as const };
      await sendNotification('overdue_notice', bothCtx);
      expect(mockValues()).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'both' })
      );
    });
  });

  describe('null userChannel defaults to email', () => {
    it('falls back to email when userChannel is null', async () => {
      const nullChannelCtx = { ...baseCtx, userChannel: null };
      await sendNotification('fine_notice', nullChannelCtx);
      expect(mockSendEmail()).toHaveBeenCalled();
      expect(mockValues()).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'email' })
      );
    });
  });

  describe('checkoutId propagation', () => {
    it('includes checkoutId in log when provided', async () => {
      const ctxWithCheckout = { ...baseCtx, checkoutId: 'checkout-uuid-99' };
      await sendNotification('due_reminder', ctxWithCheckout);
      expect(mockValues()).toHaveBeenCalledWith(
        expect.objectContaining({ checkoutId: 'checkout-uuid-99' })
      );
    });

    it('logs undefined checkoutId when not provided', async () => {
      const ctxNoCheckout = { ...baseCtx, checkoutId: undefined };
      await sendNotification('hold_expired', ctxNoCheckout);
      expect(mockValues()).toHaveBeenCalledWith(
        expect.objectContaining({ checkoutId: undefined })
      );
    });
  });
});
