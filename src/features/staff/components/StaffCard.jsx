import React, { useState } from 'react';
import { Ico } from '../../../components/icons.jsx';

const TODAY_MS  = () => Date.now();
const WARN60_MS = () => TODAY_MS() + 60 * 24 * 60 * 60 * 1000;

function certStatus(cert_expiry) {
  if (!cert_expiry) return 'ok';
  const exp = new Date(cert_expiry).getTime();
  if (exp < TODAY_MS())    return 'expired';
  if (exp <= WARN60_MS())  return 'expiring';
  return 'ok';
}

export default function StaffCard({ member, clients, onEdit, currentUser }) {
  const [expanded, setExpanded] = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [editForm, setEditForm] = useState({ cert_number: member.cert_number||'', cert_expiry: member.cert_expiry||'', status: member.status });
  const isAdmin = currentUser?.role === 'admin';
  const cs = certStatus(member.cert_expiry);

  const assigned = clients.filter(c => c.bcba_id === member.id || c.rbt_id === member.id);

  const rc = member.role === 'bcba'
    ? { bg:'#F0FDFA', text:'#0F766E', border:'#CCFBF1', avatarBg:'bg-teal-50 text-teal-700 border-teal-200' }
    : member.role === 'admin'
    ? { bg:'#FAF5FF', text:'#6D28D9', border:'#DDD6FE', avatarBg:'bg-purple-50 text-purple-700 border-purple-200' }
    : { bg:'#EFF6FF', text:'#1D4ED8', border:'#BFDBFE', avatarBg:'bg-blue-50 text-blue-700 border-blue-200' };

  const handleEditSave = () => {
    onEdit(member.id, editForm);
    setEditing(false);
  };

  return (
    <div className={`bg-white border rounded-xl transition-all duration-200 overflow-hidden ${expanded ? 'border-teal-200 shadow-md' : 'border-stone-200 hover:border-stone-300 hover:shadow-sm'}`}
      data-testid={`staff-card-${member.id}`}>
      {/* Card header */}
      <div className="p-4 cursor-pointer" onClick={() => { if(!editing) setExpanded(e => !e); }}>
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
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                member.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {member.status === 'active' ? 'Active' : 'Pending'}
              </span>
              {cs === 'expired'  && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-red-50 text-red-700 border-red-200">Expired {member.cert_expiry}</span>}
              {cs === 'expiring' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">Expiring {member.cert_expiry}</span>}
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
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <span className="text-xs text-slate-600" style={{ fontFamily:'DM Mono, monospace' }}>{member.email}</span>
              </div>

              {member.cert_number && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-stone-50 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Cert #</div>
                    <div className="font-medium text-slate-700" style={{ fontFamily:'DM Mono, monospace' }}>{member.cert_number}</div>
                  </div>
                  <div className="bg-stone-50 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Expires</div>
                    <div className={`font-medium ${cs==='expired'?'text-red-600':cs==='expiring'?'text-amber-600':'text-slate-700'}`} style={{ fontFamily:'DM Mono, monospace' }}>
                      {member.cert_expiry || '—'}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Assigned Clients</div>
                {assigned.length === 0
                  ? <p className="text-xs text-slate-400 italic">No clients assigned</p>
                  : <div className="flex flex-wrap gap-1.5">
                      {assigned.map(c => (
                        <span key={c.id} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                          {c.name}
                        </span>
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
            <div className="space-y-3" data-testid={`edit-form-${member.id}`} onClick={e => e.stopPropagation()}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Cert number</label>
                  <input value={editForm.cert_number} onChange={e => setEditForm(f=>({...f, cert_number:e.target.value}))}
                    data-testid={`edit-cert-number-${member.id}`}
                    className="w-full px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100" style={{ fontFamily:'DM Mono, monospace' }}/>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Cert expiry</label>
                  <input type="date" value={editForm.cert_expiry} onChange={e => setEditForm(f=>({...f, cert_expiry:e.target.value}))}
                    data-testid={`edit-cert-expiry-${member.id}`}
                    className="w-full px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wide">Status</label>
                  <select value={editForm.status} onChange={e => setEditForm(f=>({...f, status:e.target.value}))}
                    data-testid={`edit-status-${member.id}`}
                    className="w-full px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg outline-none focus:border-teal-400 bg-white">
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleEditSave} data-testid={`save-staff-${member.id}`}
                  className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90"
                  style={{ background:'#0D9488' }}>Save</button>
                <button onClick={() => { setEditing(false); setEditForm({ cert_number:member.cert_number||'', cert_expiry:member.cert_expiry||'', status:member.status }); }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-stone-200 bg-stone-50 rounded-lg hover:bg-stone-100">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
