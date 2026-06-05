import React, { useEffect, useRef } from 'react';
import { Ico } from '../../../components/icons.jsx';
import StagePill from '../../../components/StagePill.jsx';
import Avatar from '../../../components/Avatar.jsx';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock.js';

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ icon, label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      {icon && <span className="flex-shrink-0 mt-0.5 text-slate-400 w-3.5">{icon}</span>}
      <div className="min-w-0 flex-1">
        {label && <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block leading-tight mb-0.5">{label}</span>}
        <span
          className="text-xs text-slate-700 break-words"
          style={mono ? { fontFamily: 'DM Mono, monospace' } : {}}>
          {value}
        </span>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-stone-100 my-4" />;
}

export default function ClientProfilePanel({ client, staff, onClose, onOpenPipeline, onAddToPipeline }) {
  useBodyScrollLock();
  const panelRef = useRef(null);

  useEffect(() => {
    const h = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    // small delay so the open click doesn't immediately close
    const t = setTimeout(() => document.addEventListener('mousedown', h), 80);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [onClose]);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const bcba = staff?.find(s => s.id === client.bcba_id);
  const rbt  = staff?.find(s => s.id === client.rbt_id);

  const initials = client.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const dobFormatted = client.dob
    ? new Date(client.dob + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const referralFormatted = client.referral_date
    ? new Date(client.referral_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const genderLabel =
    client.gender === 'Male' ? 'Male' :
    client.gender === 'Female' ? 'Female' :
    client.gender || null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-[380px] bg-white shadow-2xl z-50 flex flex-col"
        style={{ borderLeft: '1px solid #E7E5E0' }}
        data-testid="client-profile-panel">

        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-stone-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: '#F0FDFA', color: '#0F766E', border: '1.5px solid #CCFBF1' }}>
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold text-slate-900 leading-snug truncate" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {client.name}
                </h2>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {genderLabel && (
                    <span className="text-[11px] text-slate-400 font-medium">{genderLabel}</span>
                  )}
                  {dobFormatted && (
                    <span className="text-[11px] text-slate-400" style={{ fontFamily: 'DM Mono, monospace' }}>
                      {dobFormatted}
                    </span>
                  )}
                  {client.icd10 && (
                    <span
                      className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(13,148,136,0.08)', color: '#0F766E', fontFamily: 'DM Mono, monospace' }}>
                      {client.icd10}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-stone-100 transition-colors mt-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Pipeline status */}
          <div className="mt-3 flex items-center gap-2">
            {client.pipeline_entry && client.stage ? (
              <>
                <StagePill stage={client.stage} />
                {onOpenPipeline && (
                  <button
                    onClick={onOpenPipeline}
                    className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 underline underline-offset-2 decoration-teal-300 transition-colors">
                    View in pipeline
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-stone-200 text-slate-500 bg-stone-50">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
                  </svg>
                  Directory only
                </span>
                {onAddToPipeline && (
                  <button
                    onClick={onAddToPipeline}
                    className="text-[11px] font-semibold text-teal-600 border border-teal-200 bg-teal-50 hover:bg-teal-100 px-2.5 py-0.5 rounded-lg transition-colors">
                    + Add to pipeline
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Diagnosis */}
          {(client.diagnosis || client.icd10) && (
            <>
              <Section title="Diagnosis">
                <Row value={client.diagnosis} />
                <Row label="ICD-10 Code" value={client.icd10} mono />
              </Section>
              <Divider />
            </>
          )}

          {/* Parent / Guardian */}
          {(client.parent_name || client.parent_email || client.phone) && (
            <>
              <Section title="Parent / Guardian">
                {client.parent_name && (
                  <div className="flex items-start gap-2.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block leading-tight mb-0.5">
                        {client.parent_relationship || 'Guardian'}
                      </span>
                      <span className="text-xs text-slate-700">{client.parent_name}</span>
                    </div>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                    </svg>
                    <a href={`tel:${client.phone}`} className="text-xs text-slate-700 hover:text-teal-600 transition-colors" style={{ fontFamily: 'DM Mono, monospace' }}>{client.phone}</a>
                  </div>
                )}
                {client.parent_email && (
                  <div className="flex items-center gap-2.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                    <a href={`mailto:${client.parent_email}`} className="text-xs text-teal-600 hover:underline" style={{ fontFamily: 'DM Mono, monospace' }}>
                      {client.parent_email}
                    </a>
                  </div>
                )}
                {client.preferred_language && client.preferred_language !== 'English' && (
                  <div className="flex items-center gap-2.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/>
                    </svg>
                    <span className="text-xs text-slate-700">{client.preferred_language}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-2.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <span className="text-xs text-slate-600">{client.address}</span>
                  </div>
                )}
              </Section>
              <Divider />
            </>
          )}

          {/* Insurance */}
          {(client.insurer_name || client.member_id) && (
            <>
              <Section title="Insurance">
                <Row label="Carrier" value={client.insurer_name} />
                <Row label="Health Plan" value={client.health_plan_name} />
                <Row label="Member ID" value={client.member_id} mono />
                <Row label="Group Number" value={client.group_number} mono />
              </Section>
              <Divider />
            </>
          )}

          {/* Referring Provider */}
          {(client.referring_provider || client.referring_provider_npi) && (
            <>
              <Section title="Referring Provider">
                <Row value={client.referring_provider} />
                <Row label="NPI" value={client.referring_provider_npi} mono />
                {client.referring_provider_phone && (
                  <div className="flex items-center gap-2.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                    </svg>
                    <span className="text-xs text-slate-700" style={{ fontFamily: 'DM Mono, monospace' }}>{client.referring_provider_phone}</span>
                  </div>
                )}
                {referralFormatted && (
                  <div className="flex items-center gap-2.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <span className="text-xs text-slate-500">Referred {referralFormatted}</span>
                  </div>
                )}
              </Section>
              <Divider />
            </>
          )}

          {/* Staff */}
          {(bcba || rbt) && (
            <Section title="Care Team">
              {bcba && (
                <div className="flex items-center gap-2">
                  <Avatar initials={bcba.initials} role="bcba" size="sm" />
                  <div>
                    <span className="text-xs font-medium text-slate-700">{bcba.name}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">BCBA</span>
                  </div>
                </div>
              )}
              {rbt && (
                <div className="flex items-center gap-2">
                  <Avatar initials={rbt.initials} role="rbt" size="sm" />
                  <div>
                    <span className="text-xs font-medium text-slate-700">{rbt.name}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">RBT</span>
                  </div>
                </div>
              )}
            </Section>
          )}

        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-stone-100">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${client.source === 'imported' ? 'bg-blue-400' : 'bg-teal-400'}`} />
            {client.source === 'imported' ? 'Imported from Excel/CSV' : 'Created in CRM'}
          </div>
        </div>
      </div>
    </>
  );
}
