import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterVehicleFlags } from '../../src/components/vehicle/RegisterVehicleFlags';

describe('RegisterVehicleFlags', () => {
  it('says the US flag also changes the odometer unit, rather than looking decorative', () => {
    render(<RegisterVehicleFlags isUs={false} onIsUs={vi.fn()} winterTires={null} onWinterTires={vi.fn()} />);
    expect(screen.getByText(/odometer in miles/i)).toBeInTheDocument();
  });

  // ⭐⭐⭐ THE UNTOUCHED-CONTROL RULE, which FG learned on the EV checkboxes. An unticked box is not
  // "no winter tires" — it is "nobody looked", and every car he registers and walks away from would
  // otherwise silently report summer tyres.
  it('starts as NOT CHECKED, which is not the same as "none fitted"', () => {
    render(<RegisterVehicleFlags isUs={false} onIsUs={vi.fn()} winterTires={null} onWinterTires={vi.fn()} />);
    expect(screen.getByText(/not checked/i)).toBeInTheDocument();
    expect(screen.queryByText(/none fitted/i)).not.toBeInTheDocument();
  });

  // ⚠️ And once he HAS decided, "none fitted" must read differently from "not checked" — otherwise a
  // recorded no and an unanswered question look identical on the form he is standing at.
  it('distinguishes a recorded "no" from never having looked', () => {
    const { rerender } = render(
      <RegisterVehicleFlags isUs={false} onIsUs={vi.fn()} winterTires={false} onWinterTires={vi.fn()} />);
    expect(screen.getByText(/none fitted/i)).toBeInTheDocument();
    rerender(<RegisterVehicleFlags isUs={false} onIsUs={vi.fn()} winterTires={true} onWinterTires={vi.fn()} />);
    expect(screen.getByText(/fitted/i)).toBeInTheDocument();
    expect(screen.queryByText(/not checked/i)).not.toBeInTheDocument();
  });

  it('reports both taps', async () => {
    const onIsUs = vi.fn(), onWinterTires = vi.fn();
    render(<RegisterVehicleFlags isUs={false} onIsUs={onIsUs} winterTires={null} onWinterTires={onWinterTires} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /US vehicle/i }));
    expect(onIsUs).toHaveBeenCalledWith(true);
    await userEvent.click(screen.getByRole('checkbox', { name: /winter tires/i }));
    expect(onWinterTires).toHaveBeenCalledWith(true);
  });
});
