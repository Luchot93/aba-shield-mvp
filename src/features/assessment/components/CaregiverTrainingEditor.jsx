import React from 'react';
import { patchSection } from '../assessmentStore.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CAREGIVER_INTERVENTIONS = [
  { key: 'premack_baseline',       label: 'Premack Principle (first/then)', hint: '% correct, observed' },
  { key: 'reinforcement_baseline', label: 'Reinforcement Delivery',         hint: '% correct, observed' },
];

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

// ─── CaregiverTrainingEditor ──────────────────────────────────────────────────

export default function CaregiverTrainingEditor({ session, clientId, setClients, onClose }) {
  const sec       = session?.sections?.caregiver_training ?? {};
  const baselines = sec.caregiverBaselines ?? {};
  const format    = sec.trainingFormat    ?? [];
  const freq      = sec.trainingFrequency ?? '';
  const barriers  = sec.trainingBarriers  ?? '';
  const strengths = sec.caregiverStrengths ?? '';

  const patch = (fields) =>
    patchSection(setClients, clientId, 'caregiver_training', {
      ...fields,
      completionState: 'partial',
    });

  const handleBaseline = (key, val) =>
    patch({ caregiverBaselines: { ...baselines, [key]: val } });

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

        {/* ── Observed Baselines ── */}
        <div>
          <FieldLabel>Observed Skill Baselines</FieldLabel>
          <div className="space-y-3">
            {CAREGIVER_INTERVENTIONS.map(({ key, label, hint }) => (
              <div key={key}>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  {label}
                  <span className="ml-1 text-slate-400 font-normal">— {hint}</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={baselines[key] ?? ''}
                    onChange={e => handleBaseline(key, e.target.value)}
                    placeholder="e.g. 40"
                    className="w-24 px-3 py-2 text-[13px] text-slate-800 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 transition-colors"
                  />
                  <span className="text-[12px] text-slate-400">%</span>
                </div>
              </div>
            ))}
          </div>
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
