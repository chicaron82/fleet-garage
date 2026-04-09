import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function LoginScreen() {
  const { login } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4">

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-8 h-8 bg-yellow-400 rounded flex items-center justify-center">
            <span className="text-black font-bold text-sm">FG</span>
          </div>
          <span className="text-xl font-semibold text-gray-900 tracking-tight">Fleet Garage</span>
        </div>
        <p className="text-sm text-gray-500">Damage Hold Ledger · Chain of Custody</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Sign in</h1>
        <p className="text-sm text-gray-500 mb-6">Use your Hertz Employee ID</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
              Employee ID
            </label>
            <input
              type="text"
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value.toUpperCase())}
              placeholder="e.g. 331965"
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={!employeeId || !password || loading}
            className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-200 disabled:text-gray-400 text-black font-semibold text-sm rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Demo hint */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center mb-2">Demo accounts · password: <code className="bg-gray-100 px-1 rounded">demo</code></p>
          <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-500">
            <button onClick={() => { setEmployeeId('331965'); setPassword('demo'); }} className="text-left px-2 py-1.5 rounded hover:bg-gray-50 transition cursor-pointer">331965 · VSA</button>
            <button onClick={() => { setEmployeeId('VSA-003'); setPassword('demo'); }} className="text-left px-2 py-1.5 rounded hover:bg-gray-50 transition cursor-pointer">VSA-003 · Lead VSA</button>
            <button onClick={() => { setEmployeeId('CSR-001'); setPassword('demo'); }} className="text-left px-2 py-1.5 rounded hover:bg-gray-50 transition cursor-pointer">CSR-001 · CSR</button>
            <button onClick={() => { setEmployeeId('HIR-001'); setPassword('demo'); }} className="text-left px-2 py-1.5 rounded hover:bg-gray-50 transition cursor-pointer">HIR-001 · HIR</button>
            <button onClick={() => { setEmployeeId('MGR-001'); setPassword('demo'); }} className="text-left px-2 py-1.5 rounded hover:bg-gray-50 transition cursor-pointer">MGR-001 · Branch Mgr</button>
            <button onClick={() => { setEmployeeId('OPS-001'); setPassword('demo'); }} className="text-left px-2 py-1.5 rounded hover:bg-gray-50 transition cursor-pointer">OPS-001 · Ops Mgr</button>
          </div>
        </div>
      </div>
    </div>
  );
}
