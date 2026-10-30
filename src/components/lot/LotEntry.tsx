// The /lot routes' front door: loads the page lazily, so FG's own bundle never pays for it.
// (Split out of main.tsx, which react-refresh wants free of component definitions.)
//
// ⚠️ The update prompt lives HERE too (2026-10-18). main.tsx renders /lot ahead of every FG provider, and FG's
// PwaUpdatePrompt was only mounted in FG's branch, so a phone whose service worker had cached the old /lot kept serving
// it: Aaron opened the drivers' link after the pivot shipped and got the retired stall map (*"the drivers' lot page is
// still showing the stall map instead of the pivot we built"*). Mounting it also REGISTERS the worker from /lot, so a
// driver who has opened the page once can reopen it with no signal (the precached shell).
// ⚠️⚠️ BUT ONLY WHEN ASKED (same day, Reflection 87 → his call): registering downloads FG's whole copy (~6 MB). So the
// prompt mounts only on a phone that already has a copy, or whose driver tapped "save for no-signal use" (lib/lotOffline).
// (That offer lived on the drivers' airport page, retired 2026-10-29; a phone that already said yes keeps its copy, and
// this prompt is how it learns /lot is the read-only view now.)
import { Suspense, lazy } from 'react';
import type { LotPageKind } from '../../lib/lotLookout';
import { LOT_OFFLINE_KEY, lotOfflineState, registersWorker } from '../../lib/lotOffline';
import { PwaUpdatePrompt } from '../shared/PwaUpdatePrompt';

const LotBayPage = lazy(() => import('./LotBayPage').then(m => ({ default: m.LotBayPage })));
const LotViewPage = lazy(() => import('./LotViewPage').then(m => ({ default: m.LotViewPage })));

function optedInBefore(): boolean {
  try { return localStorage.getItem(LOT_OFFLINE_KEY) === '1'; } catch { return false; }
}

export function LotEntry({ page }: { page: LotPageKind }) {
  const hasCopy = typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;
  const state = lotOfflineState(hasCopy, optedInBefore());
  return (
    <>
      <Suspense fallback={null}>
        {page === 'erin' ? <LotBayPage /> : <LotViewPage />}
      </Suspense>
      {registersWorker(state) && <PwaUpdatePrompt />}
    </>
  );
}
