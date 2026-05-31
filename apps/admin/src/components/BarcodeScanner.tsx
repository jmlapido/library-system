import { useEffect, useRef } from 'react';
import Quagga from '@ericblade/quagga2';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (err: Error) => void;
}

/**
 * Camera-based barcode scanner using Quagga2.
 * Uses onScanRef/onErrorRef to avoid stale closure issues.
 * Guards against React StrictMode double-invoke with a cancelled flag.
 */
export function BarcodeScanner({ onScan, onError }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!scannerRef.current) return;
    let cancelled = false;

    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: scannerRef.current,
          constraints: { facingMode: 'environment', width: 640, height: 480 },
        },
        decoder: { readers: ['code_128_reader'] },
        locate: true,
      },
      (err) => {
        if (cancelled) { Quagga.stop(); return; }
        if (err) {
          onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        Quagga.start();
      }
    );

    Quagga.onDetected((result) => {
      const code = result.codeResult?.code;
      if (code) onScanRef.current(code);
    });

    return () => {
      cancelled = true;
      Quagga.offDetected();
      Quagga.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={scannerRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 480,
        aspectRatio: '4/3',
        overflow: 'hidden',
        borderRadius: 8,
        background: '#000',
      }}
    />
  );
}
