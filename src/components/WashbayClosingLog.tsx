import { useState, useEffect } from 'react';
import { useGarage } from '../context/GarageContext';
import { useAuth } from '../context/AuthContext';

const COMPANY_STANDARD = 3.0;
const SHIFT_HOURS = 8;

export function WashbayClosingLog() {
  const { holds, submitWashbayLog, getTodayWashbayLog } = useGarage();
  const { user } = useAuth();

  const [fullPages,        setFullPages]        = useState('');
  const [lastPageEntries,  setLastPageEntries]  = useState('');
  const [carsRemaining,    setCarsRemaining]    = useState('');
  const [cleanNotPickedUp, setCleanNotPickedUp] = useState('');
  const [teamSize,         setTeamSize]         = useState(3);
  const [submitting,       setSubmitting]       = useState(false);
  const [editing,          setEditing]          = useState(false);

  const todayLog    = getTodayWashbayLog();
  const showSummary = !!todayLog && !editing;

  // Pre-fill when entering edit mode
  useEffect(() => {
    if (todayLog && editing) {
      setFullPages(String(todayLog.fullPages));
      setLastPageEntries(String(todayLog.lastPageEntries));
      setCarsRemaining(String(todayLog.carsRemaining));
      setCleanNotPickedUp(String(todayLog.cleanNotPickedUp));
      setTeamSize(todayLog.teamSize);
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const fp   = parseInt(fullPages)        || 0;
  const lpe  = parseInt(lastPageEntries)  || 0;
  const cr   = parseInt(carsRemaining)    || 0;
  const cnpu = parseInt(cleanNotPickedUp) || 0;
  const carsIn      = fp * 19 + lpe;
  const carsCleaned = Math.max(0, carsIn - cr);
  const throughput  = carsCleaned / SHIFT_HOURS;
  const delta       = throughput - COMPANY_STANDARD;

  const heldToday          = holds.filter(h => h.status === 'ACTIVE').length;
  const rentablesProcessed = Math.max(0, carsIn - heldToday);
  const deliveredToAirport = Math.max(0, rentablesProcessed - cnpu);

  const canSubmit = !submitting && carsIn > 0 && teamSize > 0 && user;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await submitWashbayLog({ fullPages: fp, lastPageEntries: lpe, carsRemaining: cr, cleanNotPickedUp: cnpu, teamSize, shiftHours: SHIFT_HOURS });
    setEditing(false);
    setSubmitting(false);
  };

  // ── Summary view (after submit) ──────────────────────────────────────────

  if (showSummary && todayLog) {
    const ci = todayLog.fullPages * 19 + todayLog.lastPageEntries;
    const cc = Math.max(0, ci - todayLog.carsRemaining);
    const tp = todayLog.shiftHours > 0 ? cc / todayLog.shiftHours : 0;
    const d  = tp - COMPANY_STANDARD;
    const ht = holds.filter(h => h.status === 'ACTIVE').length;
    const rp = Math.max(0, ci - ht);
    const da = Math.max(0, rp - todayLog.cleanNotPickedUp);

    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Closing Duties · Washbay Log</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold hover:underline cursor-pointer"
          >
            Edit
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Cars In',    value: ci },
              { label: 'Cleaned',    value: cc },
              { label: 'Throughput', value: `${tp.toFixed(1)}/hr` },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-sm pt-2 border-t border-gray-100 dark:border-gray-800">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Pipeline</p>
            {[
              { label: 'Cars in',              value: ci,   indent: false, minus: false },
              { label: `Held today (${ht})`,   value: ht,   indent: true,  minus: true  },
              { label: 'Rentables processed',  value: rp,   indent: false, minus: false },
              { label: 'Clean, not picked up', value: todayLog.cleanNotPickedUp, indent: true, minus: true },
              { label: 'Delivered to airport', value: da,   indent: false, minus: false },
            ].map(({ label, value, indent, minus }) => (
              <div key={label} className={`flex justify-between ${indent ? 'pl-4 text-gray-400 dark:text-gray-500' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                <span className="text-xs">{minus ? '− ' : ''}{label}</span>
                <span className="text-xs tabular-nums">{value}</span>
              </div>
            ))}
          </div>

          <div className={`rounded-lg px-4 py-3 ${d >= 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50'}`}>
            <p className={`text-sm font-semibold ${d >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {tp.toFixed(1)}/hr · team of {todayLog.teamSize}
            </p>
            <p className={`text-xs mt-0.5 ${d >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
              vs {COMPANY_STANDARD.toFixed(1)} standard · {d >= 0 ? `+${d.toFixed(1)} above` : `${d.toFixed(1)} below`} {d >= 0 ? '✅' : '⚠️'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Input form ───────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Closing Duties · Washbay Log</p>
      </div>
      <div className="p-4 space-y-4">

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Gas Sheet Pages</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Full pages</label>
              <input
                type="number" min="0" value={fullPages} onChange={e => setFullPages(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Last page entries</label>
              <input
                type="number" min="0" max="19" value={lastPageEntries} onChange={e => setLastPageEntries(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
              />
            </div>
          </div>
          {carsIn > 0 && (
            <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-1.5">= {carsIn} cars in ✓</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">In queue at close</label>
            <input
              type="number" min="0" value={carsRemaining} onChange={e => setCarsRemaining(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Clean, not picked up</label>
            <input
              type="number" min="0" value={cleanNotPickedUp} onChange={e => setCleanNotPickedUp(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">Team size</label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setTeamSize(t => Math.max(1, t - 1))}
              className="w-11 h-11 rounded-lg border border-gray-300 dark:border-gray-700 text-xl font-semibold text-gray-600 dark:text-gray-400 hover:border-yellow-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center"
            >
              −
            </button>
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 w-8 text-center tabular-nums">
              {teamSize}
            </span>
            <button
              type="button"
              onClick={() => setTeamSize(t => t + 1)}
              className="w-11 h-11 rounded-lg border border-gray-300 dark:border-gray-700 text-xl font-semibold text-gray-600 dark:text-gray-400 hover:border-yellow-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        {carsIn > 0 && (
          <div className={`rounded-lg px-4 py-3 ${delta >= 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50' : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700'}`}>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {carsCleaned} cars cleaned · {throughput.toFixed(1)}/hr
            </p>
            <p className={`text-xs mt-0.5 ${delta >= 0 ? 'text-green-600 dark:text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>
              vs {COMPANY_STANDARD.toFixed(1)} standard · {delta >= 0 ? `+${delta.toFixed(1)} above ✅` : `${delta.toFixed(1)} below`}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Pipeline: {carsIn} in → −{heldToday} held → {rentablesProcessed} rentable → {deliveredToAirport} delivered
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition cursor-pointer ${
            canSubmit
              ? 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
          }`}
        >
          {submitting ? 'Submitting…' : 'Submit Closing Log'}
        </button>
      </div>
    </div>
  );
}
