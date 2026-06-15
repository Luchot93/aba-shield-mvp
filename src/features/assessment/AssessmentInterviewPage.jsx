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

const STO_STATUS_OPTIONS = [
  { value: 'not_yet_started', label: 'Not Started' },
  { value: 'in_progress',     label: 'In Progress' },
  { value: 'mastered',        label: 'Mastered'    },
  { value: 'discontinued',    label: 'Discontinued'},
];

const STO_STATUS_COLORS = {
  not_yet_started: 'text-slate-500 bg-slate-50 border-slate-200',
  in_progress:     'text-amber-700 bg-amber-50 border-amber-200',
  mastered:        'text-emerald-700 bg-emerald-50 border-emerald-200',
  discontinued:    'text-red-600 bg-red-50 border-red-200',
};

const FUNCTIONS = ['Escape', 'Attention', 'Access', 'Automatic'];

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Part A: single row in the "from treatment plan" table ────────────────────

function OrigBehaviorRow({ item, idx, patchOrigItem }) {
  const [localAvg, setLocalAvg] = useState(
    item.averageFrequency != null ? String(item.averageFrequency) : '',
  );

  useEffect(() => {
    setLocalAvg(item.averageFrequency != null ? String(item.averageFrequency) : '');
  }, [item.averageFrequency]);

  const parsedAvg = parseFloat(localAvg);
  const base      = item.baselineFrequency;
  const pctChange = (!isNaN(parsedAvg) && base && base !== 0)
    ? ((base - parsedAvg) / base) * 100   // positive = reduction = good
    : null;

  const handleAvgBlur = () => {
    if (!isNaN(parsedAvg)) patchOrigItem(idx, { averageFrequency: parsedAvg });
  };

  const statusColorClass = STO_STATUS_COLORS[item.stoStatus] ?? STO_STATUS_COLORS.in_progress;

  return (
    <tr className="border-t border-stone-100 align-middle">

      {/* Behavior name */}
      <td className="py-2.5 pr-3 text-sm font-medium text-slate-700 whitespace-nowrap">
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
          onBlur={handleAvgBlur}
          min={0}
          className="w-16 text-center text-sm font-semibold text-slate-700 bg-white border border-stone-200 rounded-md px-1 py-0.5 focus:outline-none focus:border-teal-400 tabular-nums"
          style={{ fontFamily: 'DM Mono, monospace' }}
        />
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

      {/* STO status (editable dropdown) */}
      <td className="py-2.5 pl-2">
        <select
          value={item.stoStatus ?? 'in_progress'}
          onChange={e => patchOrigItem(idx, { stoStatus: e.target.value })}
          className={`text-[11px] font-semibold border rounded-lg px-2 py-1 focus:outline-none focus:border-teal-400 transition-colors ${statusColorClass}`}
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

// ─── Part B: card for a single emerging behavior ──────────────────────────────

function NewBehaviorRow({ item, idx, patchNewItem }) {
  const [defDraft, setDefDraft] = useState(item.bcbaDefinitionFinal ?? '');

  useEffect(() => {
    setDefDraft(item.bcbaDefinitionFinal ?? '');
  }, [item.bcbaDefinitionFinal]);

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
        {item.severity && (
          <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
            item.severity === 'Severe'   ? 'bg-red-50 text-red-700 border border-red-200' :
            item.severity === 'Moderate' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
            'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {item.severity}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-4">

        {/* RBT data strip */}
        <div className="flex flex-wrap gap-4 items-start">
          {item.rbtDefinitionDraft && (
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">RBT Description</p>
              <p className="text-[12px] text-slate-500 leading-relaxed italic">{item.rbtDefinitionDraft}</p>
            </div>
          )}
          <div className="flex gap-5 flex-shrink-0 text-center">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Baseline</p>
              <p className="text-sm font-semibold text-slate-700 tabular-nums">{item.baselineFrequency ?? '—'}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Avg</p>
              <p className="text-sm font-semibold text-slate-700 tabular-nums">{item.averageFrequency ?? '—'}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Trend</p>
              <p className={`text-base font-bold ${trendColor}`}>{trendIcon}</p>
            </div>
          </div>
        </div>

        <div className="h-px bg-amber-100"/>

        {/* BCBA assessment */}
        <div className="space-y-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">BCBA Assessment</p>

          {/* Topographic definition */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Topographic Definition</p>
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

          {/* Function */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Hypothesized Function</p>
            <div className="flex flex-wrap gap-1.5">
              {FUNCTIONS.map(fn => {
                const active = item.function === fn;
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

          {/* Include toggle */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Include in Treatment Plan</p>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => patchNewItem(idx, { includedInPlan: true })}
                className={`px-3 py-1 text-[12px] font-semibold rounded-lg border transition-all ${
                  item.includedInPlan === true
                    ? 'text-white border-teal-600 bg-teal-600'
                    : 'text-slate-500 border-stone-200 bg-white hover:border-teal-300'
                }`}>
                Yes — add to plan
              </button>
              <button type="button"
                onClick={() => patchNewItem(idx, { includedInPlan: false })}
                className={`px-3 py-1 text-[12px] font-semibold rounded-lg border transition-all ${
                  item.includedInPlan === false
                    ? 'text-white border-slate-500 bg-slate-500'
                    : 'text-slate-500 border-stone-200 bg-white hover:border-slate-300'
                }`}>
                No — monitor only
              </button>
            </div>
          </div>

          {/* STO builder (only when included) */}
          {item.includedInPlan === true && (
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
                      className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-slate-600 rounded-lg px-3 py-2"
                      style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
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
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Maladaptive Behaviors section — reassessment view ────────────────────────

function BehaviorTargetsReassessmentCard({
  session, clientId, setClients, sectionIndex, isExpanded, onToggle,
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
                      {['Behavior', 'Baseline', 'Avg this period', '% Change', 'STO', 'Status'].map(h => (
                        <th key={h} className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 pr-3 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {origSummary.map((item, idx) => (
                      <OrigBehaviorRow
                        key={item.behaviorId ?? idx}
                        item={item}
                        idx={idx}
                        patchOrigItem={patchOrigItem}
                      />
                    ))}
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

// ─── Part A: single row in the "from treatment plan" skills table ─────────────

const SKILL_STATUS_OPTIONS = [
  { value: 'new',         label: 'New'         },
  { value: 'in_progress', label: 'In Progress'  },
  { value: 'met',         label: 'Met'          },
];

const SKILL_STATUS_COLORS = {
  new:         'text-slate-500 bg-slate-50 border-slate-200',
  in_progress: 'text-amber-700 bg-amber-50 border-amber-200',
  met:         'text-emerald-700 bg-emerald-50 border-emerald-200',
};

function OrigSkillRow({ item, idx, patchOrigItem }) {
  const [localCurrent, setLocalCurrent] = useState(
    item.currentPercent != null ? String(item.currentPercent) : '',
  );

  useEffect(() => {
    setLocalCurrent(item.currentPercent != null ? String(item.currentPercent) : '');
  }, [item.currentPercent]);

  const handleCurrentBlur = () => {
    const v = parseFloat(localCurrent);
    if (!isNaN(v)) patchOrigItem(idx, { currentPercent: Math.min(100, Math.max(0, v)) });
  };

  const statusColorClass = SKILL_STATUS_COLORS[item.status] ?? SKILL_STATUS_COLORS.new;

  return (
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

      {/* Current % (editable) */}
      <td className="py-2.5 px-2 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <input
            type="number"
            value={localCurrent}
            onChange={e => setLocalCurrent(e.target.value)}
            onBlur={handleCurrentBlur}
            min={0} max={100}
            placeholder="—"
            className="w-16 text-center text-sm font-semibold text-slate-700 bg-white border border-stone-200 rounded-md px-1 py-0.5 focus:outline-none focus:border-teal-400 tabular-nums"
            style={{ fontFamily: 'DM Mono, monospace' }}
          />
          <span className="text-xs text-slate-400">%</span>
        </div>
      </td>

      {/* Status dropdown */}
      <td className="py-2.5 pl-2">
        <select
          value={item.status ?? 'new'}
          onChange={e => patchOrigItem(idx, { status: e.target.value })}
          className={`text-[11px] font-semibold border rounded-lg px-2 py-1 focus:outline-none focus:border-teal-400 transition-colors ${statusColorClass}`}
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

// ─── Part B: card for a single new skill ──────────────────────────────────────

function NewSkillRow({ item, idx, patchNewItem }) {
  const [stoText,     setStoText]     = useState(item.bcbaStoText     ?? '');
  const [ltoText,     setLtoText]     = useState(item.bcbaLtoText     ?? '');
  const [baselinePct, setBaselinePct] = useState(
    item.baselinePercent != null ? String(item.baselinePercent) : '',
  );
  const [currentPct,  setCurrentPct]  = useState(
    item.currentPercent != null ? String(item.currentPercent) : '',
  );

  useEffect(() => { setStoText(item.bcbaStoText     ?? ''); }, [item.bcbaStoText]);
  useEffect(() => { setLtoText(item.bcbaLtoText     ?? ''); }, [item.bcbaLtoText]);
  useEffect(() => {
    setBaselinePct(item.baselinePercent != null ? String(item.baselinePercent) : '');
  }, [item.baselinePercent]);
  useEffect(() => {
    setCurrentPct(item.currentPercent != null ? String(item.currentPercent) : '');
  }, [item.currentPercent]);

  const clampPct = (v) => Math.min(100, Math.max(0, parseFloat(v)));

  return (
    <div className="rounded-xl border border-teal-200 overflow-hidden"
      style={{ background: 'rgba(20,184,166,0.025)', fontFamily: 'DM Sans, sans-serif' }}>

      {/* Card header */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-teal-100 bg-teal-50/30">
        {/* Flag icon */}
        <svg className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" fill="currentColor" viewBox="0 0 16 16">
          <path d="M14.778.085A.5.5 0 0 1 15 .5V8a.5.5 0 0 1-.314.464l-.003.001-.006.003-.023.009a12.435 12.435 0 0 1-.397.15c-.264.095-.631.223-1.047.35-.816.252-1.879.523-2.71.523-.847 0-1.548-.28-2.158-.525l-.028-.01C7.68 8.71 7.14 8.5 6.5 8.5c-.7 0-1.638.23-2.437.477A19.626 19.626 0 0 0 3 9.342V15.5a.5.5 0 0 1-1 0V.5a.5.5 0 0 1 1 0v.282c.226-.079.496-.17.79-.26C4.606.272 5.67 0 6.5 0c.84 0 1.524.277 2.121.519l.043.018C9.286.788 9.828 1 10.5 1c.7 0 1.638-.23 2.437-.477a19.587 19.587 0 0 0 1.349-.476l.019-.007.004-.002h.001"/>
        </svg>
        <span className="text-sm font-semibold text-slate-700">{item.skillName}</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200">
          NEW{item.firstSeenDate ? ` — first seen ${fmtDate(item.firstSeenDate)}` : ''}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-4">

        {/* RBT notes (read-only) */}
        {item.rbtNotes && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">RBT Notes</p>
            <p className="text-[12px] text-slate-500 leading-relaxed italic">{item.rbtNotes}</p>
          </div>
        )}

        <div className="h-px bg-teal-100"/>

        {/* BCBA section */}
        <div className="space-y-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">BCBA Assessment</p>

          {/* Baseline + Current % — inline row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Baseline %</p>
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
            <div className="flex-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Current %</p>
              <div className="flex items-center gap-1">
                <input
                  type="number" min={0} max={100}
                  value={currentPct}
                  onChange={e => setCurrentPct(e.target.value)}
                  onBlur={() => {
                    const v = clampPct(currentPct);
                    if (!isNaN(v)) patchNewItem(idx, { currentPercent: v });
                  }}
                  placeholder="—"
                  className="w-20 text-sm font-semibold text-slate-700 bg-white border border-stone-200 rounded-md px-2 py-1 focus:outline-none focus:border-teal-400 tabular-nums"
                  style={{ fontFamily: 'DM Mono, monospace' }}
                />
                <span className="text-xs text-slate-400">%</span>
              </div>
            </div>
          </div>

          {/* Short-term objective */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Short-Term Objective</p>
            <textarea
              value={stoText}
              onChange={e => setStoText(e.target.value)}
              onBlur={() => patchNewItem(idx, { bcbaStoText: stoText })}
              placeholder="Describe the short-term milestone for this skill…"
              rows={2}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            />
          </div>

          {/* Long-term goal */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Long-Term Goal</p>
            <textarea
              value={ltoText}
              onChange={e => setLtoText(e.target.value)}
              onBlur={() => patchNewItem(idx, { bcbaLtoText: ltoText })}
              placeholder="Describe the mastery criterion for this skill…"
              rows={2}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            />
          </div>

          {/* Include in plan toggle */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Include in Treatment Plan</p>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => patchNewItem(idx, { includedInPlan: true })}
                className={`px-3 py-1 text-[12px] font-semibold rounded-lg border transition-all ${
                  item.includedInPlan === true
                    ? 'text-white border-teal-600 bg-teal-600'
                    : 'text-slate-500 border-stone-200 bg-white hover:border-teal-300'
                }`}>
                Yes — add to plan
              </button>
              <button type="button"
                onClick={() => patchNewItem(idx, { includedInPlan: false })}
                className={`px-3 py-1 text-[12px] font-semibold rounded-lg border transition-all ${
                  item.includedInPlan === false
                    ? 'text-white border-slate-500 bg-slate-500'
                    : 'text-slate-500 border-stone-200 bg-white hover:border-slate-300'
                }`}>
                No — monitor only
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skill Acquisitions section — reassessment view ───────────────────────────

function SkillAcquisitionsReassessmentCard({
  session, clientId, setClients, sectionIndex, isExpanded, onToggle,
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
                      {['Skill', 'Baseline', 'Current Level', 'Status'].map(h => (
                        <th key={h} className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 pr-3 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {origSummary.map((item, idx) => (
                      <OrigSkillRow
                        key={item.skillId ?? idx}
                        item={item}
                        idx={idx}
                        patchOrigItem={patchOrigItem}
                      />
                    ))}
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

function CaregiverTrainingSummaryRow({ item, idx, patchItem }) {
  const [localAvg, setLocalAvg] = useState(
    item.averageSessionPercent != null ? String(item.averageSessionPercent) : '',
  );

  useEffect(() => {
    setLocalAvg(item.averageSessionPercent != null ? String(item.averageSessionPercent) : '');
  }, [item.averageSessionPercent]);

  const parsedAvg  = parseFloat(localAvg);
  const base       = item.baselinePercent;
  // For CT: positive pctChange = avg > baseline = improvement = good
  const pctChange  = (!isNaN(parsedAvg) && base != null && base !== 0)
    ? ((parsedAvg - base) / base) * 100
    : null;

  const handleAvgBlur = () => {
    if (!isNaN(parsedAvg)) patchItem(idx, { averageSessionPercent: parsedAvg });
  };

  // trend icon: improving = ↑ green, worsening = ↓ red, flat = → gray
  const trendIcon  = item.trend === 'improving' ? '↑' : item.trend === 'worsening' ? '↓' : '→';
  const trendColor = item.trend === 'improving' ? 'text-emerald-600' : item.trend === 'worsening' ? 'text-red-500' : 'text-slate-400';

  const stoColorClass = STO_STATUS_COLORS[item.stoStatus] ?? STO_STATUS_COLORS.in_progress;

  return (
    <tr className="border-t border-stone-100 align-middle">

      {/* Goal name */}
      <td className="py-2.5 pr-3 text-sm font-medium text-slate-700 whitespace-nowrap">
        {item.goalName}
      </td>

      {/* Baseline % */}
      <td className="py-2.5 px-2 text-sm text-slate-500 text-center tabular-nums whitespace-nowrap">
        {base != null ? `${base}%` : '—'}
      </td>

      {/* Avg this period (editable) */}
      <td className="py-2.5 px-2 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <input
            type="number"
            value={localAvg}
            onChange={e => setLocalAvg(e.target.value)}
            onBlur={handleAvgBlur}
            min={0} max={100}
            placeholder="—"
            className="w-16 text-center text-sm font-semibold text-slate-700 bg-white border border-stone-200 rounded-md px-1 py-0.5 focus:outline-none focus:border-teal-400 tabular-nums"
            style={{ fontFamily: 'DM Mono, monospace' }}
          />
          <span className="text-xs text-slate-400">%</span>
        </div>
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

      {/* STO Status dropdown */}
      <td className="py-2.5 pl-2">
        <select
          value={item.stoStatus ?? 'in_progress'}
          onChange={e => patchItem(idx, { stoStatus: e.target.value })}
          className={`text-[11px] font-semibold border rounded-lg px-2 py-1 focus:outline-none focus:border-teal-400 transition-colors ${stoColorClass}`}
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

// Chip + table injected at the top of the caregiver_training section in reassessment
function CaregiverTrainingSummaryHeader({ session, clientId, setClients }) {
  const summary = session.caregiverTrainingSummary ?? [];

  const patchItem = (idx, patch) =>
    patchSession(setClients, clientId, {
      caregiverTrainingSummary: summary.map((item, i) => i === idx ? { ...item, ...patch } : item),
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

      {/* Summary table */}
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-left min-w-[520px]">
          <thead>
            <tr>
              {['Goal', 'Baseline', 'Avg this period', '% Change', 'Trend', 'STO Status'].map(h => (
                <th key={h} className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 pr-3 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.map((item, idx) => (
              <CaregiverTrainingSummaryRow
                key={item.targetId ?? idx}
                item={item}
                idx={idx}
                patchItem={patchItem}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Divider before existing narrative fields */}
      <div className="border-t border-teal-100/60 mt-4"/>
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

  const isReassessment = session?.sessionType === 'reassessment';
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
            {session.sectionsApproved ?? 0}/{effectiveSectionOrder.filter(k => k !== 'demographics').length} approved
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
                  />
                ) : key === 'skill_acquisitions' && isReassessment ? (
                  <SkillAcquisitionsReassessmentCard
                    session={session}
                    clientId={clientId}
                    setClients={setClients}
                    sectionIndex={idx + 1}
                    isExpanded={expandedSections.includes(key)}
                    onToggle={() => handleToggle(key)}
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
                    headerContent={
                      key === 'caregiver_training' && isReassessment && (session.caregiverTrainingSummary ?? []).length > 0
                        ? <CaregiverTrainingSummaryHeader session={session} clientId={clientId} setClients={setClients} />
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
