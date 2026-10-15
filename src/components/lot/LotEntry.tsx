// The /lot route's front door: loads the stall board lazily, so FG's own bundle never pays for it.
// (Split out of main.tsx, which react-refresh wants free of component definitions.)
import { Suspense, lazy } from 'react';

const LotPage = lazy(() => import('./LotPage').then(m => ({ default: m.LotPage })));

export function LotEntry() {
  return (
    <Suspense fallback={null}>
      <LotPage />
    </Suspense>
  );
}
