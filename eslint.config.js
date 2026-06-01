import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Line discipline: logic files (components / hooks / context / lib) are capped
    // at 330 code lines. When you approach it, extract a hook, a pure lib, or split
    // the component — see CLAUDE.md. New files MUST pass this error cap.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'max-lines': ['error', { max: 330, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Declarations + static/mock data are not logic — exempt from the cap.
    files: ['src/types/**', 'src/data/**'],
    rules: {
      'max-lines': 'off',
    },
  },
  {
    // Grandfathered debt — files that predate the cap. WARN (not error) so the build
    // stays green while keeping each one visible at the 330 line. This list is the
    // burn-down backlog: refactor toward 330 and DELETE each path as it drops under.
    // Do NOT add new entries — new files must pass the 330 error cap above. Trailing
    // comment = code-line count at adoption (2026-05-31); it should only go down.
    files: [
      'src/components/analytics/AnalyticsView.tsx',          // 342
      'src/components/analytics/DriverCoverageSection.tsx',  // 339
      'src/components/analytics/ShiftReportPDFSections.tsx', // 332
      'src/components/audit/AuditForm.tsx',                  // 338
      'src/components/movement/MovementLogView.tsx',         // 348
      'src/components/movement/TripStartForm.tsx',           // 436
      'src/components/shared/WhiteboardView.tsx',            // 356
      'src/hooks/useDriverLiveTrip.ts',                      // 336
    ],
    rules: {
      'max-lines': ['warn', { max: 330, skipBlankLines: true, skipComments: true }],
    },
  },
])
