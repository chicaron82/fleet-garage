import { useState } from 'react';
import { useVehicleHistory } from '../../hooks/useVehicleHistory';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { canRelease, canMarkRepaired, canManageVehicles, canClearSaleFlag } from '../../types';
import { VehicleEditSuggestionSheet } from './VehicleEditSuggestionSheet';
import { CloseExceptionAction } from './CloseExceptionAction';
import { hapticHeavy } from '../../lib/haptics';
import { StatusBadge } from '../holds/StatusBadge';
import { ReleaseForm } from '../holds/ReleaseForm';
import { VerbalOverrideForm } from '../holds/VerbalOverrideForm';
import { PhotoLightbox } from '../shared/PhotoLightbox';
import { VehicleEVAssets } from './VehicleEVAssets';
import { VehicleDirectEditModal } from './VehicleDirectEditModal';
import { VehicleArchiveModal } from './VehicleArchiveModal';
import { RepairConfirmSection } from '../holds/RepairConfirmSection';
import { HoldHistorySection } from '../holds/HoldHistorySection';
import { HoldShareMenu } from '../holds/HoldShareMenu';


interface Props {
  vehicleId: string;
  onBack: () => void;
  onNewHold: (vehicleId: string) => void;
}

function holdActionLabel(holdTypes: string[]): string {
  if (holdTypes.some(t => t === 'detail' || t === 'mechanical')) return 'Mark as Done';
  return 'Mark as Repaired';
}


export function VehicleHistory({ vehicleId, onBack, onNewHold }: Props) {
  const h = useVehicleHistory(vehicleId);
  const { releaseStreak, setCoverPhoto, archiveVehicle, updateVehicleEVAssets, directEditVehicleIdentity } = useVehicleHoldContext();
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showEditSuggestion, setShowEditSuggestion] = useState(false);
  const [showDirectEdit, setShowDirectEdit]   = useState(false);


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
          <div className="mt-4 flex gap-2 flex-wrap items-center">
            {(vehicle.status === 'RETURNED' || vehicle.status === 'PRE_EXISTING' || vehicle.status === 'CLEAR' || vehicle.status === 'HELD') && (
              <button
                onClick={() => onNewHold(vehicleId)}
                className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                {vehicle.status === 'HELD' ? '+ Add hold' : '+ Flag Issue'}
              </button>
            )}
            {/* Release on Exception — management only (renting a known-damaged car: a liability call) */}
            {canRelease(h.user.role) && h.activeHolds.length > 0 && (
              <button
                onClick={() => { hapticHeavy(); h.openReleaseAction(); }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                Approve Release{h.activeHolds.length > 1 ? ` (${h.activeHolds.length})` : ''}
              </button>
            )}
            {/* Mark Repaired / Done — VSAs + Lead VSAs can confirm a repair they can see at the washbay */}
            {canMarkRepaired(h.user.role) && h.repairableHolds.length > 0 && (
              <button
                onClick={h.openRepairAction}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                ✓ {h.repairableHolds.length === 1
                  ? holdActionLabel(h.repairableHolds[0].holdTypes)
                  : 'Mark as Done'}
              </button>
            )}
            {/* Non-management: verbal override + the release-gated notice (repair is handled above) */}
            {h.activeHolds.length > 0 && !canRelease(h.user.role) && (
              <>
                <button
                  onClick={() => h.openVerbalOverride(h.activeHolds[0].id)}
                  className="px-4 py-2 border-2 border-orange-400 dark:border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 font-semibold text-sm rounded-lg transition cursor-pointer"
                >
                  Log Verbal Override
                </button>
                <div className="px-4 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 text-sm rounded-lg">
                  Held — management approval required to release
                </div>
              </>
            )}
            {h.holds.length > 0 && (
              <HoldShareMenu vehicle={vehicle} holds={h.holds} getName={h.getName} getEmpId={h.getEmpId} />
            )}
          </div>

          {canClearSaleFlag(h.user.role) && h.saleHold && (
            <div className="mt-2">
              {!h.confirmClearSale ? (
                <button
                  type="button"
                  onClick={() => h.setConfirmClearSale(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-300 dark:border-orange-700 text-xs font-semibold text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition cursor-pointer"
                >
                  ↺ Clear sale flag — logged in error
                </button>
              ) : (
                <div className="rounded-lg border border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-900/20 px-4 py-3">
                  <p className="text-sm font-semibold text-orange-900 dark:text-orange-300">Clear the sale / auction flag?</p>
                  <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                    Returns this unit to rentable — use only if it was never a sale car. Management is notified.
                  </p>
                  {h.clearSaleError && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">Couldn't clear it — try again.</p>
                  )}
                  <div className="flex gap-2 justify-end mt-3">
                    <button
                      type="button"
                      onClick={() => h.setConfirmClearSale(false)}
                      disabled={h.clearingSale}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={h.handleClearSale}
                      disabled={h.clearingSale}
                      className="px-4 py-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-400 text-white rounded-lg transition cursor-pointer disabled:opacity-50"
                    >
                      {h.clearingSale ? 'Clearing…' : 'Clear flag'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <CloseExceptionAction holds={h.holds} role={h.user.role} />

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

        {h.showVerbalOverride && (
          <VerbalOverrideForm
            holdId={h.showVerbalOverride}
            onClose={h.closeVerbalOverride}
          />
        )}

        {h.showRepairConfirm && (() => {
          const ids = h.showRepairConfirm;
          const confirmHolds = h.holds.filter(hold => ids.includes(hold.id));
          if (confirmHolds.length === 0) return null;
          return (
            <RepairConfirmSection
              holds={confirmHolds}
              repairNotes={h.repairNotes}
              setRepairNotes={h.setRepairNotes}
              repairOutcome={h.repairOutcome}
              setRepairOutcome={h.setRepairOutcome}
              repairing={h.repairing}
              error={h.repairError}
              onCancel={h.cancelRepair}
              onConfirm={h.handleRepair}
            />
          );
        })()}

        <HoldHistorySection
          vehicle={vehicle}
          holds={h.holds}
          showHoldPicker={h.showHoldPicker}
          repairableHolds={h.repairableHolds}
          closeHoldPicker={h.closeHoldPicker}
          toggleRepairPick={h.toggleRepairPick}
          pickedForRepair={h.pickedForRepair}
          confirmRepairSelection={h.confirmRepairSelection}
          showReleasePicker={h.showReleasePicker}
          activeHolds={h.activeHolds}
          closeReleasePicker={h.closeReleasePicker}
          pickHoldForRelease={h.pickHoldForRelease}
          uploadingFor={h.uploadingFor}
          addPhotoClick={h.addPhotoClick}
          handlePhotoSelected={h.handlePhotoSelected}
          openLightbox={h.openLightbox}
          setCoverPhoto={setCoverPhoto}
          getName={h.getName}
          getEmpId={h.getEmpId}
          getRole={h.getRole}
        />
      </div>

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
