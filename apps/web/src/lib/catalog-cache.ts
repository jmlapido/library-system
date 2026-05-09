import { openDB } from 'idb';
import type { BookSummary } from '../components/BookCard';

const DB_NAME = 'librams-catalog';
const STORE = 'books';
const MAX_ENTRIES = 500;

/** Opens (or upgrades) the IndexedDB database for catalog caching. */
async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    },
  });
}

/**
 * Persists up to MAX_ENTRIES books to IndexedDB for offline browsing.
 * Silently no-ops if IndexedDB is unavailable.
 */
export async function saveCatalogSnapshot(books: BookSummary[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE, 'readwrite');
    const slice = books.slice(0, MAX_ENTRIES);
    await Promise.all(slice.map((b) => tx.store.put(b)));
    await tx.done;
  } catch {
    // silently fail — offline cache is best-effort
  }
}

/**
 * Retrieves the last saved catalog snapshot from IndexedDB.
 * Returns an empty array if the cache is empty or unavailable.
 */
export async function getCatalogSnapshot(): Promise<BookSummary[]> {
  try {
    const db = await getDB();
    return await db.getAll(STORE);
  } catch {
    return [];
  }
}
