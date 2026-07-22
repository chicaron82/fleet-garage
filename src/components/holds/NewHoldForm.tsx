import { useRef, useCallback, useState } from 'react';
import { useNewHold } from '../../hooks/useNewHold';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useAuth } from '../../context/AuthContext';
import { useBarcodeInterceptor } from '../../hooks/useBarcodeInterceptor';
import { CameraBarcodeScanner } from '../shared/CameraBarcodeScanner';
import { hapticLight, hapticMedium, hapticHeavy } from '../../lib/haptics';
import { parseFleetBarcode } from '../../lib/barcode';
import { fmtRelativeDate } from '../../lib/lostFoundDate';
import { createOrEnrichRegistry } from '../../lib/vehicleRegistry';
import { canRelease } from '../../types';
import { NewHoldDetailsSection } from './NewHoldDetailsSection';


interface Props {
  vehicleId?: string;
  /** Bumped per scan so re-scanning the SAME tag re-selects the car (see Screen.prefillNonce). */
  prefillNonce?: number;
  onBack: () => void;
  onSuccess: (vehicleId: string) => void;
  onRegisterNew?: (prefill?: string) => void;
}

export function NewHoldForm({ vehicleId: preselectedId, prefillNonce, onBack, onSuccess, onRegisterNew }: Props) {
  const h = useNewHold(preselectedId, prefillNonce);
  const { getVehicleByUnit, vehicles, addVehicle } = useVehicleHoldContext();
  const { user } = useAuth();

  const selectVehicleAndLink = useCallback((vehicleId: string) => {
    h.selectVehicle(vehicleId);
    if (!user) return;
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;
    void createOrEnrichRegistry({
      branchId: user.branchId,
      vehicleId: vehicle.id,
      plate: vehicle.licensePlate,
      unitNumber: vehicle.unitNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
    });
  }, [h, user, vehicles]);
  const [creatingPlateOnly, setCreatingPlateOnly] = useState(false);

  const handleFlagUnknownPlate = async () => {
    if (!user) return;
    setCreatingPlateOnly(true);
    hapticLight();
    try {
      const vehicleId = await addVehicle({
        unitNumber:      null,
        licensePlate:    h.unitSearch.trim().toUpperCase(),
        make:            'Unknown',
        model:           'Unknown',
        year:            new Date().getFullYear(),
        color:           'Unknown',
        branchId:        user.branchId,
        isTesla:         false,
        hasMobileCable:  null,
        hasJ1772Adapter: null,
      });
      // undefined = dropped re-entrant tap (same plate in flight) — first tap selects.
      if (vehicleId) h.selectVehicle(vehicleId);
    } finally {
      setCreatingPlateOnly(false);
    }
  };

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const unitInputRef = useRef<HTMLInputElement>(null);

  const handleBarcodeUnit = useCallback((unit: string) => {
    const vehicle = getVehicleByUnit(unit);
    if (vehicle) {
      selectVehicleAndLink(vehicle.id);
    } else {
      h.setUnitSearch(unit.toUpperCase());
    }
  }, [getVehicleByUnit, h, selectVehicleAndLink]);

  const handleBarcodeUnrecognized = useCallback(() => {
    // No-op — existing "no results" UI handles unknown input
  }, []);

  const handleCameraDecode = useCallback((raw: string) => {
    const result = parseFleetBarcode(raw);
    if (result.ok) {
      handleBarcodeUnit(result.unit);
    }
    // unrecognized → no-op, existing UI handles it
  }, [handleBarcodeUnit]);

  useBarcodeInterceptor({
    inputRef: unitInputRef,
    onUnit: handleBarcodeUnit,
    onUnrecognized: handleBarcodeUnrecognized,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = await h.submit();
    if (id) {
      hapticMedium();
      onSuccess(id);
    } else {
      hapticHeavy();
    }
  };

  return (
    <div className="transition-colors">
      <nav className="bg-white dark:bg-gray-900 transition-colors border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer text-sm flex items-center gap-1"
        >
          ← Back
        </button>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Flag Issue</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Vehicle Selection */}
          <div className="bg-white dark:bg-gray-900 transition-colors rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
              Vehicle
            </h2>

            {h.selectedVehicle ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{h.selectedVehicle.unitNumber}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {h.selectedVehicle.year} {h.selectedVehicle.make} {h.selectedVehicle.model} · {h.selectedVehicle.color}
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Plate: {h.selectedVehicle.licensePlate}</p>
                  </div>
                  {!h.preselectedId && (
                    <button
                      type="button"
                      onClick={h.clearVehicle}
                      className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition cursor-pointer"
                    >
                      Change
                    </button>
                  )}
                </div>
                {/* Duplicate-type advisory beats the generic held note: name the
                    overlap + who/when, so a second flagger learns someone beat
                    them to this exact issue. Informs, never blocks. */}
                {h.duplicateTypeOverlaps.length > 0 ? (
                  <div className="mt-3 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs text-amber-700 dark:text-amber-400 space-y-1">
                    {h.duplicateTypeOverlaps.map(({ hold, types }) => (
                      <p key={hold.id}>
                        ⚠️ This unit already has an active <span className="font-semibold">{types.join(' + ')}</span> hold
                        — {hold.flaggedByName}, {fmtRelativeDate(hold.flaggedAt)}.
                      </p>
                    ))}
                    <p>Flag anyway if this is a separate issue — both must be resolved before it returns to fleet.</p>
                  </div>
                ) : h.alreadyHeld && (
                  <div className="mt-3 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                    This vehicle already has an active hold. You are adding a second hold — both must be resolved before it returns to fleet.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      ref={unitInputRef}
                      type="text"
                      placeholder="Search by unit # or plate…"
                      value={h.unitSearch}
                      onChange={e => h.setUnitSearch(e.target.value.toUpperCase())}
                      autoFocus
                      className="w-full px-3.5 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition uppercase"
                    />
                    {h.unitSearch && (
                      <button
                        onClick={() => h.setUnitSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-base leading-none cursor-pointer"
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <CameraBarcodeScanner onDecode={handleCameraDecode} />
                </div>
                {h.searchResults.length > 0 && (
                  <div className="space-y-1">
                    {h.searchResults.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => selectVehicleAndLink(v.id)}
                        className="w-full text-left px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-fg-yellow hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition text-sm cursor-pointer"
                      >
                        <span className="font-medium text-gray-900 dark:text-gray-100">{v.unitNumber}</span>
                        <span className="text-gray-400 dark:text-gray-500 mx-2">·</span>
                        <span className="text-gray-500 dark:text-gray-400">{v.licensePlate}</span>
                        <span className="text-gray-400 dark:text-gray-500 mx-2">·</span>
                        <span className="text-gray-500 dark:text-gray-400">{v.year} {v.make} {v.model}</span>
                      </button>
                    ))}
                  </div>
                )}
                {h.noResults && (
                  <div className="px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 transition-colors rounded-lg border border-gray-200 dark:border-gray-800 space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">"{h.unitSearch}" not in the system.</p>
                    <button
                      type="button"
                      onClick={handleFlagUnknownPlate}
                      disabled={creatingPlateOnly}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 transition cursor-pointer disabled:opacity-50"
                    >
                      {creatingPlateOnly ? 'Setting up…' : '🚨 Flag damage on this plate →'}
                    </button>
                    {onRegisterNew && user && canRelease(user.role) && (
                      <button
                        type="button"
                        onClick={() => onRegisterNew(h.unitSearch)}
                        className="block text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer"
                      >
                        + Register vehicle (management)
                      </button>
                    )}
                  </div>
                )}
                {h.unitSearch.trim().length < 2 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">Type at least 2 characters to search.</p>
                )}
              </div>
            )}
          </div>

          {/* Hold Details */}
          {h.selectedVehicle && (
            <NewHoldDetailsSection h={h} cameraInputRef={cameraInputRef} galleryInputRef={galleryInputRef} />
          )}

          {/* Submit error */}
          {h.submitError && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-900 dark:text-amber-300">
              {h.submitError}
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!h.canSubmit}
              className="flex-1 py-3 bg-fg-yellow hover:bg-fg-yellow-hi disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 text-black font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
            >
              {h.submitting ? 'Flagging…' : 'Flag Issue'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
