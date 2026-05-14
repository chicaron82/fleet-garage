import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { compressImage } from '../lib/image';
import { USERS } from '../data/mock';
import { hapticMedium } from '../lib/haptics';
import type { Hold, RepairOutcome } from '../types';

export function useVehicleHistory(vehicleId: string) {
  const { user } = useAuth();
  const { getVehicle, getHoldsForVehicle, getActiveHold, addPhotosToHold, markRepaired, syncVehicleStatus } = useGarage();
  const [showReleaseForm, setShowReleaseForm] = useState<string | null>(null);
  const [showVerbalOverride, setShowVerbalOverride] = useState<string | null>(null);
  const [showRepairConfirm, setShowRepairConfirm] = useState<string | null>(null);
  const [repairNotes, setRepairNotes] = useState('');
  const [repairOutcome, setRepairOutcome] = useState<RepairOutcome>('clean');
  const [repairing, setRepairing] = useState(false);
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

  // All holds currently eligible for the repair action:
  // ACTIVE holds always eligible; RELEASED holds eligible if not yet repaired.
  const repairableHolds: Hold[] = holds.filter(
    h => h.vehicleId === vehicle?.id &&
      (h.status === 'ACTIVE' || (h.status === 'RELEASED' && !h.repair))
  );

  const [showHoldPicker, setShowHoldPicker] = useState(false);

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
    setShowRepairConfirm(holdId);
    setShowReleaseForm(null);
    setShowVerbalOverride(null);
    setShowHoldPicker(false);
  };

  const openRepairAction = () => {
    if (repairableHolds.length === 1) {
      openRepairConfirm(repairableHolds[0].id);
    } else if (repairableHolds.length > 1) {
      setShowHoldPicker(true);
      setShowReleaseForm(null);
      setShowVerbalOverride(null);
      setShowRepairConfirm(null);
    }
  };

  const pickHoldForRepair = (holdId: string) => openRepairConfirm(holdId);
  const closeHoldPicker   = () => setShowHoldPicker(false);

  const closeReleaseForm = () => setShowReleaseForm(null);
  const closeVerbalOverride = () => setShowVerbalOverride(null);

  const handleRepair = async () => {
    if (!showRepairConfirm) return;
    setRepairing(true);
    await markRepaired(showRepairConfirm, {
      holdId: showRepairConfirm,
      repairedById: user!.id,
      repairedAt: new Date().toISOString(),
      notes: repairNotes.trim(),
      outcome: repairOutcome,
    });
    hapticMedium();
    setShowRepairConfirm(null);
    setRepairNotes('');
    setRepairOutcome('clean');
    setRepairing(false);
  };

  const cancelRepair = () => {
    setShowRepairConfirm(null);
    setRepairNotes('');
    setRepairOutcome('clean');
  };

  const getName = (userId: string) => USERS.find(u => u.id === userId)?.name ?? 'Unknown';
  const getRole = (userId: string) => USERS.find(u => u.id === userId)?.role ?? '';
  const getEmpId = (userId: string) => USERS.find(u => u.id === userId)?.employeeId ?? '';

  return {
    user: user!,
    vehicle, holds, activeHold, repairableHolds,
    showReleaseForm, openReleaseForm, closeReleaseForm,
    showVerbalOverride, openVerbalOverride, closeVerbalOverride,
    showRepairConfirm, openRepairConfirm, cancelRepair, handleRepair,
    showHoldPicker, openRepairAction, pickHoldForRepair, closeHoldPicker,
    repairNotes, setRepairNotes, repairOutcome, setRepairOutcome, repairing,
    lightboxPhotos, lightboxIndex,
    openLightbox: (photos: string[], index: number) => { setLightboxPhotos(photos); setLightboxIndex(index); },
    closeLightbox: () => setLightboxPhotos([]),
    uploadingFor, addPhotoClick, handlePhotoSelected,
    getName, getRole, getEmpId,
  };
}
