import { useRef, useState } from 'react';
import { useVehicleHistory } from '../hooks/useVehicleHistory';
import { useGarage } from '../context/GarageContext';
import { canRelease, canManageVehicles } from '../types';
import { VehicleEditSuggestionSheet } from './VehicleEditSuggestionSheet';
import { hapticHeavy, hapticLight } from '../lib/haptics';
import { StatusBadge } from './StatusBadge';
import { holdTypePillClass, getTireSwapSeason } from '../lib/holdBadge';
import { ReleaseForm } from './ReleaseForm';
import { VerbalOverrideForm } from './VerbalOverrideForm';
import { HoldRecordFooter } from './HoldRecordFooter';
import { PhotoLightbox } from './PhotoLightbox';
import { VehicleEVAssets } from './VehicleEVAssets';
import { VehicleDirectEditModal } from './VehicleDirectEditModal';
import { VehicleArchiveModal } from './VehicleArchiveModal';
import { RepairConfirmSection } from './RepairConfirmSection';


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

function holdActionLabel(holdTypes: string[]): string {
  if (holdTypes.some(t => t === 'detail' || t === 'mechanical')) return 'Mark as Done';
  return 'Mark as Repaired';
}



export function VehicleHistory({ vehicleId, onBack, onNewHold }: Props) {
  const h = useVehicleHistory(vehicleId);
  const { releaseStreak, setCoverPhoto, archiveVehicle, updateVehicleEVAssets, directEditVehicleIdentity } = useGarage();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showEditSuggestion, setShowEditSuggestion] = useState(false);
  const [showDirectEdit, setShowDirectEdit]   = useState(false);
  const [editUnit,        setEditUnit]         = useState('');
  const [editPlate,       setEditPlate]        = useState('');
  const [editSaving,      setEditSaving]       = useState(false);

  const { vehicle } = h;
  if (!vehicle) return null;

  const streak = releaseStreak(vehicleId);

  return (
    <>
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
        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
          {vehicle.unitNumber ?? <span className="text-gray-400 italic">Unit # pending</span>}
        </span>
        <StatusBadge status={vehicle.status} />
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Vehicle Card */}
        <div className="bg-white dark:bg-gray-900 transition-colors rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {vehicle.unitNumber ?? <span className="text-gray-400 dark:text-gray-500 italic font-normal text-lg">Unit # pending</span>}
                </h1>
                {vehicle.editStatus !== 'pending' && (
                  <button
                    onClick={() => {
                      if (canManageVehicles(h.user.role)) {
                        setEditUnit(vehicle.unitNumber ?? '');
                        setEditPlate(vehicle.licensePlate);
                        setShowDirectEdit(true);
                      } else {
                        setShowEditSuggestion(true);
                      }
                    }}
                    title={canManageVehicles(h.user.role) ? 'Edit identity' : 'Suggest identity edit'}
                    className="text-gray-300 dark:text-gray-600 hover:text-amber-500 dark:hover:text-amber-400 transition-colors cursor-pointer text-base leading-none"
                  >
                    ✏️
                  </button>
                )}
              </div>
              <p className="text-base text-gray-500 dark:text-gray-400 mt-0.5">{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color}</p>
              <p className="text-base text-gray-400 dark:text-gray-500 mt-0.5">Plate: {vehicle.licensePlate}</p>
              {vehicle.editStatus === 'pending' && (
                <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  Edit pending approval
                </span>
              )}
              {vehicle.editStatus === 'denied' && (
                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  Edit denied.{' '}
                  <button
                    onClick={() => setShowEditSuggestion(true)}
                    className="underline text-amber-600 dark:text-amber-400 cursor-pointer hover:text-amber-800 dark:hover:text-amber-300"
                  >
                    Submit a new suggestion
                  </button>
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <StatusBadge status={vehicle.status} />
              {streak >= 2 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  streak >= 3
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                }`}>
                  {streak}× released unrepaired
                </span>
              )}
            </div>
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
            {canRelease(h.user.role) && (
              <>
                {h.activeHold && (
                  <button
                    onClick={() => { hapticHeavy(); h.openReleaseForm(h.activeHold!.id); }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
                  >
                    Approve Release
                  </button>
                )}
                {h.repairableHolds.length > 0 && (
                  <button
                    onClick={h.openRepairAction}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
                  >
                    ✓ {h.repairableHolds.length === 1
                      ? holdActionLabel(h.repairableHolds[0].holdTypes)
                      : 'Mark as Done'}
                  </button>
                )}
              </>
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
          {canManageVehicles(h.user.role) && !vehicle.archivedAt && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(true)}
                className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer"
              >
                Archive vehicle
              </button>
            </div>
          )}
        </div>

        <VehicleEVAssets
          vehicle={vehicle}
          userRole={h.user.role}
          updateVehicleEVAssets={updateVehicleEVAssets}
        />

        {showArchiveConfirm && (
          <VehicleArchiveModal
            vehicleId={vehicle.id}
            unitNumber={vehicle.unitNumber}
            onClose={() => setShowArchiveConfirm(false)}
            onBack={onBack}
            archiveVehicle={archiveVehicle}
          />
        )}
        {h.showReleaseForm && (
          <ReleaseForm
            holdId={h.showReleaseForm}
            vehicleId={vehicleId}
            onClose={h.closeReleaseForm}
            streak={streak}
          />
        )}

        {/* Verbal Override Form */}
        {h.showVerbalOverride && (
          <VerbalOverrideForm
            holdId={h.showVerbalOverride}
            onClose={h.closeVerbalOverride}
          />
        )}

        {h.showRepairConfirm && (() => {
          const confirmHold = h.holds.find(hold => hold.id === h.showRepairConfirm);
          if (!confirmHold) return null;
          return (
            <RepairConfirmSection
              hold={confirmHold}
              repairNotes={h.repairNotes}
              setRepairNotes={h.setRepairNotes}
              repairOutcome={h.repairOutcome}
              setRepairOutcome={h.setRepairOutcome}
              repairing={h.repairing}
              onCancel={h.cancelRepair}
              onConfirm={h.handleRepair}
            />
          );
        })()}

        {/* Hold Picker — shown when multiple holds are repairable */}
        {h.showHoldPicker && (
          <>
            <div className="fixed inset-0 bg-black/50 z-40" onClick={h.closeHoldPicker} />
            <div className="fixed inset-x-0 bottom-0 z-50 p-4">
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden max-w-sm mx-auto">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Which hold are you resolving?
                  </p>
                  <button
                    type="button"
                    onClick={h.closeHoldPicker}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none cursor-pointer"
                  >
                    ×
                  </button>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {h.repairableHolds.map(hold => (
                    <button
                      key={hold.id}
                      type="button"
                      onClick={() => h.pickHoldForRepair(hold.id)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                          {hold.damageDescription}
                        </p>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          hold.status === 'ACTIVE'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        }`}>
                          {hold.status === 'ACTIVE' ? 'ACTIVE' : 'RELEASED'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {hold.holdTypes.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')} · {fmt(hold.flaggedAt)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
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
                      <p className="text-base font-medium text-gray-900 dark:text-gray-100">{hold.damageDescription}</p>
                      {(hold.holdTypes.length > 1 || hold.holdTypes[0] !== 'damage') && hold.holdTypes.map(type => (
                        <span key={type} className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${holdTypePillClass(type)}`}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </span>
                      ))}
                      {hold.mechanicalSubType === 'tire-swap' && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          {getTireSwapSeason()} Tire Swap
                        </span>
                      )}
                      {hold.mechanicalSubType === 'tire-repair' && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          🛞 Tire Repair
                        </span>
                      )}
                      {hold.mechanicalSubType === 'pm-due' && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          ⚙️ PM Due
                        </span>
                      )}
                      {hold.branchId !== vehicle.branchId && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                          🛫 Flagged at {hold.branchId}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={hold.status} holdTypes={hold.holdTypes} mechanicalSubType={hold.mechanicalSubType} />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{vehicle.unitNumber}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Flagged by <span className="font-medium text-gray-700 dark:text-gray-300">{h.getName(hold.flaggedById, hold.flaggedByName)}</span>
                    {' '}· {h.getEmpId(hold.flaggedById, hold.flaggedByEmployeeId)} · {fmt(hold.flaggedAt)}
                  </p>
                  {hold.notes && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1.5 italic">"{hold.notes}"</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2 items-center">
                    {(hold.photos ?? []).map((src, i) => {
                      const isCover = vehicle.coverPhotoUrl === src;
                      return (
                        <div key={i} className="relative">
                          <button
                            type="button"
                            onClick={() => h.openLightbox(hold.photos ?? [], i)}
                            className="cursor-pointer block"
                          >
                            <img
                              src={src}
                              alt={`Damage photo ${i + 1}`}
                              className="w-14 h-14 object-cover rounded-lg border border-gray-200 dark:border-gray-800 hover:opacity-80 transition"
                            />
                          </button>
                          <button
                            type="button"
                            title={isCover ? 'Remove card photo' : 'Set as card photo'}
                            onClick={() => setCoverPhoto(vehicle.id, isCover ? null : src)}
                            className={`absolute bottom-0.5 right-0.5 w-5 h-5 rounded text-[10px] flex items-center justify-center transition cursor-pointer ${
                              isCover
                                ? 'bg-yellow-400 text-black'
                                : 'bg-black/50 text-white hover:bg-black/70'
                            }`}
                          >
                            📌
                          </button>
                        </div>
                      );
                    })}
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
      {h.lightboxPhotos.length > 0 && (
        <PhotoLightbox
          photos={h.lightboxPhotos}
          initialIndex={h.lightboxIndex}
          onClose={h.closeLightbox}
        />
      )}
    </div>

    {showEditSuggestion && (
      <VehicleEditSuggestionSheet
        vehicle={vehicle}
        onClose={() => setShowEditSuggestion(false)}
      />
    )}

    {showDirectEdit && (
      <VehicleDirectEditModal
        vehicleId={vehicleId}
        initialUnitNumber={vehicle.unitNumber}
        initialLicensePlate={vehicle.licensePlate}
        onClose={() => setShowDirectEdit(false)}
        directEditVehicleIdentity={directEditVehicleIdentity}
      />
    )}
    </>
  );
}
