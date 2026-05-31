import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { notificationLog, notificationChannelEnum, notificationTypeEnum, notificationStatusEnum } from '../db/schema/notificationLog.js';

describe('notificationLog schema', () => {
  it('exports the notificationLog table', () => {
    expect(notificationLog).toBeDefined();
  });

  it('has the required columns with correct names', () => {
    const config = getTableConfig(notificationLog);
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('user_id');
    expect(colNames).toContain('notification_type');
    expect(colNames).toContain('channel');
    expect(colNames).toContain('status');
    expect(colNames).toContain('sent_at');
    expect(colNames).toContain('message_preview');
  });

  it('exports notification enums', () => {
    expect(notificationChannelEnum).toBeDefined();
    expect(notificationTypeEnum).toBeDefined();
    expect(notificationStatusEnum).toBeDefined();
  });
});
