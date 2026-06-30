import React, { useState } from 'react';
import { Ico } from '../components/icons.jsx';
import { supabase } from '../lib/supabase.js';

export default function LoginPage({ onLogin }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    const user = data.user;
    onLogin({ id: user.id, email: user.email, name: user.email, role: user.user_metadata?.role ?? 'admin' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0B1220' }}>
      <div className="w-full bg-white rounded-2xl shadow-2xl p-8" style={{ maxWidth: '400px' }}>

        {/* Logo — same markup as NavBar */}
        <div className="flex items-center gap-2" style={{ fontFamily: 'Syne, sans-serif' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
            style={{ background: '#0D9488' }}>
            <Ico.Shield />
          </div>
          <span className="font-bold text-[15px] tracking-tight text-slate-900">
            ABA <span style={{ color: '#0D9488' }}>Shield</span>
          </span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mt-6 mb-1"
          style={{ fontFamily: 'Syne, sans-serif' }}>
          Sign in
        </h1>
        <p className="text-sm text-slate-400 mb-6">ABA workflow management</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 text-slate-900 placeholder:text-slate-400"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 text-slate-900"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            data-testid="login-submit"
            disabled={loading}
            className="w-full py-2.5 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: '#0D9488' }}>
            {loading && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}
        </form>

        {/* Dev helper — simulate receiving an invite email */}
        <div className="mt-6 pt-5 border-t border-stone-100 text-center">
          <p className="text-[11px] text-slate-400 mb-2">For demo purposes only</p>
          <a
            href="?invite=true"
            className="text-xs font-medium text-teal-600 hover:text-teal-800 transition-colors">
            Test invite flow →
          </a>
        </div>
      </div>
    </div>
  );
}
