import React, { useState } from 'react';
import { Ico } from '../components/icons.jsx';
import { supabase } from '../lib/supabase.js';

export default function SetPasswordPage({ invitedEmail, inviteError, onDone }) {
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    // The invite link already established a session, so updateUser writes the
    // chosen password (bcrypt-hashed) to auth.users. From here the user can log
    // out and back in with these credentials via the normal LoginPage.
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onDone();
  };

  const backToLogin = () => {
    window.history.replaceState({}, '', window.location.pathname);
    window.location.reload();
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
            ABA <span style={{ color: '#0D9488' }}>Vault</span>
          </span>
        </div>

        {inviteError ? (
          <>
            <h1 className="text-2xl font-bold text-slate-900 mt-6 mb-1"
              style={{ fontFamily: 'Syne, sans-serif' }}>
              Invite link expired
            </h1>
            <p className="text-sm text-slate-400 mb-6">
              This invite link has expired or has already been used. Ask your admin to send a new
              invite.
            </p>
            <button
              type="button"
              onClick={backToLogin}
              className="w-full py-2.5 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity"
              style={{ background: '#0D9488' }}>
              Back to login
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900 mt-6 mb-1"
              style={{ fontFamily: 'Syne, sans-serif' }}>
              Set your password
            </h1>
            <p className="text-sm text-slate-400 mb-6">You've been invited to ABA Vault</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email — read-only, pre-filled with the invited (session) address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={invitedEmail ?? ''}
                  readOnly
                  placeholder={invitedEmail ? '' : 'Loading…'}
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
                disabled={loading}
                className="w-full py-2.5 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: '#0D9488' }}>
                {loading && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                )}
                {loading ? 'Saving…' : 'Set password'}
              </button>

              {error && (
                <p className="text-sm text-red-600 text-center">{error}</p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
