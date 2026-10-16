// Aaron, 2026-10-15: "how bout moving the aisle stepper up closer to the HIR booth, instead of have to scroll down
// further to reach it". The stepper was centred on the return lane, about ten stalls down. These pin it at the TOP
// of the lane, ahead of the lane's own label, so it sits level with the N1–N2 booth.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LotMap } from '../../src/components/lot/LotMap';

const aisle = { cars: 0, tappedBy: null, tappedAt: null };

describe('LotMap — the aisle stepper by the booth', () => {
  it('the stepper is the first thing in the return lane, above the RETURN label', () => {
    render(<LotMap stalls={[]} aisle={aisle} nowMs={0} nPulse={false} onTap={vi.fn()} onAisle={vi.fn()} />);
    const stepper = screen.getByLabelText('Cars left in the aisle');
    const lane = stepper.parentElement!;
    expect(lane.firstElementChild).toBe(stepper);
    const label = [...lane.children].find(el => el.textContent === 'RETURN')!;
    expect(label).toBeTruthy();                                       // CONTROL: the lane label is still drawn
    expect(stepper.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the stepper still steps', () => {
    const onAisle = vi.fn();
    render(<LotMap stalls={[]} aisle={aisle} nowMs={0} nPulse={false} onTap={vi.fn()} onAisle={onAisle} />);
    screen.getByRole('button', { name: 'One more in the aisle' }).click();
    screen.getByRole('button', { name: 'One fewer in the aisle' }).click();
    expect(onAisle.mock.calls).toEqual([[1], [-1]]);
  });
});
