import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { hapticLight } from '../../lib/haptics';
import { NotesField } from './VSATripComponents';
import { EVAssetCheck } from './EVAssetCheck';
import type { TripRun } from '../../data/trips';
import type { RentalClass } from '../../data/manifest';
import { PriorityHint } from './PriorityHint';
import { DriverLiveTransitView } from './DriverLiveTransitView';
import { DriverLiveCompleteView } from './DriverLiveCompleteView';
import { useDriverLiveTrip, LOCATIONS } from '../../hooks/useDriverLiveTrip';
import { PlateInput } from '../shared/VehicleFields';

interface Props {
  flaggedClasses: RentalClass[];
  onTripComplete: (trip: TripRun) => void;
}

export function DriverLiveForm({ flaggedClasses, onTripComplete }: Props) {
  const { user } = useAuth();
  const { shuttlePlate } = useVehicleHoldContext();

  const trip = useDriverLiveTrip({ user, onTripComplete });

  if (trip.phase === 'form') {
    const {
      routeStep, from, to, customFrom, customTo,
      plate, isShuttle, notes, isTeslaRun,
      evCableStatus, evAdapterStatus,
      plateSuggestions, showSuggestions,
      fromLabel, toLabel, canStart, submitting, saveError,
      setFormField,
      handleStart, handleLocationTap, handleRouteReset,
      handlePlateBlur, handleSuggestionSelect, handleReset,
    } = trip;

    const setPlate           = setFormField('plate');
    const setCustomFrom      = setFormField('customFrom');
    const setCustomTo        = setFormField('customTo');
    const setIsShuttle       = setFormField('isShuttle');
    const setNotes           = setFormField('notes');
    const setShowSuggestions = setFormField('showSuggestions');
    const setIsTeslaRun      = setFormField('isTeslaRun');
    const setEvCableStatus   = setFormField('evCableStatus');
    const setEvAdapterStatus = setFormField('evAdapterStatus');

    return (
      <div className="space-y-4">
        <PriorityHint flaggedClasses={flaggedClasses} />

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
                      ? 'border-fg-yellow bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100'
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
                name="trip-origin" autoComplete="off" spellCheck={false}
                onChange={e => setCustomFrom(e.target.value)}
                className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition"
              />
              <button
                type="button" onClick={handleRouteReset} aria-label="Clear origin"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none"
              >×</button>
            </div>
          )}
          {routeStep === 'confirmed' && to === 'Other' && (
            <div className="relative">
              <input
                type="text" autoFocus placeholder="Specify destination…" value={customTo}
                name="trip-destination" autoComplete="off" spellCheck={false}
                onChange={e => setCustomTo(e.target.value)}
                className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition"
              />
              <button
                type="button"
                onClick={() => { hapticLight(); handleRouteReset(); }}
                aria-label="Clear destination"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none"
              >×</button>
            </div>
          )}
        </div>

        {/* License Plate */}
        <div className="relative z-10">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">License Plate *</label>
          <PlateInput
            placeholder="e.g. JFT 881" value={plate}
            name="license-plate" autoComplete="off" spellCheck={false}
            onValueChange={val => {
              setPlate(val);
              if (shuttlePlate) setIsShuttle(val.trim() === shuttlePlate.toUpperCase().trim());
              if (!val) setShowSuggestions(false);
            }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 200);
              handlePlateBlur();
            }}
            onFocus={() => { if (plateSuggestions.length > 0) setShowSuggestions(true); }}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition"
          />
          {showSuggestions && plateSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-[68px] bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
              {plateSuggestions.map(v => (
                <button
                  key={v.license_plate} type="button"
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
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isShuttle ? 'bg-fg-yellow border-fg-yellow text-black' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'}`}>
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
            <label className="flex items-center gap-2 cursor-pointer group" onClick={() => { hapticLight(); setIsTeslaRun((v: boolean) => !v); }}>
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

        {saveError && (
          <p className="text-xs text-red-500 dark:text-red-400 text-center">Couldn't save — check connection and try again.</p>
        )}

        <button
          type="button" disabled={!canStart || submitting} onClick={handleStart}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition cursor-pointer"
        >
          Start Trip →
        </button>

        {!canStart && (
          <button
            type="button" onClick={handleReset}
            className="w-full text-center text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer py-1"
          >
            Clear form
          </button>
        )}
      </div>
    );
  }

  if (trip.phase === 'in_transit') {
    return (
      <DriverLiveTransitView
        vehicleDetails={trip.vehicleDetails}
        plate={trip.plate}
        fromLabel={trip.fromLabel}
        toLabel={trip.toLabel}
        departureTime={trip.departureTime}
        elapsed={trip.elapsed}
        notes={trip.notes}
        setNotes={trip.setNotes}
        saveError={trip.saveError}
        submitting={trip.submitting}
        handleArrived={trip.handleArrived}
        handleCancelTrip={trip.handleCancelTrip}
      />
    );
  }

  return (
    <DriverLiveCompleteView
      vehicleDetails={trip.vehicleDetails}
      plate={trip.plate}
      fromLabel={trip.fromLabel}
      toLabel={trip.toLabel}
      departureTime={trip.departureTime}
      arrivalTime={trip.arrivalTime}
      notes={trip.notes}
      handleReset={trip.handleReset}
    />
  );
}
