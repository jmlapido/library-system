import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { BookCard, BookSummary } from '../components/BookCard';
import { GenreChips } from '../components/GenreChips';
import { SkeletonCard } from '../components/SkeletonCard';
import { saveCatalogSnapshot, getCatalogSnapshot } from '../lib/catalog-cache';

interface SearchResponse {
  hits: BookSummary[];
  totalHits: number;
}

/** Catalog search page with genre filter chips and 2-column book grid. */
export function SearchPage() {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<string | null>(null);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchBooks();
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, genre]);

  /** Fetches books from API; falls back to cached snapshot on error. */
  async function fetchBooks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (genre) params.set('genre', genre);
      const data = await api.get<SearchResponse>(`/catalog/books?${params}`);
      setBooks(data.hits);
      void saveCatalogSnapshot(data.hits);
    } catch {
      const cached = await getCatalogSnapshot();
      const filtered = cached.filter((b) => {
        const matchesQuery =
          !query ||
          b.title.toLowerCase().includes(query.toLowerCase()) ||
          b.author.toLowerCase().includes(query.toLowerCase());
        const matchesGenre = !genre || b.genre === genre;
        return matchesQuery && matchesGenre;
      });
      setBooks(filtered);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <input
        type="search"
        placeholder="Search books, authors, ISBN..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          borderRadius: 10,
          padding: '10px 14px',
          fontSize: 14,
          color: 'white',
          outline: 'none',
          marginBottom: 10,
          boxSizing: 'border-box',
        }}
      />
      <div style={{ marginBottom: 12 }}>
        <GenreChips selected={genre} onSelect={setGenre} />
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <p>No books found. Try different keywords.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
