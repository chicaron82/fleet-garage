// The /lot routes' front door: loads the page lazily, so FG's own bundle never pays for it.
// (Split out of main.tsx, which react-refresh wants free of component definitions.)
import { Suspense, lazy } from 'react';
import type { LotPageKind } from '../../lib/lotLookout';

const LotPage = lazy(() => import('./LotPage').then(m => ({ default: m.LotPage })));
const LotBayPage = lazy(() => import('./LotBayPage').then(m => ({ default: m.LotBayPage })));
const LotViewPage = lazy(() => import('./LotViewPage').then(m => ({ default: m.LotViewPage })));

export function LotEntry({ page }: { page: LotPageKind }) {
  return (
    <Suspense fallback={null}>
      {page === 'erin' ? <LotBayPage /> : page === 'view' ? <LotViewPage /> : <LotPage />}
    </Suspense>
  );
}
