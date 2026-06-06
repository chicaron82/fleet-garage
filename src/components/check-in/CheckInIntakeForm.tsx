import { HoldContextPanel } from '../holds/HoldContextPanel';
import { EVAssetCheck } from '../movement/EVAssetCheck';
import { VehicleScanAndMatch } from '../vehicle/VehicleScanAndMatch';
import { LostFoundItemList } from '../lost-and-found/LostFoundItemList';
import { isTesla } from '../../lib/vehicles';
import { ConditionRatingsSelector } from './ConditionRatingsSelector';
import { FuelLevelSelector, FUEL_LABELS } from './FuelLevelSelector';
import { CheckInRoutingPreview, ROUTING_CONFIG } from './CheckInRoutingPreview';
import { Toast } from '../shared/Toast';
import { useCheckInIntake } from '../../hooks/useCheckInIntake';

interface Props {
  onFlagIssue: (vehicleId: string) => void;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function CheckInIntakeForm({ onFlagIssue }: Props) {
  const {
    user, vehicles, getHoldsForVehicle,
    scanned, unitSearch, setUnitSearch,
    mileage, setMileage, fuelLevel, setFuelLevel, photoCount, setPhotoCount,
    interiorCondition, setInteriorCondition, exteriorCondition, setExteriorCondition,
    conditionNotes, setConditionNotes,
    submitted, reHolded, submitting, saveError, toast,
    showFoundSection, setShowFoundSection, foundItems, loggedCount,
    evCableStatus, setEvCableStatus, evAdapterStatus, setEvAdapterStatus,
    lastEvCheck, lastMileage,
    routing, canSubmit,
    handleDecode, handleVehicleSelected, handleSubmit, handleReset, handleReHold,
    addFoundItem, removeFoundItem, updateFoundItem,
  } = useCheckInIntake();

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          Vehicle Intake
        </p>
        {scanned && !submitted && (
          <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer">
            Clear
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {!scanned && (
          <VehicleScanAndMatch
            vehicles={vehicles}
            unitSearch={unitSearch}
            onUnitSearchChange={setUnitSearch}
            onDecode={handleDecode}
            onSelectVehicle={handleVehicleSelected}
          />
        )}

        {scanned && !submitted && (
          <>
            {scanned.vehicle.status === 'HELD' && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700/50 rounded-lg px-4 py-3">
                <p className="font-semibold text-sm text-red-800 dark:text-red-300">⚠ Vehicle is currently on hold</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Check-in cannot be submitted while an active hold is open.</p>
              </div>
            )}

            {(scanned.vehicle.status === 'OUT_ON_EXCEPTION' || scanned.vehicle.status === 'PRE_EXISTING') && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-lg px-4 py-3">
                <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">⚠ On-exception return</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  This vehicle was released with known damage. Inspect the flagged area before completing check-in.
                </p>
              </div>
            )}

            {/* Vehicle card */}
            <div className="bg-gray-50 dark:bg-gray-950 rounded-lg px-4 py-3 space-y-1 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{scanned.vehicle.unitNumber}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {scanned.vehicle.year} {scanned.vehicle.make} {scanned.vehicle.model} · {scanned.vehicle.color}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Plate: {scanned.vehicle.licensePlate}</p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 text-right">
                  Scanned<br />{fmtTime(scanned.timestamp)}
                </span>
              </div>
              {user && (
                <HoldContextPanel
                  vehicle={scanned.vehicle}
                  holds={getHoldsForVehicle(scanned.vehicle.id)}
                  user={user}
                  onReHold={handleReHold}
                  autoExpand={
                    scanned.vehicle.status === 'OUT_ON_EXCEPTION' ||
                    scanned.vehicle.status === 'PRE_EXISTING'
                  }
                />
              )}
            </div>

            {/* Mileage + Fuel */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Mileage (km)</label>
                <input
                  type="number"
                  placeholder="e.g. 42800"
                  value={mileage}
                  onChange={e => setMileage(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition ${
                    lastMileage !== null && mileage && Number(mileage) < lastMileage
                      ? 'border-amber-500 focus:ring-amber-500'
                      : 'border-gray-300 dark:border-gray-700'
                  }`}
                />
                {lastMileage !== null && mileage && Number(mileage) < lastMileage && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                    ⚠️ Mileage is lower than last check-in ({lastMileage.toLocaleString()} km)
                  </p>
                )}
              </div>
              <FuelLevelSelector fuelLevel={fuelLevel} setFuelLevel={setFuelLevel} />
            </div>

            {/* Photos */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Photos</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPhotoCount(p => Math.min(p + 1, 6))}
                  className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-0.5"
                >
                  <span className="text-xl leading-none">+</span>
                  <span className="text-xs leading-none">Photo</span>
                </button>
                {Array.from({ length: photoCount }).map((_, i) => (
                  <div key={i} className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center transition-colors">
                    <span className="text-xl">📷</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Condition ratings */}
            <ConditionRatingsSelector
              interiorCondition={interiorCondition}
              setInteriorCondition={setInteriorCondition}
              exteriorCondition={exteriorCondition}
              setExteriorCondition={setExteriorCondition}
            />

            {/* Condition notes */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Condition Notes</label>
              <textarea
                rows={2}
                placeholder="Rear seat looks stained, possible food spill…"
                value={conditionNotes}
                onChange={e => setConditionNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition resize-none"
              />
            </div>

            {/* Routing preview */}
            {routing && <CheckInRoutingPreview routing={routing} />}

            {scanned && isTesla(scanned.vehicle) && (
              <EVAssetCheck
                cableStatus={evCableStatus}
                adapterStatus={evAdapterStatus}
                onCableChange={setEvCableStatus}
                onAdapterChange={setEvAdapterStatus}
                lastCheck={lastEvCheck}
              />
            )}

            <LostFoundItemList
              show={showFoundSection}
              items={foundItems}
              onOpen={() => { setShowFoundSection(true); addFoundItem(); }}
              onAdd={addFoundItem}
              onRemove={removeFoundItem}
              onUpdate={updateFoundItem}
            />


            {saveError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3 transition-colors">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400">Couldn't save — check connection and try again.</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                {submitting ? 'Saving…' : '✓ Submit Check-in'}
              </button>
              <button
                type="button"
                disabled={reHolded}
                onClick={() => onFlagIssue(scanned.vehicle.id)}
                className="px-4 py-2.5 border-2 border-red-400 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                Flag Issue
              </button>
            </div>
          </>
        )}

        {submitted && scanned && routing && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <span className="text-3xl">{ROUTING_CONFIG[routing].icon}</span>
            <p className="font-semibold text-green-700 dark:text-green-400 text-sm">
              {scanned.vehicle.unitNumber} checked in
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
              {ROUTING_CONFIG[routing].label}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {scanned.vehicle.year} {scanned.vehicle.make} {scanned.vehicle.model}
              {fuelLevel !== null ? ` · Fuel: ${FUEL_LABELS[fuelLevel]}` : ''}
              {mileage ? ` · ${Number(mileage).toLocaleString()} km` : ''}
            </p>
            {loggedCount > 0 && (
              <div className="px-3 py-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/40 rounded-lg text-xs text-teal-700 dark:text-teal-400 font-semibold">
                📦 {loggedCount} item{loggedCount > 1 ? 's' : ''} logged to Lost &amp; Found
              </div>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="mt-2 text-xs font-semibold text-yellow-600 hover:text-yellow-800 transition cursor-pointer"
            >
              Check in another →
            </button>
          </div>
        )}
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}
