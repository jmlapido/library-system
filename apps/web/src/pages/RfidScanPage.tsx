import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useRfidReader } from '../hooks/useRfidReader';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Ready',
  connecting: 'Connecting to reader…',
  scanning: 'Scanning…',
  read: 'Tag read!',
  error: 'Error',
};

const STATUS_ICON: Record<string, string> = {
  idle: '📡',
  connecting: '🔌',
  scanning: '⟳',
  read: '✓',
  error: '✗',
};

/**
 * RFID scan page — uses Web USB API to read HF 13.56 MHz ISO 15693 tags.
 * On a successful read that includes a book ID, navigates to /book/:id.
 */
export function RfidScanPage() {
  const { status, tag, error, isSupported, connect, disconnect, scan } = useRfidReader();
  const navigate = useNavigate();

  // Auto-navigate to book detail when a tagged book is identified
  useEffect(() => {
    if (status !== 'read' || !tag?.bookId) return;
    const timer = setTimeout(() => navigate(`/book/${tag.bookId!}`), 1200);
    return () => clearTimeout(timer);
  }, [status, tag, navigate]);

  const iconColor =
    status === 'read' ? '#4ade80' :
    status === 'error' ? '#f87171' :
    'rgba(255,255,255,0.8)';

  return (
    <div style={{ padding: 20, minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 }}>RFID Reader</div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>HF 13.56 MHz · ISO 15693</div>
      </div>

      {!isSupported && (
        <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 10, padding: '12px 16px', color: '#fca5a5', fontSize: 13, textAlign: 'center' }}>
          Web USB is not supported in this browser. Use Chrome or Edge.
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          style={{
            width: 120, height: 120, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            border: `3px solid ${iconColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: status === 'scanning' ? 32 : 48,
            color: iconColor,
            fontWeight: 700,
          }}
        >
          {STATUS_ICON[status] ?? '📡'}
        </motion.div>
      </AnimatePresence>

      <div style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>
        {STATUS_LABEL[status] ?? 'Ready'}
      </div>

      {error && (
        <div style={{ color: '#fca5a5', fontSize: 13, textAlign: 'center', maxWidth: 280 }}>
          {error}
        </div>
      )}

      {tag && status === 'read' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'rgba(255,255,255,0.1)', borderRadius: 10,
            padding: '12px 16px', width: '100%', maxWidth: 300,
          }}
        >
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 }}>UID</div>
          <div style={{ color: 'white', fontSize: 13, fontFamily: 'monospace', marginBottom: 8 }}>{tag.uid}</div>
          {tag.bookId && (
            <>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 }}>Book ID</div>
              <div style={{ color: '#a5b4fc', fontSize: 13, fontFamily: 'monospace', marginBottom: 8 }}>{tag.bookId}</div>
            </>
          )}
          {tag.copyNumber && (
            <>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 }}>Copy #</div>
              <div style={{ color: 'white', fontSize: 13 }}>{tag.copyNumber}</div>
            </>
          )}
        </motion.div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
        {status === 'idle' || status === 'error' ? (
          <button onClick={() => void connect()} disabled={!isSupported} style={btnStyle('#4f46e5')}>
            Connect Reader
          </button>
        ) : null}

        {(status === 'idle' || status === 'read') && (
          <button onClick={() => void scan()} style={btnStyle('rgba(255,255,255,0.2)')}>
            Scan Tag
          </button>
        )}

        {status !== 'idle' && status !== 'connecting' && (
          <button onClick={disconnect} style={{ ...btnStyle('transparent'), border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)' }}>
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    width: '100%', padding: 14, borderRadius: 10, border: 'none',
    background: bg, color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer',
  };
}
