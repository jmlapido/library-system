import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Bilingual placeholder examples cycling through the search bar. */
const PLACEHOLDER_EXAMPLES = [
  'Search books, authors, ISBN…',
  'Try: "adventure stories for grade 5"',
  'Try: "books about the Philippine revolution"',
  'Maghanap ng libro sa Filipino…',
  'Halimbawa: "kwento para sa bata"',
  'Try: "science experiments kids"',
  'Try: "mystery novels available now"',
  'Halimbawa: "kasaysayan ng Pilipinas"',
];

/** Animated suggestion chips shown below the search bar. */
const SUGGESTION_CHIPS: Array<{ label: string; query: string }> = [
  { label: '🚀 Space & Science', query: 'space science' },
  { label: '🐾 Animals', query: 'animals' },
  { label: '🔍 Mystery', query: 'mystery' },
  { label: '⚔️ Adventure', query: 'adventure' },
  { label: '🇵🇭 Filipino', query: 'Filipino' },
  { label: '📖 Available Now', query: '' },
  { label: '🏅 Sports', query: 'sports' },
  { label: '🌿 Nature', query: 'nature' },
];

interface KioskSearchBarProps {
  onSearch?: (query: string) => void;
  autoFocus?: boolean;
}

/**
 * Kiosk hero search bar with:
 * - Typewriter cycling placeholder (English + Filipino)
 * - Animated suggestion chips
 * - AI natural-language search via the catalog API
 */
export function KioskSearchBar({ onSearch, autoFocus = true }: KioskSearchBarProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [typing, setTyping] = useState(true);
  const [charIdx, setCharIdx] = useState(0);
  const [chipsVisible, setChipsVisible] = useState(false);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
    const timer = setTimeout(() => setChipsVisible(true), 400);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  // Typewriter effect — types out each example, then erases, then moves to the next.
  useEffect(() => {
    const target = PLACEHOLDER_EXAMPLES[placeholderIdx] ?? '';
    const delay = typing ? 45 : 25;

    const timer = setTimeout(() => {
      if (typing) {
        if (charIdx < target.length) {
          setPlaceholder(target.slice(0, charIdx + 1));
          setCharIdx((c) => c + 1);
        } else {
          // Pause at end before erasing
          setTimeout(() => setTyping(false), 1800);
        }
      } else {
        if (charIdx > 0) {
          setPlaceholder(target.slice(0, charIdx - 1));
          setCharIdx((c) => c - 1);
        } else {
          setTyping(true);
          setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_EXAMPLES.length);
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [charIdx, typing, placeholderIdx]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      if (onSearch) {
        onSearch(q);
      } else {
        navigate(`/kiosk/search?q=${encodeURIComponent(q)}`);
      }
    },
    [query, navigate, onSearch]
  );

  const handleChip = useCallback(
    (chip: { label: string; query: string }) => {
      const q = chip.query || chip.label.replace(/^[\p{Emoji}\s]+/u, '').trim();
      if (onSearch) {
        onSearch(q);
      } else {
        navigate(`/kiosk/search?q=${encodeURIComponent(q)}`);
      }
    },
    [navigate, onSearch]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={query ? '' : placeholder || 'Search…'}
            style={{
              width: '100%',
              height: 70,
              background: 'rgba(255,255,255,0.12)',
              border: '2px solid rgba(255,255,255,0.25)',
              borderRadius: 18,
              padding: '0 68px 0 24px',
              fontSize: 20,
              color: '#fff',
              outline: 'none',
              boxSizing: 'border-box',
              caretColor: '#f59e0b',
            }}
            aria-label="Search for books"
          />
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 24,
              color: 'rgba(255,255,255,0.35)',
              pointerEvents: 'none',
            }}
          >
            🔍
          </span>
        </div>
        <button
          type="submit"
          disabled={!query.trim()}
          style={{
            background: query.trim() ? '#f59e0b' : 'rgba(245,158,11,0.3)',
            color: '#0f172a',
            border: 'none',
            borderRadius: 18,
            padding: '0 32px',
            fontSize: 18,
            fontWeight: 700,
            cursor: query.trim() ? 'pointer' : 'default',
            height: 70,
            minWidth: 110,
            transition: 'background 0.2s',
          }}
        >
          Search
        </button>
      </form>

      <p
        aria-hidden="true"
        style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'right', paddingRight: 4 }}
      >
        AI-powered · Powered by natural language search
      </p>

      {/* Suggestion chips */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          opacity: chipsVisible ? 1 : 0,
          transform: chipsVisible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}
        aria-label="Browse by topic"
      >
        {SUGGESTION_CHIPS.map((chip, i) => (
          <button
            key={chip.label}
            onClick={() => handleChip(chip)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 40,
              color: '#fff',
              fontSize: 15,
              fontWeight: 500,
              padding: '10px 20px',
              cursor: 'pointer',
              minHeight: 44,
              opacity: chipsVisible ? 1 : 0,
              transform: chipsVisible ? 'translateY(0)' : 'translateY(8px)',
              transition: `opacity 0.35s ease ${i * 50}ms, transform 0.35s ease ${i * 50}ms`,
              whiteSpace: 'nowrap',
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
