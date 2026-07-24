import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { compressImage } from '../lib/image';
import { useUserResolver } from './useUserResolver';
import { hapticMedium } from '../lib/haptics';
import { isClearableSaleFlag } from '../lib/holdGrouping';
import type { Hold, RepairOutcome } from '../types';

export function useVehicleHistory(vehicleId: string) {
  const { user } = useAuth();
  const { getVehicle, getHoldsForVehicle, getActiveHold, getActiveHolds, addPhotosToHold, markRepaired, markRepairedBatch, markIssueRepaired, clearSaleHold, syncVehicleStatus } = useVehicleHoldContext();
  const [showReleaseForm, setShowReleaseForm] = useState<string | null>(null);
  const [showVerbalOverride, setShowVerbalOverride] = useState<string | null>(null);
  // The hold(s) being repaired in the confirm step — an array so one confirm can
  // resolve several at once (the multi-select picker). `pickedForRepair` is the
  // in-progress checkbox selection inside the picker, before confirm.
  const [showRepairConfirm, setShowRepairConfirm] = useState<string[] | null>(null);
  const [pickedForRepair, setPickedForRepair] = useState<string[]>([]);
  const [repairNotes, setRepairNotes] = useState('');
  const [repairOutcome, setRepairOutcome] = useState<RepairOutcome>('clean');
  const [repairing, setRepairing] = useState(false);
  const [repairError, setRepairError] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const pendingHoldId = useRef<string | null>(null);

  const syncedRef = useRef(false);
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    void syncVehicleStatus(vehicleId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const vehicle = getVehicle(vehicleId);
  const holds = getHoldsForVehicle(vehicleId);
  const activeHold = getActiveHold(vehicleId);
  const activeHolds = getActiveHolds(vehicleId);

  // The sale_car hold on this vehicle that a "clear logged in error" could still undo.
  //
  // Any UNRESOLVED state qualifies. v1 matched only ACTIVE or a still-out EXCEPTION, which meant
  // the affordance vanished the moment a short-term rental came back (`RETURNED`) — exactly when
  // someone finally notices the flag was wrong, so the mistake stuck to the record permanently
  // (unit 5424395, 2026-07-23: plates pulled off the fence on an assumption, flag correct-able
  // only until the car returned). Sale cars legitimately go back out on short term when fleet is
  // tight, so returning is normal, not a resolution.
  //
  // VOIDED is already cleared and REPAIRED is a genuine resolution — neither needs the button.
  const saleHold = holds.find(
    h => h.vehicleId === vehicle?.id && isClearableSaleFlag(h)
  ) ?? null;
  const [confirmClearSale, setConfirmClearSale] = useState(false);
  const [clearingSale, setClearingSale] = useState(false);
  const [clearSaleError, setClearSaleError] = useState(false);

  // All holds currently eligible for the repair action:
  // ACTIVE holds always eligible; RELEASED holds eligible if not yet repaired.
  const repairableHolds: Hold[] = holds.filter(
    h => h.vehicleId === vehicle?.id &&
      (h.status === 'ACTIVE' || (h.status === 'RELEASED' && !h.repair))
  );

  const [showHoldPicker,    setShowHoldPicker]    = useState(false);
  const [showReleasePicker, setShowReleasePicker] = useState(false);

  const addPhotoClick = (holdId: string, ref: React.RefObject<HTMLInputElement | null>) => {
    pendingHoldId.current = holdId;
    ref.current?.click();
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !pendingHoldId.current) return;
    const holdId = pendingHoldId.current;
    setUploadingFor(holdId);
    const compressed = await Promise.all(files.map(compressImage));
    await addPhotosToHold(holdId, compressed);
    setUploadingFor(null);
    e.target.value = '';
  };

  const openReleaseForm = (holdId: string) => {
    setShowReleaseForm(holdId);
    setShowVerbalOverride(null);
    setShowRepairConfirm(null);
  };

  const openVerbalOverride = (holdId: string) => {
    setShowVerbalOverride(holdId);
    setShowReleaseForm(null);
    setShowRepairConfirm(null);
  };

  const openRepairConfirm = (holdId: string) => {
    setShowRepairConfirm([holdId]);
    setShowReleaseForm(null);
    setShowVerbalOverride(null);
    setShowHoldPicker(false);
  };

  const openRepairAction = () => {
    if (repairableHolds.length === 1) {
      openRepairConfirm(repairableHolds[0].id);
    } else if (repairableHolds.length > 1) {
      setPickedForRepair([]);
      setShowHoldPicker(true);
      setShowReleaseForm(null);
      setShowVerbalOverride(null);
      setShowRepairConfirm(null);
    }
  };

  const openReleaseAction = () => {
    if (activeHolds.length === 1) {
      openReleaseForm(activeHolds[0].id);
    } else if (activeHolds.length > 1) {
      setShowReleasePicker(true);
      setShowReleaseForm(null);
      setShowVerbalOverride(null);
      setShowRepairConfirm(null);
    }
  };

  const closeReleasePicker  = () => setShowReleasePicker(false);
  const pickHoldForRelease  = (holdId: string) => { setShowReleasePicker(false); openReleaseForm(holdId); };

  const toggleRepairPick = (holdId: string) =>
    setPickedForRepair(prev => prev.includes(holdId) ? prev.filter(id => id !== holdId) : [...prev, holdId]);
  const confirmRepairSelection = () => {
    if (pickedForRepair.length === 0) return;
    setShowRepairConfirm([...pickedForRepair]);
    setShowHoldPicker(false);
    setPickedForRepair([]);
  };
  const closeHoldPicker   = () => { setShowHoldPicker(false); setPickedForRepair([]); };

  const closeReleaseForm = () => setShowReleaseForm(null);
  const closeVerbalOverride = () => setShowVerbalOverride(null);

  const handleClearSale = async () => {
    if (!saleHold || !user) return;
    setClearingSale(true);
    setClearSaleError(false);
    try {
      await clearSaleHold(saleHold.id, user.name);
      hapticMedium();
      setConfirmClearSale(false);
    } catch {
      setClearSaleError(true);
    } finally {
      setClearingSale(false);
    }
  };

  const handleRepair = async () => {
    if (!showRepairConfirm || showRepairConfirm.length === 0) return;
    setRepairing(true);
    setRepairError(false);
    // markRepaired(Batch) throws if a write fails — don't clear the form or claim
    // success on a write that didn't land.
    const base = {
      repairedById: user!.id,
      repairedAt: new Date().toISOString(),
      notes: repairNotes.trim(),
      outcome: repairOutcome,
    };
    try {
      if (showRepairConfirm.length === 1) {
        // Single keeps markRepaired's linked-exception auto-close.
        await markRepaired(showRepairConfirm[0], { holdId: showRepairConfirm[0], ...base });
      } else {
        await markRepairedBatch(showRepairConfirm, { holdId: showRepairConfirm[0], ...base });
      }
      hapticMedium();
      setShowRepairConfirm(null);
      setRepairNotes('');
      setRepairOutcome('clean');
    } catch {
      setRepairError(true);
    } finally {
      setRepairing(false);
    }
  };

  const cancelRepair = () => {
    setShowRepairConfirm(null);
    setPickedForRepair([]);
    setRepairNotes('');
    setRepairOutcome('clean');
    setRepairError(false);
  };

  const { getName, getRole, getEmpId } = useUserResolver();

  return {
    user: user!,
    vehicle, holds, activeHold, activeHolds, repairableHolds, saleHold,
    confirmClearSale, setConfirmClearSale, clearingSale, clearSaleError, handleClearSale,
    showReleaseForm, openReleaseForm, closeReleaseForm,
    showVerbalOverride, openVerbalOverride, closeVerbalOverride,
    showRepairConfirm, openRepairConfirm, cancelRepair, handleRepair, markIssueRepaired,
    showHoldPicker, openRepairAction, toggleRepairPick, pickedForRepair, confirmRepairSelection, closeHoldPicker,
    showReleasePicker, openReleaseAction, pickHoldForRelease, closeReleasePicker,
    repairNotes, setRepairNotes, repairOutcome, setRepairOutcome, repairing, repairError,
    lightboxPhotos, lightboxIndex,
    openLightbox: (photos: string[], index: number) => { setLightboxPhotos(photos); setLightboxIndex(index); },
    closeLightbox: () => setLightboxPhotos([]),
    uploadingFor, addPhotoClick, handlePhotoSelected,
    getName, getRole, getEmpId,
  };
}
