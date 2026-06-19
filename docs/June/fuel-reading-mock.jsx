import React, { useState } from 'react';

export default function FuelReadingMock() {
  const [pump1Open, setPump1Open] = useState('');
  const [pump1Close, setPump1Close] = useState('');
  const [pump2Reading, setPump2Reading] = useState('');
  const [digitalOpen, setDigitalOpen] = useState('');
  const [digitalClose, setDigitalClose] = useState('');
  const [topUpNote, setTopUpNote] = useState('');

  const LAST_PUMP2 = 1439;
  const pump2Num = parseFloat(pump2Reading);
  const pump2Changed = pump2Reading !== '' && !isNaN(pump2Num) && pump2Num !== LAST_PUMP2;

  const pump1Delta =
    pump1Open !== '' && pump1Close !== '' && !isNaN(parseFloat(pump1Open)) && !isNaN(parseFloat(pump1Close))
      ? Math.round(parseFloat(pump1Close) - parseFloat(pump1Open))
      : null;

  const digitalDelta =
    digitalOpen !== '' && digitalClose !== '' && !isNaN(parseFloat(digitalOpen)) && !isNaN(parseFloat(digitalClose))
      ? (parseFloat(digitalClose) - parseFloat(digitalOpen)).toFixed(1)
      : null;

  const digitalIsHigher = digitalDelta !== null && parseFloat(digitalDelta) > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center py-8 px-4 font-sans">
      <div className="w-full max-w-md">

        {/* Mock app header, matching FG's real shell */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-700 to-emerald-900 flex items-center justify-center text-white font-bold text-sm">F</div>
            <span className="font-bold text-gray-900">Fleet Garage</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Section header */}
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <h2 className="text-xs font-bold tracking-wider text-gray-400 uppercase">Fuel Pump Readings</h2>
          </div>

          <div className="px-5 py-4 space-y-5">

            {/* Pump 1 */}
            <div>
              <label className="text-sm font-semibold text-gray-800">Pump 1 — Analog</label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <span className="text-xs text-gray-500">Opening</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    placeholder="0"
                    value={pump1Open}
                    onChange={e => setPump1Open(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  />
                </div>
                <div>
                  <span className="text-xs text-gray-500">Closing</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    placeholder="0"
                    value={pump1Close}
                    onChange={e => setPump1Close(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  />
                </div>
              </div>
              {pump1Delta !== null && (
                <div className="mt-2 px-3 py-2.5 rounded-xl bg-yellow-50 border border-yellow-200">
                  <p className="text-sm font-semibold text-gray-800">⛽ {pump1Delta} L pumped today</p>
                  <p className="text-xs text-gray-500 mt-0.5">Closing ({pump1Close || '—'}) − Opening ({pump1Open || '—'})</p>
                </div>
              )}
            </div>

            <div className="h-px bg-gray-100" />

            {/* Pump 2 — the tripwire */}
            <div>
              <div className="flex items-baseline justify-between">
                <label className="text-sm font-semibold text-gray-800">Pump 2 — Analog</label>
                <span className="text-[11px] text-gray-400">last recorded: {LAST_PUMP2}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Side unused since policy change — should read {LAST_PUMP2} every shift</p>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                placeholder={`${LAST_PUMP2}`}
                value={pump2Reading}
                onChange={e => setPump2Reading(e.target.value)}
                className={`w-full mt-2 px-3 py-2.5 rounded-xl border text-base focus:outline-none focus:ring-2 ${
                  pump2Changed
                    ? 'border-red-300 focus:ring-red-400 focus:border-red-400 bg-red-50'
                    : 'border-gray-300 focus:ring-yellow-400 focus:border-yellow-400'
                }`}
              />
              {pump2Changed && (
                <div className="mt-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-sm text-red-700 font-medium">⚠️ Pump 2 changed from {LAST_PUMP2} to {pump2Reading}</p>
                  <p className="text-xs text-red-600 mt-0.5">This side shouldn't be in use. Confirm the reading is accurate, or flag for follow-up.</p>
                </div>
              )}
            </div>

            <div className="h-px bg-gray-100" />

            {/* Digital */}
            <div>
              <label className="text-sm font-semibold text-gray-800">Digital Tank Reading</label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <span className="text-xs text-gray-500">Opening</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={digitalOpen}
                    onChange={e => setDigitalOpen(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  />
                </div>
                <div>
                  <span className="text-xs text-gray-500">Closing</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={digitalClose}
                    onChange={e => setDigitalClose(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  />
                </div>
              </div>
              {digitalDelta !== null && (
                <p className={`text-xs mt-1.5 ${digitalIsHigher ? 'text-blue-600' : 'text-gray-500'}`}>
                  {digitalIsHigher ? `🔵 Reading went UP by ${Math.abs(parseFloat(digitalDelta))} L — note why below` : `⛽ ${Math.abs(parseFloat(digitalDelta))} L net change`}
                </p>
              )}

              {digitalIsHigher && (
                <input
                  type="text"
                  placeholder="e.g. Tank topped up mid-shift"
                  value={topUpNote}
                  onChange={e => setTopUpNote(e.target.value)}
                  className="w-full mt-2 px-3 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              )}
            </div>

          </div>

          {/* Save action — FG's yellow action lane */}
          <div className="px-5 pb-5 pt-2">
            <button className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-500 active:scale-[0.99] transition font-bold text-gray-900">
              Save Fuel Readings
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4 px-4">
          Pump 2 should always read {LAST_PUMP2}. A changed reading flags for review — that's how the last instance of side-use got caught.
        </p>
      </div>
    </div>
  );
}
