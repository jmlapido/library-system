/** Analytics types returned by the Task 50 backend endpoints. */

export interface AdminStats {
  totalBooks: number;
  totalCopies: number;
  totalUsers: number;
  activeCheckouts: number;
  overdueCheckouts: number;
  holdsWaiting: number;
  booksAvailable: number;
}

export interface OverdueItem {
  checkoutId: string;
  userId: string;
  userFullName: string;
  userGradeLevel: number | null;
  bookTitle: string;
  bookAuthor: string;
  barcode: string;
  checkedOutAt: string;
  dueDate: string;
  daysOverdue: number;
}

export interface PopularBook {
  bookId: string;
  title: string;
  author: string;
  genre: string | null;
  checkoutCount: number;
  currentlyAvailable: boolean;
}

export interface ActivityDay {
  date: string;
  checkouts: number;
  returns: number;
}

export interface InventoryAudit {
  statusBreakdown: Array<{ status: string; count: number }>;
  lostCopies: Array<{
    copyId: string;
    barcode: string;
    bookTitle: string;
    bookAuthor: string;
  }>;
}
