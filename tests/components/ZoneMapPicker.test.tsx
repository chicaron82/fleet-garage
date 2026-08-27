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

  // ⭐⭐⭐ THE ONE THAT MATTERS. A hold whose only tag is a headrest must not open on the exterior
  // map showing an empty car — that reads as "nothing recorded" and re-creates the very defect this
  // feature exists to fix, inside the feature.
  it('opens on the CABIN when every existing tag is interior', () => {
    render(<ZoneMapPicker selected={['seat-second-passenger']} onToggle={vi.fn()} />);
    expect(zone('2nd row — passenger')).toBeInTheDocument();
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

  // ⭐⭐ A tag already on the bench must render, not sit hidden behind a toggle he has to think to
  // flip. Same shape as the vanishing correction path.
  it('starts with the third row revealed when it is already tagged', () => {
    render(<ZoneMapPicker selected={['seat-third-bench']} onToggle={vi.fn()} />);
    expect(zone('3rd row — bench')).toBeInTheDocument();
  });

  it('passes taps through with the zone id', async () => {
    const onToggle = vi.fn();
    render(<ZoneMapPicker selected={[]} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button', { name: /interior/i }));
    await userEvent.click(zone('centre console')!);
    expect(onToggle).toHaveBeenCalledWith('centre-console');
  });

  // ⚠️ The frozen-initial-state bug, one component over from where it bit today. useState seeds once
  // at mount, so re-rendering with a different hold must re-derive the view rather than keep the old.
  it('re-derives the view when the subject changes', () => {
    const { rerender } = render(<ZoneMapPicker selected={['hood']} onToggle={vi.fn()} />);
    expect(zone('hood')).toBeInTheDocument();
    rerender(<ZoneMapPicker selected={['cargo-area']} onToggle={vi.fn()} />);
    expect(zone('cargo area')).toBeInTheDocument();
  });
});
