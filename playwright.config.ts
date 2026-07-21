import { defineConfig, devices } from '@playwright/test';

// Flow tests — end-to-end user JOURNEYS (scan → route → screen), the seam that unit
// tests can't see. They drive the real app against the live backend as the VSA verify
// bot; the scan flows are simulated by injecting the post-scan Screen state through the
// app's own history channel (see tests/flows/_support.ts). Named *.flow.ts so vitest's
// {test,spec} glob never picks them up. Run: `npm run test:flows`.
const PORT = 5199;

export default defineConfig({
  testDir: './tests/flows',
  testMatch: '**/*.flow.ts',
  fullyParallel: false, // these share the bot account + the LZM531 fixture; keep them serial
  workers: 1,
  retries: 1, // one retry absorbs a transient network blip against the live backend
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    // Setup logs in fresh (no storageState). Only the flows project loads the saved session.
    { name: 'setup', testMatch: 'auth.setup.ts' },
    { name: 'flows', dependencies: ['setup'], use: { ...devices['Desktop Chrome'], storageState: '.verify/state-flows.json' } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
