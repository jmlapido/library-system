import { useEffect, useRef } from 'react';

interface UseBarcodeInputOptions {
  onScan: (barcode: string) => void;
  maxKeystrokeGap?: number;
  minLength?: number;
}

/**
 * Listens for USB barcode scanner input on window keydown events.
 * USB scanners type characters rapidly (< 30ms between keystrokes) then send Enter.
 * Fires onScan when Enter completes a rapid burst of sufficient length.
 */
export function useBarcodeInput({
  onScan,
  maxKeystrokeGap = 30,
  minLength = 3,
}: UseBarcodeInputOptions): void {
  const buffer = useRef('');
  const lastKeyTime = useRef(0);

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
          onScan(scanned);
        }
        return;
      }

      if (e.key.length === 1) {
        buffer.current += e.key;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, maxKeystrokeGap, minLength]);
}
