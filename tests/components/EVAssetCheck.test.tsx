import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EVAssetCheck } from '../../src/components/movement/EVAssetCheck';
import type { EvAssetStatus } from '../../src/types';

// EVAssetCheck is THE EV control — trip start, driver live, the airport flip, the EV Assets tab,
// quick-add, and (since 2026-08-25) registration. Registration used to roll its own gate-plus-four-
// buttons dialect; Aaron caught it in use: *"why is the Tesla EV asset registration a different
// design language… tap to check is redundant. I've already checked."*
//
// `allowNotChecked` is what let the dialect retire without losing "not assessed". These tests pin
// BOTH halves — the new escape hatch, and that the five existing callers are untouched by it.

/** Drives the control with real state, the way every caller does. */
function Harness({ allowNotChecked, onChange }: { allowNotChecked?: boolean; onChange?: (c: EvAssetStatus | null, a: EvAssetStatus | null) => void }) {
  const [cable, setCable] = useState<EvAssetStatus | null>(null);
  const [adapter, setAdapter] = useState<EvAssetStatus | null>(null);
  onChange?.(cable, adapter);
  return (
    <EVAssetCheck
      cableStatus={cable} adapterStatus={adapter}
      onCableChange={setCable} onAdapterChange={setAdapter}
      allowNotChecked={allowNotChecked}
    />
  );
}

const NOT_CHECKED = /Didn't check — register as not assessed/;

describe('EVAssetCheck', () => {
  describe('the default — unchanged for the five existing callers', () => {
    it('fills both as present on mount, so the normal case costs ZERO taps', () => {
      const seen: Array<[EvAssetStatus | null, EvAssetStatus | null]> = [];
      render(<Harness onChange={(c, a) => seen.push([c, a])} />);
      expect(seen.at(-1)).toEqual(['present', 'present']);
      expect(screen.getAllByRole('checkbox').every(b => (b as HTMLInputElement).checked)).toBe(true);
    });

    it('offers NO way back to "not assessed" — that state is meaningless holding the car', () => {
      render(<Harness />);
      expect(screen.queryByText(NOT_CHECKED)).not.toBeInTheDocument();
    });

    it('toggles present ↔ missing, and says so', () => {
      render(<Harness />);
      const [cableBox] = screen.getAllByRole('checkbox');
      fireEvent.click(cableBox);
      expect(screen.getByText('Missing')).toBeInTheDocument();
      fireEvent.click(cableBox);
      expect(screen.queryByText('Missing')).not.toBeInTheDocument();
    });

    it('raises the do-not-rent banner only when BOTH are missing', () => {
      render(<Harness />);
      const [cableBox, adapterBox] = screen.getAllByRole('checkbox');
      fireEvent.click(cableBox);
      expect(screen.queryByText(/Hold Vehicle/)).not.toBeInTheDocument();
      fireEvent.click(adapterBox);
      expect(screen.getByText(/Hold Vehicle · Do Not Rent/)).toBeInTheDocument();
    });
  });

  describe('allowNotChecked — registration only', () => {
    it('still defaults to present: opting OUT is the rare act, not opting in', () => {
      const seen: Array<[EvAssetStatus | null, EvAssetStatus | null]> = [];
      render(<Harness allowNotChecked onChange={(c, a) => seen.push([c, a])} />);
      expect(seen.at(-1)).toEqual(['present', 'present']);
    });

    it('"Didn\'t check" clears BOTH to null — a half-withdrawn check is not a thing', () => {
      const seen: Array<[EvAssetStatus | null, EvAssetStatus | null]> = [];
      render(<Harness allowNotChecked onChange={(c, a) => seen.push([c, a])} />);
      fireEvent.click(screen.getByText(NOT_CHECKED));
      expect(seen.at(-1)).toEqual([null, null]);
    });

    it('renders "Not checked" — visually distinct from missing, because they are opposite claims', () => {
      render(<Harness allowNotChecked />);
      fireEvent.click(screen.getByText(NOT_CHECKED));
      expect(screen.getAllByText('Not checked')).toHaveLength(2);
      expect(screen.queryByText('Missing')).not.toBeInTheDocument();
      expect(screen.getAllByRole('checkbox').some(b => (b as HTMLInputElement).checked)).toBe(false);
    });

    it('hides its own link once used — a live button that no-ops is worse than no button', () => {
      render(<Harness allowNotChecked />);
      fireEvent.click(screen.getByText(NOT_CHECKED));
      expect(screen.queryByText(NOT_CHECKED)).not.toBeInTheDocument();
    });

    it('does NOT re-fill after withdrawal — the mount default must not undo his answer', () => {
      const seen: Array<[EvAssetStatus | null, EvAssetStatus | null]> = [];
      const { rerender } = render(<Harness allowNotChecked onChange={(c, a) => seen.push([c, a])} />);
      fireEvent.click(screen.getByText(NOT_CHECKED));
      rerender(<Harness allowNotChecked onChange={(c, a) => seen.push([c, a])} />);
      expect(seen.at(-1)).toEqual([null, null]);
    });

    it('a tap from "not checked" means present — the reason he would reach for it again', () => {
      const seen: Array<[EvAssetStatus | null, EvAssetStatus | null]> = [];
      render(<Harness allowNotChecked onChange={(c, a) => seen.push([c, a])} />);
      fireEvent.click(screen.getByText(NOT_CHECKED));
      fireEvent.click(screen.getAllByRole('checkbox')[0]);
      expect(seen.at(-1)?.[0]).toBe('present');
    });

    it('the whole registration flow costs zero taps to log both present', () => {
      const onCable = vi.fn(); const onAdapter = vi.fn();
      render(
        <EVAssetCheck
          cableStatus={null} adapterStatus={null}
          onCableChange={onCable} onAdapterChange={onAdapter}
          allowNotChecked
        />,
      );
      expect(onCable).toHaveBeenCalledWith('present');
      expect(onAdapter).toHaveBeenCalledWith('present');
    });
  });
});
