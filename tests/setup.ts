import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom doesn't ship navigator.vibrate; haptics helpers call it unconditionally.
Object.defineProperty(window.navigator, 'vibrate', {
  configurable: true,
  value: vi.fn(),
});

// Polyfill matchMedia (used by Tailwind dark-mode helpers in a few places).
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom does not implement scrollIntoView. Panels that scroll themselves into view on reveal
// (useRevealScroll) would otherwise throw the moment a test renders them.
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
});
