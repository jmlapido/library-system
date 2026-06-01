export type NotificationType =
  | 'due_reminder'
  | 'overdue_notice'
  | 'fine_notice'
  | 'hold_ready'
  | 'hold_expired';

export type NotificationChannel = 'sms' | 'email' | 'both';

/**
 * All data needed to compose and send a notification.
 */
export interface NotificationContext {
  userId: string;
  schoolId: string;
  checkoutId?: string;
  holdId?: string;
  userFullName: string;
  userEmail?: string | null;
  userPhone?: string | null;
  userChannel: NotificationChannel | null;
  bookTitle: string;
  dueDate?: Date;
  daysOverdue?: number;
  fineAmount?: number;
  appUrl: string;
  /** FCM registration tokens for the user — used by push provider. */
  fcmTokens?: string[];
}
