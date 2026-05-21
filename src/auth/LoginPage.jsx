import React, { useState } from 'react';
import { Ico } from '../components/icons.jsx';
import { SEED_USERS } from '../constants/seedData.js';

const VALID_EMAIL    = 'admin@abashield.com';
const VALID_PASSWORD = 'admin123';

export default function LoginPage({ onLogin }) {
  const [email,    setEmail]    = useState(VALID_EMAIL);
  const [password, setPassword] = useState(VALID_PASSWORD);
  const [error,    setError]    = useState('');

  const handleSubmit = e => {
    e.preventDefault();
    if (email === VALID_EMAIL && password === VALID_PASSWORD) {
      setError('');
      onLogin(SEED_USERS[0]);
    } else {
      setError('Invalid email or password');
    }
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
            className="w-full py-2.5 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity"
            style={{ background: '#0D9488' }}>
            Sign in
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
