import { useEffect, useRef, useState, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { InactivityOverlay } from './InactivityOverlay';

/** Idle threshold (ms) before the inactivity overlay appears. */
const IDLE_WARN_MS = 90_000;
/** Countdown duration (s) shown in the overlay before auto-logout. */
const COUNTDOWN_SECONDS = 30;

const RESET_EVENTS: Array<keyof WindowEventMap> = [
  'pointermove',
  'pointerdown',
  'keydown',
  'touchstart',
  'scroll',
];

/**
 * Fullscreen kiosk shell.
 * - Detects inactivity and shows a 30-s countdown overlay.
 * - Returns to the attract screen when the countdown reaches 0.
 * - All kiosk pages render via <Outlet />.
 */
export function KioskShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [countdown, setCountdown] = useState<number | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();
  const countdownTimer = useRef<ReturnType<typeof setInterval>>();

  const isAttractScreen = location.pathname === '/kiosk';

  const clearCountdown = useCallback(() => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = undefined;
    }
    setCountdown(null);
  }, []);

  const startCountdown = useCallback(() => {
    setCountdown(COUNTDOWN_SECONDS);
    countdownTimer.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownTimer.current);
          countdownTimer.current = undefined;
          navigate('/kiosk', { replace: true });
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [navigate]);

  const resetIdle = useCallback(() => {
    clearTimeout(idleTimer.current);
    clearCountdown();
    if (!isAttractScreen) {
      idleTimer.current = setTimeout(startCountdown, IDLE_WARN_MS);
    }
  }, [isAttractScreen, clearCountdown, startCountdown]);

  useEffect(() => {
    resetIdle();
    RESET_EVENTS.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    return () => {
      clearTimeout(idleTimer.current);
      clearCountdown();
      RESET_EVENTS.forEach((e) => window.removeEventListener(e, resetIdle));
    };
  }, [resetIdle, clearCountdown]);

  /** Re-arm the idle timer whenever the route changes. */
  useEffect(() => {
    resetIdle();
  }, [location.pathname, resetIdle]);

  const handleStillHere = useCallback(() => {
    resetIdle();
  }, [resetIdle]);

  return (
    <div
      style={{
        width: '100vw',
        minHeight: '100vh',
        background: '#0f172a',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Outlet />
      {countdown !== null && !isAttractScreen && (
        <InactivityOverlay countdown={countdown} onStillHere={handleStillHere} />
      )}
    </div>
  );
}
