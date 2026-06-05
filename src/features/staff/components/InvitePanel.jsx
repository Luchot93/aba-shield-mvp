import React, { useState } from 'react';
import { Ico } from '../../../components/icons.jsx';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock.js';

// S1: existingEmails prop is a Set<string> of lowercase emails already in the system
export default function InvitePanel({ onClose, onInvite, pendingInvites, onRevoke, existingEmails = new Set() }) {
  useBodyScrollLock();
  const EMPTY = { name:'', email:'', phone:'', role:'', cert_number:'', cert_expiry:'', npi:'', hire_date:'' };
  const [form,       setForm]       = useState(EMPTY);
  const [emailError, setEmailError] = useState('');   // S1: inline duplicate error
  const [revokeId,   setRevokeId]   = useState(null);

  const roleReady = !!form.role;
  const canSubmit = form.name.trim() && form.email.trim() && form.role;

  const setF = (k, v) => setForm(f => ({ ...f, [k]:v }));

  const handleEmailChange = v => {
    setF('email', v);
    if (emailError) setEmailError('');   // clear error as user types
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    // S1: duplicate email check
    const emailLc = form.email.trim().toLowerCase();
    if (existingEmails.has(emailLc)) {
      setEmailError('A staff member with this email already exists.');
      return;
    }
    onInvite({ ...form });
    setForm(EMPTY);
    setEmailError('');
  };

  const ROLE_COLORS = {
    bcba:  'bg-teal-50 text-teal-700 border-teal-200',
    bcaba: 'bg-teal-50 text-teal-700 border-teal-200',
    rbt:   'bg-blue-50 text-blue-700 border-blue-200',
    admin: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background:'rgba(15,23,42,0.45)' }} data-testid="invite-panel">
      <div className="flex-1" onClick={onClose}/>
      <div className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900" style={{ fontFamily:'Syne, sans-serif' }}>Invite Staff Member</h2>
            <p className="text-xs text-slate-500 mt-0.5">They'll receive an email to set up their account</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 text-slate-400 hover:text-slate-600 transition-colors"><Ico.X/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Role first */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Role <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {[['bcba','BCBA'],['bcaba','BCaBA'],['rbt','RBT'],['admin','Admin']].map(([val, lbl]) => (
                <button key={val} onClick={() => setF('role', val)}
                  data-testid={`role-${val}`}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                    form.role === val
                      ? ROLE_COLORS[val]
                      : 'text-slate-500 border-stone-200 bg-white hover:border-slate-300'
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>
            {!roleReady && (
              <p className="text-[10px] text-slate-400 mt-1.5">Select a role to continue</p>
            )}
          </div>

          {/* Rest of form */}
          <div className={`space-y-3 transition-opacity ${roleReady ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full name <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setF('name', e.target.value)}
                  data-testid="invite-name"
                  placeholder="Dr. Jane Smith"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"/>
              </div>

              {/* S1: Email with inline duplicate error */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input value={form.email} onChange={e => handleEmailChange(e.target.value)}
                  data-testid="invite-email" type="email"
                  placeholder="jane@clinic.com"
                  className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-teal-100 ${
                    emailError ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-stone-200 focus:border-teal-400'
                  }`}/>
                {emailError && (
                  <p className="mt-1 text-[11px] text-red-600 font-medium flex items-center gap-1">
                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                    </svg>
                    {emailError}
                  </p>
                )}
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone number <span className="text-slate-400 font-normal">(optional)</span></label>
                <input value={form.phone} onChange={e => setF('phone', e.target.value)}
                  data-testid="invite-phone" type="tel"
                  placeholder="(555) 000-0000"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"/>
              </div>
              {form.role !== 'admin' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cert number</label>
                    <input value={form.cert_number} onChange={e => setF('cert_number', e.target.value)}
                      data-testid="invite-cert-number"
                      placeholder={form.role === 'bcba' ? 'BCBA-000000' : 'RBT-000000'}
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cert expiry</label>
                    <input value={form.cert_expiry} onChange={e => setF('cert_expiry', e.target.value)}
                      data-testid="invite-cert-expiry" type="date"
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"/>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      NPI number <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input value={form.npi} onChange={e => setF('npi', e.target.value)}
                      data-testid="invite-npi"
                      placeholder="10-digit NPI"
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                      style={{ fontFamily:'DM Mono, monospace' }}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Hire date <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input value={form.hire_date} onChange={e => setF('hire_date', e.target.value)}
                      data-testid="invite-hire-date" type="date"
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"/>
                  </div>
                </>
              )}
            </div>
          </div>

          <button onClick={handleSubmit} disabled={!canSubmit}
            data-testid="invite-submit"
            className="w-full py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            style={{ background:'#0D9488' }}>
            Send invite
          </button>

          {/* Pending invites list */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Pending Invites</span>
              <div className="flex-1 h-px bg-stone-100"/>
              {pendingInvites.length > 0 && (
                <span className="text-[10px] text-slate-400" style={{ fontFamily:'DM Mono, monospace' }}>{pendingInvites.length}</span>
              )}
            </div>
            {pendingInvites.length === 0
              ? <p className="text-xs text-center text-slate-400 py-4">No pending invites.</p>
              : <div className="space-y-2" data-testid="pending-invites-list">
                  {pendingInvites.map(inv => (
                    <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5 bg-stone-50 rounded-xl border border-stone-100">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border ${
                        inv.role==='bcba'||inv.role==='bcaba' ? 'bg-teal-50 text-teal-700 border-teal-200'
                        : inv.role==='rbt' ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {inv.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">{inv.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{inv.email} · <span className="uppercase font-semibold">{inv.role}</span></div>
                        <div className="text-[10px] text-slate-400" style={{ fontFamily:'DM Mono, monospace' }}>{new Date(inv.invited_at).toLocaleDateString()}</div>
                      </div>
                      {revokeId === inv.id
                        ? <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] text-slate-600">Revoke?</span>
                            <button onClick={() => { onRevoke(inv.id); setRevokeId(null); }}
                              className="text-[10px] font-semibold text-red-600 hover:underline">Yes</button>
                            <button onClick={() => setRevokeId(null)}
                              className="text-[10px] font-semibold text-slate-400 hover:underline">No</button>
                          </div>
                        : <button onClick={() => setRevokeId(inv.id)} data-testid={`revoke-${inv.id}`}
                            className="text-[10px] font-semibold text-red-500 hover:text-red-700 flex-shrink-0 border border-red-200 bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors">
                            Revoke
                          </button>
                      }
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
