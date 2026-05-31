import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sendgrid/mail before importing
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
  },
}));

import sgMail from '@sendgrid/mail';
import { sendEmailNotification } from '../services/notifications/email.provider.js';
import type { NotificationContext } from '../services/notifications/types.js';

const baseCtx: NotificationContext = {
  userId: 'user-1',
  schoolId: 'school-1',
  userFullName: 'Alice Smith',
  userEmail: 'alice@test.com',
  userChannel: 'email',
  bookTitle: 'The Giver',
  dueDate: new Date('2026-06-10'),
  daysOverdue: 0,
  fineAmount: 0,
  appUrl: 'http://localhost:3000',
};

describe('sendEmailNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends due_reminder with correct subject', async () => {
    await sendEmailNotification('due_reminder', baseCtx);
    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('due') })
    );
  });

  it('sends overdue_notice with correct subject', async () => {
    await sendEmailNotification('overdue_notice', { ...baseCtx, daysOverdue: 3, fineAmount: 1.5 });
    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('overdue') })
    );
  });

  it('sends fine_notice', async () => {
    await sendEmailNotification('fine_notice', { ...baseCtx, fineAmount: 2.0 });
    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Fine') })
    );
  });

  it('sends hold_ready', async () => {
    await sendEmailNotification('hold_ready', baseCtx);
    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('ready') })
    );
  });

  it('sends hold_expired', async () => {
    await sendEmailNotification('hold_expired', baseCtx);
    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('expired') })
    );
  });

  it('escapes HTML in book title', async () => {
    const xssCtx = { ...baseCtx, bookTitle: '<script>alert(1)</script>' };
    await sendEmailNotification('due_reminder', xssCtx);
    const call = vi.mocked(sgMail.send).mock.calls[0][0] as { html: string };
    expect(call.html).not.toContain('<script>');
    expect(call.html).toContain('&lt;script&gt;');
  });

  it('does not send when userEmail is null', async () => {
    await sendEmailNotification('due_reminder', { ...baseCtx, userEmail: null });
    expect(sgMail.send).not.toHaveBeenCalled();
  });

  it('throws AppError when sgMail.send throws', async () => {
    vi.mocked(sgMail.send).mockRejectedValueOnce(new Error('SendGrid down'));
    await expect(sendEmailNotification('due_reminder', baseCtx)).rejects.toMatchObject({
      code: 'EMAIL_SEND_FAILED',
    });
  });

  it('includes fine amount in overdue_notice text when fineAmount > 0', async () => {
    await sendEmailNotification('overdue_notice', { ...baseCtx, daysOverdue: 5, fineAmount: 2.5 });
    const call = vi.mocked(sgMail.send).mock.calls[0][0] as { text: string };
    expect(call.text).toContain('$2.50');
  });

  it('omits fine text in overdue_notice when fineAmount is 0', async () => {
    await sendEmailNotification('overdue_notice', { ...baseCtx, daysOverdue: 1, fineAmount: 0 });
    const call = vi.mocked(sgMail.send).mock.calls[0][0] as { text: string };
    expect(call.text).not.toContain('Fine so far');
  });

  it('falls back to "soon" when dueDate is undefined in due_reminder', async () => {
    await sendEmailNotification('due_reminder', { ...baseCtx, dueDate: undefined });
    const call = vi.mocked(sgMail.send).mock.calls[0][0] as { text: string };
    expect(call.text).toContain('soon');
  });
});
