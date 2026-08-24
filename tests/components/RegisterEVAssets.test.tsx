// The EV asset panel on the register form. What it must never do is claim an observation Aaron
// didn't make — so the default state offers to collect one and asserts nothing, and the Present /
// Missing controls only exist once he says he looked.
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useEvAssetCheck } from '../../src/hooks/useEvAssetCheck';
import { RegisterEVAssets } from '../../src/components/vehicle/RegisterEVAssets';

/** Renders the panel wired to the real hook, the way the register form does. */
function Harness() {
  const check = useEvAssetCheck();
  return (
    <>
      <RegisterEVAssets check={check} />
      <span data-testid="state">{`${check.assessed}|${check.hasCable}|${check.hasAdapter}`}</span>
    </>
  );
}

describe('RegisterEVAssets', () => {
  it('offers the check without making it — no Present/Missing until he says he looked', () => {
    render(<Harness />);
    expect(screen.getByText(/Not assessed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /I checked them/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Present/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('state')).toHaveTextContent('false|true|true');
  });

  it('reveals both assets together — one look answers both, and the write takes the pair', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /I checked them/ }));
    expect(screen.getByText('Mobile Charge Cable')).toBeInTheDocument();
    expect(screen.getByText('J1772 Adapter')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Present/ })).toHaveLength(2);
    expect(screen.getByTestId('state')).toHaveTextContent('true|true|true');
  });

  it('records a missing adapter against the right asset', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /I checked them/ }));
    // Second row is the J1772 adapter.
    fireEvent.click(screen.getAllByRole('button', { name: /Missing/ })[1]);
    expect(screen.getByTestId('state')).toHaveTextContent('true|true|false');
  });

  it('"Didn\'t check" withdraws the assessment entirely', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /I checked them/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /Missing/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Didn't check/ }));
    // Back to offering — and the withdrawn "missing" is GONE, not merely hidden. If it survived,
    // re-opening the panel later would show a verdict from an earlier look, ready to submit as a
    // fresh one. Asserted exactly, because 'false|' alone would pass on the broken version too.
    expect(screen.getByRole('button', { name: /I checked them/ })).toBeInTheDocument();
    expect(screen.getByTestId('state')).toHaveTextContent('false|true|true');
  });
});
