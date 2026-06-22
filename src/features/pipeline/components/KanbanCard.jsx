import React from 'react';
import { Ico } from '../../../components/icons.jsx';
import { getChecklistStatus } from '../../../utils/checklist.js';
import { daysUntil } from '../../../utils/dates.js';
import AssigneeButton from './AssigneeButton.jsx';

export default function KanbanCard({ client, staff, onAssignBCBA, onAssignRBT, onSelectClient, isNew, currentUser }) {
  const bcba     = staff.find(s => s.id === client.bcba_id) || null;
  const rbt      = staff.find(s => s.id === client.rbt_id)  || null;
  const showRBT  = client.stage === 'staffing' || client.stage === 'services';
  const status   = getChecklistStatus(client, staff);
  const isDenied      = client.stage === 'denied';
  const denialCount   = client.denial_count ?? 0;
  const showDenialTag = denialCount > 0 && !isDenied; // only on non-denied cards (denied stage has its own banner)

  // Auth expiry banner for Services — date-threshold driven
  let authBanner = null;
  if (client.stage === 'services' && client.auth_expiry_date) {
    const days = daysUntil(client.auth_expiry_date);
    if (days <= 14)      authBanner = { days, urgent: true };
    else if (days <= 30) authBanner = { days, urgent: false };
  }

  // RBT cert expiry warning — shown when RBT is assigned and cert expires within 30 days
  let rbtCertWarn = null;
  if (rbt && rbt.cert_expiry) {
    const certDays = Math.ceil((new Date(rbt.cert_expiry) - new Date()) / 86_400_000);
    if (certDays <= 0)  rbtCertWarn = { label: `${rbt.name.split(' ')[0]}'s cert expired`, urgent: true };
    else if (certDays <= 30) rbtCertWarn = { label: `${rbt.name.split(' ')[0]}'s cert exp. in ${certDays}d`, urgent: false };
  }

  const handleClick = e => {
    if (e.target.closest('[data-no-nav]')) return;
    onSelectClient(client);
  };

  return (
    <div
      onClick={handleClick}
      className={`bg-white rounded-lg border cursor-pointer group transition-all duration-150
        ${isNew ? 'ring-2 ring-teal-400 ring-offset-1 shadow-sm' : 'border-stone-200 hover:border-teal-200 hover:shadow-sm'}`}
      data-testid={`card-${client.id}`}
    >
      {/* Denied banner */}
      {isDenied && (
        <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-0">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
            <Ico.X/> Denied{denialCount > 1 ? ` ×${denialCount}` : ''}
          </span>
          {client.denial_from_stage === 'auth_assessment' && (
            <span className="text-[9px] text-red-400 font-medium">from Auth Assessment</span>
          )}
        </div>
      )}

      {/* Reauth cycle badge — shown on any stage when client is in a reauth cycle */}
      {(client.reauth_cycle ?? 0) > 0 && (
        <div className="px-3 pt-2.5 pb-0">
          <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded">
            ↻ Reauth Cycle {client.reauth_cycle}
          </span>
        </div>
      )}

      <div className="px-3 pt-2.5 pb-2">
        {/* Name + insurer */}
        <div className="mb-2">
          <div className="flex items-start justify-between gap-1">
            <div data-testid={`card-name-${client.id}`} className="font-medium text-slate-900 text-[13px] leading-tight group-hover:text-teal-700 transition-colors">
              {client.name}
            </div>
            {showDenialTag && (
              <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
                style={{ background:'#FEF3C7', color:'#92400E' }}
                title={`Denied ${denialCount} time${denialCount !== 1 ? 's' : ''} — see activity log`}>
                ↩ ×{denialCount}
              </span>
            )}
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

      {/* RBT cert expiry warning */}
      {rbtCertWarn && (
        <div className={`mx-2 mb-2 px-2 py-1 rounded-md flex items-center gap-1.5 text-[10px] font-semibold
          ${rbtCertWarn.urgent ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
          <Ico.Warn/>
          {rbtCertWarn.label}
        </div>
      )}

      {/* Status badge */}
      {status && (
        <div className={`mx-2 mb-2 px-2 py-1 rounded-md flex items-center gap-1.5 text-[10px] font-semibold
          ${status.type==='ready'   ? 'bg-green-50 text-green-700'
          : status.type==='waiting' ? 'bg-amber-50 text-amber-700'
          : 'bg-red-50 text-red-600'}`}>
          {status.type==='ready'   && <><Ico.Check/> Ready to advance</>}
          {status.type==='waiting' && client.stage === 'auth_assessment' && <><Ico.Clock/> Day {status.days} · waiting on insurer</>}
          {status.type==='waiting' && client.stage !== 'auth_assessment' && <><Ico.Clock/> Day {status.days} · {status.count} item{status.count !== 1 ? 's' : ''} missing</>}
          {status.type==='missing' && <><Ico.Warn/> {status.count} item{status.count !== 1 ? 's' : ''} missing</>}
        </div>
      )}
    </div>
  );
}
