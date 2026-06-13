import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // vite-plugin-pwa's virtual module isn't in vitest's plugin chain — point
      // it at a stub so components that import it (PwaUpdatePrompt) are testable.
      'virtual:pwa-register/react': new URL('./tests/stubs/pwa-register.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Dummy Supabase env so src/lib/supabase.ts can construct its client at
    // import time. CI has no .env.local, so without these any test that
    // transitively imports supabase.ts throws "supabaseUrl is required".
    // Tests never hit the network — these are placeholders.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
