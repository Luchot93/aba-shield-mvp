import React, { useRef, useState } from 'react';
import { SECTION_ORDER, SECTION_CONFIG } from './sectionConfig.js';
import DocumentSection from './components/DocumentSection.jsx';
import { sectionsWithChanges } from './assessmentStore.js';
import { regenerateSections } from './lib/runGeneration.js';

// ─── Segment approval bar ─────────────────────────────────────────────────────

function ApprovalBar({ session }) {
  // Demographics is auto-confirmed (no AI draft) — include it so bar always shows 12
  const sections = SECTION_ORDER;
  const total    = sections.length;

  const counts = sections.reduce(
    (acc, key) => {
      const state = session?.sections?.[key]?.approvalState ?? 'pending';
      if (state === 'approved') acc.approved++;
      else if (state === 'skipped') acc.skipped++;
      return acc;
    },
    { approved: 0, skipped: 0 },
  );

  const done = counts.approved + counts.skipped;

  return (
    <div
      className="flex-shrink-0 px-6 py-3 border-b border-stone-200 bg-white"
      style={{ fontFamily: 'DM Sans, sans-serif' }}>

      <div className="flex items-center justify-between mb-2">
        <p className="text-[12px] font-semibold text-slate-600">
          <span className="text-teal-600">{done}</span>
          <span className="text-slate-400"> / {total} sections reviewed</span>
        </p>
        <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-400">
          {counts.approved > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#34D399' }}/>
              {counts.approved} approved
            </span>
          )}
          {counts.skipped > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#94A3B8' }}/>
              {counts.skipped} skipped
            </span>
          )}
        </div>
      </div>

      {/* Segmented bar */}
      <div className="flex gap-0.5 h-2">
        {sections.map(key => {
          const state = session?.sections?.[key]?.approvalState ?? 'pending';
          let bg = '#E2E8F0'; // pending
          if (state === 'approved') bg = '#34D399';
          else if (state === 'skipped') bg = '#94A3B8';
          else if (state === 'edited')  bg = '#FBBF24';

          return (
            <div
              key={key}
              className="flex-1 rounded-sm transition-colors duration-300"
              style={{ background: bg }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── AssessmentReviewPage ─────────────────────────────────────────────────────

export default function AssessmentReviewPage({
  clientId, clients, setClients, currentUser, session, addNotif, onNavigate,
}) {
  const scrollRef = useRef(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [confirmEdited, setConfirmEdited]   = useState(false);

  if (!session) return null;

  // Show all 11 sections in the document (demographics as first)
  const documentSections = SECTION_ORDER;

  // Sections whose form inputs changed since their draft was generated.
  const changed     = sectionsWithChanges(session);
  const changedKeys = new Set(changed.map(s => s.key));
  // Of those, which carry manual edits that a regenerate would overwrite.
  const editedChanged = changed.filter(s => session.sections?.[s.key]?.wasEdited);

  const runRegenerate = async () => {
    setConfirmEdited(false);
    setIsRegenerating(true);
    const clientName = clients?.find(c => c.id === clientId)?.name ?? 'the client';
    try {
      await regenerateSections({
        session, clientId, clientName, setClients,
        only: changed.map(s => s.key),
      });
      addNotif?.({ type: 'success', message: `Updated ${changed.length} section${changed.length !== 1 ? 's' : ''} — re-approve to export.` });
    } catch (err) {
      console.error('[AssessmentReviewPage.regenerate]', err);
      addNotif?.({ type: 'error', message: `Section update failed: ${err.message}` });
    }
    setIsRegenerating(false);
  };

  const handleRegenerate = () => {
    if (changed.length === 0) return;
    // Warn before overwriting any hand-edited section.
    if (editedChanged.length > 0) { setConfirmEdited(true); return; }
    runRegenerate();
  };

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* Sticky approval summary */}
      <ApprovalBar session={session} />

      {/* Scrollable document area */}
      <div ref={scrollRef} data-review-scroll className="flex-1 overflow-y-auto bg-stone-50">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col gap-4">

          {/* Page title */}
          <div className="mb-1">
            <h2 className="text-[17px] font-bold text-slate-800">Assessment Document</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">
              Review each section, edit as needed, then approve. Export when all sections are reviewed.
            </p>
          </div>

          {/* Changes-available banner — only sections whose inputs changed */}
          {changed.length > 0 && (
            <div className="rounded-xl border px-5 py-4"
              style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.30)' }}>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="#B45309" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <div className="flex-1">
                  <p className="text-[13px] font-bold" style={{ color: '#92400E' }}>
                    {changed.length} section{changed.length !== 1 ? 's have' : ' has'} updated data
                  </p>
                  <p className="text-[12px] leading-relaxed mt-0.5" style={{ color: '#B45309' }}>
                    {changed.map(s => s.title).join(', ')} changed since this draft was generated. Regenerate to refresh the wording, or edit the text directly below.
                  </p>

                  {confirmEdited ? (
                    <div className="mt-3 rounded-lg border bg-white px-3 py-2.5" style={{ borderColor: 'rgba(245,158,11,0.35)' }}>
                      <p className="text-[12px] font-semibold text-slate-700">
                        This replaces your manual edits in: {editedChanged.map(s => s.title).join(', ')}.
                      </p>
                      <div className="flex items-center gap-2 mt-2.5">
                        <button
                          onClick={runRegenerate}
                          className="px-3 py-1.5 text-xs font-bold text-white rounded-lg hover:opacity-90 transition-opacity"
                          style={{ background: '#B45309' }}>
                          Replace &amp; regenerate
                        </button>
                        <button
                          onClick={() => setConfirmEdited(false)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-500 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 transition-all">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
                      style={{ background: '#B45309' }}>
                      {isRegenerating ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3}/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        </svg>
                      )}
                      {isRegenerating
                        ? 'Updating…'
                        : `Regenerate ${changed.length} changed section${changed.length !== 1 ? 's' : ''}`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {documentSections.map(key => (
            <DocumentSection
              key={key}
              clientId={clientId}
              sectionKey={key}
              session={session}
              setClients={setClients}
              config={SECTION_CONFIG[key]}
              addNotif={addNotif}
              onNavigate={onNavigate}
              hasChanges={changedKeys.has(key)}
            />
          ))}

          {/* Bottom padding so last card isn't flush with screen edge */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
