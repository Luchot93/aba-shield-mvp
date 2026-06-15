import React, { useState, useMemo } from 'react';
import ServiceSessionProgressPanel from './ServiceSessionProgressPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function stoStatusLabel(status) {
  if (status === 'met')         return 'Met ✓';
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

function stoStatusColor(status) {
  if (status === 'met')         return 'text-emerald-600';
  if (status === 'in_progress') return 'text-teal-600';
  return 'text-slate-400';
}

// ── Trend arrow ───────────────────────────────────────────────────────────────

function TrendArrow({ current, previous }) {
  if (previous == null || previous === undefined) return null;
  if (current < previous)
    return <span className="text-emerald-600 font-bold" title="Improving vs previous session">↓</span>;
  if (current > previous)
    return <span className="text-red-500 font-bold" title="Worsening vs previous session">↑</span>;
  return <span className="text-slate-400 font-bold" title="Same as previous session">→</span>;
}

// ── SessionLogCard ────────────────────────────────────────────────────────────

function SessionLogCard({ log, prevLog, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);

  // Map behaviorId → previous session frequency for trend arrows
  const prevFreqMap = useMemo(() => {
    if (!prevLog) return {};
    return Object.fromEntries(
      (prevLog.behaviorEntries ?? []).map(e => [e.behaviorId, e.sessionFrequency]),
    );
  }, [prevLog]);

  const newBehaviors = (log.behaviorEntries ?? []).filter(e => e.isNew);
  const existingBehaviors = (log.behaviorEntries ?? []).filter(e => !e.isNew);
  const newSkills = (log.skillEntries ?? []).filter(s => s.isNew);

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
        <span className="text-[12px] text-slate-500 truncate">{log.rbtName}</span>

        {/* New pill badges in collapsed state */}
        {!open && newBehaviors.length > 0 && (
          <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
            {newBehaviors.length} new
          </span>
        )}
        {!open && newSkills.length > 0 && (
          <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
            🚩 {newSkills.length}
          </span>
        )}

        <span className="ml-auto text-[11px] text-slate-400 flex-shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {/* ── Expanded body ── */}
      {open && (
        <div className="px-5 pb-4 space-y-3">

          {/* Existing behaviors */}
          {existingBehaviors.length > 0 && (
            <div className="space-y-2.5">
              {existingBehaviors.map((entry, i) => (
                <div key={entry.behaviorId ?? i} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-800 leading-snug">
                      {entry.behaviorName}
                    </p>
                    <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-0.5">
                      {entry.baselineFrequency != null && (
                        <span className="text-[11px] text-slate-400">
                          Baseline {entry.baselineFrequency}×
                        </span>
                      )}
                      <span className="text-[12px] text-slate-700 font-medium flex items-center gap-1">
                        {entry.sessionFrequency}× today
                        <TrendArrow
                          current={entry.sessionFrequency}
                          previous={prevFreqMap[entry.behaviorId]}
                        />
                      </span>
                      <span
                        className={`text-[11px] font-medium ${stoStatusColor(entry.stoStatus)}`}
                      >
                        STO #{entry.currentStoNumber} — {stoStatusLabel(entry.stoStatus)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New / emerging behaviors */}
          {newBehaviors.length > 0 && (
            <div className="pt-2 border-t border-stone-100 space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500">
                New behaviors observed
              </p>
              {newBehaviors.map((entry, i) => (
                <div key={entry.behaviorId ?? `new-${i}`} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[13px] font-medium text-slate-800 leading-snug">
                        {entry.behaviorName}
                      </p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                        NEW
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-0.5">
                      <span className="text-[12px] text-slate-700 font-medium">
                        {entry.sessionFrequency}× this session
                      </span>
                      {entry.newBehaviorFunction && (
                        <span className="text-[11px] text-slate-400 capitalize">
                          {entry.newBehaviorFunction}
                        </span>
                      )}
                      {entry.newBehaviorSeverity && (
                        <span className="text-[11px] text-slate-400 capitalize">
                          {entry.newBehaviorSeverity}
                        </span>
                      )}
                    </div>
                    {entry.newBehaviorDefinition?.trim() && (
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {entry.newBehaviorDefinition}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Flagged new skills */}
          {newSkills.length > 0 && (
            <div className="pt-2 border-t border-stone-100 space-y-1.5">
              {newSkills.map((skill, i) => (
                <div
                  key={skill.skillId ?? `skill-${i}`}
                  className="flex items-center gap-1.5 text-[12px] text-slate-600"
                >
                  <span className="text-sm leading-none flex-shrink-0">🚩</span>
                  <span>
                    New skill flagged:{' '}
                    <span className="font-medium text-slate-800">{skill.skillName}</span>
                  </span>
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

// ── ServiceSessionLogPanel ────────────────────────────────────────────────────

export default function ServiceSessionLogPanel({ client, onLogSession }) {
  const logs            = client?.service_session_logs ?? [];
  const behaviorTargets =
    client?.assessment_session?.sections?.behavior_targets?.behaviorTargets ?? [];
  const hasBehaviors    = behaviorTargets.length > 0;

  const [view, setView] = useState('timeline');

  // Sort newest first by sessionNumber (most recent first)
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
            Session Log
          </h2>
          {logs.length > 0 ? (
            <p className="text-xs text-slate-400 mt-0.5">
              {logs.length} session{logs.length !== 1 ? 's' : ''} logged · Last: {lastDate}
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">RBT behavior &amp; skill log</p>
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
          onClick={hasBehaviors ? onLogSession : undefined}
          disabled={!hasBehaviors}
          title={
            !hasBehaviors
              ? 'No behavior targets found in the assessment'
              : 'Log a new therapy session'
          }
          className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            hasBehaviors
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
          {hasBehaviors ? (
            <p className="text-[13px] text-slate-400 leading-relaxed">
              No sessions logged yet.{' '}
              <button
                onClick={onLogSession}
                className="text-teal-600 font-semibold hover:underline"
              >
                + Log Session
              </button>{' '}
              after each therapy session.
            </p>
          ) : (
            <p className="text-[13px] text-slate-400 leading-relaxed">
              No behavior targets in the assessment. Complete the assessment to enable session
              logging.
            </p>
          )}
        </div>
      ) : view === 'progress' ? (
        <ServiceSessionProgressPanel client={client} />
      ) : (
        <div>
          {sortedLogs.map((log, idx) => {
            // prevLog = the session chronologically before this one (next in desc-sorted array)
            const prevLog = sortedLogs[idx + 1] ?? null;
            return (
              <SessionLogCard
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
