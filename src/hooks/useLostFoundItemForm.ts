// All state + handlers for the Log-Found-Item sheet, lifted out of
// LogLostFoundItemModal so the modal is a thin two-step shell (the file was at the
// 330-line cap — docs/ticket-near-cap-file-extractions.md). Behavior-preserving:
// the photo capture, source-pill toggle, submit, and the routed-plate re-seed are
// the exact logic that lived inline.
import { useState } from 'react';
import { buildLostFoundItemInput } from '../lib/lostFoundItem';
import { useRoutedProp } from './useRoutedProp';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { compressImage } from '../lib/image';
import type { LostFoundLocation } from '../types';
import { usePlateRecognition } from './usePlateRecognition';
import { useKeytagScan } from './useKeytagScan';
import { SOURCE_PILLS, appendSourceText, removeSourceText } from '../lib/lostFoundSourcePills';
import type { SourceTag } from '../lib/lostFoundSourcePills';

interface Options {
  initialPlate?: string;
  onSubmit: (item: {
    keyTagPhoto?: string;
    itemPhoto?: string;
    description?: string;
    location?: LostFoundLocation;
    licensePlate?: string;
    notes?: string;
  }) => Promise<boolean>;
  onClose: () => void;
}

export function useLostFoundItemForm({ initialPlate, onSubmit, onClose }: Options) {
  const [step, setStep] = useState<1 | 2>(1);
  const [keyTagPhoto, setKeyTagPhoto] = useState<string | null>(null);
  const [itemPhoto, setItemPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<LostFoundLocation | null>(null);
  const [licensePlate, setLicensePlate] = useState(initialPlate ?? '');
  // Routed prop → derive or re-seed, never seed-once (FG CLAUDE.md). The sheet stays MOUNTED while
  // Lost & Found is open, so a second header scan changes `initialPlate` without remounting this
  // modal — seeding once would leave the previous car's plate in the field (found /reflect 45).
  useRoutedProp(initialPlate, setLicensePlate);
  const [notes, setNotes] = useState('');
  const [sourceTag, setSourceTag] = useState<SourceTag | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  // Recognize the typed plate live, so the logger sees whose car it is before submitting.
  const plateMatch = usePlateRecognition(licensePlate);
  const keytag = useKeytagScan(); // reads the Step-1 key-tag photo → fills the plate + register offer

  // The free-text pill (text === null) returns true so the caller can focus its own notes ref —
  // refs live in the step component, never in this returned object (react-hooks/refs: an object
  // that mixes refs with render values reads as a ref-access on every property).
  const handleSourcePill = (label: SourceTag, text: string | null): boolean => {
    hapticLight();
    if (text === null) {
      setSourceTag(prev => prev === label ? null : label);
      return true;
    }
    if (sourceTag === label) {
      setNotes(removeSourceText(notes, text));
      setSourceTag(null);
    } else {
      const oldText = SOURCE_PILLS.find(p => p.label === sourceTag)?.text ?? null;
      const base = oldText ? removeSourceText(notes, oldText) : notes.trim();
      setNotes(appendSourceText(base, text));
      setSourceTag(label);
    }
    return false;
  };

  // `after` lets the Step-1 key-tag photo do double duty: attached to the record AND read to
  // fill the plate (so Step 2 arrives pre-filled with the register offer waiting).
  const handlePhotoCapture = (setter: (v: string) => void, after?: (photo: string) => void) =>
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const photo = await compressImage(file);
      setter(photo);
      e.target.value = '';
      after?.(photo);
    };

  const handleSubmit = async () => {
    hapticMedium();
    setSubmitting(true);
    setSubmitError(false);
    const ok = await onSubmit(buildLostFoundItemInput({
      keyTagPhoto, itemPhoto, description, location, licensePlate, notes,
    }));
    setSubmitting(false);
    if (!ok) {
      setSubmitError(true);
      return;
    }
    onClose();
  };

  const canAdvance = !!(keyTagPhoto || itemPhoto);

  return {
    step, setStep,
    keyTagPhoto, setKeyTagPhoto, itemPhoto, setItemPhoto,
    description, setDescription, location, setLocation,
    licensePlate, setLicensePlate, notes, setNotes,
    sourceTag, submitting, submitError,
    plateMatch, keytag,
    handleSourcePill, handlePhotoCapture, handleSubmit, canAdvance,
  };
}

export type LostFoundForm = ReturnType<typeof useLostFoundItemForm>;
