import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface BookCover {
  id: string;
  title: string;
  genre: string | null;
  coverUrl: string | null;
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

const FALLBACK_COVERS: BookCover[] = Array.from({ length: 20 }, (_, i) => ({
  id: `placeholder-${i}`,
  title: '',
  genre: Object.keys(GENRE_COLORS)[i % 6] ?? null,
  coverUrl: null,
}));

/** One cell in the attract-screen mosaic. */
function CoverCell({ book }: { book: BookCover }) {
  const bg = GENRE_COLORS[book.genre ?? ''] ?? 'linear-gradient(160deg,#6366f1,#4f46e5)';
  const emoji = GENRE_EMOJI[book.genre ?? ''] ?? '📚';
  return (
    <div
      aria-hidden="true"
      style={{
        background: bg,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 36,
        aspectRatio: '2/3',
        overflow: 'hidden',
      }}
    >
      {book.coverUrl ? (
        <img
          src={book.coverUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        emoji
      )}
    </div>
  );
}

/**
 * Kiosk attract screen — shown on idle or fresh load.
 * Displays a mosaic of book covers with school branding overlay.
 */
export function AttractScreen() {
  const navigate = useNavigate();
  const [covers, setCovers] = useState<BookCover[]>(FALLBACK_COVERS);

  useEffect(() => {
    async function fetchCovers() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/catalog/books?limit=24`);
        if (!res.ok) return;
        const json = (await res.json()) as { success: boolean; data?: { hits?: BookCover[] } };
        if (json.success && json.data?.hits && json.data.hits.length > 0) {
          setCovers(json.data.hits.slice(0, 24));
        }
      } catch {
        /* keep fallback */
      }
    }
    void fetchCovers();
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
      onClick={() => navigate('/kiosk/home')}
      role="button"
      tabIndex={0}
      aria-label="Tap to start using the library kiosk"
      onKeyDown={(e) => e.key === 'Enter' && navigate('/kiosk/home')}
    >
      {/* Book cover mosaic background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gridAutoRows: '1fr',
          gap: 8,
          padding: 8,
          opacity: 0.5,
        }}
      >
        {covers.map((book) => (
          <CoverCell key={book.id} book={book} />
        ))}
      </div>

      {/* Dark overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(15,23,42,0.85), rgba(15,23,42,0.7))',
        }}
      />

      {/* Centered content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          padding: 40,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 64, lineHeight: 1 }}>📚</div>
        <h1
          style={{
            fontSize: 56,
            fontWeight: 900,
            color: '#fff',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          School Library
        </h1>
        <p
          style={{
            fontSize: 24,
            color: 'rgba(255,255,255,0.7)',
            margin: 0,
            fontWeight: 400,
          }}
        >
          Find your next book
          <br />
          <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }}>
            Hanapin ang susunod mong libro
          </span>
        </p>

        {/* Pulsing CTA */}
        <button
          tabIndex={-1}
          style={{
            background: '#f59e0b',
            color: '#0f172a',
            border: 'none',
            borderRadius: 16,
            padding: '20px 60px',
            fontSize: 24,
            fontWeight: 700,
            cursor: 'pointer',
            minHeight: 64,
            animation: 'kiosk-pulse 2s ease-in-out infinite',
            boxShadow: '0 0 0 0 rgba(245,158,11,0.4)',
          }}
          aria-hidden="true"
        >
          Tap to Start · I-tap para Magsimula
        </button>
      </div>

      <style>{`
        @keyframes kiosk-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
          50% { transform: scale(1.03); box-shadow: 0 0 0 16px rgba(245,158,11,0); }
        }
      `}</style>
    </div>
  );
}
