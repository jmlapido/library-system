import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export function ScanPage() {
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [flash, setFlash] = useState(false);
  const [toast, setToast] = useState('');
  const scannerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (manualMode) return;
    let quagga: typeof import('@ericblade/quagga2') | null = null;

    void (async () => {
      try {
        const Q = await import('@ericblade/quagga2');
        quagga = Q;
        const target = scannerRef.current ?? document.body;
        Q.default.init(
          {
            inputStream: {
              type: 'LiveStream',
              target,
              constraints: { facingMode: 'environment' },
            },
            decoder: { readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'code_39_reader'] },
            locate: true,
          },
          (err) => {
            if (err) { setPermissionDenied(true); return; }
            Q.default.start();
          }
        );
        Q.default.onDetected(({ codeResult }) => {
          if (codeResult.code) void handleScan(codeResult.code);
        });
      } catch {
        setPermissionDenied(true);
      }
    })();

    return () => { quagga?.default.stop(); };
  }, [manualMode]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function handleScan(code: string) {
    setFlash(true);
    setTimeout(() => setFlash(false), 500);
    try {
      const book = await api.get<{ id: string }>(`/catalog/isbn/${code}`);
      navigate(`/book/${book.id}`);
    } catch {
      showToast('Barcode not recognized');
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualInput.trim()) return;
    await handleScan(manualInput.trim());
  }

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {!manualMode && !permissionDenied && (
        <>
          <div ref={scannerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
          {flash && <div style={{ position: 'absolute', inset: 0, background: 'rgba(34,197,94,0.4)', zIndex: 5, pointerEvents: 'none' }} />}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', zIndex: 4 }}>
            <div style={{ width: 240, height: 120, borderRadius: 12, border: '2px solid rgba(255,255,255,0.8)',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }} />
            <p style={{ color: 'white', marginTop: 20, fontSize: 14, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              Point at barcode
            </p>
          </div>
        </>
      )}
      {permissionDenied && (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📵</div>
          <p style={{ color: 'white', marginBottom: 16 }}>Camera access denied. Use manual entry.</p>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, zIndex: 10, padding: '0 24px' }}>
        {manualMode ? (
          <form onSubmit={(e) => void handleManualSubmit(e)} style={{ display: 'flex', gap: 8 }}>
            <input type="text" placeholder="Enter ISBN or barcode..." value={manualInput}
              onChange={(e) => setManualInput(e.target.value)} autoFocus
              style={{ flex: 1, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 10,
                padding: '12px 14px', fontSize: 14, color: '#0f172a' }} />
            <button type="submit" style={{ background: 'white', border: 'none', borderRadius: 10,
              padding: '0 16px', color: '#4f46e5', fontWeight: 700, cursor: 'pointer' }}>Go</button>
          </form>
        ) : (
          <button onClick={() => setManualMode(true)} style={{ width: '100%', background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.4)', borderRadius: 10, padding: 12, color: 'white', fontSize: 14, cursor: 'pointer' }}>
            Enter manually
          </button>
        )}
      </div>
      {toast && (
        <div style={{ position: 'absolute', top: 24, left: 16, right: 16, zIndex: 20,
          background: 'rgba(0,0,0,0.8)', color: 'white', borderRadius: 10, padding: '12px 16px', fontSize: 13, textAlign: 'center' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
