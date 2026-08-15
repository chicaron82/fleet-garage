// Effie's remaining API credit — "~$X.XX of $10 left", with a "Topped up" re-baseline button.
//
// Aaron loads credit manually (no auto-reload), so the balance is DERIVED, not fetched:
// (latest top-up) − (spend since it). Spend rows are written by the api/ endpoints from the
// `usage` block on every Anthropic response — see api/_lib/apiSpend.ts for why FG counts its
// own tokens instead of calling Anthropic's Admin Cost API (that key needs an organization,
// which an individual account cannot have — verified live 2026-08-15).
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { creditState, formatUsd, isRunningLow, type LedgerRow } from '../../lib/effieCredit';

export function EffieCreditSection() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toppingUp, setToppingUp] = useState(false);
  const [amount, setAmount] = useState('10');
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // The loader lives INSIDE the effect (the house pattern — see EVAssetStatusSection) and a
  // "Topped up" write re-runs it by bumping refreshKey. Hoisting it into a useCallback and
  // calling it from the effect body trips react-hooks/set-state-in-effect, because the rule
  // follows the call through the callback to the setState inside it.
  //
  // No setLoading(true) inside either: `loading` starts true so the first paint is the spinner
  // anyway, and a refresh shouldn't blank a readout that's already on screen — the numbers just
  // update in place.
  useEffect(() => {
    async function load() {
      // Only rows since the last top-up actually matter, but the top-up itself has to be found
      // first — so pull a bounded recent window and let creditState pick the baseline. 2000 rows
      // is many months of single-operator traffic; the cap exists so this can never become an
      // unbounded read as the ledger grows.
      const { data, error: err } = await supabase
        .from('effie_ledger')
        .select('at, kind, amount_usd')
        .order('at', { ascending: false })
        .limit(2000);
      if (err) setError(err.message);
      setRows((data ?? []).map(r => ({
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

  async function recordTopUp() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { setError('Enter a dollar amount greater than 0.'); return; }
    setToppingUp(true);
    setError(null);
    const { error: err } = await supabase.from('effie_ledger').insert({ kind: 'topup', amount_usd: value });
    if (err) setError(err.message);
    else setRefreshKey(k => k + 1);   // re-runs the loader effect
    setToppingUp(false);
  }

  const pct = Math.round(state.fractionLeft * 100);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Effie credit</h3>
        {!loading && !state.needsBaseline && (
          <span className={`text-sm font-semibold ${low ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {/* "~" is honest: a row can fail to write, and rates are a local table. Good enough
                for "am I getting low?", which is the only question this answers. */}
            ~{formatUsd(state.remainingUsd)} of {formatUsd(state.toppedUpAmount)} left
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : state.needsBaseline ? (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          No top-up recorded yet. Enter what you loaded and tap <strong>Topped up</strong> to start tracking.
        </p>
      ) : (
        <>
          <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-2">
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
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {formatUsd(state.spentSinceUsd)} spent since{' '}
            {new Date(state.toppedUpAt!).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
            {low && <span className="text-amber-600 dark:text-amber-400 font-medium"> · running low</span>}
          </p>
        </>
      )}

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">$</span>
        <input
          type="number"
          min="0"
          step="1"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          aria-label="Top-up amount in dollars"
          className="w-20 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={() => void recordTopUp()}
          disabled={toppingUp}
          className="px-3 py-1 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium"
        >
          {toppingUp ? 'Saving…' : 'Topped up'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
