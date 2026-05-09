const DEFAULT_GENRES = ['Fiction', 'Science', 'History', 'Literature', 'Math', 'Filipino'];

interface GenreChipsProps {
  genres?: string[];
  selected: string | null;
  onSelect: (genre: string | null) => void;
}

/**
 * Horizontal scrollable row of genre filter chips.
 * "All" chip is always prepended; selected chip is highlighted white.
 */
export function GenreChips({ genres = DEFAULT_GENRES, selected, onSelect }: GenreChipsProps) {
  const all = [null, ...genres];

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 4,
        scrollbarWidth: 'none',
      }}
    >
      {all.map((genre) => {
        const isActive = genre === selected;
        return (
          <button
            key={genre ?? 'all'}
            onClick={() => onSelect(genre)}
            style={{
              background: isActive ? 'white' : 'rgba(255,255,255,0.15)',
              color: isActive ? '#4f46e5' : 'rgba(255,255,255,0.85)',
              fontWeight: isActive ? 700 : 400,
              border: 'none',
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {genre ?? 'All'}
          </button>
        );
      })}
    </div>
  );
}
