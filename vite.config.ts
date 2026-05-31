import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
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
