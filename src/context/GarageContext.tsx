// ── Backward-compatible shim ────────────────────────────────────────────────
//
// useGarage() merges all four domain contexts into a single object so existing
// consumers keep working without changes.  New code should import the specific
// hook it needs (useVehicleHoldContext, useWashbayContext, etc.) for narrower
// re-render scope.
//
// Once every consumer has been migrated, this file can be deleted.

import { useMemo } from 'react';
import { useVehicleHoldContext } from './VehicleHoldContext';
import { useWashbayContext } from './WashbayContext';
import { useIssueContext } from './IssueContext';
import { useLostFoundContext } from './LostFoundContext';

import type { VehicleHoldContextValue } from './VehicleHoldContext';
import type { WashbayContextValue } from './WashbayContext';
import type { IssuesSlice } from './useIssues';
import type { LostFoundSlice } from './useLostFound';

export type GarageContextValue = VehicleHoldContextValue & WashbayContextValue & IssuesSlice & LostFoundSlice;


export function useGarage(): GarageContextValue {
  const vh   = useVehicleHoldContext();
  const wash = useWashbayContext();
  const iss  = useIssueContext();
  const lf   = useLostFoundContext();

  return useMemo(() => ({ ...vh, ...wash, ...iss, ...lf }), [vh, wash, iss, lf]);
}
