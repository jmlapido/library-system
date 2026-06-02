import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type Step = 'scanning' | 'confirming' | 'success' | 'error';

interface BookInfo {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  coverUrl: string | null;
  availableCopies: number;
}

interface CheckoutResult {
  dueDate: string;
  bookTitle: string;
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

/** Auto-logout countdown (s) shown after a successful checkout. */
const SUCCESS_COUNTDOWN = 10;

/** Formats an ISO date string into a friendly "Mon DD, YYYY" label. */
function formatDueDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

interface ScanStepProps {
  onScan: (barcode: string) => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}

function ScanStep({ onScan, onCancel, loading, error }: ScanStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState('');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcode.trim()) onScan(barcode.trim());
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        padding: '40px 32px',
      }}
    >
      <div style={{ fontSize: 80 }}>📷</div>
      <h1 style={{ margin: 0, fontSize: 40, fontWeight: 900, textAlign: 'center' }}>
        Scan or Enter Barcode
      </h1>
      <p style={{ margin: 0, fontSize: 20, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
        Scan the barcode on the book, or type the barcode number below.
      </p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Book barcode…"
          disabled={loading}
          style={{
            height: 80,
            background: 'rgba(255,255,255,0.12)',
            border: `2px solid ${error ? '#ef4444' : 'rgba(255,255,255,0.25)'}`,
            borderRadius: 18,
            padding: '0 28px',
            fontSize: 28,
            color: '#fff',
            outline: 'none',
            textAlign: 'center',
            letterSpacing: '0.05em',
          }}
          aria-label="Book barcode"
          aria-describedby={error ? 'scan-error' : undefined}
        />
        {error && (
          <p id="scan-error" role="alert" style={{ margin: 0, color: '#fca5a5', fontSize: 16, textAlign: 'center' }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!barcode.trim() || loading}
          style={{
            background: barcode.trim() && !loading ? '#f59e0b' : 'rgba(245,158,11,0.3)',
            color: '#0f172a',
            border: 'none',
            borderRadius: 18,
            height: 70,
            fontSize: 22,
            fontWeight: 700,
            cursor: barcode.trim() && !loading ? 'pointer' : 'default',
          }}
        >
          {loading ? 'Looking up book…' : 'Confirm Barcode'}
        </button>
      </form>

      <button
        onClick={onCancel}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.4)',
          fontSize: 18,
          cursor: 'pointer',
          padding: '12px 32px',
          minHeight: 60,
        }}
      >
        Cancel
      </button>
    </div>
  );
}

interface ConfirmStepProps {
  book: BookInfo;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function ConfirmStep({ book, onConfirm, onCancel, loading }: ConfirmStepProps) {
  const bg = GENRE_COLORS[book.genre ?? ''] ?? 'linear-gradient(160deg,#6366f1,#4f46e5)';
  const emoji = GENRE_EMOJI[book.genre ?? ''] ?? '📚';

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        padding: '40px 32px',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>Check out this book?</h1>

      {/* Book preview */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          alignItems: 'center',
          background: 'rgba(255,255,255,0.07)',
          borderRadius: 20,
          padding: 24,
          width: '100%',
          maxWidth: 560,
        }}
      >
        <div
          style={{
            background: bg,
            borderRadius: 12,
            width: 100,
            height: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            emoji
          )}
        </div>
        <div>
          <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>{book.title}</h2>
          <p style={{ margin: 0, fontSize: 16, color: 'rgba(255,255,255,0.6)' }}>{book.author}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, width: '100%', maxWidth: 560 }}>
        <button
          onClick={onConfirm}
          disabled={loading}
          style={{
            flex: 1,
            background: loading ? 'rgba(16,185,129,0.4)' : '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: 16,
            height: 70,
            fontSize: 20,
            fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Checking out…' : '✓ Check Out'}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          style={{
            flex: 1,
            background: 'transparent',
            color: '#fff',
            border: '2px solid rgba(255,255,255,0.25)',
            borderRadius: 16,
            height: 70,
            fontSize: 20,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface SuccessStepProps {
  result: CheckoutResult;
  onDone: () => void;
}

function SuccessStep({ result, onDone }: SuccessStepProps) {
  const [countdown, setCountdown] = useState(SUCCESS_COUNTDOWN);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          onDone();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        padding: '40px 32px',
        textAlign: 'center',
      }}
    >
      {/* Success checkmark */}
      <div
        style={{
          width: 120,
          height: 120,
          background: '#10b981',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 64,
          animation: 'kiosk-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        aria-hidden="true"
      >
        ✓
      </div>

      <h1 style={{ margin: 0, fontSize: 40, fontWeight: 900, color: '#10b981' }}>Enjoy your book!</h1>

      {/* Receipt-style card */}
      <div
        style={{
          background: 'rgba(255,255,255,0.07)',
          borderRadius: 20,
          padding: '24px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          width: '100%',
          maxWidth: 420,
          border: '1px dashed rgba(255,255,255,0.15)',
        }}
      >
        <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Checked Out</p>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{result.bookTitle}</p>
        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', paddingTop: 12 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Due Date</p>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{formatDueDate(result.dueDate)}</p>
        </div>
      </div>

      <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>
        Returning to main screen in {countdown}s…
      </p>

      <button
        onClick={onDone}
        style={{
          background: '#f59e0b',
          color: '#0f172a',
          border: 'none',
          borderRadius: 14,
          padding: '16px 48px',
          fontSize: 18,
          fontWeight: 700,
          cursor: 'pointer',
          minHeight: 60,
        }}
      >
        Done
      </button>

      <style>{`
        @keyframes kiosk-pop {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

/**
 * Kiosk self-checkout wizard — three steps: scan → confirm → success.
 * Requires the student to be logged in (redirected from KioskLoginPage).
 */
export function KioskCheckoutFlow() {
  const navigate = useNavigate();
  const { accessToken, user } = useAuthStore();
  const [step, setStep] = useState<Step>('scanning');
  const [book, setBook] = useState<BookInfo | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) navigate('/kiosk/login', { replace: true });
  }, [accessToken, navigate]);

  const lookupBarcode = useCallback(
    async (barcode: string) => {
      setScanError(null);
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/catalog/books?barcode=${encodeURIComponent(barcode)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const json = (await res.json()) as { success: boolean; data?: { hits?: BookInfo[] }; error?: string };
        if (json.success && json.data?.hits?.[0]) {
          const found = json.data.hits[0];
          if (found.availableCopies < 1) {
            setScanError('No copies of this book are currently available.');
          } else {
            setBook(found);
            setStep('confirming');
          }
        } else {
          setScanError(json.error ?? 'Book not found. Check the barcode and try again.');
        }
      } catch {
        setScanError('Could not connect to the server. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  const confirmCheckout = useCallback(async () => {
    if (!book || !accessToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/circulation/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ bookId: book.id }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { dueDate: string };
        error?: string;
      };
      if (json.success && json.data) {
        setResult({ dueDate: json.data.dueDate, bookTitle: book.title });
        setStep('success');
      } else {
        setScanError(json.error ?? 'Checkout failed. Please see the librarian.');
        setStep('scanning');
        setBook(null);
      }
    } catch {
      setScanError('Could not complete checkout. Please see the librarian.');
      setStep('scanning');
      setBook(null);
    } finally {
      setLoading(false);
    }
  }, [book, accessToken]);

  const handleDone = useCallback(() => {
    navigate('/kiosk/home', { replace: true });
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <button
          onClick={() => navigate('/kiosk/home')}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            fontSize: 20,
            cursor: 'pointer',
            padding: '8px 14px',
            minHeight: 52,
            minWidth: 52,
          }}
          aria-label="Back to home"
        >
          ←
        </button>
        <div>
          <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
            Welcome, {user?.name ?? 'Student'}
          </p>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Self Checkout</h1>
        </div>
      </div>

      {/* Step content */}
      {step === 'scanning' && (
        <ScanStep
          onScan={lookupBarcode}
          onCancel={handleDone}
          loading={loading}
          error={scanError}
        />
      )}
      {step === 'confirming' && book && (
        <ConfirmStep
          book={book}
          onConfirm={confirmCheckout}
          onCancel={() => { setStep('scanning'); setBook(null); }}
          loading={loading}
        />
      )}
      {step === 'success' && result && (
        <SuccessStep result={result} onDone={handleDone} />
      )}
      {step === 'error' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <div style={{ fontSize: 64 }}>❌</div>
          <p style={{ fontSize: 22, color: 'rgba(255,255,255,0.7)' }}>Something went wrong.</p>
          <button
            onClick={() => setStep('scanning')}
            style={{ background: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: 14, padding: '16px 40px', fontSize: 18, fontWeight: 700, cursor: 'pointer', minHeight: 60 }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
