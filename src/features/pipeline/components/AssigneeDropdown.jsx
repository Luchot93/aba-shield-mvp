import React, { useEffect, useRef } from 'react';
import Avatar from '../../../components/Avatar.jsx';
import { Ico } from '../../../components/icons.jsx';

export default function AssigneeDropdown({ staff, role, currentId, onAssign, onClose }) {
  const ref = useRef(null);
  const today = Date.now();
  const warn60 = today + 60*24*60*60*1000;

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const filtered = staff.filter(s => s.role === role);

  return (
    <div ref={ref}
      className="absolute z-50 top-full left-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden"
      style={{ width:'220px' }}
      data-no-nav
      data-testid={`assignee-dropdown-${role}`}>
      <div className="px-3 py-2 border-b border-stone-100">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Assign {role.toUpperCase()}
        </span>
      </div>
      {filtered.map(s => {
        const expDate  = new Date(s.cert_expiry).getTime();
        const expired  = expDate < today;
        const expiring = !expired && expDate <= warn60;
        const active   = s.id === currentId;
        return (
          <button key={s.id}
            onClick={e => { e.stopPropagation(); if (!expired) { onAssign(s.id); onClose(); } }}
            disabled={expired}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors
              ${expired ? 'opacity-40 cursor-not-allowed' : 'hover:bg-stone-50 cursor-pointer'}
              ${active ? 'bg-teal-50/80' : ''}`}>
            <Avatar initials={s.initials} role={role} size="sm"/>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-800 truncate">{s.name}</div>
              <div className="text-[10px] text-slate-400">{s.active_case_count} active cases</div>
            </div>
            {active && <span className="text-teal-600"><Ico.Check/></span>}
            {expiring && !expired && <span className="text-[9px] text-amber-600 font-semibold whitespace-nowrap">Cert exp.</span>}
            {expired && <span className="text-[9px] text-red-500 font-semibold">Expired</span>}
          </button>
        );
      })}
      {currentId && (
        <button onClick={e => { e.stopPropagation(); onAssign(null); onClose(); }}
          className="w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-stone-50 border-t border-stone-100">
          Remove assignment
        </button>
      )}
    </div>
  );
}
