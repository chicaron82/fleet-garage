import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function LoginScreen() {
  const { login } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      const ok = login(employeeId.trim(), password);
      if (!ok) setError('Invalid Employee ID or password.');
      setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 overflow-y-auto transition-colors text-gray-900 dark:text-gray-100">
      {/* Spacer pushing content down */}
      <div className="flex-1 min-h-[2rem]"></div>

      <div className="w-full max-w-sm mx-auto flex-none flex flex-col items-center">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 bg-yellow-400 dark:bg-yellow-500 rounded flex items-center justify-center transition-colors">
              <span className="text-black font-bold text-sm">FG</span>
            </div>
            <span className="text-xl font-semibold tracking-tight transition-colors">Fleet Garage</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors">Winnipeg Logistics Hub · Ops Pilot Program</p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 transition-colors">
          <h1 className="text-lg font-semibold mb-1 transition-colors">Sign in</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 transition-colors">Use your Hertz Employee ID</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide transition-colors">
                Employee ID
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value.toUpperCase())}
                placeholder="e.g. 331965"
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 dark:focus:ring-yellow-500 focus:border-transparent transition uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide transition-colors">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-12 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 dark:focus:ring-yellow-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer text-lg leading-none pt-0.5"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? '🫣' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-900/50 rounded-lg px-3 py-2 transition-colors">{error}</p>
            )}

            <button
              type="submit"
              disabled={!employeeId || !password || loading}
              className="w-full py-2.5 bg-yellow-400 dark:bg-yellow-500 hover:bg-yellow-300 dark:hover:bg-yellow-400 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 text-black font-semibold text-sm rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

        </div>
      </div>

      {/* Spacer pulling content up */}
      <div className="flex-1 min-h-[2rem]"></div>
    </div>
  );
}
