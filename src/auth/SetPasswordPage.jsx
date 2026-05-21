import React, { useState } from 'react';
import { Ico } from '../components/icons.jsx';

export default function SetPasswordPage({ invitedEmail, onSetPassword }) {
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [error,     setError]     = useState('');

  const handleSubmit = e => {
    e.preventDefault();
    if (!password || !confirm) return;
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    onSetPassword();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0B1220' }}>
      <div className="w-full bg-white rounded-2xl shadow-2xl p-8" style={{ maxWidth: '400px' }}>

        {/* Logo — same as LoginPage / NavBar */}
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
          Set your password
        </h1>
        <p className="text-sm text-slate-400 mb-6">You've been invited to ABA Shield</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email — read-only, pre-filled with invited address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={invitedEmail}
              readOnly
              className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl text-slate-500 bg-slate-50 cursor-not-allowed opacity-75"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">New password</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Min. 8 characters"
              className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 text-slate-900 placeholder:text-slate-400"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(''); }}
              placeholder="Repeat your password"
              className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 text-slate-900 placeholder:text-slate-400"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity"
            style={{ background: '#0D9488' }}>
            Set password
          </button>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
