import { useNavigate } from 'react-router-dom';
import { StatusBadge } from './StatusBadge';

export interface BookSummary {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  readingLevel: string | null;
  availableCopies: number;
  totalCopies: number;
  coverUrl: string | null;
}

const GENRE_COLORS: Record<string, [string, string]> = {
  Fiction: ['#22c55e', '#16a34a'],
  Science: ['#3b82f6', '#2563eb'],
  History: ['#f59e0b', '#d97706'],
  Literature: ['#a855f7', '#9333ea'],
  Math: ['#06b6d4', '#0891b2'],
  Filipino: ['#ef4444', '#dc2626'],
};

/** Returns a CSS gradient string for a given genre. */
function coverGradient(genre: string | null): string {
  const [from, to] = GENRE_COLORS[genre ?? ''] ?? ['#6366f1', '#4f46e5'];
  return `linear-gradient(160deg, ${from}, ${to})`;
}

/** Returns an emoji icon for a given genre. */
function coverEmoji(genre: string | null): string {
  const map: Record<string, string> = {
    Fiction: '📗',
    Science: '🔬',
    History: '🏛',
    Literature: '📜',
    Math: '📐',
    Filipino: '🇵🇭',
  };
  return map[genre ?? ''] ?? '📚';
}

/**
 * Displays a compact book card with cover art, title, author, and availability.
 * Navigates to the book detail page on click.
 */
export function BookCard({ book }: { book: BookSummary }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/book/${book.id}`)}
      style={{
        background: 'rgba(255,255,255,0.15)',
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          background: coverGradient(book.genre),
          height: 70,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
        }}
      >
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          coverEmoji(book.genre)
        )}
      </div>
      <div style={{ padding: '6px 8px' }}>
        <div
          style={{
            color: 'white',
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            marginBottom: 2,
          }}
        >
          {book.title}
        </div>
        <div
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: 10,
            marginBottom: 5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {book.author}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <StatusBadge available={book.availableCopies} total={book.totalCopies} />
          {book.readingLevel && (
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>
              {book.readingLevel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
