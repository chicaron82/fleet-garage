import { sentToFleet } from '../../lib/washbay-throughput';
import type { WashbayLog } from '../../types';

const COMPANY_STANDARD = 3.0;

interface Props {
  log: WashbayLog;
  baseHours: number;
  isPeakSeason: boolean;
  heldToday: number;
  onEdit: () => void;
}

export function ClosingLogSummary({ log, baseHours, isPeakSeason, heldToday, onEdit }: Props) {
  const ci  = log.fullPages * 19 + log.lastPageEntries;
  const sent = sentToFleet(log);
  const opH = baseHours + log.overtimeHours;
  const tp  = opH > 0 ? sent / opH : 0;
  const d   = tp - COMPANY_STANDARD;
  const rp  = Math.max(0, ci - heldToday);
  const da  = Math.max(0, rp - log.cleanNotPickedUp);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Closing Duties · Washbay Log</p>
        <button type="button" onClick={onEdit} className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold hover:underline cursor-pointer">Edit</button>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Cars In',       value: ci },
            { label: 'Sent to Fleet', value: sent },
            { label: 'Throughput',    value: `${tp.toFixed(1)}/hr` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-sm pt-2 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Sent-to-fleet</p>
          {[
            { label: 'Cars fuelled (gas sheet)', value: ci,                       indent: false, sign: '' },
            { label: 'In queue at close',        value: log.carsRemaining,         indent: true,  sign: '−' },
            { label: 'Parked, not sent',         value: log.nonRentablesFuelled,   indent: true,  sign: '−' },
            { label: 'Carry-over cleared', value: log.deferredCompletions, indent: true, sign: '+' },
            { label: 'Sent to fleet',            value: sent,                      indent: false, sign: '' },
          ].map(({ label, value, indent, sign }) => (
            <div key={label} className={`flex justify-between ${indent ? 'pl-4 text-gray-400 dark:text-gray-500' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
              <span className="text-xs">{sign ? `${sign} ` : ''}{label}</span>
              <span className="text-xs tabular-nums">{value}</span>
            </div>
          ))}
        </div>

        {log.nonRentablesNote && (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">Parked: "{log.nonRentablesNote}"</p>
        )}

        <div className="space-y-1 text-sm pt-2 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Airport pipeline</p>
          {[
            { label: 'Cars in',              value: ci,                  indent: false, minus: false },
            { label: `Held today (${heldToday})`, value: heldToday,      indent: true,  minus: true  },
            { label: 'Rentables processed',  value: rp,                  indent: false, minus: false },
            { label: 'Clean, not picked up', value: log.cleanNotPickedUp, indent: true, minus: true  },
            { label: 'Delivered to airport', value: da,                  indent: false, minus: false },
          ].map(({ label, value, indent, minus }) => (
            <div key={label} className={`flex justify-between ${indent ? 'pl-4 text-gray-400 dark:text-gray-500' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
              <span className="text-xs">{minus ? '− ' : ''}{label}</span>
              <span className="text-xs tabular-nums">{value}</span>
            </div>
          ))}
        </div>

        <div className={`rounded-lg px-4 py-3 ${d >= 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50'}`}>
          <p className={`text-sm font-semibold ${d >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {tp.toFixed(1)}/hr · team of {log.teamSize}
          </p>
          <p className={`text-xs mt-0.5 ${d >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
            vs {COMPANY_STANDARD.toFixed(1)} standard · {d >= 0 ? `+${d.toFixed(1)} above` : `${d.toFixed(1)} below`} {d >= 0 ? '✅' : '⚠️'}
          </p>
          <p className={`text-xs mt-1 ${d >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'} opacity-75`}>
            {opH}h operating window{isPeakSeason ? ' · peak season' : ''}
            {log.overtimeHours > 0 && ` · Extended operations: +${log.overtimeHours}h`}
          </p>
        </div>

      </div>
    </div>
  );
}
