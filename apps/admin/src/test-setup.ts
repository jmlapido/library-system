import '@testing-library/jest-dom';

// Polyfill ResizeObserver for Radix UI components in jsdom
if (typeof ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
