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

// ⭐ /lot is the PUBLIC airport page (Lot Lookout's readings): a driver opens it with a shared PIN, no FG login,
// the way nanays serves /request. It renders ahead of every FG provider, and loads lazily so FG itself never
// pays for it. The PIN is checked server-side in api/lot.ts, the board's only writer. /lot/erin (Erin St's count)
// and /lot/view (read only, no PIN) ride the same door.
// ⚠️ This branch has no PwaUpdatePrompt of its own: LotEntry mounts it (a /lot phone kept the old page without it).
const lotPage = lotPageOf(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  lotPage ? (
    <StrictMode>
      <LotEntry page={lotPage} />
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
