// The codex and the catalogue are two halves of one contract: the codex RESOLVES a class code to
// a make/model, and the catalogue is what the register form can actually OFFER. If the codex knows
// a model the dropdown doesn't list, a scan of that code strands the operator — resolved to a car
// he then can't select (found live 2026-07-22: Aaron holding a RAV4 Hybrid, plus four codes
// — CFBO, CKNE, CSEH, CCSE, CCRH — quietly resolving to unlistable models).
//
// This turns "remember to add it in both places" into a mechanism.
import { describe, it, expect } from 'vitest';
import { MAKES_MODELS } from '../../../src/components/shared/vehicleCatalogue';
import { CODEX_ENTRIES } from '../../../api/_lib/vehicleClassCodex';

describe('codex ⊆ catalogue', () => {
  it('every make the codex can resolve exists in the catalogue', () => {
    const unknownMakes = CODEX_ENTRIES
      .filter(([, v]) => !MAKES_MODELS[v.make])
      .map(([code, v]) => `${code} → ${v.make}`);
    expect(unknownMakes).toEqual([]);
  });

  it('every model the codex can resolve is selectable in the register form', () => {
    const unlistable = CODEX_ENTRIES
      .filter(([, v]) => MAKES_MODELS[v.make] && !MAKES_MODELS[v.make].includes(v.model))
      .map(([code, v]) => `${code} → ${v.make} ${v.model}`);
    expect(unlistable).toEqual([]);
  });
});
