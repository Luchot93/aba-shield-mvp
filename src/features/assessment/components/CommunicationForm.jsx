import React from 'react';
import { patchSection } from '../assessmentStore.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const COMM_MODES = [
  'Verbal',
  'AAC Device',
  'PECS',
  'Sign Language',
  'Gestural / Pointing',
  'Nonverbal',
];

const AAC_SYSTEMS = [
  'Proloquo2Go',
  'LAMP Words for Life',
  'TouchChat',
  'SnapCore First',
  'GoTalk Now',
  'Other SGD',
];

const PECS_PHASES = ['I', 'II', 'III', 'IV', 'V', 'VI'];

const FUNCTIONAL_REPERTOIRE = [
  'Requesting preferred items/activities',
  'Protesting / refusing',
  'Commenting / sharing information',
  'Greeting familiar people',
  'Answering yes/no questions',
  'Asking for help',
  'Asking questions',
  'Labeling objects/actions',
];

const PRAGMATICS = [
  { field: 'eyeContact',             label: 'Eye Contact',            options: ['Consistent', 'Variable', 'Limited', 'Absent'] },
  { field: 'initiatesCommunication', label: 'Initiates Communication', options: ['Consistently', 'Sometimes', 'Rarely', 'Never observed'] },
  { field: 'turnTaking',             label: 'Turn-Taking',            options: ['Present', 'Emerging', 'Absent'] },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const SL = ({ children }) => (
  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">{children}</p>
);

function ChipGroup({ options, value, onChange, multi = false }) {
  const isActive = (opt) => multi ? (value ?? []).includes(opt) : value === opt;
  const toggle = (opt) => {
    if (multi) {
      const arr = value ?? [];
      onChange(arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt]);
    } else {
      onChange(isActive(opt) ? '' : opt);
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
            isActive(opt)
              ? 'text-white border-transparent'
              : 'text-slate-500 border-stone-200 bg-white hover:border-teal-300'
          }`}
          style={isActive(opt) ? { background: '#0D9488' } : {}}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function InlineNum({ value, onChange, placeholder, width = '3.5rem' }) {
  return (
    <input
      type="number" value={value ?? ''} min={0} max={9999}
      onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="inline-block text-center text-[14px] font-semibold text-teal-700 bg-transparent border-b-2 border-teal-300 focus:border-teal-500 outline-none transition-colors mx-1"
      style={{ width, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}
    />
  );
}

// ─── CommunicationForm ────────────────────────────────────────────────────────

export default function CommunicationForm({ clientId, session, setClients }) {
  const sec = session?.sections?.['communication'] ?? {};

  const set = (field) => (val) =>
    patchSection(setClients, clientId, 'communication', {
      [field]: val,
      completionState: 'partial',
    });

  const modes      = sec.primaryCommunicationModes ?? [];
  const hasVerbal  = modes.includes('Verbal');
  const hasAAC     = modes.includes('AAC Device');
  const hasPECS    = modes.includes('PECS');

  return (
    <div className="space-y-5 pt-1 pb-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Primary mode ──────────────────────────────────────────────────── */}
      <div>
        <SL>Primary Communication Mode (select all that apply)</SL>
        <ChipGroup
          options={COMM_MODES}
          value={modes}
          onChange={set('primaryCommunicationModes')}
          multi
        />
      </div>

      {/* ── Verbal details ────────────────────────────────────────────────── */}
      {hasVerbal && (
        <div className="rounded-xl px-4 py-3.5 space-y-2"
          style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <SL>Verbal Communication Details</SL>
          <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5 min-h-[2rem]">
            <span>Client uses approximately</span>
            <InlineNum value={sec.mluWords} onChange={set('mluWords')} placeholder="4" width="3rem"/>
            <span>words per utterance in familiar contexts.</span>
          </p>
          <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5 min-h-[2rem]">
            <span>Speech intelligibility: familiar listeners</span>
            <InlineNum value={sec.intelligibilityFamiliar} onChange={set('intelligibilityFamiliar')} placeholder="80" width="3.5rem"/>
            <span>%, unfamiliar listeners</span>
            <InlineNum value={sec.intelligibilityUnfamiliar} onChange={set('intelligibilityUnfamiliar')} placeholder="60" width="3.5rem"/>
            <span>%.</span>
          </p>
        </div>
      )}

      {/* ── AAC details ───────────────────────────────────────────────────── */}
      {hasAAC && (
        <div className="space-y-3">
          <div>
            <SL>AAC System</SL>
            <ChipGroup options={AAC_SYSTEMS} value={sec.aacSystem} onChange={set('aacSystem')} />
          </div>
          <div>
            <SL>Current Phase / Level</SL>
            <input
              type="text" value={sec.aacPhase ?? ''}
              onChange={e => set('aacPhase')(e.target.value)}
              placeholder="e.g. Phase II — modeling, 50+ core words, beginning combinations"
              className="demo-input" style={{ fontFamily: 'DM Sans, sans-serif' }}
            />
          </div>
        </div>
      )}

      {/* ── PECS phase ────────────────────────────────────────────────────── */}
      {hasPECS && (
        <div>
          <SL>PECS Phase</SL>
          <ChipGroup options={PECS_PHASES} value={sec.pecsPhase} onChange={set('pecsPhase')} />
        </div>
      )}

      {/* ── Functional repertoire ─────────────────────────────────────────── */}
      <div>
        <SL>Current Functional Communication Repertoire</SL>
        <ChipGroup
          options={FUNCTIONAL_REPERTOIRE}
          value={sec.functionalRepertoire ?? []}
          onChange={set('functionalRepertoire')}
          multi
        />
      </div>

      {/* ── Receptive language ────────────────────────────────────────────── */}
      <div className="rounded-xl px-4 py-3.5 space-y-2"
        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <SL>Receptive Language</SL>
        <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5 min-h-[2rem]">
          <span>Follows single-step instructions approximately</span>
          <InlineNum value={sec.receptiveSingleStep} onChange={set('receptiveSingleStep')} placeholder="80" width="3.5rem"/>
          <span>% of the time.</span>
        </p>
        <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5 min-h-[2rem]">
          <span>Follows two-step instructions approximately</span>
          <InlineNum value={sec.receptiveTwoStep} onChange={set('receptiveTwoStep')} placeholder="50" width="3.5rem"/>
          <span>% of the time.</span>
        </p>
        <label className="flex items-center gap-2 cursor-pointer select-none pt-0.5">
          <input type="checkbox" checked={!!sec.receptiveMultiStep}
            onChange={e => set('receptiveMultiStep')(e.target.checked)}
            className="w-3.5 h-3.5 accent-teal-600"/>
          <span className="text-[12px] text-slate-600">Follows multi-step (3+) instructions</span>
        </label>
      </div>

      {/* ── Pragmatics ────────────────────────────────────────────────────── */}
      <div>
        <SL>Social Communication / Pragmatics</SL>
        <div className="space-y-3">
          {PRAGMATICS.map(({ field, label, options }) => (
            <div key={field}>
              <p className="text-[11px] font-medium text-slate-500 mb-1.5">{label}</p>
              <ChipGroup options={options} value={sec[field]} onChange={set(field)} />
            </div>
          ))}
        </div>
      </div>

      {/* ── SLP services ──────────────────────────────────────────────────── */}
      <div>
        <SL>Current SLP Services</SL>
        <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
          <input type="checkbox" checked={!!sec.slpServices}
            onChange={e => set('slpServices')(e.target.checked)}
            className="w-3.5 h-3.5 accent-teal-600"/>
          <span className="text-[12px] text-slate-600">Currently receiving SLP services</span>
        </label>
        {sec.slpServices && (
          <div className="pl-4 border-l-2 border-teal-100 space-y-2">
            <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5 min-h-[2rem]">
              <InlineNum value={sec.slpFrequencyPerWeek} onChange={set('slpFrequencyPerWeek')} placeholder="2" width="2.5rem"/>
              <span>session(s) per week</span>
            </p>
            <input
              type="text" value={sec.slpFocus ?? ''}
              onChange={e => set('slpFocus')(e.target.value)}
              placeholder="Focus area (e.g. pragmatics, AAC, articulation, language)"
              className="demo-input" style={{ fontFamily: 'DM Sans, sans-serif' }}
            />
          </div>
        )}
      </div>

    </div>
  );
}
