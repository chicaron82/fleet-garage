import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'

// Build stamp: short commit SHA + build date, injected at build time.
// Prefers Vercel's git env var (set during deploys), falls back to local git.
function buildSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  try { return execSync('git rev-parse --short HEAD').toString().trim() }
  catch { return 'dev' }
}

export default defineConfig({
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10).replace(/-/g, '.')),
  },
  plugins: [react(), tailwindcss()],
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
