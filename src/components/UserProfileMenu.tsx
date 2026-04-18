import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';

export function UserProfileMenu({ dropUp = false }: { dropUp?: boolean } = {}) {
  const { user, logout } = useAuth();
  const { prefs, updatePref, avatarBase64, setAvatarBase64 } = usePreferences();
  
  const [isOpen, setIsOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);
  
  const initials = user?.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 p-1.5 pr-3 rounded-full transition cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
      >
        <div className="w-8 h-8 rounded-full bg-yellow-400 dark:bg-yellow-500 overflow-hidden flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-sm">
          {avatarBase64 ? (
            <img src={avatarBase64} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-black font-semibold text-xs">{initials}</span>
          )}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-tight transition-colors">{user?.name}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight transition-colors">{user?.role}</p>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={`absolute w-56 backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 py-2 z-50 animate-in fade-in duration-200 ${
          dropUp ? 'bottom-full mb-2 right-0' : 'top-full mt-2 right-0'
        }`}>
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user?.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user?.employeeId}</p>
          </div>
          
          <button 
            onClick={() => { setIsOpen(false); setShowProfile(true); }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer flex items-center gap-2"
          >
            👤 View Profile
          </button>
          <button 
            onClick={() => { setIsOpen(false); setShowSettings(true); }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer flex items-center gap-2"
          >
            ⚙️ Settings
          </button>
          
          <div className="my-1 border-t border-gray-100 dark:border-gray-800"></div>
          
          <button 
            onClick={logout}
            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer flex items-center gap-2"
          >
            🚪 Sign out
          </button>
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowProfile(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800 transform transition-all" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Profile</h2>
              <button onClick={() => setShowProfile(false)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer">✕</button>
            </div>
            
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="relative group w-24 h-24">
                <div className="w-24 h-24 rounded-full bg-yellow-400 overflow-hidden flex items-center justify-center border-4 border-gray-50 dark:border-gray-800 shadow-sm transition-all">
                  {avatarBase64 ? (
                    <img src={avatarBase64} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-black font-bold text-3xl">{initials}</span>
                  )}
                </div>
                <label className="absolute inset-0 bg-black/50 text-white rounded-full flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-medium">
                  Change
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900 dark:text-white mb-0.5">{user?.name}</p>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 inline-block px-2.5 py-0.5 rounded-full">{user?.employeeId}</p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-700/50 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-yellow-400 to-amber-500"></div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 font-bold">Access Level</p>
              <div className="flex flex-col gap-2 relative z-10">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-sm">
                    {user?.role}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {['Branch Manager', 'Operations Manager'].includes(user?.role || '') ? 'Full Release Authority' : 'Flag-Only Permissions'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowSettings(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800 transform transition-all" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer">✕</button>
            </div>
            
            <div className="space-y-8">
              <div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 font-bold">Appearance</p>
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Dark Mode</span>
                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${prefs.darkMode ? 'bg-yellow-400' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${prefs.darkMode ? 'translate-x-5' : 'translate-x-1'}`} />
                      <input type="checkbox" className="sr-only" checked={prefs.darkMode} onChange={e => updatePref('darkMode', e.target.checked)} />
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 font-bold">Navigation</p>
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Default Tab</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Where you land after login</p>
                    </div>
                    <select
                      defaultValue="holds"
                      className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition cursor-pointer"
                    >
                      <option value="holds">Holds</option>
                      <option value="check-in">Check-in</option>
                      <option value="audits">Audits</option>
                      <option value="analytics">Analytics</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 font-bold">Notifications</p>
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 space-y-4">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">New vehicles flagged</span>
                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${prefs.notifyNewFlags ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${prefs.notifyNewFlags ? 'translate-x-5' : 'translate-x-1'}`} />
                      <input type="checkbox" className="sr-only" checked={prefs.notifyNewFlags} onChange={e => updatePref('notifyNewFlags', e.target.checked)} />
                    </div>
                  </label>
                  <div className="w-full h-px bg-gray-200 dark:bg-gray-700/50"></div>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Recently released</span>
                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${prefs.notifyReleases ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${prefs.notifyReleases ? 'translate-x-5' : 'translate-x-1'}`} />
                      <input type="checkbox" className="sr-only" checked={prefs.notifyReleases} onChange={e => updatePref('notifyReleases', e.target.checked)} />
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
