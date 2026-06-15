import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  patchSection,
  addCaregiverTrainingTarget,
  updateCaregiverTrainingTarget,
  removeCaregiverTrainingTarget,
  addCaregiverStoStep,
  updateCaregiverStoStep,
  removeCaregiverStoStep,
} from '../assessmentStore.js';

// ─── Goal library ─────────────────────────────────────────────────────────────

const CAREGIVER_LIBRARY = [
  {
    name: 'Premack Principle (First-Then)',
    operationalDefinition: 'Caregiver uses "first [non-preferred], then [preferred]" structure consistently, delivering access to the preferred item contingently and only after the requested behavior is completed.',
  },
  {
    name: 'Reinforcement Delivery',
    operationalDefinition: 'Caregiver delivers contingent, behavior-specific praise or tangible reinforcement within 3 seconds of the target behavior occurring, using varied reinforcer types matched to learner preference as identified in the most recent preference assessment.',
  },
  {
    name: 'Differential Reinforcement (DR)',
    operationalDefinition: 'Caregiver delivers contingent praise or tangible reinforcement within 3 seconds of a target behavior occurring, and withholds reinforcement for the absence or opposite of the target behavior, maintaining consistency across at least 80% of opportunities.',
  },
  {
    name: 'Extinction / Ignoring Maintained Behaviors',
    operationalDefinition: 'Caregiver consistently withholds attention, tangibles, or escape following identified problem behavior, without making eye contact, verbal comments, or providing access to the maintaining reinforcer, across all occurrences within a session.',
  },
  {
    name: 'Prompt Hierarchy Implementation',
    operationalDefinition: 'Caregiver delivers prompts in the correct sequence (e.g., least-to-most or most-to-least as specified in the protocol), allows the designated wait time between prompts, and fades prompts systematically as the learner demonstrates independence.',
  },
  {
    name: 'Data Collection / Behavior Tracking',
    operationalDefinition: 'Caregiver accurately records occurrences of the target behavior using the designated data sheet or app (frequency, duration, or interval recording as specified), completing data within 10 minutes following each session or observation period.',
  },
  {
    name: 'Generalization Programming',
    operationalDefinition: 'Caregiver implements target skill practice across at least 3 different settings, people, or materials per week as specified in the treatment plan, varying antecedent conditions to promote stimulus generalization.',
  },
  {
    name: 'Behavioral Momentum / High-Probability Requests',
    operationalDefinition: 'Caregiver delivers 3 or more high-probability requests before a low-probability request during instructional sequences, maintaining a brisk pace (≤5 seconds between trials) to build compliance momentum.',
  },
  {
    name: 'Functional Communication Training (FCT) Response',
    operationalDefinition: 'Caregiver consistently honors the learner\'s FCT response (e.g., request for break, help, or item) within 3 seconds of the communicative act, and blocks and redirects problem behavior without providing the same reinforcer.',
  },
  {
    name: 'Visual Schedule Use',
    operationalDefinition: 'Caregiver presents the visual schedule before transitions, guides the learner to check off or flip completed items, and uses the schedule to preview upcoming activities, across all scheduled transitions throughout the day.',
  },
  {
    name: 'Crisis / Safety Response Protocol',
    operationalDefinition: 'Caregiver correctly identifies the early warning signs in the learner\'s escalation cycle and implements the written safety plan steps in the correct sequence, without deviation, within 30 seconds of observing the first indicator.',
  },
];

// ─── GoalNameInput — autocomplete from CAREGIVER_LIBRARY ─────────────────────

function GoalNameInput({ value, onChange, onSelect, inputCls }) {
  const [open, setOpen]   = useState(false);
  const [pos,  setPos]    = useState({ top: 0, left: 0, width: 0 });
  const inputRef          = useRef(null);
  const dropdownRef       = useRef(null);

  const suggestions = (value ?? '').trim().length >= 1
    ? CAREGIVER_LIBRARY.filter(s => s.name.toLowerCase().includes(value.toLowerCase()))
    : [];

  const updatePos = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  };

  const handleChange = (e) => {
    onChange(e.target.value);
    updatePos();
    setOpen(true);
  };

  const handleFocus = () => {
    updatePos();
    if ((value ?? '').trim()) setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!inputRef.current?.contains(e.target)) setOpen(false); };
    const closeOnScroll = (e) => { if (!dropdownRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [open]);

  const dropdown = open && suggestions.length > 0 ? createPortal(
    <div
      ref={dropdownRef}
      onMouseDown={e => e.stopPropagation()}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, fontFamily: 'DM Sans, sans-serif' }}
      className="bg-white rounded-xl border border-stone-200 shadow-2xl py-1 max-h-72 overflow-y-auto">
      {suggestions.map((item, i) => (
        <button key={item.name} type="button"
          onMouseDown={e => { e.preventDefault(); onSelect(item); setOpen(false); }}
          className="w-full text-left px-3.5 py-2.5 hover:bg-teal-50 transition-colors group"
          style={{ borderBottom: i < suggestions.length - 1 ? '1px solid #F5F5F4' : 'none' }}>
          <p className="text-[13px] font-semibold text-slate-700 group-hover:text-teal-700">{item.name}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.operationalDefinition}
          </p>
        </button>
      ))}
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value ?? ''}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder="e.g. Premack Principle, Reinforcement Delivery…"
        className={`w-full ${inputCls}`}
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      />
      {dropdown}
    </>
  );
}

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

// ─── Sub-components ───────────────────────────────────────────────────────────

const SL = ({ children }) => (
  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">{children}</p>
);

function InlineNum({ value, onChange, placeholder, width = '3.5rem' }) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={onChange}
      placeholder={placeholder}
      min={0}
      max={9999}
      className="inline-block text-center text-[14px] font-semibold text-teal-700 bg-transparent border-b-2 border-teal-300 focus:border-teal-500 outline-none transition-colors mx-0.5"
      style={{ width, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}
    />
  );
}

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

// ─── TrainingTargetCard ────────────────────────────────────────────────────────

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

  const ltoDisplay = target.ltoPercent != null ? target.ltoPercent : null;
  const inputCls = 'px-2 py-2 text-[13px] text-slate-800 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 transition-colors';

  return (
    <div className="border border-stone-200 rounded-xl bg-white overflow-hidden mb-3"
      style={{ fontFamily: 'DM Sans, sans-serif' }}>
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
          <SL>Goal Name</SL>
          <GoalNameInput
            value={target.goalName ?? ''}
            onChange={val => upd('goalName', val)}
            onSelect={item => {
              upd('goalName', item.name);
              if (!target.operationalDefinition?.trim()) upd('operationalDefinition', item.operationalDefinition);
            }}
            inputCls={inputCls}
          />
        </div>

        {/* Operational definition */}
        <div>
          <SL>Operational Definition</SL>
          <textarea
            value={target.operationalDefinition ?? ''}
            onChange={e => upd('operationalDefinition', e.target.value)}
            placeholder="Observable, measurable description of the caregiver behavior…"
            rows={2}
            className={`w-full leading-relaxed resize-none ${inputCls}`}
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          />
        </div>

        {/* ── Baseline ── */}
        <div>
          <SectionRule label="Baseline" />
          <div className="flex gap-3 items-start mt-3">
            <div>
              <SL>Observed %</SL>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min={0} max={100}
                  value={target.baselinePercent ?? ''}
                  onChange={e => upd('baselinePercent', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="e.g. 40"
                  className={`w-20 ${inputCls}`}
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                />
                <span className="text-[12px] text-slate-400">%</span>
              </div>
            </div>
            <div className="flex-1">
              <SL>Context (optional)</SL>
              <input
                type="text"
                value={target.baselineContext ?? ''}
                onChange={e => upd('baselineContext', e.target.value)}
                placeholder="e.g. observed during in-home session"
                className={`w-full ${inputCls}`}
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              />
            </div>
          </div>
        </div>

        {/* ── Short-Term Objectives (STO steps) ── */}
        <div>
          <SectionRule label="Short-Term Objectives" />
          <div className="flex items-center justify-between mt-3 mb-1">
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#14B8A6' }}>
              STO Milestones
            </p>
            <button
              type="button"
              onClick={() => addCaregiverStoStep(setClients, clientId, target.id)}
              className="flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              Add STO step
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            Milestones that must be met before reaching the mastery goal
          </p>
          {(target.stoSteps ?? []).length === 0 ? (
            <p className="text-[11px] text-slate-400 italic">No steps defined — auto-formula will be used in the plan</p>
          ) : (
            <div className="space-y-2">
              {(target.stoSteps ?? []).map((step, si) => (
                <div key={step.id} className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-slate-600 rounded-lg px-3 py-2"
                  style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <span className="text-[11px] font-bold text-teal-600 mr-0.5">STO {si + 1}</span>
                  <span>Caregiver will demonstrate</span>
                  <InlineNum
                    value={step.targetPercent}
                    onChange={e => updateCaregiverStoStep(setClients, clientId, target.id, step.id, 'targetPercent', e.target.value)}
                    placeholder="60"
                    width="3rem"
                  />
                  <span>% accuracy within</span>
                  <InlineNum
                    value={step.durationWeeks}
                    onChange={e => updateCaregiverStoStep(setClients, clientId, target.id, step.id, 'durationWeeks', e.target.value)}
                    placeholder="4"
                    width="2.5rem"
                  />
                  <span>consecutive weeks.</span>
                  <button
                    type="button"
                    onClick={() => removeCaregiverStoStep(setClients, clientId, target.id, step.id)}
                    className="ml-auto text-slate-300 hover:text-red-400 transition-colors text-base leading-none"
                    title="Remove step">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Long-Term Objective (LTO) ── */}
        <div>
          <SectionRule label="Long-Term Objective" />
          <div className="flex gap-3 items-start mt-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Long-Term (LTO)</p>
              <div className="flex items-center gap-1">
                <input
                  type="number" min={0} max={100}
                  value={target.ltoPercent ?? ''}
                  onChange={e => upd('ltoPercent', e.target.value === '' ? null : Number(e.target.value))}
                  className={`w-16 ${inputCls}`}
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                />
                <span className="text-[12px] text-slate-400">%</span>
              </div>
            </div>
            <div>
              <SL>Sessions to mastery</SL>
              <input
                type="number" min={1}
                value={target.ltoSessions ?? ''}
                onChange={e => upd('ltoSessions', e.target.value === '' ? null : Number(e.target.value))}
                className={`w-16 ${inputCls}`}
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              />
            </div>
          </div>
        </div>

        {/* Custom LTO sentence override (optional) */}
        <div>
          <button
            type="button"
            onClick={() => setCustomOpen(o => !o)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
            <svg className={`w-3.5 h-3.5 transition-transform ${customOpen ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
            Custom LTO sentence override (optional)
          </button>
          {customOpen && (
            <div className="mt-3 pl-3 border-l-2 border-stone-100">
              <p className="text-[11px] text-slate-400 mb-2">
                Free text replaces the auto-generated LTO sentence. Leave blank to use computed narrative.
              </p>
              <SL>LTO Sentence</SL>
              <textarea value={target.lto ?? ''} onChange={e => upd('lto', e.target.value)}
                rows={2} placeholder="Custom LTO sentence…"
                className={`w-full leading-relaxed resize-none ${inputCls}`}
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              />
            </div>
          )}
        </div>

      </div>
      )}
    </div>
  );
}

// ─── CaregiverTrainingForm ─────────────────────────────────────────────────────

export default function CaregiverTrainingForm({ clientId, session, setClients }) {
  const sec      = session?.sections?.['caregiver_training'] ?? {};
  const format    = sec.trainingFormat ?? [];
  const freq      = sec.trainingFrequency ?? '';
  const barriers  = sec.trainingBarriers ?? '';
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

  const handleFreq = (opt) =>
    patch({ trainingFrequency: freq === opt ? '' : opt });

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }} className="space-y-6">

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
