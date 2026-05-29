import React from 'react';
import ConflictFlag from './ConflictFlag.jsx';
import InlineEditor from './InlineEditor.jsx';
import ActionRow from './ActionRow.jsx';

// ─── Border & badge helpers ───────────────────────────────────────────────────

function effectiveBorder(approvalState) {
  switch (approvalState) {
    case 'approved': return { left: '#34D399', card: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.25)' };
    case 'skipped':  return { left: '#94A3B8', card: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.20)' };
    case 'edited':   return { left: '#FBBF24', card: 'rgba(251,191,36,0.06)',  border: 'rgba(251,191,36,0.20)'  };
    default:         return { left: '#E7E5E4', card: '#fff',                    border: '#E7E5E4'                 };
  }
}

function effectiveBadge(approvalState) {
  switch (approvalState) {
    case 'approved':
      return { label: 'Approved', bg: 'rgba(52,211,153,0.12)', color: '#065F46' };
    case 'skipped':
      return { label: 'Skipped',  bg: 'rgba(148,163,184,0.15)', color: '#475569' };
    case 'edited':
      return { label: 'Edited',   bg: 'rgba(251,191,36,0.12)',  color: '#92400E' };
    case 'pending':
      return { label: 'Pending',  bg: 'rgba(226,232,240,0.6)',  color: '#64748B' };
    default:
      return null;
  }
}

// ─── DocumentSection ──────────────────────────────────────────────────────────

export default function DocumentSection({ clientId, sectionKey, session, setClients, config, addNotif }) {
  const section       = session?.sections?.[sectionKey];
  if (!section) return null;

  const approvalState = section.approvalState ?? 'pending';
  const colors        = effectiveBorder(approvalState);
  const badge         = effectiveBadge(approvalState);
  const isSkillAcq    = sectionKey === 'skill_acquisitions';

  return (
    <div
      data-section-card
      className="rounded-xl border overflow-hidden"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: colors.left,
        borderTopColor: colors.border,
        borderRightColor: colors.border,
        borderBottomColor: colors.border,
        background: colors.card,
        fontFamily: 'DM Sans, sans-serif',
      }}>

      {/* Section header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b"
        style={{ borderColor: colors.border }}>
        <h3 className="text-sm font-bold text-slate-800"
          style={{ fontFamily: 'DM Sans, sans-serif' }}>
          {config?.title ?? sectionKey}
        </h3>
        {badge && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* Conflict flag */}
        <ConflictFlag section={section} />

        {/* Skill acquisitions info callout */}
        {isSkillAcq && (
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg mb-1"
            style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)' }}>
            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="#3B82F6" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p className="text-[11px] leading-relaxed" style={{ color: '#1D4ED8' }}>
              Skill acquisition goals were structured from your interview data. Edit individual goals using the structured editor, then approve when ready.
            </p>
          </div>
        )}

        {/* Inline editor */}
        <InlineEditor
          clientId={clientId}
          sectionKey={sectionKey}
          section={section}
          session={session}
          setClients={setClients}
        />

        {/* Action row */}
        <div className="pt-1 border-t" style={{ borderColor: colors.border }}>
          <ActionRow
            clientId={clientId}
            sectionKey={sectionKey}
            section={section}
            setClients={setClients}
          />
        </div>
      </div>
    </div>
  );
}
