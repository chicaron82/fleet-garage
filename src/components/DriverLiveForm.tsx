import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { hapticLight } from '../lib/haptics';
import { NotesField } from './VSATripComponents';
import { EVAssetCheck } from './EVAssetCheck';
import type { TripRun } from '../data/trips';
import type { RentalClass } from '../data/manifest';
import { PriorityHint } from './PriorityHint';
import { DriverLiveTransitView } from './DriverLiveTransitView';
import { DriverLiveCompleteView } from './DriverLiveCompleteView';
import { useDriverLiveTrip, LOCATIONS } from '../hooks/useDriverLiveTrip';

interface Props {
  flaggedClasses: RentalClass[];
  onTripComplete: (trip: TripRun) => void;
}

export function DriverLiveForm({ flaggedClasses, onTripComplete }: Props) {
  const { user } = useAuth();
  const { shuttlePlate } = useGarage();

  const {
    liveState,
    routeStep,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    plate,
    setPlate,
    isShuttle,
    setIsShuttle,
    notes,
    setNotes,
    departureTime,
    arrivalTime,
    elapsed,
    submitting,
    saveError,
    isTeslaRun,
    setIsTeslaRun,
    evCableStatus,
    setEvCableStatus,
    evAdapterStatus,
    setEvAdapterStatus,
    vehicleDetails,
    plateSuggestions,
    showSuggestions,
    setShowSuggestions,
    fromLabel,
    toLabel,
    canStart,
    handlePlateBlur,
    handleSuggestionSelect,
    handleLocationTap,
    handleRouteReset,
    handleStart,
    handleArrived,
    handleReset,
    handleCancelTrip,
    from,
    to,
  } = useDriverLiveTrip({
    user,
    shuttlePlate,
    onTripComplete,
  });

  if (liveState === 'form') {
    return (
      <div className="space-y-4">
        <PriorityHint flaggedClasses={flaggedClasses} topClasses={[]} />

        {/* Route picker */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {routeStep === 'origin'      && 'Starting at?'}
            {routeStep === 'destination' && 'Going to?'}
            {routeStep === 'confirmed'   && (
              <>
                <button type="button" onClick={handleRouteReset} className="text-yellow-600 dark:text-yellow-400 hover:underline normal-case font-semibold cursor-pointer">
                  {fromLabel} → {toLabel}
                </button>
                <span className="ml-1.5 text-[10px] normal-case font-normal text-gray-400 dark:text-gray-500">tap to change</span>
              </>
            )}
          </p>

          {routeStep !== 'confirmed' && (
            <div className="flex gap-2">
              {LOCATIONS.map(loc => (
                <button
                  key={loc} type="button"
                  onClick={() => handleLocationTap(loc)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition cursor-pointer ${
                    from === loc
                      ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100'
                      : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >{loc}</button>
              ))}
            </div>
          )}

          {routeStep === 'destination' && from === 'Other' && (
            <div className="relative">
              <input
                type="text" autoFocus placeholder="Specify origin…" value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
              />
              <button
                type="button"
                onClick={handleRouteReset}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none"
              >×</button>
            </div>
          )}
          {routeStep === 'confirmed' && to === 'Other' && (
            <div className="relative">
              <input
                type="text" autoFocus placeholder="Specify destination…" value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
              />
              <button
                type="button"
                onClick={() => { hapticLight(); handleRouteReset(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none"
              >×</button>
            </div>
          )}
        </div>

        {/* License Plate */}
        <div className="relative z-10">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">License Plate *</label>
          <input
            type="text" placeholder="e.g. JFT 881" value={plate}
            onChange={e => {
              const val = e.target.value.toUpperCase();
              setPlate(val);
              if (shuttlePlate) setIsShuttle(val.trim() === shuttlePlate.toUpperCase().trim());
              if (!val) setShowSuggestions(false);
            }}
            onBlur={() => {
              // Delay hiding to allow click event on suggestion
              setTimeout(() => setShowSuggestions(false), 200);
              handlePlateBlur();
            }}
            onFocus={() => {
              if (plateSuggestions.length > 0) setShowSuggestions(true);
            }}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition uppercase"
          />
          {showSuggestions && plateSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-[68px] bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
              {plateSuggestions.map(v => (
                <button
                  key={v.license_plate}
                  type="button"
                  onClick={() => handleSuggestionSelect(v)}
                  className="w-full text-left px-4 py-2.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-0 flex justify-between items-center cursor-pointer"
                >
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{v.license_plate}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{v.year} {v.make} {v.model}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-3">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isShuttle ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'}`}>
                {isShuttle && <span className="text-xs font-bold leading-none">✓</span>}
              </div>
              <input type="checkbox" className="sr-only" checked={isShuttle} onChange={e => {
                hapticLight();
                const checked = e.target.checked;
                setIsShuttle(checked);
                if (checked && shuttlePlate) setPlate(shuttlePlate.toUpperCase());
                else if (!checked && shuttlePlate && plate === shuttlePlate.toUpperCase()) setPlate('');
              }} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">Lot Shuttle</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group" onClick={() => { hapticLight(); setIsTeslaRun(v => !v); }}>
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isTeslaRun ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'}`}>
                {isTeslaRun && <span className="text-xs font-bold leading-none">✓</span>}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">Tesla ⚡</span>
            </label>
          </div>
        </div>

        {isTeslaRun && (
          <EVAssetCheck
            cableStatus={evCableStatus}
            adapterStatus={evAdapterStatus}
            onCableChange={setEvCableStatus}
            onAdapterChange={setEvAdapterStatus}
          />
        )}

        <NotesField value={notes} onChange={setNotes} tripState="form" />

        {user && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Logging as: <span className="font-semibold">{user.name ?? user.id}</span> · {user.role} · #{user.employeeId}
          </p>
        )}

        <button
          type="button" disabled={!canStart} onClick={handleStart}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition cursor-pointer"
        >
          Start Trip →
        </button>
      </div>
    );
  }

  if (liveState === 'in_transit') {
    return (
      <DriverLiveTransitView
        vehicleDetails={vehicleDetails}
        plate={plate}
        fromLabel={fromLabel}
        toLabel={toLabel}
        departureTime={departureTime}
        elapsed={elapsed}
        notes={notes}
        setNotes={setNotes}
        saveError={saveError}
        submitting={submitting}
        handleArrived={handleArrived}
        handleCancelTrip={handleCancelTrip}
      />
    );
  }

  return (
    <DriverLiveCompleteView
      vehicleDetails={vehicleDetails}
      plate={plate}
      fromLabel={fromLabel}
      toLabel={toLabel}
      departureTime={departureTime}
      arrivalTime={arrivalTime}
      notes={notes}
      handleReset={handleReset}
    />
  );
}
