import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBarcodeInput } from '../useBarcodeInput';

/** Fire a keydown event on window */
function fireKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

/** Advance fake time and fire a key */
function fireKeyAt(key: string, time: number) {
  vi.setSystemTime(time);
  fireKey(key);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useBarcodeInput', () => {
  it('fires onScan with accumulated string after rapid keystrokes + Enter', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeInput({ onScan }));

    // Rapid keystrokes — each < 30ms gap
    fireKeyAt('A', 100);
    fireKeyAt('B', 110);
    fireKeyAt('C', 120);
    fireKeyAt('1', 130);
    fireKeyAt('2', 140);
    fireKeyAt('Enter', 150);

    expect(onScan).toHaveBeenCalledOnce();
    expect(onScan).toHaveBeenCalledWith('ABC12');
  });

  it('resets buffer on slow keystroke gap and fires fresh burst', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeInput({ onScan }));

    // First burst
    fireKeyAt('X', 100);
    fireKeyAt('Y', 110);
    // Long gap — exceeds 30ms default
    fireKeyAt('A', 200);
    fireKeyAt('B', 210);
    fireKeyAt('C', 220);
    fireKeyAt('Enter', 230);

    expect(onScan).toHaveBeenCalledOnce();
    expect(onScan).toHaveBeenCalledWith('ABC');
  });

  it('does NOT call onScan when barcode is shorter than minLength (default 3)', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeInput({ onScan }));

    fireKeyAt('A', 100);
    fireKeyAt('B', 110);
    fireKeyAt('Enter', 120);

    expect(onScan).not.toHaveBeenCalled();
  });

  it('calls onScan when barcode meets minLength exactly', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeInput({ onScan }));

    fireKeyAt('A', 100);
    fireKeyAt('B', 110);
    fireKeyAt('C', 120);
    fireKeyAt('Enter', 130);

    expect(onScan).toHaveBeenCalledOnce();
    expect(onScan).toHaveBeenCalledWith('ABC');
  });

  it('respects custom maxKeystrokeGap option', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeInput({ onScan, maxKeystrokeGap: 100 }));

    // 80ms gap — within custom threshold of 100ms
    fireKeyAt('A', 100);
    fireKeyAt('B', 180);
    fireKeyAt('C', 250);
    fireKeyAt('Enter', 320);

    expect(onScan).toHaveBeenCalledOnce();
    expect(onScan).toHaveBeenCalledWith('ABC');
  });

  it('respects custom minLength option', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeInput({ onScan, minLength: 6 }));

    fireKeyAt('A', 100);
    fireKeyAt('B', 110);
    fireKeyAt('C', 120);
    fireKeyAt('Enter', 130);

    // Only 3 chars — below minLength of 6
    expect(onScan).not.toHaveBeenCalled();
  });

  it('removes event listener on unmount', () => {
    const onScan = vi.fn();
    const { unmount } = renderHook(() => useBarcodeInput({ onScan }));
    unmount();

    fireKeyAt('A', 100);
    fireKeyAt('B', 110);
    fireKeyAt('C', 120);
    fireKeyAt('Enter', 130);

    expect(onScan).not.toHaveBeenCalled();
  });
});
