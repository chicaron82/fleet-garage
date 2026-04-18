import { useState } from 'react';
import { MOCK_INVENTORY } from '../data/inventory';
import type { InventoryClassification } from '../data/inventory';
import { MockBarcodeScanner } from './MockBarcodeScanner';
import type { ScannedPayload } from '../types';

type LiveClassification = 'Rentable' | 'Dirty' | 'Held' | null;

interface LiveScan extends ScannedPayload {
  id: string;
  timestamp: string;
  classification: LiveClassification;
}

function fmtSnapshot(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const CLASSIFICATION_STYLES: Record<InventoryClassification, { bg: string; text: string }> = {
  'Rentable':     { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  'Dirty':        { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  'Damage Hold':  { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400' },
  'Detail Hold':  { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-400' },
};

export function InventoryView() {
  const { items, timestamp, takenBy } = MOCK_INVENTORY;
  const [liveScans, setLiveScans] = useState<LiveScan[]>([]);

  const handleScan = (payload: ScannedPayload, ts: string) => {
    setLiveScans(prev => [{ ...payload, id: crypto.randomUUID(), timestamp: ts, classification: null }, ...prev]);
  };

  const classify = (id: string, c: LiveClassification) => {
    setLiveScans(prev => prev.map(s => s.id === id ? { ...s, classification: c } : s));
  };

  const counts = items.reduce<Record<InventoryClassification, number>>((acc, item) => {
    acc[item.classification] = (acc[item.classification] ?? 0) + 1;
    return acc;
  }, { 'Rentable': 0, 'Dirty': 0, 'Damage Hold': 0, 'Detail Hold': 0 });

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">Closing Inventory</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">
          Snapshot taken {fmtSnapshot(timestamp)} by {takenBy}
        </p>
      </div>

      {/* Live scan section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Live Scan</p>
          {liveScans.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">{liveScans.length} scanned</span>
          )}
        </div>
        <div className="p-4 space-y-3">
          <MockBarcodeScanner onScan={handleScan} label="Scan Vehicle" />
          {liveScans.map(scan => (
            <div key={scan.id} className={`rounded-lg border p-3 transition-colors ${
              scan.classification === null
                ? 'border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10'
                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
            }`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{scan.unitNumber} · {scan.licensePlate}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{scan.year} {scan.make} {scan.model} · {scan.color}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {new Date(scan.timestamp).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>
                {scan.classification && (
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    scan.classification === 'Rentable' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                    scan.classification === 'Dirty'    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                                         'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>{scan.classification}</span>
                )}
              </div>
              {scan.classification === null && (
                <div className="flex gap-1.5">
                  {(['Rentable', 'Dirty', 'Held'] as const).map(c => (
                    <button key={c} type="button" onClick={() => classify(scan.id, c)}
                      className="flex-1 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:border-yellow-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer">
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {liveScans.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">Scan a vehicle to classify it</p>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CountCard count={counts['Rentable']} label="Rentable" color="text-green-600 dark:text-green-500" />
        <CountCard count={counts['Dirty']} label="Dirty" color="text-amber-500" />
        <CountCard count={counts['Damage Hold']} label="Damage Hold" color="text-red-600 dark:text-red-500" />
        <CountCard count={counts['Detail Hold']} label="Detail Hold" color="text-blue-600 dark:text-blue-500" />
      </div>

      {/* Vehicle List */}
      <div className="space-y-2">
        {items.map(item => {
          const style = CLASSIFICATION_STYLES[item.classification];
          return (
            <div
              key={item.id}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm transition-colors">
                      {item.unitNumber}
                    </span>
                    <span className="text-gray-400 dark:text-gray-600 text-xs">·</span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs transition-colors">
                      {item.licensePlate}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
                    {item.year} {item.make} {item.model}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 transition-colors">
                    {item.lotLocation}
                  </p>
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text} transition-colors`}>
                  {item.classification}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center transition-colors">
        {items.length} vehicles scanned · Read-only snapshot
      </p>
    </div>
  );
}

function CountCard({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
      <p className={`text-2xl font-bold ${color}`}>{count}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
