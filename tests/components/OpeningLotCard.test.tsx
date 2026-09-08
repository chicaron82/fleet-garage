import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OpeningLotCard } from '../../src/components/my-day/OpeningLotCard';

// ⚠️⚠️ 69 CLEAN, 31 DIRTY — Aaron, 2026-09-08, walking into a full lot: *"that's a lot of carry over
// from last night for the stepper."* A hundred taps on a ± control, all thumb, by a man with
// arthritis. The ± are right for a nudge of one and wrong for the case this card exists to serve.
vi.mock('../../src/context/WashbayContext', () => ({
  useWashbayContext: () => ({ washbayLogs: [], submitWashbayLog: vi.fn() }),
}));

const dirties = () => screen.getByLabelText('Dirties left in queue') as HTMLInputElement;

describe('OpeningLotCard — the carry-over is typeable', () => {
  it('⭐ a real carry-over is TYPED, not tapped', () => {
    render(<OpeningLotCard />);
    fireEvent.change(dirties(), { target: { value: '31' } });
    expect(dirties().value).toBe('31');
  });

  // ⭐⭐ Without select-on-focus the field starts at "0" and typing 69 lands "069" or "690".
  // The behaviour is what makes the feature real rather than nominal.
  it('⭐⭐ focusing selects the existing value so typing REPLACES it', () => {
    render(<OpeningLotCard />);
    const input = dirties();
    const select = vi.spyOn(input, 'select');
    fireEvent.focus(input);
    expect(select).toHaveBeenCalled();
  });

  it('⚠️ refuses non-digits rather than showing NaN', () => {
    render(<OpeningLotCard />);
    fireEvent.change(dirties(), { target: { value: '4x2' } });
    expect(dirties().value).toBe('42');
  });

  it('⚠️ an emptied field reads as 0 — he is mid-edit, not entering nothing', () => {
    render(<OpeningLotCard />);
    fireEvent.change(dirties(), { target: { value: '' } });
    expect(dirties().value).toBe('0');
  });

  // ⭐ The ± STAY. This was never a replacement — a nudge of one is the other half of how the card
  // is used, and removing it would trade one mis-sized control for another.
  it('⭐ the ± buttons still work for a nudge of one', () => {
    render(<OpeningLotCard />);
    fireEvent.change(dirties(), { target: { value: '31' } });
    fireEvent.click(screen.getByLabelText('More — Dirties left in queue'));
    expect(dirties().value).toBe('32');
    fireEvent.click(screen.getByLabelText('Fewer — Dirties left in queue'));
    expect(dirties().value).toBe('31');
  });
});
