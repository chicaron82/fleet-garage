// The /lot routes' front door: loads the page lazily, so FG's own bundle never pays for it.
// (Split out of main.tsx, which react-refresh wants free of component definitions.)
//
// ⚠️ The update prompt lives HERE too (2026-10-18). main.tsx renders /lot ahead of every FG provider, and FG's
// PwaUpdatePrompt was only mounted in FG's branch, so a phone whose service worker had cached the old /lot kept serving
// it: Aaron opened the drivers' link after the pivot shipped and got the retired stall map (*"the drivers' lot page is
// still showing the stall map instead of the pivot we built"*). Mounting it also REGISTERS the worker from /lot, so a
// driver who has opened the page once can reopen it with no signal (the precached shell).
import { Suspense, lazy } from 'react';
import type { LotPageKind } from '../../lib/lotLookout';
import { PwaUpdatePrompt } from '../shared/PwaUpdatePrompt';

const LotPage = lazy(() => import('./LotPage').then(m => ({ default: m.LotPage })));
const LotBayPage = lazy(() => import('./LotBayPage').then(m => ({ default: m.LotBayPage })));
const LotViewPage = lazy(() => import('./LotViewPage').then(m => ({ default: m.LotViewPage })));

export function LotEntry({ page }: { page: LotPageKind }) {
  return (
    <>
      <Suspense fallback={null}>
        {page === 'erin' ? <LotBayPage /> : page === 'view' ? <LotViewPage /> : <LotPage />}
      </Suspense>
      <PwaUpdatePrompt />
    </>
  );
}
