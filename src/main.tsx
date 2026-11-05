import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { PreferencesProvider } from './context/PreferencesContext.tsx'
import { ProfilesProvider } from './context/ProfilesContext.tsx'
import { PwaUpdatePrompt } from './components/shared/PwaUpdatePrompt.tsx'
import { LotEntry } from './components/lot/LotEntry.tsx'
import { lotPageOf } from './lib/lotLookout.ts'

// ⭐ /lot/view is the PUBLIC read-only bay: no FG login, no PIN, the way nanays serves /request. It renders ahead of
// every FG provider, and loads lazily so FG itself never pays for it. /lot and /lot/erin open it too (the retired
// airport page, 2026-10-29, and the retired PIN count page, 2026-11-05), so an old link is never a dead page.
// ⚠️ This branch has no PwaUpdatePrompt of its own: LotEntry mounts it (a /lot phone kept the old page without it).
const lotPage = lotPageOf(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  lotPage ? (
    <StrictMode>
      <LotEntry />
    </StrictMode>
  ) : (
  <StrictMode>
    <AuthProvider>
      <ProfilesProvider>
        <PreferencesProvider>
          <App />
        </PreferencesProvider>
      </ProfilesProvider>
    </AuthProvider>
    <Analytics />
    <PwaUpdatePrompt />
  </StrictMode>
  ),
)
