import type { BookSummary } from '../components/BookCard';

/**
 * Persists a catalog snapshot to IndexedDB for offline use.
 * Full implementation in Task 12.
 */
export async function saveCatalogSnapshot(_books: BookSummary[]): Promise<void> {
  // implemented in Task 12
}

/**
 * Retrieves the last saved catalog snapshot from IndexedDB.
 * Full implementation in Task 12.
 */
export async function getCatalogSnapshot(): Promise<BookSummary[]> {
  return [];
}
