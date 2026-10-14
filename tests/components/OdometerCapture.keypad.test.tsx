import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OdometerCapture } from '../../src/components/shared/OdometerCapture';

// Aaron, 2026-10-14, on his Pixel 10: with the keypad up, the odometer box sat flush against the
// sticky "Scan a tag" bar, the spot where a fat finger cost him a search (8412c45). Focusing the box
// now moves it to the middle of the sheet, and again once the keypad has finished shrinking it.
// The browser half (the actual distance, 10 px before and 126 px after) was measured in a rendered
// sheet; this pins the wiring that produces it.

let scrolls: ScrollIntoViewOptions[] = [];
const viewport = new EventTarget();

beforeEach(() => {
  vi.useFakeTimers();
  scrolls = [];
  Element.prototype.scrollIntoView = function (opts?: boolean | ScrollIntoViewOptions) {
    scrolls.push(opts as ScrollIntoViewOptions);
  };
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
});
afterEach(() => { vi.useRealTimers(); });

const setup = () =>
  render(<OdometerCapture vehicleId="veh-1" resetKey={1} onSave={vi.fn().mockResolvedValue(undefined)} />);

describe('OdometerCapture — clear of the bar when the keypad opens', () => {
  it('nothing moves until he taps the box', () => {
    setup();
    expect(scrolls).toHaveLength(0);                       // CONTROL: rendering alone scrolls nothing
  });

  it('a tap centres the box, and centres it again when the keypad shrinks the sheet', () => {
    setup();
    fireEvent.focus(screen.getByLabelText('Odometer reading'));
    expect(scrolls).toEqual([{ block: 'center', behavior: 'smooth' }]);

    viewport.dispatchEvent(new Event('resize'));           // the keypad lands
    expect(scrolls).toHaveLength(2);
    expect(scrolls[1].block).toBe('center');
  });

  it('a keypad that never resizes the sheet still gets the late pass, and only once', () => {
    setup();
    fireEvent.focus(screen.getByLabelText('Odometer reading'));
    vi.advanceTimersByTime(450);
    expect(scrolls).toHaveLength(2);

    viewport.dispatchEvent(new Event('resize'));           // a later resize is not this tap's business
    expect(scrolls).toHaveLength(2);
  });
});
