import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ─── Graph Lightbox ───────────────────────────────────────────────────────────

function GraphLightbox({ src, label, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(15,15,15,0.82)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-2xl w-full"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
          <p className="text-[12px] font-semibold text-slate-700">{label}</p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-stone-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        {/* Image */}
        <div className="p-5 bg-stone-50">
          <img
            src={src}
            alt={label}
            className="w-full rounded-lg border border-stone-200 bg-white"
            style={{ maxHeight: '60vh', objectFit: 'contain' }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Helpers (mirrored from SkillAcquisitionsReviewView / MaladaptiveBehaviorsReviewView) ──

function computeBaseline(goal) {
  if (!goal.baselinePercent && goal.baselinePercent !== 0) return '–';
  const opps = goal.baselineOpportunities || '?';
  return `${goal.baselinePercent}% across ${opps} opportunities`;
}

function computeMastery(goal) {
  const pct = goal.masteryCriteriaPercent || '80';
  return `${pct}% accuracy`;
}

function computeBtBaseline(bt) {
  if (!bt.baselineFrequency) return '—';
  return `${bt.baselineFrequency} per ${bt.frequencyUnit || 'day'}`;
}

function computeBtLTO(bt) {
  const target = bt.targetFrequency;
  const unit   = bt.frequencyUnit || 'day';
  if (!target || target === '0' || target === '') return `0 per ${unit}`;
  return `${target} per ${unit}`;
}

// ─── Strip markdown to plain text (for prose truncation) ─────────────────────

function stripMarkdown(md) {
  if (!md) return '';
  return md
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/>\s*/g, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const PROSE_LIMIT = 280;

function MedicalNecessityPanel({ section }) {
  const [expanded, setExpanded] = useState(false);
  const raw   = section?.draftContent ?? '';
  const plain = stripMarkdown(raw);
  const isLong = plain.length > PROSE_LIMIT;

  if (!raw.trim()) {
    return (
      <p className="text-[12px] text-slate-400 italic mt-3 pt-3 border-t border-stone-100">
        No medical necessity narrative generated yet.
      </p>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-stone-100">
      {expanded ? (
        <div className="prose-sm text-[13px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            p: ({ children }) => <p className="mb-2 text-[13px] text-slate-700 leading-relaxed">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
          }}>
            {raw}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="text-[13px] text-slate-700 leading-relaxed">
          {isLong ? plain.slice(0, PROSE_LIMIT) + '…' : plain}
        </p>
      )}
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 text-[11px] font-semibold text-teal-600 hover:text-teal-800 transition-colors">
          {expanded ? '↑ Show less' : '↓ Show full narrative'}
        </button>
      )}
    </div>
  );
}

// ─── StoMilestoneRail ─────────────────────────────────────────────────────────
//
// Horizontal step-by-step milestone rail for a single goal or behavior.
// variant = 'skill'    → values are percentages, accent color teal
// variant = 'behavior' → values are frequencies, accent color rose

function StoMilestoneRail({ nodes, variant = 'skill' }) {
  // nodes: [{ label, value, sub, type }]
  // type: 'baseline' | 'sto' | 'lto' | 'auto'
  const accent     = variant === 'skill' ? '#0D9488' : '#F43F5E';
  const accentBg   = variant === 'skill' ? 'rgba(13,148,136,0.08)' : 'rgba(244,63,94,0.08)';
  const accentBorder = variant === 'skill' ? 'rgba(13,148,136,0.25)' : 'rgba(244,63,94,0.25)';

  return (
    <div
      className="mt-2.5 rounded-lg px-3 py-2.5 overflow-x-auto"
      style={{ background: accentBg, border: `1px solid ${accentBorder}` }}>
      <div className="flex items-start min-w-max gap-0">
        {nodes.map((node, ni) => (
          <React.Fragment key={ni}>
            {/* Node */}
            <div className="flex flex-col items-center" style={{ minWidth: 64, maxWidth: 80 }}>
              {/* Dot */}
              <div className="relative flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
                style={{
                  background: node.type === 'baseline' ? '#F1F5F9'
                    : node.type === 'lto' ? accent
                    : node.type === 'auto' ? 'white'
                    : 'white',
                  border: node.type === 'baseline' ? '2px solid #94A3B8'
                    : node.type === 'lto' ? `2px solid ${accent}`
                    : node.type === 'auto' ? `2px dashed ${accent}`
                    : `2px solid ${accent}`,
                }}>
                {node.type === 'lto' && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="white">
                    <path d="M1.5 4.5l2 2 3-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                )}
                {node.type === 'baseline' && (
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#94A3B8' }}/>
                )}
                {(node.type === 'sto' || node.type === 'auto') && (
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent }}/>
                )}
              </div>
              {/* Value */}
              <p className="text-[11px] font-bold mt-1 tabular-nums text-center leading-tight"
                style={{ color: node.type === 'baseline' ? '#64748B' : node.type === 'lto' ? accent : accent }}>
                {node.value}
              </p>
              {/* Label */}
              <p className="text-[9px] text-slate-400 mt-0.5 text-center leading-tight font-medium uppercase tracking-wide">
                {node.label}
              </p>
              {/* Duration sub-label */}
              {node.sub && (
                <p className="text-[9px] mt-0.5 text-center leading-tight" style={{ color: accent, opacity: 0.8 }}>
                  {node.sub}
                </p>
              )}
            </div>

            {/* Connector line (not after last node) */}
            {ni < nodes.length - 1 && (
              <div className="flex-1 flex items-start pt-[9px]" style={{ minWidth: 20 }}>
                <div className="w-full border-t-2 border-dashed" style={{ borderColor: accentBorder }}/>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// Builds the nodes array for a skill goal
function buildSkillNodes(goal) {
  const baseline  = parseFloat(goal.baselinePercent) || 0;
  const mastery   = parseFloat(goal.masteryCriteriaPercent) || 80;
  const stoSteps  = (goal.stoSteps ?? []).filter(s => s.targetPercent !== '' && s.targetPercent != null);

  const nodes = [
    { label: 'Baseline', value: `${baseline}%`, sub: null, type: 'baseline' },
  ];

  if (stoSteps.length > 0) {
    stoSteps.forEach((s, i) => {
      nodes.push({
        label: `STO ${i + 1}`,
        value: `${s.targetPercent}%`,
        sub: s.durationWeeks ? `${s.durationWeeks} wks` : null,
        type: 'sto',
      });
    });
  } else {
    // Auto midpoint
    const mid = Math.round((baseline + mastery) / 2);
    nodes.push({ label: 'STO', value: `${mid}%`, sub: 'auto', type: 'auto' });
  }

  nodes.push({ label: 'LTO', value: `${mastery}%`, sub: 'Mastery', type: 'lto' });
  return nodes;
}

// Builds the nodes array for a behavior target
function buildBehaviorNodes(bt) {
  const baseline  = parseFloat(bt.baselineFrequency) || 0;
  const target    = bt.targetFrequency !== '' && bt.targetFrequency != null ? parseFloat(bt.targetFrequency) : 0;
  const unit      = bt.frequencyUnit || 'day';
  const stoSteps  = (bt.stoSteps ?? []).filter(s => s.targetFrequency !== '' && s.targetFrequency != null);

  const nodes = [
    { label: 'Baseline', value: `${baseline}/${unit}`, sub: null, type: 'baseline' },
  ];

  if (stoSteps.length > 0) {
    stoSteps.forEach((s, i) => {
      nodes.push({
        label: `STO ${i + 1}`,
        value: `${s.targetFrequency}/${unit}`,
        sub: s.durationWeeks ? `${s.durationWeeks} wks` : null,
        type: 'sto',
      });
    });
  } else {
    const mid = Math.round(baseline + (target - baseline) / 2);
    nodes.push({ label: 'STO', value: `${mid}/${unit}`, sub: 'auto', type: 'auto' });
  }

  nodes.push({ label: 'LTO', value: `${target}/${unit}`, sub: 'Target', type: 'lto' });
  return nodes;
}

// ─── SkillTargetsPanel ────────────────────────────────────────────────────────

function SkillTargetsPanel({ session }) {
  const goals = session?.sections?.skill_acquisitions?.skillGoals ?? [];
  const [expanded, setExpanded] = useState(new Set());

  const toggle = (id) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  if (goals.length === 0) {
    return (
      <p className="text-[12px] text-slate-400 italic mt-3 pt-3 border-t border-stone-100">
        No skill goals documented yet.
      </p>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-stone-100 space-y-2">
      {goals.map((g, i) => {
        const key       = g.id ?? i;
        const isOpen    = expanded.has(key);
        const stoSteps  = (g.stoSteps ?? []).filter(s => s.targetPercent !== '' && s.targetPercent != null);
        const stepCount = stoSteps.length;

        return (
          <div key={key} className="rounded-lg bg-stone-50 border border-stone-100 overflow-hidden">
            <div className="flex items-start gap-3 px-3 py-2">
              <span className="text-[10px] font-bold text-teal-600 mt-0.5 flex-shrink-0 w-5 tabular-nums">G{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-800 leading-tight truncate">{g.targetSkill || 'Untitled goal'}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[11px] text-slate-500">Baseline:</span>
                  <span className="text-[11px] font-medium text-slate-700 tabular-nums">{computeBaseline(g)}</span>
                  <span className="text-[11px] text-slate-400 mx-0.5">→</span>
                  <span className="text-[11px] text-slate-500">Target:</span>
                  <span className="text-[11px] font-medium text-teal-700 tabular-nums">{computeMastery(g)}</span>
                  {/* STO chip */}
                  <button
                    onClick={() => toggle(key)}
                    className="ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold transition-all"
                    style={{
                      background: isOpen ? 'rgba(13,148,136,0.12)' : 'rgba(13,148,136,0.07)',
                      color: '#0D9488',
                      border: '1px solid rgba(13,148,136,0.2)',
                    }}>
                    <svg className={`w-2.5 h-2.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                    {stepCount > 0 ? `${stepCount} STOs` : 'STOs'}
                  </button>
                </div>
              </div>
            </div>
            {isOpen && (
              <div className="px-3 pb-3">
                <StoMilestoneRail nodes={buildSkillNodes(g)} variant="skill" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── BehaviorGoalsPanel ───────────────────────────────────────────────────────

function BehaviorGoalsPanel({ session }) {
  const behaviors = session?.sections?.behavior_targets?.behaviorTargets ?? [];
  const [expanded, setExpanded] = useState(new Set());

  const toggle = (id) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  if (behaviors.length === 0) {
    return (
      <p className="text-[12px] text-slate-400 italic mt-3 pt-3 border-t border-stone-100">
        No behavior targets documented yet.
      </p>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-stone-100 space-y-2">
      {behaviors.map((bt, i) => {
        const key       = bt.id ?? i;
        const isOpen    = expanded.has(key);
        const stoSteps  = (bt.stoSteps ?? []).filter(s => s.targetFrequency !== '' && s.targetFrequency != null);
        const stepCount = stoSteps.length;

        return (
          <div key={key} className="rounded-lg bg-stone-50 border border-stone-100 overflow-hidden">
            <div className="flex items-start gap-3 px-3 py-2">
              <span className="text-[10px] font-bold text-rose-500 mt-0.5 flex-shrink-0 w-5 tabular-nums">B{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-800 leading-tight truncate">{bt.behaviorName || 'Untitled behavior'}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[11px] text-slate-500">Baseline:</span>
                  <span className="text-[11px] font-medium text-slate-700 tabular-nums">{computeBtBaseline(bt)}</span>
                  <span className="text-[11px] text-slate-400 mx-0.5">→</span>
                  <span className="text-[11px] text-slate-500">Target:</span>
                  <span className="text-[11px] font-medium text-teal-700 tabular-nums">{computeBtLTO(bt)}</span>
                  {/* STO chip */}
                  <button
                    onClick={() => toggle(key)}
                    className="ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold transition-all"
                    style={{
                      background: isOpen ? 'rgba(244,63,94,0.12)' : 'rgba(244,63,94,0.07)',
                      color: '#F43F5E',
                      border: '1px solid rgba(244,63,94,0.2)',
                    }}>
                    <svg className={`w-2.5 h-2.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                    {stepCount > 0 ? `${stepCount} STOs` : 'STOs'}
                  </button>
                </div>
              </div>
            </div>
            {isOpen && (
              <div className="px-3 pb-3">
                <StoMilestoneRail nodes={buildBehaviorNodes(bt)} variant="behavior" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── CaregiverTrainingPanel ───────────────────────────────────────────────────

function buildCaregiverNodes(target) {
  const baseline = parseFloat(target.baselinePercent) || 0;
  const lto      = parseFloat(target.ltoPercent)      || 90;
  const stoSteps = (target.stoSteps ?? []).filter(s => s.targetPercent !== '' && s.targetPercent != null);

  const nodes = [
    { label: 'Baseline', value: `${baseline}%`, sub: null, type: 'baseline' },
  ];

  if (stoSteps.length > 0) {
    stoSteps.forEach((s, i) => {
      nodes.push({
        label: `STO ${i + 1}`,
        value: `${s.targetPercent}%`,
        sub: s.durationWeeks ? `${s.durationWeeks} wks` : null,
        type: 'sto',
      });
    });
  } else {
    const mid = Math.round((baseline + lto) / 2);
    nodes.push({ label: 'STO', value: `${mid}%`, sub: 'auto', type: 'auto' });
  }

  nodes.push({ label: 'LTO', value: `${lto}%`, sub: 'Mastery', type: 'lto' });
  return nodes;
}

function CaregiverTrainingPanel({ session }) {
  const targets = session?.sections?.caregiver_training?.caregiverTrainingTargets ?? [];
  const [expanded, setExpanded] = useState(new Set());

  const toggle = (id) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  if (targets.length === 0) {
    return (
      <p className="text-[12px] text-slate-400 italic mt-3 pt-3 border-t border-stone-100">
        No caregiver training targets documented yet.
      </p>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-stone-100 space-y-2">
      {targets.map((t, i) => {
        const key       = t.id ?? i;
        const isOpen    = expanded.has(key);
        const stoSteps  = (t.stoSteps ?? []).filter(s => s.targetPercent !== '' && s.targetPercent != null);
        const stepCount = stoSteps.length;
        const bp        = t.baselinePercent != null ? `${t.baselinePercent}%` : '—';
        const ltoVal    = t.ltoPercent != null ? `${t.ltoPercent}%` : '—';

        return (
          <div key={key} className="rounded-lg bg-stone-50 border border-stone-100 overflow-hidden">
            <div className="flex items-start gap-3 px-3 py-2">
              <span className="text-[10px] font-bold text-teal-600 mt-0.5 flex-shrink-0 w-5 tabular-nums">C{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-800 leading-tight truncate">{t.goalName || 'Untitled goal'}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[11px] text-slate-500">Baseline:</span>
                  <span className="text-[11px] font-medium text-slate-700 tabular-nums">{bp}</span>
                  <span className="text-[11px] text-slate-400 mx-0.5">→</span>
                  <span className="text-[11px] text-slate-500">Target:</span>
                  <span className="text-[11px] font-medium text-teal-700 tabular-nums">{ltoVal}</span>
                  <button
                    onClick={() => toggle(key)}
                    className="ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold transition-all"
                    style={{
                      background: isOpen ? 'rgba(13,148,136,0.12)' : 'rgba(13,148,136,0.07)',
                      color: '#0D9488',
                      border: '1px solid rgba(13,148,136,0.2)',
                    }}>
                    <svg className={`w-2.5 h-2.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                    {stepCount > 0 ? `${stepCount} STOs` : 'STOs'}
                  </button>
                </div>
              </div>
            </div>
            {isOpen && (
              <div className="px-3 pb-3">
                <StoMilestoneRail nodes={buildCaregiverNodes(t)} variant="skill" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InterventionStrategiesPanel({ session }) {
  const goals     = session?.sections?.skill_acquisitions?.skillGoals ?? [];
  const behaviors = session?.sections?.behavior_targets?.behaviorTargets ?? [];

  const hasStrategies = goals.some(g => (g.teachingStrategies?.length ?? 0) > 0 || g.teachingStrategiesOther?.trim());
  const hasFunctions  = behaviors.some(bt => bt.hypothesizedFunction?.trim());

  if (!hasStrategies && !hasFunctions) {
    return (
      <p className="text-[12px] text-slate-400 italic mt-3 pt-3 border-t border-stone-100">
        No intervention strategies documented yet.
      </p>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-stone-100 space-y-4">
      {hasStrategies && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Teaching Strategies</p>
          <div className="space-y-2">
            {goals.map((g, i) => {
              const strats = [
                ...(Array.isArray(g.teachingStrategies) ? g.teachingStrategies : []),
                ...(g.teachingStrategiesOther?.trim() ? [g.teachingStrategiesOther.trim()] : []),
              ];
              if (strats.length === 0) return null;
              return (
                <div key={g.id ?? i} className="flex items-start gap-2">
                  <span className="text-[11px] font-semibold text-slate-600 flex-shrink-0 pt-0.5 min-w-[100px] max-w-[140px] truncate">
                    {g.targetSkill || `Goal ${i + 1}`}:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {strats.map((s, si) => (
                      <span key={si} className="text-[10px] font-medium px-2 py-0.5 rounded-full border text-slate-600"
                        style={{ background:'#F5F5F4', borderColor:'#E7E5E4' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasFunctions && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Hypothesized Behavior Functions</p>
          <div className="space-y-1.5">
            {behaviors.filter(bt => bt.hypothesizedFunction?.trim()).map((bt, i) => (
              <div key={bt.id ?? i} className="flex items-start gap-2">
                <span className="text-[11px] font-semibold text-slate-600 flex-shrink-0 pt-0.5 min-w-[100px] max-w-[140px] truncate">
                  {bt.behaviorName || `Behavior ${i + 1}`}:
                </span>
                <span className="text-[12px] text-slate-700">{bt.hypothesizedFunction}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BaselineGraphsPanel({ graphs }) {
  const [lightbox, setLightbox] = useState(null); // { src, label }
  const closeLightbox = useCallback(() => setLightbox(null), []);

  if (graphs === null) {
    return (
      <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2 py-4">
        <svg className="w-4 h-4 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <span className="text-[12px] text-slate-400">Generating charts…</span>
      </div>
    );
  }

  const entries = Object.entries(graphs ?? {});
  if (entries.length === 0) {
    return (
      <p className="text-[12px] text-slate-400 italic mt-3 pt-3 border-t border-stone-100">
        No chart data available. Add behavior targets and skill goals first.
      </p>
    );
  }

  // Format key as human-readable label
  const labelFor = (key) =>
    key.replace(/^(behavior_|sto_|replacement_|caregiver_)/, '')
       .replace(/_/g, ' ')
       .replace(/\b\w/g, c => c.toUpperCase());

  const typeLabel = (key) => {
    if (key.startsWith('sto_'))              return 'STO Trajectory';
    if (key.startsWith('behavior_'))         return 'Baseline vs Target';
    if (key === 'replacement_behaviors')     return 'Skill Goals';
    if (key.startsWith('caregiver_'))        return 'Caregiver';
    return '';
  };

  const fullLabel = (key) => `${typeLabel(key) ? typeLabel(key) + ' · ' : ''}${labelFor(key)}`;

  return (
    <>
      {lightbox && (
        <GraphLightbox
          src={lightbox.src}
          label={lightbox.label}
          onClose={closeLightbox}
        />
      )}
      <div className="mt-3 pt-3 border-t border-stone-100 min-w-0">
        <div className="flex gap-2.5 overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          {entries.map(([key, b64]) => {
            const src = `data:image/png;base64,${b64}`;
            const label = fullLabel(key);
            return (
              <button
                key={key}
                onClick={() => setLightbox({ src, label })}
                className="flex-shrink-0 text-center group focus:outline-none"
                style={{ width: 160 }}
                title="Click to enlarge">
                <div className="relative overflow-hidden rounded-lg border border-stone-200 bg-white transition-all group-hover:border-teal-300 group-hover:shadow-md">
                  <img
                    src={src}
                    alt={label}
                    className="w-full"
                    style={{ height: 100, objectFit: 'contain' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(13,148,136,0.08)' }}>
                    <span className="bg-white/90 text-teal-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-teal-200 shadow-sm">
                      View full
                    </span>
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 mt-1 leading-tight truncate px-0.5">{label}</p>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── PlanDraftInlinePanel ─────────────────────────────────────────────────────

export default function PlanDraftInlinePanel({ itemKey, session, graphs }) {
  const sections = session?.sections ?? {};

  switch (itemKey) {
    case 'medical_necessity':
      return <MedicalNecessityPanel section={sections.medical_necessity} />;

    case 'skill_targets':
      return <SkillTargetsPanel session={session} />;

    case 'behavior_goals':
      return <BehaviorGoalsPanel session={session} />;

    case 'caregiver_training':
      return <CaregiverTrainingPanel session={session} />;

    case 'intervention_strategies':
      return <InterventionStrategiesPanel session={session} />;

    case 'baseline_graphs':
      return <BaselineGraphsPanel graphs={graphs} />;

    default:
      return null;
  }
}
