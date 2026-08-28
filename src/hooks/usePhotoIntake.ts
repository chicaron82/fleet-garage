import { useState, useCallback } from 'react';
import { compressImage, compressBatch, ImageDecodeError } from '../lib/image';

/**
 * Taking a photo INTO a form, and saying so when it doesn't work.
 *
 * ⭐ WHY THIS EXISTS. `compressImage` gained a real failure path on 2026-08-28 — before that it
 * could not reject at all, so seventeen call sites were written against a promise that always
 * resolved. Making it reject without giving those sites somewhere to put the failure would just
 * relocate the silence: an uncaught rejection leaves the spinner spinning and the state unreset,
 * which is the same defect wearing a different hat.
 *
 * Seventeen bespoke error states would also have been seventeen chances to word it differently and
 * seventeen places to forget. The story is identical at every one of them — *that photo didn't take,
 * try another* — so it lives here once.
 *
 * ⚠️ `takeMany` uses `compressBatch`, NOT `Promise.all`. Six of those call sites map a FileList
 * through `Promise.all`, which rejects on the FIRST failure — one bad photo in a batch of five would
 * discard the four that were fine. Losing good evidence to a bad file is worse than the bug being
 * fixed. Partial success is reported honestly instead: "2 photos couldn't be read."
 */
export function usePhotoIntake() {
  const [photoError, setPhotoError] = useState('');
  const clearPhotoError = useCallback(() => setPhotoError(''), []);

  /** One file → its data URL, or null. Sets the message on failure; never throws. */
  const takeOne = useCallback(async (file: File): Promise<string | null> => {
    setPhotoError('');
    try {
      return await compressImage(file);
    } catch (err) {
      setPhotoError(
        err instanceof ImageDecodeError
          ? "That photo couldn't be read — try taking it again."
          : 'Something went wrong reading that photo.',
      );
      return null;
    }
  }, []);

  /** Many files → the ones that worked. Reports how many didn't rather than dropping them all. */
  const takeMany = useCallback(async (files: readonly File[]): Promise<string[]> => {
    setPhotoError('');
    const { photos, failed } = await compressBatch(files);
    if (failed > 0) {
      setPhotoError(
        photos.length > 0
          ? `${failed} photo${failed === 1 ? " couldn't" : "s couldn't"} be read — the other ${photos.length} added.`
          : `That photo couldn't be read — try taking it again.`,
      );
    }
    return photos;
  }, []);

  return { photoError, clearPhotoError, takeOne, takeMany };
}
