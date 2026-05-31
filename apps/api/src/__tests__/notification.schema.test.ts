import { describe, it, expect } from 'vitest';
import { notificationLog } from '../db/schema/notificationLog.js';

describe('notificationLog schema', () => {
  it('exports the notificationLog table', () => {
    expect(notificationLog).toBeDefined();
  });

  it('has the required columns', () => {
    const cols = Object.keys(notificationLog);
    expect(cols).toContain('id');
    expect(cols).toContain('userId');
    expect(cols).toContain('notificationType');
    expect(cols).toContain('channel');
    expect(cols).toContain('status');
    expect(cols).toContain('sentAt');
  });
});
