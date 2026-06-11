import React, { useState } from 'react';
import {
  patchSection,
  addCaregiverTrainingTarget,
  updateCaregiverTrainingTarget,
  removeCaregiverTrainingTarget,
  computeStoPercent,
} from '../assessmentStore.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const FORMAT_OPTIONS = [
  'In-session coaching',
  'Parent sessions',
  'Written guides',
  'Video modeling',
  'Telehealth coaching',
  'Home visit',
];

const FREQUENCY_OPTIONS = [
  '1x/week',
  '2x/week',
  '3x/week',
  'Bi-weekly',
  'Monthly',
  'As needed',
];

// ─── Primitives ───────────────────────────────────────────────────────────────

const FieldLabel = ({ children }) => (
  <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
    {children}
  </label>
);

function ChipGroup({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className="px-3 py-1 text-[12px] font-semibold rounded-full border transition-all"
            style={active
              ? { background: 'rgba(20,184,166,0.12)', borderColor: '#14B8A6', color: '#0D7A6E' }
              : { background: '#F8F7F6', borderColor: '#E7E5E4', color: '#64748B' }
            }>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function ChipSelect({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? '' : opt)}
            className="px-3 py-1 text-[12px] font-semibold rounded-full border transition-all"
            style={active
              ? { background: 'rgba(20,184,166,0.12)', borderColor: '#14B8A6', color: '#0D7A6E' }
              : { background: '#F8F7F6', borderColor: '#E7E5E4', color: '#64748B' }
            }>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── TrainingTargetCard ───────────────────────────────────────────────────────

const SectionRule = ({ label }) => (
  <div className="flex items-center gap-2 my-1">
    <div className="h-px flex-1 bg-stone-100" />
    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">{label}</span>
    <div className="h-px flex-1 bg-stone-100" />
  </div>
);

function TrainingTargetCard({ target, index, clientId, setClients }) {
  const [expanded, setExpanded] = useState(true);
  const [customOpen, setCustomOpen] = useState(false);

  const upd = (field, value) =>
    updateCaregiverTrainingTarget(clientId, target.id, field, value, null, setClients);

  const bpNum = target.baselinePercent !== null && target.baselinePercent !== ''
    ? Number(target.baselinePercent)
    : null;
  const stoComputed = bpNum !== null ? computeStoPercent(bpNum) : null;
  const stoIsAuto   = target.stoPercent == null && stoComputed !== null;

  // Local draft for the STO % input — lets the user freely edit/clear without
  // the store snapping the value back mid-keystroke.
  // Commits to the store on blur; syncs from outside when baseline changes.
  const stoExternal = target.stoPercent != null ? String(target.stoPercent) : (stoComputed != null ? String(stoComputed) : '');
  const [stoDraft, setStoDraft] = React.useState(stoExternal);
  React.useEffect(() => { setStoDraft(stoExternal); }, [stoExternal]);

  const ltoDisplay = target.ltoPercent != null ? target.ltoPercent : null;

  const inputCls = 'px-2 py-2 text-[13px] text-slate-800 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 transition-colors';

  return (
    <div className="border border-stone-200 rounded-xl bg-white overflow-hidden mb-3">
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors"
        onClick={() => setExpanded(e => !e)}>
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
          style={{ background: '#14B8A6' }}>
          {index + 1}
        </span>
        <span className="flex-1 text-sm font-semibold text-slate-700 truncate">
          {target.goalName || <span className="font-normal text-slate-400">Untitled goal</span>}
        </span>
        {target.isStandard && (
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: 'rgba(20,184,166,0.1)', color: '#0D7A6E' }}>
            Standard
          </span>
        )}
        <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
        {!target.isStandard && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); removeCaregiverTrainingTarget(clientId, target.id, null, setClients); }}
            className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0"
            title="Remove goal">
            ×
          </button>
        )}
      </div>

      {expanded && (
      <div className="px-4 pb-5 pt-3 border-t border-stone-100 space-y-4">

        {/* Goal name */}
        <div>
          <FieldLabel>Goal Name</FieldLabel>
          <input
            type="text"
            value={target.goalName ?? ''}
            onChange={e => upd('goalName', e.target.value)}
            placeholder="e.g. Implement Premack principle correctly"
            className={`w-full ${inputCls}`}
          />
        </div>

        {/* Operational definition */}
        <div>
          <FieldLabel>Operational Definition</FieldLabel>
          <textarea
            value={target.operationalDefinition ?? ''}
            onChange={e => upd('operationalDefinition', e.target.value)}
            placeholder="Observable, measurable description of the caregiver behavior…"
            rows={2}
            className={`w-full leading-relaxed resize-y ${inputCls}`}
          />
        </div>

        {/* ── Baseline ── */}
        <div>
          <SectionRule label="Baseline" />
          <div className="flex gap-3 items-start mt-3">
            <div>
              <FieldLabel>Observed %</FieldLabel>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min={0} max={100}
                  value={target.baselinePercent ?? ''}
                  onChange={e => upd('baselinePercent', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="e.g. 40"
                  className={`w-20 ${inputCls}`}
                />
                <span className="text-[12px] text-slate-400">%</span>
              </div>
            </div>
            <div className="flex-1">
              <FieldLabel>Context (optional)</FieldLabel>
              <input
                type="text"
                value={target.baselineContext ?? ''}
                onChange={e => upd('baselineContext', e.target.value)}
                placeholder="e.g. observed during in-home session"
                className={`w-full ${inputCls}`}
              />
            </div>
          </div>
        </div>

        {/* ── Objectives ── */}
        <div>
          <SectionRule label="Objectives" />
          <div className="grid grid-cols-2 gap-4 mt-3">

            {/* STO */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-2.5" style={{ color: '#14B8A6' }}>
                Short-Term (STO)
              </p>
              <div className="flex gap-2 items-start">
                <div>
                  <FieldLabel>Target %</FieldLabel>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={0} max={100}
                      value={stoDraft}
                      onChange={e => setStoDraft(e.target.value)}
                      onBlur={e => upd('stoPercent', e.target.value === '' ? null : Number(e.target.value))}
                      className={`w-16 ${inputCls}`}
                    />
                    <span className="text-[12px] text-slate-400">%</span>
                  </div>
                  {stoIsAuto && (
                    <p className="text-[10px] mt-1" style={{ color: '#5EADA3' }}>auto from {bpNum}%</p>
                  )}
                </div>
                <div>
                  <FieldLabel>Weeks</FieldLabel>
                  <input
                    type="number" min={1}
                    value={target.stoWeeks ?? ''}
                    onChange={e => upd('stoWeeks', e.target.value === '' ? null : Number(e.target.value))}
                    className={`w-16 ${inputCls}`}
                  />
                </div>
              </div>
            </div>

            {/* LTO */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">
                Long-Term (LTO)
              </p>
              <div className="flex gap-2 items-start">
                <div>
                  <FieldLabel>Target %</FieldLabel>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={0} max={100}
                      value={target.ltoPercent ?? ''}
                      onChange={e => upd('ltoPercent', e.target.value === '' ? null : Number(e.target.value))}
                      className={`w-16 ${inputCls}`}
                    />
                    <span className="text-[12px] text-slate-400">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">enter manually</p>
                </div>
                <div>
                  <FieldLabel>Sessions</FieldLabel>
                  <input
                    type="number" min={1}
                    value={target.ltoSessions ?? ''}
                    onChange={e => upd('ltoSessions', e.target.value === '' ? null : Number(e.target.value))}
                    className={`w-16 ${inputCls}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Narrative preview */}
        {(target.goalName || bpNum !== null) && (
          <div className="rounded-lg px-3 py-2.5 space-y-1.5"
            style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.2)' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#5EADA3' }}>
              Narrative Preview
            </p>
            <p className="text-[12px] text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-500">STO: </span>
              Caregiver will demonstrate {target.goalName || 'the target skill'} with{' '}
              <span className="font-semibold">{stoDraft !== '' ? stoDraft : '?'}%</span> consistency
              across <span className="font-semibold">{target.stoWeeks != null ? target.stoWeeks : '?'}</span> consecutive weeks.
            </p>
            <p className="text-[12px] text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-500">LTO: </span>
              Caregiver will demonstrate {target.goalName || 'the target skill'} with{' '}
              <span className="font-semibold">{ltoDisplay != null ? ltoDisplay : '?'}%</span> accuracy
              across <span className="font-semibold">{target.ltoSessions != null ? target.ltoSessions : '?'}</span> consecutive caregiver training sessions.
            </p>
          </div>
        )}

        {/* Custom sentence override (optional) */}
        <div>
          <button
            type="button"
            onClick={() => setCustomOpen(o => !o)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
            <svg className={`w-3.5 h-3.5 transition-transform ${customOpen ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
            Custom sentence override (optional)
          </button>
          {customOpen && (
            <div className="mt-3 space-y-3 pl-3 border-l-2 border-stone-100">
              <p className="text-[11px] text-slate-400">
                Free text replaces the auto-generated sentence entirely. Leave blank to use the computed narrative above.
              </p>
              <div>
                <FieldLabel>STO Sentence</FieldLabel>
                <textarea value={target.sto ?? ''} onChange={e => upd('sto', e.target.value)}
                  rows={2} placeholder="Custom STO sentence…"
                  className={`w-full leading-relaxed resize-y ${inputCls}`}
                />
              </div>
              <div>
                <FieldLabel>LTO Sentence</FieldLabel>
                <textarea value={target.lto ?? ''} onChange={e => upd('lto', e.target.value)}
                  rows={2} placeholder="Custom LTO sentence…"
                  className={`w-full leading-relaxed resize-y ${inputCls}`}
                />
              </div>
            </div>
          )}
        </div>

      </div>
      )}
    </div>
  );
}

// ─── CaregiverTrainingEditor ──────────────────────────────────────────────────

export default function CaregiverTrainingEditor({ session, clientId, setClients, onClose }) {
  const sec       = session?.sections?.caregiver_training ?? {};
  const format    = sec.trainingFormat    ?? [];
  const freq      = sec.trainingFrequency ?? '';
  const barriers  = sec.trainingBarriers  ?? '';
  const strengths = sec.caregiverStrengths ?? '';
  const targets   = sec.caregiverTrainingTargets ?? [];

  const patch = (fields) =>
    patchSection(setClients, clientId, 'caregiver_training', {
      ...fields,
      completionState: 'partial',
    });

  const handleFormatToggle = (opt) => {
    const next = format.includes(opt)
      ? format.filter(f => f !== opt)
      : [...format, opt];
    patch({ trainingFormat: next });
  };

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Caregiver Training
        </p>
        <p className="text-[10px] text-slate-400">Changes save automatically</p>
      </div>

      <div className="space-y-5">

        {/* ── Training Targets ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Training Targets
              {targets.length > 0 && (
                <span className="ml-2 text-teal-600" style={{ fontFamily: 'DM Mono, monospace' }}>
                  {targets.length}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => addCaregiverTrainingTarget(clientId, null, setClients)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 text-slate-600 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50/40 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              Add goal
            </button>
          </div>
          {targets.length === 0 ? (
            <button
              type="button"
              onClick={() => addCaregiverTrainingTarget(clientId, null, setClients)}
              className="w-full flex flex-col items-center gap-2 py-8 border-2 border-dashed border-stone-200 rounded-xl text-slate-400 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/40 transition-all mb-2">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              <span className="text-sm font-semibold">Add your first training goal</span>
              <span className="text-xs">Each goal becomes a caregiver training objective in the plan</span>
            </button>
          ) : (
            targets.map((t, i) => (
              <TrainingTargetCard
                key={t.id}
                target={t}
                index={i}
                clientId={clientId}
                setClients={setClients}
              />
            ))
          )}
        </div>

        {/* ── Training Format ── */}
        <div>
          <FieldLabel>Training Format</FieldLabel>
          <ChipGroup
            options={FORMAT_OPTIONS}
            selected={format}
            onToggle={handleFormatToggle}
          />
        </div>

        {/* ── Training Frequency ── */}
        <div>
          <FieldLabel>Training Frequency</FieldLabel>
          <ChipSelect
            options={FREQUENCY_OPTIONS}
            value={freq}
            onChange={(opt) => patch({ trainingFrequency: opt })}
          />
        </div>

        {/* ── Barriers ── */}
        <div>
          <FieldLabel>Barriers to Participation</FieldLabel>
          <textarea
            value={barriers}
            onChange={e => patch({ trainingBarriers: e.target.value })}
            placeholder="Work schedule, language barriers, other children, transportation…"
            rows={3}
            className="w-full px-3 py-2 text-[13px] leading-relaxed text-slate-800 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 resize-y transition-colors"
          />
        </div>

        {/* ── Caregiver Strengths ── */}
        <div>
          <FieldLabel>Caregiver Strengths</FieldLabel>
          <textarea
            value={strengths}
            onChange={e => patch({ caregiverStrengths: e.target.value })}
            placeholder="Motivation, prior knowledge, consistency, communication style…"
            rows={3}
            className="w-full px-3 py-2 text-[13px] leading-relaxed text-slate-800 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 resize-y transition-colors"
          />
        </div>

      </div>

      {/* ── Footer ── */}
      <div className="flex justify-end mt-5 pt-4 border-t border-stone-100">
        <button
          onClick={onClose}
          className="px-5 py-2 text-[13px] font-semibold text-white rounded-xl hover:opacity-90 transition-opacity"
          style={{ background: '#0D9488' }}>
          Save &amp; Close
        </button>
      </div>

    </div>
  );
}
