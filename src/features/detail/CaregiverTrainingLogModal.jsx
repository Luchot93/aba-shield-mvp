import React, { useState, useMemo } from 'react';
import { makeCaregiverTrainingSessionLog } from '../../constants/seedData.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

const STO_STATUS_OPTIONS = [
  { value: 'not_yet_started', label: 'Not started' },
  { value: 'in_progress',     label: 'In progress' },
  { value: 'met',             label: 'Met ✓'        },
];

// Resolve the read-only STO reference label per the 3-tier priority.
function resolveStoLabel(target) {
  const validSteps = (target.stoSteps ?? []).filter(
    s => s.targetPercent !== '' && s.targetPercent != null,
  );
  if (validSteps.length > 0) {
    const s = validSteps[0];
    return `Working toward STO 1: ${s.targetPercent}% within ${s.durationWeeks ?? '?'} wks`;
  }
  if (target.stoPercent != null && target.stoPercent !== '') {
    return `Working toward STO ${target.stoPercent}% — ${target.stoWeeks ?? '?'} wks`;
  }
  return null; // omit entirely
}

// ── CaregiverTrainingLogModal ─────────────────────────────────────────────────

export default function CaregiverTrainingLogModal({ client, onSave, onClose, currentUser }) {
  // ── Source data ──
  const caregiverTargets = useMemo(
    () =>
      client?.assessment_session?.sections?.caregiver_training?.caregiverTrainingTargets ?? [],
    [client],
  );

  // Build a map from the latest existing log for default STO number per target
  const latestEntryMap = useMemo(() => {
    const currentCycle = client?.reauth_cycle ?? 0;
    const logs = (client?.caregiver_training_session_logs ?? [])
      .filter(l => (l.reauth_cycle ?? 0) === currentCycle);
    if (logs.length === 0) return {};
    const latest = [...logs].sort((a, b) => b.sessionNumber - a.sessionNumber)[0];
    return Object.fromEntries(
      (latest?.trainingEntries ?? [])
        .filter(e => e.targetId)
        .map(e => [e.targetId, e]),
    );
  }, [client]);

  // ── SECTION 1 — Date + notes ──
  const [sessionDate, setSessionDate] = useState(todayIso);
  const [notes,       setNotes]       = useState('');

  // ── SECTION 2 — Training entries (one per caregiver target) ──
  const [entries, setEntries] = useState(() =>
    caregiverTargets.map(target => {
      const prev = latestEntryMap[target.id];

      // When no previous log exists for this cycle, advance past any STOs the new
      // baseline already satisfies (acquisition goal: met when baseline >= targetPercent).
      const computedStoNumber = (() => {
        if (prev?.currentStoNumber != null) return prev.currentStoNumber;
        const stoList = target?.stoSteps ?? [];
        if (!stoList.length) return 1;
        const baseline = parseFloat(target.baselinePercent);
        if (isNaN(baseline)) return 1;
        const firstUncompleted = stoList.findIndex(
          step => baseline < parseFloat(step.targetPercent),
        );
        return firstUncompleted === -1 ? stoList.length : firstUncompleted + 1;
      })();

      return {
        targetId:         target.id,
        goalName:         target.goalName ?? '',
        baselinePercent:  target.baselinePercent ?? null,
        sessionPercent:   '',
        stoStatus:        prev?.stoStatus ?? 'in_progress',
        currentStoNumber: computedStoNumber,
      };
    }),
  );

  function updateEntry(idx, field, value) {
    setEntries(prev => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  }

  // ── SECTION 3 — Currently Monitoring (goals carried forward from previous cycle
  //    reassessment as "Monitor Only", OR newly flagged in this cycle's sessions) ──
  const monitoringGoals = useMemo(() => {
    const currentCycle = client?.reauth_cycle ?? 0;
    const planNames = new Set((caregiverTargets ?? []).map(t => t.goalName?.toLowerCase()));
    const seen = new Map(); // lowercase goalName → entry

    // Pre-seed from monitoring_goals (set at "Start Reauthorization" time by the BCBA
    // selecting "Monitor Only" for these items in the reassessment review).
    for (const mg of (client?.monitoring_goals?.ct ?? [])) {
      const key = mg.goalName?.toLowerCase();
      if (!key || planNames.has(key)) continue;
      seen.set(key, {
        goalName:        mg.goalName,
        firstSeenDate:   mg.firstSeenDate,
        baselinePercent: mg.baselinePercent,
        notes:           '',
      });
    }

    // Layer on any newly-flagged goals from this cycle's session logs
    for (const log of (client?.caregiver_training_session_logs ?? []).filter(l => (l.reauth_cycle ?? 0) === currentCycle)) {
      for (const entry of (log.trainingEntries ?? [])) {
        if (!entry.isNew) continue;
        if (entry.targetId) continue; // formal plan target flag — skip
        const key = entry.goalName?.toLowerCase();
        if (!key || planNames.has(key)) continue;
        if (!seen.has(key)) {
          seen.set(key, {
            goalName:        entry.goalName,
            firstSeenDate:   entry.firstSeenDate ?? log.sessionDate,
            baselinePercent: entry.baselinePercent,
            notes:           entry.notes,
          });
        }
      }
    }
    return Array.from(seen.values());
  }, [client, caregiverTargets]);

  const [monitoringEntries, setMonitoringEntries] = useState(() =>
    monitoringGoals.map(g => ({ goalName: g.goalName, sessionPercent: '' })),
  );

  function updateMonitoringEntry(idx, value) {
    setMonitoringEntries(prev => prev.map((e, i) => i === idx ? { ...e, sessionPercent: value } : e));
  }

  // ── SECTION 4 — New goal flag ──
  const [newGoalOpen,        setNewGoalOpen]        = useState(false);
  const [newGoalName,        setNewGoalName]        = useState('');
  const [newGoalBaselinePct, setNewGoalBaselinePct] = useState('');
  const [newGoalNotes,       setNewGoalNotes]       = useState('');
  const newGoalValid = newGoalName.trim() !== '';

  // ── Save guard ──
  const hasAnyPlanPct = entries.some(
    e => e.sessionPercent !== '' && !isNaN(parseFloat(e.sessionPercent)),
  );
  const hasAnyMonitoringPct = monitoringEntries.some(
    e => e.sessionPercent !== '' && !isNaN(parseFloat(e.sessionPercent)),
  );
  // All-mastered edge case: allow saving a maintenance session even with no % entered
  const allGoalsMastered = entries.length > 0 && entries.every(e => e.stoStatus === 'met');
  const canSave = hasAnyPlanPct || hasAnyMonitoringPct || newGoalValid || allGoalsMastered;

  // ── Save handler ──
  function handleSave() {
    if (!canSave) return;

    const trainingEntries = [
      // Plan targets (only include those with a value)
      ...entries
        .filter(e => e.sessionPercent !== '' && !isNaN(parseFloat(e.sessionPercent)))
        .map(e => ({
          targetId:         e.targetId,
          goalName:         e.goalName,
          baselinePercent:  e.baselinePercent,
          sessionPercent:   parseFloat(e.sessionPercent),
          stoStatus:        e.stoStatus,
          currentStoNumber: e.currentStoNumber,
        })),
      // Monitoring entries
      ...monitoringEntries
        .filter(e => e.sessionPercent !== '' && !isNaN(parseFloat(e.sessionPercent)))
        .map(e => {
          const meta = monitoringGoals.find(g => g.goalName === e.goalName) ?? {};
          return {
            targetId:        null,
            goalName:        e.goalName,
            isNew:           false,
            isMonitoring:    true,
            sessionPercent:  parseFloat(e.sessionPercent),
            baselinePercent: meta.baselinePercent ?? null,
            firstSeenDate:   meta.firstSeenDate ?? null,
          };
        }),
      // New flag
      ...(newGoalValid ? [{
        targetId:        null,
        goalName:        newGoalName.trim(),
        isNew:           true,
        firstSeenDate:   sessionDate,
        notes:           newGoalNotes.trim(),
        baselinePercent: newGoalBaselinePct !== '' && !isNaN(parseFloat(newGoalBaselinePct))
          ? parseFloat(newGoalBaselinePct) : null,
      }] : []),
    ];

    const currentCycle = client?.reauth_cycle ?? 0;
    const sessionNumber = (client?.caregiver_training_session_logs ?? [])
      .filter(l => (l.reauth_cycle ?? 0) === currentCycle).length + 1;

    const newLog = {
      ...makeCaregiverTrainingSessionLog(
        client.id,
        currentUser?.id   ?? '',
        currentUser?.name ?? '',
        sessionDate,
        trainingEntries,
        notes.trim(),
      ),
      sessionNumber,
      reauth_cycle: client.reauth_cycle ?? 0,
    };

    onSave(newLog);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90dvh]">

        {/* ── Header ── */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2
              className="text-sm font-semibold text-slate-900"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Log Caregiver Training Session
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{client?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none flex-shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* ── SECTION 1: Date + Notes ── */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                Session Date
              </label>
              <input
                type="date"
                value={sessionDate}
                onChange={e => setSessionDate(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                Session Notes <span className="font-normal normal-case">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Training observations, caregiver participation, context…"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              />
            </div>
          </div>

          {/* ── SECTION 2: Caregiver training goals ── */}
          {caregiverTargets.length > 0 && (() => {
            const indexed        = entries.map((e, idx) => ({ e, idx, target: caregiverTargets[idx] }));
            const activeIndexed  = indexed.filter(({ e }) => e.stoStatus !== 'met');
            const masteredIndexed = indexed.filter(({ e }) => e.stoStatus === 'met');

            const renderGoalCard = ({ e: entry, idx, target }, mastered) => {
              const stoLabel  = !mastered ? resolveStoLabel(target) : null;
              const borderCls = mastered ? 'border-emerald-200' : 'border-stone-200';
              const bgStyle   = mastered ? { background: 'rgba(16,185,129,0.04)' } : {};

              return (
                <div key={entry.targetId ?? idx} className={`border ${borderCls} rounded-xl p-3.5 space-y-2.5`} style={bgStyle}>
                  {/* Goal name */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-semibold text-slate-800 leading-snug">
                      {entry.goalName}
                    </p>
                    {mastered && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                        Met ✓
                      </span>
                    )}
                  </div>

                  {/* ── Clinical context strip ── */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                    {entry.baselinePercent != null && (
                      <span>
                        Baseline{' '}
                        <span className="font-medium text-slate-500">{entry.baselinePercent}%</span>
                      </span>
                    )}

                    {latestEntryMap[entry.targetId] != null && (() => {
                      const prev = latestEntryMap[entry.targetId].sessionPercent;
                      const base = entry.baselinePercent;
                      const color = prev > base ? 'text-emerald-600' : prev < base ? 'text-rose-500' : 'text-slate-500';
                      const arrow = prev > base ? ' ↑' : prev < base ? ' ↓' : ' →';
                      return (
                        <>
                          <span className="text-stone-200">·</span>
                          <span>Last session: <span className={`font-medium ${color}`}>{prev}%{arrow}</span></span>
                        </>
                      );
                    })()}

                    {!mastered && (() => {
                      const stoIdx = (entry.currentStoNumber ?? 1) - 1;
                      const step   = target?.stoSteps?.[stoIdx];
                      if (!step || step.targetPercent == null || step.targetPercent === '') return null;
                      return (
                        <>
                          <span className="text-stone-200">·</span>
                          <span>STO #{entry.currentStoNumber} goal: <span className="font-medium text-amber-600">≥{step.targetPercent}%</span></span>
                        </>
                      );
                    })()}

                    {target?.ltoPercent != null && (
                      <>
                        <span className="text-stone-200">·</span>
                        <span>LTO: <span className="font-medium text-teal-600">{target.ltoPercent}%</span></span>
                      </>
                    )}
                  </div>

                  {/* Session % input */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <label className="text-[11px] text-slate-500 font-medium">% correct this session:</label>
                    <input
                      type="number" min="0" max="100" step="1"
                      value={entry.sessionPercent}
                      onChange={e => updateEntry(idx, 'sessionPercent', e.target.value)}
                      placeholder="—"
                      className={`w-16 border ${mastered ? 'border-emerald-200 focus:ring-emerald-400' : 'border-stone-200 focus:ring-teal-400'} rounded-lg px-2 py-1 text-sm text-slate-800 text-center focus:outline-none focus:ring-2`}
                    />
                    <span className="text-[11px] text-slate-400">%</span>
                    {mastered && <span className="text-[10px] text-emerald-600 ml-1">optional — maintenance data</span>}
                  </div>

                  {/* STO status radios — only for active goals */}
                  {!mastered && (
                    <div className="space-y-1.5">
                      {stoLabel && <p className="text-[11px] text-slate-400">{stoLabel}</p>}
                      <div className="flex items-center gap-2 flex-wrap">
                        {STO_STATUS_OPTIONS.map(opt => (
                          <label key={opt.value} className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`sto_status_${entry.targetId ?? idx}`}
                              value={opt.value}
                              checked={entry.stoStatus === opt.value}
                              onChange={() => updateEntry(idx, 'stoStatus', opt.value)}
                              className="accent-teal-600"
                            />
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
                        ↩ Return to active — goal needs more practice
                      </button>
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Caregiver Training Goals
                </p>

                {activeIndexed.map(item => renderGoalCard(item, false))}

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
                    {masteredIndexed.map(item => renderGoalCard(item, true))}
                  </>
                )}
              </div>
            );
          })()}

          {/* Empty state — no targets in assessment */}
          {caregiverTargets.length === 0 && (
            <p className="text-[13px] text-slate-400 text-center py-4">
              No caregiver training targets found in Section 11 of the assessment.
            </p>
          )}

          {/* ── SECTION 3: Currently Monitoring ── */}
          {monitoringGoals.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-teal-600">
                Currently Monitoring
              </p>
              <p className="text-[11px] text-slate-400">
                Goals flagged in previous sessions — track progress before adding to the plan.
              </p>
              {monitoringGoals.map((goal, idx) => {
                const entry = monitoringEntries[idx] ?? { sessionPercent: '' };
                return (
                  <div key={goal.goalName}
                    className="border border-teal-200 rounded-xl p-3.5 space-y-2"
                    style={{ background: 'rgba(20,184,166,0.04)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-slate-800">{goal.goalName}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">Monitoring</span>
                      {goal.firstSeenDate && (
                        <span className="text-[10px] text-slate-400">First seen {goal.firstSeenDate}</span>
                      )}
                    </div>
                    {goal.baselinePercent != null && (
                      <p className="text-[11px] text-slate-400">
                        Baseline: <span className="font-medium text-slate-500">{goal.baselinePercent}%</span>
                      </p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] text-slate-500 font-medium">% this session:</label>
                      <input
                        type="number" min={0} max={100} step={1}
                        value={entry.sessionPercent}
                        onChange={e => updateMonitoringEntry(idx, e.target.value)}
                        placeholder="—"
                        className="w-16 border border-teal-200 rounded-lg px-2 py-1 text-sm text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                      <span className="text-[11px] text-slate-400">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── SECTION 4: Flag a new caregiver goal ── */}
          <div className="border border-stone-200 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setNewGoalOpen(o => !o)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors">
              <span className="text-[13px] font-semibold text-teal-700">🚩 Flag a new caregiver training goal</span>
              <span className="ml-auto text-[11px] text-slate-400">{newGoalOpen ? '▲' : '▼'}</span>
            </button>
            {newGoalOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-stone-100">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1 mt-3">
                    Goal Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newGoalName}
                    onChange={e => setNewGoalName(e.target.value)}
                    placeholder="e.g. Visual schedule implementation"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                    Observed Baseline <span className="font-normal normal-case">(% correct today)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number" min={0} max={100} step={1}
                      value={newGoalBaselinePct}
                      onChange={e => setNewGoalBaselinePct(e.target.value)}
                      placeholder="—"
                      className="w-20 border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                    <span className="text-[11px] text-slate-400">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                    Clinical Notes <span className="font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={newGoalNotes}
                    onChange={e => setNewGoalNotes(e.target.value)}
                    placeholder="Observations, context, rationale for adding…"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                  />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-stone-100 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            title={!canSave ? 'Enter a % for at least one goal, or flag a new goal to save' : undefined}
            className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
              canSave
                ? 'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            Save Session
          </button>
        </div>
      </div>
    </div>
  );
}
