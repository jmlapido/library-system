import OpenAI from 'openai';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

let _openai: OpenAI | null = null;

/** Lazily instantiate OpenAI client so module import does not throw without API key. */
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' });
  }
  return _openai;
}

/** Generate a 1536-dim embedding for the given text via OpenAI. Returns null if API key not set. */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const res = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  });
  return res.data[0]?.embedding ?? null;
}

/** Build a text snippet from book fields for embedding. */
export function buildBookText(book: {
  title: string;
  author: string | null;
  description: string | null;
  genre: string | null;
}): string {
  return [book.title, book.author, book.genre, book.description]
    .filter(Boolean)
    .join('. ');
}

/** Store an embedding vector for a book (raw SQL — Drizzle has no vector type). */
export async function storeBookEmbedding(bookId: string, embedding: number[]): Promise<void> {
  const vec = `[${embedding.join(',')}]`;
  await db.execute(sql`UPDATE books SET embedding = ${vec}::vector WHERE id = ${bookId}`);
}

/**
 * Find the N most similar books to a query text using cosine similarity.
 * Falls back to empty array if pgvector not available or API key missing.
 */
export async function findSimilarBooks(
  queryText: string,
  schoolId: string,
  limit = 10,
  excludeBookId?: string,
): Promise<{ bookId: string; similarity: number }[]> {
  const embedding = await generateEmbedding(queryText);
  if (!embedding) return [];

  const vec = `[${embedding.join(',')}]`;
  const rows = await db.execute<{ id: string; similarity: number }>(sql`
    SELECT b.id, 1 - (b.embedding <=> ${vec}::vector) AS similarity
    FROM books b
    WHERE b.school_id = ${schoolId}
      AND b.embedding IS NOT NULL
      ${excludeBookId ? sql`AND b.id != ${excludeBookId}` : sql``}
    ORDER BY b.embedding <=> ${vec}::vector
    LIMIT ${limit}
  `);

  return rows.rows.map((r) => ({ bookId: r.id, similarity: r.similarity }));
}
