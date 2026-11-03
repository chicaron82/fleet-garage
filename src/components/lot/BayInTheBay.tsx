// The In the bay card: the car and its exits (BayOpenCar), or the empty bay and its search (BayFindCar).
// Ticket: docs/ticket-lot-lookout-bay-log.md.
import { useAuth } from '../../context/AuthContext';
import type { BayLogRow } from '../../lib/lotBayLog';
import { initialsOf } from '../../lib/lotLookout';
import type { BayLogState } from '../../hooks/useBayLog';
import { useBayStandby } from '../../hooks/useBayStandby';
import { BayFindCar } from './BayFindCar';
import { BayNextUp } from './BayNextUp';
import { BayOpenCar, type BayOpenCarProps } from './BayOpenCar';

export interface BayInTheBayProps extends Omit<BayOpenCarProps, 'open' | 'onStart' | 'next'> {
  open: BayLogRow | null;
  /** The full 🔍 popup, for a key FG cannot place (register it, Lost & Found). */
  onFindCar: () => void;
  /** The module's bay log: the empty card's Start lands in it. */
  bay: BayLogState;
  /** Set right after a Skip: the empty bay says what comes next. */
  bumped: boolean;
}

export function BayInTheBay({ open, onFindCar, bay, bumped, ...car }: BayInTheBayProps) {
  const { user } = useAuth();
  const next = useBayStandby(initialsOf(user?.name ?? null) || 'FG');
  if (open) return <BayOpenCar key={open.id} open={open} next={next} onStart={bay.start} {...car} />;
  return (
    <section aria-label="In the bay" className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 px-4 py-4 space-y-3 text-center">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{bumped ? 'Bumped. Bring the ASAP car in.' : "The bay's empty."}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">Look the car up: Start clean, or put it on deck. The odo is optional.</p>
      <BayNextUp next={next} inBay={null} onStart={bay.start} />
      <BayFindCar bay={bay} onMore={onFindCar} onOpenCar={car.onOpenCar} />
    </section>
  );
}
