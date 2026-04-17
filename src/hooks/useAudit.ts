import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { USERS } from '../data/mock';
import type { AuditSection, AuditResult, AuditCrew } from '../types';

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
  const [crew, setCrew]                   = useState<AuditCrew>({ driverSide: '', passengerSide: '', sprayer: '' });
  const [sections, setSections]           = useState<AuditSection[]>(buildInitialSections);
  const [dispatchStatus, setDispatchStatus] = useState<'idle' | 'dispatching' | 'dispatched'>('idle');
  const pendingPhoto                       = useRef<PendingPhoto | null>(null);
  const fileInputRef                       = useRef<HTMLInputElement | null>(null);

  const vsaUsers = USERS.filter(u => u.role === 'VSA' || u.role === 'Lead VSA');

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
    crew.driverSide !== '' &&
    crew.passengerSide !== '' &&
    crew.sprayer !== '';

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

  const triggerPhotoCapture = (sectionId: string, itemId: string) => {
    pendingPhoto.current = { sectionId, itemId };
    fileInputRef.current?.click();
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
    setCrew({ driverSide: '', passengerSide: '', sprayer: '' });
    setSections(buildInitialSections());
    setDispatchStatus('idle');
    pendingPhoto.current = null;
  };

  const resolveCrewName = (userId: string) =>
    USERS.find(u => u.id === userId)?.name ?? userId;

  return {
    user,
    vsaUsers,
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
    triggerPhotoCapture,
    handleFileSelected,
    fileInputRef,
    dispatchStatus,
    handleDispatch,
    reset,
    resolveCrewName,
    auditorName: user?.name ?? '',
  };
}
