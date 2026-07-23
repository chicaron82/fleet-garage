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
    // Pure renderer with many cases — the CLAUDE.md cap carve-out. A flat list of
    // ~12 dumb @react-pdf section components + tiny format helpers; no state, no
    // hooks, no logic to hide. Exempt (justified), don't split for the number's sake.
    files: ['src/components/analytics/ShiftReportPDFSections.tsx'],
    rules: {
      'max-lines': 'off',
    },
  },
  {
    // Gate: USERS mock data must only flow through useUserResolver and useTeamMembers.
    // A direct import anywhere else surfaces fake employee names on real branches —
    // the exact regression the attribution split was built to prevent. BRANCH_CONFIGS
    // from the same file is legitimate public static config and is not restricted.
    // To add a new legitimate consumer (e.g. a test fixture), extend the ignores list.
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/hooks/useUserResolver.ts',
      'src/hooks/useTeamMembers.ts',
      'src/data/mock.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/data/mock'],
              importNames: ['USERS'],
              message:
                'Import USERS through useUserResolver or useTeamMembers — direct access surfaces fake employee data on real branches.',
            },
          ],
        },
      ],
    },
  },
  {
    // Test mocks often need a param purely for its TYPE (so a real caller's args type-check and
    // `.mock.calls` infers correctly), with no use for the value itself — e.g. a Supabase chain
    // mock typed to accept a payload it never reads. Standard `_`-prefix convention, scoped to
    // tests/ only so src/'s own unused-vars discipline is untouched. (2026-07-22, reflect 48's
    // tests/-type-check gate: `vi.fn((_payload: Record<string, unknown>) => chain)`.)
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // Grandfather list fully burned down (2026-05-31): every logic file is now under
  // the 330 cap. The cap is a hard error for all of src/ except the exemptions above.
])
