// useFitTier (docs/ticket-lot-view-left-column-fits.md): the pinned column picks the first size step that fits, and
// re-picks when its content or the window changes. jsdom has no layout, so the column's height per step is faked.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useState } from 'react';
import { useFitTier } from '../../src/hooks/useFitTier';

const HEIGHTS = [770, 640, 540];
let extra = 0;
let roCallback: (() => void) | null = null;
let wide = true;

function Column() {
  const { outer, inner, tier } = useFitTier(3);
  return <div data-testid="col" ref={outer} data-fit={tier}><div data-testid="body" ref={inner} /></div>;
}

// The column only appears once the page has loaded: the case a ref object's effect missed.
function LoadsLater() {
  const [loaded, setLoaded] = useState(false);
  return loaded ? <Column /> : <button onClick={() => setLoaded(true)}>load</button>;
}

beforeEach(() => {
  extra = 0;
  wide = true;
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      const step = Number(this.parentElement?.dataset.fit ?? 0);
      return HEIGHTS[Math.min(step, 2)] + extra;
    },
  });
  vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { roCallback = cb; } observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { cb(); return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.mocked(window.matchMedia).mockImplementation(q => ({ matches: wide, media: q } as MediaQueryList));
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
});

const room = (h: number) => { window.innerHeight = h + 48; };

describe('useFitTier', () => {
  it('⭐ full size on his monitor; one step down per shortfall; scroll when nothing fits', () => {
    for (const [r, want] of [[847, '0'], [700, '1'], [600, '2'], [400, '3']] as const) {
      room(r);
      const { getByTestId, unmount } = render(<Column />);
      expect(getByTestId('col').dataset.fit).toBe(want);
      unmount();
    }
  });

  it('⭐ the column that appears after loading still gets sized', () => {
    room(600);
    const { getByText, getByTestId } = render(<LoadsLater />);
    act(() => getByText('load').click());
    expect(getByTestId('col').dataset.fit).toBe('2');
  });

  it('content grows (a banner): it steps down; it goes away: it grows back', () => {
    room(700);
    const { getByTestId } = render(<Column />);
    expect(getByTestId('col').dataset.fit).toBe('1');
    extra = 100;
    act(() => roCallback!());
    expect(getByTestId('col').dataset.fit).toBe('2');
    extra = 0;
    act(() => roCallback!());
    expect(getByTestId('col').dataset.fit).toBe('1');
  });

  it('a phone stays at 0: nothing is pinned there', () => {
    wide = false;
    room(300);
    const { getByTestId } = render(<Column />);
    expect(getByTestId('col').dataset.fit).toBe('0');
  });
});
