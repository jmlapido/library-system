import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface BookSummary {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  coverUrl: string | null;
  availableCopies: number;
}

const GENRE_COLORS: Record<string, string> = {
  Fiction: 'linear-gradient(160deg,#22c55e,#16a34a)',
  Science: 'linear-gradient(160deg,#3b82f6,#2563eb)',
  History: 'linear-gradient(160deg,#f59e0b,#d97706)',
  Literature: 'linear-gradient(160deg,#a855f7,#9333ea)',
  Math: 'linear-gradient(160deg,#06b6d4,#0891b2)',
  Filipino: 'linear-gradient(160deg,#ef4444,#dc2626)',
};
const GENRE_EMOJI: Record<string, string> = {
  Fiction: '📗',
  Science: '🔬',
  History: '🏛',
  Literature: '📜',
  Math: '📐',
  Filipino: '🇵🇭',
};

function KioskResultCard({ book }: { book: BookSummary }) {
  const navigate = useNavigate();
  const bg = GENRE_COLORS[book.genre ?? ''] ?? 'linear-gradient(160deg,#6366f1,#4f46e5)';
  const emoji = GENRE_EMOJI[book.genre ?? ''] ?? '📚';
  const available = book.availableCopies > 0;

  return (
    <button
      onClick={() => navigate(`/kiosk/book/${book.id}`)}
      style={{
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        padding: 0,
        textAlign: 'left',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          background: bg,
          height: 130,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 52,
          position: 'relative',
        }}
      >
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          emoji
        )}
        <span
          style={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            background: available ? '#10b981' : '#ef4444',
            color: '#fff',
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {available ? 'IN' : 'OUT'}
        </span>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            marginBottom: 4,
          }}
        >
          {book.title}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{book.author}</div>
      </div>
    </button>
  );
}

/** Kiosk search results page — grid of books matching the query. */
export function KioskSearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchBooks();
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function fetchBooks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('limit', '24');
      const res = await fetch(`${API_BASE}/api/v1/catalog/books?${params}`);
      if (!res.ok) return;
      const json = (await res.json()) as { success: boolean; data?: { hits?: BookSummary[] } };
      if (json.success && json.data?.hits) setBooks(json.data.hits);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ q: query });
  };

  return (
    <div style={{ minHeight: '100vh', padding: '32px 32px 100px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={() => navigate('/kiosk/home')}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            fontSize: 20,
            cursor: 'pointer',
            padding: '10px 16px',
            minHeight: 60,
            minWidth: 60,
          }}
          aria-label="Back to home"
        >
          ←
        </button>
        <form onSubmit={handleSearch} style={{ flex: 1, display: 'flex', gap: 10 }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search books…"
            style={{
              flex: 1,
              height: 60,
              background: 'rgba(255,255,255,0.12)',
              border: '2px solid rgba(255,255,255,0.2)',
              borderRadius: 14,
              padding: '0 20px',
              fontSize: 18,
              color: '#fff',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              background: '#f59e0b',
              color: '#0f172a',
              border: 'none',
              borderRadius: 14,
              padding: '0 24px',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              height: 60,
            }}
          >
            🔍
          </button>
        </form>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, height: 220, animation: 'kiosk-shimmer 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📭</div>
          <p style={{ fontSize: 22 }}>No books found.</p>
          <p style={{ fontSize: 16 }}>Try different keywords or browse by genre.</p>
        </div>
      ) : (
        <>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
            {books.length} result{books.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
            {books.map((book) => (
              <KioskResultCard key={book.id} book={book} />
            ))}
          </div>
        </>
      )}

      <style>{`@keyframes kiosk-shimmer { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
