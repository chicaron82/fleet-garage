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

// ⭐ /lot is the PUBLIC airport stall board (Lot Lookout): a driver opens it with a shared PIN, no FG login,
// the way nanays serves /request. It renders ahead of every FG provider, and loads lazily so FG itself never
// pays for it. The PIN is checked server-side in api/lot.ts, the board's only writer.
const isLotPage = window.location.pathname.replace(/\/+$/, '') === '/lot'

createRoot(document.getElementById('root')!).render(
  isLotPage ? (
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
