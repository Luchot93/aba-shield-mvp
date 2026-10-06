import React, { useState, useMemo } from 'react';
import CaregiverTrainingProgressPanel from './CaregiverTrainingProgressPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function stoStatusLabel(status) {
  if (status === 'in_progress')       return 'In progress';
  if (status === 'not_yet_started')   return 'Not started';
  return 'Not started';
}

function stoStatusColor(status) {
  if (status === 'in_progress')     return 'text-teal-600';
  return 'text-slate-400';
}

function StoStatusChip({ stoNumber, stoStatus }) {
  if (stoStatus === 'met') {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
        Met ✓
      </span>
    );
  }
  return (
    <span className={`text-[11px] font-medium ${stoStatusColor(stoStatus)}`}>
      STO #{stoNumber} — {stoStatusLabel(stoStatus)}
    </span>
  );
}

// ── Trend arrow ───────────────────────────────────────────────────────────────
// For caregiver training % — higher is better, so ↑ = improving (green), ↓ = worsening (red)

function TrendArrow({ current, previous }) {
  if (previous == null || previous === undefined) return null;
  if (current > previous)
    return <span className="text-emerald-600 font-bold" title="Improving vs previous session">↑</span>;
  if (current < previous)
    return <span className="text-red-500 font-bold" title="Declining vs previous session">↓</span>;
  return <span className="text-slate-400 font-bold" title="Same as previous session">→</span>;
}

// ── TrainingLogCard ───────────────────────────────────────────────────────────

function TrainingLogCard({ log, prevLog, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);

  // Map targetId → previous session % for trend arrows
  const prevPctMap = useMemo(() => {
    if (!prevLog) return {};
    return Object.fromEntries(
      (prevLog.trainingEntries ?? []).map(e => [e.targetId, e.sessionPercent]),
    );
  }, [prevLog]);

  // Split entries into plan, monitoring, and new flags
  const planEntries     = (log.trainingEntries ?? []).filter(e => e.targetId && !e.isNew && !e.isMonitoring);
  const monitoringItems = (log.trainingEntries ?? []).filter(e => e.isMonitoring);
  const newFlags        = (log.trainingEntries ?? []).filter(e => e.isNew);

  return (
    <div className="border-b border-stone-100 last:border-b-0">

      {/* ── Card toggle header ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-5 py-3 hover:bg-slate-50/80 transition-colors text-left"
      >
        <span
          className="text-[13px] font-semibold text-slate-800 flex-shrink-0"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          Session #{log.sessionNumber}
        </span>
        <span className="text-[11px] text-slate-400 flex-shrink-0">·</span>
        <span className="text-[12px] text-slate-500 flex-shrink-0">{fmtDate(log.sessionDate)}</span>
        <span className="text-[11px] text-slate-400 flex-shrink-0">·</span>
        <span className="text-[12px] text-slate-500 truncate">{log.bcbaName}</span>

        {!open && (() => {
          const masteredCount = planEntries.filter(e => e.stoStatus === 'met').length;
          return masteredCount > 0 && (
            <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
              {masteredCount} mastered ✓
            </span>
          );
        })()}
        {newFlags.length > 0 && (
          <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
            🚩 {newFlags.length} new
          </span>
        )}
        {monitoringItems.length > 0 && (
          <span className="text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
            {monitoringItems.length} monitoring
          </span>
        )}

        <span className="ml-auto text-[11px] text-slate-400 flex-shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {/* ── Expanded body ── */}
      {open && (
        <div className="px-5 pb-4 space-y-3">

          {/* Plan training entries */}
          {planEntries.length > 0 && (
            <div className="space-y-2.5">
              {planEntries.map((entry, i) => (
                <div key={entry.targetId ?? i} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-800 leading-snug">
                      {entry.goalName}
                    </p>
                    <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-0.5">
                      {entry.baselinePercent != null && (
                        <span className="text-[11px] text-slate-400">
                          Baseline {entry.baselinePercent}%
                        </span>
                      )}
                      {entry.sessionPercent != null && (
                        <span className="text-[12px] text-slate-700 font-medium flex items-center gap-1">
                          {entry.sessionPercent}% this session
                          <TrendArrow
                            current={entry.sessionPercent}
                            previous={prevPctMap[entry.targetId]}
                          />
                        </span>
                      )}
                      <StoStatusChip stoNumber={entry.currentStoNumber} stoStatus={entry.stoStatus} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Monitoring entries */}
          {monitoringItems.length > 0 && (
            <div className="pt-2 border-t border-stone-100 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">Monitoring</p>
              {monitoringItems.map((entry, i) => (
                <div key={entry.goalName + i} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-800 leading-snug">{entry.goalName}</p>
                    <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-0.5">
                      {entry.baselinePercent != null && (
                        <span className="text-[11px] text-slate-400">Baseline {entry.baselinePercent}%</span>
                      )}
                      {entry.sessionPercent != null && (
                        <span className="text-[12px] text-slate-700 font-medium">{entry.sessionPercent}% this session</span>
                      )}
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">Monitoring</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Newly flagged goals */}
          {newFlags.length > 0 && (
            <div className="pt-2 border-t border-stone-100 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">New Goals Flagged</p>
              {newFlags.map((entry, i) => (
                <div key={entry.goalName + i} className="flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">🚩</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-800 leading-snug">{entry.goalName}</p>
                    {entry.baselinePercent != null && (
                      <p className="text-[11px] text-slate-400">Baseline {entry.baselinePercent}%</p>
                    )}
                    {entry.notes?.trim() && (
                      <p className="text-[12px] text-slate-500 italic leading-relaxed mt-0.5">{entry.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {log.notes?.trim() && (
            <p
              className="text-[12px] text-slate-500 leading-relaxed pt-2 border-t border-stone-100 italic"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {log.notes}
            </p>
          )}

        </div>
      )}
    </div>
  );
}

// ── CaregiverTrainingLogPanel ─────────────────────────────────────────────────

export default function CaregiverTrainingLogPanel({ client, onLogSession, selectedCycle }) {
  const allLogs            = client?.caregiver_training_session_logs ?? [];
  const logs               = selectedCycle != null
    ? allLogs.filter(l => (l.reauth_cycle ?? 0) === selectedCycle)
    : allLogs;
  const caregiverTargets   =
    client?.assessment_session?.sections?.caregiver_training?.caregiverTrainingTargets ?? [];
  const hasTargets         = caregiverTargets.length > 0;

  const [view, setView] = useState('timeline');

  // Sort newest first by sessionNumber
  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => b.sessionNumber - a.sessionNumber),
    [logs],
  );

  const lastDate = sortedLogs[0]?.sessionDate ? fmtDate(sortedLogs[0].sessionDate) : null;

  return (
    <div className="bg-white rounded-xl border border-stone-200 flex flex-col mt-4">

      {/* ── Panel header ── */}
      <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h2
            className="text-sm font-semibold text-slate-900"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Caregiver Training Log
          </h2>
          {logs.length > 0 ? (
            <p className="text-xs text-slate-400 mt-0.5">
              {logs.length} session{logs.length !== 1 ? 's' : ''} logged · Last: {lastDate}
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">BCBA caregiver training log</p>
          )}
        </div>

        {/* Timeline / Progress toggle — only when sessions exist */}
        {sortedLogs.length > 0 && (
          <div className="flex items-center bg-stone-100 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
            {[['timeline', 'Timeline'], ['progress', '📊 Progress']].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`text-[11px] font-semibold px-3 py-1 rounded-md transition-colors ${
                  view === v
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={hasTargets ? onLogSession : undefined}
          disabled={!hasTargets}
          title={
            !hasTargets
              ? 'Add caregiver training targets in Section 11 of the assessment to enable session logging.'
              : 'Log a new caregiver training session'
          }
          className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            hasTargets
              ? 'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span className="text-base leading-none">+</span>
          Log Session
        </button>
      </div>

      {/* ── Body ── */}
      {sortedLogs.length === 0 ? (
        <div className="px-5 py-7 text-center">
          {hasTargets ? (
            <p className="text-[13px] text-slate-400 leading-relaxed">
              No caregiver training sessions logged yet.{' '}
              <button
                onClick={onLogSession}
                className="text-teal-600 font-semibold hover:underline"
              >
                + Log Session
              </button>{' '}
              after each training session.
            </p>
          ) : (
            <p className="text-[13px] text-slate-400 leading-relaxed">
              No caregiver training targets in the assessment. Complete Section 11 to enable
              session logging.
            </p>
          )}
        </div>
      ) : view === 'progress' ? (
        <CaregiverTrainingProgressPanel client={client} selectedCycle={selectedCycle} />
      ) : (
        <div>
          {sortedLogs.map((log, idx) => {
            // prevLog = the session chronologically before this one (next in desc-sorted array)
            const prevLog = sortedLogs[idx + 1] ?? null;
            return (
              <TrainingLogCard
                key={log.id}
                log={log}
                prevLog={prevLog}
                defaultOpen={idx === 0}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
