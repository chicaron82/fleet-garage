import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Build stamp: short commit SHA + build date, injected at build time.
// Prefers Vercel's git env var (set during deploys), falls back to local git.
//
// ⚠️⚠️ `define` IS EVALUATED ONCE, WHEN THE SERVER STARTS — and a dev server runs for days. Found
// 2026-08-30 during /reflect 68: a `vite` process that had been up 4d20h was stamping every page
// `2026.08.26 · b96bfa9`, **81 commits behind HEAD**, while serving code Vite read fresh off disk on
// every request. The code was current. The stamp was five days old and looked authoritative.
//
// ⭐ That is precisely backwards for the one thing this stamp exists to do — *"confirm at a glance
// which deploy a screen is running"*. A frozen hash does not fail loudly; it answers confidently and
// wrongly, in both directions: it can age out from under current code, and it can make a stale
// screenshot look fresh. The authed-verify helper (`scripts/verify-fg.mjs`) points at this dev
// server by default, so a verification pass would have inherited the lie.
//
// So DEV NEVER PRINTS A HASH. It prints `dev`, which is the honest answer: this is a live dev
// server, its code is whatever is on disk right now, and no commit identity can be claimed for it.
// A real SHA appears only where one is actually true — a Vercel deploy, or a local `vite build`.
function buildSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  // `vite build` sets NODE_ENV=production; `vite` (dev) does not.
  if (process.env.NODE_ENV !== 'production') return 'dev'
  try { return execSync('git rev-parse --short HEAD').toString().trim() }
  catch { return 'dev' }
}

export default defineConfig({
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10).replace(/-/g, '.')),
  },
  plugins: [
    react(),
    tailwindcss(),
    // PWA: precache the app shell so a reload on flaky garage wifi opens the
    // app (offline-resilient writes already exist; this completes the story on
    // the shell side). registerType 'prompt' — never silently swap the app
    // mid-shift; the PwaUpdatePrompt toast lets the crew reload on their terms,
    // which also cooperates with chunkReload (the SW serves cached chunks, so a
    // post-deploy reload finds them instead of erroring).
    VitePWA({
      registerType: 'prompt',
      // Keep the hand-authored public/site.webmanifest (icons + fg-yellow theme);
      // the plugin only generates the service worker.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2,json}'],
        // Don't precache the lazy ~1.4 MB react-pdf chunk — it's only the
        // end-of-shift PDF export, rarely needed offline, and bloats the
        // first-install on field wifi. It loads from network on demand.
        // Don't precache heavy lazy chunks — they load from network on demand.
        globIgnores: ['**/react-pdf.browser-*.js', '**/kokoro*.js'],
        cleanupOutdatedCaches: true,
        // Offline deep-link support: serve the cached shell for unknown routes
        // (pairs with screenRouting's pathToScreen + the vercel.json SPA rewrite).
        navigateFallback: 'index.html',
      },
    }),
  ],
  optimizeDeps: {
    // kokoro-js uses ONNX Runtime Web (WASM + workers) — pre-bundling breaks it.
    exclude: ['kokoro-js', 'onnxruntime-web'],
  },
  server: {
    port: 5174,
    strictPort: true,
    headers: {
      // WASM + SharedArrayBuffer (used by onnxruntime-web, Effie's voice) require
      // cross-origin isolation in dev. `credentialless` still delivers it
      // (crossOriginIsolated stays true → SharedArrayBuffer works) but loads
      // no-CORS cross-origin subresources *without credentials* instead of
      // blocking them — so public Supabase damage photos render in dev instead of
      // tripping ERR_BLOCKED_BY_RESPONSE. Dev-only; prod (Vercel) sets no COEP.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    // Plain `vite` doesn't run the Vercel serverless functions in api/, so
    // /api/fg-chat (Effie) 404s locally. Proxy the two actual function endpoints to
    // the deployed backend so they answer in dev too. NOTE: this hits the DEPLOYED
    // backend (prod env + keys) — it exercises *deployed* Effie, not local edits to
    // api/fg-chat.ts; for that use `vercel dev`. Dev already shares the prod Supabase
    // project, so this adds no new data exposure.
    //
    // Scoped to the exact endpoint paths, NOT a blanket '/api' prefix: some of Effie's
    // helpers (api/_lib/holdProposal.ts, photoRequest.ts, lostItemProposal.ts) are
    // legitimately imported by client components too (HoldProposalCard, FgAssistantFab)
    // — a real, non-type runtime import, not just types. A blanket '/api' rule swallows
    // Vite's own request for those modules and forwards it to production instead, which
    // has no matching route and falls through vercel.json's SPA rewrite — the browser
    // gets index.html back for a request expecting a JS module ("Failed to load module
    // script... MIME type text/html"), and since these are static imports the whole
    // bundle fails to evaluate: a blank white screen on every page, not just Effie.
    proxy: {
      '/api/fg-chat': {
        target: 'https://fleet-garage.vercel.app',
        changeOrigin: true,
      },
      '/api/fg-schedule-parse': {
        target: 'https://fleet-garage.vercel.app',
        changeOrigin: true,
      },
    },
  },
  build: {
    // react-pdf (@react-pdf/renderer, ~1.4 MB raw) is the only chunk over the
    // default 500 kB limit — and it's dynamically imported only at PDF-export
    // time, so it never touches the initial load. Lift the threshold just past
    // it so the warning stays meaningful for genuinely new initial-load bloat.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Split React into its own vendor chunk so daily app updates re-ship
        // only the app code, not the framework. (supabase already splits out.)
        manualChunks(id) {
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react/') ||
            id.includes('node_modules/scheduler')
          ) {
            return 'vendor-react'
          }
        },
      },
    },
  },
})
