import { MeiliSearch } from 'meilisearch';

const host = process.env.MEILISEARCH_HOST;
const apiKey = process.env.MEILISEARCH_API_KEY;

if (!host) throw new Error('MEILISEARCH_HOST environment variable is not set');

export const meili = new MeiliSearch({
  host,
  ...(apiKey !== undefined && { apiKey }),
});

export const BOOKS_INDEX = 'books';
