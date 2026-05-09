/**
 * Animated placeholder card shown while book data is loading.
 * Uses CSS shimmer animation defined in index.css.
 */
export function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      style={{
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 70,
          background: 'rgba(255,255,255,0.08)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            animation: 'shimmer 1.5s infinite',
          }}
        />
      </div>
      <div style={{ padding: '6px 8px' }}>
        <div
          style={{
            height: 10,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 4,
            marginBottom: 5,
          }}
        />
        <div
          style={{
            height: 8,
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 4,
            width: '60%',
          }}
        />
      </div>
    </div>
  );
}
