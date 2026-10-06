import React, { useMemo } from 'react';
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

// ── Data transformer ──────────────────────────────────────────────────────────

/**
 * buildSkillChartData
 *
 * For each skill goal that appears in at least one skill session log, build:
 *  - chartData[]  — one point per session, accuracy:null when not logged
 *  - baseline, mastery, stoSteps from the treatment-plan goal
 *  - trend (up / down / stable / none)   — up = improving for skills
 */
function buildSkillChartData(sessionLogs, skillGoals) {
  const sorted = [...sessionLogs]
    .filter(l => l.sessionType === 'skill' || (!l.sessionType && (l.skillEntries ?? []).some(e => !e.isNew)))
    .sort((a, b) => a.sessionNumber - b.sessionNumber);

  const planMap = Object.fromEntries((skillGoals ?? []).map(g => [g.id, g]));

  const skillIds = [
    ...new Set(
      sorted.flatMap(log =>
        (log.skillEntries ?? [])
          .filter(e => !e.isNew && e.skillId)
          .map(e => e.skillId),
      ),
    ),
  ];

  return skillIds.map(skillId => {
    const goal    = planMap[skillId];
    const baseline = goal?.baselinePercent != null && goal.baselinePercent !== ''
      ? parseFloat(goal.baselinePercent) : null;
    const mastery  = goal?.masteryCriteriaPercent != null && goal.masteryCriteriaPercent !== ''
      ? parseFloat(goal.masteryCriteriaPercent) : null;
    const stoSteps = (goal?.stoSteps ?? []).filter(
      s => s.targetPercent !== '' && s.targetPercent != null,
    );

    const chartData = sorted.map(log => {
      const entry = (log.skillEntries ?? []).find(e => e.skillId === skillId);
      return {
        session:     log.sessionNumber,
        sessionDate: log.sessionDate,
        accuracy:    entry != null ? entry.accuracyPercent : null,
        stoNumber:   entry?.currentStoNumber ?? null,
        stoStatus:   entry?.stoStatus ?? null,
      };
    });

    const nameSource = sorted
      .flatMap(l => l.skillEntries ?? [])
      .find(e => e.skillId === skillId);
    const skillName = nameSource?.skillName ?? goal?.targetSkill ?? skillId;

    const recorded = chartData.filter(p => p.accuracy != null);
    const latest   = recorded[recorded.length - 1];
    const first    = recorded[0];

    let trend = 'none';
    if (recorded.length > 1) {
      if (latest.accuracy > first.accuracy)      trend = 'up';
      else if (latest.accuracy < first.accuracy) trend = 'down';
      else                                        trend = 'stable';
    }

    return {
      skillId,
      skillName,
      baseline,
      mastery,
      stoSteps,
      currentStoNumber: latest?.stoNumber ?? null,
      currentStoStatus: latest?.stoStatus ?? 'not_yet_started',
      chartData,
      sessionCount: recorded.length,
      trend,
    };
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SkillTooltip({ active, payload, label }) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  const pt = payload[0]?.payload;
  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm px-3 py-2 text-[11px] text-slate-700">
      <p className="font-semibold mb-0.5">Session #{label}</p>
      {pt?.sessionDate && <p className="text-slate-400 mb-0.5">{fmtDate(pt.sessionDate)}</p>}
      <p>
        Accuracy:{' '}
        <span className="font-semibold text-teal-600">{payload[0].value}%</span>
      </p>
    </div>
  );
}

function StoChip({ stoNumber, stoStatus }) {
  const base = 'text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0';
  if (stoStatus === 'met')
    return <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200`}>STO #{stoNumber} · Met ✓</span>;
  if (stoStatus === 'in_progress')
    return <span className={`${base} bg-teal-50 text-teal-700 border-teal-200`}>STO #{stoNumber} · In progress</span>;
  return <span className={`${base} bg-stone-50 text-slate-400 border-stone-200`}>STO #{stoNumber ?? 1} · Not started</span>;
}

// ── Skill progress card ───────────────────────────────────────────────────────

function SkillProgressCard({ data }) {
  const {
    skillName,
    baseline,
    mastery,
    stoSteps,
    currentStoNumber,
    currentStoStatus,
    chartData,
    sessionCount,
    trend,
  } = data;

  // For skills: up = improving (green), down = declining (red)
  const trendEl =
    trend === 'up'     ? <span className="font-semibold text-emerald-600">↑ Improving</span>
    : trend === 'down' ? <span className="font-semibold text-rose-500">↓ Declining</span>
    : trend === 'stable' ? <span className="text-slate-400">→ Stable</span>
    : <span className="text-slate-400">— First session</span>;

  const refValues = [
    baseline,
    mastery,
    ...stoSteps.map(s => parseFloat(s.targetPercent)),
    ...chartData.filter(p => p.accuracy != null).map(p => p.accuracy),
  ].filter(v => v != null && !isNaN(v));

  const yMax = refValues.length > 0 ? Math.min(100, Math.max(...refValues) + 5) : 100;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[13px] font-semibold text-slate-800 leading-snug" style={{ fontFamily: 'Syne, sans-serif' }}>
          {skillName}
        </p>
        {currentStoNumber != null && (
          <StoChip stoNumber={currentStoNumber} stoStatus={currentStoStatus} />
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis
            dataKey="session"
            tick={{ fontSize: 10, fill: '#94A3B8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `#${v}`}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: '#94A3B8' }}
            tickLine={false}
            axisLine={false}
            domain={[0, yMax]}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip content={<SkillTooltip />} />

          {/* Baseline — slate dashed */}
          {baseline != null && (
            <ReferenceLine y={baseline} stroke="#94A3B8" strokeDasharray="4 4" />
          )}

          {/* STO steps — amber dashed */}
          {stoSteps.map((step, i) => (
            <ReferenceLine
              key={step.id ?? i}
              y={parseFloat(step.targetPercent)}
              stroke="#D97706"
              strokeDasharray="3 3"
            />
          ))}

          {/* Mastery / LTO — teal solid */}
          {mastery != null && (
            <ReferenceLine y={mastery} stroke="#0D9488" strokeWidth={1.5} />
          )}

          {/* Session accuracy line — teal */}
          <Line
            type="monotone"
            dataKey="accuracy"
            stroke="#14B8A6"
            strokeWidth={2}
            dot={{ fill: '#14B8A6', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#14B8A6' }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <span className="inline-block w-4 h-0.5 bg-teal-400 rounded-full flex-shrink-0" />
          Sessions
        </span>
        {baseline != null && (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="inline-block w-4 border-t border-dashed border-slate-400 flex-shrink-0" />
            Baseline {baseline}%
          </span>
        )}
        {stoSteps.map((step, i) => (
          <span key={step.id ?? i} className="flex items-center gap-1.5 text-[11px] text-amber-600">
            <span className="inline-block w-4 border-t border-dashed border-amber-500 flex-shrink-0" />
            STO {i + 1}: {step.targetPercent}%
          </span>
        ))}
        {mastery != null && (
          <span className="flex items-center gap-1.5 text-[11px] text-teal-600">
            <span className="inline-block w-4 border-t-2 border-teal-500 flex-shrink-0" />
            Mastery {mastery}%
          </span>
        )}
      </div>

      {/* Summary strip */}
      <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2.5 flex-wrap text-[11px]">
        {trendEl}
        {currentStoNumber != null && (
          <>
            <span className="text-stone-200">·</span>
            <span className="text-slate-500">
              STO #{currentStoNumber}{' '}
              {currentStoStatus === 'met' ? 'met ✓' : currentStoStatus === 'in_progress' ? 'in progress' : 'not started'}
            </span>
          </>
        )}
        <span className="text-stone-200">·</span>
        <span className="text-slate-400">{sessionCount} session{sessionCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

// ── Default export ────────────────────────────────────────────────────────────

export default function SkillSessionProgressPanel({ client, selectedCycle }) {
  const sessionLogs  = (client?.service_session_logs ?? []).filter(
    l => selectedCycle == null || (l.reauth_cycle ?? 0) === selectedCycle,
  );
  const skillGoals   = client?.assessment_session?.sections?.skill_acquisitions?.skillGoals ?? [];

  const skills = useMemo(
    () => buildSkillChartData(sessionLogs, skillGoals),
    [sessionLogs, skillGoals],
  );

  if (skills.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-[13px] text-slate-400 leading-relaxed">
          No skill data to display yet.
          <br />
          Log at least one session to see accuracy charts.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-3">
      {skills.map(s => (
        <SkillProgressCard key={s.skillId} data={s} />
      ))}
    </div>
  );
}
