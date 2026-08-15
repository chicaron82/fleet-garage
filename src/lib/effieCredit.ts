// Effie's remaining credit, derived from the ledger.
//
// Anthropic exposes no public "remaining balance" endpoint — the balance lives only in the
// Console. But Aaron tops up MANUALLY, one fixed load at a time (no auto-reload), and FG's API
// key is dedicated to Effie, so the remainder is derivable rather than fetchable:
//
//   remaining = (the latest top-up amount) − (everything spent since that top-up)
//
// The whole feature rests on that "no auto-reload" premise. If auto-reload, promo credits, or a
// second concurrent top-up ever enter the picture, this subtraction drifts — the "Topped up"
// button IS the single-operator alternative to auto-reload, so pick one, never both.

export interface LedgerRow {
  at: string;               // ISO timestamp
  kind: 'spend' | 'topup';
  amountUsd: number;        // always positive; `kind` carries the direction
}

export interface CreditState {
  /** The top-up this balance is measured against; null when he's never tapped "Topped up". */
  toppedUpAt: string | null;
  /** The amount of that top-up (dollars). 0 when there's no baseline yet. */
  toppedUpAmount: number;
  /** Spend recorded at or after the top-up. */
  spentSinceUsd: number;
  /** amount − spend, floored at 0 (a negative remainder means the credit ran out, not that
   *  Anthropic owes him money — showing "-$0.40 left" would just read as a bug). */
  remainingUsd: number;
  /** 0–1 for a progress bar. 0 when there's no baseline to be a fraction of. */
  fractionLeft: number;
  /** No top-up recorded yet — the UI should prompt for a baseline rather than show "$0 left",
   *  which would look like an empty account instead of an un-started tracker. */
  needsBaseline: boolean;
}

const EMPTY: CreditState = {
  toppedUpAt: null,
  toppedUpAmount: 0,
  spentSinceUsd: 0,
  remainingUsd: 0,
  fractionLeft: 0,
  needsBaseline: true,
};

/**
 * Fold a ledger into the current credit state.
 *
 * Rows may arrive in any order — the latest top-up is found by timestamp, not by position, so a
 * caller that fetches `order('at', desc)` and one that fetches ascending get the same answer.
 * Spend rows are counted only from the top-up forward: spend that predates the top-up was paid
 * for by the PREVIOUS load and has already been accounted for.
 */
export function creditState(rows: readonly LedgerRow[]): CreditState {
  let topup: LedgerRow | null = null;
  for (const r of rows) {
    if (r.kind !== 'topup') continue;
    if (topup === null || r.at > topup.at) topup = r;
  }
  if (topup === null) return EMPTY;

  let spentSinceUsd = 0;
  for (const r of rows) {
    // `>=` not `>`: a spend logged in the same instant as the top-up belongs to the new balance.
    // Off by one the other way and a call made the moment he tapped the button vanishes.
    if (r.kind === 'spend' && r.at >= topup.at) spentSinceUsd += r.amountUsd;
  }

  const remainingUsd = Math.max(0, topup.amountUsd - spentSinceUsd);
  return {
    toppedUpAt: topup.at,
    toppedUpAmount: topup.amountUsd,
    spentSinceUsd,
    remainingUsd,
    fractionLeft: topup.amountUsd > 0 ? remainingUsd / topup.amountUsd : 0,
    needsBaseline: false,
  };
}

/** Dollars for display. Sub-cent amounts round to $0.00, which is honest at this precision. */
export function formatUsd(v: number): string {
  return `$${v.toFixed(2)}`;
}

/**
 * Should the operator be warned? Effie going dark mid-shift is the failure this feature exists
 * to prevent, so the threshold is deliberately generous — a quarter of the load left is still
 * plenty of shifts, and a warning that arrives at $0.50 arrives too late to act on before work.
 */
export function isRunningLow(state: CreditState): boolean {
  return !state.needsBaseline && state.fractionLeft <= 0.25;
}
