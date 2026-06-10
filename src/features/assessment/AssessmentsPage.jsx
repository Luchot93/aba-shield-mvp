import React, { useState } from 'react';
import { Ico } from '../../components/icons.jsx';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_ORDER = { in_progress: 0, in_review: 1, not_started: 2, complete: 3 };

const STATUS_META = {
  not_started: { label: 'Not started', pill: 'bg-stone-100 text-slate-500'     },
  in_progress: { label: 'In progress', pill: 'bg-amber-100 text-amber-700'     },
  in_review:   { label: 'In review',   pill: 'bg-blue-100 text-blue-700'       },
  complete:    { label: 'Completed',   pill: 'bg-emerald-100 text-emerald-700' },
  // legacy fallback
  ready_to_review: { label: 'In review', pill: 'bg-blue-100 text-blue-700' },
};


function relTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function progressPct(session, status) {
  if (!session) return 0;
  const total = session.totalInterviewSections || 10;
  // Review + complete phases: show approval progress. Interview phase: show captured sections.
  const done = (status === 'in_review' || status === 'ready_to_review' || status === 'complete')
    ? (session.sectionsApproved ?? 0)
    : (session.sectionsWithData ?? 0);
  return Math.min(100, Math.round((done / total) * 100));
}

function hasMicData(session) {
  if (!session?.sections) return false;
  return Object.values(session.sections).some(s => !!s.transcript);
}

function hasNotes(session) {
  if (!session?.sections) return false;
  return Object.values(session.sections).some(s => s.notes?.trim());
}

function sectionCount(session, status) {
  if (!session) return { done: 0, total: 0, label: 'sections' };
  const total = session.totalInterviewSections ?? 10;
  const isReviewPhase = status === 'in_review' || status === 'ready_to_review' || status === 'complete';
  return {
    done:  isReviewPhase ? (session.sectionsApproved ?? 0) : (session.sectionsWithData ?? 0),
    total,
    label: isReviewPhase ? 'sections approved' : 'sections captured',
  };
}

function CTA({ status }) {
  if (status === 'not_started') {
    return (
      <span className="px-3 py-1 text-xs font-semibold rounded-lg text-white"
        style={{ background: '#0D9488' }}>
        Start →
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="px-3 py-1 text-xs font-semibold rounded-lg text-white"
        style={{ background: '#0D9488' }}>
        Continue →
      </span>
    );
  }
  if (status === 'in_review' || status === 'ready_to_review') {
    return (
      <span className="px-3 py-1 text-xs font-semibold rounded-lg border"
        style={{ color: '#2563EB', borderColor: '#93C5FD', background: 'rgba(219,234,254,0.5)' }}>
        Review →
      </span>
    );
  }
  if (status === 'complete') {
    return (
      <span className="px-3 py-1 text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50">
        View
      </span>
    );
  }
  return (
    <span className="px-3 py-1 text-xs font-semibold rounded-lg border border-stone-200 text-slate-500 bg-white">
      View
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssessmentsPage({ clients, staff, currentUser, onOpenAssessment }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [toast,  setToast]  = useState(false);

  const showToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 3500);
  };

  // Derive sessions: clients at assessment stage OR with an assessment_session
  const sessions = clients
    .filter(c => c.stage === 'assessment' || c.assessment_session != null)
    .map(c => {
      const session = c.assessment_session;
      const status  = session?.status ?? 'not_started';
      const bcba    = staff.find(s => s.id === c.bcba_id);
      return { client: c, session, status, bcba };
    })
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));

  // Filter
  const filtered = sessions
    .filter(({ status }) => filter === 'all' || status === filter)
    .filter(({ client }) =>
      !search.trim() ||
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      (client.bcba_id && staff.find(s => s.id === client.bcba_id)?.name.toLowerCase().includes(search.toLowerCase()))
    );

  const FILTER_PILLS = [
    { key: 'all',         label: 'All'         },
    { key: 'in_progress', label: 'In progress' },
    { key: 'in_review',   label: 'In review'   },
    { key: 'complete',    label: 'Completed'   },
  ];

  return (
    <div data-testid="assessments-page">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Syne, sans-serif' }}>
          Assessments
        </h1>
        <button
          onClick={showToast}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity"
          style={{ background: '#0D9488' }}>
          <Ico.Plus /> New Interview
        </button>
      </div>

      {/* Filter pills + search */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-1.5">
          {FILTER_PILLS.map(p => (
            <button key={p.key} onClick={() => setFilter(p.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                filter === p.key
                  ? 'text-white border-teal-600'
                  : 'text-slate-600 border-stone-200 bg-white hover:border-teal-300 hover:text-teal-700'
              }`}
              style={filter === p.key ? { background: '#0D9488' } : {}}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="relative" style={{ minWidth: '200px', maxWidth: '280px' }}>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Ico.Search />
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Client or BCBA name…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-xl bg-white outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Session cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-slate-300 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" strokeWidth={1.4} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-500 max-w-xs">
            No assessments yet. Clients appear here automatically when they reach the Assessment stage.
          </p>
        </div>
      ) : (
        <div>
          {filtered.map(({ client, session, status, bcba }) => {
            const meta  = STATUS_META[status] ?? STATUS_META.not_started;
            const pct   = progressPct(session, status);
            const count = sectionCount(session, status);
            const mic   = hasMicData(session);
            const notes = hasNotes(session);

            return (
              <div
                key={client.id}
                onClick={() => onOpenAssessment(client.id)}
                className="bg-white border border-stone-200 rounded-xl p-5 mb-3 cursor-pointer hover:shadow-md hover:-translate-y-px transition-all duration-150">

                {/* Row 1: name + status badge */}
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-base font-semibold text-slate-800 truncate">{client.name}</span>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.pill}`}>
                    {status === 'in_progress' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0"/>
                    )}
                    {status === 'in_review' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0"/>
                    )}
                    {meta.label}
                  </span>
                </div>

                {/* Row 2: bcba + updated */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-sm text-slate-500 truncate">
                    {bcba?.name ?? 'Unassigned'}
                  </span>
                  <span className="text-xs text-slate-400 flex-shrink-0" style={{ fontFamily: 'DM Mono, monospace' }}>
                    {relTime(session?.updatedAt)}
                  </span>
                </div>

                {/* Row 3: progress bar */}
                <div className="w-full rounded-full mb-3 overflow-hidden" style={{ height: '4px', background: '#E7E5E4' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: '#14B8A6' }}
                  />
                </div>

                {/* Row 4: section count + icons + CTA */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400" style={{ fontFamily: 'DM Mono, monospace' }}>
                    {count.done}/{count.total} {count.label}
                  </span>
                  {mic && (
                    <span className="text-teal-500"><Ico.Mic /></span>
                  )}
                  {notes && (
                    <span className="text-slate-400"><Ico.PenLine /></span>
                  )}
                  <div className="flex-1"/>
                  <CTA status={status} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-xl shadow-xl text-sm font-medium z-[100] max-w-sm text-center"
          style={{ background: '#0F766E', color: '#fff' }}>
          <Ico.Check />
          Interviews are created automatically when a client reaches the Assessment stage.
        </div>
      )}
    </div>
  );
}
