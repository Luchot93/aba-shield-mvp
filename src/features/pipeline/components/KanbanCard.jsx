import React from 'react';
import { Ico } from '../../../components/icons.jsx';
import { getChecklistStatus } from '../../../utils/checklist.js';
import { daysUntil } from '../../../utils/dates.js';
import AssigneeButton from './AssigneeButton.jsx';

export default function KanbanCard({ client, staff, onAssignBCBA, onAssignRBT, onSelectClient, isNew, currentUser }) {
  const bcba     = staff.find(s => s.id === client.bcba_id) || null;
  const rbt      = staff.find(s => s.id === client.rbt_id)  || null;
  const showRBT  = client.stage === 'staffing' || client.stage === 'services';
  const status   = getChecklistStatus(client);
  const isDenied = client.stage === 'denied';

  // Auth expiry banner for Services
  let authBanner = null;
  if (client.stage === 'services' && client.auth_expiry_date) {
    const days = daysUntil(client.auth_expiry_date);
    if (days <= 14) authBanner = { days, urgent:true };
    else if (days <= 30) authBanner = { days, urgent:false };
  }

  const handleClick = e => {
    if (e.target.closest('[data-no-nav]')) return;
    onSelectClient(client);
  };

  return (
    <div
      onClick={handleClick}
      className={`bg-white rounded-lg border cursor-pointer group transition-all duration-200
        hover:shadow-md hover:-translate-y-px
        ${isNew ? 'ring-2 ring-teal-400 ring-offset-1 shadow-md' : 'border-stone-200 hover:border-stone-300'}`}
      data-testid={`card-${client.id}`}
    >
      {/* Denied banner */}
      {isDenied && (
        <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-0">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
            <Ico.X/> Denied
          </span>
        </div>
      )}

      {/* Services reauth label */}
      {client.stage === 'services' && client.reauth_active && (
        <div className="px-3 pt-2.5 pb-0">
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Services · Reauth</span>
        </div>
      )}

      <div className="px-3 pt-2.5 pb-2">
        {/* Name + insurer */}
        <div className="mb-2">
          <div data-testid={`card-name-${client.id}`} className="font-medium text-slate-900 text-[13px] leading-tight group-hover:text-teal-700 transition-colors">
            {client.name}
          </div>
          {isDenied && client.denial_reason && (
            <div className="text-[10px] text-red-500 mt-0.5 leading-tight">{client.denial_reason}</div>
          )}
          <div className="text-xs text-slate-500 mt-0.5">{client.insurer_name}</div>
        </div>

        {/* BCBA row */}
        <AssigneeButton
          label="BCBA"
          assignee={bcba}
          role="bcba"
          staff={staff}
          onAssign={id => onAssignBCBA(client.id, id)}
          currentUser={currentUser}
        />

        {/* RBT row — only staffing + services */}
        {showRBT && (
          <div className="mt-1">
            <AssigneeButton
              label="RBT"
              assignee={rbt}
              role="rbt"
              staff={staff}
              onAssign={id => onAssignRBT(client.id, id)}
              currentUser={currentUser}
            />
          </div>
        )}
      </div>

      {/* Auth expiry banner */}
      {authBanner && (
        <div className={`mx-2 mb-2 px-2 py-1 rounded-md flex items-center gap-1.5 text-[10px] font-semibold
          ${authBanner.urgent ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
          <Ico.Warn/>
          Reauth in {authBanner.days} days
        </div>
      )}

      {/* Status badge */}
      {status && (
        <div className={`mx-2 mb-2 px-2 py-1 rounded-md flex items-center gap-1.5 text-[10px] font-semibold
          ${status.type==='ready'   ? 'bg-green-50 text-green-700'
          : status.type==='waiting' ? 'bg-amber-50 text-amber-700'
          : 'bg-red-50 text-red-600'}`}>
          {status.type==='ready'   && <><Ico.Check/> Ready to advance</>}
          {status.type==='waiting' && <><Ico.Clock/> Day {status.days} waiting</>}
          {status.type==='missing' && <><Ico.Warn/> {status.count} items missing</>}
        </div>
      )}
    </div>
  );
}
