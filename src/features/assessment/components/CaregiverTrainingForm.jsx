import React from 'react';
import { patchSection } from '../assessmentStore.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CAREGIVER_INTERVENTIONS = [
  { key: 'premack_baseline',       label: 'Premack Principle (first/then)',  hint: '% correct, observed' },
  { key: 'reinforcement_baseline', label: 'Reinforcement Delivery',          hint: '% correct, observed' },
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

// ─── Sub-components ───────────────────────────────────────────────────────────

const SL = ({ children }) => (
  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">{children}</p>
);

function ChipGroup({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all ${
              active
                ? 'bg-teal-50 border-teal-400 text-teal-700'
                : 'bg-stone-50 border-stone-200 text-slate-500 hover:border-teal-300 hover:text-teal-600'
            }`}
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── CaregiverTrainingForm ─────────────────────────────────────────────────────

export default function CaregiverTrainingForm({ clientId, session, setClients }) {
  const sec      = session?.sections?.['caregiver_training'] ?? {};
  const baselines = sec.caregiverBaselines ?? {};
  const format    = sec.trainingFormat ?? [];
  const freq      = sec.trainingFrequency ?? '';
  const barriers  = sec.trainingBarriers ?? '';
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

  const handleFreq = (opt) =>
    patch({ trainingFrequency: freq === opt ? '' : opt });

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }} className="space-y-6">

      {/* ── Observed Baselines ── */}
      <div>
        <SL>Observed Baselines</SL>
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
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                />
                <span className="text-[12px] text-slate-400">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Training Format ── */}
      <div>
        <SL>Training Format</SL>
        <ChipGroup
          options={FORMAT_OPTIONS}
          selected={format}
          onToggle={handleFormatToggle}
        />
      </div>

      {/* ── Training Frequency ── */}
      <div>
        <SL>Training Frequency</SL>
        <div className="flex flex-wrap gap-1.5">
          {FREQUENCY_OPTIONS.map(opt => {
            const active = freq === opt;
            return (
              <button
                key={opt}
                onClick={() => handleFreq(opt)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all ${
                  active
                    ? 'bg-teal-50 border-teal-400 text-teal-700'
                    : 'bg-stone-50 border-stone-200 text-slate-500 hover:border-teal-300 hover:text-teal-600'
                }`}
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Barriers to Participation ── */}
      <div>
        <SL>Barriers to Participation</SL>
        <textarea
          value={barriers}
          onChange={e => patch({ trainingBarriers: e.target.value })}
          placeholder="Work schedule, language barriers, other children, transportation..."
          rows={3}
          className="w-full px-3 py-2 text-[13px] text-slate-700 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 transition-colors resize-none"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        />
      </div>

      {/* ── Caregiver Strengths ── */}
      <div>
        <SL>Caregiver Strengths</SL>
        <textarea
          value={strengths}
          onChange={e => patch({ caregiverStrengths: e.target.value })}
          placeholder="Motivation, prior knowledge, consistency, communication style..."
          rows={3}
          className="w-full px-3 py-2 text-[13px] text-slate-700 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 transition-colors resize-none"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        />
      </div>

    </div>
  );
}
