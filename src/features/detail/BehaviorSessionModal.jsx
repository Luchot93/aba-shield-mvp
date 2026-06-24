import React, { useState, useMemo } from 'react';

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

const FUNCTION_OPTIONS  = ['Automatic', 'Escape', 'Attention', 'Tangible'];
const SEVERITY_OPTIONS  = ['Mild', 'Moderate', 'Severe'];
const STO_STATUS_OPTIONS = [
  { value: 'not_yet_started', label: 'Not started' },
  { value: 'in_progress',     label: 'In progress' },
  { value: 'met',             label: 'Met ✓'        },
];

function functionColor(fn) {
  if (!fn) return 'bg-slate-100 text-slate-500';
  const map = {
    Automatic: 'bg-purple-100 text-purple-700',
    Escape:    'bg-orange-100 text-orange-700',
    Attention: 'bg-blue-100  text-blue-700',
    Tangible:  'bg-teal-100  text-teal-700',
  };
  return map[fn] ?? 'bg-slate-100 text-slate-500';
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BehaviorSessionModal({ client, onSave, onClose, currentUser }) {
  const behaviorTargets = useMemo(
    () => client?.assessment_session?.sections?.behavior_targets?.behaviorTargets ?? [],
    [client],
  );

  // ── STO fallback: promoted behaviors may have stoSteps:[] if promoted before the
  //    stoStructure→stoSteps fix. Look up stoStructure from the completed reassessment.
  const reassessmentStoMap = useMemo(() => {
    const completed = (client?.reassessment_sessions ?? []).filter(s => s.status === 'complete').at(-1);
    if (!completed) return {};
    return Object.fromEntries(
      (completed.newBehaviorSummary ?? []).map(item => [
        item.behaviorName?.toLowerCase(),
        item.stoStructure ?? item.stoSteps ?? [],
      ]),
    );
  }, [client]);

  // ── Latest log entry per official plan behavior (for pre-fill context) ────────
  const latestLogEntryMap = useMemo(() => {
    const currentCycle = client?.reauth_cycle ?? 0;
    const logs = (client?.service_session_logs ?? [])
      .filter(l =>
        (l.sessionType === 'behavior' || (!l.sessionType && (l.behaviorEntries ?? []).length > 0)) &&
        (l.reauth_cycle ?? 0) === currentCycle,
      );
    if (logs.length === 0) return {};
    const latest = [...logs].sort((a, b) => b.sessionNumber - a.sessionNumber)[0];
    return Object.fromEntries(
      (latest?.behaviorEntries ?? [])
        .filter(e => !e.isNew && e.behaviorId)
        .map(e => [e.behaviorId, e]),
    );
  }, [client]);

  // ── Behaviors flagged as new in past logs but NOT yet in the official plan ────
  // These are shown in a "Currently monitoring" section so RBTs can keep tracking them.
  const monitoringBehaviors = useMemo(() => {
    const currentCycle = client?.reauth_cycle ?? 0;
    const planNames = new Set(behaviorTargets.map(bt => bt.behaviorName?.toLowerCase()));
    const allLogs = (client?.service_session_logs ?? [])
      .filter(l =>
        (l.sessionType === 'behavior' || (!l.sessionType && (l.behaviorEntries ?? []).length > 0)) &&
        (l.reauth_cycle ?? 0) === currentCycle,
      )
      .sort((a, b) => a.sessionNumber - b.sessionNumber);

    const seen = new Map(); // behaviorName → { firstSeenDate, function, severity, lastFrequency }
    for (const log of allLogs) {
      for (const entry of (log.behaviorEntries ?? [])) {
        if (!entry.isNew) continue;
        const key = entry.behaviorName?.toLowerCase();
        if (!key || planNames.has(key)) continue;
        if (!seen.has(key)) {
          seen.set(key, {
            behaviorName:          entry.behaviorName,
            firstSeenDate:         entry.firstSeenDate,
            newBehaviorFunction:   entry.newBehaviorFunction  || '',
            newBehaviorSeverity:   entry.newBehaviorSeverity  || '',
            newBehaviorDefinition: entry.newBehaviorDefinition || '',
            baselineFrequency:     entry.sessionFrequency ?? null,
            lastFrequency:         entry.sessionFrequency ?? null,
          });
        } else {
          // Update lastFrequency with the most recent flag entry
          seen.get(key).lastFrequency = entry.sessionFrequency ?? seen.get(key).lastFrequency;
        }
      }
      // Also pick up monitoring entries from later logs
      for (const entry of (log.behaviorEntries ?? [])) {
        if (!entry.isMonitoring) continue;
        const key = entry.behaviorName?.toLowerCase();
        if (!key || !seen.has(key)) continue;
        seen.get(key).lastFrequency = entry.sessionFrequency ?? seen.get(key).lastFrequency;
      }
    }
    return Array.from(seen.values());
  }, [client, behaviorTargets]);

  // ── State ─────────────────────────────────────────────────────────────────────
  const [sessionDate, setSessionDate] = useState(todayIso);
  const [notes,       setNotes]       = useState('');

  const [entries, setEntries] = useState(() =>
    behaviorTargets.map(bt => {
      const prev = latestLogEntryMap[bt.id];

      return {
        behaviorId:            bt.id,
        behaviorName:          bt.behaviorName,
        baselineFrequency:     (() => { const v = parseFloat(bt.baselineFrequency); return !isNaN(v) ? Math.round(v) : null; })(),
        sessionFrequency:      '',
        currentStoNumber:      prev?.currentStoNumber ?? 1,
        stoStatus:             prev?.stoStatus ?? 'in_progress',
        isNew:                 false,
        newBehaviorDefinition: '',
        newBehaviorFunction:   '',
        newBehaviorSeverity:   '',
        firstSeenDate:         null,
      };
    }),
  );

  // One monitoring entry per flagged behavior — just a frequency input
  const [monitoringEntries, setMonitoringEntries] = useState(() =>
    monitoringBehaviors.map(b => ({ ...b, sessionFrequency: '' })),
  );

  const [defOpen, setDefOpen] = useState(new Set());

  function updateEntry(idx, field, value) {
    setEntries(prev => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  }

  function updateMonitoringEntry(idx, value) {
    setMonitoringEntries(prev => prev.map((e, i) => (i === idx ? { ...e, sessionFrequency: value } : e)));
  }

  function toggleDef(id) {
    setDefOpen(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const [newBehOpen, setNewBehOpen] = useState(false);
  const [newBehName, setNewBehName] = useState('');
  const [newBehFreq, setNewBehFreq] = useState('');
  const [newBehFn,   setNewBehFn]   = useState('');
  const [newBehSev,  setNewBehSev]  = useState('');
  const [newBehDef,  setNewBehDef]  = useState('');

  const newBehValid = newBehName.trim() !== '' && newBehFreq !== '' && parseFloat(newBehFreq) >= 0;

  const hasAnyPlanFreq       = entries.some(e => e.sessionFrequency !== '' && !isNaN(parseFloat(e.sessionFrequency)));
  const hasAnyMonitoringFreq = monitoringEntries.some(e => e.sessionFrequency !== '' && !isNaN(parseFloat(e.sessionFrequency)));
  // All-mastered edge case: allow saving a maintenance session even with no frequency entered
  const allPlanMastered      = entries.length > 0 && entries.every(e => e.stoStatus === 'met');
  const canSave = hasAnyPlanFreq || hasAnyMonitoringFreq || allPlanMastered;

  function handleSave() {
    if (!canSave) return;

    const behaviorEntries = [
      // Official plan targets
      ...entries
        .filter(e => e.sessionFrequency !== '' && !isNaN(parseFloat(e.sessionFrequency)))
        .map(e => {
          // Resolve STO list (same fallback as display)
          const bt = behaviorTargets.find(b => b.id === e.behaviorId);
          const stoList = (bt?.stoSteps?.length > 0)
            ? bt.stoSteps
            : (reassessmentStoMap[e.behaviorName?.toLowerCase()] ?? []);
          const currentStoIdx = (e.currentStoNumber ?? 1) - 1;
          const currentSto    = stoList[currentStoIdx];
          const sessionFreq   = parseFloat(e.sessionFrequency);
          const stoTarget     = currentSto ? parseFloat(currentSto.targetFrequency) : null;

          // Auto-advance to next STO when session frequency meets current STO target
          // (frequency-based, independent of the "Met ✓" radio which is for LTO mastery only)
          const savedStoNumber = (
            stoTarget != null && !isNaN(stoTarget) && !isNaN(sessionFreq) &&
            sessionFreq <= stoTarget &&
            (e.currentStoNumber ?? 1) < stoList.length
          )
            ? (e.currentStoNumber ?? 1) + 1
            : (e.currentStoNumber ?? 1);

          return {
            behaviorId:            e.behaviorId,
            behaviorName:          e.behaviorName,
            isNew:                 false,
            isMonitoring:          false,
            baselineFrequency:     e.baselineFrequency,
            sessionFrequency:      sessionFreq,
            currentStoNumber:      savedStoNumber,
            stoStatus:             e.stoStatus,
            newBehaviorDefinition: '',
            newBehaviorFunction:   '',
            newBehaviorSeverity:   '',
            firstSeenDate:         null,
          };
        }),
      // Monitoring behaviors (flagged, not yet in plan)
      ...monitoringEntries
        .filter(e => e.sessionFrequency !== '' && !isNaN(parseFloat(e.sessionFrequency)))
        .map(e => ({
          behaviorId:            null,
          behaviorName:          e.behaviorName,
          isNew:                 false,
          isMonitoring:          true,
          baselineFrequency:     e.baselineFrequency,
          sessionFrequency:      parseFloat(e.sessionFrequency),
          currentStoNumber:      null,
          stoStatus:             null,
          newBehaviorDefinition: e.newBehaviorDefinition,
          newBehaviorFunction:   e.newBehaviorFunction,
          newBehaviorSeverity:   e.newBehaviorSeverity,
          firstSeenDate:         e.firstSeenDate,
        })),
      // Newly flagged this session
      ...(newBehValid
        ? [{
            behaviorId:            null,
            behaviorName:          newBehName.trim(),
            isNew:                 true,
            isMonitoring:          false,
            baselineFrequency:     null,
            sessionFrequency:      parseFloat(newBehFreq),
            currentStoNumber:      1,
            stoStatus:             'in_progress',
            newBehaviorDefinition: newBehDef.trim(),
            newBehaviorFunction:   newBehFn.toLowerCase(),
            newBehaviorSeverity:   newBehSev.toLowerCase(),
            firstSeenDate:         sessionDate,
          }]
        : []),
    ];

    const currentCycle = client?.reauth_cycle ?? 0;
    const behaviorLogs = (client?.service_session_logs ?? [])
      .filter(l =>
        (l.sessionType === 'behavior' || (!l.sessionType && (l.behaviorEntries ?? []).length > 0)) &&
        (l.reauth_cycle ?? 0) === currentCycle,
      );
    const sessionNumber = behaviorLogs.length + 1;

    const newLog = {
      id:             `slog_${client.id}_${Date.now()}`,
      clientId:       client.id,
      rbtId:          currentUser?.id   ?? '',
      rbtName:        currentUser?.name ?? '',
      sessionDate,
      sessionNumber,
      sessionType:    'behavior',
      notes:          notes.trim(),
      behaviorEntries,
      skillEntries:   [],
      reauth_cycle:   client.reauth_cycle ?? 0,
      createdAt:      new Date().toISOString(),
    };

    onSave(newLog);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90dvh]">

        <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>
              Log Behavior Session
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{client?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none flex-shrink-0" aria-label="Close">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* ── Date + Notes ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Session Date</label>
              <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                Session Notes <span className="font-normal normal-case">(optional)</span>
              </label>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="General observations, context, parent feedback…"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
            </div>
          </div>

          {/* ── Behaviors from treatment plan ─────────────────────────────────── */}
          {behaviorTargets.length > 0 && (() => {
            const indexed        = entries.map((e, idx) => ({ e, idx, bt: behaviorTargets[idx] }));
            const activeIndexed  = indexed.filter(({ e }) => e.stoStatus !== 'met');
            const masteredIndexed = indexed.filter(({ e }) => e.stoStatus === 'met');

            const renderBehaviorCard = ({ e: entry, idx, bt }, mastered) => {
              const isDefShown = defOpen.has(entry.behaviorId);
              const borderCls  = mastered ? 'border-emerald-200' : 'border-stone-200';
              const bgStyle    = mastered ? { background: 'rgba(16,185,129,0.04)' } : {};

              return (
                <div key={entry.behaviorId} className={`border ${borderCls} rounded-xl p-3.5 space-y-2.5`} style={bgStyle}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-slate-800 leading-snug">{entry.behaviorName}</span>
                    {mastered && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                        Met ✓
                      </span>
                    )}
                    {bt?.hypothesizedFunction && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${functionColor(bt.hypothesizedFunction)}`}>
                        {bt.hypothesizedFunction}
                      </span>
                    )}
                  </div>

                  {bt?.operationalDefinition && (
                    <div>
                      <button type="button" onClick={() => toggleDef(entry.behaviorId)} className="text-[11px] text-teal-600 hover:underline">
                        {isDefShown ? '▾ Hide definition' : '▸ Show definition'}
                      </button>
                      {isDefShown && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{bt.operationalDefinition}</p>}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                    {entry.baselineFrequency != null && (
                      <span>Baseline <span className="font-medium text-slate-500">{entry.baselineFrequency}×</span></span>
                    )}
                    {latestLogEntryMap[entry.behaviorId] != null && (() => {
                      const prev = latestLogEntryMap[entry.behaviorId].sessionFrequency;
                      const base = entry.baselineFrequency;
                      const color = prev < base ? 'text-emerald-600' : prev > base ? 'text-rose-500' : 'text-slate-500';
                      const arrow = prev < base ? ' ↓' : prev > base ? ' ↑' : ' →';
                      return (
                        <>
                          <span className="text-stone-200">·</span>
                          <span>Last session: <span className={`font-medium ${color}`}>{prev}×{arrow}</span></span>
                        </>
                      );
                    })()}
                    {!mastered && (() => {
                      const stoIdx = (entry.currentStoNumber ?? 1) - 1;
                      // Promoted behaviors may have stoSteps:[] if promoted before the fix —
                      // fall back to the completed reassessment's stoStructure for that behavior.
                      const stoList = (bt?.stoSteps?.length > 0)
                        ? bt.stoSteps
                        : (reassessmentStoMap[entry.behaviorName?.toLowerCase()] ?? []);
                      const step = stoList[stoIdx];
                      if (!step || step.targetFrequency == null || step.targetFrequency === '') return null;
                      return (
                        <>
                          <span className="text-stone-200">·</span>
                          <span>STO #{entry.currentStoNumber} goal: <span className="font-medium text-amber-600">≤{step.targetFrequency}×</span></span>
                        </>
                      );
                    })()}
                    {bt?.targetFrequency != null && bt.targetFrequency !== '' && (
                      <>
                        <span className="text-stone-200">·</span>
                        <span>Mastery: <span className="font-medium text-teal-600">{bt.targetFrequency}×</span></span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-1">
                    <label className="text-[11px] text-slate-500 font-medium">This session:</label>
                    <input type="number" min="0" step="1" value={entry.sessionFrequency}
                      onChange={e => updateEntry(idx, 'sessionFrequency', e.target.value)}
                      placeholder="—"
                      className={`w-16 border ${mastered ? 'border-emerald-200 focus:ring-emerald-400' : 'border-stone-200 focus:ring-teal-400'} rounded-lg px-2 py-1 text-sm text-slate-800 text-center focus:outline-none focus:ring-2`} />
                    <span className="text-[11px] text-slate-400">×</span>
                    {mastered && <span className="text-[10px] text-emerald-600 ml-1">optional — maintenance data</span>}
                  </div>

                  {/* STO status radios — only for active goals */}
                  {!mastered && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[11px] text-slate-400 flex-shrink-0">Working on STO #{entry.currentStoNumber}</span>
                        <span className="text-[11px] text-slate-300 flex-shrink-0">·</span>
                        <span className="text-[11px] text-slate-400 flex-shrink-0">Status:</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {STO_STATUS_OPTIONS.map(opt => (
                          <label key={opt.value} className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name={`sto_status_${entry.behaviorId}`} value={opt.value}
                              checked={entry.stoStatus === opt.value}
                              onChange={() => updateEntry(idx, 'stoStatus', opt.value)}
                              className="accent-teal-600" />
                            <span className="text-[12px] text-slate-700">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Return to active — mastered goals only */}
                  {mastered && (
                    <div className="pt-1 border-t border-emerald-100">
                      <button
                        type="button"
                        onClick={() => updateEntry(idx, 'stoStatus', 'in_progress')}
                        className="text-[11px] text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
                      >
                        ↩ Return to active — behavior re-emerged or needs more data
                      </button>
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Behaviors from Treatment Plan
                </p>

                {activeIndexed.map(item => renderBehaviorCard(item, false))}

                {masteredIndexed.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1 border-t border-emerald-200" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 whitespace-nowrap">
                        Maintenance — Mastered Goals
                      </span>
                      <div className="flex-1 border-t border-emerald-200" />
                    </div>
                    <p className="text-[11px] text-emerald-700 -mt-1">
                      Mastery criteria met. Continue collecting data to document maintenance across the auth period.
                    </p>
                    {masteredIndexed.map(item => renderBehaviorCard(item, true))}
                  </>
                )}
              </div>
            );
          })()}

          {/* ── Currently monitoring (flagged but not yet in plan) ──────────────── */}
          {monitoringEntries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-orange-500">
                  Currently Monitoring
                </p>
                <span className="text-[10px] text-slate-400 font-normal normal-case">
                  — flagged, not yet in treatment plan
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed -mt-1">
                Log frequency each session to build the data record for the BCBA's reassessment decision.
              </p>

              {monitoringEntries.map((entry, idx) => (
                <div key={entry.behaviorName}
                  className="border border-orange-200 rounded-xl p-3.5 space-y-2.5"
                  style={{ background: 'rgba(249,115,22,0.025)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-slate-800 leading-snug">{entry.behaviorName}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                      Monitoring
                    </span>
                    {entry.newBehaviorFunction && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${functionColor(entry.newBehaviorFunction)}`}>
                        {entry.newBehaviorFunction.charAt(0).toUpperCase() + entry.newBehaviorFunction.slice(1)}
                      </span>
                    )}
                    {entry.newBehaviorSeverity && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">
                        {entry.newBehaviorSeverity}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                    <span>First seen {fmtDate(entry.firstSeenDate)}</span>
                    {entry.baselineFrequency != null && (
                      <>
                        <span className="text-stone-200">·</span>
                        <span>Baseline <span className="font-medium text-slate-500">{entry.baselineFrequency}×</span></span>
                      </>
                    )}
                    {entry.lastFrequency != null && entry.lastFrequency !== entry.baselineFrequency && (
                      <>
                        <span className="text-stone-200">·</span>
                        <span>Last logged <span className="font-medium text-slate-500">{entry.lastFrequency}×</span></span>
                      </>
                    )}
                  </div>

                  {entry.newBehaviorDefinition && (
                    <p className="text-[11px] text-slate-500 leading-relaxed italic">{entry.newBehaviorDefinition}</p>
                  )}

                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] text-slate-500 font-medium">This session:</label>
                    <input type="number" min="0" step="1" value={entry.sessionFrequency}
                      onChange={e => updateMonitoringEntry(idx, e.target.value)}
                      placeholder="—"
                      className="w-16 border border-orange-200 rounded-lg px-2 py-1 text-sm text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    <span className="text-[11px] text-slate-400">×</span>
                    <span className="text-[10px] text-slate-400 ml-1">frequency only · no protocol yet</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Flag a new behavior this session ─────────────────────────────── */}
          <div className="border border-stone-200 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setNewBehOpen(o => !o)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors">
              <span className="text-[13px] font-semibold text-orange-600">+ I observed a new behavior this session</span>
              <span className="ml-auto text-[11px] text-slate-400">{newBehOpen ? '▲' : '▼'}</span>
            </button>

            {newBehOpen && (
              <div className="px-4 pb-4 border-t border-stone-100 space-y-3 pt-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                    Behavior Name <span className="text-red-400">*</span>
                  </label>
                  <input type="text" value={newBehName} onChange={e => setNewBehName(e.target.value)}
                    placeholder="e.g. Throwing objects"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                      Frequency <span className="text-red-400">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input type="number" min="0" step="1" value={newBehFreq} onChange={e => setNewBehFreq(e.target.value)}
                        placeholder="0"
                        className="w-20 border border-stone-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-orange-400" />
                      <span className="text-[11px] text-slate-400">× this session</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Function</label>
                    <select value={newBehFn} onChange={e => setNewBehFn(e.target.value)}
                      className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400">
                      <option value="">— select —</option>
                      {FUNCTION_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Severity</label>
                    <select value={newBehSev} onChange={e => setNewBehSev(e.target.value)}
                      className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400">
                      <option value="">— select —</option>
                      {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                    Description / Definition <span className="font-normal normal-case">(optional)</span>
                  </label>
                  <textarea rows={2} value={newBehDef} onChange={e => setNewBehDef(e.target.value)}
                    placeholder="Describe topography, antecedents, context…"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
                </div>

                {newBehValid && (
                  <div className="flex items-center gap-1.5 text-[11px] text-orange-600">
                    <span>✓</span>
                    <span>New behavior will be flagged: <span className="font-semibold">{newBehName.trim()}</span>{newBehFreq && ` — ${newBehFreq}×`}</span>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        <div className="px-5 py-4 border-t border-stone-100 flex items-center justify-end gap-2 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={!canSave}
            title={!canSave ? 'Enter at least one behavior frequency to save' : undefined}
            className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
              canSave ? 'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}>
            Save Session
          </button>
        </div>
      </div>
    </div>
  );
}
