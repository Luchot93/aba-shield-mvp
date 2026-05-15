import React, { useState } from 'react';
import Avatar from '../../../components/Avatar.jsx';
import { Ico } from '../../../components/icons.jsx';
import AssigneeDropdown from './AssigneeDropdown.jsx';

export default function AssigneeButton({ label, assignee, role, staff, onAssign, currentUser }) {
  const [open, setOpen] = useState(false);
  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="relative flex items-center gap-1.5" data-no-nav>
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-7 flex-shrink-0">{label}</span>
      <button
        onClick={e => { e.stopPropagation(); if (isAdmin) setOpen(o => !o); }}
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs transition-colors flex-1 min-w-0
          ${isAdmin ? 'hover:bg-stone-100 cursor-pointer' : 'cursor-default'}
          ${assignee ? 'text-slate-700' : 'text-slate-400'}`}
        data-no-nav>
        {assignee
          ? <><Avatar initials={assignee.initials} role={role} size="sm"/>
              <span className="truncate font-medium">{assignee.name.replace('Dr. ','')}</span>
              {isAdmin && <Ico.ChevronDown/>}</>
          : <span className="text-teal-600 font-medium">{isAdmin ? '+ Assign' : '—'}</span>
        }
      </button>
      {open && (
        <AssigneeDropdown
          staff={staff}
          role={role}
          currentId={assignee?.id}
          onAssign={onAssign}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
