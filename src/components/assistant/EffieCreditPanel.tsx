// Effie's remaining API credit, inside Effie's own settings panel.
//
// ⭐ WHY IT LIVES HERE AND NOT IN ANALYTICS (Aaron, 2026-08-15): FG is PERSONAL-FIRST. Analytics
// is the org-facing module — built for management in case this ever gets adopted — and this is
// Aaron's own prepaid API bill, not a shop metric. It also needs no new permission check: Effie
// is already gated to his account (plus the verify bots) by the assistant allowlist, so putting
// the readout inside Effie means the right audience is the ONLY audience, for free. The first
// cut of this shipped into Analytics behind isManagement — which hid his own bill from him,
// since his FG role is VSA. Fixing the gate was fixing the symptom; the placement was the bug.
//
// Aaron tops up manually (no auto-reload), so the balance is DERIVED, not fetched:
// (latest top-up) − (spend since it). Spend rows are written by the api/ endpoints from the
// `usage` block on every Anthropic response — see api/_lib/apiSpend.ts for why FG counts its
// own tokens rather than calling Anthropic's Admin Cost API (that key requires an organization,
// which an individual account cannot have — verified live 2026-08-15).
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { creditState, formatUsd, isRunningLow, type LedgerRow } from '../../lib/effieCredit';

export function EffieCreditPanel() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toppingUp, setToppingUp] = useState(false);
  const [amount, setAmount] = useState('10');
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // The loader lives INSIDE the effect (the house pattern) and a "Topped up" write re-runs it by
  // bumping refreshKey. Hoisting it into a useCallback and calling it from the effect body trips
  // react-hooks/set-state-in-effect — the rule follows the call through to the setState inside.
  useEffect(() => {
    async function load() {
      // Only rows since the last top-up matter, but the top-up has to be found first — so pull a
      // bounded recent window and let creditState pick the baseline. 2000 rows is many months of
      // single-operator traffic; the cap keeps this from becoming an unbounded read as it grows.
      const { data, error: err } = await supabase
        .from('effie_ledger')
        .select('at, kind, amount_usd')
        .order('at', { ascending: false })
        .limit(2000);
      if (err) setError(err.message);
      setRows((data ?? []).map((r) => ({
        at: r.at as string,
        kind: r.kind as 'spend' | 'topup',
        amountUsd: Number(r.amount_usd),
      })));
      setLoading(false);
    }
    void load();
  }, [refreshKey]);

  const state = creditState(rows);
  const low = isRunningLow(state);
  const pct = Math.round(state.fractionLeft * 100);

  async function recordTopUp() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { setError('Enter a dollar amount greater than 0.'); return; }
    setToppingUp(true);
    setError(null);
    const { error: err } = await supabase.from('effie_ledger').insert({ kind: 'topup', amount_usd: value });
    if (err) setError(err.message);
    else setRefreshKey((k) => k + 1);
    setToppingUp(false);
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Credit remaining
      </label>

      {loading ? (
        <p className="text-[11px] text-gray-400">Checking&hellip;</p>
      ) : state.needsBaseline ? (
        <p className="text-[11px] text-gray-400">
          No top-up recorded yet. Enter what you loaded and tap <strong>Topped up</strong> to start tracking.
        </p>
      ) : (
        <div className="space-y-1.5 rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-800">
          <div className="flex items-baseline justify-between">
            {/* "~" is honest: a ledger row can fail to write, and the rates are a local table.
                Good enough for "am I getting low?", which is the only question this answers. */}
            <span className={`text-sm font-semibold ${low ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
              ~{formatUsd(state.remainingUsd)}
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">of {formatUsd(state.toppedUpAmount)}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full rounded-full transition-all ${low ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Effie credit remaining"
            />
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {formatUsd(state.spentSinceUsd)} spent since{' '}
            {new Date(state.toppedUpAt!).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
            {low && <span className="font-medium text-amber-600 dark:text-amber-400"> &middot; running low</span>}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 pl-1">
        <span className="text-[11px] text-gray-400">$</span>
        <input
          type="number"
          min="0"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Top-up amount in dollars"
          className="w-16 rounded-lg bg-gray-100 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          onClick={() => void recordTopUp()}
          disabled={toppingUp}
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-200 disabled:opacity-50 cursor-pointer dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {toppingUp ? 'Saving…' : 'Topped up'}
        </button>
      </div>

      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
