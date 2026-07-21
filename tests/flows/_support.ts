// Shared helpers for the flow tests.
import type { Page } from '@playwright/test';

/**
 * Simulate the scan-router navigating to a screen, by injecting the post-scan `Screen`
 * state through the app's own history channel. App's popstate handler does `setScreen(state)`
 * for any non-appRoot state, so this reproduces "a scan routed here with plate X" for ANY
 * destination — without the camera/vision pipeline (which isn't served in local dev). This is
 * the exact technique that let us reproduce the + Log stale-plate leak headlessly (2026-07-21).
 */
export async function injectScreen(page: Page, state: Record<string, unknown>): Promise<void> {
  await page.evaluate((s) => {
    window.history.pushState(s, '', window.location.pathname);
    window.dispatchEvent(new PopStateEvent('popstate', { state: s }));
  }, state);
}

// The seeded geotab vehicle used as the fixture across flows — a stable on-record car.
export const FIXTURE = {
  plate: 'LZM531',
  unit: '5423124',
  vehicleId: 'geotab-veh-LZM531',
} as const;

let seq = 1000;
/** A fresh scan nonce per call, so a "repeat scan" is a distinct routing event. */
export const nextNonce = () => ++seq;
