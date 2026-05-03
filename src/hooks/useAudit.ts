import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { AuditSection, AuditResult, AuditCrewMember, AuditPosition } from '../types';

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

function emptyMember(position: AuditPosition = 'driver-side'): AuditCrewMember {
  return { employeeId: '', name: '', position };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface PendingPhoto { sectionId: string; itemId: string }

export function useAudit() {
  const { user } = useAuth();

  const [owningArea, setOwningArea]       = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [plate, setPlate]                 = useState('');
  const [crewMembers, setCrewMembers]     = useState<AuditCrewMember[]>([emptyMember('driver-side')]);
  const [sections, setSections]           = useState<AuditSection[]>(buildInitialSections);
  const [dispatchStatus, setDispatchStatus] = useState<'idle' | 'dispatching' | 'dispatched'>('idle');
  const pendingPhoto                        = useRef<PendingPhoto | null>(null);

  // ── Computed ───────────────────────────────────────────────────────────────

  const allItems    = sections.flatMap(s => s.items);
  const hasAnyFail  = allItems.some(i => i.result === 'fail');
  const allAnswered = allItems.every(i => i.result !== 'pending');
  const overallStatus = hasAnyFail ? 'FAILED' : allAnswered ? 'PASSED' : 'IN_PROGRESS';
  const failCount   = allItems.filter(i => i.result === 'fail').length;

  const isReadyToExport =
    allAnswered &&
    owningArea.trim() !== '' &&
    vehicleNumber.trim() !== '' &&
    plate.trim() !== '' &&
    crewMembers.length > 0 &&
    crewMembers.every(m => m.name.trim() !== '');

  // ── Crew mutators ──────────────────────────────────────────────────────────

  const addCrewMember = () => {
    // Default next position in sequence, then cycle back
    const positions: AuditPosition[] = ['driver-side', 'passenger-side', 'sprayer-prep'];
    const nextPos = positions[crewMembers.length % positions.length];
    setCrewMembers(prev => [...prev, emptyMember(nextPos)]);
  };

  const removeCrewMember = (index: number) => {
    setCrewMembers(prev => prev.filter((_, i) => i !== index));
  };

  const updateCrewMember = (index: number, patch: Partial<AuditCrewMember>) => {
    setCrewMembers(prev => prev.map((m, i) => i === index ? { ...m, ...patch } : m));
  };

  // ── Checklist mutators ────────────────────────────────────────────────────

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

  // ── Dispatch + Supabase persist ───────────────────────────────────────────

  const handleDispatch = () => {
    setDispatchStatus('dispatching');

    // Persist to Supabase (fire-and-forget)
    if (user) {
      const finalStatus = (overallStatus === 'IN_PROGRESS' ? 'FAILED' : overallStatus) as 'PASSED' | 'FAILED';
      supabase.from('audits').insert({
        branch_id:      user.branchId,
        date:           new Date().toISOString().split('T')[0],
        auditor_id:     user.id,
        auditor_name:   user.name,
        vehicle_number: vehicleNumber,
        plate,
        owning_area:    owningArea,
        crew:           crewMembers,
        sections,
        status:         finalStatus,
      });
    }

    setTimeout(() => {
      setDispatchStatus('dispatched');
      setTimeout(() => setDispatchStatus('idle'), 2500);
    }, 1200);
  };

  const reset = () => {
    setOwningArea('');
    setVehicleNumber('');
    setPlate('');
    setCrewMembers([emptyMember('driver-side')]);
    setSections(buildInitialSections());
    setDispatchStatus('idle');
    pendingPhoto.current = null;
  };

  return {
    user,
    owningArea, setOwningArea,
    vehicleNumber, setVehicleNumber,
    plate, setPlate,
    crewMembers,
    addCrewMember,
    removeCrewMember,
    updateCrewMember,
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
    auditorName: user?.name ?? '',
  };
}
