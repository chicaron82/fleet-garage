import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import type { AuditSection, AuditResult, AuditCrew, AuditCrewSlot } from '../types';

// ── Initial checklist ─────────────────────────────────────────────────────────

function buildInitialSections(): AuditSection[] {
  return [
    {
      id: 'exterior', label: 'EXTERIOR', isOpen: true, notes: '',
      items: [
        { id: 'ext',  label: 'Exterior',    result: 'pending' },
        { id: 'dmg',  label: 'Damage',      result: 'pending' },
        { id: 'whl',  label: 'Wheels',      result: 'pending' },
        { id: 'trd',  label: 'Tread Depth', result: 'pending' },
      ],
    },
    {
      id: 'interior', label: 'INTERIOR', isOpen: true, notes: '',
      items: [
        { id: 'odr',   label: 'Odor',          result: 'pending' },
        { id: 'fuel',  label: 'Fuel',           result: 'pending' },
        { id: 'seats', label: 'Seats',          result: 'pending' },
        { id: 'under', label: 'Under Seats',    result: 'pending' },
        { id: 'cup',   label: 'Cup Holders',    result: 'pending' },
        { id: 'mir',   label: 'Mirror / Glass', result: 'pending' },
      ],
    },
    {
      id: 'misc', label: 'MISC', isOpen: true, notes: '',
      items: [
        { id: 'trunk', label: 'Trunk',     result: 'pending' },
        { id: 'glove', label: 'Glove Box', result: 'pending' },
      ],
    },
  ];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface PendingPhoto { sectionId: string; itemId: string }

export function useAudit() {
  const { user } = useAuth();

  const [owningArea, setOwningArea]       = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [plate, setPlate]                 = useState('');
  const [crew, setCrew] = useState<AuditCrew>({
    driverSide:    { employeeId: '', name: '' },
    passengerSide: { employeeId: '', name: '' },
    sprayer:       { employeeId: '', name: '' },
  });
  const [sections, setSections]           = useState<AuditSection[]>(buildInitialSections);
  const [dispatchStatus, setDispatchStatus] = useState<'idle' | 'dispatching' | 'dispatched'>('idle');
  const pendingPhoto                       = useRef<PendingPhoto | null>(null);

  // ── Computed ───────────────────────────────────────────────────────────────

  const allItems = sections.flatMap(s => s.items);
  const hasAnyFail = allItems.some(i => i.result === 'fail');
  const allAnswered = allItems.every(i => i.result !== 'pending');
  const overallStatus = hasAnyFail ? 'FAILED' : allAnswered ? 'PASSED' : 'IN_PROGRESS';
  const failCount = allItems.filter(i => i.result === 'fail').length;

  const isReadyToExport =
    allAnswered &&
    owningArea.trim() !== '' &&
    vehicleNumber.trim() !== '' &&
    plate.trim() !== '' &&
    crew.driverSide.name !== '' &&
    crew.passengerSide.name !== '' &&
    crew.sprayer.name !== '';

  // ── Mutators ───────────────────────────────────────────────────────────────

  const updateSection = (sectionId: string, fn: (s: AuditSection) => AuditSection) =>
    setSections(prev => prev.map(s => s.id === sectionId ? fn(s) : s));

  const setResult = (sectionId: string, itemId: string, result: AuditResult) =>
    updateSection(sectionId, s => ({
      ...s,
      items: s.items.map(i => i.id === itemId ? { ...i, result } : i),
    }));

  const setPhoto = (sectionId: string, itemId: string, photoUrl: string) =>
    updateSection(sectionId, s => ({
      ...s,
      items: s.items.map(i => i.id === itemId ? { ...i, photoUrl } : i),
    }));

  const setSectionNotes = (sectionId: string, notes: string) =>
    updateSection(sectionId, s => ({ ...s, notes }));

  const toggleSection = (sectionId: string) =>
    updateSection(sectionId, s => ({ ...s, isOpen: !s.isOpen }));

  const preparePhotoCapture = (sectionId: string, itemId: string) => {
    pendingPhoto.current = { sectionId, itemId };
  };

  const handleFileSelected = (file: File) => {
    const target = pendingPhoto.current;
    if (!target) return;
    const url = URL.createObjectURL(file);
    setPhoto(target.sectionId, target.itemId, url);
    pendingPhoto.current = null;
  };

  const handleDispatch = () => {
    setDispatchStatus('dispatching');
    setTimeout(() => {
      setDispatchStatus('dispatched');
      setTimeout(() => setDispatchStatus('idle'), 2500);
    }, 1200);
  };

  const reset = () => {
    setOwningArea('');
    setVehicleNumber('');
    setPlate('');
    setCrew({ driverSide: { employeeId: '', name: '' }, passengerSide: { employeeId: '', name: '' }, sprayer: { employeeId: '', name: '' } });
    setSections(buildInitialSections());
    setDispatchStatus('idle');
    pendingPhoto.current = null;
  };

  const resolveCrewName = (slot: AuditCrewSlot) =>
    slot.name || slot.employeeId || 'Unknown';

  return {
    user,
    owningArea, setOwningArea,
    vehicleNumber, setVehicleNumber,
    plate, setPlate,
    crew, setCrew,
    sections,
    overallStatus,
    failCount,
    allAnswered,
    isReadyToExport,
    setResult,
    setSectionNotes,
    toggleSection,
    preparePhotoCapture,
    handleFileSelected,
    dispatchStatus,
    handleDispatch,
    reset,
    resolveCrewName,
    auditorName: user?.name ?? '',
  };
}
