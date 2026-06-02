import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KioskSearchBar } from './KioskSearchBar';

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

/** A book card sized for the kiosk grid (larger targets, bigger text). */
function KioskBookCard({ book }: { book: BookSummary }) {
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
        minHeight: 60,
        display: 'flex',
        flexDirection: 'column',
      }}
      aria-label={`${book.title} by ${book.author} — ${available ? 'Available' : 'Checked out'}`}
    >
      <div
        style={{
          background: bg,
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 48,
          position: 'relative',
        }}
      >
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
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
      <div style={{ padding: '8px 10px' }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            marginBottom: 3,
          }}
        >
          {book.title}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{book.author}</div>
      </div>
    </button>
  );
}

/**
 * Kiosk guest home — AI search bar hero + trending book grid + login banner.
 * Search bar uses typewriter placeholder + animated suggestion chips (Task 72).
 */
export function KioskGuestHome() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchTrending();
  }, []);

  async function fetchTrending() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/catalog/books?limit=12`);
      if (!res.ok) return;
      const json = (await res.json()) as {
        success: boolean;
        data?: { hits?: BookSummary[] };
      };
      if (json.success && json.data?.hits) setBooks(json.data.hits);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (q: string) => {
    navigate(`/kiosk/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '40px 32px 120px',
        gap: 32,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={() => navigate('/kiosk')}
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
          aria-label="Back to attract screen"
        >
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>📚 School Library</h1>
      </div>

      {/* AI search hero */}
      <KioskSearchBar onSearch={handleSearch} autoFocus />

      {/* Trending grid */}
      <section aria-label="Trending books">
        <h2
          style={{
            margin: '0 0 16px',
            fontSize: 20,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          Trending Now
        </h2>
        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 12,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                aria-hidden="true"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 14,
                  height: 200,
                  animation: 'kiosk-shimmer 1.5s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        ) : books.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <p style={{ fontSize: 20 }}>No books in catalog yet.</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 12,
            }}
          >
            {books.map((book) => (
              <KioskBookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </section>

      {/* Login banner */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(15,23,42,0.95)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>
          Log in to check out books from the library
        </p>
        <button
          onClick={() => navigate('/kiosk/login')}
          style={{
            background: '#1b3a6b',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 12,
            padding: '14px 32px',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: 60,
            whiteSpace: 'nowrap',
          }}
        >
          Log In
        </button>
      </div>

      <style>{`
        @keyframes kiosk-shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
