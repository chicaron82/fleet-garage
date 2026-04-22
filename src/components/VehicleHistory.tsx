import { useRef } from 'react';
import { useVehicleHistory } from '../hooks/useVehicleHistory';
import { canRelease } from '../types';
import { StatusBadge } from './StatusBadge';
import { ReleaseForm } from './ReleaseForm';
import { VerbalOverrideForm } from './VerbalOverrideForm';
import { HoldRecordFooter } from './HoldRecordFooter';

interface Props {
  vehicleId: string;
  onBack: () => void;
  onNewHold: (vehicleId: string) => void;
}

const MAX_PHOTOS = 4;

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function VehicleHistory({ vehicleId, onBack, onNewHold }: Props) {
  const h = useVehicleHistory(vehicleId);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const { vehicle } = h;
  if (!vehicle) return null;

  return (
    <div className="transition-colors">
      {/* Nav */}
      <nav className="bg-white dark:bg-gray-900 transition-colors border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button
          onClick={onBack}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer text-sm flex items-center gap-1"
        >
          ← Back
        </button>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{vehicle.unitNumber}</span>
        <StatusBadge status={vehicle.status} />
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Vehicle Card */}
        <div className="bg-white dark:bg-gray-900 transition-colors rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{vehicle.unitNumber}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color}</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Plate: {vehicle.licensePlate}</p>
            </div>
            <StatusBadge status={vehicle.status} />
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-2 flex-wrap">
            {(vehicle.status === 'RETURNED' || vehicle.status === 'PRE_EXISTING' || vehicle.status === 'CLEAR') && (
              <button
                onClick={() => onNewHold(vehicleId)}
                className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                + Flag Issue
              </button>
            )}
            {h.activeHold && canRelease(h.user.role) && (
              <>
                <button
                  onClick={() => h.openReleaseForm(h.activeHold!.id)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
                >
                  Approve Release
                </button>
                <button
                  onClick={() => h.openRepairConfirm(h.activeHold!.id)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
                >
                  ✓ Mark as Repaired
                </button>
              </>
            )}
            {!h.activeHold && h.repairableHold && canRelease(h.user.role) && (
              <button
                onClick={() => h.openRepairConfirm(h.repairableHold!.id)}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                ✓ Mark as Repaired
              </button>
            )}
            {h.activeHold && !canRelease(h.user.role) && (
              <>
                <button
                  onClick={() => h.openVerbalOverride(h.activeHold!.id)}
                  className="px-4 py-2 border-2 border-orange-400 dark:border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 font-semibold text-sm rounded-lg transition cursor-pointer"
                >
                  Log Verbal Override
                </button>
                <div className="px-4 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 text-sm rounded-lg">
                  Held — management approval required to release
                </div>
              </>
            )}
          </div>
        </div>

        {/* Release Form */}
        {h.showReleaseForm && (
          <ReleaseForm
            holdId={h.showReleaseForm}
            vehicleId={vehicleId}
            onClose={h.closeReleaseForm}
          />
        )}

        {/* Verbal Override Form */}
        {h.showVerbalOverride && (
          <VerbalOverrideForm
            holdId={h.showVerbalOverride}
            onClose={h.closeVerbalOverride}
          />
        )}

        {/* Repair Confirm */}
        {h.showRepairConfirm && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800/40 p-5 space-y-4">
            <h2 className="text-xs font-semibold text-green-800 dark:text-green-300 uppercase tracking-widest">
              Confirm Repair
            </h2>
            <p className="text-sm text-green-900 dark:text-green-200">
              This marks the damage as fully repaired. The vehicle will be set to <strong>Clear</strong> and returned to service.
            </p>
            <div>
              <label className="block text-xs font-medium text-green-800 dark:text-green-300 mb-1.5 uppercase tracking-wide">
                Notes (optional)
              </label>
              <textarea
                rows={2}
                placeholder="Repair details, shop, completion date…"
                value={h.repairNotes}
                onChange={e => h.setRepairNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-green-300 dark:border-green-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={h.cancelRepair}
                className="flex-1 py-2.5 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 font-medium text-sm rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={h.repairing}
                onClick={h.handleRepair}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
              >
                {h.repairing ? 'Saving…' : 'Confirm Repair'}
              </button>
            </div>
          </div>
        )}

        {/* Damage History */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
            Hold History · {h.holds.length} record{h.holds.length !== 1 ? 's' : ''}
          </h2>

          {h.holds.length === 0 && (
            <div className="bg-white dark:bg-gray-900 transition-colors rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm">No damage records on file. Clean history.</p>
            </div>
          )}

          <div className="space-y-3">
            {h.holds.map(hold => (
              <div key={hold.id} className="bg-white dark:bg-gray-900 transition-colors rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                {/* Hold Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{hold.damageDescription}</p>
                      {hold.holdType === 'mechanical' && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                          Mechanical
                        </span>
                      )}
                      {hold.holdType === 'detail' && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
                          Detail
                        </span>
                      )}
                    </div>
                    <StatusBadge status={hold.status} />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{vehicle.unitNumber}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Flagged by <span className="font-medium text-gray-700 dark:text-gray-300">{h.getName(hold.flaggedById)}</span>
                    {' '}· {h.getEmpId(hold.flaggedById)} ({h.getRole(hold.flaggedById)}) · {fmt(hold.flaggedAt)}
                  </p>
                  {hold.notes && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 italic">"{hold.notes}"</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2 items-center">
                    {(hold.photos ?? []).map((src, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => h.setLightboxSrc(src)}
                        className="cursor-pointer"
                      >
                        <img
                          src={src}
                          alt={`Damage photo ${i + 1}`}
                          className="w-14 h-14 object-cover rounded-lg border border-gray-200 dark:border-gray-800 hover:opacity-80 transition"
                        />
                      </button>
                    ))}
                    {(hold.photos ?? []).length < MAX_PHOTOS && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => h.addPhotoClick(hold.id, cameraInputRef)}
                          disabled={h.uploadingFor === hold.id}
                          className="h-14 px-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {h.uploadingFor === hold.id ? (
                            <span className="text-xs">…</span>
                          ) : (
                            <>
                              <span className="text-lg leading-none">📷</span>
                              <span className="text-[10px] uppercase tracking-wider font-semibold leading-none">Camera</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => h.addPhotoClick(hold.id, galleryInputRef)}
                          disabled={h.uploadingFor === hold.id}
                          className="h-14 px-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {h.uploadingFor === hold.id ? (
                            <span className="text-xs">…</span>
                          ) : (
                            <>
                              <span className="text-lg leading-none">🖼️</span>
                              <span className="text-[10px] uppercase tracking-wider font-semibold leading-none">Gallery</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <HoldRecordFooter
                  hold={hold}
                  getName={h.getName}
                  getRole={h.getRole}
                  getEmpId={h.getEmpId}
                  fmt={fmt}
                  fmtDate={fmtDate}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hidden photo inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={h.handlePhotoSelected}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={h.handlePhotoSelected}
        className="hidden"
      />

      {/* Lightbox */}
      {h.lightboxSrc && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => h.setLightboxSrc(null)}
        >
          <img
            src={h.lightboxSrc}
            alt="Damage photo"
            className="max-w-full max-h-full rounded-xl object-contain"
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl leading-none opacity-70 hover:opacity-100 transition cursor-pointer"
            onClick={() => h.setLightboxSrc(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
