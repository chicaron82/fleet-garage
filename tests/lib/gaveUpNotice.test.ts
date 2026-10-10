import { describe, it, expect, afterEach } from 'vitest';
import {
  reportGaveUpOnCreate, dismissGaveUp, currentGaveUp, subscribeGaveUp,
} from '../../src/lib/gaveUpNotice';

afterEach(() => { dismissGaveUp(); });

describe('gaveUpNotice — one line, held until dismissed', () => {
  it('reports to subscribers, keeps the latest, and clears on dismiss', () => {
    const seen: (number | null)[] = [];
    const stop = subscribeGaveUp(at => seen.push(at));
    expect(currentGaveUp()).toBeNull();
    reportGaveUpOnCreate(1000);
    reportGaveUpOnCreate(2000);
    expect(currentGaveUp()).toBe(2000);
    dismissGaveUp();
    expect(currentGaveUp()).toBeNull();
    stop();
    reportGaveUpOnCreate(3000);
    expect(seen).toEqual([1000, 2000, null]);
  });
});
