import React, { useState } from 'react';
import { Ico } from '../../../components/icons.jsx';

const CERT_TOOLTIP = 'Professional certification only (BCBA or RBT credential). Staff training deadlines are tracked separately.';

function CertTooltip({ children }) {
  return (
    <span className="relative inline-flex items-center group/cert">
      {children}
      <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-64 rounded-md bg-slate-700 px-2.5 py-1.5 text-[10px] leading-snug text-slate-100 opacity-0 group-hover/cert:opacity-100 transition-opacity duration-150 z-50 shadow-lg text-center whitespace-normal">
        {CERT_TOOLTIP}
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-700"/>
      </span>
    </span>
  );
}

const TODAY_MS  = () => Date.now();
const WARN60_MS = () => TODAY_MS() + 60 * 24 * 60 * 60 * 1000;

function certStatus(cert_expiry) {
  if (!cert_expiry) return 'ok';
  const exp = new Date(cert_expiry).getTime();
  if (exp < TODAY_MS())    return 'expired';
  if (exp <= WARN60_MS())  return 'expiring';
  return 'ok';
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month:'short', year:'numeric' });
}

function fmtDateFull(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

// P2: Extracted initialEditForm helper — used both on mount and cancel
function getInitialEditForm(member) {
  return {
    cert_number:         member.cert_number         || '',
    cert_expiry:         member.cert_expiry         || '',
    cert_effective_date: member.cert_effective_date || '',
    status:              member.status,
    npi:                 member.npi                 || '',
    caqh_id:             member.caqh_id             || '',
    hire_date:           member.hire_date            || '',
    supervisor:          member.supervisor           || '',
    title:               member.title               || '',
  };
}

// UX4: Edit form field validation (warnings, not blocking)
function getEditWarnings(form) {
  const w = {};
  if (form.npi && !/^\d{10}$/.test(form.npi.replace(/[\s-]/g, ''))) {
    w.npi = 'NPI should be exactly 10 digits';
  }
  if (form.cert_expiry && new Date(form.cert_expiry).getTime() < Date.now()) {
    w.cert_expiry = 'Cert expiry is in the past';
  }
  return w;
}

export default function StaffCard({ member, clients, onEdit, currentUser, onSelectClient }) {
  const [expanded, setExpanded] = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [editForm, setEditForm] = useState(() => getInitialEditForm(member));
  const [editWarn, setEditWarn] = useState({});    // UX4: validation warnings

  const isAdmin = currentUser?.role === 'admin';
  const cs = certStatus(member.cert_expiry);

  const assigned = clients.filter(c => c.bcba_id === member.id || c.rbt_id === member.id);

  const rc = member.role === 'bcba'
    ? { bg:'#F0FDFA', text:'#0F766E', border:'#CCFBF1', avatarBg:'bg-teal-50 text-teal-700 border-teal-200' }
    : member.role === 'bcaba'
    ? { bg:'#F0FDFA', text:'#0F766E', border:'#CCFBF1', avatarBg:'bg-teal-50 text-teal-700 border-teal-200' }
    : member.role === 'admin'
    ? { bg:'#FAF5FF', text:'#6D28D9', border:'#DDD6FE', avatarBg:'bg-purple-50 text-purple-700 border-purple-200' }
    : { bg:'#EFF6FF', text:'#1D4ED8', border:'#BFDBFE', avatarBg:'bg-blue-50 text-blue-700 border-blue-200' };

  const setF = (k, v) => {
    setEditForm(f => ({ ...f, [k]:v }));
    // UX4: clear warning for this field as the user edits
    if (editWarn[k]) setEditWarn(w => { const n = { ...w }; delete n[k]; return n; });
  };

  const handleEditSave = () => {
    const warnings = getEditWarnings(editForm);
    setEditWarn(warnings);
    // Warnings are shown inline but don't block saving
    onEdit(member.id, editForm);
    setEditing(false);
    setEditWarn({});
  };

  const handleEditCancel = () => {
    setEditing(false);
    setEditForm(getInitialEditForm(member));  // P2: reuse helper
    setEditWarn({});
  };

  const hasCreds = member.cert_number || member.npi;

  return (
    <div className={`bg-white border rounded-xl transition-all duration-200 overflow-hidden ${expanded ? 'border-teal-200 shadow-md' : 'border-stone-200 hover:border-stone-300 hover:shadow-sm'}`}
      data-testid={`staff-card-${member.id}`}>
      {/* Card header */}
      <div className="p-4 cursor-pointer" onClick={() => { if (!editing) setExpanded(e => !e); }}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 border ${rc.avatarBg}`}>
            {member.initials || member.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-900 truncate">{member.name}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ background:rc.bg, color:rc.text, borderColor:rc.border }}>
                {member.role.toUpperCase()}
              </span>
              {member.status === 'active'
                ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">Active</span>
                : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                    <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                    Invite pending
                  </span>
              }
              {/* UX5: Use fmtDateFull instead of raw ISO string in collapsed cert badges */}
              {cs === 'expired'  && <CertTooltip><span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-red-50 text-red-700 border-red-200">Expired {fmtDateFull(member.cert_expiry)}</span></CertTooltip>}
              {cs === 'expiring' && <CertTooltip><span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">Expiring {fmtDateFull(member.cert_expiry)}</span></CertTooltip>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xl font-bold" style={{ color: member.active_case_count > 0 ? '#0D9488' : '#CBD5E1', fontFamily:'Syne, sans-serif' }}>
              {member.active_case_count}
            </div>
            <div className="text-[10px] text-slate-400">active cases</div>
          </div>
        </div>

        {member.cert_number && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <Ico.Cert/>
            <span className="text-[11px] text-slate-500" style={{ fontFamily:'DM Mono, monospace' }}>{member.cert_number}</span>
          </div>
        )}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-stone-100 px-4 pb-4 pt-3 space-y-3" data-testid={`staff-expanded-${member.id}`}>

          {!editing ? (
            <>
              {/* Title */}
              {member.title && (
                <p className="text-[11px] text-slate-500 font-medium -mt-0.5">{member.title}</p>
              )}

              {/* Email */}
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <span className="text-xs text-slate-600" style={{ fontFamily:'DM Mono, monospace' }}>{member.email}</span>
              </div>

              {/* Phone */}
              {member.phone && (
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                  <span className="text-xs text-slate-600" style={{ fontFamily:'DM Mono, monospace' }}>{member.phone}</span>
                </div>
              )}

              {/* Hire date */}
              {member.hire_date && (
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <span className="text-xs text-slate-600">Joined {fmtDate(member.hire_date)}</span>
                </div>
              )}

              {/* Supervisor */}
              {member.supervisor && (
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold mr-0.5">Supervisor</span>
                  <span className="text-xs text-slate-700 font-medium">{member.supervisor}</span>
                </div>
              )}

              {/* Credentials block */}
              {hasCreds && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Credentials</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-stone-50 rounded-lg px-3 py-2">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Cert #</div>
                      <div className="font-medium text-slate-700" style={{ fontFamily:'DM Mono, monospace' }}>{member.cert_number || '—'}</div>
                    </div>
                    <div className="bg-stone-50 rounded-lg px-3 py-2">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Effective</div>
                      <div className="font-medium text-slate-700" style={{ fontFamily:'DM Mono, monospace' }}>{fmtDateFull(member.cert_effective_date)}</div>
                    </div>
                    <div className="bg-stone-50 rounded-lg px-3 py-2">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Expires</div>
                      <div className={`font-medium ${cs==='expired'?'text-red-600':cs==='expiring'?'text-amber-600':'text-slate-700'}`} style={{ fontFamily:'DM Mono, monospace' }}>
                        {fmtDateFull(member.cert_expiry) || '—'}
                      </div>
                    </div>
                    <div className="bg-stone-50 rounded-lg px-3 py-2">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">NPI</div>
                      <div className="font-medium text-slate-700" style={{ fontFamily:'DM Mono, monospace' }}>{member.npi || '—'}</div>
                    </div>
                  </div>
                  {member.caqh_id && (
                    <div className="mt-2 bg-stone-50 rounded-lg px-3 py-2">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">CAQH</div>
                      <div className="font-medium text-slate-700 text-xs" style={{ fontFamily:'DM Mono, monospace' }}>{member.caqh_id}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Assigned Clients */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Assigned Clients</div>
                {assigned.length === 0
                  ? <p className="text-xs text-slate-400 italic">No clients assigned</p>
                  : <div className="flex flex-wrap gap-1.5">
                      {assigned.map(c => (
                        <button key={c.id}
                          onClick={e => { e.stopPropagation(); onSelectClient?.(c); }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100 underline decoration-teal-300 underline-offset-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 hover:decoration-blue-400 transition-colors">
                          {c.name}
                        </button>
                      ))}
                    </div>
                }
              </div>

              {isAdmin && (
                <button onClick={e => { e.stopPropagation(); setEditing(true); }}
                  data-testid={`edit-staff-${member.id}`}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 border border-stone-200 bg-stone-50 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                  </svg>
                  Edit
                </button>
              )}
            </>
          ) : (
            /* ── Edit form ── */
            <div className="space-y-3" data-testid={`edit-form-${member.id}`} onClick={e => e.stopPropagation()}>
              {/* Title */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Title</label>
                <input value={editForm.title} onChange={e => setF('title', e.target.value)}
                  placeholder="e.g. Clinical Director"
                  className="w-full px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Cert number</label>
                  <input value={editForm.cert_number} onChange={e => setF('cert_number', e.target.value)}
                    data-testid={`edit-cert-number-${member.id}`}
                    className="w-full px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100" style={{ fontFamily:'DM Mono, monospace' }}/>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Cert effective</label>
                  <input type="date" value={editForm.cert_effective_date} onChange={e => setF('cert_effective_date', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"/>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Cert expiry</label>
                  <input type="date" value={editForm.cert_expiry} onChange={e => setF('cert_expiry', e.target.value)}
                    data-testid={`edit-cert-expiry-${member.id}`}
                    className={`w-full px-2.5 py-1.5 text-xs border rounded-lg outline-none focus:ring-2 ${
                      editWarn.cert_expiry
                        ? 'border-amber-400 focus:border-amber-400 focus:ring-amber-100'
                        : 'border-stone-200 focus:border-teal-400 focus:ring-teal-100'
                    }`}/>
                  {/* UX4: Past expiry warning */}
                  {editWarn.cert_expiry && (
                    <p className="mt-0.5 text-[10px] text-amber-600 flex items-center gap-0.5">
                      <svg className="w-2.5 h-2.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                      </svg>
                      {editWarn.cert_expiry}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Status</label>
                  <select value={editForm.status} onChange={e => setF('status', e.target.value)}
                    data-testid={`edit-status-${member.id}`}
                    className="w-full px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg outline-none focus:border-teal-400 bg-white">
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">NPI</label>
                  <input value={editForm.npi} onChange={e => setF('npi', e.target.value)}
                    placeholder="10-digit NPI"
                    className={`w-full px-2.5 py-1.5 text-xs border rounded-lg outline-none focus:ring-2 ${
                      editWarn.npi
                        ? 'border-amber-400 focus:border-amber-400 focus:ring-amber-100'
                        : 'border-stone-200 focus:border-teal-400 focus:ring-teal-100'
                    }`}
                    style={{ fontFamily:'DM Mono, monospace' }}/>
                  {/* UX4: NPI digit-count warning */}
                  {editWarn.npi && (
                    <p className="mt-0.5 text-[10px] text-amber-600 flex items-center gap-0.5">
                      <svg className="w-2.5 h-2.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                      </svg>
                      {editWarn.npi}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Hire date</label>
                  <input type="date" value={editForm.hire_date} onChange={e => setF('hire_date', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"/>
                </div>
                {member.role !== 'bcba' && member.role !== 'admin' && (
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Supervisor</label>
                    <input value={editForm.supervisor} onChange={e => setF('supervisor', e.target.value)}
                      placeholder="Supervisor name"
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"/>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleEditSave} data-testid={`save-staff-${member.id}`}
                  className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90"
                  style={{ background:'#0D9488' }}>Save</button>
                <button onClick={handleEditCancel}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-stone-200 bg-stone-50 rounded-lg hover:bg-stone-100">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
