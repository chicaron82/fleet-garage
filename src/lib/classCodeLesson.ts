// Close the codex's learning loop for a car FG ALREADY KNOWS.
//
// The gap Aaron found on the floor (2026-08-17, LUR514 "CX6R", a Volvo XC60 already on record):
// the scan card said *"Class code CX6R isn't in the codex yet — make/model need adding by hand"*
// on a car whose make and model were sitting right there in the record beneath it. FG had the
// answer and asked him for it anyway.
//
// The cause is that the codex only ever learned in ONE place: `RegisterVehicleForm`, where the
// operator types a make and model for a NEW car. That works for a car FG has never seen — but for
// a car already registered there is nothing left to register, so the code could never be taught
// and the same scan re-logged the same complaint forever. `CTAC` (a Toyota Tacoma) had been
// scanned and logged **three separate times** without anything being able to resolve it.
//
// So: when the codex misses on a car that IS on record with a make and model, the vehicle record
// IS the lesson. Nothing here guesses — the codex's no-guessing rule stands. It only teaches what
// the operator already entered himself, from the one source FG trusts for identity.
import { normalizeClassCode } from '../../api/_lib/vehicleClassCodex';
import { isUnknownClassCode } from './partialRegister';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Vehicle } from '../types';

export interface ClassCodeLesson {
  /** Normalized class code as printed on the tag — the codex key. */
  code: string;
  make: string;
  model: string;
}

/**
 * The mapping this scan can teach the codex on its own, or null when it can't.
 *
 * Requires all three: the tag printed a class code, the codex failed to resolve it, and the
 * resolved vehicle carries a real make AND model. A plate-only or half-backfilled record teaches
 * nothing — that scan still belongs in the self-reporting log, because FG genuinely doesn't know.
 */
export function classCodeLessonFromScan(
  read: KeytagRead,
  vehicle: Vehicle | null,
): ClassCodeLesson | null {
  if (!isUnknownClassCode(read)) return null;
  const code = normalizeClassCode(read.classCode ?? '');
  if (!code) return null;

  const make = (vehicle?.make ?? '').trim();
  const model = (vehicle?.model ?? '').trim();
  // Both, or neither. A make with no model would poison the codex with a half-mapping that the
  // next scan would resolve into a worse answer than "I don't know".
  if (!make || !model) return null;

  return { code, make, model };
}

/** The line the card shows when FG taught itself instead of asking him — the inverse of the
 *  "isn't in the codex yet" warning, and worth saying out loud: the next scan of this code
 *  resolves without him doing anything. */
export function classCodeLearnedLabel(lesson: ClassCodeLesson): string {
  return `Model code ${lesson.code} was new — learned it as ${lesson.make} ${lesson.model} from this car's record.`;
}
