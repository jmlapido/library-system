import Anthropic from '@anthropic-ai/sdk';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema/users.js';
import { books, bookInventory } from '../db/schema/books.js';
import { checkouts } from '../db/schema/circulation.js';
import { holds } from '../db/schema/circulation.js';
import { readingLists, readingListItems } from '../db/schema/readingLists.js';
import { redis } from '../lib/redis.js';
import { findSimilarBooks, buildBookText } from './embedding.service.js';
import type { Book } from '../db/schema/books.js';

/** A book with AI-generated reasoning for why it suits the student. */
export interface RecommendedBook {
  book: Book;
  reasoning: string;
}

/** Candidate book shape sent to Claude in the prompt. */
interface CandidateBook {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  description: string | null;
  readingLevel: string | null;
}

/** Raw Claude response item before validation. */
interface ClaudeRecommendation {
  bookId: string;
  reasoning: string;
}

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const CANDIDATE_LIMIT = 50;
const CHECKOUT_HISTORY_LIMIT = 10;

/**
 * Build the Redis cache key for a user's recommendations.
 */
function cacheKey(userId: string): string {
  return `recs:${userId}`;
}

/**
 * Fetch the last N checked-out books for a user (school-scoped).
 */
async function fetchRecentCheckouts(userId: string, schoolId: string): Promise<Book[]> {
  const rows = await db
    .select({ book: books })
    .from(checkouts)
    .innerJoin(bookInventory, eq(checkouts.bookInventoryId, bookInventory.id))
    .innerJoin(books, eq(bookInventory.bookId, books.id))
    .where(and(eq(checkouts.userId, userId), eq(books.schoolId, schoolId)))
    .orderBy(desc(checkouts.checkoutDate))
    .limit(CHECKOUT_HISTORY_LIMIT);

  return rows.map((r) => r.book);
}

/**
 * Fetch books on current pending holds for a user.
 */
async function fetchCurrentHolds(userId: string): Promise<Book[]> {
  const rows = await db
    .select({ book: books })
    .from(holds)
    .innerJoin(books, eq(holds.bookId, books.id))
    .where(and(eq(holds.userId, userId), eq(holds.status, 'pending')));

  return rows.map((r) => r.book);
}

/**
 * Fetch books with 'to_read' status from the user's reading lists.
 */
async function fetchReadingListBooks(userId: string): Promise<Book[]> {
  const rows = await db
    .select({ book: books })
    .from(readingLists)
    .innerJoin(readingListItems, eq(readingListItems.listId, readingLists.id))
    .innerJoin(books, eq(readingListItems.bookId, books.id))
    .where(and(eq(readingLists.userId, userId), eq(readingListItems.status, 'to_read')));

  return rows.map((r) => r.book);
}

/**
 * Fetch up to CANDIDATE_LIMIT available books scoped to the school.
 */
async function fetchCandidateBooks(schoolId: string, excludeIds: string[]): Promise<Book[]> {
  const availableCopies = await db
    .selectDistinct({ bookId: bookInventory.bookId })
    .from(bookInventory)
    .where(and(eq(bookInventory.schoolId, schoolId), eq(bookInventory.status, 'available')));

  const availableBookIds = availableCopies.map((r) => r.bookId);
  if (availableBookIds.length === 0) return [];

  const filtered = availableBookIds.filter((id) => !excludeIds.includes(id));
  if (filtered.length === 0) return [];

  return db
    .select()
    .from(books)
    .where(and(inArray(books.id, filtered.slice(0, CANDIDATE_LIMIT)), eq(books.isDeleted, false)))
    .limit(CANDIDATE_LIMIT);
}

/**
 * Build the prompt string sent to Claude.
 */
function buildPrompt(
  grade: number | null,
  recentCheckouts: Book[],
  currentHolds: Book[],
  readingListBooks: Book[],
  candidates: CandidateBook[],
): string {
  const recentTitles = recentCheckouts
    .map((b) => `"${b.title}" by ${b.author}`)
    .join(', ') || 'none';

  const wishlistTitles = readingListBooks
    .map((b) => `"${b.title}"`)
    .join(', ') || 'none';

  const holdTitles = currentHolds
    .map((b) => `"${b.title}"`)
    .join(', ') || 'none';

  const gradeStr = grade != null ? String(grade) : 'unknown';

  return `You are a school librarian helping recommend books to a student.

Student profile:
- Grade: ${gradeStr}
- Recent books read: ${recentTitles}
- Books on their wish list: ${wishlistTitles}
- Currently on hold: ${holdTitles}

Available books in the library (choose from these IDs only):
${JSON.stringify(candidates)}

Return a JSON array of up to 5 recommendations:
[{"bookId": "uuid", "reasoning": "one sentence why this fits this student"}]

Return ONLY the JSON array, no other text.`;
}

/**
 * Parse Claude's raw text response into typed recommendations.
 * Returns [] if parsing fails or output is not a valid array.
 */
function parseClaudeResponse(text: string): ClaudeRecommendation[] {
  try {
    const parsed: unknown = JSON.parse(text.trim());
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is ClaudeRecommendation =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).bookId === 'string' &&
        typeof (item as Record<string, unknown>).reasoning === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Call the Claude API and return raw recommendation pairs.
 * Returns [] if the API key is not configured or on any error.
 */
async function callClaude(prompt: string): Promise<ClaudeRecommendation[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = message.content[0];
    if (!block || block.type !== 'text') return [];

    return parseClaudeResponse(block.text);
  } catch {
    return [];
  }
}

/**
 * Merge vector-similar books (prioritized) with random candidate pool, deduplicating by ID.
 */
function mergeCandidates(
  randomPool: Book[],
  vectorResults: { bookId: string; similarity: number }[],
  excludeIds: string[],
): Book[] {
  const poolMap = new Map(randomPool.map((b) => [b.id, b]));
  const seen = new Set<string>(excludeIds);
  const merged: Book[] = [];

  for (const { bookId } of vectorResults) {
    if (seen.has(bookId)) continue;
    const book = poolMap.get(bookId);
    if (book) {
      merged.push(book);
      seen.add(bookId);
    }
  }

  for (const book of randomPool) {
    if (!seen.has(book.id)) {
      merged.push(book);
      seen.add(book.id);
    }
  }

  return merged;
}

/**
 * Get personalized book recommendations for a student.
 * Returns cached results if available (24h TTL).
 * Returns empty array if ANTHROPIC_API_KEY is not configured.
 * @param userId - The student's UUID.
 * @param schoolId - The school UUID for cross-school isolation.
 */
export async function getRecommendations(
  userId: string,
  schoolId: string,
): Promise<RecommendedBook[]> {
  const cached = await redis.get(cacheKey(userId));
  if (cached) {
    try {
      return JSON.parse(cached) as RecommendedBook[];
    } catch {
      // fall through on corrupt cache
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) return [];

  const [userRow] = await db
    .select({ gradeLevel: users.gradeLevel })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const grade = userRow?.gradeLevel ?? null;

  const [recentCheckouts, currentHolds, readingListBooks] = await Promise.all([
    fetchRecentCheckouts(userId, schoolId),
    fetchCurrentHolds(userId),
    fetchReadingListBooks(userId),
  ]);

  const knownIds = [
    ...recentCheckouts.map((b) => b.id),
    ...currentHolds.map((b) => b.id),
    ...readingListBooks.map((b) => b.id),
  ];

  const mostRecent = recentCheckouts[0];
  const queryText = mostRecent
    ? buildBookText({ title: mostRecent.title, author: mostRecent.author, description: mostRecent.description ?? null, genre: mostRecent.genre ?? null })
    : '';

  const [candidateBooks, vectorResults] = await Promise.all([
    fetchCandidateBooks(schoolId, knownIds),
    queryText ? findSimilarBooks(queryText, schoolId, 30, undefined) : Promise.resolve([]),
  ]);

  if (candidateBooks.length === 0 && vectorResults.length === 0) return [];

  const mergedCandidates = mergeCandidates(candidateBooks, vectorResults, knownIds);

  const candidates: CandidateBook[] = mergedCandidates.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    genre: b.genre ?? null,
    description: b.description ?? null,
    readingLevel: b.readingLevel ?? null,
  }));

  const prompt = buildPrompt(grade, recentCheckouts, currentHolds, readingListBooks, candidates);
  const rawRecs = await callClaude(prompt);

  if (rawRecs.length === 0) return [];

  const validIds = new Set(mergedCandidates.map((b) => b.id));
  const validRecs = rawRecs.filter((r) => validIds.has(r.bookId));

  const bookMap = new Map(mergedCandidates.map((b) => [b.id, b]));
  const result: RecommendedBook[] = validRecs
    .map((r) => {
      const book = bookMap.get(r.bookId);
      if (!book) return null;
      return { book, reasoning: r.reasoning };
    })
    .filter((r): r is RecommendedBook => r !== null);

  if (result.length > 0) {
    await redis.set(cacheKey(userId), JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
  }

  return result;
}
