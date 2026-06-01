import type { ReleaseType } from '../../types';

// Per-release-type presentation tokens, shared by the form and the confirm panel
// so the colour scheme (amber=exception, orange=mechanical, blue=pre-existing)
// stays in one place.

export interface ReleaseTheme {
  border: string;
  header: string;
  title: string;
  subtitle: string;
  close: string;
  focusRing: string;
  submit: string;
  headerDescription: string;
  label: string;
}

const THEMES: Record<ReleaseType, ReleaseTheme> = {
  EXCEPTION: {
    border: 'border-amber-200 dark:border-amber-800/50',
    header: 'bg-amber-50 dark:bg-amber-900/30 border-amber-100',
    title: 'text-amber-900',
    subtitle: 'text-amber-700 dark:text-amber-400',
    close: 'text-amber-400 hover:text-amber-700 dark:text-amber-400',
    focusRing: 'focus:ring-amber-400',
    submit: 'bg-amber-500 hover:bg-amber-400 text-white',
    headerDescription: 'Vehicle will move to Out on Exception status',
    label: 'Exception',
  },
  MECHANICAL_RELEASE: {
    border: 'border-orange-200 dark:border-orange-800/50',
    header: 'bg-orange-50 dark:bg-orange-900/30 border-orange-100',
    title: 'text-orange-900 dark:text-orange-100',
    subtitle: 'text-orange-700 dark:text-orange-400',
    close: 'text-orange-400 hover:text-orange-700 dark:text-orange-400',
    focusRing: 'focus:ring-orange-400',
    submit: 'bg-orange-500 hover:bg-orange-400 text-white',
    headerDescription: 'Mechanical hold — short term, must return for service',
    label: 'Mechanical Release',
  },
  PRE_EXISTING: {
    border: 'border-blue-200',
    header: 'bg-blue-50 border-blue-100',
    title: 'text-blue-900',
    subtitle: 'text-blue-700',
    close: 'text-blue-400 hover:text-blue-700',
    focusRing: 'focus:ring-blue-400',
    submit: 'bg-blue-500 hover:bg-blue-400 text-white',
    headerDescription: 'Vehicle will be marked Pre-existing — renting as-is',
    label: 'Pre-existing',
  },
};

export function releaseTypeTheme(t: ReleaseType): ReleaseTheme {
  return THEMES[t];
}
