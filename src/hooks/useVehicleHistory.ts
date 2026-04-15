import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { compressImage } from '../lib/image';
import { USERS } from '../data/mock';

export function useVehicleHistory(vehicleId: string) {
  const { user } = useAuth();
  const { getVehicle, getHoldsForVehicle, getActiveHold, addPhotosToHold, markRepaired } = useGarage();
  const [showReleaseForm, setShowReleaseForm] = useState<string | null>(null);
  const [showRepairConfirm, setShowRepairConfirm] = useState<string | null>(null);
  const [repairNotes, setRepairNotes] = useState('');
  const [repairing, setRepairing] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pendingHoldId = useRef<string | null>(null);

  const vehicle = getVehicle(vehicleId);
  const holds = getHoldsForVehicle(vehicleId);
  const activeHold = getActiveHold(vehicleId);

  const addPhotoClick = (holdId: string) => {
    pendingHoldId.current = holdId;
    photoInputRef.current?.click();
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
    setShowRepairConfirm(null);
  };

  const openRepairConfirm = (holdId: string) => {
    setShowRepairConfirm(holdId);
    setShowReleaseForm(null);
  };

  const closeReleaseForm = () => setShowReleaseForm(null);

  const handleRepair = async () => {
    if (!showRepairConfirm) return;
    setRepairing(true);
    await markRepaired(showRepairConfirm, {
      holdId: showRepairConfirm,
      repairedById: user!.id,
      repairedAt: new Date().toISOString(),
      notes: repairNotes.trim(),
    });
    setShowRepairConfirm(null);
    setRepairNotes('');
    setRepairing(false);
  };

  const cancelRepair = () => {
    setShowRepairConfirm(null);
    setRepairNotes('');
  };

  const getName = (userId: string) => USERS.find(u => u.id === userId)?.name ?? 'Unknown';
  const getRole = (userId: string) => USERS.find(u => u.id === userId)?.role ?? '';
  const getEmpId = (userId: string) => USERS.find(u => u.id === userId)?.employeeId ?? '';

  return {
    user: user!,
    vehicle, holds, activeHold,
    showReleaseForm, openReleaseForm, closeReleaseForm,
    showRepairConfirm, openRepairConfirm, cancelRepair, handleRepair,
    repairNotes, setRepairNotes, repairing,
    lightboxSrc, setLightboxSrc,
    uploadingFor, addPhotoClick, handlePhotoSelected,
    photoInputRef,
    getName, getRole, getEmpId,
  };
}
