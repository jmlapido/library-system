import axios from 'axios';

/** Strip HTML tags, entities, URLs, and excess whitespace from a description string. */
function cleanDescription(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')                          // remove HTML tags
    .replace(/https?:\/\/\S+/g, '')                    // remove URLs
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') // common entities
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&[a-z]+;/gi, '') // remaining entities
    .replace(/\r\n|\r/g, '\n')                         // normalise line endings
    .replace(/\n{3,}/g, '\n\n')                        // collapse excess blank lines
    .trim();
}

export interface IsbnMetadata {
  isbn: string;
  title: string;
  author: string;
  publisher?: string;
  publicationYear?: number;
  description?: string;
  coverUrl?: string;
  genre?: string;
  subjectTags?: string[];
  language?: string;
  pageCount?: number;
}

interface GoogleBooksVolume {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    language?: string;
    imageLinks?: { thumbnail?: string };
  };
}

interface GoogleBooksResponse {
  totalItems: number;
  items?: GoogleBooksVolume[];
}

/** Fetch book metadata from Google Books API by ISBN-13 or ISBN-10. */
async function lookupGoogleBooks(isbn: string): Promise<IsbnMetadata | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const params: Record<string, string> = { q: `isbn:${isbn}` };
  if (apiKey) params.key = apiKey;

  const resp = await axios.get<GoogleBooksResponse>(
    'https://www.googleapis.com/books/v1/volumes',
    { params, timeout: 8000 }
  );

  if (!resp.data.totalItems || !resp.data.items?.length) return null;

  const info = resp.data.items[0]?.volumeInfo;
  if (!info?.title) return null;

  const yearRaw = info.publishedDate ? parseInt(info.publishedDate.slice(0, 4), 10) : undefined;
  const year = yearRaw !== undefined && !Number.isNaN(yearRaw) ? yearRaw : undefined;
  const rawCover = info.imageLinks?.thumbnail;
  const coverUrl = rawCover?.replace('http://', 'https://');

  return {
    isbn,
    title: info.title,
    author: info.authors?.join(', ') ?? 'Unknown',
    ...(info.publisher !== undefined && { publisher: info.publisher }),
    ...(year !== undefined && { publicationYear: year }),
    ...(info.description !== undefined && { description: cleanDescription(info.description) }),
    ...(coverUrl !== undefined && { coverUrl }),
    ...(info.categories?.[0] !== undefined && { genre: info.categories[0] }),
    ...(info.categories !== undefined && { subjectTags: info.categories }),
    ...(info.language !== undefined && { language: info.language }),
    ...(info.pageCount !== undefined && { pageCount: info.pageCount }),
  };
}

interface OpenLibraryEntry {
  title?: string;
  authors?: Array<{ name?: string }>;
  publishers?: Array<{ name?: string }>;
  publish_date?: string;
  notes?: string | { value?: string };
  number_of_pages?: number;
  subjects?: Array<{ name?: string }>;
  cover?: { large?: string; medium?: string };
  identifiers?: { openlibrary?: string[] };
}

interface OpenLibraryEdition {
  works?: Array<{ key: string }>;
}

interface OpenLibraryWork {
  description?: string | { value?: string };
}

/** Fetch description from the work record when the edition has no notes. */
async function fetchWorkDescription(baseUrl: string, editionKey: string): Promise<string | undefined> {
  try {
    const editionResp = await axios.get<OpenLibraryEdition>(`${baseUrl}/books/${editionKey}.json`, { timeout: 5000 });
    const workKey = editionResp.data.works?.[0]?.key;
    if (!workKey) return undefined;
    const workResp = await axios.get<OpenLibraryWork>(`${baseUrl}${workKey}.json`, { timeout: 5000 });
    const desc = workResp.data.description;
    return typeof desc === 'string' ? desc : desc?.value;
  } catch {
    return undefined;
  }
}

/** Fallback: Open Library Books API. */
async function lookupOpenLibrary(isbn: string): Promise<IsbnMetadata | null> {
  const baseUrl = process.env.OPEN_LIBRARY_BASE_URL ?? 'https://openlibrary.org';
  const resp = await axios.get<Record<string, OpenLibraryEntry>>(
    `${baseUrl}/api/books`,
    {
      params: { bibkeys: `ISBN:${isbn}`, format: 'json', jscmd: 'data' },
      timeout: 8000,
    }
  );

  const entry = resp.data[`ISBN:${isbn}`];
  if (!entry?.title) return null;

  const yearRaw = entry.publish_date ? parseInt(entry.publish_date.slice(-4), 10) : undefined;
  const year = yearRaw !== undefined && !Number.isNaN(yearRaw) ? yearRaw : undefined;
  const notes = typeof entry.notes === 'string' ? entry.notes : entry.notes?.value;
  const tags = entry.subjects?.map((s) => s.name).filter((n): n is string => n !== undefined);
  const publisher = entry.publishers?.[0]?.name;
  const coverUrl = entry.cover?.large ?? entry.cover?.medium;

  const editionKey = entry.identifiers?.openlibrary?.[0];
  const rawDescription = notes ?? (editionKey ? await fetchWorkDescription(baseUrl, editionKey) : undefined);
  const description = rawDescription ? cleanDescription(rawDescription) : undefined;

  return {
    isbn,
    title: entry.title,
    author: entry.authors?.map((a) => a.name).filter((n): n is string => n !== undefined).join(', ') || 'Unknown',
    ...(publisher !== undefined && { publisher }),
    ...(year !== undefined && { publicationYear: year }),
    ...(description !== undefined && { description }),
    ...(coverUrl !== undefined && { coverUrl }),
    ...(tags !== undefined && tags.length > 0 && { subjectTags: tags, genre: tags[0] }),
    ...(entry.number_of_pages !== undefined && { pageCount: entry.number_of_pages }),
  };
}

/**
 * Look up book metadata by ISBN. Tries Google Books first, falls back to Open Library.
 * Returns null if no metadata found.
 */
export async function lookupIsbn(isbn: string): Promise<IsbnMetadata | null> {
  try {
    const result = await lookupGoogleBooks(isbn);
    if (result) return result;
  } catch {
    // Google Books failed — try Open Library
  }

  try {
    return await lookupOpenLibrary(isbn);
  } catch {
    return null;
  }
}
