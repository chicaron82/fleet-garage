import { useRef, useCallback } from 'react';
import { useNewHold } from '../hooks/useNewHold';
import { useGarage } from '../context/GarageContext';
import { useBarcodeInterceptor } from '../hooks/useBarcodeInterceptor';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { parseFleetBarcode } from '../lib/barcode';
import { DETAIL_REASON_LABELS } from '../types';
import type { DetailReason } from '../types';

interface Props {
  vehicleId?: string;
  onBack: () => void;
  onSuccess: (vehicleId: string) => void;
  onRegisterNew?: (prefill?: string) => void;
}

const MECHANICAL_PRESETS = [
  'PM due',
  'Tire repair needed',
  'Low tread',
  'Check engine light',
  'Brake service needed',
  'Battery concern',
  'AC / heat issue',
  'Wiper replacement',
  'Other',
];

const DAMAGE_PRESETS = [
  'Scratch — paint surface',
  'Scratch — to bare metal',
  'Dent — minor (no paint break)',
  'Dent — major / crumple',
  'Cracked windshield',
  'Windshield chip',
  'Windshield chip — repaired (scar remaining)',
  'Broken glass (window / mirror)',
  'Bumper damage — cosmetic',
  'Bumper damage — structural',
  'Rim / hubcap damage',
  'Interior stain',
  'Interior damage (seat / trim)',
  'Mechanical concern',
  'Missing part / accessory',
  'Tire damage / flat',
  'Other',
];

export function NewHoldForm({ vehicleId: preselectedId, onBack, onSuccess, onRegisterNew }: Props) {
  const h = useNewHold(preselectedId);
  const { getVehicleByUnit } = useGarage();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const unitInputRef = useRef<HTMLInputElement>(null);

  const handleBarcodeUnit = useCallback((unit: string) => {
    const vehicle = getVehicleByUnit(unit);
    if (vehicle) {
      h.selectVehicle(vehicle.id);
    } else {
      h.setUnitSearch(unit.toUpperCase());
    }
  }, [getVehicleByUnit, h]);

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
    if (id) onSuccess(id);
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
                {h.alreadyHeld && (
                  <div className="mt-3 px-3 py-2.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 rounded-lg text-xs text-red-700 dark:text-red-400">
                    This vehicle already has an active hold. Only one active hold per vehicle is allowed.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    ref={unitInputRef}
                    type="text"
                    placeholder="Search by unit # or plate…"
                    value={h.unitSearch}
                    onChange={e => h.setUnitSearch(e.target.value.toUpperCase())}
                    autoFocus
                    className="flex-1 px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition uppercase"
                  />
                  <CameraBarcodeScanner onDecode={handleCameraDecode} />
                </div>
                {h.searchResults.length > 0 && (
                  <div className="space-y-1">
                    {h.searchResults.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => h.selectVehicle(v.id)}
                        className="w-full text-left px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-yellow-400 hover:bg-yellow-50 transition text-sm cursor-pointer"
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
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 transition-colors rounded-lg border border-gray-200 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">"{h.unitSearch}" not in the system.</p>
                    {onRegisterNew && (
                      <button
                        type="button"
                        onClick={() => onRegisterNew(h.unitSearch)}
                        className="text-xs font-semibold text-yellow-600 hover:text-yellow-800 transition cursor-pointer whitespace-nowrap ml-3"
                      >
                        + Add to ledger →
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
          {h.selectedVehicle && !h.alreadyHeld && (
            <div className="bg-white dark:bg-gray-900 transition-colors rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                What are you flagging?
              </h2>

              {/* Hold Type Toggle */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => h.switchHoldType('damage')}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer text-left ${
                    h.holdType === 'damage'
                      ? 'border-yellow-400 bg-yellow-50 text-gray-900 dark:text-gray-100'
                      : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                  }`}
                >
                  <span className="block font-semibold">Damage</span>
                  <span className="block text-xs opacity-70 mt-0.5">Dents, scratches…</span>
                </button>
                <button
                  type="button"
                  onClick={() => h.switchHoldType('detail')}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer text-left ${
                    h.holdType === 'detail'
                      ? 'border-yellow-400 bg-yellow-50 text-gray-900 dark:text-gray-100'
                      : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                  }`}
                >
                  <span className="block font-semibold">Detail</span>
                  <span className="block text-xs opacity-70 mt-0.5">Pet hair, smoke…</span>
                </button>
                <button
                  type="button"
                  onClick={() => h.switchHoldType('mechanical')}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer text-left ${
                    h.holdType === 'mechanical'
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-gray-100'
                      : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                  }`}
                >
                  <span className="block font-semibold">Mechanical</span>
                  <span className="block text-xs opacity-70 mt-0.5">PM, tires, repairs…</span>
                </button>
              </div>

              {/* Damage Type */}
              {h.holdType === 'damage' && (
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Damage Type *
                  </label>
                  {h.damageTypes.length > 0 && (
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                      {h.damageTypes.length} selected
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {DAMAGE_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => h.toggleDamageType(preset)}
                      className={`text-left px-3 py-2 rounded-lg border text-sm transition cursor-pointer ${
                        h.damageTypes.includes(preset)
                          ? 'border-yellow-400 bg-yellow-50 text-gray-900 dark:text-gray-100 font-medium'
                          : 'border-gray-200 dark:border-gray-800 text-gray-600 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                {h.damageTypes.includes('Other') && (
                  <input
                    type="text"
                    placeholder="Describe the damage…"
                    value={h.customDamage}
                    onChange={e => h.setCustomDamage(e.target.value)}
                    className="mt-2 w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
                  />
                )}
              </div>
              )}

              {/* Detail Reason */}
              {h.holdType === 'detail' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  Detail Reason *
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.entries(DETAIL_REASON_LABELS) as [DetailReason, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => h.setDetailReason(key)}
                      className={`text-left px-3 py-2.5 rounded-lg border text-sm transition cursor-pointer ${
                        h.detailReason === key
                          ? 'border-yellow-400 bg-yellow-50 text-gray-900 dark:text-gray-100 font-medium'
                          : 'border-gray-200 dark:border-gray-800 text-gray-600 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Mechanical Type */}
              {h.holdType === 'mechanical' && (
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Concern *
                  </label>
                  {h.mechanicalTypes.length > 0 && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      {h.mechanicalTypes.length} selected
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {MECHANICAL_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => h.toggleMechanicalType(preset)}
                      className={`text-left px-3 py-2 rounded-lg border text-sm transition cursor-pointer ${
                        h.mechanicalTypes.includes(preset)
                          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-gray-100 font-medium'
                          : 'border-gray-200 dark:border-gray-800 text-gray-600 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                {h.mechanicalTypes.includes('Other') && (
                  <input
                    type="text"
                    placeholder="Describe the concern…"
                    value={h.customMechanical}
                    onChange={e => h.setCustomMechanical(e.target.value)}
                    className="mt-2 w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                  />
                )}
              </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  Notes (optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Location, customer context, circumstances…"
                  value={h.notes}
                  onChange={e => h.setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition resize-none"
                />
              </div>

              {/* Photos */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  Photos (optional · max {h.MAX_PHOTOS})
                </label>
                <div className="flex flex-wrap gap-2">
                  {h.photos.map((src, i) => (
                    <div key={i} className="relative">
                      <img
                        src={src}
                        alt={`Damage photo ${i + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-800"
                      />
                      <button
                        type="button"
                        onClick={() => h.removePhoto(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center cursor-pointer leading-none transition"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {h.photos.length < h.MAX_PHOTOS && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="h-20 px-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-1"
                      >
                        <span className="text-lg leading-none">📷</span>
                        <span className="text-xs font-medium">Take Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="h-20 px-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-1"
                      >
                        <span className="text-lg leading-none">🖼️</span>
                        <span className="text-xs font-medium">Upload from Gallery</span>
                      </button>
                    </div>
                  )}
                </div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={h.handlePhotoAdd}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={h.handlePhotoAdd}
                  className="hidden"
                />
              </div>

              {/* Flagging as */}
              <div className="bg-gray-50 dark:bg-gray-950 transition-colors rounded-lg px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                Flagging as <span className="font-medium text-gray-700 dark:text-gray-300">{h.user.name}</span> · {h.user.role}
              </div>
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
              className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 text-black font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
            >
              {h.submitting ? 'Flagging…' : 'Flag Issue'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
