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
 * buildBehaviorChartData
 *
 * For each behavior that appears in at least one session log (non-new), build:
 *  - chartData[]  — one point per session, frequency:null when not logged
 *  - baseline, ltoFreq, stoSteps from the treatment-plan target
 *  - trend (up / down / stable / none)
 */
function buildBehaviorChartData(sessionLogs, behaviorTargets) {
  // Sort oldest → newest so x-axis order makes sense
  const sorted = [...sessionLogs].sort((a, b) => a.sessionNumber - b.sessionNumber);

  // Build lookup: behaviorId → plan target
  const planMap = Object.fromEntries(
    (behaviorTargets ?? []).map(bt => [bt.id, bt]),
  );

  // Collect unique behaviorIds from all plan-based entries (not isNew)
  const behaviorIds = [
    ...new Set(
      sorted.flatMap(log =>
        (log.behaviorEntries ?? [])
          .filter(e => !e.isNew && e.behaviorId)
          .map(e => e.behaviorId),
      ),
    ),
  ];

  return behaviorIds.map(behaviorId => {
    const planTarget = planMap[behaviorId];
    const baseline   = planTarget?.baselineFrequency != null ? parseFloat(planTarget.baselineFrequency) : null;
    const ltoFreq    = planTarget?.targetFrequency   != null && planTarget.targetFrequency !== ''
      ? parseFloat(planTarget.targetFrequency)
      : null;
    const stoSteps   = (planTarget?.stoSteps ?? []).filter(
      s => s.targetFrequency !== '' && s.targetFrequency != null,
    );

    // Build one point per session (null frequency when behavior not logged that session)
    const chartData = sorted.map(log => {
      const entry = (log.behaviorEntries ?? []).find(e => e.behaviorId === behaviorId);
      return {
        session:      log.sessionNumber,
        sessionDate:  log.sessionDate,
        rbtName:      log.rbtName,
        frequency:    entry != null ? entry.sessionFrequency : null,
        stoNumber:    entry?.currentStoNumber ?? null,
        stoStatus:    entry?.stoStatus ?? null,
      };
    });

    // Pull behavior name from first entry that has one
    const nameSource = sorted
      .flatMap(l => l.behaviorEntries ?? [])
      .find(e => e.behaviorId === behaviorId);
    const behaviorName = nameSource?.behaviorName ?? behaviorId;

    // Latest/first recorded points for trend
    const recorded = chartData.filter(p => p.frequency != null);
    const latest   = recorded[recorded.length - 1];
    const first    = recorded[0];

    let trend = 'none';
    if (recorded.length > 1) {
      if (latest.frequency < first.frequency) trend = 'down';
      else if (latest.frequency > first.frequency) trend = 'up';
      else trend = 'stable';
    }

    return {
      behaviorId,
      behaviorName,
      baseline,
      ltoFreq,
      stoSteps,
      currentStoNumber: latest?.stoNumber ?? null,
      currentStoStatus: latest?.stoStatus ?? 'not_yet_started',
      chartData,
      sessionCount: recorded.length,
      trend,
    };
  });
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function BehaviorTooltip({ active, payload, label }) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  const pt = payload[0]?.payload;
  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm px-3 py-2 text-[11px] text-slate-700">
      <p className="font-semibold mb-0.5">Session #{label}</p>
      {pt?.sessionDate && <p className="text-slate-400 mb-0.5">{fmtDate(pt.sessionDate)}</p>}
      <p>
        Frequency:{' '}
        <span className="font-semibold text-rose-500">{payload[0].value}×</span>
      </p>
    </div>
  );
}

// ── STO status chip ────────────────────────────────────────────────────────────

function StoChip({ stoNumber, stoStatus }) {
  const base = 'text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0';
  if (stoStatus === 'met')
    return <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200`}>STO #{stoNumber} · Met ✓</span>;
  if (stoStatus === 'in_progress')
    return <span className={`${base} bg-teal-50 text-teal-700 border-teal-200`}>STO #{stoNumber} · In progress</span>;
  return <span className={`${base} bg-stone-50 text-slate-400 border-stone-200`}>STO #{stoNumber ?? 1} · Not started</span>;
}

// ── Behavior progress card ─────────────────────────────────────────────────────

function BehaviorProgressCard({ data }) {
  const {
    behaviorName,
    baseline,
    ltoFreq,
    stoSteps,
    currentStoNumber,
    currentStoStatus,
    chartData,
    sessionCount,
    trend,
  } = data;

  const trendEl =
    trend === 'down'   ? <span className="font-semibold text-emerald-600">↓ Trending down</span>
    : trend === 'up'   ? <span className="font-semibold text-rose-500">↑ Trending up</span>
    : trend === 'stable' ? <span className="text-slate-400">→ Stable</span>
    : <span className="text-slate-400">— First session</span>;

  // Compute Y-axis domain to include all reference values
  const refValues = [
    baseline,
    ltoFreq,
    ...stoSteps.map(s => parseFloat(s.targetFrequency)),
    ...chartData.filter(p => p.frequency != null).map(p => p.frequency),
  ].filter(v => v != null && !isNaN(v));

  const yMax = refValues.length > 0
    ? Math.max(...refValues) + 1
    : 10;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <p
          className="text-[13px] font-semibold text-slate-800 leading-snug"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          {behaviorName}
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
          />
          <Tooltip content={<BehaviorTooltip />} />

          {/* Baseline — slate dashed, no inline label */}
          {baseline != null && (
            <ReferenceLine y={baseline} stroke="#94A3B8" strokeDasharray="4 4" />
          )}

          {/* STO steps — amber dashed, no inline labels */}
          {stoSteps.map((step, i) => (
            <ReferenceLine
              key={step.id ?? i}
              y={parseFloat(step.targetFrequency)}
              stroke="#D97706"
              strokeDasharray="3 3"
            />
          ))}

          {/* Mastery / LTO — teal solid, no inline label */}
          {ltoFreq != null && (
            <ReferenceLine y={ltoFreq} stroke="#0D9488" strokeWidth={1.5} />
          )}

          {/* Session frequency line — rose */}
          <Line
            type="monotone"
            dataKey="frequency"
            stroke="#F43F5E"
            strokeWidth={2}
            dot={{ fill: '#F43F5E', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#F43F5E' }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend — one item per reference line, no collision possible */}
      <div className="mt-2 flex items-center gap-3 flex-wrap">
        {/* Session frequency */}
        <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <span className="inline-block w-4 h-0.5 bg-rose-400 rounded-full flex-shrink-0" />
          Sessions
        </span>
        {/* Baseline */}
        {baseline != null && (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="inline-block w-4 border-t border-dashed border-slate-400 flex-shrink-0" />
            Baseline {baseline}×
          </span>
        )}
        {/* STO steps */}
        {stoSteps.map((step, i) => (
          <span key={step.id ?? i} className="flex items-center gap-1.5 text-[11px] text-amber-600">
            <span className="inline-block w-4 border-t border-dashed border-amber-500 flex-shrink-0" />
            STO {i + 1}: {step.targetFrequency}×
          </span>
        ))}
        {/* Mastery */}
        {ltoFreq != null && (
          <span className="flex items-center gap-1.5 text-[11px] text-teal-600">
            <span className="inline-block w-4 border-t-2 border-teal-500 flex-shrink-0" />
            Mastery {ltoFreq}×
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
        <span className="text-slate-400">
          {sessionCount} session{sessionCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

// ── ServiceSessionProgressPanel (default export) ──────────────────────────────

export default function ServiceSessionProgressPanel({ client }) {
  const sessionLogs = client?.service_session_logs ?? [];
  const behaviorTargets =
    client?.assessment_session?.sections?.behavior_targets?.behaviorTargets ?? [];

  const behaviors = useMemo(
    () => buildBehaviorChartData(sessionLogs, behaviorTargets),
    [sessionLogs, behaviorTargets],
  );

  if (behaviors.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-[13px] text-slate-400 leading-relaxed">
          No behavior data to display yet.
          <br />
          Log at least one session to see progress charts.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-3">
      {behaviors.map(b => (
        <BehaviorProgressCard key={b.behaviorId} data={b} />
      ))}
    </div>
  );
}
