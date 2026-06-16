import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DriverLiveTransitView } from '../../src/components/movement/DriverLiveTransitView';

// A real trip is ~8–15 min; under 5 is almost always a mis-tap. The in-transit
// view gates "Arrived" so a sub-5-min trip asks to log-or-delete instead of
// silently saving (off-standard hard-drops short entries; trips can't, so they
// confirm). These cases are that gate.

function setup(over: Partial<Parameters<typeof DriverLiveTransitView>[0]> = {}) {
  const handleArrived = vi.fn();
  const handleCancelTrip = vi.fn();
  render(
    <DriverLiveTransitView
      vehicleDetails={null}
      plate="LUR123"
      fromLabel="Washbay"
      toLabel="Airport"
      departureTime={new Date(Date.now() - 10 * 60000).toISOString()}
      elapsed="0m 08s"
      notes=""
      setNotes={vi.fn()}
      saveError={false}
      submitting={false}
      handleArrived={handleArrived}
      handleCancelTrip={handleCancelTrip}
      {...over}
    />,
  );
  return { handleArrived, handleCancelTrip };
}

const arriveBtn = () => screen.getByRole('button', { name: /Arrived at Destination/ });

describe('DriverLiveTransitView — short-trip confirm', () => {
  it('arrives straight through for a normal-length trip (≥5 min)', () => {
    const { handleArrived } = setup({ departureTime: new Date(Date.now() - 10 * 60000).toISOString() });
    fireEvent.click(arriveBtn());
    expect(handleArrived).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Log it, or delete it/)).toBeNull();
  });

  it('intercepts a sub-5-min trip with a log-or-delete confirm instead of saving', () => {
    const { handleArrived } = setup({ departureTime: new Date(Date.now() - 2 * 60000).toISOString() });
    fireEvent.click(arriveBtn());
    expect(handleArrived).not.toHaveBeenCalled();
    expect(screen.getByText(/short for a real trip\. Log it, or delete it/)).toBeInTheDocument();
  });

  it('"Log it" on the confirm commits the trip', () => {
    const { handleArrived } = setup({ departureTime: new Date(Date.now() - 2 * 60000).toISOString() });
    fireEvent.click(arriveBtn());
    fireEvent.click(screen.getByRole('button', { name: 'Log it' }));
    expect(handleArrived).toHaveBeenCalledOnce();
  });

  it('"Delete it" on the confirm cancels the trip (deletes the row)', () => {
    const { handleArrived, handleCancelTrip } = setup({ departureTime: new Date(Date.now() - 2 * 60000).toISOString() });
    fireEvent.click(arriveBtn());
    fireEvent.click(screen.getByRole('button', { name: 'Delete it' }));
    expect(handleCancelTrip).toHaveBeenCalledOnce();
    expect(handleArrived).not.toHaveBeenCalled();
  });
});
