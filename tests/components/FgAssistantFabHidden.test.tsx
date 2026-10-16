// The "Hey FG" button stays off Lot Lookout (Aaron, 2026-10-15, "green for your recs"): pinned to the bottom right,
// it sat on stalls and the return lane however far he scrolled. Everywhere else it stays.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: { user: { email: 'aaron@fleet-garage.internal' } } } }) } },
}));
vi.mock('../../src/context/EffieContext', () => ({
  useEffie: () => ({ tts: { enabled: false, toggle: vi.fn(), speaking: false, stop: vi.fn() }, memory: {} }),
}));
vi.mock('../../src/components/assistant/EffieConversation', () => ({ EffieConversation: () => null }));
vi.mock('../../src/components/assistant/EffieSettingsPanel', () => ({ EffieSettingsPanel: () => null }));

import { FgAssistantFab } from '../../src/components/assistant/FgAssistantFab';

// An empty allowlist means open to all, so the gate under test is the module one, not who is signed in.
beforeEach(() => { vi.stubEnv('VITE_FG_ASSISTANT_ALLOWED_EMPLOYEE_IDS', ''); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('FgAssistantFab — not over the lot board', () => {
  it('shows on My Day', async () => {
    const { container } = render(<FgAssistantFab module="my-day" />);
    await waitFor(() => expect(container.querySelector('button')).not.toBeNull());   // CONTROL
  });

  it('is not drawn on Lot Lookout', async () => {
    const { container } = render(<FgAssistantFab module="lot-lookout" />);
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
    expect(container.innerHTML).toBe('');
  });
});
