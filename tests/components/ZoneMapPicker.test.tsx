import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoneMapPicker } from '../../src/components/holds/ZoneMapPicker';

const zone = (name: string) => screen.queryByRole('checkbox', { name: new RegExp(name, 'i') });

describe('ZoneMapPicker', () => {
  it('opens on the exterior and shows exterior panels', () => {
    render(<ZoneMapPicker selected={[]} onToggle={vi.fn()} />);
    expect(zone('hood')).toBeInTheDocument();
    expect(zone('2nd row')).not.toBeInTheDocument();
  });

  it('switches to the cabin on tap', async () => {
    render(<ZoneMapPicker selected={[]} onToggle={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /interior/i }));
    expect(zone('2nd row — passenger')).toBeInTheDocument();
    expect(zone('hood')).not.toBeInTheDocument();
  });

  // ⭐⭐⭐ THE ONE THAT MATTERS, and it INVERTED on 2026-08-27. It used to assert the picker opened on
  // the cabin when every tag was interior — Aaron rejected that from the floor: both maps share a
  // silhouette and the same side labels, so a 2nd-row seat reads as a rear passenger door on a map he
  // did not choose. It must open on the EXTERIOR, visibly clear, and let the badge say the rest.
  it('opens on the EXTERIOR even when every tag is interior, and says so on the badge', () => {
    render(<ZoneMapPicker selected={['seat-second-passenger']} onToggle={vi.fn()} />);
    expect(zone('hood')).toBeInTheDocument();                      // exterior map is what he sees
    expect(zone('2nd row — passenger')).not.toBeInTheDocument();    // never moved without asking
    // …and the two true things at once: nothing selected out here, one thing in there.
    expect(screen.getByRole('button', { name: /interior/i }).textContent).toMatch(/1/);
  });

  it('opens on the exterior for a mixed hold — interior is one tap away', () => {
    render(<ZoneMapPicker selected={['hood', 'cargo-area']} onToggle={vi.fn()} />);
    expect(zone('hood')).toBeInTheDocument();
  });

  // ⚠️ Switching views blind is the same as not rendering the tag: he cannot know something is over
  // there unless the control says so.
  it('advertises how many tags live on the other map', async () => {
    render(<ZoneMapPicker selected={['hood', 'cargo-area', 'head-unit']} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: /interior/i }).textContent).toMatch(/2/);
  });

  // ⚠️ The toggle and the ZONE were both announced as "3rd row" until this test tripped over the
  // collision — a real ambiguity for anyone navigating by accessible name, not just for the query.
  it('hides the third-row bench until the toggle is on', async () => {
    render(<ZoneMapPicker selected={[]} onToggle={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /interior/i }));
    expect(zone('3rd row — bench')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /show third-row/i }));
    expect(zone('3rd row — bench')).toBeInTheDocument();
  });

  // ⭐⭐ A tag already on the bench must render the moment he reaches the cabin — not sit hidden
  // behind a toggle he has to think to flip. (He still has to switch views, by design; what must not
  // happen is arriving on the interior map with an existing tag invisible.)
  it('has the third row already revealed when he reaches the cabin', async () => {
    render(<ZoneMapPicker selected={['seat-third-bench']} onToggle={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /interior/i }));
    expect(zone('3rd row — bench')).toBeInTheDocument();
  });

  it('passes taps through with the zone id', async () => {
    const onToggle = vi.fn();
    render(<ZoneMapPicker selected={[]} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button', { name: /interior/i }));
    await userEvent.click(zone('centre console')!);
    expect(onToggle).toHaveBeenCalledWith('centre-console');
  });

  // ⚠️ The frozen-initial-state bug. useState seeds once at mount, so switching to another car must
  // RESET the view — otherwise he lands on the cabin for a car he has not opened yet, which is the
  // exact misread the exterior default exists to prevent, arriving through a different door.
  it('resets to the exterior when the subject changes', async () => {
    const { rerender } = render(<ZoneMapPicker selected={['hood']} onToggle={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /interior/i }));
    expect(zone('2nd row — centre')).toBeInTheDocument();          // he switched, deliberately
    rerender(<ZoneMapPicker selected={['cargo-area']} onToggle={vi.fn()} />);
    expect(zone('hood')).toBeInTheDocument();                      // new car → back to exterior
    expect(zone('cargo area')).not.toBeInTheDocument();
  });
});
