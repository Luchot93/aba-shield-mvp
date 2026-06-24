import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { SECTION_ORDER } from './sectionConfig.js';
import SectionSidebar from './components/SectionSidebar.jsx';
import SectionCard from './components/SectionCard.jsx';
import ConsentGate from './components/ConsentGate.jsx';
import { patchSession } from './assessmentStore.js';

function formatAuthDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ProgressNoteCard({ session, clientId, setClients, sectionIndex, isExpanded, onToggle }) {
  const [draft, setDraft] = useState(session.progressNarrativeText ?? '');

  // Keep local draft in sync if session changes externally
  useEffect(() => {
    setDraft(session.progressNarrativeText ?? '');
  }, [session.progressNarrativeText]);

  const handleBlur = () => {
    patchSession(setClients, clientId, { progressNarrativeText: draft });
  };

  const hasContent = !!draft.trim();
  const borderColor = isExpanded ? undefined : (hasContent ? '#34D399' : '#E7E5E4');

  return (
    <div
      className={`rounded-xl border bg-white ${isExpanded ? 'border-teal-200' : 'border-stone-200 cursor-pointer'}`}
      style={isExpanded
        ? { background: 'rgba(20,184,166,0.04)', fontFamily: 'DM Sans, sans-serif' }
        : { borderColor, fontFamily: 'DM Sans, sans-serif' }}
      onClick={!isExpanded ? onToggle : undefined}>

      {/* Header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 ${isExpanded ? 'cursor-pointer' : ''}`}
        onClick={isExpanded ? onToggle : undefined}>

        <span className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold"
          style={{ background: isExpanded ? 'rgba(20,184,166,0.12)' : '#F1F5F9', color: isExpanded ? '#0D9488' : '#64748B' }}>
          {sectionIndex}
        </span>

        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasContent ? 'bg-emerald-500 border-2 border-emerald-500' : 'bg-white border-2 border-slate-300'}`}/>

        <span className={`flex-1 text-sm font-semibold ${isExpanded ? 'text-teal-700' : 'text-slate-700'}`}>
          Progress Note — Authorization Period
        </span>

        <div className="flex items-center gap-2 flex-shrink-0">
          {hasContent && !isExpanded && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-slate-500">
              Notes
            </span>
          )}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-teal-100/60">
          {/* Auth period sub-header */}
          <p className="mt-3 mb-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            Auth Period&nbsp;
            <span className="normal-case font-normal text-slate-500">
              {formatAuthDate(session.authPeriodStart)} – {formatAuthDate(session.authPeriodEnd)}
            </span>
          </p>

          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleBlur}
            rows={8}
            placeholder={`Summarize ${session.clientName || 'client'}'s progress during this authorization period. Describe changes in behavior frequency, improvements in replacement skills, caregiver participation, and continued medical necessity for services.`}
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Compact collapsible table for per-session data. columns: [{key, label}], rows: [object] */
function StoStatusCellChip({ statusRaw, label }) {
  if (!statusRaw || statusRaw === '—') return <span className="text-slate-400">{label ?? '—'}</span>;
  if (statusRaw === 'met') {
    return (
      <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 whitespace-nowrap">
        Met ✓
      </span>
    );
  }
  if (statusRaw === 'in_progress') {
    return <span className="text-[11px] font-semibold text-teal-600 whitespace-nowrap">{label ?? 'In progress'}</span>;
  }
  if (statusRaw === 'regressed') {
    return <span className="text-[11px] font-semibold text-red-500 whitespace-nowrap">{label ?? 'Regressed'}</span>;
  }
  return <span className="text-[11px] text-slate-400 whitespace-nowrap">{label ?? statusRaw}</span>;
}

function SessionDetailTable({ columns, rows }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-teal-600 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
        {open ? 'Hide sessions' : `Show ${rows.length} session${rows.length !== 1 ? 's' : ''}`}
      </button>

      {open && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-stone-100 bg-stone-50">
          <table className="w-full text-left" style={{ minWidth: 280 }}>
            <thead>
              <tr className="bg-stone-100">
                {columns.map(c => (
                  <th key={c.key} className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-stone-100">
                  {columns.map(c => (
                    <td key={c.key} className="px-2.5 py-1.5 text-[11px] text-slate-600">
                      {c.key === 'status' && row.statusRaw !== undefined
                        ? <StoStatusCellChip statusRaw={row.statusRaw} label={row.status} />
                        : (row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Read-only status badge for reassessment rows ──────────────────────────────
// Derives status from session logs (sessionDerivedStoStatus / sessionDerivedStatus),
// falling back to the item field. Replaces the editable dropdown — status is now
// driven by what RBTs actually logged, not by BCBA manual entry.
function ReassessmentStatusBadge({ status }) {
  const s = status ?? 'not_yet_started';
  if (s === 'met' || s === 'mastered') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 whitespace-nowrap">
        Mastered ✓
      </span>
    );
  }
  if (s === 'in_progress') {
    return (
      <span className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
        In Progress
      </span>
    );
  }
  // 'new', 'not_yet_started', or anything else
  return (
    <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
      Not Started
    </span>
  );
}

const FUNCTIONS = ['Escape', 'Attention', 'Access', 'Automatic'];

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Part A: single row in the "from treatment plan" table ────────────────────

function OrigBehaviorRow({ item, idx, patchOrigItem, sessionLogs }) {
  const avg       = item.averageFrequency;
  const base      = item.baselineFrequency;
  const pctChange = (avg != null && base != null && base !== 0)
    ? ((base - avg) / base) * 100
    : null;

  // Build per-session rows for the detail table
  const sessionRows = (sessionLogs ?? [])
    .filter(log => (log.behaviorEntries ?? []).some(be => be.behaviorId === item.behaviorId))
    .sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate))
    .map((log, i) => {
      const be = log.behaviorEntries.find(be => be.behaviorId === item.behaviorId);
      const stoStatusLabel = be?.stoStatus
        ? ({ in_progress: 'In progress', met: 'Met ✓', regressed: 'Regressed', not_yet_started: 'Not started' }[be.stoStatus] ?? be.stoStatus)
        : '—';
      return {
        session:   `S${i + 1}`,
        date:      fmtDate(log.sessionDate),
        frequency: be?.sessionFrequency ?? '—',
        sto:       be?.currentStoNumber != null ? `STO ${be.currentStoNumber}` : '—',
        status:    stoStatusLabel,
        statusRaw: be?.stoStatus ?? null,
      };
    });

  return (
    <>
      <tr className="border-t border-stone-100 align-middle">

        {/* Behavior name + LTO */}
        <td className="py-2.5 pr-3 whitespace-nowrap">
          <p className="text-sm font-medium text-slate-700">{item.behaviorName}</p>
          {item.ltoFrequency != null && (
            <p className="text-[10px] text-teal-600 mt-0.5 font-medium">
              LTO: ≤{item.ltoFrequency}× per day
            </p>
          )}
        </td>

        {/* Baseline */}
        <td className="py-2.5 px-2 text-sm text-slate-500 text-center tabular-nums whitespace-nowrap">
          {base ?? '—'}
        </td>

        {/* Avg this period — read-only, computed from session logs */}
        <td className="py-2.5 px-2 text-sm font-semibold text-slate-700 text-center tabular-nums">
          {avg != null ? Number(avg).toFixed(1) : '—'}
        </td>

        {/* % Change (live) */}
        <td className="py-2.5 px-2 text-center text-sm font-semibold tabular-nums whitespace-nowrap">
          {pctChange === null ? (
            <span className="text-slate-300">—</span>
          ) : pctChange >= 0 ? (
            <span className="text-emerald-600">↓ {pctChange.toFixed(1)}%</span>
          ) : (
            <span className="text-red-500">↑ {Math.abs(pctChange).toFixed(1)}%</span>
          )}
        </td>

        {/* Current STO */}
        <td className="py-2.5 px-2 text-center text-xs text-slate-500 whitespace-nowrap">
          STO {item.currentStoNumber ?? 1}
        </td>

        {/* STO status — read-only badge derived from session logs */}
        <td className="py-2.5 pl-2">
          <ReassessmentStatusBadge status={item.sessionDerivedStoStatus ?? item.stoStatus} />
        </td>
      </tr>

      {/* Per-session detail (collapsible, spans all columns) */}
      {sessionRows.length > 0 && (
        <tr className="border-0">
          <td colSpan={6} className="pb-2 pt-0 pl-1 pr-0">
            <SessionDetailTable
              columns={[
                { key: 'session',   label: 'Session' },
                { key: 'date',      label: 'Date' },
                { key: 'frequency', label: 'Frequency' },
                { key: 'sto',       label: 'STO #' },
                { key: 'status',    label: 'Status' },
              ]}
              rows={sessionRows}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Part B: card for a single emerging behavior ──────────────────────────────

// RBT label → BCBA function label (RBTs log 'tangible', BCBAs see 'Access' etc.)
const FN_NORMALIZE = { tangible: 'Access', escape: 'Escape', attention: 'Attention', automatic: 'Automatic' };

function NewBehaviorRow({ item, idx, patchNewItem }) {
  // Pre-fill from RBT draft if BCBA hasn't written their own version yet
  const [defDraft, setDefDraft] = useState(item.bcbaDefinitionFinal || item.rbtDefinitionDraft || '');

  useEffect(() => {
    setDefDraft(item.bcbaDefinitionFinal || item.rbtDefinitionDraft || '');
  }, [item.bcbaDefinitionFinal, item.rbtDefinitionDraft]);

  // Normalize RBT-stored function value to match BCBA button labels
  const resolvedFn = FN_NORMALIZE[item.function?.toLowerCase()] ?? item.function ?? '';

  // Capitalize severity for display (seed stores lowercase e.g. 'moderate')
  const severityLabel = item.severity
    ? item.severity.charAt(0).toUpperCase() + item.severity.slice(1).toLowerCase()
    : '';

  const addStoStep = () => {
    const next = [
      ...(item.stoStructure ?? []),
      { id: `new_sto_${Date.now()}`, targetFrequency: '', durationWeeks: '' },
    ];
    patchNewItem(idx, { stoStructure: next });
  };

  const patchStoStep = (stepId, field, value) => {
    const next = (item.stoStructure ?? []).map(s =>
      s.id === stepId ? { ...s, [field]: value } : s,
    );
    patchNewItem(idx, { stoStructure: next });
  };

  const removeStoStep = (stepId) => {
    patchNewItem(idx, { stoStructure: (item.stoStructure ?? []).filter(s => s.id !== stepId) });
  };

  const trendIcon  = item.trend === 'improving' ? '↓' : item.trend === 'worsening' ? '↑' : '→';
  const trendColor = item.trend === 'improving' ? 'text-emerald-600' : item.trend === 'worsening' ? 'text-red-500' : 'text-slate-400';

  return (
    <div className="rounded-xl border border-amber-200 overflow-hidden"
      style={{ background: 'rgba(245,158,11,0.025)', fontFamily: 'DM Sans, sans-serif' }}>

      {/* Card header */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-amber-100 bg-amber-50/40">
        {/* Flag icon */}
        <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 16 16">
          <path d="M14.778.085A.5.5 0 0 1 15 .5V8a.5.5 0 0 1-.314.464l-.003.001-.006.003-.023.009a12.435 12.435 0 0 1-.397.15c-.264.095-.631.223-1.047.35-.816.252-1.879.523-2.71.523-.847 0-1.548-.28-2.158-.525l-.028-.01C7.68 8.71 7.14 8.5 6.5 8.5c-.7 0-1.638.23-2.437.477A19.626 19.626 0 0 0 3 9.342V15.5a.5.5 0 0 1-1 0V.5a.5.5 0 0 1 1 0v.282c.226-.079.496-.17.79-.26C4.606.272 5.67 0 6.5 0c.84 0 1.524.277 2.121.519l.043.018C9.286.788 9.828 1 10.5 1c.7 0 1.638-.23 2.437-.477a19.587 19.587 0 0 0 1.349-.476l.019-.007.004-.002h.001"/>
        </svg>
        <span className="text-sm font-semibold text-slate-700">{item.behaviorName}</span>
        {item.firstSeenDate && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            NEW — first seen {fmtDate(item.firstSeenDate)}
          </span>
        )}
        {severityLabel && (
          <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
            severityLabel === 'Severe'   ? 'bg-red-50 text-red-700 border border-red-200' :
            severityLabel === 'Moderate' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
            'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {severityLabel}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-4">

        {/* Pre-filled chip */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
          style={{ background: 'rgba(20,184,166,0.08)', color: '#0D9488' }}>
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
          Pre-filled from session logs — review and edit as needed.
        </div>

        {/* Stats strip + session history table */}
        <div>
          {/* Summary stat pills */}
          <div className="flex flex-wrap gap-2.5">
            {[
              { label: 'Baseline', value: item.baselineFrequency },
              { label: 'Min',      value: item.minFrequency },
              { label: 'Max',      value: item.maxFrequency },
              { label: 'Avg',      value: item.averageFrequency },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 min-w-[52px]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-slate-700 tabular-nums">
                  {value != null ? `${value}×` : '—'}
                </p>
              </div>
            ))}
            <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 min-w-[52px]">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Trend</p>
              <p className={`text-base font-bold leading-none mt-0.5 ${trendColor}`}>{trendIcon}</p>
            </div>
          </div>

          {/* Per-session history */}
          {(item.sessionHistory ?? []).length > 0 && (
            <SessionDetailTable
              columns={[
                { key: 'session',   label: 'Session' },
                { key: 'date',      label: 'Date' },
                { key: 'frequency', label: 'Frequency' },
              ]}
              rows={(item.sessionHistory ?? []).map((pt, i) => ({
                session:   `S${i + 1}`,
                date:      fmtDate(pt.sessionDate),
                frequency: pt.frequency != null ? `${pt.frequency}×` : '—',
              }))}
            />
          )}
        </div>

        <div className="h-px bg-amber-100"/>

        {/* BCBA review fields */}
        <div className="space-y-3">

          {/* Topographic definition — pre-filled from RBT */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Topographic Definition <span className="normal-case font-normal text-slate-400">(from RBT — edit as needed)</span>
            </p>
            <textarea
              value={defDraft}
              onChange={e => setDefDraft(e.target.value)}
              onBlur={() => patchNewItem(idx, { bcbaDefinitionFinal: defDraft })}
              placeholder="Observable, measurable description of this behavior…"
              rows={2}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            />
          </div>

          {/* Function — pre-selected from session logs */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Hypothesized Function</p>
            <div className="flex flex-wrap gap-1.5">
              {FUNCTIONS.map(fn => {
                const active = resolvedFn === fn;
                return (
                  <button key={fn} type="button"
                    onClick={() => patchNewItem(idx, { function: fn })}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                      active ? 'text-white border-teal-600' : 'text-slate-500 border-stone-200 bg-white hover:border-teal-300'
                    }`}
                    style={active ? { background: '#0D9488' } : {}}>
                    {fn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3-state disposition: Include / Monitor / Exclude */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">New Cycle Disposition</p>
            <div className="flex rounded-lg border border-stone-200 overflow-hidden w-fit">
              {[
                { label: 'Include in plan', value: 'include', activeClass: 'bg-teal-600 text-white border-teal-600' },
                { label: 'Monitor', value: 'monitor', activeClass: 'bg-sky-600 text-white border-sky-600' },
                { label: 'Exclude', value: 'exclude', activeClass: 'bg-slate-500 text-white border-slate-500' },
              ].map(({ label, value, activeClass }, i) => {
                const current = item.includedInPlan === true ? 'include' : item.monitorOnly === true ? 'monitor' : item.includedInPlan === false ? 'exclude' : null;
                const isActive = current === value;
                return (
                  <button key={value} type="button"
                    onClick={() => {
                      if (value === 'include') {
                        const patch = { includedInPlan: true, monitorOnly: false };
                        if ((item.stoStructure ?? []).length === 0) {
                          patch.stoStructure = [{ id: `new_sto_${Date.now()}`, targetFrequency: '', durationWeeks: '' }];
                        }
                        patchNewItem(idx, patch);
                      } else if (value === 'monitor') {
                        patchNewItem(idx, { includedInPlan: false, monitorOnly: true });
                      } else {
                        patchNewItem(idx, { includedInPlan: false, monitorOnly: false });
                      }
                    }}
                    className={`px-3 py-1.5 text-[11px] font-semibold transition-all ${
                      i > 0 ? 'border-l border-stone-200' : ''
                    } ${isActive ? activeClass : 'bg-white text-slate-500 hover:bg-stone-50'}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STO + LTO builder (only when included in plan) */}
          {item.includedInPlan === true && (
            <div className="space-y-4">

              {/* STO steps */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Short-Term Objectives</p>
                  <button type="button" onClick={addStoStep}
                    className="flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    Add STO
                  </button>
                </div>
                {(item.stoStructure ?? []).length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No steps defined — auto-formula will be used</p>
                ) : (
                  <div className="space-y-2">
                    {(item.stoStructure ?? []).map((step, si) => (
                      <div key={step.id}
                        className="rounded-lg px-3 py-2"
                        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-slate-600">
                          <span className="text-[11px] font-bold text-amber-600 mr-0.5">STO {si + 1}</span>
                          <span>{item.behaviorName || 'Behavior'} will reduce to</span>
                          <input
                            type="number" min={0}
                            value={step.targetFrequency ?? ''}
                            onChange={e => patchStoStep(step.id, 'targetFrequency', e.target.value)}
                            className="inline-block w-12 text-center text-[14px] font-semibold text-teal-700 bg-transparent border-b-2 border-teal-300 focus:border-teal-500 outline-none transition-colors mx-0.5"
                          />
                          <span>per day for</span>
                          <input
                            type="number" min={1}
                            value={step.durationWeeks ?? ''}
                            onChange={e => patchStoStep(step.id, 'durationWeeks', e.target.value)}
                            className="inline-block w-10 text-center text-[14px] font-semibold text-teal-700 bg-transparent border-b-2 border-teal-300 focus:border-teal-500 outline-none transition-colors mx-0.5"
                          />
                          <span>consecutive weeks.</span>
                          <button type="button" onClick={() => removeStoStep(step.id)}
                            className="ml-auto text-slate-300 hover:text-red-400 transition-colors text-base leading-none">
                            ×
                          </button>
                        </div>
                        <input
                          type="text"
                          value={step.note ?? ''}
                          onChange={e => patchStoStep(step.id, 'note', e.target.value)}
                          placeholder="Describe the intervention strategy for this milestone (optional)"
                          className="mt-1.5 w-full text-[11px] text-slate-500 bg-transparent border-b border-slate-200 focus:border-teal-400 outline-none transition-colors placeholder:text-slate-300 pb-0.5"
                          style={{ fontFamily: 'DM Sans, sans-serif' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* LTO / Mastery criterion */}
              <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(13,148,136,0.06)', border: '1px solid rgba(13,148,136,0.2)' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-teal-600 mb-2">
                  Long-Term Objective (LTO) — Mastery Criterion
                </p>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-slate-600">
                  <span>{item.behaviorName || 'Behavior'} will reduce to</span>
                  <input
                    type="number" min={0}
                    value={item.masteryCriteriaFrequency ?? ''}
                    onChange={e => {
                      const v = e.target.value;
                      patchNewItem(idx, { masteryCriteriaFrequency: v === '' ? null : parseFloat(v) });
                    }}
                    placeholder="0"
                    className="inline-block w-12 text-center text-[14px] font-semibold text-teal-700 bg-white border-b-2 border-teal-400 focus:border-teal-600 outline-none transition-colors mx-0.5"
                  />
                  <span>or fewer per day for</span>
                  <input
                    type="number" min={1}
                    value={item.masteryCriteriaWeeks ?? ''}
                    onChange={e => {
                      const v = e.target.value;
                      patchNewItem(idx, { masteryCriteriaWeeks: v === '' ? null : parseInt(v, 10) });
                    }}
                    placeholder="4"
                    className="inline-block w-10 text-center text-[14px] font-semibold text-teal-700 bg-white border-b-2 border-teal-400 focus:border-teal-600 outline-none transition-colors mx-0.5"
                  />
                  <span>consecutive weeks.</span>
                  {item.masteryCriteriaFrequency === 0 && (
                    <span className="text-[11px] font-semibold text-teal-600 ml-1">(full elimination)</span>
                  )}
                </div>
                <textarea
                  value={item.bcbaLtoText ?? ''}
                  onChange={e => patchNewItem(idx, { bcbaLtoText: e.target.value })}
                  placeholder="Optional — additional context or generalization criteria…"
                  rows={2}
                  className="mt-2 w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-[12px] text-slate-600 placeholder:text-slate-300 resize-none focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-200 transition-colors"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                />
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Maladaptive Behaviors section — reassessment view ────────────────────────

function BehaviorTargetsReassessmentCard({
  session, clientId, setClients, sectionIndex, isExpanded, onToggle, sessionLogs,
}) {
  const origSummary = session.originalBehaviorSummary ?? [];
  const newSummary  = session.newBehaviorSummary ?? [];
  const hasNew      = newSummary.length > 0;
  const hasContent  = origSummary.length > 0 || hasNew;

  const patchOrigItem = (idx, patch) =>
    patchSession(setClients, clientId, {
      originalBehaviorSummary: origSummary.map((item, i) => i === idx ? { ...item, ...patch } : item),
    });

  const patchNewItem = (idx, patch) =>
    patchSession(setClients, clientId, {
      newBehaviorSummary: newSummary.map((item, i) => i === idx ? { ...item, ...patch } : item),
    });

  const borderColor = isExpanded ? undefined : (hasContent ? '#34D399' : '#E7E5E4');

  return (
    <div
      className={`rounded-xl border bg-white ${isExpanded ? 'border-teal-200' : 'border-stone-200 cursor-pointer'}`}
      style={isExpanded
        ? { background: 'rgba(20,184,166,0.04)', fontFamily: 'DM Sans, sans-serif' }
        : { borderColor, fontFamily: 'DM Sans, sans-serif' }}
      onClick={!isExpanded ? onToggle : undefined}>

      {/* Header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 ${isExpanded ? 'cursor-pointer' : ''}`}
        onClick={isExpanded ? onToggle : undefined}>

        <span className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold"
          style={{ background: isExpanded ? 'rgba(20,184,166,0.12)' : '#F1F5F9', color: isExpanded ? '#0D9488' : '#64748B' }}>
          {sectionIndex}
        </span>

        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasContent ? 'bg-emerald-500 border-2 border-emerald-500' : 'bg-white border-2 border-slate-300'}`}/>

        <span className={`flex-1 text-sm font-semibold ${isExpanded ? 'text-teal-700' : 'text-slate-700'}`}>
          Maladaptive Behaviors
        </span>

        <div className="flex items-center gap-2 flex-shrink-0">
          {origSummary.length > 0 && !isExpanded && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-slate-500">
              {origSummary.length} from plan
            </span>
          )}
          {hasNew && !isExpanded && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
              {newSummary.length} new
            </span>
          )}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-4 pb-5 pt-1 border-t border-teal-100/60 space-y-6">

          {/* PART A — Behaviors from treatment plan */}
          {origSummary.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                Behaviors from Treatment Plan
              </p>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-left min-w-[480px]">
                  <thead>
                    <tr>
                      <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 pr-3 whitespace-nowrap text-left">Behavior</th>
                      <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 px-2 whitespace-nowrap text-center">Baseline</th>
                      <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 px-2 whitespace-nowrap text-center">Avg this period</th>
                      <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 px-2 whitespace-nowrap text-center">% Change</th>
                      <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 px-2 whitespace-nowrap text-center">STO</th>
                      <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 pl-2 whitespace-nowrap text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Use sessionDerivedStoStatus (immutable, from live session logs) for
                      // the Mastered/Active partition so BCBA dropdown edits never corrupt it.
                      const active   = origSummary.filter(item => (item.sessionDerivedStoStatus ?? item.stoStatus) !== 'met');
                      const mastered = origSummary.filter(item => (item.sessionDerivedStoStatus ?? item.stoStatus) === 'met');
                      return (
                        <>
                          {active.map((item, i) => (
                            <OrigBehaviorRow
                              key={item.behaviorId ?? i}
                              item={item}
                              idx={origSummary.indexOf(item)}
                              patchOrigItem={patchOrigItem}
                              sessionLogs={sessionLogs}
                            />
                          ))}
                          {mastered.length > 0 && (
                            <tr>
                              <td colSpan={6} className="pt-3 pb-1">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 border-t border-emerald-200" />
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 whitespace-nowrap">
                                    Mastered This Period
                                  </span>
                                  <div className="flex-1 border-t border-emerald-200" />
                                </div>
                              </td>
                            </tr>
                          )}
                          {mastered.map((item, i) => (
                            <OrigBehaviorRow
                              key={item.behaviorId ?? `m${i}`}
                              item={item}
                              idx={origSummary.indexOf(item)}
                              patchOrigItem={patchOrigItem}
                              sessionLogs={sessionLogs}
                            />
                          ))}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PART B — Emerging behaviors */}
          {hasNew && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M14.778.085A.5.5 0 0 1 15 .5V8a.5.5 0 0 1-.314.464l-.003.001-.006.003-.023.009a12.435 12.435 0 0 1-.397.15c-.264.095-.631.223-1.047.35-.816.252-1.879.523-2.71.523-.847 0-1.548-.28-2.158-.525l-.028-.01C7.68 8.71 7.14 8.5 6.5 8.5c-.7 0-1.638.23-2.437.477A19.626 19.626 0 0 0 3 9.342V15.5a.5.5 0 0 1-1 0V.5a.5.5 0 0 1 1 0v.282c.226-.079.496-.17.79-.26C4.606.272 5.67 0 6.5 0c.84 0 1.524.277 2.121.519l.043.018C9.286.788 9.828 1 10.5 1c.7 0 1.638-.23 2.437-.477a19.587 19.587 0 0 0 1.349-.476l.019-.007.004-.002h.001"/>
                </svg>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  Emerging Behaviors — Flagged during services
                </p>
              </div>
              <div className="space-y-4">
                {newSummary.map((item, idx) => (
                  <NewBehaviorRow
                    key={item.behaviorName}
                    item={item}
                    idx={idx}
                    patchNewItem={patchNewItem}
                  />
                ))}
              </div>
            </div>
          )}

          {!hasContent && (
            <p className="text-sm text-slate-400 text-center py-6">
              No behavior data logged yet for this authorization period.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Part A: single row in the "from treatment plan" skills table ────────────


function OrigSkillRow({ item, idx, patchOrigItem, sessionLogs }) {
  const avgAccuracy = item.averageAccuracy ?? item.currentPercent;

  // Build per-session rows from skill log entries
  const sessionRows = (sessionLogs ?? [])
    .filter(log => (log.skillEntries ?? []).some(se =>
      !se.isNew && (item.skillId ? se.skillId === item.skillId : se.skillName === item.skillName),
    ))
    .sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate))
    .map((log, i) => {
      const se = log.skillEntries.find(se =>
        !se.isNew && (item.skillId ? se.skillId === item.skillId : se.skillName === item.skillName),
      );
      const stoStatusLabel = se?.stoStatus
        ? ({ in_progress: 'In progress', met: 'Met ✓', regressed: 'Regressed', not_yet_started: 'Not started' }[se.stoStatus] ?? se.stoStatus)
        : '—';
      return {
        session:   `S${i + 1}`,
        date:      fmtDate(log.sessionDate),
        accuracy:  se?.accuracyPercent != null ? `${se.accuracyPercent}%` : '—',
        sto:       se?.currentStoNumber != null ? `STO ${se.currentStoNumber}` : '—',
        status:    stoStatusLabel,
        statusRaw: se?.stoStatus ?? null,
      };
    });

  return (
    <>
      <tr className="border-t border-stone-100 align-middle">

        {/* Skill name + domain */}
        <td className="py-2.5 pr-3">
          <p className="text-sm font-medium text-slate-700">{item.skillName}</p>
          {item.domain && (
            <p className="text-[10px] text-slate-400 mt-0.5">{item.domain}</p>
          )}
        </td>

        {/* Baseline % (read-only) */}
        <td className="py-2.5 px-2 text-sm text-slate-500 text-center tabular-nums whitespace-nowrap">
          {item.baselinePercent != null ? `${item.baselinePercent}%` : '—'}
        </td>

        {/* Avg accuracy this period — read-only, computed from session logs */}
        <td className="py-2.5 px-2 text-sm font-semibold text-slate-700 text-center tabular-nums">
          {avgAccuracy != null ? `${Number(avgAccuracy).toFixed(1)}%` : '—'}
        </td>

        {/* Status — read-only badge derived from session logs */}
        <td className="py-2.5 pl-2">
          <ReassessmentStatusBadge status={item.sessionDerivedStatus ?? item.status} />
        </td>
      </tr>

      {/* Per-session detail (collapsible, spans all columns) */}
      {sessionRows.length > 0 && (
        <tr className="border-0">
          <td colSpan={4} className="pb-2 pt-0 pl-1 pr-0">
            <SessionDetailTable
              columns={[
                { key: 'session',  label: 'Session' },
                { key: 'date',     label: 'Date' },
                { key: 'accuracy', label: 'Accuracy %' },
                { key: 'sto',      label: 'STO #' },
                { key: 'status',   label: 'Status' },
              ]}
              rows={sessionRows}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Part B: card for a single new skill ──────────────────────────────────────

function NewSkillRow({ item, idx, patchNewItem }) {
  const [ltoText,     setLtoText]     = useState(item.bcbaLtoText ?? '');
  const [masteryCrit, setMasteryCrit] = useState(
    item.masteryCriteriaPercent != null ? String(item.masteryCriteriaPercent) : '',
  );
  const [baselinePct, setBaselinePct] = useState(
    item.baselinePercent != null ? String(item.baselinePercent) : '',
  );

  useEffect(() => { setLtoText(item.bcbaLtoText ?? ''); }, [item.bcbaLtoText]);
  useEffect(() => {
    setMasteryCrit(item.masteryCriteriaPercent != null ? String(item.masteryCriteriaPercent) : '');
  }, [item.masteryCriteriaPercent]);
  useEffect(() => {
    setBaselinePct(item.baselinePercent != null ? String(item.baselinePercent) : '');
  }, [item.baselinePercent]);

  const clampPct = (v) => Math.min(100, Math.max(0, parseFloat(v)));

  const addStoStep = () => {
    const next = [
      ...(item.stoSteps ?? []),
      { id: `nsksto_${Date.now()}`, targetPercent: '', durationWeeks: '' },
    ];
    patchNewItem(idx, { stoSteps: next });
  };

  const patchStoStep = (stepId, field, value) => {
    const next = (item.stoSteps ?? []).map(s =>
      s.id === stepId ? { ...s, [field]: value } : s,
    );
    patchNewItem(idx, { stoSteps: next });
  };

  const removeStoStep = (stepId) => {
    patchNewItem(idx, { stoSteps: (item.stoSteps ?? []).filter(s => s.id !== stepId) });
  };

  return (
    <div className="rounded-xl border border-teal-200 overflow-hidden"
      style={{ background: 'rgba(20,184,166,0.025)', fontFamily: 'DM Sans, sans-serif' }}>

      {/* Card header */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-teal-100 bg-teal-50/30">
        <svg className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" fill="currentColor" viewBox="0 0 16 16">
          <path d="M14.778.085A.5.5 0 0 1 15 .5V8a.5.5 0 0 1-.314.464l-.003.001-.006.003-.023.009a12.435 12.435 0 0 1-.397.15c-.264.095-.631.223-1.047.35-.816.252-1.879.523-2.71.523-.847 0-1.548-.28-2.158-.525l-.028-.01C7.68 8.71 7.14 8.5 6.5 8.5c-.7 0-1.638.23-2.437.477A19.626 19.626 0 0 0 3 9.342V15.5a.5.5 0 0 1-1 0V.5a.5.5 0 0 1 1 0v.282c.226-.079.496-.17.79-.26C4.606.272 5.67 0 6.5 0c.84 0 1.524.277 2.121.519l.043.018C9.286.788 9.828 1 10.5 1c.7 0 1.638-.23 2.437-.477a19.587 19.587 0 0 0 1.349-.476l.019-.007.004-.002h.001"/>
        </svg>
        <span className="text-sm font-semibold text-slate-700">{item.skillName}</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200">
          NEW{item.firstSeenDate ? ` — first seen ${fmtDate(item.firstSeenDate)}` : ''}
        </span>
        {item.rbtNotes && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500 text-white">
            Pre-filled from session logs
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-4">

        {/* Pre-fill notice */}
        {item.rbtNotes && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
            style={{ background: 'rgba(20,184,166,0.08)', color: '#0D9488' }}>
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            Pre-filled from session logs — review and edit as needed.
          </div>
        )}

        <div className="space-y-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">BCBA Assessment</p>

          {/* Session history stats + table */}
          <div>
            {/* Stat pills */}
            <div className="flex flex-wrap gap-2.5">
              {[
                { label: 'Baseline', value: item.baselinePercent },
                { label: 'Min',      value: item.minAccuracy },
                { label: 'Max',      value: item.maxAccuracy },
                { label: 'Avg',      value: item.avgAccuracy },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 min-w-[52px]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-slate-700 tabular-nums">
                    {value != null ? `${value}%` : '—'}
                  </p>
                </div>
              ))}
              <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 min-w-[52px]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Trend</p>
                <p className={`text-base font-bold leading-none mt-0.5 ${
                  item.trend === 'up'   ? 'text-emerald-600'
                  : item.trend === 'down' ? 'text-rose-500'
                  : 'text-slate-400'
                }`}>
                  {item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→'}
                </p>
              </div>
            </div>

            {/* Per-session accuracy table */}
            {(item.sessionHistory ?? []).length > 0 && (
              <SessionDetailTable
                columns={[
                  { key: 'session',  label: 'Session' },
                  { key: 'date',     label: 'Date' },
                  { key: 'accuracy', label: 'Accuracy' },
                ]}
                rows={(item.sessionHistory ?? []).map((pt, i) => ({
                  session:  `S${i + 1}`,
                  date:     fmtDate(pt.sessionDate),
                  accuracy: pt.accuracy != null ? `${pt.accuracy}%` : '—',
                }))}
              />
            )}
          </div>

          {/* BCBA-adjustable baseline */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Adjust Baseline % <span className="font-normal normal-case text-slate-400">(BCBA — override if needed)</span>
            </p>
            <div className="flex items-center gap-1">
              <input
                type="number" min={0} max={100}
                value={baselinePct}
                onChange={e => setBaselinePct(e.target.value)}
                onBlur={() => {
                  const v = clampPct(baselinePct);
                  if (!isNaN(v)) patchNewItem(idx, { baselinePercent: v });
                }}
                placeholder="0"
                className="w-20 text-sm font-semibold text-slate-700 bg-white border border-stone-200 rounded-md px-2 py-1 focus:outline-none focus:border-teal-400 tabular-nums"
                style={{ fontFamily: 'DM Mono, monospace' }}
              />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </div>

          {/* RBT notes (pre-fill preview, collapsible if long) */}
          {item.rbtNotes && (
            <div className="rounded-lg px-3 py-2 border border-teal-100"
              style={{ background: 'rgba(20,184,166,0.05)' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-teal-500 mb-1">RBT Session Notes</p>
              <p className="text-[12px] text-slate-600 leading-relaxed italic">{item.rbtNotes}</p>
            </div>
          )}

          <div className="h-px bg-teal-100"/>

          {/* 3-state disposition: Include / Monitor / Exclude */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">New Cycle Disposition</p>
            <div className="flex rounded-lg border border-stone-200 overflow-hidden w-fit">
              {[
                { label: 'Include in plan', value: 'include', activeClass: 'bg-teal-600 text-white' },
                { label: 'Monitor', value: 'monitor', activeClass: 'bg-sky-600 text-white' },
                { label: 'Exclude', value: 'exclude', activeClass: 'bg-slate-500 text-white' },
              ].map(({ label, value, activeClass }, i) => {
                const current = item.includedInPlan === true ? 'include' : item.monitorOnly === true ? 'monitor' : item.includedInPlan === false ? 'exclude' : null;
                const isActive = current === value;
                return (
                  <button key={value} type="button"
                    onClick={() => {
                      if (value === 'include') {
                        const patch = { includedInPlan: true, monitorOnly: false };
                        if ((item.stoSteps ?? []).length === 0) {
                          patch.stoSteps = [{ id: `nsksto_${Date.now()}`, targetPercent: '', durationWeeks: '' }];
                        }
                        patchNewItem(idx, patch);
                      } else if (value === 'monitor') {
                        patchNewItem(idx, { includedInPlan: false, monitorOnly: true });
                      } else {
                        patchNewItem(idx, { includedInPlan: false, monitorOnly: false });
                      }
                    }}
                    className={`px-3 py-1.5 text-[11px] font-semibold transition-all ${
                      i > 0 ? 'border-l border-stone-200' : ''
                    } ${isActive ? activeClass : 'bg-white text-slate-500 hover:bg-stone-50'}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clinical goal fields — only when included in plan */}
          {item.includedInPlan === true && (
            <>
              {/* STO steps */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Short-Term Objectives</p>
                  <button type="button" onClick={addStoStep}
                    className="flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    Add STO
                  </button>
                </div>
                {(item.stoSteps ?? []).length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No steps defined yet — click Add STO to build milestones</p>
                ) : (
                  <div className="space-y-2">
                    {(item.stoSteps ?? []).map((step, si) => (
                      <div key={step.id}
                        className="rounded-lg px-3 py-2"
                        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-slate-600">
                          <span className="text-[11px] font-bold text-teal-600 mr-0.5">STO {si + 1}</span>
                          <span>{item.skillName || 'Skill'} at</span>
                          <input
                            type="number" min={0} max={100}
                            value={step.targetPercent ?? ''}
                            onChange={e => patchStoStep(step.id, 'targetPercent', e.target.value)}
                            className="inline-block w-12 text-center text-[14px] font-semibold text-teal-700 bg-transparent border-b-2 border-teal-300 focus:border-teal-500 outline-none transition-colors mx-0.5"
                          />
                          <span>% accuracy for</span>
                          <input
                            type="number" min={1}
                            value={step.durationWeeks ?? ''}
                            onChange={e => patchStoStep(step.id, 'durationWeeks', e.target.value)}
                            className="inline-block w-10 text-center text-[14px] font-semibold text-teal-700 bg-transparent border-b-2 border-teal-300 focus:border-teal-500 outline-none transition-colors mx-0.5"
                          />
                          <span>consecutive weeks.</span>
                          <button type="button" onClick={() => removeStoStep(step.id)}
                            className="ml-auto text-slate-300 hover:text-red-400 transition-colors text-base leading-none">
                            ×
                          </button>
                        </div>
                        <input
                          type="text"
                          value={step.note ?? ''}
                          onChange={e => patchStoStep(step.id, 'note', e.target.value)}
                          placeholder="Describe the teaching strategy for this milestone (optional)"
                          className="mt-1.5 w-full text-[11px] text-slate-500 bg-transparent border-b border-slate-200 focus:border-teal-400 outline-none transition-colors placeholder:text-slate-300 pb-0.5"
                          style={{ fontFamily: 'DM Sans, sans-serif' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* LTO / Mastery criterion — teal block */}
              <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(13,148,136,0.06)', border: '1px solid rgba(13,148,136,0.2)' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-teal-600 mb-2">
                  Long-Term Objective (LTO) — Mastery Criterion
                </p>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-slate-600">
                  <span>{item.skillName || 'Skill'} at</span>
                  <input
                    type="number" min={0} max={100}
                    value={masteryCrit}
                    onChange={e => setMasteryCrit(e.target.value)}
                    onBlur={() => {
                      const v = clampPct(masteryCrit);
                      if (!isNaN(v)) patchNewItem(idx, { masteryCriteriaPercent: v });
                    }}
                    placeholder="80"
                    className="inline-block w-14 text-center text-[14px] font-semibold text-teal-700 bg-white border-b-2 border-teal-400 focus:border-teal-600 outline-none transition-colors mx-0.5"
                    style={{ fontFamily: 'DM Mono, monospace' }}
                  />
                  <span>% accuracy maintained for</span>
                  <input
                    type="number" min={1}
                    value={item.masteryCriteriaWeeks ?? ''}
                    onChange={e => {
                      const v = e.target.value;
                      patchNewItem(idx, { masteryCriteriaWeeks: v === '' ? null : parseInt(v, 10) });
                    }}
                    placeholder="4"
                    className="inline-block w-10 text-center text-[14px] font-semibold text-teal-700 bg-white border-b-2 border-teal-400 focus:border-teal-600 outline-none transition-colors mx-0.5"
                    style={{ fontFamily: 'DM Mono, monospace' }}
                  />
                  <span>consecutive weeks.</span>
                </div>
                <textarea
                  value={ltoText}
                  onChange={e => setLtoText(e.target.value)}
                  onBlur={() => patchNewItem(idx, { bcbaLtoText: ltoText })}
                  placeholder="Optional — generalization criteria or additional context…"
                  rows={2}
                  className="mt-2 w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-[12px] text-slate-600 placeholder:text-slate-300 resize-none focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-200 transition-colors"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Skill Acquisitions section — reassessment view ───────────────────────────

function SkillAcquisitionsReassessmentCard({
  session, clientId, setClients, sectionIndex, isExpanded, onToggle, sessionLogs,
}) {
  const origSummary = session.originalSkillSummary ?? [];
  const newSummary  = session.newSkillSummary ?? [];
  const hasNew      = newSummary.length > 0;
  const hasContent  = origSummary.length > 0 || hasNew;

  const patchOrigItem = (idx, patch) =>
    patchSession(setClients, clientId, {
      originalSkillSummary: origSummary.map((item, i) => i === idx ? { ...item, ...patch } : item),
    });

  const patchNewItem = (idx, patch) =>
    patchSession(setClients, clientId, {
      newSkillSummary: newSummary.map((item, i) => i === idx ? { ...item, ...patch } : item),
    });

  const borderColor = isExpanded ? undefined : (hasContent ? '#34D399' : '#E7E5E4');

  return (
    <div
      className={`rounded-xl border bg-white ${isExpanded ? 'border-teal-200' : 'border-stone-200 cursor-pointer'}`}
      style={isExpanded
        ? { background: 'rgba(20,184,166,0.04)', fontFamily: 'DM Sans, sans-serif' }
        : { borderColor, fontFamily: 'DM Sans, sans-serif' }}
      onClick={!isExpanded ? onToggle : undefined}>

      {/* Header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 ${isExpanded ? 'cursor-pointer' : ''}`}
        onClick={isExpanded ? onToggle : undefined}>

        <span className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold"
          style={{ background: isExpanded ? 'rgba(20,184,166,0.12)' : '#F1F5F9', color: isExpanded ? '#0D9488' : '#64748B' }}>
          {sectionIndex}
        </span>

        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasContent ? 'bg-emerald-500 border-2 border-emerald-500' : 'bg-white border-2 border-slate-300'}`}/>

        <span className={`flex-1 text-sm font-semibold ${isExpanded ? 'text-teal-700' : 'text-slate-700'}`}>
          Skill Acquisitions
        </span>

        <div className="flex items-center gap-2 flex-shrink-0">
          {origSummary.length > 0 && !isExpanded && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-slate-500">
              {origSummary.length} from plan
            </span>
          )}
          {hasNew && !isExpanded && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">
              {newSummary.length} new
            </span>
          )}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-4 pb-5 pt-1 border-t border-teal-100/60 space-y-6">

          {/* PART A — Skills from treatment plan */}
          {origSummary.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                Skills from Treatment Plan
              </p>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-left min-w-[400px]">
                  <thead>
                    <tr>
                      <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 pr-3 whitespace-nowrap text-left">Skill</th>
                      <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 px-2 whitespace-nowrap text-center">Baseline</th>
                      <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 px-2 whitespace-nowrap text-center">Current Level</th>
                      <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 pl-2 whitespace-nowrap text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Use sessionDerivedStatus (immutable, from live session logs) for
                      // the Mastered/Active partition so BCBA dropdown edits never corrupt it.
                      const active   = origSummary.filter(item => (item.sessionDerivedStatus ?? item.status) !== 'met');
                      const mastered = origSummary.filter(item => (item.sessionDerivedStatus ?? item.status) === 'met');
                      return (
                        <>
                          {active.map((item, i) => (
                            <OrigSkillRow
                              key={item.skillId ?? i}
                              item={item}
                              idx={origSummary.indexOf(item)}
                              patchOrigItem={patchOrigItem}
                              sessionLogs={sessionLogs}
                            />
                          ))}
                          {mastered.length > 0 && (
                            <tr>
                              <td colSpan={4} className="pt-3 pb-1">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 border-t border-emerald-200" />
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 whitespace-nowrap">
                                    Mastered This Period
                                  </span>
                                  <div className="flex-1 border-t border-emerald-200" />
                                </div>
                              </td>
                            </tr>
                          )}
                          {mastered.map((item, i) => (
                            <OrigSkillRow
                              key={item.skillId ?? `m${i}`}
                              item={item}
                              idx={origSummary.indexOf(item)}
                              patchOrigItem={patchOrigItem}
                              sessionLogs={sessionLogs}
                            />
                          ))}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PART B — New skills */}
          {hasNew && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M14.778.085A.5.5 0 0 1 15 .5V8a.5.5 0 0 1-.314.464l-.003.001-.006.003-.023.009a12.435 12.435 0 0 1-.397.15c-.264.095-.631.223-1.047.35-.816.252-1.879.523-2.71.523-.847 0-1.548-.28-2.158-.525l-.028-.01C7.68 8.71 7.14 8.5 6.5 8.5c-.7 0-1.638.23-2.437.477A19.626 19.626 0 0 0 3 9.342V15.5a.5.5 0 0 1-1 0V.5a.5.5 0 0 1 1 0v.282c.226-.079.496-.17.79-.26C4.606.272 5.67 0 6.5 0c.84 0 1.524.277 2.121.519l.043.018C9.286.788 9.828 1 10.5 1c.7 0 1.638-.23 2.437-.477a19.587 19.587 0 0 0 1.349-.476l.019-.007.004-.002h.001"/>
                </svg>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  New Skills — Flagged during services
                </p>
              </div>
              <div className="space-y-4">
                {newSummary.map((item, idx) => (
                  <NewSkillRow
                    key={item.skillId ?? item.skillName}
                    item={item}
                    idx={idx}
                    patchNewItem={patchNewItem}
                  />
                ))}
              </div>
            </div>
          )}

          {!hasContent && (
            <p className="text-sm text-slate-400 text-center py-6">
              No skill data logged yet for this authorization period.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Caregiver Training summary row (Part A) ─────────────────────────────────

function CaregiverTrainingSummaryRow({ item, idx, patchItem, ctLogs }) {
  const avg        = item.averageSessionPercent;
  const base       = item.baselinePercent;
  // For CT: positive pctChange = avg > baseline = improvement = good
  const pctChange  = (avg != null && base != null && base !== 0)
    ? ((avg - base) / base) * 100
    : null;

  // trend icon: improving = ↑ green, worsening = ↓ red, flat = → gray
  const trendIcon  = item.trend === 'improving' ? '↑' : item.trend === 'worsening' ? '↓' : '→';
  const trendColor = item.trend === 'improving' ? 'text-emerald-600' : item.trend === 'worsening' ? 'text-red-500' : 'text-slate-400';

  // Build per-session rows from caregiver training logs
  const ctSessionRows = (ctLogs ?? [])
    .filter(log => (log.trainingEntries ?? []).some(te =>
      item.targetId ? te.targetId === item.targetId : te.goalName === item.goalName,
    ))
    .sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate))
    .map((log, i) => {
      const te = log.trainingEntries.find(te =>
        item.targetId ? te.targetId === item.targetId : te.goalName === item.goalName,
      );
      const stoLabel = te?.stoStatus
        ? ({ in_progress: 'In progress', met: 'Met ✓', not_yet_started: 'Not started' }[te.stoStatus] ?? te.stoStatus)
        : '—';
      return {
        session:   `S${i + 1}`,
        date:      fmtDate(log.sessionDate),
        pct:       te?.sessionPercent != null ? `${te.sessionPercent}%` : '—',
        status:    stoLabel,
        statusRaw: te?.stoStatus ?? null,
      };
    });

  return (
    <>
      <tr className="border-t border-stone-100 align-middle">

        {/* Goal name */}
        <td className="py-2.5 pr-3 text-sm font-medium text-slate-700 whitespace-nowrap">
          {item.goalName}
        </td>

        {/* Baseline % */}
        <td className="py-2.5 px-2 text-sm text-slate-500 text-center tabular-nums whitespace-nowrap">
          {base != null ? `${base}%` : '—'}
        </td>

        {/* Avg this period — read-only, computed from session logs */}
        <td className="py-2.5 px-2 text-sm font-semibold text-slate-700 text-center tabular-nums">
          {avg != null ? `${Number(avg).toFixed(1)}%` : '—'}
        </td>

        {/* % Change (live) */}
        <td className="py-2.5 px-2 text-center text-sm font-semibold tabular-nums whitespace-nowrap">
          {pctChange === null ? (
            <span className="text-slate-300">—</span>
          ) : pctChange >= 0 ? (
            <span className="text-emerald-600">+{pctChange.toFixed(1)}%</span>
          ) : (
            <span className="text-red-500">{pctChange.toFixed(1)}%</span>
          )}
        </td>

        {/* Trend icon */}
        <td className="py-2.5 px-2 text-center text-base font-bold">
          <span className={trendColor}>{trendIcon}</span>
        </td>

        {/* STO Status — read-only badge derived from caregiver training logs */}
        <td className="py-2.5 pl-2">
          <ReassessmentStatusBadge status={item.sessionDerivedStoStatus ?? item.stoStatus} />
        </td>
      </tr>

      {/* Per-session detail (collapsible, spans all columns) */}
      {ctSessionRows.length > 0 && (
        <tr className="border-0">
          <td colSpan={6} className="pb-2 pt-0 pl-1 pr-0">
            <SessionDetailTable
              columns={[
                { key: 'session', label: 'Session' },
                { key: 'date',    label: 'Date' },
                { key: 'pct',     label: '% Achieved' },
                { key: 'status',  label: 'STO Status' },
              ]}
              rows={ctSessionRows}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── NewCaregiverRow — flagged caregiver goals in reassessment ───────────────

function NewCaregiverRow({ item, idx, patchItem }) {
  const [ltoText,     setLtoText]     = useState(item.bcbaLtoText ?? '');
  const [masteryCrit, setMasteryCrit] = useState(
    item.masteryCriteriaPercent != null ? String(item.masteryCriteriaPercent) : '',
  );
  const [baselinePct, setBaselinePct] = useState(
    item.baselinePercent != null ? String(item.baselinePercent) : '',
  );
  // Local state for STO step values so typing is responsive (same pattern as LTO fields above).
  // Committed to global state on blur so we avoid the headerContent re-render path resetting inputs.
  const [localSteps, setLocalSteps] = useState(item.stoSteps ?? []);

  useEffect(() => { setLtoText(item.bcbaLtoText ?? ''); }, [item.bcbaLtoText]);
  useEffect(() => {
    setMasteryCrit(item.masteryCriteriaPercent != null ? String(item.masteryCriteriaPercent) : '');
  }, [item.masteryCriteriaPercent]);
  useEffect(() => {
    setBaselinePct(item.baselinePercent != null ? String(item.baselinePercent) : '');
  }, [item.baselinePercent]);
  // Sync local steps when external state changes (e.g. step added/removed via buttons)
  useEffect(() => { setLocalSteps(item.stoSteps ?? []); }, [item.stoSteps]);

  const clampPct = (v) => Math.min(100, Math.max(0, parseFloat(v)));

  const addStoStep = () => {
    const next = [
      ...(item.stoSteps ?? []),
      { id: `cgsto_${Date.now()}`, targetPercent: '', durationWeeks: '', note: '' },
    ];
    patchItem(idx, { stoSteps: next });
  };

  const patchStoStep = (stepId, field, value) => {
    const next = (item.stoSteps ?? []).map(s =>
      s.id === stepId ? { ...s, [field]: value } : s,
    );
    patchItem(idx, { stoSteps: next });
  };

  const removeStoStep = (stepId) => {
    patchItem(idx, { stoSteps: (item.stoSteps ?? []).filter(s => s.id !== stepId) });
  };

  return (
    <div className="rounded-xl border border-teal-200 overflow-hidden"
      style={{ background: 'rgba(20,184,166,0.025)', fontFamily: 'DM Sans, sans-serif' }}>

      {/* Card header */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-teal-100 bg-teal-50/30">
        <svg className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" fill="currentColor" viewBox="0 0 16 16">
          <path d="M9.5 2a.5.5 0 0 1 1 0v.5h.5a.5.5 0 0 1 0 1h-.5v.5a.5.5 0 0 1-1 0v-.5h-.5a.5.5 0 0 1 0-1h.5V2zm-3 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM2 13a5 5 0 0 1 10 0H2z"/>
        </svg>
        <span className="text-sm font-semibold text-slate-700">{item.goalName}</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200">
          NEW{item.firstSeenDate ? ` — first seen ${fmtDate(item.firstSeenDate)}` : ''}
        </span>
        {item.notes && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500 text-white">
            Pre-filled from session logs
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-4">

        {/* Pre-fill notice */}
        {item.notes && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
            style={{ background: 'rgba(20,184,166,0.08)', color: '#0D9488' }}>
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            Pre-filled from session logs — review and edit as needed.
          </div>
        )}

        <div className="space-y-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">BCBA Assessment</p>

          {/* Session history stats + table */}
          <div>
            {/* Stat cards */}
            <div className="flex flex-wrap gap-2.5">
              {[
                { label: 'Baseline', value: item.baselinePercent },
                { label: 'Min',      value: item.minAccuracy },
                { label: 'Max',      value: item.maxAccuracy },
                { label: 'Avg',      value: item.avgAccuracy },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 min-w-[52px]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-slate-700 tabular-nums">
                    {value != null ? `${value}%` : '—'}
                  </p>
                </div>
              ))}
              <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 min-w-[52px]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Trend</p>
                <p className={`text-base font-bold leading-none mt-0.5 ${
                  item.trend === 'improving' ? 'text-emerald-600'
                  : item.trend === 'worsening' ? 'text-rose-500'
                  : 'text-slate-400'
                }`}>
                  {item.trend === 'improving' ? '↑' : item.trend === 'worsening' ? '↓' : '→'}
                </p>
              </div>
            </div>

            {/* Per-session table */}
            {(item.sessionHistory ?? []).length > 0 && (
              <SessionDetailTable
                columns={[
                  { key: 'session', label: 'Session' },
                  { key: 'date',    label: 'Date' },
                  { key: 'percent', label: '% Achieved' },
                ]}
                rows={(item.sessionHistory ?? []).map((pt, i) => ({
                  session: `S${i + 1}`,
                  date:    fmtDate(pt.sessionDate),
                  percent: pt.percent != null ? `${pt.percent}%` : '—',
                }))}
              />
            )}
          </div>

          {/* BCBA-adjustable baseline */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Adjust Baseline % <span className="font-normal normal-case text-slate-400">(BCBA — override if needed)</span>
            </p>
            <div className="flex items-center gap-1">
              <input
                type="number" min={0} max={100}
                value={baselinePct}
                onChange={e => setBaselinePct(e.target.value)}
                onBlur={() => {
                  const v = clampPct(baselinePct);
                  if (!isNaN(v)) patchItem(idx, { baselinePercent: v });
                }}
                placeholder="0"
                className="w-20 text-sm font-semibold text-slate-700 bg-white border border-stone-200 rounded-md px-2 py-1 focus:outline-none focus:border-teal-400 tabular-nums"
                style={{ fontFamily: 'DM Mono, monospace' }}
              />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </div>

          {/* BCBA session notes */}
          {item.notes && (
            <div className="rounded-lg px-3 py-2 border border-teal-100"
              style={{ background: 'rgba(20,184,166,0.05)' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-teal-500 mb-1">BCBA Session Notes</p>
              <p className="text-[12px] text-slate-600 leading-relaxed italic">{item.notes}</p>
            </div>
          )}

          <div className="h-px bg-teal-100"/>

          {/* 3-state disposition: Include / Monitor / Exclude */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">New Cycle Disposition</p>
            <div className="flex rounded-lg border border-stone-200 overflow-hidden w-fit">
              {[
                { label: 'Include in plan', value: 'include', activeClass: 'bg-teal-600 text-white' },
                { label: 'Monitor', value: 'monitor', activeClass: 'bg-sky-600 text-white' },
                { label: 'Exclude', value: 'exclude', activeClass: 'bg-slate-500 text-white' },
              ].map(({ label, value, activeClass }, i) => {
                const current = item.includedInPlan === true ? 'include' : item.monitorOnly === true ? 'monitor' : item.includedInPlan === false ? 'exclude' : null;
                const isActive = current === value;
                return (
                  <button key={value} type="button"
                    onClick={() => {
                      if (value === 'include') {
                        const patch = { includedInPlan: true, monitorOnly: false };
                        if ((item.stoSteps ?? []).length === 0) {
                          patch.stoSteps = [{ id: `cgsto_${Date.now()}`, targetPercent: '', durationWeeks: '', note: '' }];
                        }
                        patchItem(idx, patch);
                      } else if (value === 'monitor') {
                        patchItem(idx, { includedInPlan: false, monitorOnly: true });
                      } else {
                        patchItem(idx, { includedInPlan: false, monitorOnly: false });
                      }
                    }}
                    className={`px-3 py-1.5 text-[11px] font-semibold transition-all ${
                      i > 0 ? 'border-l border-stone-200' : ''
                    } ${isActive ? activeClass : 'bg-white text-slate-500 hover:bg-stone-50'}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STOs + LTO — only when included */}
          {item.includedInPlan === true && (
            <>
              {/* STO steps */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Short-Term Objectives</p>
                  <button type="button" onClick={addStoStep}
                    className="flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    Add STO
                  </button>
                </div>
                {localSteps.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No steps defined yet — click Add STO to build milestones</p>
                ) : (
                  <div className="space-y-2">
                    {localSteps.map((step, si) => (
                      <div key={step.id}
                        className="rounded-lg px-3 py-2"
                        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-slate-600">
                          <span className="text-[11px] font-bold text-teal-600 mr-0.5">STO {si + 1}</span>
                          <span>At</span>
                          <input
                            type="number" min={0} max={100}
                            value={step.targetPercent ?? ''}
                            onChange={e => {
                              const v = e.target.value;
                              setLocalSteps(prev => prev.map(s => s.id === step.id ? { ...s, targetPercent: v } : s));
                            }}
                            onBlur={() => patchItem(idx, { stoSteps: localSteps })}
                            className="inline-block w-12 text-center text-[14px] font-semibold text-teal-700 bg-transparent border-b-2 border-teal-300 focus:border-teal-500 outline-none transition-colors mx-0.5"
                          />
                          <span>% accuracy for</span>
                          <input
                            type="number" min={1}
                            value={step.durationWeeks ?? ''}
                            onChange={e => {
                              const v = e.target.value;
                              setLocalSteps(prev => prev.map(s => s.id === step.id ? { ...s, durationWeeks: v } : s));
                            }}
                            onBlur={() => patchItem(idx, { stoSteps: localSteps })}
                            className="inline-block w-10 text-center text-[14px] font-semibold text-teal-700 bg-transparent border-b-2 border-teal-300 focus:border-teal-500 outline-none transition-colors mx-0.5"
                          />
                          <span>consecutive weeks.</span>
                          <button type="button" onClick={() => removeStoStep(step.id)}
                            className="ml-auto text-slate-300 hover:text-red-400 transition-colors text-base leading-none">
                            ×
                          </button>
                        </div>
                        <input
                          type="text"
                          value={step.note ?? ''}
                          onChange={e => {
                            const v = e.target.value;
                            setLocalSteps(prev => prev.map(s => s.id === step.id ? { ...s, note: v } : s));
                          }}
                          onBlur={() => patchItem(idx, { stoSteps: localSteps })}
                          placeholder="Describe the intervention strategy for this milestone (optional)"
                          className="mt-1.5 w-full text-[11px] text-slate-500 bg-transparent border-b border-slate-200 focus:border-teal-400 outline-none transition-colors placeholder:text-slate-300 pb-0.5"
                          style={{ fontFamily: 'DM Sans, sans-serif' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* LTO / Mastery criterion — teal block */}
              <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(13,148,136,0.06)', border: '1px solid rgba(13,148,136,0.2)' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-teal-600 mb-2">
                  Long-Term Objective (LTO) — Mastery Criterion
                </p>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-slate-600">
                  <span>At</span>
                  <input
                    type="number" min={0} max={100}
                    value={masteryCrit}
                    onChange={e => setMasteryCrit(e.target.value)}
                    onBlur={() => {
                      const v = clampPct(masteryCrit);
                      if (!isNaN(v)) patchItem(idx, { masteryCriteriaPercent: v });
                    }}
                    placeholder="80"
                    className="inline-block w-14 text-center text-[14px] font-semibold text-teal-700 bg-white border-b-2 border-teal-400 focus:border-teal-600 outline-none transition-colors mx-0.5"
                    style={{ fontFamily: 'DM Mono, monospace' }}
                  />
                  <span>% accuracy maintained for</span>
                  <input
                    type="number" min={1}
                    value={item.masteryCriteriaWeeks ?? ''}
                    onChange={e => {
                      const v = e.target.value;
                      patchItem(idx, { masteryCriteriaWeeks: v === '' ? null : parseInt(v, 10) });
                    }}
                    placeholder="4"
                    className="inline-block w-10 text-center text-[14px] font-semibold text-teal-700 bg-white border-b-2 border-teal-400 focus:border-teal-600 outline-none transition-colors mx-0.5"
                    style={{ fontFamily: 'DM Mono, monospace' }}
                  />
                  <span>consecutive weeks.</span>
                </div>
                <textarea
                  value={ltoText}
                  onChange={e => setLtoText(e.target.value)}
                  onBlur={() => patchItem(idx, { bcbaLtoText: ltoText })}
                  placeholder="Optional — generalization criteria or additional context…"
                  rows={2}
                  className="mt-2 w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-[12px] text-slate-600 placeholder:text-slate-300 resize-none focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-200 transition-colors"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Chip + table injected at the top of the caregiver_training section in reassessment
function CaregiverTrainingSummaryHeader({ session, clientId, setClients, ctLogs }) {
  const summary    = session.caregiverTrainingSummary ?? [];
  const newSummary = session.newCaregiverSummary ?? [];

  const patchItem = (idx, patch) =>
    patchSession(setClients, clientId, {
      caregiverTrainingSummary: summary.map((item, i) => i === idx ? { ...item, ...patch } : item),
    });

  const patchNewItem = (idx, patch) =>
    patchSession(setClients, clientId, {
      newCaregiverSummary: newSummary.map((item, i) => i === idx ? { ...item, ...patch } : item),
    });

  return (
    <div className="mb-4">
      {/* Info chip */}
      <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
        style={{ background: 'rgba(20,184,166,0.08)', color: '#0D9488' }}>
        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
        Pre-filled from caregiver training session logs — edit as needed.
      </div>

      {/* Formal goals summary table */}
      {summary.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-left min-w-[520px]">
            <thead>
              <tr>
                  <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 pr-3 whitespace-nowrap text-left">Goal</th>
                  <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 px-2 whitespace-nowrap text-center">Baseline</th>
                  <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 px-2 whitespace-nowrap text-center">Avg this period</th>
                  <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 px-2 whitespace-nowrap text-center">% Change</th>
                  <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 px-2 whitespace-nowrap text-center">Trend</th>
                  <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 pl-2 whitespace-nowrap text-left">STO Status</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Use sessionDerivedStoStatus (immutable, from live CT logs) for partition.
                const active   = summary.filter(item => (item.sessionDerivedStoStatus ?? item.stoStatus) !== 'met');
                const mastered = summary.filter(item => (item.sessionDerivedStoStatus ?? item.stoStatus) === 'met');
                return (
                  <>
                    {active.map((item, i) => (
                      <CaregiverTrainingSummaryRow
                        key={item.targetId ?? i}
                        item={item}
                        idx={summary.indexOf(item)}
                        patchItem={patchItem}
                        ctLogs={ctLogs}
                      />
                    ))}
                    {mastered.length > 0 && (
                      <tr>
                        <td colSpan={6} className="pt-3 pb-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 border-t border-emerald-200" />
                            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 whitespace-nowrap">
                              Mastered This Period
                            </span>
                            <div className="flex-1 border-t border-emerald-200" />
                          </div>
                        </td>
                      </tr>
                    )}
                    {mastered.map((item, i) => (
                      <CaregiverTrainingSummaryRow
                        key={item.targetId ?? `m${i}`}
                        item={item}
                        idx={summary.indexOf(item)}
                        patchItem={patchItem}
                        ctLogs={ctLogs}
                      />
                    ))}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* Newly flagged caregiver goals */}
      {newSummary.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
            New Goals Observed This Period
          </p>
          {newSummary.map((item, idx) => (
            <NewCaregiverRow
              key={item.goalName + idx}
              item={item}
              idx={idx}
              patchItem={patchNewItem}
            />
          ))}
        </div>
      )}

      {/* Divider before existing narrative fields */}
      <div className="border-t border-teal-100/60 mt-4"/>
    </div>
  );
}

// ─── Lightweight markdown → JSX renderer (headings, bold, paragraphs) ────────

function renderMarkdownBlock(text) {
  const lines = text.split('\n');
  const elements = [];
  let paraLines = [];

  const flushPara = () => {
    if (!paraLines.length) return;
    const joined = paraLines.join(' ').trim();
    if (joined) {
      elements.push(
        <p key={elements.length} className="text-[12px] text-slate-600 leading-relaxed mb-2">
          {renderInline(joined)}
        </p>
      );
    }
    paraLines = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('### ')) {
      flushPara();
      elements.push(
        <p key={elements.length} className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mt-3 mb-1">
          {line.slice(4)}
        </p>
      );
    } else if (line.startsWith('## ')) {
      flushPara();
      elements.push(
        <p key={elements.length} className="text-[12px] font-bold text-slate-800 mt-3 mb-1">
          {line.slice(3)}
        </p>
      );
    } else if (line.startsWith('# ')) {
      flushPara();
      elements.push(
        <p key={elements.length} className="text-[13px] font-bold text-slate-800 mt-2 mb-1">
          {line.slice(2)}
        </p>
      );
    } else if (line === '') {
      flushPara();
    } else {
      paraLines.push(line);
    }
  }
  flushPara();
  return elements;
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-slate-700">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ─── Medical Necessity prior statement reference box ─────────────────────────

function MedicalNecessityPriorStatementBox({ initialAssessment }) {
  const [expanded, setExpanded] = useState(false);
  const text = initialAssessment?.sections?.medical_necessity?.draftContent;
  if (!text) return null;

  const PREVIEW_CHARS = 500;
  const isLong = text.length > PREVIEW_CHARS;
  const displayText = !expanded && isLong ? text.slice(0, PREVIEW_CHARS) + '…' : text;

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600 mb-3">
        Previous Statement (from initial assessment)
      </p>
      <div>{renderMarkdownBlock(displayText)}</div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-2 text-[10px] font-semibold text-amber-600 hover:text-amber-800 transition-colors"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AssessmentInterviewPage({
  clientId,
  clients,
  setClients,
  currentUser,
  addNotif,
  onBack,
  hideTopBar = false,
  targetSection = null,
  onTargetSectionHandled,
}) {
  const client  = clients.find(c => c.id === clientId);
  const session = client?.assessment_session;

  const isReassessment     = session?.sessionType === 'reassessment';
  const sessionLogs        = client?.service_session_logs ?? [];
  const ctLogs             = client?.caregiver_training_session_logs ?? [];
  const initialAssessment  = client?._initialAssessment;
  const effectiveSectionOrder = useMemo(() => {
    if (!isReassessment) return SECTION_ORDER;
    const idx = SECTION_ORDER.indexOf('behavior_targets');
    const next = [...SECTION_ORDER];
    next.splice(idx, 0, 'progress_note');
    return next;
  }, [isReassessment]);

  // Desktop: multiple sections open; mobile (<1024px): one at a time
  const [expandedSections,  setExpandedSections]  = useState(['demographics']);
  const [transcriptVisible, setTranscriptVisible] = useState({});
  const [activeSection,     setActiveSection]     = useState('demographics');
  const [consentPending,    setConsentPending]    = useState(false);
  const [consentSectionKey, setConsentSectionKey] = useState(null);
  const [isMobile,          setIsMobile]          = useState(
    typeof window !== 'undefined' && window.innerWidth < 1024
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Jump to a specific section when arriving from the checklist
  useEffect(() => {
    if (!targetSection) return;
    // Close everything else, open only the target — prevents needing to scroll past other open sections
    setActiveSection(targetSection);
    setExpandedSections([targetSection]);
    // Scroll after React has re-rendered the collapsed state
    setTimeout(() => {
      document.getElementById(`section-card-${targetSection}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    onTargetSectionHandled?.();
  }, [targetSection]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectSection = useCallback((key) => {
    setActiveSection(key);
    if (isMobile) {
      // One open at a time on mobile
      setExpandedSections([key]);
    } else {
      setExpandedSections(prev =>
        prev.includes(key) ? prev : [...prev, key]
      );
    }
    // Scroll to card
    setTimeout(() => {
      document.getElementById(`section-card-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [isMobile]);

  const handleToggle = useCallback((key) => {
    setActiveSection(key);
    if (isMobile) {
      setExpandedSections(prev =>
        prev.includes(key) ? [] : [key]
      );
    } else {
      setExpandedSections(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      );
    }
  }, [isMobile]);

  const handleTranscriptToggle = useCallback((key) => {
    setTranscriptVisible(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Record start: check consent first
  const handleRecordStart = useCallback((sectionKey) => {
    if (!session?.consentGranted) {
      setConsentSectionKey(sectionKey);
      setConsentPending(true);
    }
  }, [session?.consentGranted]);

  const handleConsentClose = () => {
    setConsentPending(false);
    setConsentSectionKey(null);
  };

  if (!client || !session) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-slate-400"
        style={{ fontFamily: 'DM Sans, sans-serif' }}>
        No assessment session found for this client.
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-stone-50 overflow-hidden ${hideTopBar ? 'h-full' : 'fixed top-14 inset-x-0 bottom-0 z-10'}`}
      style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* Top bar — hidden when embedded inside AssessmentFeature */}
      {!hideTopBar && (
      <div className="flex-shrink-0 flex items-center gap-4 px-5 py-3 bg-white border-b border-stone-200">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          Assessments
        </button>

        <div className="h-4 w-px bg-stone-200"/>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-slate-800 truncate">
            {session.clientName}
          </span>
          <span className="ml-2 text-xs text-slate-400">
            {session.assessmentType ?? 'Initial'} Assessment
          </span>
        </div>

        {/* Session status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {session.consentGranted && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(20,184,166,0.1)', color: '#0D9488' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              Consent obtained
            </span>
          )}
          <span className="text-[11px] font-semibold text-slate-400"
            style={{ fontFamily: 'DM Mono, monospace' }}>
            {session.sectionsApproved ?? 0}/{effectiveSectionOrder.length} approved
          </span>
        </div>
      </div>
      )}

      {/* Body: sidebar + cards */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar — fixed 240px */}
        <div className="hidden lg:flex flex-col flex-shrink-0 bg-white border-r border-stone-200 overflow-hidden"
          style={{ width: 272 }}>
          <SectionSidebar
            session={session}
            activeSection={activeSection}
            onSelectSection={handleSelectSection}
            sectionOrder={effectiveSectionOrder}
          />
        </div>

        {/* Section cards — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
          <div className="max-w-2xl mx-auto space-y-3">
            {effectiveSectionOrder.map((key, idx) => (
              <div key={key} id={`section-card-${key}`}>
                {key === 'progress_note' ? (
                  <ProgressNoteCard
                    session={session}
                    clientId={clientId}
                    setClients={setClients}
                    sectionIndex={idx + 1}
                    isExpanded={expandedSections.includes(key)}
                    onToggle={() => handleToggle(key)}
                  />
                ) : key === 'behavior_targets' && isReassessment ? (
                  <BehaviorTargetsReassessmentCard
                    session={session}
                    clientId={clientId}
                    setClients={setClients}
                    sectionIndex={idx + 1}
                    isExpanded={expandedSections.includes(key)}
                    onToggle={() => handleToggle(key)}
                    sessionLogs={sessionLogs}
                  />
                ) : key === 'skill_acquisitions' && isReassessment ? (
                  <SkillAcquisitionsReassessmentCard
                    session={session}
                    clientId={clientId}
                    setClients={setClients}
                    sectionIndex={idx + 1}
                    isExpanded={expandedSections.includes(key)}
                    onToggle={() => handleToggle(key)}
                    sessionLogs={sessionLogs}
                  />
                ) : (
                  <SectionCard
                    clientId={clientId}
                    client={client}
                    sectionKey={key}
                    sectionIndex={idx + 1}
                    session={session}
                    setClients={setClients}
                    currentUser={currentUser}
                    isExpanded={expandedSections.includes(key)}
                    onToggle={() => handleToggle(key)}
                    transcriptVisible={!!transcriptVisible[key]}
                    onTranscriptToggle={() => handleTranscriptToggle(key)}
                    onRecordStart={handleRecordStart}
                    addNotif={addNotif}
                    isReassessment={isReassessment}
                    headerContent={
                      key === 'caregiver_training' && isReassessment && (session.caregiverTrainingSummary ?? []).length > 0
                        ? <CaregiverTrainingSummaryHeader session={session} clientId={clientId} setClients={setClients} ctLogs={ctLogs} />
                        : key === 'medical_necessity' && isReassessment && initialAssessment
                        ? <MedicalNecessityPriorStatementBox initialAssessment={initialAssessment} />
                        : null
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Consent gate overlay */}
      {consentPending && (
        <ConsentGate
          clientId={clientId}
          setClients={setClients}
          onClose={handleConsentClose}
        />
      )}
    </div>
  );
}
