import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '–';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function TrendArrow({ trend, forBehavior = false }) {
  if (!trend || trend === 'flat' || trend === 'stable' || trend === 'none') {
    return <span className="text-slate-400 text-xs">→</span>;
  }
  const isGood = (trend === 'improving' || trend === 'up') ? !forBehavior : forBehavior;
  const up = trend === 'improving' || trend === 'up';
  return (
    <span className={`text-xs font-bold ${isGood ? 'text-emerald-600' : 'text-rose-500'}`}>
      {up ? '↑' : '↓'}
    </span>
  );
}

function getDisposition(item) {
  if (item.includedInPlan === true) return 'in_plan';
  if (item.monitorOnly === true) return 'monitor';
  return 'excluded';
}

// ─── Shared UI pieces ─────────────────────────────────────────────────────────

function SectionHeader({ icon, title, count }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base leading-none">{icon}</span>
      <h3 className="text-[13px] font-bold text-slate-700">{title}</h3>
      {count != null && (
        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-stone-100 text-[10px] font-semibold text-slate-500">
          {count}
        </span>
      )}
    </div>
  );
}

function SubBucketLabel({ label, color }) {
  const cls = {
    emerald: 'text-emerald-600 border-emerald-200',
    amber:   'text-amber-600 border-amber-200',
    slate:   'text-slate-400 border-slate-200',
  }[color] ?? 'text-slate-400 border-slate-200';
  return (
    <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 pb-1 border-b ${cls}`}>
      {label}
    </p>
  );
}

function DispositionBadge({ type }) {
  if (type === 'in_plan') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-700 border border-teal-200">
        IN PLAN
      </span>
    );
  }
  if (type === 'monitor') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200">
        MONITOR ONLY
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-slate-500 border border-stone-200">
      EXCLUDED
    </span>
  );
}

// ─── Dual-baseline stat strip ─────────────────────────────────────────────────
// Shows: initial baseline (muted) → new cycle baseline (emphasized, with delta)

function DualBaseline({ initialLabel, initialVal, newCycleLabel, newCycleVal, pctChange, unit = '', isReduction = false }) {
  const hasChange = pctChange != null && newCycleVal != null;
  const improved = hasChange && (isReduction ? pctChange > 0 : pctChange > 0);
  return (
    <div className="mt-2 mb-2.5 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Initial baseline */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">{initialLabel}</p>
          <p className="text-[12px] font-semibold text-slate-500 tabular-nums">
            {initialVal != null ? `${initialVal}${unit}` : '–'}
          </p>
        </div>
        {/* Arrow */}
        <span className="text-slate-300 text-sm">→</span>
        {/* New cycle baseline */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-teal-600 mb-0.5">{newCycleLabel}</p>
          <div className="flex items-center gap-1.5">
            <p className="text-[14px] font-bold text-slate-800 tabular-nums">
              {newCycleVal != null ? `${newCycleVal}${unit}` : '–'}
            </p>
            {hasChange && (
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                improved
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-100 text-rose-600 border border-rose-200'
              }`}>
                {improved ? (isReduction ? '↓' : '↑') : (isReduction ? '↑' : '↓')} {Math.abs(Math.round(pctChange))}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Remaining STO Rail ───────────────────────────────────────────────────────

function ReassessmentStoRail({ stoSteps, currentStoNumber, ltoValue, ltoLabel, variant = 'skill' }) {
  const validSteps = (stoSteps ?? []).filter(
    (s) => (s.targetPercent ?? s.targetFrequency) !== '' && (s.targetPercent ?? s.targetFrequency) != null,
  );

  const accent       = variant === 'skill' ? '#0D9488' : variant === 'behavior' ? '#F43F5E' : '#0EA5E9';
  const accentBg     = variant === 'skill' ? 'rgba(13,148,136,0.07)' : variant === 'behavior' ? 'rgba(244,63,94,0.07)' : 'rgba(14,165,233,0.07)';
  const accentBorder = variant === 'skill' ? 'rgba(13,148,136,0.2)' : variant === 'behavior' ? 'rgba(244,63,94,0.2)' : 'rgba(14,165,233,0.2)';

  if (validSteps.length === 0) {
    return (
      <div className="mt-2.5 rounded-lg px-3 py-2.5" style={{ background: accentBg, border: `1px solid ${accentBorder}` }}>
        <p className="text-[11px] text-slate-400 italic">STO/LTO not defined in plan.</p>
      </div>
    );
  }

  const startIdx       = Math.max(0, (currentStoNumber ?? 1) - 1);
  const remainingSteps = validSteps.slice(startIdx);

  const nodes = remainingSteps.map((s, idx) => {
    const isCurrent = idx === 0;
    const value     = variant === 'behavior' ? `${s.targetFrequency}/day` : `${s.targetPercent}%`;
    return {
      label: `STO ${startIdx + idx + 1}`,
      value,
      sub:   isCurrent ? 'Current' : s.durationWeeks ? `${s.durationWeeks} wks` : null,
      type:  isCurrent ? 'current' : 'remaining',
    };
  });
  if (ltoValue != null) nodes.push({ label: 'LTO', value: ltoValue, sub: ltoLabel ?? 'Target', type: 'lto' });
  if (nodes.length === 0) return null;

  return (
    <div className="mt-2.5 rounded-lg px-3 py-2.5 overflow-x-auto" style={{ background: accentBg, border: `1px solid ${accentBorder}` }}>
      <div className="flex items-start min-w-max gap-0">
        {nodes.map((node, ni) => (
          <React.Fragment key={ni}>
            <div className="flex flex-col items-center" style={{ minWidth: 64, maxWidth: 88 }}>
              <div
                className="relative flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
                style={{
                  background: node.type === 'lto' ? accent : node.type === 'current' ? 'white' : '#F1F5F9',
                  border: node.type === 'lto' ? `2px solid ${accent}` : node.type === 'current' ? `2.5px solid ${accent}` : '2px solid #CBD5E1',
                  boxShadow: node.type === 'current' ? `0 0 0 3px ${accentBg}` : undefined,
                }}
              >
                {node.type === 'lto' && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4.5l2 2 3-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {node.type === 'current' && <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />}
                {node.type === 'remaining' && <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
              </div>
              <p className="text-[11px] font-bold mt-1 tabular-nums text-center leading-tight" style={{ color: node.type === 'remaining' ? '#94A3B8' : accent }}>
                {node.value}
              </p>
              <p className="text-[9px] mt-0.5 text-center leading-tight font-semibold uppercase tracking-wide" style={{ color: node.type === 'remaining' ? '#94A3B8' : accent }}>
                {node.label}
              </p>
              {node.sub && (
                <p className="text-[9px] mt-0.5 text-center leading-tight" style={{ color: node.type === 'current' ? accent : '#94A3B8', fontWeight: node.type === 'current' ? 700 : 400 }}>
                  {node.sub}
                </p>
              )}
            </div>
            {ni < nodes.length - 1 && (
              <div className="flex-1 flex items-start pt-[9px]" style={{ minWidth: 20 }}>
                <div className="w-full border-t-2" style={{ borderColor: accentBorder, borderStyle: nodes[ni + 1]?.type === 'remaining' ? 'dashed' : 'solid' }} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Custom tooltips ──────────────────────────────────────────────────────────

function BehaviorTooltip({ active, payload, label }) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  const pt = payload[0]?.payload;
  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm px-3 py-2 text-[11px] text-slate-700">
      <p className="font-semibold mb-0.5">Session #{label}</p>
      {pt?.sessionDate && <p className="text-slate-400 mb-0.5">{fmtDate(pt.sessionDate)}</p>}
      <p>Frequency: <span className="font-semibold text-rose-500">{payload[0].value}×</span></p>
    </div>
  );
}

function PercentTooltip({ active, payload, label, color = '#0D9488' }) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  const pt = payload[0]?.payload;
  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm px-3 py-2 text-[11px] text-slate-700">
      <p className="font-semibold mb-0.5">Session #{label}</p>
      {pt?.sessionDate && <p className="text-slate-400 mb-0.5">{fmtDate(pt.sessionDate)}</p>}
      <p>Accuracy: <span className="font-semibold" style={{ color }}>{payload[0].value}%</span></p>
    </div>
  );
}

// ─── Behavior progress chart ──────────────────────────────────────────────────

function BehaviorProgressChart({ item, planBt, sessionLogs }) {
  const behaviorId   = item.behaviorId;
  const initialBase  = planBt?.baselineFrequency != null ? parseFloat(planBt.baselineFrequency) : null;
  const newCycleBase = item.averageFrequency;  // avg from sessions = new cycle starting point
  const ltoFreq      = planBt?.targetFrequency != null && planBt.targetFrequency !== ''
    ? parseFloat(planBt.targetFrequency) : null;
  const stoSteps     = (planBt?.stoSteps ?? []).filter(s => s.targetFrequency !== '' && s.targetFrequency != null);

  const chartData = useMemo(() => {
    const sorted = [...(sessionLogs ?? [])].sort((a, b) => a.sessionNumber - b.sessionNumber);
    return sorted.map(log => {
      const entry = (log.behaviorEntries ?? []).find(e => e.behaviorId === behaviorId);
      return {
        session:     log.sessionNumber,
        sessionDate: log.sessionDate,
        frequency:   entry != null ? entry.sessionFrequency : null,
      };
    }).filter(p => p.frequency != null);
  }, [sessionLogs, behaviorId]);

  const allValues = [
    initialBase, newCycleBase, ltoFreq,
    ...stoSteps.map(s => parseFloat(s.targetFrequency)),
    ...chartData.map(p => p.frequency),
  ].filter(v => v != null && !isNaN(v));
  const yMax = allValues.length > 0 ? Math.max(...allValues) + 1 : 10;

  if (chartData.length === 0) return null;

  const trend = item.trend;
  const trendEl =
    trend === 'worsening' || trend === 'up'
      ? <span className="font-semibold text-rose-500">↑ Trending up</span>
      : trend === 'improving' || trend === 'down'
      ? <span className="font-semibold text-emerald-600">↓ Trending down</span>
      : <span className="text-slate-400">→ Stable</span>;

  return (
    <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">Progress This Period</p>

      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={chartData} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="session" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={v => `S${v}`} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} domain={[0, yMax]} />
          <Tooltip content={<BehaviorTooltip />} />

          {/* Initial baseline — slate dashed */}
          {initialBase != null && (
            <ReferenceLine y={initialBase} stroke="#94A3B8" strokeDasharray="4 4" />
          )}
          {/* New cycle baseline (avg) — amber solid, thicker */}
          {newCycleBase != null && (
            <ReferenceLine y={newCycleBase} stroke="#D97706" strokeWidth={2} strokeDasharray="6 2" />
          )}
          {/* STO steps — rose dashed */}
          {stoSteps.map((s, i) => (
            <ReferenceLine key={i} y={parseFloat(s.targetFrequency)} stroke="#F43F5E" strokeDasharray="3 3" strokeOpacity={0.5} />
          ))}
          {/* LTO — teal solid */}
          {ltoFreq != null && (
            <ReferenceLine y={ltoFreq} stroke="#0D9488" strokeWidth={1.5} />
          )}
          {/* Session line */}
          <Line type="monotone" dataKey="frequency" stroke="#F43F5E" strokeWidth={2}
            dot={{ fill: '#F43F5E', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#F43F5E' }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-600">
          <span className="inline-block w-4 h-0.5 bg-rose-400 rounded-full flex-shrink-0" />Sessions
        </span>
        {initialBase != null && (
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="inline-block w-4 border-t border-dashed border-slate-400 flex-shrink-0" />Initial baseline {initialBase}×
          </span>
        )}
        {newCycleBase != null && (
          <span className="flex items-center gap-1.5 text-[10px] text-amber-600 font-semibold">
            <span className="inline-block w-4 border-t-2 border-amber-500 flex-shrink-0" />New cycle baseline {newCycleBase}×
          </span>
        )}
        {ltoFreq != null && (
          <span className="flex items-center gap-1.5 text-[10px] text-teal-600">
            <span className="inline-block w-4 border-t-2 border-teal-500 flex-shrink-0" />Target {ltoFreq}×
          </span>
        )}
      </div>

      {/* Summary strip */}
      <div className="mt-2.5 pt-2.5 border-t border-stone-100 flex items-center gap-2 flex-wrap text-[11px]">
        {trendEl}
        <span className="text-stone-200">·</span>
        <span className="text-slate-400">{chartData.length} session{chartData.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

// ─── Skill progress chart ──────────────────────────────────────────────────────

function SkillProgressChart({ item, planGoal, sessionLogs }) {
  const skillId      = item.skillId;
  const initialBase  = item.baselinePercent;
  const newCycleBase = item.averageAccuracy != null ? Math.round(item.averageAccuracy) : null;
  const ltoVal       = planGoal?.masteryCriteriaPercent != null ? parseFloat(planGoal.masteryCriteriaPercent) : null;
  const stoSteps     = (planGoal?.stoSteps ?? []).filter(s => s.targetPercent !== '' && s.targetPercent != null);

  const chartData = useMemo(() => {
    const sorted = [...(sessionLogs ?? [])].sort((a, b) => a.sessionNumber - b.sessionNumber);
    return sorted.map(log => {
      const entry = (log.skillEntries ?? []).find(e => !e.isNew && e.skillId === skillId);
      return {
        session:     log.sessionNumber,
        sessionDate: log.sessionDate,
        accuracy:    entry != null ? entry.accuracyPercent : null,
      };
    }).filter(p => p.accuracy != null);
  }, [sessionLogs, skillId]);

  const allValues = [
    initialBase, newCycleBase, ltoVal,
    ...stoSteps.map(s => parseFloat(s.targetPercent)),
    ...chartData.map(p => p.accuracy),
  ].filter(v => v != null && !isNaN(v));
  const yMax = Math.min(100, (allValues.length > 0 ? Math.max(...allValues) + 5 : 100));

  if (chartData.length === 0) return null;

  const trend = item.trend;
  const trendEl =
    trend === 'improving' || trend === 'up'
      ? <span className="font-semibold text-emerald-600">↑ Trending up</span>
      : trend === 'worsening' || trend === 'down'
      ? <span className="font-semibold text-rose-500">↓ Trending down</span>
      : <span className="text-slate-400">→ Stable</span>;

  return (
    <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">Progress This Period</p>

      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={chartData} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="session" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={v => `S${v}`} />
          <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} domain={[0, yMax]} tickFormatter={v => `${v}%`} />
          <Tooltip content={<PercentTooltip color="#0D9488" />} />

          {initialBase != null && (
            <ReferenceLine y={initialBase} stroke="#94A3B8" strokeDasharray="4 4" />
          )}
          {newCycleBase != null && (
            <ReferenceLine y={newCycleBase} stroke="#D97706" strokeWidth={2} strokeDasharray="6 2" />
          )}
          {stoSteps.map((s, i) => (
            <ReferenceLine key={i} y={parseFloat(s.targetPercent)} stroke="#0D9488" strokeDasharray="3 3" strokeOpacity={0.4} />
          ))}
          {ltoVal != null && (
            <ReferenceLine y={ltoVal} stroke="#0D9488" strokeWidth={1.5} />
          )}
          <Line type="monotone" dataKey="accuracy" stroke="#0D9488" strokeWidth={2}
            dot={{ fill: '#0D9488', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#0D9488' }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-2 flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-[10px] text-teal-600">
          <span className="inline-block w-4 h-0.5 bg-teal-500 rounded-full flex-shrink-0" />Sessions
        </span>
        {initialBase != null && (
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="inline-block w-4 border-t border-dashed border-slate-400 flex-shrink-0" />Initial baseline {initialBase}%
          </span>
        )}
        {newCycleBase != null && (
          <span className="flex items-center gap-1.5 text-[10px] text-amber-600 font-semibold">
            <span className="inline-block w-4 border-t-2 border-amber-500 flex-shrink-0" />New cycle baseline {newCycleBase}%
          </span>
        )}
        {ltoVal != null && (
          <span className="flex items-center gap-1.5 text-[10px] text-teal-600">
            <span className="inline-block w-4 border-t-2 border-teal-500 flex-shrink-0" />Mastery {ltoVal}%
          </span>
        )}
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-stone-100 flex items-center gap-2 flex-wrap text-[11px]">
        {trendEl}
        <span className="text-stone-200">·</span>
        <span className="text-slate-400">{chartData.length} session{chartData.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

// ─── CT progress chart ────────────────────────────────────────────────────────

function CTProgressChart({ item, ctLogs }) {
  const targetId     = item.targetId;
  const initialBase  = item.baselinePercent;
  const newCycleBase = item.averageSessionPercent != null ? Math.round(item.averageSessionPercent) : null;
  const ltoVal       = item.ltoData?.percent != null ? parseFloat(item.ltoData.percent) : null;
  const stoSteps     = (item.stoSteps ?? []).filter(s => s.targetPercent !== '' && s.targetPercent != null);

  const chartData = useMemo(() => {
    const sorted = [...(ctLogs ?? [])].sort((a, b) => a.sessionNumber - b.sessionNumber);
    return sorted.map(log => {
      const entry = (log.trainingEntries ?? []).find(e => e.targetId === targetId);
      return {
        session:     log.sessionNumber,
        sessionDate: log.sessionDate,
        percent:     entry != null ? entry.sessionPercent : null,
      };
    }).filter(p => p.percent != null);
  }, [ctLogs, targetId]);

  const allValues = [
    initialBase, newCycleBase, ltoVal,
    ...stoSteps.map(s => parseFloat(s.targetPercent)),
    ...chartData.map(p => p.percent),
  ].filter(v => v != null && !isNaN(v));
  const yMax = Math.min(100, (allValues.length > 0 ? Math.max(...allValues) + 5 : 100));

  if (chartData.length === 0) return null;

  const trend = item.trend;
  const trendEl =
    trend === 'improving'
      ? <span className="font-semibold text-emerald-600">↑ Improving</span>
      : trend === 'worsening'
      ? <span className="font-semibold text-rose-500">↓ Declining</span>
      : <span className="text-slate-400">→ Stable</span>;

  return (
    <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">Progress This Period</p>

      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={chartData} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="session" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={v => `S${v}`} />
          <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} domain={[0, yMax]} tickFormatter={v => `${v}%`} />
          <Tooltip content={<PercentTooltip color="#0EA5E9" />} />

          {initialBase != null && (
            <ReferenceLine y={initialBase} stroke="#94A3B8" strokeDasharray="4 4" />
          )}
          {newCycleBase != null && (
            <ReferenceLine y={newCycleBase} stroke="#D97706" strokeWidth={2} strokeDasharray="6 2" />
          )}
          {stoSteps.map((s, i) => (
            <ReferenceLine key={i} y={parseFloat(s.targetPercent)} stroke="#0EA5E9" strokeDasharray="3 3" strokeOpacity={0.4} />
          ))}
          {ltoVal != null && (
            <ReferenceLine y={ltoVal} stroke="#0EA5E9" strokeWidth={1.5} />
          )}
          <Line type="monotone" dataKey="percent" stroke="#0EA5E9" strokeWidth={2}
            dot={{ fill: '#0EA5E9', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#0EA5E9' }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-2 flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-[10px] text-sky-600">
          <span className="inline-block w-4 h-0.5 bg-sky-500 rounded-full flex-shrink-0" />Sessions
        </span>
        {initialBase != null && (
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="inline-block w-4 border-t border-dashed border-slate-400 flex-shrink-0" />Initial baseline {initialBase}%
          </span>
        )}
        {newCycleBase != null && (
          <span className="flex items-center gap-1.5 text-[10px] text-amber-600 font-semibold">
            <span className="inline-block w-4 border-t-2 border-amber-500 flex-shrink-0" />New cycle baseline {newCycleBase}%
          </span>
        )}
        {ltoVal != null && (
          <span className="flex items-center gap-1.5 text-[10px] text-sky-600">
            <span className="inline-block w-4 border-t-2 border-sky-500 flex-shrink-0" />Target {ltoVal}%
          </span>
        )}
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-stone-100 flex items-center gap-2 flex-wrap text-[11px]">
        {trendEl}
        <span className="text-stone-200">·</span>
        <span className="text-slate-400">{chartData.length} session{chartData.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

// ─── SECTION A: Maladaptive Behaviors ────────────────────────────────────────

function BehaviorMasteredRow({ item }) {
  const reduction = item.percentReduction != null ? `${Math.round(item.percentReduction)}% ↓` : null;
  const baseline  = item.baselineFrequency != null ? `${item.baselineFrequency}/day` : '–';
  const final     = item.lastSessionFrequency != null ? `${item.lastSessionFrequency}/day` : '–';
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
      <span className="text-emerald-500 text-base flex-shrink-0">✓</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-emerald-800 leading-tight truncate">{item.behaviorName}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px] text-emerald-700 font-medium">Mastered ✓</span>
          {item.masteryDate && <span className="text-[11px] text-slate-400">{fmtDate(item.masteryDate)}</span>}
          {reduction && (
            <span className="text-[11px] text-emerald-600 font-semibold tabular-nums">
              {baseline} → {final} ({reduction})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function BehaviorContinuingCard({ item, planBt, sessionLogs }) {
  const [open, setOpen] = useState(false);

  const pctChange = item.percentReduction;
  const avg       = item.averageFrequency;
  const baseline  = item.baselineFrequency;
  const ltoFreq   = planBt?.targetFrequency != null && planBt.targetFrequency !== '' ? `${planBt.targetFrequency}/day` : null;
  const stoSteps  = planBt?.stoSteps ?? [];

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-stone-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-semibold text-slate-800 leading-tight">{item.behaviorName}</p>
            <TrendArrow trend={item.trend} forBehavior />
            {pctChange != null && (
              <span className="text-[11px] font-semibold text-emerald-600 tabular-nums">{Math.round(pctChange)}% ↓</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[11px] text-slate-400 tabular-nums">
              {baseline != null ? `${baseline}/day` : '–'} initial → {avg != null ? `${avg}/day` : '–'} avg
            </span>
            {item.sessionsLogged != null && (
              <><span className="text-[11px] text-slate-300">·</span><span className="text-[11px] text-slate-400">{item.sessionsLogged} sessions</span></>
            )}
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-4 border-t border-stone-100">
          {/* Dual baseline */}
          <DualBaseline
            initialLabel="Initial baseline"
            initialVal={baseline != null ? `${baseline}/day` : null}
            newCycleLabel="New cycle baseline"
            newCycleVal={avg != null ? `${avg}/day` : null}
            pctChange={pctChange}
            isReduction
          />

          {/* Remaining STO rail */}
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-2 mb-1">Remaining milestones</p>
          <ReassessmentStoRail
            stoSteps={stoSteps}
            currentStoNumber={item.currentStoNumber ?? 1}
            ltoValue={ltoFreq}
            ltoLabel="Target"
            variant="behavior"
          />

          {/* Chart */}
          <BehaviorProgressChart item={item} planBt={planBt} sessionLogs={sessionLogs} />
        </div>
      )}
    </div>
  );
}

function NewBehaviorRow({ item, planBt }) {
  const disposition = getDisposition(item);
  const [open, setOpen] = useState(false);
  const isInPlan = disposition === 'in_plan';
  // Pull STO steps from the formal plan target (traceable to the reassessment form)
  const stoSteps = planBt?.stoSteps ?? item.stoStructure ?? [];
  const hasDetail = stoSteps.length > 0 || planBt?.operationalDefinition || item.bcbaLtoText;
  return (
    <div className={`rounded-xl border overflow-hidden ${isInPlan ? 'border-teal-200 bg-teal-50/30' : 'border-stone-100 bg-stone-50/40'}`}>
      <button
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left"
        onClick={() => isInPlan ? setOpen(o => !o) : undefined}
        style={!isInPlan ? { cursor: 'default' } : undefined}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <DispositionBadge type={disposition} />
            <p className={`text-[13px] font-semibold leading-tight ${isInPlan ? 'text-slate-800' : 'text-slate-500'}`}>{item.behaviorName}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {(item.function ?? planBt?.hypothesizedFunction) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium border border-purple-200">
                {item.function ?? planBt?.hypothesizedFunction}
              </span>
            )}
            {(item.severity ?? planBt?.severity) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium border border-amber-200">
                {item.severity ?? planBt?.severity}
              </span>
            )}
            {item.firstSeenDate && <span className="text-[11px] text-slate-400">First seen {fmtDate(item.firstSeenDate)}</span>}
            {item.averageFrequency != null && <span className="text-[11px] text-slate-500 tabular-nums">avg {item.averageFrequency}/day</span>}
          </div>
        </div>
        {isInPlan && (
          <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {isInPlan && open && hasDetail && (
        <div className="px-3 pb-3 border-t border-teal-100 pt-2 space-y-1">
          {planBt?.operationalDefinition && (
            <p className="text-[12px] text-slate-500 italic leading-relaxed mb-1">{planBt.operationalDefinition}</p>
          )}
          {stoSteps.map((s, i) => (
            <div key={s.id ?? i} className="text-[12px] text-slate-600 py-0.5">
              <span className="font-semibold text-teal-700">STO {i + 1}:</span>{' '}
              {s.targetFrequency != null ? `≤ ${s.targetFrequency}/day` : ''}
              {s.durationWeeks ? ` · ${s.durationWeeks} wks` : ''}
              {s.note ? <span className="text-slate-400"> — {s.note}</span> : null}
            </div>
          ))}
          {item.bcbaLtoText && (
            <p className="text-[12px] text-slate-600 mt-1">
              <span className="font-semibold text-teal-700">LTO:</span> {item.bcbaLtoText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BehaviorSection({ session, client }) {
  const sessionLogs   = client?.service_session_logs ?? [];
  const origBehaviors = session.originalBehaviorSummary ?? [];
  const newBehaviors  = session.newBehaviorSummary ?? [];
  const planBtList    = session.sections?.behavior_targets?.behaviorTargets ?? [];
  const planBtMap     = Object.fromEntries(planBtList.map(bt => [bt.id, bt]));
  // Name-based lookup for new behaviors whose id may not match (e.g. Property Destruction added in reauth plan)
  const planBtByName  = Object.fromEntries(planBtList.map(bt => [bt.behaviorName?.toLowerCase(), bt]));

  const mastered    = origBehaviors.filter(b => (b.sessionDerivedStoStatus ?? b.stoStatus) === 'met');
  const continuing  = origBehaviors.filter(b => (b.sessionDerivedStoStatus ?? b.stoStatus) !== 'met');
  const inPlanNew   = newBehaviors.filter(b => b.includedInPlan === true);
  const monitorNew  = newBehaviors.filter(b => b.monitorOnly === true);
  const excludedNew = newBehaviors.filter(b => !b.includedInPlan && !b.monitorOnly);
  const total = origBehaviors.length + newBehaviors.length;
  if (total === 0) return null;

  return (
    <div className="mb-6">
      <SectionHeader icon="🎯" title="Maladaptive Behaviors" count={total} />
      {mastered.length > 0 && (
        <div className="mb-4">
          <SubBucketLabel label="Mastered this period ✓" color="emerald" />
          <div className="space-y-1.5">{mastered.map(item => <BehaviorMasteredRow key={item.behaviorId ?? item.behaviorName} item={item} />)}</div>
        </div>
      )}
      {continuing.length > 0 && (
        <div className="mb-4">
          <SubBucketLabel label="Continuing in new cycle" color="amber" />
          <div className="space-y-2">
            {continuing.map(item => (
              <BehaviorContinuingCard key={item.behaviorId ?? item.behaviorName} item={item} planBt={planBtMap[item.behaviorId]} sessionLogs={sessionLogs} />
            ))}
          </div>
        </div>
      )}
      {newBehaviors.length > 0 && (
        <div className="mb-1">
          <SubBucketLabel label="New / Emerging" color="slate" />
          <div className="space-y-1.5">
            {inPlanNew.map(item => <NewBehaviorRow key={item.behaviorName} item={item} planBt={planBtMap[item.behaviorId] ?? planBtByName[item.behaviorName?.toLowerCase()]} />)}
            {monitorNew.map(item => <NewBehaviorRow key={item.behaviorName} item={item} planBt={planBtMap[item.behaviorId] ?? planBtByName[item.behaviorName?.toLowerCase()]} />)}
            {excludedNew.map(item => <NewBehaviorRow key={item.behaviorName} item={item} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SECTION B: Skill Acquisitions ───────────────────────────────────────────

function SkillMasteredRow({ item }) {
  const baseline = item.baselinePercent != null ? `${item.baselinePercent}%` : '–';
  const final    = item.averageAccuracy  != null ? `${Math.round(item.averageAccuracy)}%` : '–';
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
      <span className="text-emerald-500 text-base flex-shrink-0">✓</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-emerald-800 leading-tight truncate">{item.skillName}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px] text-emerald-700 font-medium">Mastered ✓</span>
          {item.domain && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium border border-teal-200">{item.domain}</span>}
          {item.masteryDate && <span className="text-[11px] text-slate-400">{fmtDate(item.masteryDate)}</span>}
          <span className="text-[11px] text-emerald-600 font-semibold tabular-nums">{baseline} → {final} avg</span>
        </div>
      </div>
    </div>
  );
}

function SkillContinuingCard({ item, planGoal, sessionLogs }) {
  const [open, setOpen] = useState(false);
  const baseline = item.baselinePercent;
  const avg      = item.averageAccuracy != null ? Math.round(item.averageAccuracy) : null;
  const pctGain  = baseline != null && avg != null ? avg - baseline : null;
  const ltoVal   = planGoal?.masteryCriteriaPercent != null ? `${planGoal.masteryCriteriaPercent}%` : null;
  const stoSteps = planGoal?.stoSteps ?? [];

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-stone-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-semibold text-slate-800 leading-tight">{item.skillName}</p>
            {item.domain && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium border border-teal-200">{item.domain}</span>}
            <TrendArrow trend={item.trend} />
            {pctGain != null && pctGain > 0 && (
              <span className="text-[11px] font-semibold text-emerald-600 tabular-nums">+{pctGain}pp ↑</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[11px] text-slate-400 tabular-nums">
              {baseline != null ? `${baseline}%` : '–'} initial → {avg != null ? `${avg}%` : '–'} avg
            </span>
            {item.sessionsLogged > 0 && (
              <><span className="text-[11px] text-slate-300">·</span><span className="text-[11px] text-slate-400">{item.sessionsLogged} sessions</span></>
            )}
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-4 border-t border-stone-100">
          <DualBaseline
            initialLabel="Initial baseline"
            initialVal={baseline != null ? `${baseline}%` : null}
            newCycleLabel="New cycle baseline"
            newCycleVal={avg != null ? `${avg}%` : null}
            pctChange={pctGain}
            isReduction={false}
          />
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-2 mb-1">Remaining milestones</p>
          <ReassessmentStoRail stoSteps={stoSteps} currentStoNumber={item.currentStoNumber ?? 1} ltoValue={ltoVal} ltoLabel="Mastery" variant="skill" />
          <SkillProgressChart item={item} planGoal={planGoal} sessionLogs={sessionLogs} />
        </div>
      )}
    </div>
  );
}

function NewSkillRow({ item }) {
  const disposition = getDisposition(item);
  const [open, setOpen] = useState(false);
  const isInPlan = disposition === 'in_plan';
  return (
    <div className={`rounded-xl border overflow-hidden ${isInPlan ? 'border-teal-200 bg-teal-50/30' : 'border-stone-100 bg-stone-50/40'}`}>
      <button
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left"
        onClick={() => isInPlan ? setOpen(o => !o) : undefined}
        style={!isInPlan ? { cursor: 'default' } : undefined}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <DispositionBadge type={disposition} />
            <p className={`text-[13px] font-semibold leading-tight ${isInPlan ? 'text-slate-800' : 'text-slate-500'}`}>{item.bcbaGoalName || item.skillName}</p>
            {item.bcbaDomain && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium border border-teal-200">{item.bcbaDomain}</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {item.firstSeenDate && <span className="text-[11px] text-slate-400">First seen {fmtDate(item.firstSeenDate)}</span>}
            {item.avgAccuracy != null && <span className="text-[11px] text-slate-500 tabular-nums">avg {item.avgAccuracy}%</span>}
          </div>
        </div>
        {isInPlan && (
          <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {isInPlan && open && (item.stoSteps?.length > 0 || item.masteryCriteriaPercent || item.bcbaLtoText) && (
        <div className="px-3 pb-3 border-t border-teal-100">
          {item.stoSteps?.map((s, i) => (
            <p key={i} className="text-[12px] text-slate-600 py-0.5">
              <span className="font-semibold text-teal-700">STO {i + 1}:</span>{' '}
              {s.targetPercent != null ? `${s.targetPercent}%` : ''}{s.durationWeeks ? ` · ${s.durationWeeks} wks` : ''}
            </p>
          ))}
          {item.masteryCriteriaPercent && <p className="text-[12px] text-slate-600 mt-1"><span className="font-semibold text-teal-700">Mastery:</span> {item.masteryCriteriaPercent}%{item.masteryCriteriaWeeks ? ` · ${item.masteryCriteriaWeeks} wks` : ''}</p>}
          {item.bcbaLtoText && <p className="text-[12px] text-slate-600 mt-1"><span className="font-semibold text-teal-700">LTO:</span> {item.bcbaLtoText}</p>}
        </div>
      )}
    </div>
  );
}

function SkillSection({ session, client }) {
  const sessionLogs = client?.service_session_logs ?? [];
  const origSkills  = session.originalSkillSummary ?? [];
  const newSkills   = session.newSkillSummary ?? [];
  const planGoalList = session.sections?.skill_acquisitions?.skillGoals ?? [];
  const planGoalMap  = Object.fromEntries(planGoalList.map(g => [g.id, g]));

  const mastered   = origSkills.filter(s => (s.sessionDerivedStatus ?? s.status) === 'met' || (s.sessionDerivedStatus ?? s.status) === 'mastered' || s.masteryDate != null);
  const continuing = origSkills.filter(s => {
    const st = s.sessionDerivedStatus ?? s.status;
    return st !== 'met' && st !== 'mastered' && s.masteryDate == null;
  });
  const inPlanNew   = newSkills.filter(s => s.includedInPlan === true);
  const monitorNew  = newSkills.filter(s => s.monitorOnly === true);
  const excludedNew = newSkills.filter(s => !s.includedInPlan && !s.monitorOnly);
  const total = origSkills.length + newSkills.length;
  if (total === 0) return null;

  return (
    <div className="mb-6">
      <SectionHeader icon="📈" title="Skill Acquisitions" count={total} />
      {mastered.length > 0 && (
        <div className="mb-4">
          <SubBucketLabel label="Mastered this period ✓" color="emerald" />
          <div className="space-y-1.5">{mastered.map(item => <SkillMasteredRow key={item.skillId ?? item.skillName} item={item} />)}</div>
        </div>
      )}
      {continuing.length > 0 && (
        <div className="mb-4">
          <SubBucketLabel label="Continuing in new cycle" color="amber" />
          <div className="space-y-2">
            {continuing.map(item => (
              <SkillContinuingCard key={item.skillId ?? item.skillName} item={item} planGoal={planGoalMap[item.skillId]} sessionLogs={sessionLogs} />
            ))}
          </div>
        </div>
      )}
      {newSkills.length > 0 && (
        <div className="mb-1">
          <SubBucketLabel label="New / Emerging" color="slate" />
          <div className="space-y-1.5">
            {inPlanNew.map(item => <NewSkillRow key={item.skillId ?? item.skillName} item={item} />)}
            {monitorNew.map(item => <NewSkillRow key={item.skillId ?? item.skillName} item={item} />)}
            {excludedNew.map(item => <NewSkillRow key={item.skillId ?? item.skillName} item={item} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SECTION C: Caregiver Training ───────────────────────────────────────────

function CTMasteredRow({ item }) {
  const baseline = item.baselinePercent != null ? `${item.baselinePercent}%` : '–';
  const avg      = item.averageSessionPercent != null ? `${Math.round(item.averageSessionPercent)}%` : '–';
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
      <span className="text-emerald-500 text-base flex-shrink-0">✓</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-emerald-800 leading-tight truncate">{item.goalName}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px] text-emerald-700 font-medium">Mastered ✓</span>
          {item.masteryDate && <span className="text-[11px] text-slate-400">{fmtDate(item.masteryDate)}</span>}
          <span className="text-[11px] text-emerald-600 font-semibold tabular-nums">{baseline} → {avg} avg</span>
        </div>
      </div>
    </div>
  );
}

function CTContinuingCard({ item, ctLogs }) {
  const [open, setOpen] = useState(false);
  const baseline = item.baselinePercent;
  const avg      = item.averageSessionPercent != null ? Math.round(item.averageSessionPercent) : null;
  const pctGain  = baseline != null && avg != null ? avg - baseline : null;
  const ltoVal   = item.ltoData?.percent != null ? `${item.ltoData.percent}%` : null;
  const stoSteps = item.stoSteps ?? [];

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-stone-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-semibold text-slate-800 leading-tight">{item.goalName}</p>
            <TrendArrow trend={item.trend} />
            {pctGain != null && pctGain > 0 && (
              <span className="text-[11px] font-semibold text-emerald-600 tabular-nums">+{pctGain}pp ↑</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[11px] text-slate-400 tabular-nums">
              {baseline != null ? `${baseline}%` : '–'} initial → {avg != null ? `${avg}%` : '–'} avg
            </span>
            {item.sessionsLogged > 0 && (
              <><span className="text-[11px] text-slate-300">·</span><span className="text-[11px] text-slate-400">{item.sessionsLogged} sessions</span></>
            )}
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-4 border-t border-stone-100">
          <DualBaseline
            initialLabel="Initial baseline"
            initialVal={baseline != null ? `${baseline}%` : null}
            newCycleLabel="New cycle baseline"
            newCycleVal={avg != null ? `${avg}%` : null}
            pctChange={pctGain}
            isReduction={false}
          />
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-2 mb-1">Remaining milestones</p>
          <ReassessmentStoRail stoSteps={stoSteps} currentStoNumber={item.currentStoNumber ?? 1} ltoValue={ltoVal} ltoLabel="Target" variant="ct" />
          <CTProgressChart item={item} ctLogs={ctLogs} />
        </div>
      )}
    </div>
  );
}

function NewCTRow({ item }) {
  const disposition = getDisposition(item);
  const isInPlan = disposition === 'in_plan';
  return (
    <div className={`rounded-xl border overflow-hidden ${isInPlan ? 'border-teal-200 bg-teal-50/30' : 'border-stone-100 bg-stone-50/40'}`}>
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <DispositionBadge type={disposition} />
            <p className={`text-[13px] font-semibold leading-tight ${isInPlan ? 'text-slate-800' : 'text-slate-500'}`}>{item.goalName}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {item.firstSeenDate && <span className="text-[11px] text-slate-400">First seen {fmtDate(item.firstSeenDate)}</span>}
            {item.avgAccuracy != null && <span className="text-[11px] text-slate-500 tabular-nums">avg {item.avgAccuracy}%</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function CTSection({ session, client }) {
  const ctLogs     = client?.caregiver_training_session_logs ?? [];
  const ctItems    = session.caregiverTrainingSummary ?? [];
  const newCTItems = session.newCaregiverSummary ?? [];
  const mastered   = ctItems.filter(c => (c.sessionDerivedStoStatus ?? c.stoStatus) === 'met');
  const continuing = ctItems.filter(c => (c.sessionDerivedStoStatus ?? c.stoStatus) !== 'met');
  const inPlanNew   = newCTItems.filter(c => c.includedInPlan === true);
  const monitorNew  = newCTItems.filter(c => c.monitorOnly === true);
  const excludedNew = newCTItems.filter(c => !c.includedInPlan && !c.monitorOnly);
  const total = ctItems.length + newCTItems.length;
  if (total === 0) return null;

  return (
    <div className="mb-2">
      <SectionHeader icon="👨‍👩‍👧" title="Caregiver Training" count={total} />
      {mastered.length > 0 && (
        <div className="mb-4">
          <SubBucketLabel label="Mastered this period ✓" color="emerald" />
          <div className="space-y-1.5">{mastered.map(item => <CTMasteredRow key={item.targetId ?? item.goalName} item={item} />)}</div>
        </div>
      )}
      {continuing.length > 0 && (
        <div className="mb-4">
          <SubBucketLabel label="Continuing in new cycle" color="amber" />
          <div className="space-y-2">
            {continuing.map(item => <CTContinuingCard key={item.targetId ?? item.goalName} item={item} ctLogs={ctLogs} />)}
          </div>
        </div>
      )}
      {newCTItems.length > 0 && (
        <div className="mb-1">
          <SubBucketLabel label="New / Emerging" color="slate" />
          <div className="space-y-1.5">
            {inPlanNew.map(item => <NewCTRow key={item.goalName} item={item} />)}
            {monitorNew.map(item => <NewCTRow key={item.goalName} item={item} />)}
            {excludedNew.map(item => <NewCTRow key={item.goalName} item={item} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Header strip ─────────────────────────────────────────────────────────────

const NARRATIVE_LIMIT = 320;

function HeaderStrip({ session }) {
  const [expanded, setExpanded] = useState(false);
  const narrative = session.progressNarrativeText ?? '';
  const isLong    = narrative.length > NARRATIVE_LIMIT;
  const cpt       = session.cptHours ?? {};
  const start     = session.authPeriodStart;
  const end       = session.authPeriodEnd;
  const hasCpt    = cpt['97153'] || cpt['97155'] || cpt['97156'];
  const hasAuth   = start || end;

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 mb-5">
      {(hasAuth || hasCpt) && (
        <div className="flex items-center gap-4 flex-wrap mb-3">
          {hasAuth && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Auth period</span>
              <span className="text-[12px] font-semibold text-slate-700" style={{ fontFamily: 'DM Mono, monospace' }}>
                {fmtDate(start)} – {fmtDate(end)}
              </span>
            </div>
          )}
          {hasCpt && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">CPT hrs/mo</span>
              <span className="text-[11px] font-semibold text-slate-600" style={{ fontFamily: 'DM Mono, monospace' }}>
                {[cpt['97153'] && `97153 · ${cpt['97153']}h`, cpt['97155'] && `97155 · ${cpt['97155']}h`, cpt['97156'] && `97156 · ${cpt['97156']}h`].filter(Boolean).join('  ')}
              </span>
            </div>
          )}
        </div>
      )}
      {narrative ? (
        <div>
          <p className="text-[12px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Progress Narrative</p>
          <p className="text-[13px] text-slate-700 leading-relaxed">
            {expanded || !isLong ? narrative : narrative.slice(0, NARRATIVE_LIMIT) + '…'}
          </p>
          {isLong && (
            <button onClick={() => setExpanded(e => !e)} className="mt-1.5 text-[11px] font-semibold text-teal-600 hover:text-teal-800 transition-colors">
              {expanded ? '↑ Show less' : '↓ Read more'}
            </button>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-slate-400 italic">Progress narrative not yet written.</p>
      )}
    </div>
  );
}

// ─── Reauthorization Submission Checklist ────────────────────────────────────

function CheckItem({ checked, onChange, label, sublabel }) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors cursor-pointer select-none
        ${checked
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-white border-stone-200 hover:border-teal-200 hover:bg-teal-50/30'
        }`}
      onClick={() => onChange(!checked)}
    >
      <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded flex items-center justify-center border transition-colors
        ${checked ? 'bg-teal-600 border-teal-600' : 'border-stone-300 bg-white'}`}>
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div>
        <p className={`text-[12px] font-semibold leading-tight ${checked ? 'line-through text-slate-400' : 'text-slate-700'}`}>
          {label}
        </p>
        {sublabel && (
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{sublabel}</p>
        )}
      </div>
    </div>
  );
}

export function ReauthSubmissionChecklist({ checklist, onChange, onUpload }) {
  const { vineland = false, basc = false, finalUploaded = false } = checklist ?? {};

  const allDone = vineland && basc && finalUploaded;

  return (
    <div className="mt-6 pt-5 border-t border-stone-100">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
        Reauthorization Submission
      </p>

      {allDone && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 16 16">
            <path d="M3 8l3.5 3.5 6.5-6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-[12px] font-semibold text-emerald-700">Ready for reauthorization submission</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <CheckItem
          checked={vineland}
          onChange={v => onChange('vineland', v)}
          label="Vineland-3 graphs manually added to report"
          sublabel="Download the draft, add Vineland-3 graphs from your third-party tool, then upload the final below."
        />
        <CheckItem
          checked={basc}
          onChange={v => onChange('basc', v)}
          label="BASC-3 graphs manually added to report"
          sublabel="Ensure BASC-3 graphs are included before uploading the final signed document."
        />
      </div>

      {/* Upload final signed report */}
      <div className={`mt-3 flex items-center justify-between px-4 py-3 rounded-lg border transition-colors
        ${finalUploaded ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-stone-200'}`}>
        <div>
          <p className={`text-[12px] font-semibold ${finalUploaded ? 'line-through text-slate-400' : 'text-slate-700'}`}>
            Final signed progress report uploaded
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {finalUploaded ? 'Document saved to the Documents tab.' : 'Upload the completed, signed report to send for reauthorization.'}
          </p>
        </div>
        {finalUploaded ? (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg flex-shrink-0 ml-3">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
              <path d="M2 6l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Uploaded
          </span>
        ) : (
          <label className="flex-shrink-0 ml-3 cursor-pointer">
            <input type="file" accept=".pdf,.docx" className="hidden" onChange={onUpload} />
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 bg-white border border-teal-300 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
                <path d="M6 1v7M3 5l3-3 3 3M1 10h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Upload
            </span>
          </label>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function ReassessmentCyclePanel({ session, client, graphs, onStartReauth }) {
  if (!session) return null;

  // ── Locked state: show placeholder until BCBA downloads the reassessment doc ──
  if (session.status !== 'complete') {
    return (
      <div className="mt-3 pt-3 border-t border-stone-100">
        <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/70 px-6 py-8 text-center">
          <div className="flex flex-col items-center gap-2.5">
            <span className="text-[28px] leading-none select-none">🔒</span>
            <p className="text-[13px] font-semibold text-slate-600" style={{ fontFamily: 'Syne, sans-serif' }}>
              Clinical summary locked
            </p>
            <p className="text-[12px] text-slate-400 leading-relaxed max-w-xs">
              Complete and download the reassessment document to unlock the full clinical summary — auth period, progress narrative, behaviors, skills, caregiver training, STO rails, and progress charts.
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-teal-600 font-semibold">
              <span>Continue in Reassessment →</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-stone-100">
      <HeaderStrip session={session} />
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Clinical Summary · Cycle Data</p>
      <BehaviorSection session={session} client={client} />
      <SkillSection session={session} client={client} />
      <CTSection session={session} client={client} />

      {/* ── Start Reauthorization CTA ── */}
      {onStartReauth && (
        <div className="mt-6 pt-5 border-t border-stone-100">
          <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-5 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-700 leading-snug">Ready to reauthorize?</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Clinical summary reviewed. Proceed to the Reauthorization tab to submit the new authorization request.
              </p>
            </div>
            <button
              onClick={onStartReauth}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
              style={{ background: '#0D9488' }}
            >
              Start Reauthorization →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
