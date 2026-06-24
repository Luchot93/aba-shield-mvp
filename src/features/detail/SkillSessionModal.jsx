import React, { useState, useMemo } from 'react';

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

const STO_STATUS_OPTIONS = [
  { value: 'not_yet_started', label: 'Not started' },
  { value: 'in_progress',     label: 'In progress' },
  { value: 'met',             label: 'Met ✓'        },
];

export default function SkillSessionModal({ client, onSave, onClose, currentUser }) {
  const skillGoals = useMemo(
    () => client?.assessment_session?.sections?.skill_acquisitions?.skillGoals ?? [],
    [client],
  );

  // Pre-fill STO state from most recent skill-type log per skill — current cycle only
  const latestSkillLogMap = useMemo(() => {
    const currentCycle = client?.reauth_cycle ?? 0;
    const logs = (client?.service_session_logs ?? [])
      .filter(l =>
        (l.sessionType === 'skill' || (!l.sessionType && (l.skillEntries ?? []).some(s => !s.isNew))) &&
        (l.reauth_cycle ?? 0) === currentCycle,
      );
    const sorted = [...logs].sort((a, b) => b.sessionNumber - a.sessionNumber);
    const result = {};
    for (const log of sorted) {
      for (const se of (log.skillEntries ?? [])) {
        if (!se.isNew && se.skillId && !result[se.skillId]) {
          result[se.skillId] = se;
        }
      }
    }
    return result;
  }, [client]);

  // Previously-flagged skills not yet in the formal plan — current cycle only
  const monitoringSkills = useMemo(() => {
    const currentCycle = client?.reauth_cycle ?? 0;
    const planSkillNames = new Set((skillGoals ?? []).map(g => g.targetSkill?.toLowerCase()));
    const seen = new Map();
    for (const log of (client?.service_session_logs ?? []).filter(l => (l.reauth_cycle ?? 0) === currentCycle)) {
      for (const entry of (log.skillEntries ?? [])) {
        if (!entry.isNew) continue;
        if (planSkillNames.has(entry.skillName?.toLowerCase())) continue;
        if (!seen.has(entry.skillName)) {
          seen.set(entry.skillName, {
            skillName:       entry.skillName,
            firstSeenDate:   entry.firstSeenDate,
            baselinePercent: entry.baselinePercent,
            rbtNotes:        entry.notes,
          });
        }
      }
    }
    return Array.from(seen.values());
  }, [client, skillGoals]);

  const [monitoringEntries, setMonitoringEntries] = useState(() =>
    monitoringSkills.map(s => ({ skillName: s.skillName, accuracyPercent: '' })),
  );

  function updateMonitoringEntry(idx, value) {
    setMonitoringEntries(prev => prev.map((e, i) => i === idx ? { ...e, accuracyPercent: value } : e));
  }

  const [sessionDate, setSessionDate] = useState(todayIso);
  const [notes,       setNotes]       = useState('');

  const [skillProgressEntries, setSkillProgressEntries] = useState(() =>
    skillGoals.map(g => {
      const prev = latestSkillLogMap[g.id];
      return {
        skillId:          g.id,
        skillName:        g.targetSkill,
        isNew:            false,
        accuracyPercent:  '',
        currentStoNumber: prev?.currentStoNumber ?? 1,
        stoStatus:        prev?.stoStatus ?? 'in_progress',
      };
    }),
  );

  function updateSkillEntry(idx, field, value) {
    setSkillProgressEntries(prev => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  }

  const [newSkillOpen,           setNewSkillOpen]           = useState(false);
  const [newSkillName,           setNewSkillName]           = useState('');
  const [newSkillBaselinePercent,setNewSkillBaselinePercent]= useState('');
  const [newSkillNotes,          setNewSkillNotes]          = useState('');

  const newSkillValid = newSkillName.trim() !== '';

  const hasAnyAccuracy = skillProgressEntries.some(
    e => e.accuracyPercent !== '' && !isNaN(parseFloat(e.accuracyPercent)),
  );
  const hasAnyMonitoringAccuracy = monitoringEntries.some(
    e => e.accuracyPercent !== '' && !isNaN(parseFloat(e.accuracyPercent)),
  );
  // All-mastered edge case: allow saving a maintenance session even with no accuracy entered
  const allSkillsMastered = skillProgressEntries.length > 0 && skillProgressEntries.every(e => e.stoStatus === 'met');
  const canSave = hasAnyAccuracy || hasAnyMonitoringAccuracy || newSkillValid || allSkillsMastered;

  function handleSave() {
    if (!canSave) return;

    const skillEntries = [
      ...skillProgressEntries
        .filter(e => e.accuracyPercent !== '' && !isNaN(parseFloat(e.accuracyPercent)))
        .map(e => ({
          skillId:          e.skillId,
          skillName:        e.skillName,
          isNew:            false,
          accuracyPercent:  parseFloat(e.accuracyPercent),
          currentStoNumber: e.currentStoNumber,
          stoStatus:        e.stoStatus,
        })),
      ...monitoringEntries
        .filter(e => e.accuracyPercent !== '' && !isNaN(parseFloat(e.accuracyPercent)))
        .map(e => {
          const meta = monitoringSkills.find(s => s.skillName === e.skillName) ?? {};
          return {
            skillId:         null,
            skillName:       e.skillName,
            isNew:           false,
            isMonitoring:    true,
            accuracyPercent: parseFloat(e.accuracyPercent),
            baselinePercent: meta.baselinePercent ?? null,
            firstSeenDate:   meta.firstSeenDate ?? null,
          };
        }),
      ...(newSkillValid
        ? [{
            skillId:        null,
            skillName:      newSkillName.trim(),
            isNew:          true,
            firstSeenDate:  sessionDate,
            notes:          newSkillNotes.trim(),
            baselinePercent: newSkillBaselinePercent !== '' && !isNaN(parseFloat(newSkillBaselinePercent))
              ? parseFloat(newSkillBaselinePercent) : null,
          }]
        : []),
    ];

    const currentCycle = client?.reauth_cycle ?? 0;
    const skillLogs = (client?.service_session_logs ?? [])
      .filter(l =>
        (l.sessionType === 'skill' || (!l.sessionType && (l.skillEntries ?? []).some(s => !s.isNew))) &&
        (l.reauth_cycle ?? 0) === currentCycle,
      );
    const sessionNumber = skillLogs.length + 1;

    const newLog = {
      id:             `sklog_${client.id}_${Date.now()}`,
      clientId:       client.id,
      rbtId:          currentUser?.id   ?? '',
      rbtName:        currentUser?.name ?? '',
      sessionDate,
      sessionNumber,
      sessionType:    'skill',
      notes:          notes.trim(),
      behaviorEntries: [],
      skillEntries,
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
              Log Skill Session
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{client?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none flex-shrink-0" aria-label="Close">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Date + Notes */}
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

          {/* Skill Acquisition Targets */}
          {skillGoals.length > 0 && (() => {
            const indexed        = skillProgressEntries.map((e, idx) => ({ e, idx, g: skillGoals[idx] }));
            const activeIndexed  = indexed.filter(({ e }) => e.stoStatus !== 'met');
            const masteredIndexed = indexed.filter(({ e }) => e.stoStatus === 'met');

            const renderSkillCard = ({ e: entry, idx, g }, mastered) => {
              const stoIdx  = (entry.currentStoNumber ?? 1) - 1;
              const stoStep = g?.stoSteps?.[stoIdx];
              const prevEntry = latestSkillLogMap[entry.skillId];
              const borderCls = mastered ? 'border-emerald-200' : 'border-stone-200';
              const bgStyle   = mastered ? { background: 'rgba(16,185,129,0.04)' } : {};

              return (
                <div key={entry.skillId} className={`border ${borderCls} rounded-xl p-3.5 space-y-2.5`} style={bgStyle}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-slate-800 leading-snug">{entry.skillName}</span>
                    {mastered && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                        Met ✓
                      </span>
                    )}
                    {g?.domain && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
                        {g.domain}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                    {g?.baselinePercent != null && (
                      <span>Baseline <span className="font-medium text-slate-500">{Math.round(Number(g.baselinePercent))}%</span></span>
                    )}
                    {prevEntry?.accuracyPercent != null && (() => {
                      const prev  = prevEntry.accuracyPercent;
                      const base  = Math.round(Number(g?.baselinePercent ?? 0));
                      const color = prev > base ? 'text-emerald-600' : prev < base ? 'text-rose-500' : 'text-slate-500';
                      const arrow = prev > base ? ' ↑' : prev < base ? ' ↓' : ' →';
                      return (
                        <>
                          <span className="text-stone-200">·</span>
                          <span>Last session: <span className={`font-medium ${color}`}>{prev}%{arrow}</span></span>
                        </>
                      );
                    })()}
                    {!mastered && stoStep?.targetPercent != null && stoStep.targetPercent !== '' && (
                      <>
                        <span className="text-stone-200">·</span>
                        <span>STO #{entry.currentStoNumber} goal: <span className="font-medium text-amber-600">{stoStep.targetPercent}%</span></span>
                      </>
                    )}
                    {g?.masteryCriteriaPercent != null && g.masteryCriteriaPercent !== '' && (
                      <>
                        <span className="text-stone-200">·</span>
                        <span>Mastery: <span className="font-medium text-teal-600">{g.masteryCriteriaPercent}%</span></span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-1">
                    <label className="text-[11px] text-slate-500 font-medium">Accuracy this session:</label>
                    <input type="number" min="0" max="100" step="1" value={entry.accuracyPercent}
                      onChange={e => updateSkillEntry(idx, 'accuracyPercent', e.target.value)}
                      placeholder="—"
                      className={`w-16 border ${mastered ? 'border-emerald-200 focus:ring-emerald-400' : 'border-stone-200 focus:ring-teal-400'} rounded-lg px-2 py-1 text-sm text-slate-800 text-center focus:outline-none focus:ring-2`} />
                    <span className="text-[11px] text-slate-400">%</span>
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
                            <input type="radio" name={`skill_sto_${entry.skillId}`} value={opt.value}
                              checked={entry.stoStatus === opt.value}
                              onChange={() => updateSkillEntry(idx, 'stoStatus', opt.value)}
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
                        onClick={() => updateSkillEntry(idx, 'stoStatus', 'in_progress')}
                        className="text-[11px] text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
                      >
                        ↩ Return to active — skill regressed or needs more data
                      </button>
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Skill Acquisition Targets
                </p>

                {activeIndexed.map(item => renderSkillCard(item, false))}

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
                    {masteredIndexed.map(item => renderSkillCard(item, true))}
                  </>
                )}
              </div>
            );
          })()}

          {/* Currently Monitoring — emerging skills being tracked */}
          {monitoringSkills.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-teal-600">
                Currently Monitoring
              </p>
              <p className="text-[11px] text-slate-400">
                Skills flagged in previous sessions — track accuracy before adding to the plan.
              </p>
              {monitoringSkills.map((skill, idx) => {
                const entry = monitoringEntries[idx] ?? { accuracyPercent: '' };
                return (
                  <div key={skill.skillName}
                    className="border border-teal-200 rounded-xl p-3.5 space-y-2"
                    style={{ background: 'rgba(20,184,166,0.04)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-slate-800">{skill.skillName}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">Monitoring</span>
                      {skill.firstSeenDate && (
                        <span className="text-[10px] text-slate-400">First seen {skill.firstSeenDate}</span>
                      )}
                    </div>
                    {skill.baselinePercent != null && (
                      <p className="text-[11px] text-slate-400">Baseline: <span className="font-medium text-slate-500">{skill.baselinePercent}%</span></p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] text-slate-500 font-medium">Accuracy this session:</label>
                      <input
                        type="number" min={0} max={100} step={1}
                        value={entry.accuracyPercent}
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

          {/* Flag a new skill */}
          <div className="border border-stone-200 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setNewSkillOpen(o => !o)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors">
              <span className="text-[13px] font-semibold text-teal-700">🚩 Flag a new skill or replacement behavior</span>
              <span className="ml-auto text-[11px] text-slate-400">{newSkillOpen ? '▲' : '▼'}</span>
            </button>

            {newSkillOpen && (
              <div className="px-4 pb-4 border-t border-stone-100 space-y-3 pt-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                    Skill / Replacement Behavior Name <span className="text-red-400">*</span>
                  </label>
                  <input type="text" value={newSkillName} onChange={e => setNewSkillName(e.target.value)}
                    placeholder="e.g. Used PECS card to request break independently"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                    Baseline % <span className="font-normal normal-case">(optional — first observed accuracy)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={100} step={1}
                      value={newSkillBaselinePercent}
                      onChange={e => setNewSkillBaselinePercent(e.target.value)}
                      placeholder="0"
                      className="w-20 border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-teal-400" />
                    <span className="text-sm text-slate-400">%</span>
                    <span className="text-[11px] text-slate-400">accuracy observed this session</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                    Notes <span className="font-normal normal-case">(optional)</span>
                  </label>
                  <textarea rows={2} value={newSkillNotes} onChange={e => setNewSkillNotes(e.target.value)}
                    placeholder="Context, frequency, conditions…"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
                </div>
                {newSkillValid && (
                  <div className="flex items-center gap-1.5 text-[11px] text-teal-700">
                    <span>🚩</span>
                    <span>Skill will be flagged: <span className="font-semibold">{newSkillName.trim()}</span></span>
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
            title={!canSave ? 'Enter at least one accuracy % or flag a new skill to save' : undefined}
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
