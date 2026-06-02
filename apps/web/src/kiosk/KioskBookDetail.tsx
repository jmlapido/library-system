import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface BookDetail {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  isbn: string | null;
  description: string | null;
  readingLevel: string | null;
  coverUrl: string | null;
  availableCopies: number;
  totalCopies: number;
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
  Fiction: '📗', Science: '🔬', History: '🏛', Literature: '📜', Math: '📐', Filipino: '🇵🇭',
};

/** Kiosk book detail page — large cover, status chip, and action buttons. */
export function KioskBookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchBook() {
      if (!id) return;
      try {
        const res = await fetch(`${API_BASE}/api/v1/catalog/books/${id}`);
        if (!res.ok) { setError(true); return; }
        const json = (await res.json()) as { success: boolean; data?: BookDetail };
        if (json.success && json.data) setBook(json.data);
        else setError(true);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    void fetchBook();
  }, [id]);

  const bg = GENRE_COLORS[book?.genre ?? ''] ?? 'linear-gradient(160deg,#6366f1,#4f46e5)';
  const emoji = GENRE_EMOJI[book?.genre ?? ''] ?? '📚';
  const available = (book?.availableCopies ?? 0) > 0;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 48, animation: 'kiosk-shimmer 1.5s ease-in-out infinite' }}>📚</div>
        <style>{`@keyframes kiosk-shimmer { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <div style={{ fontSize: 64 }}>😕</div>
        <p style={{ fontSize: 22, color: 'rgba(255,255,255,0.6)' }}>Book not found.</p>
        <button onClick={() => navigate(-1)} style={{ background: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: 14, padding: '16px 40px', fontSize: 18, fontWeight: 700, cursor: 'pointer', minHeight: 60 }}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '32px', display: 'flex', gap: 40, flexWrap: 'wrap', overflowY: 'auto' }}>
      <button
        onClick={() => navigate(-1)}
        style={{ position: 'absolute', top: 24, left: 24, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 20, cursor: 'pointer', padding: '10px 16px', minHeight: 60, minWidth: 60, zIndex: 10 }}
        aria-label="Go back"
      >
        ←
      </button>

      {/* Cover */}
      <div
        style={{
          background: bg,
          borderRadius: 20,
          width: 240,
          minHeight: 360,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 96,
          flexShrink: 0,
          marginTop: 16,
        }}
      >
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 20 }} />
        ) : (
          emoji
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 20, marginTop: 56 }}>
        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: 36, fontWeight: 900, lineHeight: 1.2 }}>{book.title}</h1>
          <p style={{ margin: '0 0 8px', fontSize: 20, color: 'rgba(255,255,255,0.6)' }}>{book.author}</p>
          {book.genre && (
            <span style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '4px 12px', fontSize: 14 }}>{book.genre}</span>
          )}
        </div>

        {/* Availability */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              background: available ? '#10b981' : '#ef4444',
              color: '#fff',
              borderRadius: 12,
              padding: '8px 24px',
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {available ? `${book.availableCopies} Available` : 'Checked Out'}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            {book.totalCopies} cop{book.totalCopies !== 1 ? 'ies' : 'y'} total
          </span>
        </div>

        {book.description && (
          <p style={{ margin: 0, fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, maxWidth: 560 }}>
            {book.description}
          </p>
        )}

        {book.readingLevel && (
          <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
            Reading level: {book.readingLevel}
          </p>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
          <button
            onClick={() => navigate('/kiosk/login')}
            style={{
              background: available ? '#f59e0b' : 'rgba(255,255,255,0.1)',
              color: available ? '#0f172a' : '#fff',
              border: available ? 'none' : '1px solid rgba(255,255,255,0.2)',
              borderRadius: 14,
              padding: '18px 40px',
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
              minHeight: 64,
            }}
          >
            {available ? 'Log in to Check Out' : 'Log in to Place Hold'}
          </button>
        </div>
      </div>
    </div>
  );
}
