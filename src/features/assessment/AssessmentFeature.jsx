import React, { useState, useCallback } from 'react';
import AssessmentInterviewPage   from './AssessmentInterviewPage.jsx';
import AssessmentChecklistPage   from './AssessmentChecklistPage.jsx';
import AssessmentReviewPage      from './AssessmentReviewPage.jsx';
import ReassessmentReviewPage    from './ReassessmentReviewPage.jsx';
import { completeSession, canExport } from './assessmentStore.js';
import { generateAssessmentDoc } from './lib/generateAssessmentDoc.js';
import { generateTemplateDoc }   from './lib/docxExport.js';

// ─── Status tag config ────────────────────────────────────────────────────────

const STATUS_TAG = {
  not_started: { label: 'NOT STARTED', dot: '#94A3B8', bg: 'rgba(148,163,184,0.10)', color: '#64748B' },
  in_progress: { label: 'IN PROGRESS', dot: '#F59E0B', bg: 'rgba(251,191,36,0.10)',  color: '#92400E' },
  in_review:   { label: 'IN REVIEW',   dot: '#60A5FA', bg: 'rgba(96,165,250,0.10)',  color: '#1E40AF' },
  complete:    { label: 'COMPLETED',   dot: '#34D399', bg: 'rgba(52,211,153,0.10)',  color: '#065F46' },
  ready_to_review: { label: 'IN REVIEW', dot: '#60A5FA', bg: 'rgba(96,165,250,0.10)', color: '#1E40AF' },
};

// ─── AssessmentFeature ────────────────────────────────────────────────────────

export default function AssessmentFeature({
  clientId, clients, staff, setClients, currentUser, addNotif,
  onClose, onBack, onReassessmentComplete,
}) {
  const [page,          setPage]          = useState('interview');
  const [targetSection, setTargetSection] = useState(null);
  const [isExporting,   setIsExporting]   = useState(false);

  // Navigate between pages, optionally jumping to a specific section
  const handleNavigate = (newPage, sectionKey = null) => {
    if (sectionKey) setTargetSection(sectionKey);
    setPage(newPage);
  };

  const client  = clients?.find(c => c.id === clientId);
  const session = client?.assessment_session ?? null;

  // ── Reassessment close/complete — un-swap the session back ────────────────
  //
  // When a reassessment was opened, App.jsx swapped the reassessment session
  // into client.assessment_session and saved the original in client._initialAssessment.
  // On close or completion we snapshot the current state back to
  // client.reassessment_sessions[] and restore client.assessment_session.

  const archiveReassessmentAndClose = useCallback((afterArchive) => {
    if (session?.sessionType === 'reassessment') {
      setClients(prev => prev.map(c => {
        if (c.id !== clientId) return c;
        const currentSession = c.assessment_session;
        const existing = c.reassessment_sessions ?? [];
        const idx = existing.findIndex(s => s.id === currentSession.id);
        const updatedSessions = idx >= 0
          ? existing.map((s, i) => (i === idx ? currentSession : s))
          : [...existing, currentSession];
        return {
          ...c,
          assessment_session:    c._initialAssessment ?? c.assessment_session,
          reassessment_sessions: updatedSessions,
          _initialAssessment:    undefined,
        };
      }));
    }
    afterArchive?.();
  }, [session, clientId, setClients]);

  // Back: archive (if reassessment) then call onClose/onBack
  const handleClose = useCallback(() => {
    archiveReassessmentAndClose(onClose ?? onBack);
  }, [archiveReassessmentAndClose, onClose, onBack]);

  // Called by ReassessmentReviewPage after successful doc generation
  const handleReassessmentComplete = useCallback(() => {
    archiveReassessmentAndClose(() => onReassessmentComplete?.(clientId));
  }, [archiveReassessmentAndClose, onReassessmentComplete, clientId]);

  const status      = session?.status ?? 'not_started';
  const tagMeta     = STATUS_TAG[status] ?? STATUS_TAG.not_started;
  const exportReady = canExport(client);

  // Count sections still pending (not approved or skipped), excluding demographics
  const pendingCount = session
    ? Object.entries(session.sections)
        .filter(([key, s]) => key !== 'demographics' && s.approvalState !== 'approved' && s.approvalState !== 'skipped')
        .length
    : 0;

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!session || isExporting) return;
    setIsExporting(true);

    // Generate and download the Word document FIRST — only mark complete if it succeeds
    try {
      const clientName = session.clientName ?? client?.name ?? 'Client';
      const safeName = clientName.replace(/\s+/g, '_');
      const dateStr  = new Date().toISOString().slice(0, 10);
      const fileName = `${safeName}_ABA_Assessment_${dateStr}.docx`;

      // Generate the full dynamic document (all session data, AI narratives, structured tables).
      const blob = await generateAssessmentDoc(session, clientName);

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Store as base64 so it can be re-downloaded from the Documents tab
      // Use a chunked loop — spreading a large Uint8Array into btoa causes stack overflow
      const arrayBuffer = await blob.arrayBuffer();
      const bytes  = new Uint8Array(arrayBuffer);
      let   binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const dataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`;

      // Snapshot the latest section state at the moment of export so the
      // stored result always reflects what was actually downloaded.
      const latestClient = clients.find(c => c.id === clientId);
      const latestSession = latestClient?.assessment_session ?? session;
      const sectionsResult = {};
      Object.entries(latestSession.sections).forEach(([key, sec]) => {
        sectionsResult[key] = {
          title:         sec.title,
          content:       sec.draftContent ?? '',
          approvalState: sec.approvalState,
          skillGoals:    sec.skillGoals ?? [],
          behaviorTargets: sec.behaviorTargets ?? [],
        };
      });
      const result = {
        exportedAt: new Date().toISOString(),
        exportedBy: currentUser?.name ?? 'BCBA',
        clientId,
        clientName: latestSession.clientName,
        sessionId:  latestSession.id,
        sections:   sectionsResult,
      };

      // Mark session as complete — only after successful generation
      completeSession(setClients, clientId, result);

      // Push into client.documents so it appears automatically in the CRM
      const doc = {
        id:          `doc_${Date.now()}`,
        type:        'assessment_draft',
        label:       `DRAFT_${fileName}`,
        uploaded_at: new Date().toISOString(),
        by:          currentUser?.name ?? 'BCBA',
        stage:       client?.stage ?? 'assessment',
        dataUrl,
      };
      setClients(prev => prev.map(c =>
        c.id === clientId ? { ...c, documents: [...(c.documents ?? []), doc] } : c
      ));
    } catch (err) {
      console.error('DOCX generation failed:', err);
      addNotif?.({ type: 'error', message: 'Document generation failed. Please try again.' });
      setIsExporting(false);
      return;
    }

    addNotif?.({
      type: 'success',
      message: `Assessment saved to ${client?.name ?? 'client'}'s Documents tab.`,
    });

    setIsExporting(false);
  };

  // ── Top bar ────────────────────────────────────────────────────────────────

  const isReassessment = session?.sessionType === 'reassessment';

  // Back button label and destination depend on which page we're on
  const handleBack = page === 'interview' ? handleClose : () => setPage('interview');
  const backLabel  = page === 'interview'
    ? 'Assessments'
    : page === 'reassessment_review'
      ? 'Interview'
      : 'Interview';

  // Right-side action button — varies by page and session type
  const ActionButton = () => {
    if (page === 'interview') {
      // Reassessment: "Review Progress →" goes straight to the reassessment review page
      if (isReassessment) {
        return (
          <button
            onClick={() => setPage('reassessment_review')}
            className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold rounded-xl text-white hover:opacity-90 active:scale-[0.97] transition-all"
            style={{ background: '#0D9488' }}>
            Review Progress
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        );
      }
      // Initial assessment: goes to pre-generation checklist
      return (
        <button
          onClick={() => setPage('checklist')}
          className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold rounded-xl text-white hover:opacity-90 active:scale-[0.97] transition-all"
          style={{ background: '#0D9488' }}>
          Ready to Generate
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      );
    }

    if (page === 'checklist') {
      // Checklist has its own generate button — no duplicate needed here
      return null;
    }

    if (page === 'review') {
      return (
        <button
          onClick={handleExport}
          disabled={!exportReady || isExporting}
          className={`
            flex items-center gap-2 px-4 py-2 text-[12px] font-bold rounded-xl
            transition-all
            ${isExporting
              ? 'opacity-75 cursor-not-allowed text-white'
              : exportReady
                ? 'text-white hover:opacity-90 active:scale-[0.97] cursor-pointer'
                : 'text-slate-400 bg-stone-100 border border-stone-200 cursor-not-allowed'
            }
          `}
          style={exportReady || isExporting ? { background: '#0D9488' } : {}}>
          {isExporting ? (
            <>
              <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full flex-shrink-0" />
              Building report…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              {exportReady ? 'Download Report (.docx)' : `${pendingCount} section${pendingCount !== 1 ? 's' : ''} pending`}
            </>
          )}
        </button>
      );
    }

    // reassessment_review has its own sticky footer generate button — nothing needed in the top bar
    return null;
  };

  // ── Layout ─────────────────────────────────────────────────────────────────

  const pageProps = {
    clientId,
    clients,
    staff,
    setClients,
    currentUser,
    session,
    addNotif,
    onNavigate: handleNavigate,
    hideTopBar: true,
    onBack: handleClose,
    onComplete: handleReassessmentComplete,  // used by ReassessmentReviewPage
    targetSection,
    onTargetSectionHandled: () => setTargetSection(null),
  };

  return (
    <div
      className="fixed top-14 inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden"
      style={{ fontFamily: 'DM Sans, sans-serif', background: '#FAFAF9' }}>

      {/* ── Chart generation overlay ─────────────────────────────────────── */}
      {isExporting && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center max-w-sm w-full mx-4">
            <div className="w-10 h-10 animate-spin border-4 border-teal-500 border-t-transparent rounded-full" />
            <p className="text-lg font-semibold text-slate-800 mt-4">Building your report…</p>
            <p className="text-sm text-slate-500 mt-2 text-center">
              Generating charts and compiling assessment data. This takes a few seconds.
            </p>
          </div>
        </div>
      )}

      {/* ── Single top bar ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 bg-white border-b border-stone-200"
        style={{ minHeight: 52 }}>

        {/* Back button */}
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 hover:text-slate-800 transition-colors flex-shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          {backLabel}
        </button>

        {/* Divider */}
        <span className="w-px h-4 bg-stone-200 flex-shrink-0"/>

        {/* Client name */}
        <p className="text-[13px] font-bold text-slate-800 truncate" style={{ maxWidth: 180 }}>
          {session?.clientName ?? client?.name ?? 'Assessment'}
        </p>

        {/* Status tag */}
        <span
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0"
          style={{ background: tagMeta.bg, color: tagMeta.color }}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
            style={{ background: tagMeta.dot }}/>
          {tagMeta.label}
        </span>

        <div className="flex-1"/>

        {/* Right action */}
        <ActionButton />
      </div>


      {/* ── Page content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {page === 'interview' && (
          <AssessmentInterviewPage {...pageProps} />
        )}
        {page === 'checklist' && (
          <AssessmentChecklistPage {...pageProps} />
        )}
        {page === 'review' && (
          <AssessmentReviewPage {...pageProps} />
        )}
        {page === 'reassessment_review' && (
          <ReassessmentReviewPage {...pageProps} />
        )}
      </div>
    </div>
  );
}
