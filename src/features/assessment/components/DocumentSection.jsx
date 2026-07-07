import React from 'react';
import ConflictFlag from './ConflictFlag.jsx';
import InlineEditor from './InlineEditor.jsx';
import ActionRow from './ActionRow.jsx';
import { FLAGS } from '../../../constants/featureFlags.js';

// ─── Border & badge helpers ───────────────────────────────────────────────────

function effectiveBorder(approvalState) {
  switch (approvalState) {
    case 'approved': return { card: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.25)' };
    case 'skipped':  return { card: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.20)' };
    case 'edited':   return { card: 'rgba(251,191,36,0.06)',  border: 'rgba(251,191,36,0.20)'  };
    default:         return { card: '#fff',                    border: '#E7E5E4'                 };
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

// ─── Source provenance chips ──────────────────────────────────────────────────
// Shows clinicians exactly which form inputs fed this section's AI draft.

const STRUCTURED_SECTIONS = new Set([
  'demographics', 'communication', 'safety', 'medical_necessity',
  'crisis_plan', 'behavior_targets', 'skill_acquisitions', 'caregiver_training',
]);

function SourceChips({ section, sectionKey }) {
  // Transcript is only a real source when voice capture is enabled — gate the
  // chip with the same flag as RecordButton so drafts read "notes → AI draft".
  const hasTranscript  = FLAGS.VOICE_CAPTURE && !!(section?.transcript?.trim());
  const hasNotes       = !!(section?.notes?.trim());
  const hasStructured  = STRUCTURED_SECTIONS.has(sectionKey);

  // Only show if at least one source is present
  if (!hasTranscript && !hasNotes && !hasStructured) return null;

  const Chip = ({ icon, label, teal }) => (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={teal
        ? { background: 'rgba(20,184,166,0.10)', color: '#0D9488', border: '1px solid rgba(20,184,166,0.22)' }
        : { background: 'rgba(148,163,184,0.10)', color: '#64748B', border: '1px solid rgba(148,163,184,0.20)' }
      }>
      {icon}
      {label}
    </span>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2 pb-1">
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mr-0.5">
        Sourced from
      </span>
      {hasTranscript && (
        <Chip teal label="Transcript" icon={
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
          </svg>
        }/>
      )}
      {hasNotes && (
        <Chip teal label="Clinical notes" icon={
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        }/>
      )}
      {hasStructured && (
        <Chip teal label="Structured form" icon={
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
        }/>
      )}
    </div>
  );
}

// ─── DocumentSection ──────────────────────────────────────────────────────────

export default function DocumentSection({ clientId, sectionKey, session, setClients, config, addNotif, onNavigate, hasChanges }) {
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
        borderColor: colors.border,
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
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#92400E' }}>
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              Changes available
            </span>
          )}
          {badge && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
          )}
        </div>
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
          onNavigate={onNavigate}
        />

        {/* Source provenance chips — shows what data fed this section's draft */}
        <SourceChips section={section} sectionKey={sectionKey} />

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
