/** Inactivity warning overlay shown before auto-logout. */
export function InactivityOverlay({
  countdown,
  onStillHere,
}: {
  countdown: number;
  onStillHere: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Session timeout warning"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        gap: 24,
      }}
      onClick={onStillHere}
    >
      <p style={{ fontSize: 32, fontWeight: 700, color: '#fff', margin: 0 }}>Still there?</p>
      <div
        aria-live="polite"
        style={{
          fontSize: 128,
          fontWeight: 900,
          color: '#f59e0b',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {countdown}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStillHere();
        }}
        style={{
          background: '#f59e0b',
          color: '#0f172a',
          border: 'none',
          borderRadius: 12,
          padding: '18px 48px',
          fontSize: 20,
          fontWeight: 700,
          cursor: 'pointer',
          minHeight: 60,
        }}
      >
        Yes, I&apos;m here
      </button>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: 0 }}>
        Returning to main screen in {countdown} second{countdown !== 1 ? 's' : ''}…
      </p>
    </div>
  );
}
