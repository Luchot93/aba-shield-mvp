import React, { useRef } from 'react';
import { SECTION_ORDER, SECTION_CONFIG } from './sectionConfig.js';
import DocumentSection from './components/DocumentSection.jsx';

// ─── Segment approval bar ─────────────────────────────────────────────────────

function ApprovalBar({ session }) {
  // Count all 11 sections but display 10 (demographics is form-only)
  const sections = SECTION_ORDER.filter(k => k !== 'demographics');
  const total    = sections.length; // 10

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

  if (!session) return null;

  // Show all 11 sections in the document (demographics as first)
  const documentSections = SECTION_ORDER;

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
            />
          ))}

          {/* Bottom padding so last card isn't flush with screen edge */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
