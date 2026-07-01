import React, { useState } from 'react';
import { Ico } from '../../components/icons.jsx';
import { FLAGS } from '../../constants/featureFlags.js';

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

const STAGE_LABELS = {
  intake: 'Intake', auth_assessment: 'Auth 97151', assessment: 'Assessment',
  plan_draft: 'Plan Draft', submitted: 'Submitted', denied: 'Denied',
  authorized: 'Authorized', staffing: 'Staffing', services: 'In Services',
};

function relTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function progressPct(session) {
  if (!session) return 0;
  const total = session.sections ? Object.keys(session.sections).length : 0;
  if (!total) return 0;
  return Math.min(100, Math.round(((session.sectionsWithData ?? 0) / total) * 100));
}

function hasMicData(session) {
  if (!session?.sections) return false;
  return Object.values(session.sections).some(s => !!s.transcript);
}

function hasNotes(session) {
  if (!session?.sections) return false;
  return Object.values(session.sections).some(s => s.notes?.trim());
}

function sectionCount(session) {
  if (!session) return { done: 0, total: 0, label: 'sections' };
  const total = session.sections ? Object.keys(session.sections).length : 0;
  return {
    done:  session.sectionsWithData ?? 0,
    total,
    label: 'sections with data',
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

// ─── Group header ─────────────────────────────────────────────────────────────

function GroupHeader({ group, expanded, onToggle }) {
  const { client, reassessments } = group;
  const initials = client.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const stageLabel = STAGE_LABELS[client.stage] ?? client.stage;
  const totalCount = 1 + (FLAGS.REASSESSMENT ? reassessments.length : 0);

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl mb-2 hover:bg-stone-100 transition-colors text-left">
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ background: '#0D9488' }}>
        {initials}
      </div>
      {/* Name + insurer */}
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-slate-800 text-sm">{client.name}</span>
        <span className="text-slate-400 text-xs ml-2">{client.insurer_name}</span>
      </div>
      {/* Stage badge */}
      <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-stone-100 text-slate-500 border border-stone-200 flex-shrink-0">
        {stageLabel}
      </span>
      {/* Count */}
      <span className="text-xs font-medium text-slate-400 flex-shrink-0">[{totalCount}]</span>
      {/* Collapse arrow */}
      <svg
        className={`flex-shrink-0 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
      </svg>
    </button>
  );
}

// ─── Reassessment card ────────────────────────────────────────────────────────

function ReassessmentCard({ client, reassessment, bcba, onOpen }) {
  const { session, status, cycleNumber } = reassessment;
  const meta  = STATUS_META[status] ?? STATUS_META.not_started;
  const pct   = progressPct(session);
  const count = sectionCount(session);
  const mic   = hasMicData(session);
  const notes = hasNotes(session);

  const authFrom = fmtDate(session?.authPeriodStart);
  const authTo   = fmtDate(session?.authPeriodEnd);
  const authLine = authFrom || authTo ? `${authFrom} – ${authTo}` : null;

  return (
    <div className="ml-2 mb-3" style={{ borderLeft: '2px solid #14B8A6', paddingLeft: '12px' }}>
      {/* Connector row */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-teal-400 font-bold text-sm select-none">›</span>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
          style={{ background: '#0D9488' }}>
          Reassessment
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-slate-500 border border-stone-200">
          Cycle {cycleNumber}
        </span>
      </div>

      {/* Card */}
      <div
        onClick={() => onOpen({ type: 'reassessment', clientId: client.id })}
        className="bg-white border border-stone-200 rounded-xl p-5 cursor-pointer hover:shadow-md hover:-translate-y-px transition-all duration-150">

        {/* Row 1: status badge */}
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="text-sm font-semibold text-slate-700">Reassessment · Cycle {cycleNumber}</span>
          <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.pill}`}>
            {(status === 'in_progress') && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0"/>
            )}
            {(status === 'in_review') && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0"/>
            )}
            {meta.label}
          </span>
        </div>

        {/* Row 2: auth period (secondary line) */}
        {authLine && (
          <div className="text-xs text-slate-400 mb-1" style={{ fontFamily: 'DM Mono, monospace' }}>
            Auth period: {authLine}
          </div>
        )}

        {/* Row 3: bcba + updated */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-sm text-slate-500 truncate">
            {bcba?.name ?? 'Unassigned'}
          </span>
          <span className="text-xs text-slate-400 flex-shrink-0" style={{ fontFamily: 'DM Mono, monospace' }}>
            {relTime(session?.updatedAt)}
          </span>
        </div>

        {/* Row 4: progress bar */}
        <div className="w-full rounded-full mb-3 overflow-hidden" style={{ height: '4px', background: '#E7E5E4' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: '#14B8A6' }}
          />
        </div>

        {/* Row 5: section count + icons + CTA */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400" style={{ fontFamily: 'DM Mono, monospace' }}>
            {count.done}/{count.total} {count.label}
          </span>
          {mic && <span className="text-teal-500"><Ico.Mic /></span>}
          {notes && <span className="text-slate-400"><Ico.PenLine /></span>}
          <div className="flex-1"/>
          <CTA status={status} />
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

// ─── New Interview Modal ──────────────────────────────────────────────────────

function NewInterviewModal({ clients, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = React.useRef(null);

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const eligible = clients.filter(c => {
    if (c.assessment_session != null) return false;
    if (!query.trim()) return true;
    return c.name.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-stone-100">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Select a client</h2>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Ico.Search />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 placeholder:text-slate-400"
            />
          </div>
        </div>

        <ul className="max-h-72 overflow-y-auto divide-y divide-stone-100">
          {eligible.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-slate-400">No clients found</li>
          )}
          {eligible.map(c => (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-teal-50 transition-colors text-left"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: '#0D9488' }}
                >
                  {c.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.name}</p>
                  {c.insurer_name && <p className="text-xs text-slate-400">{c.insurer_name}</p>}
                </div>
              </button>
            </li>
          ))}
        </ul>

        <div className="px-5 py-3 border-t border-stone-100 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssessmentsPage({ clients, staff, currentUser, onOpenAssessment, assessmentOpeningId }) {
  const [filter,     setFilter]     = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search,     setSearch]     = useState('');
  const [toast,      setToast]      = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  // Auto-expand groups that have an active reassessment
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const s = new Set();
    for (const c of clients) {
      const hasActive = (c.reassessment_sessions ?? []).some(
        r => r.status === 'in_progress' || r.status === 'in_review',
      );
      if (hasActive) s.add(c.id);
    }
    return s;
  });

  const showToast = () => { setToast(true); setTimeout(() => setToast(false), 3500); };

  const handleNewInterviewSelect = (clientId) => {
    setShowNewModal(false);
    onOpenAssessment(clientId);
  };

  const toggleGroup = id => setExpandedGroups(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // ── Build groups ────────────────────────────────────────────────────────────
  const rawGroups = clients
    .filter(c =>
      c.stage === 'assessment' ||
      c.assessment_session != null ||
      (c.reassessment_sessions ?? []).length > 0,
    )
    .map(c => {
      const initialSession = c.assessment_session;
      const initialStatus  = initialSession?.status ?? 'not_started';
      const reassessments  = (c.reassessment_sessions ?? []).map((s, i) => ({
        session:     s,
        status:      s.status ?? 'not_started',
        cycleNumber: i + 1,
      }));
      const bcba = staff.find(s => s.id === c.bcba_id);
      const hasActiveReassessment = reassessments.some(
        r => r.status === 'in_progress' || r.status === 'in_review',
      );
      const latestUpdated = Math.max(
        initialSession?.updatedAt ? new Date(initialSession.updatedAt).getTime() : 0,
        ...reassessments.map(r =>
          r.session?.updatedAt ? new Date(r.session.updatedAt).getTime() : 0,
        ),
      );
      return { clientId: c.id, client: c, bcba, initialSession, initialStatus, reassessments, hasActiveReassessment, latestUpdated };
    });

  // ── Sort ─────────────────────────────────────────────────────────────────────
  // Tier 0: in-progress reassessment  Tier 1: in-progress initial  Tier 2: rest
  const sortTier = g => {
    if (g.hasActiveReassessment) return 0;
    if (g.initialStatus === 'in_progress' || g.initialStatus === 'in_review') return 1;
    return 2;
  };

  const sortedGroups = [...rawGroups].sort((a, b) => {
    const td = sortTier(a) - sortTier(b);
    return td !== 0 ? td : b.latestUpdated - a.latestUpdated;
  });

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filteredGroups = sortedGroups.filter(g => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!g.client.name.toLowerCase().includes(q) &&
          !(g.bcba?.name?.toLowerCase().includes(q))) return false;
    }
    if (typeFilter === 'reassessment' && g.reassessments.length === 0) return false;
    if (filter !== 'all') {
      const initialMatch    = g.initialStatus === filter;
      const reassessMatch   = g.reassessments.some(r => r.status === filter);
      if (!initialMatch && !reassessMatch) return false;
    }
    return true;
  });

  const FILTER_PILLS = [
    { key: 'all',         label: 'All'         },
    { key: 'in_progress', label: 'In progress' },
    { key: 'in_review',   label: 'In review'   },
    { key: 'complete',    label: 'Completed'   },
  ];

  const TYPE_PILLS = [
    { key: 'all',          label: 'All'           },
    { key: 'reassessment', label: 'Reassessment'  },
  ];

  return (
    <div data-testid="assessments-page">
      {/* Opening-assessment overlay — covers the gap between clicking a client
          and the Supabase fetch/create resolving, since a brand-new client has
          no card here yet to attach a per-row spinner to. */}
      {assessmentOpeningId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-2xl shadow-xl px-6 py-5 flex items-center gap-3">
            <div className="w-5 h-5 animate-spin border-2 border-teal-500 border-t-transparent rounded-full flex-shrink-0" />
            <span className="text-sm font-medium text-slate-700">Opening assessment…</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Syne, sans-serif' }}>
          Assessments
        </h1>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity"
          style={{ background: '#0D9488' }}>
          <Ico.Plus /> New Interview
        </button>
      </div>

      {/* Status filter pills + search */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
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

      {/* Type filter row */}
      {FLAGS.REASSESSMENT && (
        <div className="flex items-center gap-1.5 mb-5">
          {TYPE_PILLS.map(p => (
            <button key={p.key} onClick={() => setTypeFilter(p.key)}
              className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
                typeFilter === p.key
                  ? 'border-teal-500 text-teal-700 bg-teal-50'
                  : 'text-slate-500 border-stone-200 bg-white hover:border-teal-200 hover:text-teal-600'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Session groups */}
      {filteredGroups.length === 0 ? (
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
          {filteredGroups.map(group => {
            const { client, bcba, initialSession, initialStatus, reassessments } = group;
            const expanded = expandedGroups.has(client.id);

            const meta  = STATUS_META[initialStatus] ?? STATUS_META.not_started;
            const pct   = progressPct(initialSession);
            const count = sectionCount(initialSession);
            const mic   = hasMicData(initialSession);
            const notes = hasNotes(initialSession);

            return (
              <div key={client.id} className="mb-4">
                {/* Group header */}
                <GroupHeader group={group} expanded={expanded} onToggle={() => toggleGroup(client.id)} />

                {/* Group body */}
                {expanded && (
                  <div className="pl-1">
                    {/* Initial assessment card — unchanged visually */}
                    {typeFilter !== 'reassessment' && (
                      <div
                        onClick={() => { if (!assessmentOpeningId) onOpenAssessment(client.id); }}
                        className="bg-white border border-stone-200 rounded-xl p-5 mb-3 cursor-pointer hover:shadow-md hover:-translate-y-px transition-all duration-150">

                        {/* Row 1: name + status badge */}
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <span className="text-base font-semibold text-slate-800 truncate">{client.name}</span>
                          <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.pill}`}>
                            {initialStatus === 'in_progress' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0"/>
                            )}
                            {initialStatus === 'in_review' && (
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
                            {relTime(initialSession?.updatedAt)}
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
                          {mic && <span className="text-teal-500"><Ico.Mic /></span>}
                          {notes && <span className="text-slate-400"><Ico.PenLine /></span>}
                          <div className="flex-1"/>
                          <CTA status={initialStatus} />
                        </div>
                      </div>
                    )}

                    {/* Reassessment cards */}
                    {FLAGS.REASSESSMENT && reassessments.map(r => (
                      <ReassessmentCard
                        key={r.session?.id ?? `r-${r.cycleNumber}`}
                        client={client}
                        reassessment={r}
                        bcba={bcba}
                        onOpen={onOpenAssessment}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Interview Modal */}
      {showNewModal && (
        <NewInterviewModal
          clients={clients}
          onSelect={handleNewInterviewSelect}
          onClose={() => setShowNewModal(false)}
        />
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
