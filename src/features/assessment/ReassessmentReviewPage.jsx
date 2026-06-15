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
import { generateAssessmentDoc } from './lib/generateAssessmentDoc.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
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

/**
 * Single row in the "From Treatment Plan" behavior table.
 * Avg frequency is editable; % change is computed live; STO status is a dropdown.
 */
function BehaviorProgressRow({ item, onPatch }) {
  const [localAvg, setLocalAvg] = useState(
    item.averageFrequency != null ? String(item.averageFrequency) : '',
  );

  useEffect(() => {
    setLocalAvg(item.averageFrequency != null ? String(item.averageFrequency) : '');
  }, [item.averageFrequency]);

  const parsedAvg = parseFloat(localAvg);
  const base = item.baselineFrequency;

  // For maladaptive behaviors: reduction is good → negative pctChange shown in green
  const pctChange = (!isNaN(parsedAvg) && base != null && base > 0)
    ? ((parsedAvg - base) / base) * 100
    : null;

  const handleBlur = () => {
    if (!isNaN(parsedAvg)) onPatch({ averageFrequency: parsedAvg });
  };

  // trend arrow: improving = fewer occurrences = ↓ green
  const trendIcon  = item.trend === 'improving' ? '↓' : item.trend === 'worsening' ? '↑' : '→';
  const trendColor = item.trend === 'improving' ? '#10B981' : item.trend === 'worsening' ? '#EF4444' : '#94A3B8';
  const stoClass   = STO_STATUS_COLORS[item.stoStatus] ?? STO_STATUS_COLORS.in_progress;

  return (
    <tr className="border-t border-stone-100 align-middle">

      {/* Behavior name */}
      <td className="py-2.5 pr-2 text-sm font-medium text-slate-700 max-w-[100px] truncate" title={item.behaviorName}>
        {item.behaviorName}
      </td>

      {/* Baseline */}
      <td className="py-2.5 px-2 text-sm text-slate-500 text-center tabular-nums whitespace-nowrap">
        {base ?? '—'}
      </td>

      {/* Avg (editable) */}
      <td className="py-2.5 px-2 text-center">
        <input
          type="number"
          value={localAvg}
          onChange={e => setLocalAvg(e.target.value)}
          onBlur={handleBlur}
          min={0}
          placeholder="—"
          className="w-14 text-center text-sm font-semibold text-slate-700 bg-white border border-stone-200 rounded-md px-1 py-0.5 focus:outline-none focus:border-teal-400 tabular-nums"
          style={{ fontFamily: 'DM Mono, monospace' }}
        />
      </td>

      {/* % change (live) — negative = green for behaviors */}
      <td className="py-2.5 px-2 text-center text-sm font-semibold tabular-nums whitespace-nowrap">
        {pctChange === null ? (
          <span className="text-slate-300">—</span>
        ) : pctChange <= 0 ? (
          <span className="text-emerald-600">{pctChange.toFixed(1)}%</span>
        ) : (
          <span className="text-red-500">+{pctChange.toFixed(1)}%</span>
        )}
      </td>

      {/* Trend */}
      <td className="py-2.5 px-2 text-center text-base font-bold">
        <span style={{ color: trendColor }}>{trendIcon}</span>
      </td>

      {/* STO status dropdown */}
      <td className="py-2.5 pl-2">
        <select
          value={item.stoStatus ?? 'in_progress'}
          onChange={e => onPatch({ stoStatus: e.target.value })}
          className={`text-[11px] font-semibold border rounded-lg px-2 py-1 focus:outline-none focus:border-teal-400 transition-colors ${stoClass}`}
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {STO_STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
    </tr>
  );
}

const FN_CHIP_COLORS = {
  automatic: 'bg-purple-50 text-purple-700 border-purple-200',
  escape:    'bg-amber-50  text-amber-700  border-amber-200',
  attention: 'bg-sky-50    text-sky-700    border-sky-200',
  tangible:  'bg-rose-50   text-rose-700   border-rose-200',
};

/**
 * Read-only card for an emerging behavior — shows include/exclude decision badge
 * set during the reassessment interview, plus function and severity chips.
 */
function EmergingBehaviorRow({ item }) {
  const included = item.includedInPlan;
  const fnClass  = FN_CHIP_COLORS[item.function] ?? 'bg-slate-50 text-slate-500 border-slate-200';

  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-stone-100 last:border-0">
      {/* Include/exclude badge */}
      <span className={`flex-shrink-0 mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold border ${
        included === true  ? 'bg-teal-50  text-teal-700  border-teal-200'  :
        included === false ? 'bg-stone-100 text-stone-400 border-stone-200' :
                             'bg-amber-50  text-amber-600 border-amber-200'
      }`}>
        {included === true ? 'INCLUDE' : included === false ? 'EXCLUDE' : 'PENDING'}
      </span>

      {/* Name + chips */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 truncate">{item.behaviorName}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {item.function && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${fnClass}`}>
              {item.function}
            </span>
          )}
          {item.severity && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-50 text-slate-500 border border-slate-200">
              {item.severity}
            </span>
          )}
          {item.firstSeenDate && (
            <span className="text-[10px] text-slate-400">
              First: {fmtDate(item.firstSeenDate)}
            </span>
          )}
        </div>
      </div>
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
        <select
          value={item.status ?? 'new'}
          onChange={e => onPatch({ status: e.target.value })}
          className={`text-[11px] font-semibold border rounded-lg px-2 py-1 focus:outline-none focus:border-teal-400 transition-colors ${statusClass}`}
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {SKILL_STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
    </tr>
  );
}

/** Read-only badge row for a newly identified skill goal. */
function NewSkillRow({ item }) {
  const included = item.includedInPlan;
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-stone-100 last:border-0">
      <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border ${
        included === true  ? 'bg-teal-50  text-teal-700  border-teal-200'  :
        included === false ? 'bg-stone-100 text-stone-400 border-stone-200' :
                             'bg-amber-50  text-amber-600 border-amber-200'
      }`}>
        {included === true ? 'INCLUDE' : included === false ? 'EXCLUDE' : 'PENDING'}
      </span>
      <span className="text-sm font-medium text-slate-700 truncate flex-1">
        {item.skillName ?? item.bcbaGoalName ?? '(unnamed)'}
      </span>
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

// ─── ReassessmentReviewPage ───────────────────────────────────────────────────

export default function ReassessmentReviewPage({
  clientId, clients, setClients, currentUser, session, addNotif, onComplete,
}) {
  const client = clients?.find(c => c.id === clientId) ?? null;

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
  const origBehaviors = session.originalBehaviorSummary  ?? [];
  const newBehaviors  = session.newBehaviorSummary        ?? [];
  const origSkills    = session.originalSkillSummary      ?? [];
  const newSkills     = session.newSkillSummary           ?? [];
  const ctSummary     = session.caregiverTrainingSummary  ?? [];
  const ctLogs        = client?.caregiver_training_session_logs ?? [];

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

      // Generate .docx from existing pipeline (session.sessionType === 'reassessment')
      const blob = await generateAssessmentDoc(session, clientName);

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
      //  2. Auto-complete progress_report checklist item (services_reauth)
      //  3. Push doc to client.documents
      //  4. Prepend activity log entry
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
          checklist: {
            ...c.checklist,
            services_reauth: {
              ...(c.checklist?.services_reauth ?? {}),
              progress_report: true,
            },
          },
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
          <div className="mb-5">
            <h2 className="text-[17px] font-bold text-slate-800">Reassessment Review</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">
              Review session progress data, finalise the narrative, then generate the reassessment document.
            </p>
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
              {/* Original behaviors table */}
              <div>
                <SubLabel label="From treatment plan" count={origBehaviors.length} />
                {origBehaviors.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">No behaviors from treatment plan.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left" style={{ minWidth: 360 }}>
                      <thead>
                        <tr>
                          {['Behavior', 'Base', 'Avg', 'Δ%', '', 'Status'].map(h => (
                            <th key={h} className="pb-2 pr-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {origBehaviors.map((item, i) => (
                          <BehaviorProgressRow
                            key={item.behaviorId ?? item.behaviorName ?? i}
                            item={item}
                            onPatch={patch => patchOrigBehavior(i, patch)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Emerging behaviors */}
              {newBehaviors.length > 0 && (
                <div>
                  <SubLabel label="Emerging behaviors" count={newBehaviors.length} />
                  <div>
                    {newBehaviors.map((item, i) => (
                      <EmergingBehaviorRow key={item.behaviorName ?? i} item={item} />
                    ))}
                  </div>
                </div>
              )}
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
              {/* Original skills table */}
              <div>
                <SubLabel label="From treatment plan" count={origSkills.length} />
                {origSkills.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">No skill goals from treatment plan.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left" style={{ minWidth: 320 }}>
                      <thead>
                        <tr>
                          {['Skill', 'Base', 'Current', 'Status'].map(h => (
                            <th key={h} className="pb-2 pr-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {origSkills.map((item, i) => (
                          <SkillProgressRow
                            key={item.skillId ?? item.skillName ?? i}
                            item={item}
                            onPatch={patch => patchOrigSkill(i, patch)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* New skills */}
              {newSkills.length > 0 && (
                <div>
                  <SubLabel label="New skills" count={newSkills.length} />
                  <div>
                    {newSkills.map((item, i) => (
                      <NewSkillRow key={item.skillId ?? item.skillName ?? i} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {/* Caregiver training charts */}
              {ctSummary.length > 0 && (
                <div>
                  <SubLabel label="Caregiver training" count={ctSummary.length} />
                  <div className="space-y-4">
                    {ctSummary.map((entry, i) => (
                      <CaregiverProgressChart
                        key={entry.targetId ?? i}
                        summaryItem={entry}
                        ctLogs={ctLogs}
                      />
                    ))}
                  </div>
                </div>
              )}
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
