import React, { useState, useMemo } from 'react';
import SkillSessionProgressPanel from './SkillSessionProgressPanel';

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function stoStatusLabel(status) {
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

function stoStatusColor(status) {
  if (status === 'in_progress') return 'text-teal-600';
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

function TrendArrow({ current, previous }) {
  if (previous == null) return null;
  if (current > previous) return <span className="text-emerald-600 font-bold" title="Improving vs previous session">↑</span>;
  if (current < previous) return <span className="text-red-500 font-bold" title="Declining vs previous session">↓</span>;
  return <span className="text-slate-400 font-bold" title="Same as previous session">→</span>;
}

function SkillSessionCard({ log, prevLog, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);

  const prevAccuracyMap = useMemo(() => {
    if (!prevLog) return {};
    return Object.fromEntries(
      (prevLog.skillEntries ?? [])
        .filter(e => !e.isNew && e.skillId)
        .map(e => [e.skillId, e.accuracyPercent]),
    );
  }, [prevLog]);

  const existingSkills    = (log.skillEntries ?? []).filter(e => !e.isNew && !e.isMonitoring);
  const monitoringSkills  = (log.skillEntries ?? []).filter(e => e.isMonitoring);
  const newSkills         = (log.skillEntries ?? []).filter(e => e.isNew);

  return (
    <div className="border-b border-stone-100 last:border-b-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-5 py-3 hover:bg-slate-50/80 transition-colors text-left"
      >
        <span className="text-[13px] font-semibold text-slate-800 flex-shrink-0" style={{ fontFamily: 'Syne, sans-serif' }}>
          Session #{log.sessionNumber}
        </span>
        <span className="text-[11px] text-slate-400 flex-shrink-0">·</span>
        <span className="text-[12px] text-slate-500 flex-shrink-0">{fmtDate(log.sessionDate)}</span>
        <span className="text-[11px] text-slate-400 flex-shrink-0">·</span>
        <span className="text-[12px] text-slate-500 truncate">{log.rbtName}</span>

        {!open && (() => {
          const masteredCount = existingSkills.filter(e => e.stoStatus === 'met').length;
          return masteredCount > 0 && (
            <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
              {masteredCount} mastered ✓
            </span>
          );
        })()}
        {!open && monitoringSkills.length > 0 && (
          <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
            {monitoringSkills.length} monitoring
          </span>
        )}
        {!open && newSkills.length > 0 && (
          <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
            🚩 {newSkills.length}
          </span>
        )}

        <span className="ml-auto text-[11px] text-slate-400 flex-shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-3">
          {existingSkills.length > 0 && (
            <div className="space-y-2.5">
              {existingSkills.map((entry, i) => (
                <div key={entry.skillId ?? i} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-800 leading-snug">{entry.skillName}</p>
                    <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-0.5">
                      <span className="text-[12px] text-slate-700 font-medium flex items-center gap-1">
                        {entry.accuracyPercent}% today
                        <TrendArrow current={entry.accuracyPercent} previous={prevAccuracyMap[entry.skillId]} />
                      </span>
                      <StoStatusChip stoNumber={entry.currentStoNumber} stoStatus={entry.stoStatus} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {monitoringSkills.length > 0 && (
            <div className="pt-2 border-t border-stone-100 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">Monitoring</p>
              {monitoringSkills.map((entry, i) => (
                <div key={entry.skillName ?? `mon-${i}`} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[13px] font-medium text-slate-800 leading-snug">{entry.skillName}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">Monitoring</span>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-0.5">
                      <span className="text-[12px] text-slate-700 font-medium">
                        {entry.accuracyPercent != null ? `${entry.accuracyPercent}% today` : '—'}
                      </span>
                      {entry.baselinePercent != null && (
                        <span className="text-[11px] text-slate-400">Baseline {entry.baselinePercent}%</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {newSkills.length > 0 && (
            <div className="pt-2 border-t border-stone-100 space-y-1.5">
              {newSkills.map((skill, i) => (
                <div key={skill.skillId ?? `skill-${i}`} className="flex items-center gap-1.5 text-[12px] text-slate-600">
                  <span className="text-sm leading-none flex-shrink-0">🚩</span>
                  <span>New skill flagged: <span className="font-medium text-slate-800">{skill.skillName}</span></span>
                </div>
              ))}
            </div>
          )}

          {log.notes?.trim() && (
            <p className="text-[12px] text-slate-500 leading-relaxed pt-2 border-t border-stone-100 italic"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {log.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SkillSessionLogPanel({ client, onLogSession }) {
  const allLogs = client?.service_session_logs ?? [];
  const logs = allLogs.filter(
    l => l.sessionType === 'skill' || (!l.sessionType && (l.skillEntries ?? []).some(s => !s.isNew)),
  );

  const skillGoals =
    client?.assessment_session?.sections?.skill_acquisitions?.skillGoals ?? [];
  const hasSkills = skillGoals.length > 0;

  const [view, setView] = useState('timeline');

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => b.sessionNumber - a.sessionNumber),
    [logs],
  );

  const lastDate = sortedLogs[0]?.sessionDate ? fmtDate(sortedLogs[0].sessionDate) : null;

  return (
    <div className="bg-white rounded-xl border border-stone-200 flex flex-col mt-4">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>
            Skill Sessions
          </h2>
          {logs.length > 0 ? (
            <p className="text-xs text-slate-400 mt-0.5">
              {logs.length} session{logs.length !== 1 ? 's' : ''} logged · Last: {lastDate}
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">Skill acquisition accuracy log</p>
          )}
        </div>

        {sortedLogs.length > 0 && (
          <div className="flex items-center bg-stone-100 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
            {[['timeline', 'Timeline'], ['progress', '📊 Progress']].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                className={`text-[11px] font-semibold px-3 py-1 rounded-md transition-colors ${
                  view === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}>
                {label}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={hasSkills ? onLogSession : undefined}
          disabled={!hasSkills}
          title={!hasSkills ? 'No skill goals found in the assessment' : 'Log a skill session'}
          className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            hasSkills ? 'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span className="text-base leading-none">+</span>
          Log Skill Session
        </button>
      </div>

      {sortedLogs.length === 0 ? (
        <div className="px-5 py-7 text-center">
          {hasSkills ? (
            <p className="text-[13px] text-slate-400 leading-relaxed">
              No skill sessions logged yet.{' '}
              <button onClick={onLogSession} className="text-teal-600 font-semibold hover:underline">
                + Log Skill Session
              </button>{' '}
              after each therapy session.
            </p>
          ) : (
            <p className="text-[13px] text-slate-400 leading-relaxed">
              No skill goals in the assessment. Complete the assessment to enable skill logging.
            </p>
          )}
        </div>
      ) : view === 'progress' ? (
        <SkillSessionProgressPanel client={client} />
      ) : (
        <div>
          {sortedLogs.map((log, idx) => {
            const prevLog = sortedLogs[idx + 1] ?? null;
            return (
              <SkillSessionCard key={log.id} log={log} prevLog={prevLog} defaultOpen={idx === 0} />
            );
          })}
        </div>
      )}
    </div>
  );
}
