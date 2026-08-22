import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CohortNav } from '../../src/components/vehicle/CohortNav';

// Prev/next through the worklist he came from (Aaron, 2026-08-22, double-checking held cars).

const open = vi.fn();
const list = ['a', 'b', 'c'];

describe('CohortNav', () => {
  it('shows the position and steps both ways', () => {
    render(<CohortNav cohort={list} vehicleId="b" onOpenVehicle={open} />);
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Next vehicle'));
    expect(open).toHaveBeenCalledWith('c');
    fireEvent.click(screen.getByLabelText('Previous vehicle'));
    expect(open).toHaveBeenCalledWith('a');
  });

  it('disables the ends rather than wrapping', () => {
    render(<CohortNav cohort={list} vehicleId="a" onOpenVehicle={open} />);
    expect(screen.getByLabelText('Previous vehicle')).toBeDisabled();
    expect(screen.getByLabelText('Next vehicle')).toBeEnabled();
  });

  it('⭐ renders NOTHING without a list — a scan or a bookmark has no "next"', () => {
    const { container } = render(<CohortNav vehicleId="a" onOpenVehicle={open} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the car has dropped out of the list', () => {
    // He opens a held car from a filtered list and marks it repaired; the filter stops matching it.
    const { container } = render(<CohortNav cohort={list} vehicleId="gone" onOpenVehicle={open} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when nobody can act on a tap', () => {
    const { container } = render(<CohortNav cohort={list} vehicleId="b" />);
    expect(container).toBeEmptyDOMElement();
  });
});
