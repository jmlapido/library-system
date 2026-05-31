import { useEffect, useRef } from 'react';

interface UseBarcodeInputOptions {
  onScan: (barcode: string) => void;
  /** Max ms between keystrokes to still be considered part of the same scan */
  maxKeystrokeGap?: number;
  minLength?: number;
}

/**
 * Listens for USB barcode scanner input (rapid keystrokes ending with Enter).
 * Fires onScan with the accumulated barcode string.
 * onScan is intentionally not in useEffect deps — latest value is read via ref.
 */
export function useBarcodeInput({
  onScan,
  maxKeystrokeGap = 30,
  minLength = 3,
}: UseBarcodeInputOptions): void {
  const buffer = useRef('');
  const lastKeyTime = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const now = Date.now();
      const gap = now - lastKeyTime.current;
      lastKeyTime.current = now;

      if (gap > maxKeystrokeGap && buffer.current.length > 0) {
        buffer.current = '';
      }

      if (e.key === 'Enter') {
        const scanned = buffer.current.trim();
        buffer.current = '';
        if (scanned.length >= minLength) {
          onScanRef.current(scanned);
        }
        return;
      }

      if (e.key.length === 1) {
        buffer.current += e.key;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [maxKeystrokeGap, minLength]);
}
