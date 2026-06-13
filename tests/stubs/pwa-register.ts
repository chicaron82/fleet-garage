import { vi } from 'vitest';

// Stub for vite-plugin-pwa's virtual module `virtual:pwa-register/react`, which
// vitest's pipeline can't resolve (the PWA plugin isn't in its chain). Aliased
// in vitest.config.ts. State is mutable so a test can drive `needRefresh`; the
// component and the test both resolve to this same module instance, so they
// share `pwaMock`.
export const pwaMock = {
  needRefresh: false,
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(),
};

export function useRegisterSW() {
  return {
    needRefresh: [pwaMock.needRefresh, pwaMock.setNeedRefresh] as [boolean, typeof pwaMock.setNeedRefresh],
    updateServiceWorker: pwaMock.updateServiceWorker,
  };
}
