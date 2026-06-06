import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { PreferencesProvider } from './context/PreferencesContext.tsx'
import { ProfilesProvider } from './context/ProfilesContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ProfilesProvider>
        <PreferencesProvider>
          <App />
        </PreferencesProvider>
      </ProfilesProvider>
    </AuthProvider>
    <Analytics />
  </StrictMode>,
)
