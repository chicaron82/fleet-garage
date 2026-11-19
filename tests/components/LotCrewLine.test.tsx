// The crew line's urgency (docs/ticket-lot-view-crew-urgency-and-tile-hint.md). Aaron, 2026-11-19: *"VSA's none right
// now showing a bit more urgency"*. Same words, louder; drivers stay quiet.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LotCrewLine } from '../../src/components/lot/LotCrewLine';

const crew = (vsaOn: number, vsaOut = 0, driverOn = 2) => ({ vsa: { on: vsaOn, out: vsaOut }, driver: { on: driverOn, out: 0 } });

describe('LotCrewLine', () => {
  it('⭐ no VSA on: the VSAs row is marked urgent, with the same words', () => {
    const { container } = render(<LotCrewLine summary={crew(0)} />);
    const urgent = container.querySelector('[data-urgent]');
    expect(urgent?.textContent).toBe('VSAs None on right now');
    expect(urgent?.className).toContain('bg-red-50');
  });

  it('none on but one out is still urgent: nobody is in the bay', () => {
    const { container } = render(<LotCrewLine summary={crew(0, 1)} />);
    expect(container.querySelector('[data-urgent]')?.textContent).toBe('VSAs 0 on · 1 out');
  });

  it('a VSA on: quiet, as before', () => {
    const { container } = render(<LotCrewLine summary={crew(1)} />);
    expect(container.querySelector('[data-urgent]')).toBeNull();
    expect(screen.getByText('1 on')).toBeTruthy();
  });

  it('no drivers on stays quiet: the urgency is the bay', () => {
    const { container } = render(<LotCrewLine summary={crew(1, 0, 0)} />);
    expect(container.querySelector('[data-urgent]')).toBeNull();
  });
});
