import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
  },
}));

import sgMail from '@sendgrid/mail';
import {
  sendVerificationEmail,
  sendStaffInviteEmail,
  sendRejectionEmail,
} from '../services/email.service.js';

describe('email.service', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('sendVerificationEmail', () => {
    it('sends to correct recipient with verify subject', async () => {
      await sendVerificationEmail('staff@school.com', 'http://localhost:3000/auth/verify-email?token=abc');
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'staff@school.com',
          subject: expect.stringContaining('Verify'),
        })
      );
    });

    it('includes the verify URL in email body', async () => {
      const url = 'http://localhost:3000/auth/verify-email?token=abc123';
      await sendVerificationEmail('staff@school.com', url);
      const call = (sgMail.send as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(call.text).toContain(url);
    });
  });

  describe('sendStaffInviteEmail', () => {
    it('sends invite with staff name and invite URL', async () => {
      await sendStaffInviteEmail('new@school.com', 'http://localhost:3000/auth/set-password?token=xyz', 'Maria Cruz');
      const call = (sgMail.send as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(call.to).toBe('new@school.com');
      expect(call.text).toContain('Maria Cruz');
      expect(call.text).toContain('set-password?token=xyz');
    });
  });

  describe('sendRejectionEmail', () => {
    it('sends rejection to correct recipient', async () => {
      await sendRejectionEmail('rejected@school.com', 'Juan Dela Cruz');
      const call = (sgMail.send as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(call.to).toBe('rejected@school.com');
      expect(call.text).toContain('Juan Dela Cruz');
    });
  });

  describe('error handling', () => {
    it('throws AppError when sgMail.send rejects', async () => {
      (sgMail.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('SendGrid unavailable'));
      await expect(
        sendVerificationEmail('staff@school.com', 'http://localhost:3000/verify?token=abc')
      ).rejects.toMatchObject({ code: 'EMAIL_SEND_FAILED' });
    });
  });
});
