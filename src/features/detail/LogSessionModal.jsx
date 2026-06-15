import React, { useState, useMemo } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── LogSessionModal ───────────────────────────────────────────────────────────

export default function LogSessionModal({ client, onSave, onClose, currentUser }) {
  // ── Source data ──
  const behaviorTargets = useMemo(
    () =>
      client?.assessment_session?.sections?.behavior_targets?.behaviorTargets ?? [],
    [client],
  );

  const skillGoals = useMemo(
    () =>
      client?.assessment_session?.sections?.skill_acquisitions?.skillGoals ?? [],
    [client],
  );

  // Build a map from the latest existing log for default STO number per behavior
  const latestLogEntryMap = useMemo(() => {
    const logs = client?.service_session_logs ?? [];
    if (logs.length === 0) return {};
    const latest = [...logs].sort((a, b) => b.sessionNumber - a.sessionNumber)[0];
    return Object.fromEntries(
      (latest?.behaviorEntries ?? [])
        .filter(e => !e.isNew && e.behaviorId)
        .map(e => [e.behaviorId, e]),
    );
  }, [client]);

  // ── SECTION 1 — Date + notes ──
  const [sessionDate, setSessionDate] = useState(todayIso);
  const [notes,       setNotes]       = useState('');

  // ── SECTION 2 — Behavior entries (one row per treatment-plan target) ──
  const [entries, setEntries] = useState(() =>
    behaviorTargets.map(bt => {
      const prev = latestLogEntryMap[bt.id];
      return {
        behaviorId:       bt.id,
        behaviorName:     bt.behaviorName,
        baselineFrequency: parseFloat(bt.baselineFrequency) || null,
        sessionFrequency: '',
        currentStoNumber: prev?.currentStoNumber ?? 1,
        stoStatus:        'in_progress',
        isNew:            false,
        // new-behavior fields unused for plan targets
        newBehaviorDefinition: '',
        newBehaviorFunction:   '',
        newBehaviorSeverity:   '',
        firstSeenDate:         null,
      };
    }),
  );

  const [defOpen, setDefOpen] = useState(new Set()); // which behavior defs are expanded

  function updateEntry(idx, field, value) {
    setEntries(prev => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  }

  function toggleDef(id) {
    setDefOpen(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── SECTION 3 — New behavior (collapsed by default) ──
  const [newBehOpen,   setNewBehOpen]   = useState(false);
  const [newBehName,   setNewBehName]   = useState('');
  const [newBehFreq,   setNewBehFreq]   = useState('');
  const [newBehFn,     setNewBehFn]     = useState('');
  const [newBehSev,    setNewBehSev]    = useState('');
  const [newBehDef,    setNewBehDef]    = useState('');

  const newBehValid = newBehName.trim() !== '' && newBehFreq !== '' && parseFloat(newBehFreq) >= 0;

  // ── SECTION 4 — New skill flag (collapsed by default) ──
  const [newSkillOpen,  setNewSkillOpen]  = useState(false);
  const [newSkillName,  setNewSkillName]  = useState('');
  const [newSkillNotes, setNewSkillNotes] = useState('');

  const newSkillValid = newSkillName.trim() !== '';

  // ── Save guard ──
  const hasAnyFreq = entries.some(e => e.sessionFrequency !== '' && !isNaN(parseFloat(e.sessionFrequency)));
  const canSave    = hasAnyFreq;

  // ── Save handler ──
  function handleSave() {
    if (!canSave) return;

    const behaviorEntries = [
      // existing plan behaviors (only include if frequency was entered)
      ...entries
        .filter(e => e.sessionFrequency !== '' && !isNaN(parseFloat(e.sessionFrequency)))
        .map(e => ({
          behaviorId:            e.behaviorId,
          behaviorName:          e.behaviorName,
          isNew:                 false,
          baselineFrequency:     e.baselineFrequency,
          sessionFrequency:      parseFloat(e.sessionFrequency),
          currentStoNumber:      e.currentStoNumber,
          stoStatus:             e.stoStatus,
          newBehaviorDefinition: '',
          newBehaviorFunction:   '',
          newBehaviorSeverity:   '',
          firstSeenDate:         null,
        })),
      // new behavior (if filled)
      ...(newBehValid
        ? [{
            behaviorId:            null,
            behaviorName:          newBehName.trim(),
            isNew:                 true,
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

    const skillEntries = newSkillValid
      ? [{
          skillId:      null,
          skillName:    newSkillName.trim(),
          isNew:        true,
          firstSeenDate: sessionDate,
          notes:        newSkillNotes.trim(),
        }]
      : [];

    const sessionNumber = (client?.service_session_logs?.length ?? 0) + 1;

    const newLog = {
      id:            `slog_${client.id}_${Date.now()}`,
      clientId:      client.id,
      rbtId:         currentUser?.id   ?? '',
      rbtName:       currentUser?.name ?? '',
      sessionDate,
      sessionNumber,
      notes:         notes.trim(),
      behaviorEntries,
      skillEntries,
      createdAt:     new Date().toISOString(),
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
              Log Therapy Session
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
                placeholder="General observations, context, parent feedback…"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              />
            </div>
          </div>

          {/* ── SECTION 2: Behaviors from treatment plan ── */}
          {behaviorTargets.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Behaviors from Treatment Plan
              </p>

              {entries.map((entry, idx) => {
                const bt = behaviorTargets[idx];
                const isDefShown = defOpen.has(entry.behaviorId);

                return (
                  <div
                    key={entry.behaviorId}
                    className="border border-stone-200 rounded-xl p-3.5 space-y-2.5"
                  >
                    {/* Name + function chip */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-slate-800 leading-snug">
                        {entry.behaviorName}
                      </span>
                      {bt?.hypothesizedFunction && (
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${functionColor(bt.hypothesizedFunction)}`}
                        >
                          {bt.hypothesizedFunction}
                        </span>
                      )}
                    </div>

                    {/* Definition toggle */}
                    {bt?.operationalDefinition && (
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleDef(entry.behaviorId)}
                          className="text-[11px] text-teal-600 hover:underline"
                        >
                          {isDefShown ? '▾ Hide definition' : '▸ Show definition'}
                        </button>
                        {isDefShown && (
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                            {bt.operationalDefinition}
                          </p>
                        )}
                      </div>
                    )}

                    {/* ── Clinical context strip ── */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                      {/* Baseline */}
                      {entry.baselineFrequency != null && (
                        <span>
                          Baseline{' '}
                          <span className="font-medium text-slate-500">
                            {entry.baselineFrequency}×
                          </span>
                        </span>
                      )}

                      {/* Last session frequency + trend */}
                      {latestLogEntryMap[entry.behaviorId] != null && (() => {
                        const prev = latestLogEntryMap[entry.behaviorId].sessionFrequency;
                        const base = entry.baselineFrequency;
                        const color =
                          prev < base ? 'text-emerald-600'
                          : prev > base ? 'text-rose-500'
                          : 'text-slate-500';
                        const arrow =
                          prev < base ? ' ↓' : prev > base ? ' ↑' : ' →';
                        return (
                          <>
                            <span className="text-stone-200">·</span>
                            <span>
                              Last session:{' '}
                              <span className={`font-medium ${color}`}>
                                {prev}×{arrow}
                              </span>
                            </span>
                          </>
                        );
                      })()}

                      {/* STO goal for current STO step */}
                      {(() => {
                        const stoIdx = (entry.currentStoNumber ?? 1) - 1;
                        const step = bt?.stoSteps?.[stoIdx];
                        if (!step || step.targetFrequency == null || step.targetFrequency === '') return null;
                        return (
                          <>
                            <span className="text-stone-200">·</span>
                            <span>
                              STO #{entry.currentStoNumber} goal:{' '}
                              <span className="font-medium text-amber-600">
                                ≤{step.targetFrequency}×
                              </span>
                            </span>
                          </>
                        );
                      })()}

                      {/* Mastery / LTO */}
                      {bt?.targetFrequency != null && bt.targetFrequency !== '' && (
                        <>
                          <span className="text-stone-200">·</span>
                          <span>
                            Mastery:{' '}
                            <span className="font-medium text-teal-600">
                              {bt.targetFrequency}×
                            </span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Frequency input */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <label className="text-[11px] text-slate-500 font-medium">
                        This session:
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={entry.sessionFrequency}
                        onChange={e => updateEntry(idx, 'sessionFrequency', e.target.value)}
                        placeholder="—"
                        className="w-16 border border-stone-200 rounded-lg px-2 py-1 text-sm text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                      <span className="text-[11px] text-slate-400">×</span>
                    </div>

                    {/* STO status + working on STO # */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[11px] text-slate-400 flex-shrink-0">
                          Working on STO #{entry.currentStoNumber}
                        </span>
                        <span className="text-[11px] text-slate-300 flex-shrink-0">·</span>
                        <span className="text-[11px] text-slate-400 flex-shrink-0">Status:</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {STO_STATUS_OPTIONS.map(opt => (
                          <label
                            key={opt.value}
                            className="flex items-center gap-1 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={`sto_status_${entry.behaviorId}`}
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
                  </div>
                );
              })}
            </div>
          )}

          {/* ── SECTION 3: New behavior observed ── */}
          <div className="border border-stone-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setNewBehOpen(o => !o)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors"
            >
              <span className="text-[13px] font-semibold text-orange-600">
                + I observed a new behavior this session
              </span>
              <span className="ml-auto text-[11px] text-slate-400">
                {newBehOpen ? '▲' : '▼'}
              </span>
            </button>

            {newBehOpen && (
              <div className="px-4 pb-4 border-t border-stone-100 space-y-3 pt-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                    Behavior Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newBehName}
                    onChange={e => setNewBehName(e.target.value)}
                    placeholder="e.g. Throwing objects"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                      Frequency <span className="text-red-400">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={newBehFreq}
                        onChange={e => setNewBehFreq(e.target.value)}
                        placeholder="0"
                        className="w-20 border border-stone-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                      <span className="text-[11px] text-slate-400">× this session</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                      Function
                    </label>
                    <select
                      value={newBehFn}
                      onChange={e => setNewBehFn(e.target.value)}
                      className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value="">— select —</option>
                      {FUNCTION_OPTIONS.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                      Severity
                    </label>
                    <select
                      value={newBehSev}
                      onChange={e => setNewBehSev(e.target.value)}
                      className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value="">— select —</option>
                      {SEVERITY_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                    Description / Definition <span className="font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={newBehDef}
                    onChange={e => setNewBehDef(e.target.value)}
                    placeholder="Describe topography, antecedents, context…"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  />
                </div>

                {newBehValid && (
                  <div className="flex items-center gap-1.5 text-[11px] text-orange-600">
                    <span>✓</span>
                    <span>
                      New behavior will be added:{' '}
                      <span className="font-semibold">{newBehName.trim()}</span>
                      {newBehFreq && ` — ${newBehFreq}×`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── SECTION 4: Flag a new skill / replacement behavior ── */}
          <div className="border border-stone-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setNewSkillOpen(o => !o)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors"
            >
              <span className="text-[13px] font-semibold text-teal-700">
                🚩 Flag a new skill or replacement behavior
              </span>
              <span className="ml-auto text-[11px] text-slate-400">
                {newSkillOpen ? '▲' : '▼'}
              </span>
            </button>

            {newSkillOpen && (
              <div className="px-4 pb-4 border-t border-stone-100 space-y-3 pt-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                    Skill / Replacement Behavior Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newSkillName}
                    onChange={e => setNewSkillName(e.target.value)}
                    placeholder="e.g. Used PECS card to request break independently"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                    Notes <span className="font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={newSkillNotes}
                    onChange={e => setNewSkillNotes(e.target.value)}
                    placeholder="Context, frequency, conditions…"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                  />
                </div>

                {newSkillValid && (
                  <div className="flex items-center gap-1.5 text-[11px] text-teal-700">
                    <span>🚩</span>
                    <span>
                      Skill will be flagged:{' '}
                      <span className="font-semibold">{newSkillName.trim()}</span>
                    </span>
                  </div>
                )}
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
            title={!canSave ? 'Enter at least one behavior frequency to save' : undefined}
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
