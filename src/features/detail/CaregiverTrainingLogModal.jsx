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
    const logs = client?.caregiver_training_session_logs ?? [];
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
      return {
        targetId:        target.id,
        goalName:        target.goalName ?? '',
        baselinePercent: target.baselinePercent ?? null,
        sessionPercent:  '',
        stoStatus:       'in_progress',
        currentStoNumber: prev?.currentStoNumber ?? 1,
      };
    }),
  );

  function updateEntry(idx, field, value) {
    setEntries(prev => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  }

  // ── Save guard — every goal must have a sessionPercent ──
  const canSave = entries.length > 0 && entries.every(
    e => e.sessionPercent !== '' && !isNaN(parseFloat(e.sessionPercent)),
  );

  // ── Save handler ──
  function handleSave() {
    if (!canSave) return;

    const trainingEntries = entries.map(e => ({
      targetId:         e.targetId,
      goalName:         e.goalName,
      baselinePercent:  e.baselinePercent,
      sessionPercent:   parseFloat(e.sessionPercent),
      stoStatus:        e.stoStatus,
      currentStoNumber: e.currentStoNumber,
    }));

    const sessionNumber = (client?.caregiver_training_session_logs?.length ?? 0) + 1;

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
          {caregiverTargets.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Caregiver Training Goals
              </p>

              {entries.map((entry, idx) => {
                const target   = caregiverTargets[idx];
                const stoLabel = resolveStoLabel(target);

                return (
                  <div
                    key={entry.targetId ?? idx}
                    className="border border-stone-200 rounded-xl p-3.5 space-y-2.5"
                  >
                    {/* Goal name */}
                    <p className="text-[13px] font-semibold text-slate-800 leading-snug">
                      {entry.goalName}
                    </p>

                    {/* ── Clinical context strip ── */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                      {/* Baseline */}
                      {entry.baselinePercent != null && (
                        <span>
                          Baseline{' '}
                          <span className="font-medium text-slate-500">
                            {entry.baselinePercent}%
                          </span>
                        </span>
                      )}

                      {/* Last session % + trend (higher = better for caregiver training) */}
                      {latestEntryMap[entry.targetId] != null && (() => {
                        const prev = latestEntryMap[entry.targetId].sessionPercent;
                        const base = entry.baselinePercent;
                        const color =
                          prev > base ? 'text-emerald-600'
                          : prev < base ? 'text-rose-500'
                          : 'text-slate-500';
                        const arrow =
                          prev > base ? ' ↑' : prev < base ? ' ↓' : ' →';
                        return (
                          <>
                            <span className="text-stone-200">·</span>
                            <span>
                              Last session:{' '}
                              <span className={`font-medium ${color}`}>
                                {prev}%{arrow}
                              </span>
                            </span>
                          </>
                        );
                      })()}

                      {/* STO goal for current STO step */}
                      {(() => {
                        const stoIdx = (entry.currentStoNumber ?? 1) - 1;
                        const step   = target?.stoSteps?.[stoIdx];
                        if (!step || step.targetPercent == null || step.targetPercent === '') return null;
                        return (
                          <>
                            <span className="text-stone-200">·</span>
                            <span>
                              STO #{entry.currentStoNumber} goal:{' '}
                              <span className="font-medium text-amber-600">
                                ≥{step.targetPercent}%
                              </span>
                            </span>
                          </>
                        );
                      })()}

                      {/* LTO */}
                      {target?.ltoPercent != null && (
                        <>
                          <span className="text-stone-200">·</span>
                          <span>
                            LTO:{' '}
                            <span className="font-medium text-teal-600">
                              {target.ltoPercent}%
                            </span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Session % input */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <label className="text-[11px] text-slate-500 font-medium">
                        % correct this session:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={entry.sessionPercent}
                        onChange={e => updateEntry(idx, 'sessionPercent', e.target.value)}
                        placeholder="—"
                        className="w-16 border border-stone-200 rounded-lg px-2 py-1 text-sm text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                      <span className="text-[11px] text-slate-400">%</span>
                    </div>

                    {/* STO status radios */}
                    <div className="space-y-1.5">
                      {stoLabel && (
                        <p className="text-[11px] text-slate-400">{stoLabel}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {STO_STATUS_OPTIONS.map(opt => (
                          <label
                            key={opt.value}
                            className="flex items-center gap-1 cursor-pointer"
                          >
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
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state — no targets in assessment */}
          {caregiverTargets.length === 0 && (
            <p className="text-[13px] text-slate-400 text-center py-4">
              No caregiver training targets found in Section 11 of the assessment.
            </p>
          )}

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
            title={!canSave ? 'Enter a % for every goal to save' : undefined}
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
