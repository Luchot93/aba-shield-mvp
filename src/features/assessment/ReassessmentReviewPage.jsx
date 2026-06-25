/**
 * ReassessmentReviewPage.jsx
 *
 * Three-panel review UI for reassessment sessions. The BCBA reviews
 * behavior/skill/caregiver-training progress data drawn from service session
 * logs, finalises the progress narrative and CPT hours, then generates the
 * reassessment .docx.
 *
 * After generation:
 *  - draft pushed to client.documents (type: 'progress_report')
 *  - checklist.services_reauth.progress_report set to true
 *  - activity_log entry added
 *  - session status → 'complete'
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Chart from 'chart.js/auto';
import { patchSession } from './assessmentStore.js';
import { generateReassessmentDoc } from './lib/generateAssessmentDoc.js';
import { buildBehaviorTrendFromLogs, buildSkillTrendFromLogs } from './graphBuilder.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * Computes the new-cycle baseline from the current-period average.
 * Floors the value UNLESS the decimal portion is ≥ 0.6, in which case rounds up.
 * Preserves the original value untouched — this is purely a display/plan helper.
 *
 * Examples: 1.83 → 2 | 5.5 → 5 | 16.1 → 16 | 2.5 → 2 | 5.6 → 6
 */
function roundNewBaseline(val) {
  if (val == null || isNaN(Number(val))) return null;
  const n = Number(val);
  const floor = Math.floor(n);
  return (n - floor) >= 0.6 ? floor + 1 : floor;
}

// ─── Shared status option sets ────────────────────────────────────────────────

const STO_STATUS_OPTIONS = [
  { value: 'not_yet_started', label: 'Not started'  },
  { value: 'in_progress',     label: 'In progress'  },
  { value: 'met',             label: 'Met ✓'         },
  { value: 'regressed',       label: 'Regressed ↓'  },
  { value: 'discontinued',    label: 'Discontinued'  },
];

const STO_STATUS_COLORS = {
  not_yet_started: 'bg-slate-100 text-slate-500 border-slate-200',
  in_progress:     'bg-amber-50  text-amber-700  border-amber-200',
  met:             'bg-emerald-50 text-emerald-700 border-emerald-200',
  regressed:       'bg-red-50   text-red-600    border-red-200',
  discontinued:    'bg-stone-100 text-stone-500  border-stone-200',
};

const SKILL_STATUS_OPTIONS = [
  { value: 'new',         label: 'New'          },
  { value: 'in_progress', label: 'In progress'  },
  { value: 'mastered',    label: 'Mastered ✓'   },
  { value: 'regressed',   label: 'Regressed ↓'  },
  { value: 'on_hold',     label: 'On hold'       },
];

const SKILL_STATUS_COLORS = {
  new:         'bg-slate-100 text-slate-500 border-slate-200',
  in_progress: 'bg-amber-50  text-amber-700  border-amber-200',
  mastered:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  regressed:   'bg-red-50   text-red-600    border-red-200',
  on_hold:     'bg-stone-100 text-stone-500  border-stone-200',
};

// ─── Layout primitives ────────────────────────────────────────────────────────

function Panel({ title, icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-stone-100 flex-shrink-0">
        {icon}
        <h3 className="text-[13px] font-bold text-slate-800">{title}</h3>
      </div>
      {/* Panel body — scrollable within fixed height on large screens */}
      <div className="flex-1 p-5 space-y-6 overflow-y-auto" style={{ maxHeight: '70vh' }}>
        {children}
      </div>
    </div>
  );
}

function SubLabel({ label, count }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
      {label}
      {count != null && count > 0 && (
        <span className="ml-1.5 font-bold" style={{ color: '#F59E0B', fontFamily: 'DM Mono, monospace' }}>
          {count}
        </span>
      )}
    </p>
  );
}

// ─── Panel A — Behavior Progress ─────────────────────────────────────────────

/** Line chart showing per-session frequency data for one behavior. */
function BehaviorProgressChart({ behaviorId, summaryItem, sessionLogs, behaviorTargets }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  const { entries, baseline: computedBaseline } = buildBehaviorTrendFromLogs(sessionLogs ?? [], behaviorId);
  const baseline = summaryItem.baselineFrequency ?? computedBaseline;

  const bt       = (behaviorTargets ?? []).find(t => t.id === behaviorId);
  const stoSteps = (bt?.stoSteps ?? []).map(s => parseFloat(s.targetFrequency)).filter(v => !isNaN(v));

  const avg   = summaryItem.averageFrequency;
  const trend = summaryItem.trend;
  const trendIcon  = trend === 'improving' ? '↓' : trend === 'worsening' ? '↑' : '→';
  const trendColor = trend === 'improving' ? '#10B981' : trend === 'worsening' ? '#EF4444' : '#94A3B8';

  const dataKey = JSON.stringify({ entries, baseline, stoSteps });

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const n        = Math.max(entries.length, 2);
    const labels   = entries.length > 0 ? entries.map((_, i) => `S${i + 1}`) : [''];
    const freqVals = entries.map(e => e.frequency);
    const yMax     = Math.max(baseline ?? 0, ...freqVals, 1) * 1.3;
    const refLine  = val => val != null ? Array(n).fill(val) : null;

    const datasets = [];

    if (entries.length > 0) {
      datasets.push({
        type: 'line', label: 'Frequency', data: freqVals,
        borderColor: 'rgba(239,68,68,0.9)', backgroundColor: 'rgba(239,68,68,0.08)',
        borderWidth: 2, pointRadius: 4, pointBackgroundColor: 'rgba(239,68,68,0.9)',
        tension: 0.3, fill: false, order: 1,
      });
    }

    const baseData = refLine(baseline);
    if (baseData) datasets.push({
      type: 'line', label: `Baseline (${baseline})`, data: baseData,
      borderColor: 'rgba(148,163,184,0.7)', borderWidth: 1.5,
      borderDash: [4, 3], pointRadius: 0, fill: false, order: 3,
    });

    stoSteps.forEach((freq, i) => {
      const d = refLine(freq);
      if (d) datasets.push({
        type: 'line', label: `STO ${i + 1} (${freq})`, data: d,
        borderColor: 'rgba(245,158,11,0.7)', borderWidth: 1.5,
        borderDash: [6, 3], pointRadius: 0, fill: false, order: 4 + i,
      });
    });

    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 }, color: '#64748B' } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}` } },
        },
        scales: {
          y: {
            beginAtZero: true, max: Math.ceil(yMax),
            ticks: { font: { size: 10 }, color: '#94A3B8', stepSize: 1 },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
          x: { ticks: { font: { size: 10 }, color: '#94A3B8' }, grid: { display: false } },
        },
      },
    });

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [dataKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">
      <div className="px-4 pt-3 pb-2 relative" style={{ height: 180 }}>
        <canvas ref={canvasRef} />
        {entries.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[11px] text-slate-400 font-semibold bg-white/80 px-2 py-0.5 rounded">
              No sessions logged for this behavior.
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 px-4 py-2 border-t border-stone-100 bg-white flex-wrap">
        <span className="text-[11px] text-slate-500 font-semibold">
          {entries.length} session{entries.length !== 1 ? 's' : ''} logged
        </span>
        {avg != null && (
          <span className="text-[11px] text-slate-500 font-semibold">
            Avg: <span className="text-slate-700" style={{ fontFamily: 'DM Mono, monospace' }}>
              {typeof avg === 'number' ? avg.toFixed(1) : avg}
            </span>
          </span>
        )}
        <span className="text-[11px] font-bold" style={{ color: trendColor }}>Trend {trendIcon}</span>
      </div>
    </div>
  );
}

/** Compact table showing raw session-by-session data for one behavior. */
function BehaviorSessionTable({ behaviorId, sessionLogs }) {
  const { entries } = buildBehaviorTrendFromLogs(sessionLogs ?? [], behaviorId);
  if (entries.length === 0) return null;

  const stoLabel = status => {
    if (!status) return '—';
    const map = { in_progress: 'In progress', met: 'Met ✓', regressed: 'Regressed', not_yet_started: 'Not started', discontinued: 'Discontinued' };
    return map[status] ?? status.replace(/_/g, ' ');
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left" style={{ minWidth: 300 }}>
        <thead>
          <tr>
            {['Session', 'Date', 'Frequency', 'STO #', 'Status'].map(h => (
              <th key={h} className="pb-1.5 pr-3 text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map(e => (
            <tr key={e.sessionNumber} className="border-t border-stone-100">
              <td className="py-1.5 pr-3 text-[11px] font-semibold text-slate-500 tabular-nums" style={{ fontFamily: 'DM Mono, monospace' }}>S{e.sessionNumber}</td>
              <td className="py-1.5 pr-3 text-[11px] text-slate-500 whitespace-nowrap">{fmtDate(e.sessionDate)}</td>
              <td className="py-1.5 pr-3 text-[12px] font-bold text-slate-700 tabular-nums" style={{ fontFamily: 'DM Mono, monospace' }}>{e.frequency}</td>
              <td className="py-1.5 pr-3 text-[11px] text-slate-500">{e.currentStoNumber != null ? `STO ${e.currentStoNumber}` : '—'}</td>
              <td className="py-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                  e.stoStatus === 'met'         ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  e.stoStatus === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  e.stoStatus === 'regressed'   ? 'bg-red-50 text-red-600 border-red-200' :
                  'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  {stoLabel(e.stoStatus)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Card for one behavior — 3-level stacked layout:
 *   L1 — full behavior name + status badge
 *   L2 — metrics row (Base · Avg · Δ% · trend · Sessions toggle)
 *   L3 — collapsible chart + session table
 */
function BehaviorCard({ item, sessionLogs, behaviorTargets }) {
  const [expanded, setExpanded] = useState(false);

  const avg        = item.averageFrequency;   // computed from session logs — read-only
  const base       = item.baselineFrequency;  // original plan baseline — preserved for history
  const pctChange  = (avg != null && base != null && base > 0) ? ((avg - base) / base) * 100 : null;
  const newBase    = roundNewBaseline(avg);   // new-cycle baseline (custom rounding)

  const trendIcon  = item.trend === 'improving' ? '↓' : item.trend === 'worsening' ? '↑' : '→';
  const trendColor = item.trend === 'improving' ? '#10B981' : item.trend === 'worsening' ? '#EF4444' : '#94A3B8';
  const derivedStatus = item.sessionDerivedStoStatus ?? item.stoStatus ?? 'in_progress';
  const stoClass = STO_STATUS_COLORS[derivedStatus] ?? STO_STATUS_COLORS.in_progress;
  const stoLabel = derivedStatus === 'met' ? 'Met ✓' : derivedStatus === 'regressed' ? 'Regressed ↓' : derivedStatus === 'not_yet_started' ? 'Not started' : 'In progress';

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">

      {/* L1 — name + status */}
      <div className="flex items-center justify-between gap-3 px-3.5 pt-3 pb-1.5">
        <p className="text-[13px] font-bold text-slate-800 leading-snug">{item.behaviorName}</p>
        <span
          title="Status is automatically derived from session logs and cannot be overridden"
          className={`flex-shrink-0 text-[11px] font-semibold border rounded-lg px-2 py-0.5 select-none ${stoClass}`}
        >
          {stoLabel}
        </span>
      </div>

      {/* L2 — metrics row (all read-only — values come from session logs) */}
      <div className="flex items-center gap-x-4 gap-y-1 px-3.5 pb-1.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Base</span>
          <span className="text-[13px] font-semibold text-slate-500 tabular-nums" style={{ fontFamily: 'DM Mono, monospace' }}>{base ?? '—'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg</span>
          <span className="text-[13px] font-semibold text-slate-700 tabular-nums" style={{ fontFamily: 'DM Mono, monospace' }}>
            {avg != null ? avg.toFixed !== undefined ? Number(avg).toFixed(1) : avg : '—'}
          </span>
        </div>
        {pctChange !== null && (
          <span className={`text-[13px] font-semibold tabular-nums ${pctChange <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {pctChange <= 0 ? '' : '+'}{pctChange.toFixed(1)}%
          </span>
        )}
        <span className="text-[15px] font-bold" style={{ color: trendColor }}>{trendIcon}</span>
        <button
          type="button" onClick={() => setExpanded(v => !v)}
          className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-teal-600 transition-colors"
        >
          <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
          {expanded ? 'Hide' : 'Sessions'}
        </button>
      </div>

      {/* New cycle baseline pill — only when we have session data */}
      {newBase != null && (
        <div className="px-3.5 pb-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 border border-teal-200 px-2 py-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-teal-500">New cycle baseline</span>
            <span className="text-[12px] font-bold text-teal-700 tabular-nums" style={{ fontFamily: 'DM Mono, monospace' }}>{newBase}×/day</span>
            {avg != null && newBase !== Number(avg) && (
              <span className="text-[9px] text-teal-400">(avg {Number(avg).toFixed(1)})</span>
            )}
          </span>
        </div>
      )}

      {/* L3 — collapsible chart + session table */}
      {expanded && (
        <div className="border-t border-stone-100 px-3.5 py-3 bg-stone-50 space-y-3">
          <BehaviorProgressChart
            behaviorId={item.behaviorId}
            summaryItem={item}
            sessionLogs={sessionLogs}
            behaviorTargets={behaviorTargets}
          />
          <BehaviorSessionTable behaviorId={item.behaviorId} sessionLogs={sessionLogs} />
        </div>
      )}
    </div>
  );
}

const FN_CHIP_COLORS = {
  automatic: 'bg-purple-50 text-purple-700 border-purple-200',
  escape:    'bg-amber-50  text-amber-700  border-amber-200',
  attention: 'bg-sky-50    text-sky-700    border-sky-200',
  tangible:  'bg-rose-50   text-rose-700   border-rose-200',
};

/** Compact chips row for function + severity + first seen */
function BehaviorChips({ item }) {
  const fnClass = FN_CHIP_COLORS[item.function] ?? 'bg-slate-50 text-slate-500 border-slate-200';
  return (
    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
      {item.function && (
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${fnClass}`}>{item.function}</span>
      )}
      {item.severity && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-50 text-slate-500 border border-slate-200">{item.severity}</span>
      )}
      {item.firstSeenDate && (
        <span className="text-[10px] text-slate-400">First: {fmtDate(item.firstSeenDate)}</span>
      )}
    </div>
  );
}

/**
 * INCLUDE card — shows behavior name + chips + expandable STOs/LTO.
 * Collapsed by default; clicking "▾ N STOs" expands the milestone rail.
 */
function EmergingBehaviorPlanCard({ item }) {
  const [open, setOpen] = useState(false);
  const steps = item.stoStructure ?? [];
  const hasSteps = steps.length > 0;
  const hasMastery = item.masteryCriteriaFrequency != null;

  return (
    <div className="rounded-xl border border-teal-200 overflow-hidden" style={{ background: 'rgba(20,184,166,0.025)' }}>
      <div className="flex items-start gap-2.5 px-3.5 py-2.5">
        {/* INCLUDE badge */}
        <span className="flex-shrink-0 mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold border bg-teal-50 text-teal-700 border-teal-200">
          IN PLAN
        </span>
        {/* Name + chips */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-700">{item.behaviorName}</p>
          <BehaviorChips item={item} />
        </div>
        {/* STO expand toggle */}
        {(hasSteps || hasMastery) && (
          <button type="button" onClick={() => setOpen(v => !v)}
            className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold text-teal-600 hover:text-teal-800 transition-colors mt-0.5">
            <svg className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
            {hasSteps ? `${steps.length} STO${steps.length !== 1 ? 's' : ''}` : 'LTO'}
          </button>
        )}
      </div>

      {/* Expandable STO/LTO rail */}
      {open && (
        <div className="border-t border-teal-100 px-3.5 pb-3 pt-2.5 space-y-2">
          {/* STO milestone rail */}
          {hasSteps && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-teal-600 mb-2">Short-Term Objectives</p>
              <div className="flex items-center gap-0 overflow-x-auto pb-1">
                {/* Baseline node */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                  <p className="text-[9px] text-slate-400 mt-1 whitespace-nowrap">Baseline</p>
                  <p className="text-[10px] font-semibold text-slate-500 tabular-nums">
                    {item.baselineFrequency != null ? `${item.baselineFrequency}×` : '—'}
                  </p>
                </div>
                {steps.map((step, i) => (
                  <React.Fragment key={step.id}>
                    <div className="flex-1 h-px bg-teal-200 min-w-[20px]" />
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-teal-400" />
                      <p className="text-[9px] text-teal-600 font-semibold mt-1 whitespace-nowrap">STO {i + 1}</p>
                      <p className="text-[10px] font-semibold text-slate-600 tabular-nums whitespace-nowrap">
                        {step.targetFrequency != null && step.targetFrequency !== '' ? `≤${step.targetFrequency}×` : '—'}
                      </p>
                      {step.durationWeeks && (
                        <p className="text-[9px] text-slate-400 whitespace-nowrap">{step.durationWeeks}wk</p>
                      )}
                    </div>
                  </React.Fragment>
                ))}
                {/* LTO node */}
                {hasMastery && (
                  <>
                    <div className="flex-1 h-px bg-teal-300 min-w-[20px]" />
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                      <p className="text-[9px] text-teal-700 font-bold mt-1 whitespace-nowrap">LTO</p>
                      <p className="text-[10px] font-semibold text-teal-700 tabular-nums whitespace-nowrap">
                        ≤{item.masteryCriteriaFrequency}×
                      </p>
                      {item.masteryCriteriaWeeks && (
                        <p className="text-[9px] text-slate-400 whitespace-nowrap">{item.masteryCriteriaWeeks}wk</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {/* LTO free text */}
          {item.bcbaLtoText && (
            <p className="text-[11px] text-slate-500 leading-relaxed italic">{item.bcbaLtoText}</p>
          )}
          {/* Topographic definition */}
          {item.bcbaDefinitionFinal && (
            <div className="rounded-lg px-3 py-2 bg-white border border-stone-100">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Definition</p>
              <p className="text-[11px] text-slate-600 leading-relaxed">{item.bcbaDefinitionFinal}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** MONITOR row — compact, sky-colored badge, no expansion needed */
function EmergingBehaviorMonitorRow({ item }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-stone-100 last:border-0">
      <span className="flex-shrink-0 mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold border bg-sky-50 text-sky-700 border-sky-200">
        MONITOR
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-600">{item.behaviorName}</p>
        <BehaviorChips item={item} />
      </div>
    </div>
  );
}

/** EXCLUDED row — compact, stone-colored badge */
function ExcludedBehaviorRow({ item }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-stone-100 last:border-0">
      <span className="flex-shrink-0 mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold border bg-stone-100 text-stone-400 border-stone-200">
        EXCLUDED
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-400">{item.behaviorName}</p>
        <BehaviorChips item={item} />
      </div>
    </div>
  );
}

/** Maintenance row — for Met ✓ original plan behaviors */
function MaintenanceBehaviorRow({ item }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-stone-100 last:border-0">
      <span className="flex-shrink-0 mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
        MET ✓
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-600">{item.behaviorName}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">Transferred to maintenance monitoring in new cycle</p>
      </div>
      <span className="flex-shrink-0 text-[10px] text-emerald-600 font-semibold mt-0.5">
        {item.averageFrequency != null ? `Avg ${item.averageFrequency}×/day` : ''}
      </span>
    </div>
  );
}

// ─── Panel B — Skills ─────────────────────────────────────────────────────────

/**
 * Row in the "From Treatment Plan" skill table.
 * Current % is editable; status is a dropdown.
 */
function SkillProgressRow({ item, onPatch }) {
  const [localPct, setLocalPct] = useState(
    item.currentPercent != null ? String(item.currentPercent) : '',
  );

  useEffect(() => {
    setLocalPct(item.currentPercent != null ? String(item.currentPercent) : '');
  }, [item.currentPercent]);

  const parsedPct = parseFloat(localPct);
  const handleBlur = () => {
    const clamped = Math.min(100, Math.max(0, parsedPct));
    if (!isNaN(clamped)) onPatch({ currentPercent: clamped });
  };

  const statusClass = SKILL_STATUS_COLORS[item.status] ?? SKILL_STATUS_COLORS.new;

  return (
    <tr className="border-t border-stone-100 align-middle">

      <td className="py-2.5 pr-2 text-sm font-medium text-slate-700 max-w-[120px] truncate" title={item.skillName}>
        {item.skillName}
      </td>

      <td className="py-2.5 px-2 text-sm text-slate-500 text-center tabular-nums whitespace-nowrap">
        {item.baselinePercent ?? '—'}%
      </td>

      <td className="py-2.5 px-2 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <input
            type="number"
            value={localPct}
            onChange={e => setLocalPct(e.target.value)}
            onBlur={handleBlur}
            min={0} max={100}
            placeholder="—"
            className="w-14 text-center text-sm font-semibold text-slate-700 bg-white border border-stone-200 rounded-md px-1 py-0.5 focus:outline-none focus:border-teal-400 tabular-nums"
            style={{ fontFamily: 'DM Mono, monospace' }}
          />
          <span className="text-xs text-slate-400">%</span>
        </div>
      </td>

      <td className="py-2.5 pl-2">
        {/* Status — read-only, derived from session logs */}
        <span title="Status derived from session logs"
          className={`text-[11px] font-semibold border rounded-lg px-2 py-1 select-none ${statusClass}`}>
          {SKILL_STATUS_OPTIONS.find(o => o.value === (item.sessionDerivedStatus ?? item.status ?? 'new'))?.label ?? 'In progress'}
        </span>
      </td>
    </tr>
  );
}

/**
 * Card for one skill — 3-level stacked layout:
 *   L1 — full skill name + domain tag + status badge
 *   L2 — metrics row (Base · Current · Δ% · Sessions toggle)
 *   L3 — collapsible accuracy chart
 */
function SkillCard({ item, sessionLogs, skillGoal }) {
  const [expanded, setExpanded] = useState(false);

  const avg      = item.averageAccuracy;    // computed from session logs — read-only
  const base     = item.baselinePercent;    // original plan baseline — preserved for history
  const pctChange = (avg != null && base != null) ? (avg - base) : null;
  const newBase  = roundNewBaseline(avg);   // new-cycle baseline (custom rounding, as %)

  const derivedSkillStatus = item.sessionDerivedStatus ?? item.status ?? 'new';
  const statusClass = SKILL_STATUS_COLORS[derivedSkillStatus] ?? SKILL_STATUS_COLORS.new;

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">

      {/* L1 — name + domain + status */}
      <div className="flex items-start justify-between gap-3 px-3.5 pt-3 pb-1.5">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-slate-800 leading-snug">{item.skillName}</p>
          {item.domain && <p className="text-[10px] text-slate-400 mt-0.5">{item.domain}</p>}
        </div>
        <span title="Status derived from session logs"
          className={`flex-shrink-0 text-[11px] font-semibold border rounded-lg px-2 py-0.5 select-none ${statusClass}`}>
          {SKILL_STATUS_OPTIONS.find(o => o.value === derivedSkillStatus)?.label ?? 'In progress'}
        </span>
      </div>

      {/* L2 — metrics row (all read-only — values come from session logs) */}
      <div className="flex items-center gap-x-4 gap-y-1 px-3.5 pb-1.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Base</span>
          <span className="text-[13px] font-semibold text-slate-500 tabular-nums" style={{ fontFamily: 'DM Mono, monospace' }}>{base ?? '—'}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg</span>
          <span className="text-[13px] font-semibold text-slate-700 tabular-nums" style={{ fontFamily: 'DM Mono, monospace' }}>
            {avg != null ? `${Number(avg).toFixed(1)}%` : '—'}
          </span>
        </div>
        {pctChange !== null && (
          <span className={`text-[13px] font-semibold tabular-nums ${pctChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
          </span>
        )}
        <button
          type="button" onClick={() => setExpanded(v => !v)}
          className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-teal-600 transition-colors"
        >
          <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
          {expanded ? 'Hide' : 'Sessions'}
        </button>
      </div>

      {/* New cycle baseline pill */}
      {newBase != null && (
        <div className="px-3.5 pb-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 border border-teal-200 px-2 py-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-teal-500">New cycle baseline</span>
            <span className="text-[12px] font-bold text-teal-700 tabular-nums" style={{ fontFamily: 'DM Mono, monospace' }}>{newBase}%</span>
            {avg != null && newBase !== Number(avg) && (
              <span className="text-[9px] text-teal-400">(avg {Number(avg).toFixed(1)}%)</span>
            )}
          </span>
        </div>
      )}

      {/* L3 — collapsible accuracy chart */}
      {expanded && (
        <div className="border-t border-stone-100 bg-stone-50">
          <SkillProgressChart
            skillId={item.skillId}
            skillName={item.skillName}
            baselinePercent={item.baselinePercent ?? 0}
            stoSteps={skillGoal?.stoSteps ?? []}
            masteryCriteriaPercent={skillGoal?.masteryCriteriaPercent ?? 80}
            sessionLogs={sessionLogs}
          />
        </div>
      )}
    </div>
  );
}

/** INCLUDE card for a new skill — expandable STOs/LTO rail */
function NewSkillPlanCard({ item }) {
  const [open, setOpen] = useState(false);
  const steps = item.stoSteps ?? [];
  const hasSteps = steps.length > 0;
  const hasMastery = item.masteryCriteriaPercent != null;
  const name = item.skillName ?? item.bcbaGoalName ?? '(unnamed)';

  return (
    <div className="rounded-xl border border-teal-200 overflow-hidden" style={{ background: 'rgba(20,184,166,0.025)' }}>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <span className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border bg-teal-50 text-teal-700 border-teal-200">
          IN PLAN
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-700 truncate">{name}</p>
          {item.baselinePercent != null && (
            <p className="text-[10px] text-slate-400">Baseline: {item.baselinePercent}%</p>
          )}
        </div>
        {(hasSteps || hasMastery) && (
          <button type="button" onClick={() => setOpen(v => !v)}
            className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold text-teal-600 hover:text-teal-800 transition-colors">
            <svg className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
            {hasSteps ? `${steps.length} STO${steps.length !== 1 ? 's' : ''}` : 'LTO'}
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-teal-100 px-3.5 pb-3 pt-2.5 space-y-2">
          {hasSteps && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-teal-600 mb-2">Short-Term Objectives</p>
              <div className="flex items-center gap-0 overflow-x-auto pb-1">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                  <p className="text-[9px] text-slate-400 mt-1">Baseline</p>
                  <p className="text-[10px] font-semibold text-slate-500 tabular-nums">
                    {item.baselinePercent != null ? `${item.baselinePercent}%` : '—'}
                  </p>
                </div>
                {steps.map((step, i) => (
                  <React.Fragment key={step.id}>
                    <div className="flex-1 h-px bg-teal-200 min-w-[20px]" />
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-teal-400" />
                      <p className="text-[9px] text-teal-600 font-semibold mt-1 whitespace-nowrap">STO {i + 1}</p>
                      <p className="text-[10px] font-semibold text-slate-600 tabular-nums whitespace-nowrap">
                        {step.targetPercent != null && step.targetPercent !== '' ? `${step.targetPercent}%` : '—'}
                      </p>
                      {step.durationWeeks && <p className="text-[9px] text-slate-400 whitespace-nowrap">{step.durationWeeks}wk</p>}
                    </div>
                  </React.Fragment>
                ))}
                {hasMastery && (
                  <>
                    <div className="flex-1 h-px bg-teal-300 min-w-[20px]" />
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                      <p className="text-[9px] text-teal-700 font-bold mt-1">LTO</p>
                      <p className="text-[10px] font-semibold text-teal-700 tabular-nums">{item.masteryCriteriaPercent}%</p>
                      {item.masteryCriteriaWeeks && <p className="text-[9px] text-slate-400 whitespace-nowrap">{item.masteryCriteriaWeeks}wk</p>}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {item.bcbaLtoText && <p className="text-[11px] text-slate-500 leading-relaxed italic">{item.bcbaLtoText}</p>}
        </div>
      )}
    </div>
  );
}

/** MONITOR row for a new skill */
function NewSkillMonitorRow({ item }) {
  const name = item.skillName ?? item.bcbaGoalName ?? '(unnamed)';
  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-stone-100 last:border-0">
      <span className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border bg-sky-50 text-sky-700 border-sky-200">
        MONITOR
      </span>
      <span className="text-sm font-medium text-slate-600 truncate flex-1">{name}</span>
      {item.baselinePercent != null && (
        <span className="text-[10px] text-slate-400 flex-shrink-0">Baseline: {item.baselinePercent}%</span>
      )}
    </div>
  );
}

/** EXCLUDED row for a new skill */
function ExcludedSkillRow({ item }) {
  const name = item.skillName ?? item.bcbaGoalName ?? '(unnamed)';
  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-stone-100 last:border-0">
      <span className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border bg-stone-100 text-stone-400 border-stone-200">
        EXCLUDED
      </span>
      <span className="text-sm font-medium text-slate-400 truncate flex-1">{name}</span>
      {item.baselinePercent != null && (
        <span className="text-[10px] text-slate-300 flex-shrink-0">Baseline: {item.baselinePercent}%</span>
      )}
    </div>
  );
}

/** Maintenance row for a mastered skill from the original plan */
function MaintenanceSkillRow({ item }) {
  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-stone-100 last:border-0">
      <span className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
        MASTERED ✓
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-600 truncate">{item.skillName}</p>
        <p className="text-[10px] text-slate-400">Transferred to maintenance monitoring in new cycle</p>
      </div>
      {item.currentPercent != null && (
        <span className="flex-shrink-0 text-[10px] text-emerald-600 font-semibold">{item.currentPercent}%</span>
      )}
    </div>
  );
}

/** INCLUDE card for a new caregiver training goal — expandable STOs/LTO rail */
function NewCaregiverPlanCard({ item }) {
  const [open, setOpen] = useState(false);
  const steps = (item.stoSteps ?? []).filter(s => s.targetPercent !== '' && s.targetPercent != null);
  const hasSteps = steps.length > 0;
  const hasMastery = item.masteryCriteriaPercent != null;
  const name = item.goalName ?? '(unnamed)';

  return (
    <div className="rounded-xl border border-teal-200 overflow-hidden" style={{ background: 'rgba(20,184,166,0.025)' }}>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <span className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border bg-teal-50 text-teal-700 border-teal-200">
          IN PLAN
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-700 truncate">{name}</p>
          {item.baselinePercent != null && (
            <p className="text-[10px] text-slate-400">Baseline: {item.baselinePercent}%</p>
          )}
        </div>
        {(hasSteps || hasMastery) && (
          <button type="button" onClick={() => setOpen(v => !v)}
            className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold text-teal-600 hover:text-teal-800 transition-colors">
            <svg className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
            {hasSteps ? `${steps.length} STO${steps.length !== 1 ? 's' : ''}` : 'LTO'}
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-teal-100 px-3.5 pb-3 pt-2.5 space-y-2">
          {hasSteps && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-teal-600 mb-2">Short-Term Objectives</p>
              <div className="flex items-center gap-0 overflow-x-auto pb-1">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                  <p className="text-[9px] text-slate-400 mt-1">Baseline</p>
                  <p className="text-[10px] font-semibold text-slate-500 tabular-nums">
                    {item.baselinePercent != null ? `${item.baselinePercent}%` : '—'}
                  </p>
                </div>
                {steps.map((step, i) => (
                  <React.Fragment key={step.id ?? i}>
                    <div className="flex-1 h-px bg-teal-200 min-w-[20px]" />
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-teal-400" />
                      <p className="text-[9px] text-teal-600 font-semibold mt-1 whitespace-nowrap">STO {i + 1}</p>
                      <p className="text-[10px] font-semibold text-slate-600 tabular-nums whitespace-nowrap">
                        {step.targetPercent != null && step.targetPercent !== '' ? `${step.targetPercent}%` : '—'}
                      </p>
                      {step.durationWeeks && <p className="text-[9px] text-slate-400 whitespace-nowrap">{step.durationWeeks}wk</p>}
                    </div>
                  </React.Fragment>
                ))}
                {hasMastery && (
                  <>
                    <div className="flex-1 h-px bg-teal-300 min-w-[20px]" />
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                      <p className="text-[9px] text-teal-700 font-bold mt-1">LTO</p>
                      <p className="text-[10px] font-semibold text-teal-700 tabular-nums">{item.masteryCriteriaPercent}%</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {item.bcbaLtoText && <p className="text-[11px] text-slate-500 leading-relaxed italic">{item.bcbaLtoText}</p>}
        </div>
      )}
    </div>
  );
}

/** MONITOR row for a new caregiver training goal */
function NewCaregiverMonitorRow({ item }) {
  const name = item.goalName ?? '(unnamed)';
  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-stone-100 last:border-0">
      <span className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border bg-sky-50 text-sky-700 border-sky-200">
        MONITOR
      </span>
      <span className="text-sm font-medium text-slate-600 truncate flex-1">{name}</span>
      {item.baselinePercent != null && (
        <span className="text-[10px] text-slate-400 flex-shrink-0">Baseline: {item.baselinePercent}%</span>
      )}
    </div>
  );
}

/** EXCLUDED row for a new caregiver training goal */
function ExcludedCaregiverRow({ item }) {
  const name = item.goalName ?? '(unnamed)';
  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-stone-100 last:border-0">
      <span className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border bg-stone-100 text-stone-400 border-stone-200">
        EXCLUDED
      </span>
      <span className="text-sm font-medium text-slate-400 truncate flex-1">{name}</span>
      {item.baselinePercent != null && (
        <span className="text-[10px] text-slate-300 flex-shrink-0">Baseline: {item.baselinePercent}%</span>
      )}
    </div>
  );
}

// ─── Panel B — Skill progress chart ──────────────────────────────────────────

/**
 * Inline Chart.js line chart for one skill acquisition goal.
 * Shows per-session accuracy % with baseline, per-STO, and mastery reference lines.
 */
function SkillProgressChart({ skillId, skillName, baselinePercent, stoSteps, masteryCriteriaPercent, sessionLogs }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  const { entries, average, trend } = buildSkillTrendFromLogs(sessionLogs ?? [], skillId);

  const baseline  = Number(baselinePercent ?? 0);
  const mastery   = Number(masteryCriteriaPercent ?? 80);
  const validSTOs = (stoSteps ?? []).filter(s => s.targetPercent !== '' && s.targetPercent != null);

  const trendIcon  = trend === 'improving' ? '↑' : trend === 'worsening' ? '↓' : '→';
  const trendColor = trend === 'improving' ? '#10B981' : trend === 'worsening' ? '#EF4444' : '#94A3B8';

  const dataKey = JSON.stringify({ entries, baseline, validSTOs, mastery });

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const n      = Math.max(entries.length, 2);
    const labels = entries.length > 0 ? entries.map((_, i) => `S${i + 1}`) : [''];

    const refLine = val => (val != null ? Array(n).fill(val) : null);

    const datasets = [];

    if (entries.length > 0) {
      datasets.push({
        type:            'line',
        label:           'Accuracy %',
        data:            entries.map(e => e.accuracy),
        borderColor:     'rgba(20,184,166,1)',
        backgroundColor: 'rgba(20,184,166,0.10)',
        borderWidth:     2,
        pointRadius:     4,
        pointBackgroundColor: 'rgba(20,184,166,1)',
        tension:         0.3,
        fill:            false,
        order:           1,
      });
    }

    const baseData = refLine(baseline);
    if (baseData) datasets.push({
      type: 'line', label: `Baseline (${baseline}%)`, data: baseData,
      borderColor: 'rgba(148,163,184,0.7)', borderWidth: 1.5,
      borderDash: [4, 3], pointRadius: 0, fill: false, order: 5,
    });

    validSTOs.forEach((s, i) => {
      const val = Number(s.targetPercent);
      if (isNaN(val)) return;
      datasets.push({
        type: 'line', label: `STO ${i + 1} (${val}%)`, data: refLine(val),
        borderColor: 'rgba(245,158,11,0.8)', borderWidth: 1.5,
        borderDash: [6, 3], pointRadius: 0, fill: false, order: 4,
      });
    });

    const masteryData = refLine(mastery);
    if (masteryData) datasets.push({
      type: 'line', label: `Mastery (${mastery}%)`, data: masteryData,
      borderColor: 'rgba(52,211,153,0.9)', borderWidth: 1.5,
      borderDash: [3, 3], pointRadius: 0, fill: false, order: 3,
    });

    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        animation:           false,
        plugins: {
          legend: {
            position: 'bottom',
            labels:   { boxWidth: 12, font: { size: 10 }, color: '#64748B' },
          },
          tooltip: {
            callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max:         100,
            ticks:       { callback: v => `${v}%`, font: { size: 10 }, color: '#94A3B8' },
            grid:        { color: 'rgba(0,0,0,0.04)' },
          },
          x: {
            ticks: { font: { size: 10 }, color: '#94A3B8' },
            grid:  { display: false },
          },
        },
      },
    });

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [dataKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-stone-100 bg-white">
        <p className="text-[12px] font-bold text-slate-700">{skillName}</p>
      </div>
      <div className="px-4 pt-3 pb-2 relative" style={{ height: 180 }}>
        <canvas ref={canvasRef} />
        {entries.length === 0 && (
          <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
            <p className="text-[11px] text-slate-400 font-semibold bg-white/80 px-2 py-0.5 rounded">
              No session data logged yet.
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 px-4 py-2 border-t border-stone-100 bg-white flex-wrap">
        <span className="text-[11px] text-slate-500 font-semibold">
          {entries.length} session{entries.length !== 1 ? 's' : ''} logged
        </span>
        {average != null && (
          <span className="text-[11px] text-slate-500 font-semibold">
            Avg:{' '}
            <span className="text-slate-700" style={{ fontFamily: 'DM Mono, monospace' }}>
              {average.toFixed(1)}%
            </span>
          </span>
        )}
        <span className="text-[11px] font-bold" style={{ color: trendColor }}>
          Trend {trendIcon}
        </span>
      </div>
    </div>
  );
}

// ─── Panel B — Caregiver training chart ──────────────────────────────────────

/**
 * Inline line chart for one caregiver training target.
 * Overlays actual session percentages on baseline / STO / LTO reference lines.
 * Built via Chart.js on a canvas ref — destroyed and recreated when data changes.
 */
function CaregiverProgressChart({ summaryItem, ctLogs }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  // Chronological session data for this target
  const sessionData = (ctLogs ?? [])
    .slice()
    .sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate))
    .flatMap(log =>
      (log.trainingEntries ?? [])
        .filter(e => e.targetId === summaryItem.targetId)
        .map(e => ({ sessionPercent: e.sessionPercent })),
    );

  const baseline = summaryItem.baselinePercent ?? null;

  // Parse first numeric % from STO / LTO strings  (e.g. "55% accuracy over 4 weeks")
  const parseFirstPct = str => {
    const m = (str ?? '').match(/(\d+(\.\d+)?)%/);
    return m ? Number(m[1]) : null;
  };
  const stoVal = parseFirstPct(summaryItem.sto);
  const ltoVal = parseFirstPct(summaryItem.lto);

  const avg   = summaryItem.averageSessionPercent;
  const trend = summaryItem.trend;
  const trendIcon  = trend === 'improving' ? '↑' : trend === 'worsening' ? '↓' : '→';
  const trendColor = trend === 'improving' ? '#10B981' : trend === 'worsening' ? '#EF4444' : '#94A3B8';

  // Memoised key so the chart rebuilds only when underlying data truly changes
  const dataKey = JSON.stringify({ data: sessionData, baseline, stoVal, ltoVal });

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const n      = Math.max(sessionData.length, 2);
    const labels = sessionData.length > 0
      ? sessionData.map((_, i) => `S${i + 1}`)
      : [''];

    const refLine = val => (val != null ? Array(n).fill(val) : null);

    const datasets = [];

    if (sessionData.length > 0) {
      datasets.push({
        type:            'line',
        label:           'Session %',
        data:            sessionData.map(e => e.sessionPercent),
        borderColor:     'rgba(20,184,166,1)',
        backgroundColor: 'rgba(20,184,166,0.10)',
        borderWidth:     2,
        pointRadius:     4,
        pointBackgroundColor: 'rgba(20,184,166,1)',
        tension:         0.3,
        fill:            false,
        order:           1,
      });
    }

    const baseData = refLine(baseline);
    if (baseData) datasets.push({
      type: 'line', label: `Baseline (${baseline}%)`, data: baseData,
      borderColor: 'rgba(148,163,184,0.7)', borderWidth: 1.5,
      borderDash: [4, 3], pointRadius: 0, fill: false, order: 3,
    });

    const stoData = refLine(stoVal);
    if (stoData) datasets.push({
      type: 'line', label: `STO (${stoVal}%)`, data: stoData,
      borderColor: 'rgba(245,158,11,0.8)', borderWidth: 1.5,
      borderDash: [6, 3], pointRadius: 0, fill: false, order: 4,
    });

    const ltoData = refLine(ltoVal);
    if (ltoData) datasets.push({
      type: 'line', label: `LTO (${ltoVal}%)`, data: ltoData,
      borderColor: 'rgba(52,211,153,0.9)', borderWidth: 1.5,
      borderDash: [3, 3], pointRadius: 0, fill: false, order: 5,
    });

    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        animation:           false,
        plugins: {
          legend: {
            position: 'bottom',
            labels:   { boxWidth: 12, font: { size: 10 }, color: '#64748B' },
          },
          tooltip: {
            callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max:         100,
            ticks:       { callback: v => `${v}%`, font: { size: 10 }, color: '#94A3B8' },
            grid:        { color: 'rgba(0,0,0,0.04)' },
          },
          x: {
            ticks: { font: { size: 10 }, color: '#94A3B8' },
            grid:  { display: false },
          },
        },
      },
    });

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [dataKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">

      {/* Chart title */}
      <div className="px-4 py-2.5 border-b border-stone-100 bg-white">
        <p className="text-[12px] font-bold text-slate-700">{summaryItem.goalName}</p>
      </div>

      {/* Canvas */}
      <div className="px-4 pt-3 pb-2 relative" style={{ height: 180 }}>
        <canvas ref={canvasRef} />
        {sessionData.length === 0 && (
          <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
            <p className="text-[11px] text-slate-400 font-semibold bg-white/80 px-2 py-0.5 rounded">
              No sessions logged yet.
            </p>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-stone-100 bg-white flex-wrap">
        <span className="text-[11px] text-slate-500 font-semibold">
          {summaryItem.sessionsLogged ?? 0} session{(summaryItem.sessionsLogged ?? 0) !== 1 ? 's' : ''} logged
        </span>
        {avg != null && (
          <span className="text-[11px] text-slate-500 font-semibold">
            Avg:{' '}
            <span className="text-slate-700" style={{ fontFamily: 'DM Mono, monospace' }}>
              {avg.toFixed(1)}%
            </span>
          </span>
        )}
        <span className="text-[11px] font-bold" style={{ color: trendColor }}>
          Trend {trendIcon}
        </span>
      </div>
    </div>
  );
}

/**
 * Accordion card for one caregiver training target —
 * compact summary row (goal name · baseline · avg · trend · sessions toggle)
 * that expands to the full Chart.js chart, matching the BehaviorCard pattern.
 */
/**
 * Card for one caregiver training goal — 3-level stacked layout:
 *   L1 — full goal name + trend indicator
 *   L2 — metrics row (Base · Avg · Δ% · Sessions toggle)
 *   L3 — collapsible progress chart
 */
function CaregiverCard({ summaryItem, ctLogs }) {
  const [expanded, setExpanded] = useState(false);

  const avg   = summaryItem.averageSessionPercent;
  const base  = summaryItem.baselinePercent ?? null;
  const trend = summaryItem.trend;
  const trendIcon  = trend === 'improving' ? '↑' : trend === 'worsening' ? '↓' : '→';
  const trendColor = trend === 'improving' ? '#10B981' : trend === 'worsening' ? '#EF4444' : '#94A3B8';
  const pctChange  = (avg != null && base != null) ? (avg - base) : null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">

      {/* L1 — goal name + trend */}
      <div className="flex items-center justify-between gap-3 px-3.5 pt-3 pb-1.5">
        <p className="text-[13px] font-bold text-slate-800 leading-snug">{summaryItem.goalName}</p>
        <span className="flex-shrink-0 text-[15px] font-bold" style={{ color: trendColor }}>{trendIcon}</span>
      </div>

      {/* L2 — metrics row */}
      <div className="flex items-center gap-x-4 gap-y-1 px-3.5 pb-2.5 flex-wrap">
        {base != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Base</span>
            <span className="text-[13px] font-semibold text-slate-500 tabular-nums" style={{ fontFamily: 'DM Mono, monospace' }}>{base}%</span>
          </div>
        )}
        {avg != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg</span>
            <span className="text-[13px] font-semibold text-slate-700 tabular-nums" style={{ fontFamily: 'DM Mono, monospace' }}>{avg.toFixed(1)}%</span>
          </div>
        )}
        {pctChange !== null && (
          <span className={`text-[13px] font-semibold tabular-nums ${pctChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
          </span>
        )}
        <button
          type="button" onClick={() => setExpanded(v => !v)}
          className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-teal-600 transition-colors"
        >
          <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
          {expanded ? 'Hide' : 'Sessions'}
        </button>
      </div>

      {/* L3 — collapsible progress chart */}
      {expanded && (
        <div className="border-t border-stone-100 bg-stone-50">
          <CaregiverProgressChart summaryItem={summaryItem} ctLogs={ctLogs} />
        </div>
      )}
    </div>
  );
}

// ─── ReassessmentReviewPage ───────────────────────────────────────────────────

export default function ReassessmentReviewPage({
  clientId, clients, setClients, currentUser, session, addNotif, onComplete,
}) {
  const client = clients?.find(c => c.id === clientId) ?? null;

  // Previous auth period CPT hours (from Plan Draft of initial assessment)
  const prevPlanDraft = client?.checklist?.plan_draft ?? {};
  const prevHours = {
    '97153': prevPlanDraft.hours_97153 ?? '',
    '97155': prevPlanDraft.hours_97155 ?? '',
    '97156': prevPlanDraft.hours_97156 ?? '',
  };

  // ── Panel C local state (blur-save pattern) ────────────────────────────────
  const [narrative, setNarrative] = useState(session?.progressNarrativeText ?? '');
  const [cpt97153,  setCpt97153]  = useState(String(session?.cptHours?.['97153'] ?? ''));
  const [cpt97155,  setCpt97155]  = useState(String(session?.cptHours?.['97155'] ?? ''));
  const [cpt97156,  setCpt97156]  = useState(String(session?.cptHours?.['97156'] ?? ''));
  const [isGenerating, setIsGenerating] = useState(false);

  // Keep local inputs in sync when session id changes (e.g. navigation)
  useEffect(() => {
    setNarrative(session?.progressNarrativeText ?? '');
    setCpt97153(String(session?.cptHours?.['97153'] ?? ''));
    setCpt97155(String(session?.cptHours?.['97155'] ?? ''));
    setCpt97156(String(session?.cptHours?.['97156'] ?? ''));
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null;

  // ── Data arrays from session ───────────────────────────────────────────────
  const origBehaviors      = session.originalBehaviorSummary  ?? [];
  const newBehaviors       = session.newBehaviorSummary        ?? [];
  const origSkills         = session.originalSkillSummary      ?? [];
  const newSkills          = session.newSkillSummary           ?? [];
  const ctSummary          = session.caregiverTrainingSummary  ?? [];
  const newCaregiverItems  = session.newCaregiverSummary       ?? [];
  const ctLogs             = client?.caregiver_training_session_logs ?? [];
  const sessionLogs     = client?.service_session_logs ?? [];
  const behaviorTargets = session?.sections?.behavior_targets?.behaviorTargets ?? [];
  const skillGoalsDefs  = session?.sections?.skill_acquisitions?.skillGoals ?? [];

  // ── Patch helpers (immutable array updates via patchSession) ──────────────
  const patchOrigBehavior = (idx, patch) =>
    patchSession(setClients, clientId, {
      originalBehaviorSummary: origBehaviors.map((item, i) =>
        i === idx ? { ...item, ...patch } : item,
      ),
    });

  const patchOrigSkill = (idx, patch) =>
    patchSession(setClients, clientId, {
      originalSkillSummary: origSkills.map((item, i) =>
        i === idx ? { ...item, ...patch } : item,
      ),
    });

  // ── Blur-save handlers ────────────────────────────────────────────────────
  const handleNarrativeBlur = () =>
    patchSession(setClients, clientId, { progressNarrativeText: narrative });

  const handleCptBlur = () =>
    patchSession(setClients, clientId, {
      cptHours: { '97153': cpt97153, '97155': cpt97155, '97156': cpt97156 },
    });

  // ── Generate gate ─────────────────────────────────────────────────────────
  const narrativeReady = narrative.trim().length > 100;
  const behaviorsReady = origBehaviors.length > 0;
  const canGenerate    = narrativeReady && behaviorsReady && !isGenerating;

  const disabledReason = !narrativeReady
    ? 'Complete the Progress Note (at least 100 characters) and ensure behavior data is entered.'
    : !behaviorsReady
      ? 'At least one behavior from the treatment plan is required.'
      : '';

  // ── Generate handler ──────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);

    try {
      const clientName = session.clientName ?? client?.name ?? 'Client';
      const safeName   = clientName.replace(/\s+/g, '_');
      const dateStr    = new Date().toISOString().slice(0, 10);
      const fileName   = `${safeName}_Reassessment_${dateStr}.docx`;

      // Generate purpose-built reassessment document with progress charts
      const blob = await generateReassessmentDoc(session, clientName, sessionLogs, ctLogs);

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Encode as base64 for Documents tab (chunked to avoid stack overflow on large blobs)
      const arrayBuffer = await blob.arrayBuffer();
      const bytes  = new Uint8Array(arrayBuffer);
      let binary   = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const dataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${btoa(binary)}`;

      const now = new Date().toISOString();

      const doc = {
        id:          `doc_${Date.now()}`,
        type:        'progress_report',
        label:       `DRAFT_${fileName}`,
        uploaded_at: now,
        by:          currentUser?.name ?? 'BCBA',
        stage:       'services',
        dataUrl,
      };

      const logEntry = {
        id:     `log_${Date.now() + 1}`,
        action: `Reassessment document generated by ${currentUser?.name ?? 'BCBA'}`,
        ts:     now,
        by:     currentUser?.name ?? 'BCBA',
      };

      // Batch all side effects in one setClients call:
      //  1. Mark reassessment session complete
      //  2. Push doc to client.documents
      //  3. Prepend activity log entry
      setClients(prev => prev.map(c => {
        if (c.id !== clientId) return c;
        return {
          ...c,
          assessment_session: {
            ...c.assessment_session,
            status:      'complete',
            completedAt: now,
            updatedAt:   now,
          },
          documents:    [...(c.documents ?? []), doc],
          activity_log: [logEntry, ...(c.activity_log ?? [])],
        };
      }));

      addNotif?.({
        type:    'success',
        message: `Reassessment draft saved to ${client?.name ?? 'client'}'s Documents tab.`,
      });

      // Navigate back to client detail page (AssessmentFeature archives session first)
      onComplete?.();

    } catch (err) {
      console.error('[ReassessmentReviewPage] Doc generation failed:', err);
      addNotif?.({ type: 'error', message: 'Document generation failed. Please try again.' });
    }

    setIsGenerating(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Generating overlay ─────────────────────────────────────────────── */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center max-w-sm w-full mx-4">
            <div className="w-10 h-10 animate-spin border-4 border-teal-500 border-t-transparent rounded-full" />
            <p className="text-lg font-semibold text-slate-800 mt-4">Building reassessment report…</p>
            <p className="text-sm text-slate-500 mt-2 text-center">
              Compiling clinical data and generating document. This takes a few seconds.
            </p>
          </div>
        </div>
      )}

      {/* ── Scrollable content area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-stone-50">
        <div className="max-w-[1440px] mx-auto px-6 py-6">

          {/* Page title */}
          <div className="mb-4">
            <h2 className="text-[17px] font-bold text-slate-800">Reassessment Review</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">
              Review session progress data, finalise the narrative, then generate the reassessment document.
            </p>
          </div>

          {/* Reused content info banner */}
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <svg className="w-4 h-4 text-sky-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div>
              <p className="text-[12px] font-semibold text-sky-800">Some content is carried over from the previous authorization period.</p>
              <p className="text-[11px] text-sky-600 mt-0.5 leading-relaxed">
                Demographics, medical necessity fields, and caregiver training baselines are pre-filled from the initial assessment.
                Status badges are automatically derived from session logs and cannot be manually overridden.
                Behaviors and skills marked <strong>IN PLAN</strong> will become formal targets in the next treatment plan.
                Items marked <strong>MONITOR</strong> are observed but not added as plan targets.
              </p>
            </div>
          </div>

          {/* Three-panel grid — stacks vertically below lg breakpoint */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

            {/* ── Panel A — Behavior Progress ────────────────────────────── */}
            <Panel
              title="Behavior Progress"
              icon={
                <svg className="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/>
                </svg>
              }
            >
              {/* Original behaviors — active (non-met) only; met move to Maintenance below */}
              {(() => {
                const activeBehaviors = origBehaviors.filter(
                  b => (b.sessionDerivedStoStatus ?? b.stoStatus) !== 'met'
                );
                return (
                  <div>
                    <SubLabel label="From treatment plan" count={activeBehaviors.length} />
                    {activeBehaviors.length === 0 ? (
                      <p className="text-sm text-slate-400 py-6 text-center">
                        {origBehaviors.length > 0
                          ? 'All plan behaviors have reached mastery — see Maintenance below.'
                          : 'No behaviors from treatment plan.'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {activeBehaviors.map((item, i) => (
                          <BehaviorCard
                            key={item.behaviorId ?? item.behaviorName ?? i}
                            item={item}
                            sessionLogs={sessionLogs}
                            behaviorTargets={behaviorTargets}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── New Cycle section ──────────────────────────────────── */}
              {(() => {
                const masteredOriginals = origBehaviors.filter(
                  b => (b.sessionDerivedStoStatus ?? b.stoStatus) === 'met'
                );
                const inPlanBehaviors    = newBehaviors.filter(b => b.includedInPlan === true);
                const monitorBehaviors  = newBehaviors.filter(b => b.monitorOnly === true);
                const excludedBehaviors = newBehaviors.filter(b => !b.includedInPlan && !b.monitorOnly);
                if (masteredOriginals.length === 0 && newBehaviors.length === 0) return null;
                return (
                  <div className="space-y-4">
                    <SubLabel label="New cycle" />

                    {/* Maintenance — mastered originals */}
                    {masteredOriginals.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 mb-1.5">
                          Maintenance ({masteredOriginals.length})
                        </p>
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 divide-y divide-emerald-100 px-3">
                          {masteredOriginals.map((item, i) => (
                            <MaintenanceBehaviorRow key={item.behaviorId ?? item.behaviorName ?? i} item={item} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* In plan — new behaviors included in next treatment plan */}
                    {inPlanBehaviors.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-600 mb-1.5">
                          In plan ({inPlanBehaviors.length})
                        </p>
                        <div className="space-y-2">
                          {inPlanBehaviors.map((item, i) => (
                            <EmergingBehaviorPlanCard key={item.behaviorName ?? i} item={item} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Monitor — new behaviors being observed but not as plan targets */}
                    {monitorBehaviors.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-600 mb-1.5">
                          Monitor ({monitorBehaviors.length})
                        </p>
                        <div className="rounded-xl border border-sky-100 bg-sky-50/30 divide-y divide-stone-100 px-3">
                          {monitorBehaviors.map((item, i) => (
                            <EmergingBehaviorMonitorRow key={item.behaviorName ?? i} item={item} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Excluded — new behaviors not being added to the plan */}
                    {excludedBehaviors.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">
                          Excluded ({excludedBehaviors.length})
                        </p>
                        <div className="rounded-xl border border-stone-200 bg-stone-50/50 divide-y divide-stone-100 px-3">
                          {excludedBehaviors.map((item, i) => (
                            <ExcludedBehaviorRow key={item.behaviorName ?? i} item={item} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </Panel>

            {/* ── Panel B — Skill & Caregiver Training Progress ──────────── */}
            <Panel
              title="Skill & Caregiver Training Progress"
              icon={
                <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              }
            >
              {/* Original skills — card layout with progress bar */}
              <div>
                <SubLabel label="From treatment plan" count={origSkills.length} />
                {origSkills.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">No skill goals from treatment plan.</p>
                ) : (
                  <div className="space-y-2">
                    {origSkills.map((item, i) => {
                      const skillGoal = skillGoalsDefs.find(g => g.id === item.skillId) ?? null;
                      return (
                        <SkillCard
                          key={item.skillId ?? item.skillName ?? i}
                          item={item}
                          sessionLogs={sessionLogs}
                          skillGoal={skillGoal}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── New Cycle — Skills ──────────────────────────────────── */}
              {(() => {
                const masteredOrigSkills = origSkills.filter(
                  s => (s.sessionDerivedStatus ?? s.status) === 'mastered'
                );
                const inPlanSkills    = newSkills.filter(s => s.includedInPlan === true);
                const monitorSkills  = newSkills.filter(s => s.monitorOnly === true);
                const excludedSkills = newSkills.filter(s => !s.includedInPlan && !s.monitorOnly);
                if (masteredOrigSkills.length === 0 && newSkills.length === 0) return null;
                return (
                  <div className="space-y-4">
                    <SubLabel label="New cycle — skills" />

                    {/* Maintenance — mastered originals */}
                    {masteredOrigSkills.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 mb-1.5">
                          Maintenance ({masteredOrigSkills.length})
                        </p>
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 divide-y divide-emerald-100 px-3">
                          {masteredOrigSkills.map((item, i) => (
                            <MaintenanceSkillRow key={item.skillId ?? item.skillName ?? i} item={item} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* In plan — new skills included in next treatment plan */}
                    {inPlanSkills.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-600 mb-1.5">
                          In plan ({inPlanSkills.length})
                        </p>
                        <div className="space-y-2">
                          {inPlanSkills.map((item, i) => (
                            <NewSkillPlanCard key={item.skillId ?? item.skillName ?? i} item={item} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Monitor — new skills being observed but not as plan targets */}
                    {monitorSkills.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-600 mb-1.5">
                          Monitor ({monitorSkills.length})
                        </p>
                        <div className="rounded-xl border border-sky-100 bg-sky-50/30 divide-y divide-stone-100 px-3">
                          {monitorSkills.map((item, i) => (
                            <NewSkillMonitorRow key={item.skillId ?? item.skillName ?? i} item={item} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Excluded — new skills not being added to the plan */}
                    {excludedSkills.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">
                          Excluded ({excludedSkills.length})
                        </p>
                        <div className="rounded-xl border border-stone-200 bg-stone-50/50 divide-y divide-stone-100 px-3">
                          {excludedSkills.map((item, i) => (
                            <ExcludedSkillRow key={item.skillId ?? item.skillName ?? i} item={item} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Caregiver training — accordion cards */}
              {ctSummary.length > 0 && (
                <div>
                  <SubLabel label="Caregiver training" count={ctSummary.length} />
                  <div className="space-y-2">
                    {ctSummary.map((entry, i) => (
                      <CaregiverCard
                        key={entry.targetId ?? i}
                        summaryItem={entry}
                        ctLogs={ctLogs}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── New Cycle — Caregiver Training ──────────────────────── */}
              {(() => {
                const inPlanCT    = newCaregiverItems.filter(c => c.includedInPlan === true);
                const monitorCT   = newCaregiverItems.filter(c => c.monitorOnly === true);
                const excludedCT  = newCaregiverItems.filter(c => !c.includedInPlan && !c.monitorOnly);
                if (newCaregiverItems.length === 0) return null;
                return (
                  <div className="space-y-4">
                    <SubLabel label="New cycle — caregiver training" />

                    {/* In plan */}
                    {inPlanCT.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-600 mb-1.5">
                          In plan ({inPlanCT.length})
                        </p>
                        <div className="space-y-2">
                          {inPlanCT.map((item, i) => (
                            <NewCaregiverPlanCard key={item.goalName ?? i} item={item} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Monitor */}
                    {monitorCT.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-600 mb-1.5">
                          Monitor ({monitorCT.length})
                        </p>
                        <div className="rounded-xl border border-sky-100 bg-sky-50/30 divide-y divide-stone-100 px-3">
                          {monitorCT.map((item, i) => (
                            <NewCaregiverMonitorRow key={item.goalName ?? i} item={item} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Excluded — new caregiver goals not being added to the plan */}
                    {excludedCT.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">
                          Excluded ({excludedCT.length})
                        </p>
                        <div className="rounded-xl border border-stone-200 bg-stone-50/50 divide-y divide-stone-100 px-3">
                          {excludedCT.map((item, i) => (
                            <ExcludedCaregiverRow key={item.goalName ?? i} item={item} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </Panel>

            {/* ── Panel C — Narrative & Document ─────────────────────────── */}
            <Panel
              title="Narrative & Document"
              icon={
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              }
            >
              {/* Auth period chip */}
              <div className="rounded-xl px-3.5 py-3" style={{ background: 'rgba(20,184,166,0.07)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-500 mb-0.5">
                  Authorization Period
                </p>
                <p className="text-sm font-bold text-teal-800">
                  {fmtDate(session.authPeriodStart)} — {fmtDate(session.authPeriodEnd)}
                </p>
              </div>

              {/* Assessment type locked badge */}
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Assessment Type
                </p>
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                  Reassessment
                </span>
              </div>

              {/* Medical Necessity summary — read-only review of interview Section 8 */}
              {(() => {
                const mn = session?.sections?.medical_necessity ?? {};
                const hasDx   = (mn.coOccurringDiagnoses ?? []).length > 0;
                const hasMeds = (mn.medications ?? []).length > 0;
                const hasABA  = mn.hasPriorABA && (mn.priorABAHistory ?? []).length > 0;
                const hasAny  = mn.recommendedHoursPerWeek || mn.recommendedSetting || hasDx || hasMeds || hasABA || mn.notes?.trim();
                if (!hasAny) return null;
                return (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                      Medical Necessity
                    </p>
                    <div className="rounded-xl border border-stone-200 bg-slate-50/60 px-3.5 py-3 space-y-3">
                      {(mn.recommendedHoursPerWeek || mn.recommendedSetting) && (
                        <div className="flex gap-5">
                          {mn.recommendedHoursPerWeek && (
                            <div>
                              <p className="text-[9px] uppercase tracking-widest text-slate-400">Recommended</p>
                              <p className="text-sm font-bold text-teal-700">{mn.recommendedHoursPerWeek}h/wk</p>
                            </div>
                          )}
                          {mn.recommendedSetting && (
                            <div>
                              <p className="text-[9px] uppercase tracking-widest text-slate-400">Setting</p>
                              <p className="text-sm font-semibold text-slate-700">{mn.recommendedSetting}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {hasDx && (
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-slate-400 mb-1">Co-occurring Diagnoses</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(mn.coOccurringDiagnoses ?? []).map((d, i) => (
                              <span key={d.id ?? i} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white border border-stone-200 text-slate-600">
                                {[d.diagnosis, d.icd10].filter(Boolean).join(' · ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {hasMeds && (
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-slate-400 mb-1">Medications</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(mn.medications ?? []).map((m, i) => (
                              <span key={m.id ?? i} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white border border-stone-200 text-slate-600">
                                {[m.name, m.dose, m.frequency].filter(Boolean).join(' · ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {hasABA && (
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-slate-400 mb-1">Prior ABA History</p>
                          <div className="space-y-1">
                            {(mn.priorABAHistory ?? []).map((h, i) => (
                              <p key={h.id ?? i} className="text-[11px] text-slate-600 leading-snug">
                                {[h.provider, h.startDate && h.endDate ? `${h.startDate} – ${h.endDate}` : h.startDate, h.hoursPerWeek ? `${h.hoursPerWeek}h/wk` : '', h.setting].filter(Boolean).join(' · ')}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      {mn.notes?.trim() && (
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-slate-400 mb-1">Clinical Notes</p>
                          <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">{mn.notes.trim()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Progress note */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                  Progress Note
                </p>
                <textarea
                  value={narrative}
                  onChange={e => setNarrative(e.target.value)}
                  onBlur={handleNarrativeBlur}
                  rows={9}
                  placeholder="Summarize client progress during this authorization period — behavioral changes, skill acquisition gains, caregiver training outcomes, and clinical rationale for continued services…"
                  className="w-full rounded-xl border border-stone-200 px-3.5 py-3 text-sm text-slate-700 bg-white focus:outline-none focus:border-teal-400 resize-none placeholder:text-slate-300 leading-relaxed"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                />
                <div className="flex justify-between items-center mt-1.5">
                  <span className="text-[10px] text-slate-400">Minimum 100 characters required to generate</span>
                  <span
                    className={`text-[10px] font-semibold tabular-nums ${
                      narrative.trim().length >= 100 ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                    style={{ fontFamily: 'DM Mono, monospace' }}
                  >
                    {narrative.trim().length} / 100
                  </span>
                </div>
              </div>

              {/* CPT hours — hours requested in the reassessment document */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                  CPT Hours Requested
                </p>
                <div className="space-y-2">
                  {[
                    { code: '97153', label: 'Direct therapy',     val: cpt97153, set: setCpt97153 },
                    { code: '97155', label: 'BCBA supervision',   val: cpt97155, set: setCpt97155 },
                    { code: '97156', label: 'Caregiver training', val: cpt97156, set: setCpt97156 },
                  ].map(({ code, label, val, set }) => (
                    <div key={code} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-600">{code}</p>
                        <p className="text-[11px] text-slate-400">{label}</p>
                        {prevHours[code] && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Previous: <span className="font-semibold text-slate-500">{prevHours[code]}h/mo</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={val}
                          onChange={e => set(e.target.value)}
                          onBlur={handleCptBlur}
                          min={0}
                          placeholder="—"
                          className="w-16 text-right text-sm font-semibold text-slate-700 bg-white border border-stone-200 rounded-lg px-2 py-1 focus:outline-none focus:border-teal-400 tabular-nums"
                          style={{ fontFamily: 'DM Mono, monospace' }}
                        />
                        <span className="text-xs text-slate-400 w-8">h/mo</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vineland / BASC-3 callout */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    After generating, add <strong>Vineland-3</strong> and <strong>BASC-3</strong> score reports and
                    graphs to the document before submitting to the insurer.
                  </p>
                </div>
              </div>
            </Panel>
          </div>

          {/* Bottom spacing so last panel clears the sticky footer */}
          <div className="h-24" />
        </div>
      </div>

      {/* ── Sticky footer ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-t border-stone-200 px-6 py-4">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">

          {/* Readiness indicator */}
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            {canGenerate ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                Ready to generate
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                {!narrativeReady ? 'Progress Note incomplete' : 'No behavior data found'}
              </>
            )}
          </div>

          {/* Generate button — wraps in a div so title tooltip shows even when button is disabled */}
          <div title={disabledReason}>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`
                flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold rounded-xl transition-all
                ${canGenerate
                  ? 'text-white hover:opacity-90 active:scale-[0.97] cursor-pointer'
                  : 'text-slate-400 bg-stone-100 border border-stone-200 cursor-not-allowed'
                }
              `}
              style={canGenerate ? { background: '#0D9488' } : {}}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Generate Reassessment Document
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
