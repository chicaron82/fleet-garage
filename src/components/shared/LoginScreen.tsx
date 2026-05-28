import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hapticHeavy } from '../../lib/haptics';

export function LoginScreen() {
  const { login } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await login(employeeId.trim(), password);
    if (!ok) { hapticHeavy(); setError('Invalid Employee ID or password.'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col px-4 overflow-y-auto" style={{ backgroundColor: '#1a5c3a' }}>
      <div className="flex-1 min-h-[2rem]" />

      <div className="w-full max-w-sm mx-auto flex-none flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/fleet-garage-logo.webp"
            alt="Fleet Garage"
            className="w-64 select-none"
            draggable={false}
          />
          <p className="text-sm mt-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Winnipeg Logistics Hub · Ops Pilot Program
          </p>
        </div>

        {/* Frosted glass card */}
        <div
          className="w-full rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          <h1 className="text-lg font-semibold mb-1 text-white">Sign in</h1>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Use your Hertz Employee ID
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Employee ID
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value.toUpperCase())}
                placeholder="e.g. 331965"
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-lg uppercase focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-12 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
                  style={{
                    background: 'rgba(255,255,255,0.10)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 transition-opacity hover:opacity-100 cursor-pointer text-lg leading-none pt-0.5"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? '🫣' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs rounded-lg px-3 py-2" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!employeeId || !password || loading}
              className="w-full py-2.5 font-semibold text-sm rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed"
              style={{
                background: !employeeId || !password || loading ? 'rgba(255,255,255,0.15)' : '#facc15',
                color: !employeeId || !password || loading ? 'rgba(255,255,255,0.4)' : '#000',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>

      <div className="flex-1 min-h-[2rem]" />
    </div>
  );
}
